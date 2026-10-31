const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Room = require("../models/Room");
const User = require("../models/User");
const Message = require("../models/Message");
const BannedIdentifier = require("../models/BannedIdentifier");

async function main() {
  const uri = process.env.MONGO_URI || "mongodb+srv://chopardsamurai_db_user:ASwyQqrRwqx7t0FT@cluster0.qtcstpn.mongodb.net/communityfouchena?retryWrites=true&w=majority";
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected!");

  // 1. Inspect existing rooms
  const allRooms = await Room.find({});
  console.log("Current rooms count:", allRooms.length);
  for (const r of allRooms) {
    console.log(`- Room: id=${r._id}, name="${r.name}", desc="${r.description}"`);
  }

  // 2. Remove attack test rooms
  const delRooms = await Room.deleteMany({ name: { $regex: /^atk_/i } });
  console.log(`Deleted ${delRooms.deletedCount} test rooms.`);

  // 3. Remove attack test users
  const delUsers = await User.deleteMany({ username: { $regex: /^atk_/i } });
  console.log(`Deleted ${delUsers.deletedCount} test users.`);

  // 4. Remove attack test messages
  const delMsgs = await Message.deleteMany({
    $or: [
      { senderName: { $regex: /^atk_/i } },
      { content: { $regex: /AFTER_EXPIRY|EXPLOIT|ATTACK/i } },
      { room: { $regex: /^atk_/i } }
    ]
  });
  console.log(`Deleted ${delMsgs.deletedCount} test messages.`);

  // 5. Remove attack test banned identifiers
  const delBanned = await BannedIdentifier.deleteMany({ value: { $regex: /^atk_/i } });
  console.log(`Deleted ${delBanned.deletedCount} test banned identifiers.`);

  // 6. Handle duplicate 'global' rooms in database if any exist
  const globalRooms = await Room.find({ name: { $regex: /^global$/i } });
  console.log(`Found ${globalRooms.length} global room documents in DB.`);
  if (globalRooms.length > 1) {
    // Keep the first one and delete extras
    const [primary, ...duplicates] = globalRooms;
    for (const dup of duplicates) {
      console.log(`Deleting duplicate global room id=${dup._id}`);
      await Room.deleteOne({ _id: dup._id });
    }
    primary.name = "global";
    primary.description = "General community chat";
    await primary.save();
    console.log(`Updated primary global room id=${primary._id}`);
  } else if (globalRooms.length === 1) {
    globalRooms[0].name = "global";
    globalRooms[0].description = "General community chat";
    await globalRooms[0].save();
  } else {
    // Create global room if not present
    await Room.create({
      name: "global",
      description: "General community chat",
      isPrivate: false,
    });
    console.log("Created default global room.");
  }

  // 7. Verify remaining rooms
  const finalRooms = await Room.find({});
  console.log("\nFinal rooms list in DB:");
  for (const r of finalRooms) {
    console.log(`- Room: id=${r._id}, name="${r.name}", desc="${r.description}"`);
  }

  await mongoose.disconnect();
  console.log("Database cleanup finished successfully.");
}

main().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
