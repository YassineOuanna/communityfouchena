import React, { useState, useEffect, useRef } from "react";
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

  // Resizable sidebar width (persisted in localStorage)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cf_sidebar_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 240 && parsed <= 650) return parsed;
      }
      return window.innerWidth >= 1280 ? 360 : 320;
    }
    return 320;
  });

  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const widthRef = useRef(sidebarWidth);
  widthRef.current = sidebarWidth;

  useEffect(() => {
    if (!isResizing) return;

    const getClientX = (e) => {
      if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
      return e.clientX;
    };

    const handlePointerMove = (e) => {
      if (!containerRef.current) return;
      const clientX = getClientX(e);
      if (clientX == null) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const rawWidth = clientX - containerRect.left;
      // Clamp between min 240px and max (either 650px or containerWidth - 360px for chat window)
      const maxAllowed = Math.max(300, Math.min(650, containerRect.width - 360));
      const clamped = Math.max(240, Math.min(rawWidth, maxAllowed));
      widthRef.current = clamped;
      setSidebarWidth(clamped);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem("cf_sidebar_width", widthRef.current.toString());
      } catch {}
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove);
    window.addEventListener("touchend", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isResizing]);
  
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
    <div className="relative h-[100dvh] w-full bg-[var(--bg-base)] overflow-hidden select-none transition-colors duration-300">
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
        <div
          ref={containerRef}
          className="w-full h-full flex rounded-none md:rounded-3xl overflow-hidden glass-surface border-0 md:border md:border-white/10 shadow-2xl relative"
        >
          {/* Sidebar Pane: on mobile controlled by mobileView; on desktop (md+) dynamically sized by sidebarWidth! */}
          <div
            style={!isMobile ? { width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px` } : undefined}
            className={`w-full flex-shrink-0 h-full overflow-hidden ${
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

          {/* Resizable Divider Handle (Desktop & Tablet) */}
          {!isMobile && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
              onTouchStart={() => {
                setIsResizing(true);
              }}
              onDoubleClick={() => {
                setSidebarWidth(320);
                try {
                  localStorage.setItem("cf_sidebar_width", "320");
                } catch {}
              }}
              title="Drag with mouse to resize sidebar • Double-click to reset"
              className={`w-2.5 -ml-1.5 -mr-1 relative z-20 cursor-col-resize flex-shrink-0 flex items-center justify-center select-none group transition-colors ${
                isResizing ? "bg-indigo-500/20" : "hover:bg-indigo-500/20"
              }`}
            >
              {/* Vertical Divider Line */}
              <div
                className={`w-[2px] h-full transition-colors ${
                  isResizing
                    ? "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]"
                    : "bg-white/10 group-hover:bg-indigo-400/80"
                }`}
              />
              {/* Drag Handle Grip Pill in center */}
              <div
                className={`absolute w-1 h-8 rounded-full transition-colors ${
                  isResizing
                    ? "bg-indigo-300 shadow-[0_0_6px_rgba(165,180,252,0.9)]"
                    : "bg-white/20 group-hover:bg-indigo-300"
                }`}
              />
            </div>
          )}

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

      {/* Global Transparent Drag Overlay to ensure uninterrupted mouse drag */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}

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
