const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: "" },
  isPrivate: { type: Boolean, default: false },
  password: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

roomSchema.pre("save", async function (next) {
  if (this.isPrivate && this.password && this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model("Room", roomSchema);
