const mongoose = require("mongoose");

const seenBySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },
    seenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [
      {
        userId: { type: String, required: true },
        username: { type: String, required: true },
      },
    ],
  },
  { _id: false }
);

const replyToSchema = new mongoose.Schema(
  {
    messageId: { type: String },
    senderName: { type: String },
    content: { type: String },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String },
    fileType: { type: String, enum: ["image", "audio", "file"], default: "file" },
    fileName: { type: String },
    fileSize: { type: Number },
    duration: { type: Number }, // For audio/voice recordings
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  senderName: { type: String, required: true },
  content: { type: String, default: "" },
  room: { type: String, default: "global" },
  dmTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  seen: { type: Boolean, default: false },
  seenBy: { type: [seenBySchema], default: [] },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },
  reactions: { type: [reactionSchema], default: [] },
  replyTo: { type: replyToSchema, default: null },
  attachment: { type: attachmentSchema, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
