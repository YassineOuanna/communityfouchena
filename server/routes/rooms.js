const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");
const bcrypt = require("bcryptjs");

// GET /api/rooms - Filter out rooms user is kicked or banned from
router.get("/", authMiddleware, async (req, res) => {
  try {
    const rooms = await Room.find({
      isPrivate: false,
      "bannedUsers.userId": { $ne: req.user.id },
      "kickedUsers.userId": { $ne: req.user.id },
    }).select("-password");
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/rooms
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, isPrivate, password } = req.body;
    if (!name) return res.status(400).json({ message: "Room name required" });

    const exists = await Room.findOne({ name: name.trim() });
    if (exists) return res.status(409).json({ message: "Room name taken" });

    const room = new Room({
      name: name.trim(),
      description: description || "",
      isPrivate: !!isPrivate,
      password: isPrivate && password ? password : null,
      createdBy: req.user.id,
    });
    await room.save();
    res.status(201).json({ ...room.toObject(), password: undefined });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/rooms/:room/messages
router.get("/:room/messages", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room, dmTo: null })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/rooms/dm/:userId  (DM history between current user and userId)
router.get("/dm/:userId", authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, dmTo: req.params.userId },
        { sender: req.params.userId, dmTo: req.user.id },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
