const mongoose = require("mongoose");

const bannedIdentifierSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["username", "email", "ip"],
  },
  value: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  reason: {
    type: String,
    default: "Permanent community blacklist",
  },
  bannedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("BannedIdentifier", bannedIdentifierSchema);
