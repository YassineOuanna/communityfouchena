const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");
const { getUserRestrictions } = require("../utils/restrictions");

// GET /api/rooms - Only return rooms the user has permission to view
router.get("/", authMiddleware, async (req, res) => {
  try {
    const allRooms = await Room.find({ isPrivate: false }).select("-password");
    // Filter rooms through central restriction check
    const accessible = [];
    for (const r of allRooms) {
      const rest = await getUserRestrictions(req.user.id, r.name);
      if (rest.canAccessRoom) {
        accessible.push(r);
      }
    }
    res.json(accessible);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/rooms
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, isPrivate, password } = req.body;
    if (!name) return res.status(400).json({ message: "Room name required" });

    // Check if user is restricted
    const rest = await getUserRestrictions(req.user.id);
    if (rest.isGlobalBanned || rest.isGlobalMuted) {
      return res.status(403).json({ message: "Restricted accounts cannot create rooms." });
    }

    const cleanName = name.trim().toLowerCase();
    const exists = await Room.findOne({ name: cleanName });
    if (exists) return res.status(409).json({ message: "Room name taken" });

    const room = new Room({
      name: cleanName,
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

// GET /api/rooms/:room/messages - STUBBORNLY BLOCKS ROOM-BANNED / KICKED USERS
router.get("/:room/messages", authMiddleware, async (req, res) => {
  try {
    const { room } = req.params;
    const restrictions = await getUserRestrictions(req.user.id, room);

    // Enforcement: Room ban / kick prevents fetching history through any direct route
    if (!restrictions.canAccessRoom) {
      return res.status(403).json({
        code: "ACCESS_DENIED",
        message: restrictions.accessBlockReason || `You are not permitted to read messages from #${room}.`,
        restrictions,
      });
    }

    const messages = await Message.find({ room, dmTo: null })
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
    const targetUserId = req.params.userId;
    const restrictions = await getUserRestrictions(req.user.id);
    if (restrictions.isGlobalBanned) {
      return res.status(403).json({ message: "Account blacklisted" });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, dmTo: targetUserId },
        { sender: targetUserId, dmTo: req.user.id },
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
