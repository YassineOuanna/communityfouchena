const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, isAdmin: !!user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "Username and password required" });

    const exists = await User.findOne({ username: username.trim() });
    if (exists)
      return res.status(409).json({ message: "Username already taken" });

    const user = new User({
      username: username.trim(),
      password,
      email: email && email.trim() ? email.trim() : null,
      isAdmin: false,
    });
    await user.save();

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: !!user.isAdmin,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "Username and password required" });

    const user = await User.findOne({ username: username.trim() });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const valid = await user.comparePassword(password);
    if (!valid)
      return res.status(401).json({ message: "Wrong password" });

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: !!user.isAdmin,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
