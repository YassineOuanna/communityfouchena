const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

// online users map: socketId -> { userId, username }
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
    onlineUsers.set(socket.id, { userId, username });

    // Broadcast updated online list
    io.emit("online_users", getOnlineList());

    // Join a room (WITHOUT auto-marking as seen; only mark seen when client is visible!)
    socket.on("join_room", async ({ room }) => {
      if (!room || typeof room !== "string") return;
      const cleanRoom = room.slice(0, 50).trim();

      socket.rooms.forEach((r) => { if (r !== socket.id) socket.leave(r); });
      socket.join(cleanRoom);
      socket.currentRoom = cleanRoom;
    });

    // Send message to room (with strict validation & size limit)
    socket.on("send_message", async ({ room, content }) => {
      if (!content || typeof content !== "string") return;
      const cleanContent = content.trim();
      if (!cleanContent || cleanContent.length > 2000) return;
      if (!room || typeof room !== "string") return;

      try {
        const msg = await Message.create({
          sender: userId,
          senderName: username,
          content: cleanContent,
          room: room.slice(0, 50).trim(),
          seenBy: [],
        });
        io.to(room).emit("new_message", msg);
      } catch (err) {
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Send DM (with strict validation & size limit)
    socket.on("send_dm", async ({ toUserId, toUsername, content }) => {
      if (!content || typeof content !== "string") return;
      const cleanContent = content.trim();
      if (!cleanContent || cleanContent.length > 2000) return;
      if (!toUserId) return;

      try {
        const msg = await Message.create({
          sender: userId,
          senderName: username,
          content: cleanContent,
          room: `dm_${[userId, toUserId].sort().join("_")}`,
          dmTo: toUserId,
          seenBy: [],
        });

        // Send to recipient's socket(s)
        for (const [sId, u] of onlineUsers) {
          if (u.userId === toUserId) {
            io.to(sId).emit("new_dm", { ...msg.toObject(), fromUsername: username });
          }
        }
        // Also send back to sender
        socket.emit("new_dm", { ...msg.toObject(), fromUsername: username });
      } catch (err) {
        socket.emit("error", { message: "Failed to send DM" });
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
    for (const { userId, username } of onlineUsers.values()) {
      if (!seen.has(userId)) {
        seen.add(userId);
        list.push({ userId, username });
      }
    }
    return list;
  }
};
