const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");
const Room = require("../models/Room");

// online users map: socketId -> { userId, username, isAdmin, customStatus, avatar }
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

  io.on("connection", async (socket) => {
    const { id: userId, username } = socket.user;
    const isAdmin = socket.user.isAdmin || ["admin", "wana"].includes((username || "").toLowerCase());

    let userDocData = null;
    try {
      userDocData = await User.findById(userId).select("customStatus avatar");
    } catch {}

    onlineUsers.set(socket.id, {
      userId,
      username,
      isAdmin,
      customStatus: userDocData?.customStatus || "Exploring the community ✨",
      avatar: userDocData?.avatar || null,
    });

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

    // Send message to room (with reply, attachment, moderation enforcement)
    socket.on("send_message", async ({ room, content, replyTo, attachment }) => {
      const hasContent = content && typeof content === "string" && content.trim().length > 0;
      const hasAttachment = attachment && (attachment.url || attachment.data);
      if (!hasContent && !hasAttachment) return;

      const cleanContent = hasContent ? content.trim().slice(0, 2000) : "";
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

        const msgPayload = {
          sender: userId,
          senderName: username,
          content: cleanContent,
          room: cleanRoom,
          seenBy: [],
        };

        if (replyTo && replyTo.messageId) {
          msgPayload.replyTo = {
            messageId: replyTo.messageId,
            senderName: replyTo.senderName || "",
            content: (replyTo.content || "").slice(0, 150),
          };
        }

        if (attachment) {
          msgPayload.attachment = {
            url: attachment.url || attachment.data,
            fileType: attachment.fileType || "file",
            fileName: attachment.fileName || "attachment",
            fileSize: attachment.fileSize || 0,
            duration: attachment.duration || null,
          };
        }

        const msg = await Message.create(msgPayload);
        io.to(cleanRoom).emit("new_message", msg);
      } catch (err) {
        socket.emit("error", { message: "Failed to send message: " + err.message });
      }
    });

    // Send DM (with ban check, replyTo, attachment)
    socket.on("send_dm", async ({ toUserId, toUsername, content, replyTo, attachment }) => {
      const hasContent = content && typeof content === "string" && content.trim().length > 0;
      const hasAttachment = attachment && (attachment.url || attachment.data);
      if (!hasContent && !hasAttachment) return;
      if (!toUserId) return;

      const cleanContent = hasContent ? content.trim().slice(0, 2000) : "";

      try {
        const userDoc = await User.findById(userId);
        if (userDoc?.isBanned) {
          socket.emit("error", { message: "Your account is blacklisted." });
          return;
        }

        const msgPayload = {
          sender: userId,
          senderName: username,
          content: cleanContent,
          room: `dm_${[userId, toUserId].sort().join("_")}`,
          dmTo: toUserId,
          seenBy: [],
        };

        if (replyTo && replyTo.messageId) {
          msgPayload.replyTo = {
            messageId: replyTo.messageId,
            senderName: replyTo.senderName || "",
            content: (replyTo.content || "").slice(0, 150),
          };
        }

        if (attachment) {
          msgPayload.attachment = {
            url: attachment.url || attachment.data,
            fileType: attachment.fileType || "file",
            fileName: attachment.fileName || "attachment",
            fileSize: attachment.fileSize || 0,
            duration: attachment.duration || null,
          };
        }

        const msg = await Message.create(msgPayload);

        for (const [sId, u] of onlineUsers) {
          if (u.userId === toUserId) {
            io.to(sId).emit("new_dm", { ...msg.toObject(), fromUsername: username });
          }
        }
        socket.emit("new_dm", { ...msg.toObject(), fromUsername: username });
      } catch (err) {
        socket.emit("error", { message: "Failed to send DM: " + err.message });
      }
    });

    // Edit message
    socket.on("edit_message", async ({ messageId, newContent, room }) => {
      if (!messageId || !newContent || typeof newContent !== "string") return;
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;
        if (msg.sender.toString() !== userId) {
          socket.emit("error", { message: "You can only edit your own messages" });
          return;
        }
        msg.content = newContent.trim().slice(0, 2000);
        msg.isEdited = true;
        msg.editedAt = new Date();
        await msg.save();
        io.to(room).emit("message_edited", msg);
      } catch (err) {
        socket.emit("error", { message: "Failed to edit message" });
      }
    });

    // Delete message
    socket.on("delete_message", async ({ messageId, room }) => {
      if (!messageId) return;
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;
        const canDelete = msg.sender.toString() === userId || isAdmin;
        if (!canDelete) {
          socket.emit("error", { message: "Permission denied" });
          return;
        }
        msg.isDeleted = true;
        msg.content = "This message was deleted.";
        msg.attachment = null;
        await msg.save();
        io.to(room).emit("message_deleted", { messageId, room, isDeleted: true });
      } catch (err) {
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    // Emoji reaction toggle
    socket.on("react_message", async ({ messageId, emoji, room }) => {
      if (!messageId || !emoji) return;
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;
        if (!Array.isArray(msg.reactions)) msg.reactions = [];

        const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
        if (existingReaction) {
          const userIdx = existingReaction.users.findIndex(
            (u) => u.username === username || u.userId === userId
          );
          if (userIdx > -1) {
            existingReaction.users.splice(userIdx, 1);
            if (existingReaction.users.length === 0) {
              msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
            }
          } else {
            existingReaction.users.push({ userId, username });
          }
        } else {
          msg.reactions.push({
            emoji,
            users: [{ userId, username }],
          });
        }

        await msg.save();
        io.to(room).emit("message_reacted", {
          messageId,
          reactions: msg.reactions,
          room,
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to react to message" });
      }
    });

    // Update profile custom status
    socket.on("update_custom_status", async ({ status }) => {
      try {
        const clean = (status || "").slice(0, 100);
        await User.findByIdAndUpdate(userId, { customStatus: clean });
        for (const [sId, u] of onlineUsers) {
          if (u.userId === userId) {
            u.customStatus = clean;
          }
        }
        io.emit("online_users", getOnlineList());
      } catch (err) {}
    });

    // Calling signaling (Voice and Video)
    socket.on("call_user", ({ toUserId, toUsername, room, type }) => {
      // Direct call
      if (toUserId) {
        for (const [sId, u] of onlineUsers) {
          if (u.userId === toUserId) {
            io.to(sId).emit("incoming_call", {
              fromUserId: userId,
              fromUsername: username,
              type: type || "voice",
              room,
            });
          }
        }
      } else if (room) {
        socket.to(room).emit("incoming_call", {
          fromUserId: userId,
          fromUsername: username,
          type: type || "voice",
          room,
        });
      }
    });

    socket.on("call_response", ({ toUserId, action, room }) => {
      // action: "accepted" | "rejected" | "ended"
      for (const [sId, u] of onlineUsers) {
        if (u.userId === toUserId) {
          io.to(sId).emit("call_status", { fromUserId: userId, fromUsername: username, action, room });
        }
      }
      if (room) {
        socket.to(room).emit("call_status", { fromUserId: userId, fromUsername: username, action, room });
      }
    });

    // Moderate User (Kick, Mute with durations, Blacklist / Ban)
    socket.on("moderate_user", async ({ targetUserId, targetUsername, action, room, durationMinutes }) => {
      const callerIsAdmin = isAdmin || ["admin", "wana"].includes((username || "").toLowerCase());
      let isRoomCreator = false;

      if (room && !room.startsWith("dm_")) {
        const rDoc = await Room.findOne({ name: room });
        if (rDoc && (rDoc.createdBy?.toString() === userId || rDoc.creator === username)) {
          isRoomCreator = true;
        }
      }

      if (!callerIsAdmin && !isRoomCreator && room !== "global") {
        socket.emit("error", { message: "You do not have moderator permissions for this action." });
        return;
      }

      if (["admin"].includes((targetUsername || "").toLowerCase()) && (username || "").toLowerCase() !== "admin") {
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
            { $pull: { mutedUsers: { username: targetUsername } } }
          );
          await Room.findOneAndUpdate(
            { name: room },
            { $push: { mutedUsers: { userId: targetUserId, username: targetUsername, until, mutedAt: new Date() } } }
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
    for (const { userId, username, isAdmin, customStatus, avatar } of onlineUsers.values()) {
      if (!seen.has(userId)) {
        seen.add(userId);
        list.push({
          userId,
          username,
          isAdmin: !!isAdmin,
          customStatus: customStatus || "Exploring the community ✨",
          avatar: avatar || null,
        });
      }
    }
    return list;
  }
};
