require("dotenv").config();
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

// Socket.IO Handlers with Input Validation
require("./socket/handlers")(io);

// MongoDB Atlas connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI || MONGO_URI.includes("<username>")) {
  console.error("❌ ERROR: Please set your MongoDB Atlas URI in server/.env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ MongoDB Atlas connected!");
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, "0.0.0.0", () =>
      console.log(`🚀 Secure Server running at http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB Atlas connection error:", err.message);
    process.exit(1);
  });
