const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  moderatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  moderatorName: {
    type: String,
    required: true,
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  targetUsername: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      "kick_room",
      "mute_room",
      "unmute_room",
      "ban_room",
      "unban_room",
      "ban_global",
      "unban_global",
      "mute_global",
      "unmute_global",
      "password_reset",
    ],
  },
  room: {
    type: String,
    default: null,
  },
  reason: {
    type: String,
    default: "",
  },
  durationMinutes: {
    type: Number,
    default: null,
  },
  ip: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
