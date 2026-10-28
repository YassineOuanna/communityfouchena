const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");
const Room = require("../models/Room");

// online users map: socketId -> { userId, username, isAdmin }
const onlineUsers = new Map();

module.exports = (io) => {
  // Authenticate socket connection via token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid or expired session token"));
    }
  });

  io.on("connection", (socket) => {
    const { id: userId, username } = socket.user;
    const isAdmin = socket.user.isAdmin || ["admin", "wana"].includes(username);
    onlineUsers.set(socket.id, { userId, username, isAdmin });

    // Broadcast updated online list
    io.emit("online_users", getOnlineList());

    // Join a room (with ban and kick validation)
    socket.on("join_room", async ({ room }) => {
      if (!room || typeof room !== "string") return;
      const cleanRoom = room.slice(0, 50).trim();

      if (!cleanRoom.startsWith("dm_")) {
        const roomDoc = await Room.findOne({ name: cleanRoom });
        if (roomDoc) {
          const isKicked = roomDoc.kickedUsers?.some((u) => u.username === username || u.userId?.toString() === userId);
          const isBanned = roomDoc.bannedUsers?.some((u) => u.username === username || u.userId?.toString() === userId);
          if (isKicked || isBanned) {
            socket.emit("kicked_from_room", {
              room: cleanRoom,
              message: "You are not allowed to access #" + cleanRoom + " (kicked or blacklisted).",
            });
            return;
          }
        }
      }

      socket.rooms.forEach((r) => { if (r !== socket.id) socket.leave(r); });
      socket.join(cleanRoom);
      socket.currentRoom = cleanRoom;
    });

    // Send message to room (with strict moderation enforcement)
    socket.on("send_message", async ({ room, content }) => {
      if (!content || typeof content !== "string") return;
      const cleanContent = content.trim();
      if (!cleanContent || cleanContent.length > 2000) return;
      if (!room || typeof room !== "string") return;
      const cleanRoom = room.slice(0, 50).trim();

      try {
        // 1. Check global ban & global mute
        const userDoc = await User.findById(userId);
        if (userDoc?.isBanned) {
          socket.emit("error", { message: "Your account has been blacklisted from the community." });
          return;
        }
        if (userDoc?.mutedUntil && new Date(userDoc.mutedUntil) > new Date()) {
          const timeLeft = Math.ceil((new Date(userDoc.mutedUntil) - new Date()) / 60000);
          socket.emit("error", { message: `You are globally muted for another ${timeLeft} minute(s).` });
          return;
        }

        // 2. Check room-level mute & ban
        if (!cleanRoom.startsWith("dm_")) {
          const roomDoc = await Room.findOne({ name: cleanRoom });
          if (roomDoc) {
            const isBanned = roomDoc.bannedUsers?.some((u) => u.username === username || u.userId?.toString() === userId);
            const isKicked = roomDoc.kickedUsers?.some((u) => u.username === username || u.userId?.toString() === userId);
            if (isBanned || isKicked) {
              socket.emit("error", { message: "You are blacklisted/kicked from #" + cleanRoom });
              return;
            }

            const muteEntry = roomDoc.mutedUsers?.find((u) => u.username === username || u.userId?.toString() === userId);
            if (muteEntry) {
              if (!muteEntry.until) {
                socket.emit("error", { message: `You are permanently muted in #${cleanRoom}.` });
                return;
              } else if (new Date(muteEntry.until) > new Date()) {
                const mins = Math.ceil((new Date(muteEntry.until) - new Date()) / 60000);
                socket.emit("error", { message: `You are muted in #${cleanRoom} for another ${mins} minute(s).` });
                return;
              }
            }
          }
        }

        const msg = await Message.create({
          sender: userId,
          senderName: username,
          content: cleanContent,
          room: cleanRoom,
          seenBy: [],
        });
        io.to(cleanRoom).emit("new_message", msg);
      } catch (err) {
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Send DM (with ban check)
    socket.on("send_dm", async ({ toUserId, toUsername, content }) => {
      if (!content || typeof content !== "string") return;
      const cleanContent = content.trim();
      if (!cleanContent || cleanContent.length > 2000) return;
      if (!toUserId) return;

      try {
        const userDoc = await User.findById(userId);
        if (userDoc?.isBanned) {
          socket.emit("error", { message: "Your account is blacklisted." });
          return;
        }

        const msg = await Message.create({
          sender: userId,
          senderName: username,
          content: cleanContent,
          room: `dm_${[userId, toUserId].sort().join("_")}`,
          dmTo: toUserId,
          seenBy: [],
        });

        for (const [sId, u] of onlineUsers) {
          if (u.userId === toUserId) {
            io.to(sId).emit("new_dm", { ...msg.toObject(), fromUsername: username });
          }
        }
        socket.emit("new_dm", { ...msg.toObject(), fromUsername: username });
      } catch (err) {
        socket.emit("error", { message: "Failed to send DM" });
      }
    });

    // Moderate User (Kick, Mute with durations, Blacklist / Ban)
    socket.on("moderate_user", async ({ targetUserId, targetUsername, action, room, durationMinutes }) => {
      // Caller must be Admin or Room Creator
      const callerIsAdmin = isAdmin || ["admin", "wana"].includes(username);
      let isRoomCreator = false;

      if (room && !room.startsWith("dm_")) {
        const rDoc = await Room.findOne({ name: room });
        if (rDoc && rDoc.createdBy?.toString() === userId) {
          isRoomCreator = true;
        }
      }

      if (!callerIsAdmin && !isRoomCreator) {
        socket.emit("error", { message: "You do not have moderator permissions for this action." });
        return;
      }

      // Cannot moderate master admins
      if (["admin", "wana"].includes(targetUsername)) {
        socket.emit("error", { message: "Cannot moderate master administrator accounts." });
        return;
      }

      try {
        const targetSockets = [];
        for (const [sId, u] of onlineUsers) {
          if (u.username === targetUsername || u.userId === targetUserId) {
            targetSockets.push(sId);
          }
        }

        // 1. KICK FROM CHANNEL
        if (action === "kick_room" && room) {
          await Room.findOneAndUpdate(
            { name: room },
            { $addToSet: { kickedUsers: { userId: targetUserId, username: targetUsername, kickedAt: new Date() } } }
          );

          for (const sId of targetSockets) {
            const targetSocket = io.sockets.sockets.get(sId);
            if (targetSocket) {
              targetSocket.leave(room);
              targetSocket.emit("kicked_from_room", {
                room,
                message: `You were kicked from #${room}. You will no longer see this room.`,
              });
            }
          }
          io.to(room).emit("moderation_alert", {
            message: `@${targetUsername} was kicked from #${room} by @${username}.`,
          });
          socket.emit("moderation_success", { message: `@${targetUsername} kicked from #${room}.` });
        }

        // 2. MUTE USER (with durations or permanent)
        else if (action === "mute_room" && room) {
          const until = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;
          await Room.findOneAndUpdate(
            { name: room },
            {
              $pull: { mutedUsers: { username: targetUsername } },
            }
          );
          await Room.findOneAndUpdate(
            { name: room },
            {
              $push: { mutedUsers: { userId: targetUserId, username: targetUsername, until, mutedAt: new Date() } },
            }
          );

          const durationText = durationMinutes ? `${durationMinutes}m` : "permanently";
          for (const sId of targetSockets) {
            io.to(sId).emit("moderation_notice", {
              action: "muted",
              room,
              message: `You have been muted in #${room} (${durationText}) by @${username}.`,
            });
          }
          io.to(room).emit("moderation_alert", {
            message: `@${targetUsername} was muted in #${room} (${durationText}).`,
          });
          socket.emit("moderation_success", { message: `@${targetUsername} muted in #${room} (${durationText}).` });
        }

        // 3. UNMUTE USER
        else if (action === "unmute_room" && room) {
          await Room.findOneAndUpdate(
            { name: room },
            { $pull: { mutedUsers: { username: targetUsername } } }
          );
          for (const sId of targetSockets) {
            io.to(sId).emit("moderation_notice", {
              action: "unmuted",
              room,
              message: `You have been unmuted in #${room}.`,
            });
          }
          socket.emit("moderation_success", { message: `@${targetUsername} unmuted in #${room}.` });
        }

        // 4. BLACKLIST FROM THIS ROOM
        else if (action === "ban_room" && room) {
          await Room.findOneAndUpdate(
            { name: room },
            { $addToSet: { bannedUsers: { userId: targetUserId, username: targetUsername, bannedAt: new Date() } } }
          );

          for (const sId of targetSockets) {
            const targetSocket = io.sockets.sockets.get(sId);
            if (targetSocket) {
              targetSocket.leave(room);
              targetSocket.emit("kicked_from_room", {
                room,
                message: `You have been blacklisted from #${room}.`,
              });
            }
          }
          io.to(room).emit("moderation_alert", {
            message: `@${targetUsername} has been blacklisted from #${room}.`,
          });
          socket.emit("moderation_success", { message: `@${targetUsername} blacklisted from #${room}.` });
        }

        // 5. UNBAN / REMOVE BLACKLIST FROM THIS ROOM
        else if (action === "unban_room" && room) {
          await Room.findOneAndUpdate(
            { name: room },
            {
              $pull: {
                bannedUsers: { username: targetUsername },
                kickedUsers: { username: targetUsername },
              },
            }
          );
          socket.emit("moderation_success", { message: `Blacklist removed for @${targetUsername} in #${room}.` });
        }

        // 6. GLOBAL BLACKLIST (ALL ROOMS - Admin Only)
        else if (action === "ban_global" && callerIsAdmin) {
          await User.findByIdAndUpdate(targetUserId, { isBanned: true });
          for (const sId of targetSockets) {
            io.to(sId).emit("force_disconnect", {
              message: "Your account has been permanently blacklisted from all rooms.",
            });
            const tSock = io.sockets.sockets.get(sId);
            tSock?.disconnect(true);
          }
          io.emit("moderation_alert", {
            message: `@${targetUsername} was blacklisted from the entire community.`,
          });
          socket.emit("moderation_success", { message: `@${targetUsername} blacklisted globally.` });
        }

        // 7. REMOVE GLOBAL BLACKLIST (Admin Only)
        else if (action === "unban_global" && callerIsAdmin) {
          await User.findByIdAndUpdate(targetUserId, { isBanned: false });
          socket.emit("moderation_success", { message: `Global blacklist lifted for @${targetUsername}.` });
        }
      } catch (err) {
        socket.emit("error", { message: "Moderation action failed: " + err.message });
      }
    });

    // Typing indicator
    socket.on("typing", ({ room, isTyping }) => {
      if (!room || typeof room !== "string") return;
      socket.to(room).emit("user_typing", { username, isTyping: !!isTyping });
    });

    // Mark messages as seen ONLY when explicitly triggered by an active/focused viewer
    socket.on("mark_seen", async ({ room }) => {
      if (!room || typeof room !== "string") return;
      try {
        await Message.updateMany(
          {
            room,
            sender: { $ne: userId },
            "seenBy.username": { $ne: username },
          },
          {
            $push: { seenBy: { userId, username, seenAt: new Date() } },
            $set: { seen: true },
          }
        );
        io.to(room).emit("messages_seen", { room, userId, username });
      } catch (err) {
        console.error("mark_seen error:", err);
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      io.emit("online_users", getOnlineList());
    });
  });

  function getOnlineList() {
    const seen = new Set();
    const list = [];
    for (const { userId, username, isAdmin } of onlineUsers.values()) {
      if (!seen.has(userId)) {
        seen.add(userId);
        list.push({ userId, username, isAdmin: !!isAdmin });
      }
    }
    return list;
  }
};
