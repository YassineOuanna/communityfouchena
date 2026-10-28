# CommunityFouchena 💬

> Real-time anonymous chat — no email required. Just a username & password.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Real-time | Socket.IO |
| Backend | Node.js, Express |
| Database | MongoDB |

## Quick Start

### 1. Install MongoDB (if not installed)
Download from: https://www.mongodb.com/try/download/community
Or use MongoDB Atlas (cloud) — update `server/.env` with your URI.

### 2. Start the backend
```
Double-click: start-server.bat
```
Or manually:
```bash
cd server
npm run dev
```
Server runs on: http://localhost:3001

### 3. Start the frontend
```
Double-click: start-client.bat
```
Or manually:
```bash
cd client
npm run dev
```
App runs on: http://localhost:5173

## Features
- ✅ No email required — just username + password
- ✅ Real-time messaging with Socket.IO
- ✅ Typing indicators
- ✅ Online users list
- ✅ Public rooms + Private DMs
- ✅ Emoji picker
- ✅ Smooth Framer Motion animations
- ✅ Dark purple theme

## Project Structure
```
CommunityFouchena/
├── server/          ← Node.js + Express + Socket.IO + MongoDB
│   ├── index.js
│   ├── models/      ← User, Message, Room
│   ├── routes/      ← auth, rooms
│   ├── middleware/  ← JWT auth
│   └── socket/      ← real-time handlers
└── client/          ← React + Vite + Tailwind + Framer Motion
    └── src/
        ├── pages/       ← AuthPage, ChatPage
        ├── components/  ← Sidebar, ChatWindow, MessageBubble...
        ├── context/     ← AuthContext, SocketContext
        └── utils/       ← api.js (Axios)
```

## Environment Variables (server/.env)
```
MONGO_URI=mongodb://localhost:27017/communityfouchena
JWT_SECRET=communityfouchena_super_secret_key_2024
PORT=3001
```
