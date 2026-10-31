const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");
const { getUserRestrictions } = require("../utils/restrictions");

// GET /api/rooms - Only return rooms the user has permission to view, strictly deduplicated
router.get("/", authMiddleware, async (req, res) => {
  try {
    const allRooms = await Room.find({ isPrivate: false }).select("-password");
    // Filter rooms through central restriction check and deduplicate by lowercased name
    const accessible = [];
    const seenNames = new Set();

    for (const r of allRooms) {
      if (!r || !r.name) continue;
      const cleanKey = r.name.trim().toLowerCase();
      if (seenNames.has(cleanKey)) continue;

      const rest = await getUserRestrictions(req.user.id, r.name);
      if (rest.canAccessRoom) {
        seenNames.add(cleanKey);
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

    // Broadcast new public room to connected clients
    const io = req.app.get("io");
    if (io && !room.isPrivate) {
      io.emit("new_room", { ...room.toObject(), password: undefined });
    }

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

// DELETE /api/rooms/:id - Delete room (Admin or creator)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const isCreator = room.createdBy && room.createdBy.toString() === req.user.id;
    if (!req.user.isAdmin && !isCreator) {
      return res.status(403).json({ message: "Admin privileges required to delete channels." });
    }

    if (room.name === "global") {
      return res.status(400).json({ message: "Cannot delete the default #global room." });
    }

    const roomName = room.name;
    await Promise.all([
      Room.findByIdAndDelete(req.params.id),
      Message.deleteMany({ room: roomName }),
    ]);

    const io = req.app.get("io");
    if (io) {
      io.emit("room_deleted", { roomId: req.params.id, roomName });
    }

    res.json({ message: `Channel #${roomName} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
