const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const BannedIdentifier = require("../models/BannedIdentifier");
const AuditLog = require("../models/AuditLog");
const authMiddleware = require("../middleware/auth");
const { getUserRestrictions } = require("../utils/restrictions");

// Rate limit specifically for login & register to prevent brute-force without affecting session routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many authentication attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      username: user.username,
      isAdmin: !!user.isAdmin,
      role: user.role || "user",
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

// POST /api/auth/register (With Ban Evasion Protection)
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;

    // Ban Evasion Check: Block re-registering with banned username or email
    const bannedMatch = await BannedIdentifier.findOne({
      $or: [
        { type: "username", value: cleanUsername },
        ...(cleanEmail ? [{ type: "email", value: cleanEmail }] : []),
      ],
    });

    if (bannedMatch) {
      return res.status(403).json({
        code: "BAN_EVASION_BLOCKED",
        message: "Registration rejected. This identifier is permanently blacklisted.",
        reason: bannedMatch.reason,
      });
    }

    // Check if user already exists
    const exists = await User.findOne({
      $or: [
        { username: new RegExp(`^${cleanUsername}$`, "i") },
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
      ],
    });

    if (exists) {
      if (exists.isBanned) {
        return res.status(403).json({
          code: "BAN_EVASION_BLOCKED",
          message: "Registration rejected: Account identifier has been blacklisted.",
        });
      }
      return res.status(409).json({ message: "Username or email is already taken." });
    }

    const user = new User({
      username: username.trim(),
      password,
      email: cleanEmail,
      isAdmin: false,
      role: "user",
      tokenVersion: 0,
    });
    await user.save();

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        isAdmin: !!user.isAdmin,
        role: user.role,
        customStatus: user.customStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/auth/login (Enforces Global Ban at Handshake)
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(404).json({ message: "Invalid username or password" });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Check Global Ban via Central Restriction Checker
    const rest = await getUserRestrictions(user._id);
    if (rest.isGlobalBanned) {
      return res.status(403).json({
        code: "USER_BANNED",
        message: "Your account is blacklisted from CommunityFouchena.",
        reason: rest.banReason || "Violation of community rules",
        bannedUntil: rest.bannedUntil,
      });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        isAdmin: !!user.isAdmin,
        role: user.role,
        customStatus: user.customStatus,
        restrictions: rest,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    const restrictions = await getUserRestrictions(user._id, req.query.room);
    res.json({ ...user.toObject(), restrictions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/restrictions - Active Mute / Ban / Kick State on Refresh
router.get("/restrictions", authMiddleware, async (req, res) => {
  try {
    const room = req.query.room || "global";
    const restrictions = await getUserRestrictions(req.user.id, room);
    res.json(restrictions);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/auth/profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { customStatus, avatar } = req.body;
    const updates = {};
    if (typeof customStatus === "string") updates.customStatus = customStatus.slice(0, 100);
    if (typeof avatar === "string") updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/auth/change-password
// REQUIREMENT E: Immediately revoke all existing sessions, old password fails, old tokens dead
router.post("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: "New password must be at least 4 characters long." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ message: "Incorrect current password." });
    }

    // Update password
    user.password = newPassword;
    // Increment tokenVersion so all existing sessions and old JWT tokens are instantly invalidated
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Log in audit log
    await AuditLog.create({
      moderatorId: user._id,
      moderatorName: user.username,
      targetUserId: user._id,
      targetUsername: user.username,
      action: "password_reset",
      reason: "User changed password; all prior sessions revoked",
    });

    // Generate fresh new token for the user
    const newToken = signToken(user);
    res.json({
      message: "Password updated successfully. All other sessions have been terminated.",
      token: newToken,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
