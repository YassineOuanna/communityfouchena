const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const User = require("../models/User");
const Message = require("../models/Message");
const Room = require("../models/Room");

// Admin gatekeeper middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }
  next();
};

router.use(authMiddleware, requireAdmin);

// GET /api/admin/stats - Database overview metrics
router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, totalMessages, totalRooms, recentUsers] = await Promise.all([
      User.countDocuments(),
      Message.countDocuments(),
      Room.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select("-password"),
    ]);

    res.json({
      totalUsers,
      totalMessages,
      totalRooms,
      recentUsers,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/admin/users - All registered users in MongoDB
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE /api/admin/users/:id - Delete a user
router.delete("/users/:id", async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) return res.status(404).json({ message: "User not found" });

    // Prevent deleting primary admin accounts
    if (userToDelete.username === "admin" || userToDelete.username === "wana") {
      return res.status(400).json({ message: "Cannot delete master admin account." });
    }

    await Promise.all([
      User.findByIdAndDelete(req.params.id),
      Message.deleteMany({ sender: req.params.id }),
    ]);

    res.json({ message: `User ${userToDelete.username} and their messages deleted.` });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/admin/users/:id/reset-password - Admin resets any user's password
router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters long." });
    }
    const userToReset = await User.findById(req.params.id);
    if (!userToReset) return res.status(404).json({ message: "User not found" });

    userToReset.password = newPassword;
    await userToReset.save();
    res.json({ message: `Password for @${userToReset.username} has been reset successfully.` });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/admin/messages - Recent messages across all rooms
router.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE /api/admin/messages/:id - Moderate/delete inappropriate message
router.delete("/messages/:id", async (req, res) => {
  try {
    const msg = await Message.findByIdAndDelete(req.params.id);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    res.json({ message: "Message deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/admin/rooms - All rooms with message counts & metadata
router.get("/rooms", async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 });
    const roomStats = await Promise.all(
      rooms.map(async (r) => {
        const msgCount = await Message.countDocuments({ room: r.name });
        return {
          ...r.toObject(),
          messageCount: msgCount,
        };
      })
    );
    res.json(roomStats);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/admin/rooms - Admin creates a new channel
router.post("/rooms", async (req, res) => {
  try {
    const { name, description, isPrivate, password } = req.body;
    if (!name) return res.status(400).json({ message: "Room name is required" });

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleanName) return res.status(400).json({ message: "Invalid room name" });

    const exists = await Room.findOne({ name: cleanName });
    if (exists) return res.status(409).json({ message: `Channel #${cleanName} already exists` });

    const room = new Room({
      name: cleanName,
      description: description?.trim() || "",
      isPrivate: !!isPrivate,
      password: isPrivate && password ? password : null,
      createdBy: req.user.id,
    });
    await room.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("new_room", { ...room.toObject(), password: undefined });
    }

    res.status(201).json({ ...room.toObject(), password: undefined });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE /api/admin/rooms/:id - Admin deletes a room & its messages
router.delete("/rooms/:id", async (req, res) => {
  try {
    const roomToDelete = await Room.findById(req.params.id);
    if (!roomToDelete) return res.status(404).json({ message: "Room not found" });

    // Protect default global community room
    if (roomToDelete.name === "global") {
      return res.status(400).json({ message: "Cannot delete the default #global community room." });
    }

    const roomName = roomToDelete.name;

    await Promise.all([
      Room.findByIdAndDelete(req.params.id),
      Message.deleteMany({ room: roomName }),
    ]);

    const io = req.app.get("io");
    if (io) {
      io.emit("room_deleted", { roomId: req.params.id, roomName });
    }

    res.json({ message: `Channel #${roomName} and all its messages were permanently deleted.` });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE /api/admin/rooms/:id/messages - Clear all messages in a channel
router.delete("/rooms/:id/messages", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    await Message.deleteMany({ room: room.name });

    const io = req.app.get("io");
    if (io) {
      io.to(room.name).emit("room_messages_cleared", { room: room.name });
    }

    res.json({ message: `All messages in #${room.name} have been cleared.` });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
