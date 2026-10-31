import React, { useState, useEffect, useRef, useCallback } from "react";
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
import IncomingCallModal from "../components/IncomingCallModal";
import NotificationToastContainer, { playNotificationChime } from "../components/NotificationToast";
import api from "../utils/api";
import { deduplicateRooms, DEFAULT_GLOBAL_ROOM } from "../utils/roomUtils";
import { MessagesSquareIcon, HashIcon, PhoneCallIcon, UserIcon } from "../components/Icons";

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
  const [notifications, setNotifications] = useState([]);

  // Modals state
  const [contextMenu, setContextMenu] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const pendingCandidatesRef = useRef([]);

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

        // Trigger Pro Popup Notification if message was sent by another user
        if (msg.senderName !== user?.username) {
          addNotification({
            type: "channel",
            room: msg.room,
            senderName: msg.senderName,
            content: msg.content,
            attachment: msg.attachment,
            targetRoom: { name: msg.room },
          });
        }
      }
    };

    const handleNewDM = (msg) => {
      const otherUserId = msg.sender === user?.id ? msg.dmTo : msg.sender;
      const otherUsername = msg.fromUsername || msg.senderName;
      const dmKey = `dm_${otherUserId}`;
      setLastMessages((prev) => ({ ...prev, [dmKey]: msg }));

      const isCurrent = activeDM && (activeDM.userId === otherUserId || activeDM.id === otherUserId || activeDM._id === otherUserId);
      if (!isCurrent && msg.sender !== user?.id) {
        setUnreadCounts((prev) => ({ ...prev, [dmKey]: (prev[dmKey] || 0) + 1 }));

        // Trigger Pro Popup Notification for DM
        addNotification({
          type: "dm",
          senderName: otherUsername,
          content: msg.content,
          attachment: msg.attachment,
          targetUser: { userId: otherUserId, id: otherUserId, username: otherUsername },
        });
      }
    };

    const handleIncomingCall = (callData) => {
      // If user is already on a call, mark busy
      if (activeCall) {
        socket.emit("call_response", {
          toUserId: callData.fromUserId,
          action: "busy",
          reason: "User is currently busy on another call",
        });
        return;
      }
      setIncomingCall(callData);
    };

    const handleCallEndedGlobal = ({ fromUserId }) => {
      setIncomingCall((prev) => {
        if (prev && prev.fromUserId === fromUserId) {
          return null;
        }
        return prev;
      });
    };

    const handleEarlyCandidate = ({ candidate }) => {
      if (candidate) {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    socket.on("new_message", handleNewMsg);
    socket.on("new_dm", handleNewDM);
    socket.on("new_room", handleNewRoom);
    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_ended", handleCallEndedGlobal);
    socket.on("ice_candidate", handleEarlyCandidate);

    return () => {
      socket.off("new_message", handleNewMsg);
      socket.off("new_dm", handleNewDM);
      socket.off("new_room", handleNewRoom);
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_ended", handleCallEndedGlobal);
      socket.off("ice_candidate", handleEarlyCandidate);
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

  // Notifications toast actions
  const addNotification = useCallback((notif) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    playNotificationChime();
    setNotifications((prev) => [
      { ...notif, id, createdAt: Date.now() },
      ...prev.slice(0, 3), // Keep max 4 active popups
    ]);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/auth");
  }, [logout, navigate]);

  const handleSelectRoom = useCallback(
    (room) => {
      setActiveRoom(room);
      setActiveDM(null);
      setUnreadCounts((prev) => ({ ...prev, [room.name]: 0 }));
      if (isMobile) setMobileScreen("chat");
    },
    [isMobile]
  );

  const handleSelectDM = useCallback(
    (targetUser) => {
      setActiveDM(targetUser);
      setActiveRoom(null);
      const dmKey = `dm_${targetUser.userId || targetUser.id || targetUser._id}`;
      setUnreadCounts((prev) => ({ ...prev, [dmKey]: 0 }));
      if (isMobile) setMobileScreen("chat");
    },
    [isMobile]
  );

  const openNotification = useCallback(
    (notif) => {
      dismissNotification(notif.id);
      if (notif.type === "channel" && notif.targetRoom) {
        handleSelectRoom(notif.targetRoom);
      } else if (notif.type === "dm" && notif.targetUser) {
        handleSelectDM(notif.targetUser);
      }
    },
    [dismissNotification, handleSelectRoom, handleSelectDM]
  );

  const handleRoomCreated = useCallback(
    (room) => {
      setRooms((prev) => deduplicateRooms([...prev, room]));
      handleSelectRoom(room);
    },
    [handleSelectRoom]
  );

  const handleUserContextMenu = useCallback(
    (e, targetUser, roomName, messageMeta = null) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const clientX = e?.clientX ?? e?.touches?.[0]?.clientX ?? (typeof window !== "undefined" ? window.innerWidth / 2 : 150);
      const clientY = e?.clientY ?? e?.touches?.[0]?.clientY ?? (typeof window !== "undefined" ? window.innerHeight / 2 : 200);
      setContextMenu({
        x: clientX,
        y: clientY,
        user: targetUser,
        room: roomName || activeRoom?.name || "global",
        message: messageMeta?.message || null,
        onReply: messageMeta?.onReply,
        onEdit: messageMeta?.onEdit,
        onDelete: messageMeta?.onDelete,
        onReact: messageMeta?.onReact,
      });
    },
    [activeRoom]
  );

  const handleRoomBlocked = useCallback(() => {
    handleSelectRoom(DEFAULT_GLOBAL_ROOM);
  }, [handleSelectRoom]);

  const handleStartCall = useCallback(
    (target, type = "voice") => {
      pendingCandidatesRef.current = [];
      const callTarget =
        target ||
        activeDM || {
          username: activeRoom?.name || "Global Chat",
          room: activeRoom?.name,
        };
      setActiveCall({
        target: callTarget,
        type,
        isCaller: true,
      });
    },
    [activeDM, activeRoom]
  );

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
              onStartCall={() => handleStartCall(null, "voice")}
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
              onFilterChange={setRailView}
            />

            {/* Mobile Bottom Navigation Bar (Visible only on mobile in list view) */}
            {isMobile && (
              <div className="px-2 py-2.5 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl flex items-center justify-around safe-pb flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setRailView("all")}
                  className={`flex flex-col items-center gap-1 text-[10px] ${
                    railView === "all" ? "text-indigo-400 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <MessagesSquareIcon className="w-5 h-5" />
                  <span>Chats</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRailView("channels")}
                  className={`flex flex-col items-center gap-1 text-[10px] ${
                    railView === "channels" ? "text-indigo-400 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <HashIcon className="w-5 h-5" />
                  <span>Rooms</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRailView("dms")}
                  className={`flex flex-col items-center gap-1 text-[10px] ${
                    railView === "dms" ? "text-indigo-400 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <UsersIcon className="w-5 h-5" />
                  <span>Direct</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCall(null, "voice")}
                  className="flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-white"
                >
                  <PhoneCallIcon className="w-5 h-5" />
                  <span>Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-white relative"
                >
                  <UserIcon className="w-5 h-5" />
                  <span>Profile</span>
                  <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-emerald-400 border border-slate-900" />
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
              onStartCall={handleStartCall}
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
            onOpenAdmin={() => setShowAdminModal(true)}
            onLogout={handleLogout}
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

        {incomingCall && (
          <IncomingCallModal
            call={incomingCall}
            onAccept={() => {
              const earlyCandidates = [...pendingCandidatesRef.current];
              pendingCandidatesRef.current = [];
              setActiveCall({
                target: {
                  userId: incomingCall.fromUserId,
                  username: incomingCall.fromUsername,
                  room: incomingCall.room,
                },
                type: incomingCall.type || "voice",
                isCaller: false,
                incomingOffer: incomingCall.offer,
                initialCandidates: earlyCandidates,
              });
              setIncomingCall(null);
            }}
            onDecline={() => {
              pendingCandidatesRef.current = [];
              socket?.emit("call_response", {
                toUserId: incomingCall.fromUserId,
                action: "declined",
                room: incomingCall.room,
              });
              setIncomingCall(null);
            }}
          />
        )}

        {activeCall && (
          <CallScreenModal
            target={activeCall.target}
            type={activeCall.type}
            isCaller={activeCall.isCaller}
            incomingOffer={activeCall.incomingOffer}
            initialCandidates={activeCall.initialCandidates || []}
            onClose={() => {
              setActiveCall(null);
              pendingCandidatesRef.current = [];
            }}
          />
        )}
      </AnimatePresence>

      {/* Pro Popup Notifications on the Top-Right */}
      <NotificationToastContainer
        notifications={notifications}
        onDismiss={dismissNotification}
        onOpen={openNotification}
      />
    </div>
  );
}
