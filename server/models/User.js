const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 30,
  },
  password: {
    type: String,
    required: true,
    minlength: 4,
  },
  email: {
    type: String,
    default: null,
    sparse: true,
  },
  avatar: {
    type: String,
    default: null,
  },
  customStatus: {
    type: String,
    default: "Exploring the community ✨",
    maxlength: 100,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ["user", "moderator", "admin"],
    default: "user",
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  banReason: {
    type: String,
    default: "",
  },
  bannedAt: {
    type: Date,
    default: null,
  },
  bannedUntil: {
    type: Date,
    default: null, // null = permanent
  },
  isMuted: {
    type: Boolean,
    default: false,
  },
  mutedUntil: {
    type: Date,
    default: null, // null = permanent if isMuted is true
  },
  muteReason: {
    type: String,
    default: "",
  },
  mutedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", userSchema);
