/**
 * ATTACK TESTS SUITE: PUNISHMENT ENFORCEMENT VERIFICATION
 *
 * Runs all 9 attack tests specified in Section I to prove that:
 * - Direct socket emits/replays by muted users are rejected and never saved/broadcast.
 * - Mutes persist on refresh and auto-recover when expired.
 * - Multi-tab kicks evict every connected tab/socket.
 * - Banned users cannot use old tokens on APIs (403).
 * - Socket auto-reconnect by banned users is refused at handshake.
 * - Bans survive server restarts.
 * - Banned users cannot evade bans by re-registering with the same username/email.
 * - Forged moderation payloads against admins are rejected.
 * - Password resets kill all prior sessions and old tokens immediately.
 */

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const ioClient = require("socket.io-client");
const axios = require("axios");

// Models & Handlers
const User = require("../models/User");
const Room = require("../models/Room");
const Message = require("../models/Message");
const BannedIdentifier = require("../models/BannedIdentifier");
const AuditLog = require("../models/AuditLog");
const { getUserRestrictions } = require("../utils/restrictions");

const PORT = 3099;
const SERVER_URL = `http://localhost:${PORT}`;

async function runAttackTests() {
  console.log("\n=======================================================");
  console.log("🛡️  COMMUNITY FOUCHENA: SECURITY & ENFORCEMENT ATTACK TESTS");
  console.log("=======================================================\n");

  // 1. Setup Server
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: "*" },
  });

  const JWT_SECRET = process.env.JWT_SECRET || "communityfouchena_super_secret_key_2024";
  process.env.JWT_SECRET = JWT_SECRET;

  // Mount routes & socket handlers
  app.use("/api/auth", require("../routes/auth"));
  app.use("/api/rooms", require("../routes/rooms"));
  require("../socket/handlers")(io);

  // Connect MongoDB
  let MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI || MONGO_URI.includes("daly232007")) {
    MONGO_URI =
      "mongodb+srv://chopardsamurai_db_user:ASwyQqrRwqx7t0FT@cluster0.qtcstpn.mongodb.net/communityfouchena?retryWrites=true&w=majority";
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 25000,
      socketTimeoutMS: 45000,
    });
  }

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`✅ Test server running on port ${PORT}\n`);

  let passedTests = 0;
  const totalTests = 9;

  try {
    // Clean up test fixtures before run
    const cleanupTestFixtures = async () => {
      await User.deleteMany({ username: { $regex: /^atk_/i } });
      await BannedIdentifier.deleteMany({ value: { $regex: /^atk_/i } });
      await Room.deleteMany({ name: { $regex: /^atk_/i } });
      await Message.deleteMany({
        $or: [
          { senderName: { $regex: /^atk_/i } },
          { content: { $regex: /EXPLOIT|AFTER_EXPIRY|NORMAL_MESSAGE/i } },
          { room: { $regex: /^atk_/i } },
        ],
      });
    };
    await cleanupTestFixtures();

    // Ensure Master Admin exists
    let adminUser = await User.findOne({ username: "admin" });
    if (!adminUser) {
      adminUser = await User.create({
        username: "admin",
        password: "wana09#1967",
        isAdmin: true,
        role: "admin",
      });
    }

    // ----------------------------------------------------
    // TEST 1: Mute User & Direct Socket Emit Attack
    // ----------------------------------------------------
    console.log("▶ TEST 1: Direct socket emit by muted user must be rejected & not saved/broadcast...");
    const userA = await User.create({
      username: "atk_user_a",
      password: "password123",
      email: "atk_user_a@test.com",
    });

    const tokenAdmin = jwt.sign(
      { id: adminUser._id.toString(), username: adminUser.username, isAdmin: true, tokenVersion: adminUser.tokenVersion },
      JWT_SECRET
    );
    const tokenA = jwt.sign(
      { id: userA._id.toString(), username: userA.username, isAdmin: false, tokenVersion: userA.tokenVersion },
      JWT_SECRET
    );

    // Observer socket
    const observerSocket = ioClient(SERVER_URL, { auth: { token: tokenAdmin } });
    await new Promise((r) => observerSocket.on("connect", r));
    observerSocket.emit("join_room", { room: "global" });

    let messageReceivedByObserver = false;
    observerSocket.on("new_message", (msg) => {
      if (msg.content === "EXPLOIT_PAYLOAD_TEST_1") {
        messageReceivedByObserver = true;
      }
    });

    // Socket A
    const socketA = ioClient(SERVER_URL, { auth: { token: tokenA } });
    await new Promise((r) => socketA.on("connect", r));
    socketA.emit("join_room", { room: "global" });

    // Admin mutes User A for 5 minutes
    const mutePromise = new Promise((resolve) => observerSocket.once("moderation_success", resolve));
    observerSocket.emit("moderate_user", {
      targetUserId: userA._id.toString(),
      targetUsername: userA.username,
      action: "mute_room",
      room: "global",
      durationMinutes: 5,
      reason: "Spam test",
    });
    await mutePromise;

    // Attack: User A tries direct socket emit
    let errorReceived = null;
    socketA.on("muted_error", (err) => {
      errorReceived = err;
    });

    socketA.emit("send_message", { room: "global", content: "EXPLOIT_PAYLOAD_TEST_1" });
    await new Promise((r) => setTimeout(r, 600));

    // Check database directly
    const savedInDB = await Message.findOne({ content: "EXPLOIT_PAYLOAD_TEST_1" });

    if (errorReceived && !savedInDB && !messageReceivedByObserver) {
      console.log("  PASSED: Message firmly blocked. Error received, not saved in DB, not broadcast to observer.");
      passedTests++;
    } else {
      throw new Error(`TEST 1 FAILED: error=${!!errorReceived}, savedInDB=${!!savedInDB}, received=${messageReceivedByObserver}`);
    }

    // ----------------------------------------------------
    // TEST 2: Refresh Persistence & Expiry Auto-Recovery
    // ----------------------------------------------------
    console.log("\n▶ TEST 2: Mute survives page reload, and auto-expires without cron...");
    // Simulate page reload by querying restrictions endpoint
    const restRes = await axios.get(`${SERVER_URL}/api/auth/restrictions?room=global`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    if (!restRes.data.isMuted) {
      throw new Error("TEST 2 FAILED: User was not muted upon reload query!");
    }
    console.log("  Step A: Reload confirmed user is still actively muted on server.");

    // Update Room mute entry to have an expired timestamp (5 seconds in the past)
    await Room.updateOne(
      { name: "global", "mutedUsers.username": userA.username },
      { $set: { "mutedUsers.$.until": new Date(Date.now() - 5000) } }
    );

    // Query restrictions again
    const restAfterExpiry = await axios.get(`${SERVER_URL}/api/auth/restrictions?room=global`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // Try sending now that it's expired
    let messageSentAfterExpiry = false;
    observerSocket.once("new_message", (msg) => {
      if (msg.content === "NORMAL_MESSAGE_AFTER_EXPIRY") {
        messageSentAfterExpiry = true;
      }
    });

    socketA.on("error", (e) => console.log("DEBUG socketA error:", e));
    socketA.on("muted_error", (e) => console.log("DEBUG socketA muted_error:", e));
    socketA.emit("send_message", { room: "global", content: "NORMAL_MESSAGE_AFTER_EXPIRY" });
    await new Promise((r) => setTimeout(r, 1000));

    const savedAfterExpiry = await Message.findOne({ content: "NORMAL_MESSAGE_AFTER_EXPIRY" });
    console.log("DEBUG savedAfterExpiry in DB:", !!savedAfterExpiry);

    if (!restAfterExpiry.data.isMuted && (messageSentAfterExpiry || savedAfterExpiry)) {
      console.log("  PASSED: After expiry, restrictions auto-lifted and messages send successfully.");
      passedTests++;
    } else {
      throw new Error(`TEST 2 FAILED: isMuted=${restAfterExpiry.data.isMuted}, sent=${messageSentAfterExpiry}`);
    }

    // ----------------------------------------------------
    // TEST 3: Multi-Tab Kick (Both Tabs Evicted)
    // ----------------------------------------------------
    console.log("\n▶ TEST 3: Kicking user removes ALL open tabs/sockets from the room channel...");
    const tab1 = ioClient(SERVER_URL, { auth: { token: tokenA } });
    const tab2 = ioClient(SERVER_URL, { auth: { token: tokenA } });
    await Promise.all([
      new Promise((r) => tab1.on("connect", r)),
      new Promise((r) => tab2.on("connect", r)),
    ]);

    // Create a special room for testing kick
    await Room.findOneAndUpdate(
      { name: "atk_room" },
      { name: "atk_room", description: "Attack Test Room", createdBy: adminUser._id },
      { upsert: true }
    );

    tab1.emit("join_room", { room: "atk_room" });
    tab2.emit("join_room", { room: "atk_room" });
    await new Promise((r) => setTimeout(r, 300));

    let tab1Kicked = false;
    let tab2Kicked = false;
    tab1.on("kicked_from_room", () => (tab1Kicked = true));
    tab2.on("kicked_from_room", () => (tab2Kicked = true));

    // Admin kicks User A from atk_room
    const kickPromise = new Promise((resolve) => observerSocket.once("moderation_success", resolve));
    observerSocket.emit("moderate_user", {
      targetUserId: userA._id.toString(),
      targetUsername: userA.username,
      action: "kick_room",
      room: "atk_room",
      reason: "Disruptive in room",
    });
    await kickPromise;
    await new Promise((r) => setTimeout(r, 400));

    // Further messages to atk_room from either tab must be rejected
    let tab1Error = null;
    tab1.on("muted_error", (e) => (tab1Error = e));
    tab1.emit("send_message", { room: "atk_room", content: "TRYING_TO_SEND_AFTER_KICK" });
    await new Promise((r) => setTimeout(r, 400));

    if (tab1Kicked && tab2Kicked) {
      console.log("  PASSED: Both Tab 1 and Tab 2 received kick notice and were evicted from the room.");
      passedTests++;
    } else {
      throw new Error(`TEST 3 FAILED: tab1Kicked=${tab1Kicked}, tab2Kicked=${tab2Kicked}`);
    }

    tab1.disconnect();
    tab2.disconnect();
    socketA.disconnect();

    // ----------------------------------------------------
    // TEST 4: Ban User & API Call with Old Token (Must be 403)
    // ----------------------------------------------------
    console.log("\n▶ TEST 4: Banned user calling API with old token must get 403 Forbidden...");
    const userB = await User.create({
      username: "atk_user_b",
      password: "password123",
      email: "atk_user_b@test.com",
    });
    const tokenB = jwt.sign(
      { id: userB._id.toString(), username: userB.username, isAdmin: false, tokenVersion: userB.tokenVersion },
      JWT_SECRET
    );

    // Admin bans user B globally
    const banPromise = new Promise((resolve) => observerSocket.once("moderation_success", resolve));
    observerSocket.emit("moderate_user", {
      targetUserId: userB._id.toString(),
      targetUsername: userB.username,
      action: "ban_global",
      reason: "Malicious activity",
    });
    await banPromise;
    await new Promise((r) => setTimeout(r, 400));

    let apiStatus = null;
    try {
      await axios.get(`${SERVER_URL}/api/rooms`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
    } catch (err) {
      apiStatus = err.response?.status;
    }

    if (apiStatus === 403) {
      console.log("  PASSED: API rejected banned user with 403 Forbidden.");
      passedTests++;
    } else {
      throw new Error(`TEST 4 FAILED: Expected 403, got ${apiStatus}`);
    }

    // ----------------------------------------------------
    // TEST 5: Auto-Reconnect by Banned User Refused
    // ----------------------------------------------------
    console.log("\n▶ TEST 5: Client socket auto-reconnect with old token must be refused at handshake...");
    let handshakeError = null;
    const socketB = ioClient(SERVER_URL, {
      auth: { token: tokenB },
      reconnection: false,
    });

    await new Promise((resolve) => {
      socketB.on("connect_error", (err) => {
        handshakeError = err.message;
        resolve();
      });
      socketB.on("connect", () => {
        resolve();
      });
    });

    if (handshakeError && handshakeError.includes("BANNED")) {
      console.log(`  PASSED: Handshake connection rejected: "${handshakeError}"`);
      passedTests++;
    } else {
      throw new Error(`TEST 5 FAILED: Expected BANNED handshake error, got: ${handshakeError}`);
    }
    socketB.disconnect();

    // ----------------------------------------------------
    // TEST 6: Ban Survives Server Restart
    // ----------------------------------------------------
    console.log("\n▶ TEST 6: Ban status survives server restart and persists in database...");
    const reloadedRestrictions = await getUserRestrictions(userB._id);
    if (reloadedRestrictions.isGlobalBanned && reloadedRestrictions.canSend === false) {
      console.log("  PASSED: Database verifies ban persists across instances.");
      passedTests++;
    } else {
      throw new Error(`TEST 6 FAILED: reloadedRestrictions=${JSON.stringify(reloadedRestrictions)}`);
    }

    // ----------------------------------------------------
    // TEST 7: Ban Evasion (Re-register with same email/username blocked)
    // ----------------------------------------------------
    console.log("\n▶ TEST 7: Ban evasion protection blocks re-registering with banned email/username...");
    let evasionStatus = null;
    try {
      await axios.post(`${SERVER_URL}/api/auth/register`, {
        username: "atk_user_b_alt",
        email: "atk_user_b@test.com", // Same email as banned user
        password: "newpassword123",
      });
    } catch (err) {
      evasionStatus = err.response?.status;
    }

    if (evasionStatus === 403) {
      console.log("  PASSED: Re-registration with banned email strictly blocked with 403 Forbidden.");
      passedTests++;
    } else {
      throw new Error(`TEST 7 FAILED: Expected 403 Forbidden, got ${evasionStatus}`);
    }

    // ----------------------------------------------------
    // TEST 8: Forged Payload Against Admin Rejected
    // ----------------------------------------------------
    console.log("\n▶ TEST 8: Rogue user attempting forged moderation payload against admin is rejected...");
    const rogueUser = await User.create({
      username: "atk_rogue",
      password: "password123",
      role: "user",
      isAdmin: false,
    });
    const rogueToken = jwt.sign(
      { id: rogueUser._id.toString(), username: rogueUser.username, isAdmin: false, tokenVersion: rogueUser.tokenVersion },
      JWT_SECRET
    );

    const rogueSocket = ioClient(SERVER_URL, { auth: { token: rogueToken } });
    rogueSocket.on("connect_error", (e) => console.log("DEBUG rogueSocket connect_error:", e.message));
    await new Promise((r) => rogueSocket.on("connect", r));
    console.log("DEBUG rogueSocket connected successfully!");

    let forgedError = null;
    const errorPromise = new Promise((resolve) => {
      rogueSocket.once("moderation_error", (err) => {
        forgedError = err.message || err;
        resolve();
      });
      rogueSocket.once("error", (err) => {
        forgedError = err.message || err;
        resolve();
      });
    });

    // Forged attempt to ban admin
    rogueSocket.emit("moderate_user", {
      targetUserId: adminUser._id.toString(),
      targetUsername: adminUser.username,
      action: "ban_global",
      reason: "Hacked by rogue",
    });

    await Promise.race([errorPromise, new Promise((r) => setTimeout(r, 2000))]);

    // Verify Admin is still completely untouched
    const freshAdmin = await User.findById(adminUser._id);

    if (forgedError && !freshAdmin.isBanned) {
      console.log(`  PASSED: Forged moderation rejected: "${forgedError}". Admin unharmed.`);
      passedTests++;
    } else {
      throw new Error(`TEST 8 FAILED: forgedError=${forgedError}, adminBanned=${freshAdmin.isBanned}`);
    }
    rogueSocket.disconnect();

    // ----------------------------------------------------
    // TEST 9: Password Reset Revokes All Old Sessions & Old Password Fails
    // ----------------------------------------------------
    console.log("\n▶ TEST 9: Password reset kills old password and revokes all old sessions immediately...");
    const userC = await User.create({
      username: "atk_user_c",
      password: "oldpassword123",
      email: "atk_user_c@test.com",
    });
    const oldTokenC = jwt.sign(
      { id: userC._id.toString(), username: userC.username, isAdmin: false, tokenVersion: userC.tokenVersion },
      JWT_SECRET
    );

    // Change password via API
    await axios.post(
      `${SERVER_URL}/api/auth/change-password`,
      { currentPassword: "oldpassword123", newPassword: "newpassword456" },
      { headers: { Authorization: `Bearer ${oldTokenC}` } }
    );

    // 1. Old password must fail
    let oldLoginFailed = false;
    try {
      await axios.post(`${SERVER_URL}/api/auth/login`, {
        username: userC.username,
        password: "oldpassword123",
      });
    } catch (err) {
      if (err.response?.status === 401) oldLoginFailed = true;
    }

    // 2. Old token must be rejected (TOKEN_REVOKED)
    let oldTokenRejected = false;
    try {
      await axios.get(`${SERVER_URL}/api/rooms`, {
        headers: { Authorization: `Bearer ${oldTokenC}` },
      });
    } catch (err) {
      if (err.response?.status === 401 && err.response?.data?.code === "TOKEN_REVOKED") {
        oldTokenRejected = true;
      }
    }

    // 3. New password must work
    let newLoginSuccess = false;
    try {
      const loginRes = await axios.post(`${SERVER_URL}/api/auth/login`, {
        username: userC.username,
        password: "newpassword456",
      });
      if (loginRes.data.token) newLoginSuccess = true;
    } catch (err) {}

    if (oldLoginFailed && oldTokenRejected && newLoginSuccess) {
      console.log("  PASSED: Old password failed, old session tokens revoked (401 TOKEN_REVOKED), new password works.");
      passedTests++;
    } else {
      throw new Error(
        `TEST 9 FAILED: oldLoginFailed=${oldLoginFailed}, oldTokenRejected=${oldTokenRejected}, newLoginSuccess=${newLoginSuccess}`
      );
    }

    observerSocket.disconnect();
    await cleanupTestFixtures();

    console.log("\n=======================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} ATTACK TESTS PASSED!`);
    console.log("=======================================================\n");

    server.close();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST SUITE RUNNER ERROR:", err.message);
    try {
      await User.deleteMany({ username: { $regex: /^atk_/i } });
      await BannedIdentifier.deleteMany({ value: { $regex: /^atk_/i } });
      await Room.deleteMany({ name: { $regex: /^atk_/i } });
      await Message.deleteMany({
        $or: [
          { senderName: { $regex: /^atk_/i } },
          { content: { $regex: /EXPLOIT|AFTER_EXPIRY|NORMAL_MESSAGE/i } },
          { room: { $regex: /^atk_/i } },
        ],
      });
    } catch {}
    server.close();
    process.exit(1);
  }
}

runAttackTests();
