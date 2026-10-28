require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const server = http.createServer(app);

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible websockets and static assets
    crossOriginEmbedderPolicy: false,
  })
);

// Rate Limiter for Authentication to prevent brute-force and spam
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 auth requests per windowMs
  message: { message: "Too many authentication attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 1e6, // 1MB buffer limit to prevent socket overflow
});

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "50kb" })); // Prevents large payload DoS

// Routes with security limits
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/rooms", require("./routes/rooms"));

// Serve Production Frontend
const path = require("path");
const clientDistPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientDistPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) {
      res.json({ status: "CommunityFouchena Secure API running 🚀" });
    }
  });
});

// Global process error handlers for clear Render logs
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

// Socket.IO Handlers with Input Validation
require("./socket/handlers")(io);

// Start server immediately so Render detects the open port and marks the service LIVE
const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Secure Server running on port ${PORT}`);
});

// MongoDB Atlas connection with reliable fallback and auto-retry
let MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI || MONGO_URI.includes("daly232007")) {
  MONGO_URI = "mongodb+srv://chopardsamurai_db_user:ASwyQqrRwqx7t0FT@cluster0.qtcstpn.mongodb.net/communityfouchena?retryWrites=true&w=majority";
}

const JWT_SECRET =
  process.env.JWT_SECRET || "communityfouchena_super_secret_key_2024";
process.env.JWT_SECRET = JWT_SECRET;

const connectDB = async () => {
  try {
    console.log("⏳ Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB Atlas connected successfully!");
  } catch (err) {
    console.error("❌ MongoDB Atlas connection error:", err.message);
    console.log("⏳ Retrying connection to MongoDB in 3 seconds...");
    setTimeout(connectDB, 3000);
  }
};
connectDB();
