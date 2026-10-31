const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ code: "NO_TOKEN", message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ code: "INVALID_TOKEN", message: "Invalid session token" });
    }

    // Server-side database verification on EVERY request
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ code: "USER_NOT_FOUND", message: "User account no longer exists" });
    }

    // 1. BAN CHECK: A banned user with an old token must still be rejected
    if (user.isBanned) {
      return res.status(403).json({
        code: "USER_BANNED",
        message: "Your account has been blacklisted from the community.",
        reason: user.banReason || "Violation of community standards",
        bannedUntil: user.bannedUntil,
      });
    }

    // 2. SESSION REVOCATION CHECK: Invalidate tokens upon password reset / logout / ban
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({
        code: "TOKEN_REVOKED",
        message: "Session revoked or password was changed. Please log in again.",
      });
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: !!user.isAdmin,
      role: user.role,
      tokenVersion: user.tokenVersion,
      doc: user,
    };
    next();
  } catch (err) {
    return res.status(401).json({ code: "TOKEN_EXPIRED", message: "Invalid or expired session token" });
  }
};
