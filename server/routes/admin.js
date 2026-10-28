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

module.exports = router;
