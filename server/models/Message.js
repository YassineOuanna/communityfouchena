const mongoose = require("mongoose");

const seenBySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String, required: true },
    seenAt: { type: Date, default: Date.now },
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
  content: { type: String, required: true },
  room: { type: String, default: "global" },
  dmTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  seen: { type: Boolean, default: false },
  seenBy: { type: [seenBySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
