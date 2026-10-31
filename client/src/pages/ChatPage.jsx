import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import NavigationRail from "../components/NavigationRail";
import ConversationList from "../components/ConversationList";
import ChatWindow from "../components/ChatWindow";
import UserContextMenu from "../components/UserContextMenu";
import UserProfileModal from "../components/UserProfileModal";
import RoomModal from "../components/RoomModal";
import AdminModal from "../components/AdminModal";
import ChangePasswordModal from "../components/ChangePasswordModal";
import CallScreenModal from "../components/CallScreenModal";
import api from "../utils/api";
import { deduplicateRooms, DEFAULT_GLOBAL_ROOM } from "../utils/roomUtils";

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { socket, onlineUsers = [] } = useSocket() || {};
  const navigate = useNavigate();

  const [activeRoom, setActiveRoom] = useState(DEFAULT_GLOBAL_ROOM);
  const [activeDM, setActiveDM] = useState(null);
  const [rooms, setRooms] = useState([DEFAULT_GLOBAL_ROOM]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Unread counts & last messages map
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  // Modals state
  const [contextMenu, setContextMenu] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeCall, setActiveCall] = useState(null);

  // Navigation rail view ("all", "channels", "dms")
  const [railView, setRailView] = useState("all");

  // Resizable conversation list width on desktop
  const [listWidth, setListWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cf_list_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 500) return parsed;
      }
      return 320;
    }
    return 320;
  });

  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const widthRef = useRef(listWidth);
  widthRef.current = listWidth;

  // Mobile check
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileScreen, setMobileScreen] = useState("list"); // "list" | "chat"

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch Rooms
  useEffect(() => {
    setIsLoadingRooms(true);
    api
      .get("/rooms")
      .then((res) => {
        setRooms(deduplicateRooms(res.data));
      })
      .catch(() => {})
      .finally(() => setIsLoadingRooms(false));
  }, []);

  // Listen to new messages and newly created rooms
  useEffect(() => {
    if (!socket) return;

    const handleNewRoom = (room) => {
      setRooms((prev) => deduplicateRooms([...prev, room]));
    };

    const handleNewMsg = (msg) => {
      const roomKey = msg.room;
      setLastMessages((prev) => ({ ...prev, [roomKey]: msg }));

      const isCurrent =
        !activeDM && activeRoom && activeRoom.name === roomKey;
      if (!isCurrent) {
        setUnreadCounts((prev) => ({ ...prev, [roomKey]: (prev[roomKey] || 0) + 1 }));
      }
    };

    const handleNewDM = (msg) => {
      const otherUserId = msg.sender === user?.id ? msg.dmTo : msg.sender;
      const dmKey = `dm_${otherUserId}`;
      setLastMessages((prev) => ({ ...prev, [dmKey]: msg }));

      const isCurrent = activeDM && (activeDM.userId === otherUserId || activeDM.id === otherUserId);
      if (!isCurrent && msg.sender !== user?.id) {
        setUnreadCounts((prev) => ({ ...prev, [dmKey]: (prev[dmKey] || 0) + 1 }));
      }
    };

    socket.on("new_message", handleNewMsg);
    socket.on("new_dm", handleNewDM);
    socket.on("new_room", handleNewRoom);

    return () => {
      socket.off("new_message", handleNewMsg);
      socket.off("new_dm", handleNewDM);
      socket.off("new_room", handleNewRoom);
    };
  }, [socket, activeRoom, activeDM, user]);

  // Resizable handle mouse events
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
      const rawWidth = clientX - containerRect.left - 64; // subtract rail width
      const maxAllowed = Math.max(260, Math.min(500, containerRect.width - 400));
      const clamped = Math.max(260, Math.min(rawWidth, maxAllowed));
      widthRef.current = clamped;
      setListWidth(clamped);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem("cf_list_width", widthRef.current.toString());
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

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    setActiveDM(null);
    setUnreadCounts((prev) => ({ ...prev, [room.name]: 0 }));
    if (isMobile) setMobileScreen("chat");
  };

  const handleSelectDM = (targetUser) => {
    setActiveDM(targetUser);
    setActiveRoom(null);
    const dmKey = `dm_${targetUser.userId || targetUser.id}`;
    setUnreadCounts((prev) => ({ ...prev, [dmKey]: 0 }));
    if (isMobile) setMobileScreen("chat");
  };

  const handleRoomCreated = (room) => {
    setRooms((prev) => deduplicateRooms([...prev, room]));
    handleSelectRoom(room);
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

  const handleRoomBlocked = () => {
    handleSelectRoom(DEFAULT_GLOBAL_ROOM);
  };

  const totalUnreads = Object.values(unreadCounts).reduce((acc, count) => acc + (count || 0), 0);

  return (
    <div className="relative h-[100dvh] w-full bg-[var(--bg-base)] overflow-hidden select-none transition-colors duration-300">
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-600/25 to-purple-600/15 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -45, 0], y: [0, 35, 0], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-36 -right-36 w-[550px] h-[550px] rounded-full bg-gradient-to-tl from-cyan-500/20 to-blue-600/15 blur-[140px]"
        />
      </div>

      {/* Main Glassmorphic Layout Container */}
      <div className="relative z-10 h-full w-full p-0 md:p-3 lg:p-4 flex">
        <div
          ref={containerRef}
          className="w-full h-full flex rounded-none md:rounded-3xl overflow-hidden glass-surface border-0 md:border md:border-white/10 shadow-2xl relative"
        >
          {/* COLUMN 1: Slim Navigation Rail (Desktop Only) */}
          {!isMobile && (
            <NavigationRail
              currentView={railView}
              onSelectView={setRailView}
              unreadTotal={totalUnreads}
              onOpenProfile={() => setShowProfileModal(true)}
              onOpenSettings={() => setShowProfileModal(true)}
              onStartCall={() =>
                setActiveCall({
                  type: "voice",
                  target: activeDM || { username: activeRoom?.name || "Global Chat" },
                })
              }
              onLogout={handleLogout}
            />
          )}

          {/* COLUMN 2: Conversation List */}
          <div
            style={!isMobile ? { width: `${listWidth}px`, minWidth: `${listWidth}px`, maxWidth: `${listWidth}px` } : undefined}
            className={`w-full flex-shrink-0 h-full flex flex-col overflow-hidden ${
              isMobile ? (mobileScreen === "list" ? "flex" : "hidden") : "flex"
            }`}
          >
            <ConversationList
              rooms={rooms}
              onlineUsers={onlineUsers}
              activeRoom={activeRoom}
              activeDM={activeDM}
              onSelectRoom={handleSelectRoom}
              onSelectDM={handleSelectDM}
              onCreateRoom={() => setShowRoomModal(true)}
              onUserContextMenu={handleUserContextMenu}
              unreadCounts={unreadCounts}
              lastMessages={lastMessages}
              isLoading={isLoadingRooms}
              filterView={railView}
            />

            {/* Mobile Bottom Navigation Bar (Visible only on mobile in list view) */}
            {isMobile && (
              <div className="px-4 py-3 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl flex items-center justify-around safe-pb flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setRailView("all")}
                  className={`flex flex-col items-center gap-1 text-xs ${
                    railView === "all" ? "text-indigo-400 font-bold" : "text-slate-400"
                  }`}
                >
                  <span className="text-lg">💬</span>
                  <span>Chats</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRailView("channels")}
                  className={`flex flex-col items-center gap-1 text-xs ${
                    railView === "channels" ? "text-indigo-400 font-bold" : "text-slate-400"
                  }`}
                >
                  <span className="text-lg">📢</span>
                  <span>Rooms</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveCall({
                      type: "voice",
                      target: activeDM || { username: activeRoom?.name || "Global Chat" },
                    })
                  }
                  className="flex flex-col items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  <span className="text-lg">📞</span>
                  <span>Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="flex flex-col items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  <span className="text-lg">👤</span>
                  <span>Profile</span>
                </button>
              </div>
            )}
          </div>

          {/* Resizable Divider Handle (Desktop) */}
          {!isMobile && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
              onTouchStart={() => setIsResizing(true)}
              onDoubleClick={() => setListWidth(320)}
              title="Drag to resize • Double click to reset"
              className={`w-2 -ml-1 -mr-1 relative z-20 cursor-col-resize flex-shrink-0 flex items-center justify-center select-none group transition-colors ${
                isResizing ? "bg-indigo-500/20" : "hover:bg-indigo-500/20"
              }`}
            >
              <div
                className={`w-[2px] h-full transition-colors ${
                  isResizing ? "bg-indigo-400 shadow-glow" : "bg-white/10 group-hover:bg-indigo-400/80"
                }`}
              />
            </div>
          )}

          {/* COLUMN 3: Main Chat Window */}
          <div
            className={`flex-1 h-full flex flex-col min-w-0 ${
              isMobile ? (mobileScreen === "chat" ? "flex" : "hidden") : "flex"
            }`}
          >
            <ChatWindow
              activeRoom={activeRoom}
              activeDM={activeDM}
              onBack={isMobile ? () => setMobileScreen("list") : null}
              onToggleSidebar={isMobile ? () => setMobileScreen("list") : null}
              onUserContextMenu={handleUserContextMenu}
              onRoomBlocked={handleRoomBlocked}
              onSelectDM={handleSelectDM}
            />
          </div>
        </div>
      </div>

      {/* Full Transparent Overlay during Resizing */}
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize select-none" />}

      {/* Modals & Dialogs */}
      <AnimatePresence>
        {contextMenu && (
          <UserContextMenu
            target={contextMenu}
            onClose={() => setContextMenu(null)}
            onStartDM={handleSelectDM}
          />
        )}

        {showProfileModal && (
          <UserProfileModal
            onClose={() => setShowProfileModal(false)}
            onChangePassword={() => setShowPasswordModal(true)}
          />
        )}

        {showRoomModal && (
          <RoomModal
            onClose={() => setShowRoomModal(false)}
            onRoomCreated={handleRoomCreated}
          />
        )}

        {showAdminModal && (
          <AdminModal onClose={() => setShowAdminModal(false)} />
        )}

        {showPasswordModal && (
          <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
        )}

        {activeCall && (
          <CallScreenModal
            target={activeCall.target}
            type={activeCall.type}
            onClose={() => setActiveCall(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
