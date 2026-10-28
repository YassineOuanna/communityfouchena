import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import UserContextMenu from "../components/UserContextMenu";

export default function ChatPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [activeRoom, setActiveRoom] = useState({ name: "global", description: "General community chat" });
  const [activeDM, setActiveDM] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  
  // Mobile check
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // On mobile: "list" shows sidebar; "chat" shows chat window
  const [mobileView, setMobileView] = useState("list");

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    setActiveDM(null);
    if (isMobile) setMobileView("chat");
  };

  const handleSelectDM = (user) => {
    setActiveDM(user);
    setActiveRoom(null);
    if (isMobile) setMobileView("chat");
  };

  const handleBackToList = () => {
    setMobileView("list");
  };

  const handleUserContextMenu = (e, targetUser, roomName) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      user: targetUser,
      room: roomName || activeRoom?.name || "global",
    });
  };

  const handleRoomBlocked = (blockedRoom) => {
    setActiveRoom({ name: "global", description: "General community chat" });
    setActiveDM(null);
  };

  return (
    <div className="relative h-[100dvh] w-full bg-[#0c0f1d] overflow-hidden select-none">
      {/* Dynamic Ambient Mesh Glow Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [0, 40, 0],
            y: [0, -30, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-600/25 to-purple-600/15 blur-[120px]"
        />

        <motion.div
          animate={{
            x: [0, -45, 0],
            y: [0, 35, 0],
            scale: [1.1, 1, 1.1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-36 -right-36 w-[550px] h-[550px] rounded-full bg-gradient-to-tl from-cyan-500/20 to-blue-600/15 blur-[140px]"
        />

        <motion.div
          animate={{
            scale: [0.95, 1.1, 0.95],
            opacity: [0.12, 0.2, 0.12],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full bg-fuchsia-600/10 blur-[130px]"
        />
      </div>

      {/* Main Glassmorphic Layout */}
      <div className="relative z-10 h-full w-full p-0 md:p-3 lg:p-4 flex">
        <div className="w-full h-full flex rounded-none md:rounded-3xl overflow-hidden glass-surface border-0 md:border md:border-white/10 shadow-2xl">
          {/* Sidebar Pane: on mobile controlled by mobileView; on desktop (md+) ALWAYS visible on the left! */}
          <div
            className={`w-full md:w-80 lg:w-96 flex-shrink-0 h-full border-r border-white/10 ${
              isMobile ? (mobileView === "list" ? "block" : "hidden") : "block"
            }`}
          >
            <Sidebar
              activeRoom={activeRoom}
              activeDM={activeDM}
              onSelectRoom={handleSelectRoom}
              onSelectDM={handleSelectDM}
              onLogout={handleLogout}
              onUserContextMenu={handleUserContextMenu}
            />
          </div>

          {/* Chat Pane: on mobile controlled by mobileView; on desktop (md+) ALWAYS visible on the right! */}
          <div
            className={`flex-1 h-full flex flex-col min-w-0 ${
              isMobile ? (mobileView === "chat" ? "flex" : "hidden") : "flex"
            }`}
          >
            <ChatWindow
              activeRoom={activeRoom}
              activeDM={activeDM}
              onBack={isMobile ? handleBackToList : null}
              onToggleSidebar={isMobile ? handleBackToList : null}
              onUserContextMenu={handleUserContextMenu}
              onRoomBlocked={handleRoomBlocked}
            />
          </div>
        </div>
      </div>

      {/* User Context Menu for Moderation, Mute, Ban, Kick, and Password Reset */}
      <AnimatePresence>
        {contextMenu && (
          <UserContextMenu
            target={contextMenu}
            onClose={() => setContextMenu(null)}
            onStartDM={handleSelectDM}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
