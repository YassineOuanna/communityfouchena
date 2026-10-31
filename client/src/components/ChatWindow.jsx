import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import MessageInput from "./MessageInput";
import MemberListDrawer from "./MemberListDrawer";
import CallScreenModal from "./CallScreenModal";
import api from "../utils/api";
import {
  HashIcon,
  SearchIcon,
  PhoneCallIcon,
  VideoIcon,
  UsersIcon,
  SparklesIcon,
  XIcon,
  VolumeXIcon,
} from "./Icons";

export default function ChatWindow({
  activeRoom,
  activeDM,
  onBack,
  onToggleSidebar,
  onUserContextMenu,
  onRoomBlocked,
  onSelectDM,
}) {
  const { socket } = useSocket();
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [typers, setTypers] = useState([]);
  const [notice, setNotice] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showMemberList, setShowMemberList] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [searchInChat, setSearchInChat] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Central Restrictions state for this user in this room
  const [restrictions, setRestrictions] = useState({
    isMuted: false,
    effectiveMuteReason: "",
    effectiveMutedUntil: null,
    effectiveMuteRemainingSeconds: 0,
    isRoomBanned: false,
    isKicked: false,
  });
  const [muteCountdown, setMuteCountdown] = useState(0);

  const bottomRef = useRef(null);
  const onRoomBlockedRef = useRef(onRoomBlocked);
  onRoomBlockedRef.current = onRoomBlocked;

  const currentUserId = user?.id || user?._id || "";
  const currentUsername = user?.username || "";
  const targetDMId = activeDM ? (activeDM.userId || activeDM.id || activeDM._id || "") : "";

  const currentRoom = activeDM
    ? `dm_${[currentUserId, targetDMId].sort().join("_")}`
    : activeRoom?.name || "global";

  // Check if active tab is visible and focused
  const isTabActiveAndVisible = useCallback(() => {
    if (typeof document === "undefined") return false;
    if (document.visibilityState !== "visible") return false;
    if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
    return true;
  }, []);

  const targetKey = activeDM ? `dm_${targetDMId}` : (activeRoom?.name || "global");

  // Fetch Message History & Active Restrictions (Restored reliably without random wipes)
  useEffect(() => {
    let isCancelled = false;
    setMessages([]);
    setTypers([]);
    setReplyingTo(null);
    setEditingMessage(null);
    setIsLoadingMessages(true);

    const loadData = async () => {
      // 1. Fetch message history first so messages display immediately
      try {
        let res;
        if (activeDM) {
          res = await api.get(`/rooms/dm/${targetDMId}`);
        } else {
          res = await api.get(`/rooms/${currentRoom}/messages`);
        }
        if (!isCancelled) {
          setMessages(res.data || []);
          setIsLoadingMessages(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to load messages:", err);
          setIsLoadingMessages(false);
          if (err.response?.status === 403) {
            const errMsg = err.response.data?.message || "You are not permitted to access this room.";
            alert(errMsg);
            onRoomBlockedRef.current && onRoomBlockedRef.current(currentRoom);
          }
        }
      }

      // 2. Fetch active restrictions in background (non-blocking)
      try {
        const restRes = await api.get(`/auth/restrictions?room=${currentRoom}`);
        if (!isCancelled && restRes.data) {
          setRestrictions(restRes.data);
          const secs = restRes.data.effectiveMuteRemainingSeconds;
          setMuteCountdown(secs > 0 ? secs : 0);

          if (!restRes.data.canAccessRoom) {
            alert(restRes.data.accessBlockReason || "Access restricted");
            onRoomBlockedRef.current && onRoomBlockedRef.current(currentRoom);
          }
        }
      } catch (err) {
        // Socket listener will also supply restriction state
      }

      if (socket && isTabActiveAndVisible()) {
        socket.emit("mark_seen", { room: currentRoom });
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [targetKey]);

  // Live Mute Countdown Timer
  useEffect(() => {
    if (muteCountdown <= 0) return;
    const interval = setInterval(() => {
      setMuteCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Refetch fresh restriction state from server
          api.get(`/auth/restrictions?room=${currentRoom}`).then((res) => {
            if (res.data) {
              setRestrictions(res.data);
              setMuteCountdown(res.data.effectiveMuteRemainingSeconds > 0 ? res.data.effectiveMuteRemainingSeconds : 0);
            }
          }).catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [muteCountdown, currentRoom]);

  // Window Focus & Seen Tracking
  useEffect(() => {
    if (!socket) return;
    const handleActive = () => {
      if (document.visibilityState === "visible") {
        socket.emit("mark_seen", { room: currentRoom });
      }
    };

    window.addEventListener("focus", handleActive);
    document.addEventListener("visibilitychange", handleActive);
    window.addEventListener("pointerdown", handleActive);

    return () => {
      window.removeEventListener("focus", handleActive);
      document.removeEventListener("visibilitychange", handleActive);
      window.removeEventListener("pointerdown", handleActive);
    };
  }, [socket, currentRoom]);

  // Socket Event Listeners
  useEffect(() => {
    if (!socket) return;
    socket.emit("join_room", { room: currentRoom });

    const onRestrictionsState = (newRest) => {
      setRestrictions(newRest);
      if (newRest.effectiveMuteRemainingSeconds > 0) {
        setMuteCountdown(newRest.effectiveMuteRemainingSeconds);
      } else if (!newRest.isMuted) {
        setMuteCountdown(0);
      }
    };

    const onUserMuted = (data) => {
      if (data.room === currentRoom || !data.room) {
        setRestrictions((prev) => ({
          ...prev,
          isMuted: true,
          effectiveMuteReason: data.reason,
          effectiveMutedUntil: data.until,
        }));
        const secs = data.durationMinutes ? data.durationMinutes * 60 : -1;
        setMuteCountdown(secs);
        setNotice(`⚠️ ${data.message}`);
      }
    };

    const onUserUnmuted = (data) => {
      if (data.room === currentRoom || !data.room) {
        setRestrictions((prev) => ({
          ...prev,
          isMuted: false,
          effectiveMuteReason: "",
          effectiveMutedUntil: null,
          effectiveMuteRemainingSeconds: 0,
        }));
        setMuteCountdown(0);
        setNotice("✅ You have been unmuted. You can chat now!");
      }
    };

    const onMutedError = (data) => {
      setNotice(data.message || `You are muted: ${data.reason}`);
      setRestrictions((prev) => ({
        ...prev,
        isMuted: true,
        effectiveMuteReason: data.reason,
        effectiveMutedUntil: data.until,
      }));
      if (data.remainingSeconds > 0) {
        setMuteCountdown(data.remainingSeconds);
      }
    };

    const onNewMsg = (msg) => {
      if (msg.room !== currentRoom) return; // Only append messages meant for the active room
      setMessages((prev) => {
        if (prev.find((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      if (msg.senderName !== currentUsername && isTabActiveAndVisible()) {
        socket.emit("mark_seen", { room: currentRoom });
      }
    };

    const onNewDM = (msg) => {
      if (msg.room === currentRoom) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        if (msg.senderName !== currentUsername && isTabActiveAndVisible()) {
          socket.emit("mark_seen", { room: currentRoom });
        }
      }
    };

    const onMsgEdited = (editedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === editedMsg._id ? editedMsg : m))
      );
    };

    const onMsgDeleted = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isDeleted: true, content: "This message was deleted.", attachment: null }
            : m
        )
      );
    };

    const onMsgReacted = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    };

    const onMessagesSeen = ({ room, userId: seenUserId, username: seenUsername }) => {
      if (room !== currentRoom) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderName !== seenUsername) {
            const already = m.seenBy?.some(
              (s) => s.userId === seenUserId || s.username === seenUsername
            );
            if (!already) {
              return {
                ...m,
                seen: true,
                seenBy: [...(m.seenBy || []), { userId: seenUserId, username: seenUsername }],
              };
            }
          }
          return m;
        })
      );
    };

    const onTyping = ({ username, isTyping }) => {
      if (username === currentUsername) return;
      setTypers((prev) =>
        isTyping ? [...new Set([...prev, username])] : prev.filter((t) => t !== username)
      );
    };

    const onIncomingCall = (callData) => {
      setActiveCall({
        type: callData.type || "voice",
        target: { username: callData.fromUsername, userId: callData.fromUserId },
      });
    };

    // REQUIREMENT C: Kicked from room
    const onKicked = ({ room, message }) => {
      if (room === currentRoom || !room) {
        alert(message || "You have been removed from this channel.");
        onRoomBlocked && onRoomBlocked(room);
      }
    };

    // REQUIREMENT D: Banned globally
    const onBanned = ({ message, reason }) => {
      alert(`Blacklisted: ${reason || message || "Your account has been blacklisted."}`);
      logout();
      window.location.href = "/auth";
    };

    const onNotice = ({ message }) => {
      setNotice(message);
      setTimeout(() => setNotice(""), 6000);
    };

    socket.on("restrictions_state", onRestrictionsState);
    socket.on("user_muted", onUserMuted);
    socket.on("user_unmuted", onUserUnmuted);
    socket.on("muted_error", onMutedError);
    socket.on("new_message", onNewMsg);
    socket.on("new_dm", onNewDM);
    socket.on("message_edited", onMsgEdited);
    socket.on("message_deleted", onMsgDeleted);
    socket.on("message_reacted", onMsgReacted);
    socket.on("messages_seen", onMessagesSeen);
    socket.on("user_typing", onTyping);
    socket.on("incoming_call", onIncomingCall);
    socket.on("kicked_from_room", onKicked);
    socket.on("banned", onBanned);
    socket.on("moderation_notice", onNotice);
    socket.on("moderation_alert", onNotice);
    socket.on("error", onNotice);

    return () => {
      socket.off("restrictions_state", onRestrictionsState);
      socket.off("user_muted", onUserMuted);
      socket.off("user_unmuted", onUserUnmuted);
      socket.off("muted_error", onMutedError);
      socket.off("new_message", onNewMsg);
      socket.off("new_dm", onNewDM);
      socket.off("message_edited", onMsgEdited);
      socket.off("message_deleted", onMsgDeleted);
      socket.off("message_reacted", onMsgReacted);
      socket.off("messages_seen", onMessagesSeen);
      socket.off("user_typing", onTyping);
      socket.off("incoming_call", onIncomingCall);
      socket.off("kicked_from_room", onKicked);
      socket.off("banned", onBanned);
      socket.off("moderation_notice", onNotice);
      socket.off("moderation_alert", onNotice);
      socket.off("error", onNotice);
    };
  }, [socket, currentRoom, currentUsername, isTabActiveAndVisible, onRoomBlocked, logout]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typers]);

  // Send Message
  const handleSend = useCallback(
    ({ content, attachment }) => {
      if (!socket) return;
      if (restrictions.isMuted) {
        setNotice(`Cannot send: You are muted. (${restrictions.effectiveMuteReason})`);
        return;
      }

      const replyData = replyingTo
        ? {
            messageId: replyingTo._id,
            senderName: replyingTo.senderName,
            content: replyingTo.content,
          }
        : null;

      if (activeDM) {
        socket.emit("send_dm", {
          toUserId: activeDM.userId,
          toUsername: activeDM.username,
          content,
          replyTo: replyData,
          attachment,
        });
      } else {
        socket.emit("send_message", {
          room: currentRoom,
          content,
          replyTo: replyData,
          attachment,
        });
      }
      setReplyingTo(null);
    },
    [socket, activeDM, currentRoom, replyingTo, restrictions]
  );

  const handleTyping = useCallback(
    (isTyping) => {
      if (restrictions.isMuted) return;
      socket?.emit("typing", { room: currentRoom, isTyping });
    },
    [socket, currentRoom, restrictions]
  );

  // Edit Message
  const handleSaveEdit = (messageId, newContent) => {
    if (!socket || !newContent.trim()) return;
    if (restrictions.isMuted) {
      setNotice("Cannot edit messages while muted.");
      return;
    }
    socket.emit("edit_message", { messageId, newContent, room: currentRoom });
    setEditingMessage(null);
  };

  // Delete Message
  const handleDelete = (messageId) => {
    if (!socket || !confirm("Delete this message?")) return;
    socket.emit("delete_message", { messageId, room: currentRoom });
  };

  // React to Message
  const handleReact = (messageId, emoji) => {
    if (!socket) return;
    if (restrictions.isMuted) {
      setNotice("Cannot react while muted.");
      return;
    }
    socket.emit("react_message", { messageId, emoji, room: currentRoom });
  };

  const title = activeDM
    ? `@${activeDM.username}`
    : activeRoom?.name === "global"
    ? "global"
    : activeRoom?.name || "global";
  const subtitle = activeDM
    ? activeDM.customStatus || "Direct Message"
    : activeRoom?.description || "Public Channel";

  const displayMessages = searchInChat
    ? messages.filter((m) =>
        m.content?.toLowerCase().includes(searchInChat.toLowerCase())
      )
    : messages;

  return (
    <div className="flex h-full w-full bg-slate-900/20 backdrop-blur-md select-text overflow-hidden relative">
      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            {(onBack || onToggleSidebar) && (
              <button
                type="button"
                onClick={onBack || onToggleSidebar}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.06] text-slate-300 hover:text-white transition-colors border border-white/10 md:hidden"
                title="Back to Conversations"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}

            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 border border-white/20 flex items-center justify-center text-sm font-bold text-white shadow-sm flex-shrink-0">
              {activeDM ? (
                activeDM.username?.[0]?.toUpperCase()
              ) : (
                <HashIcon className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-[var(--text-main)] text-sm tracking-tight truncate leading-tight">
                  {title}
                </h2>
                {activeDM && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] flex-shrink-0" title="Online" />
                )}
                {restrictions.isMuted && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <VolumeXIcon className="w-3 h-3" />
                    <span>Muted</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Header Action Buttons (Voice Call, Video Call, Search, Members) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Search Toggle */}
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-xl transition-colors ${
                showSearch
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-400/40"
                  : "text-[var(--text-muted)] hover:text-white hover:bg-white/10"
              }`}
              title="Search in this chat"
            >
              <SearchIcon className="w-4 h-4" />
            </button>

            {/* Voice Call Button */}
            <button
              type="button"
              onClick={() => {
                if (restrictions.isMuted) {
                  setNotice("Cannot start calls while muted.");
                  return;
                }
                setActiveCall({
                  type: "voice",
                  target: activeDM || { username: activeRoom?.name || "Global Room" },
                });
              }}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Start Voice Call"
            >
              <PhoneCallIcon className="w-4 h-4" />
            </button>

            {/* Video Call Button */}
            <button
              type="button"
              onClick={() => {
                if (restrictions.isMuted) {
                  setNotice("Cannot start video calls while muted.");
                  return;
                }
                setActiveCall({
                  type: "video",
                  target: activeDM || { username: activeRoom?.name || "Global Room" },
                });
              }}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              title="Start Video Call"
            >
              <VideoIcon className="w-4 h-4" />
            </button>

            {/* Member List Toggle (For Channels) */}
            {!activeDM && (
              <button
                type="button"
                onClick={() => setShowMemberList(!showMemberList)}
                className={`p-2 rounded-xl transition-colors ${
                  showMemberList
                    ? "bg-indigo-600 text-white"
                    : "text-[var(--text-muted)] hover:text-white hover:bg-white/10"
                }`}
                title="Toggle Room Members"
              >
                <UsersIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* In-Chat Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 py-2 bg-slate-900/80 border-b border-white/10 flex items-center gap-2 overflow-hidden"
            >
              <input
                type="text"
                value={searchInChat}
                onChange={(e) => setSearchInChat(e.target.value)}
                placeholder="Search messages in this conversation..."
                className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchInChat("");
                  setShowSearch(false);
                }}
                className="text-xs text-[var(--text-muted)] hover:text-white px-2 py-1"
              >
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Moderation / Error Notice Banner */}
        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex justify-between items-center z-10 font-medium"
            >
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                className="text-amber-400 hover:text-white font-bold ml-2"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Stream */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-0.5">
          {/* Skeleton Loaders */}
          {isLoadingMessages && (
            <div className="space-y-4 py-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`flex gap-3 max-w-[70%] animate-pulse ${
                    i % 2 === 0 ? "ml-auto flex-row-reverse" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 rounded-xl bg-white/10 w-28" />
                    <div className="h-10 rounded-2xl bg-white/5 w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Friendly Empty State with Modern Icons */}
          {!isLoadingMessages && displayMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] py-12 select-none">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <SparklesIcon className="w-8 h-8 text-indigo-400 animate-pulse" />
              </div>
              <p className="text-sm font-bold text-[var(--text-main)]">
                No messages yet, say hi!
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Be the first to start the conversation in {title}.
              </p>
            </div>
          )}

          {/* Render Messages */}
          {!isLoadingMessages &&
            displayMessages.map((msg, index) => {
              const isOwn = msg.senderName === currentUsername;

              const prevMsg = index > 0 ? displayMessages[index - 1] : null;
              const isConsecutive =
                prevMsg &&
                prevMsg.senderName === msg.senderName &&
                new Date(msg.createdAt) - new Date(prevMsg.createdAt) < 2 * 60 * 1000;

              const isLastMessage = index === displayMessages.length - 1;
              const activeSeenBy = [];
              if (isLastMessage && Array.isArray(msg.seenBy)) {
                const seenSet = new Set();
                for (const reader of msg.seenBy) {
                  const uName = reader.username || reader.userId;
                  if (uName && uName !== msg.senderName && !seenSet.has(uName)) {
                    seenSet.add(uName);
                    activeSeenBy.push(reader);
                  }
                }
              }

              return (
                <MessageBubble
                  key={msg._id}
                  msg={msg}
                  isOwn={isOwn}
                  isConsecutive={isConsecutive}
                  seenBy={activeSeenBy}
                  onUserContextMenu={onUserContextMenu}
                  onReply={(targetMsg) => setReplyingTo(targetMsg)}
                  onEdit={(targetMsg) => setEditingMessage(targetMsg)}
                  onDelete={handleDelete}
                  onReact={handleReact}
                  currentUsername={currentUsername}
                />
              );
            })}

          <TypingIndicator typers={typers} />
          <div ref={bottomRef} />
        </div>

        {/* Pinned Input Dock (Disabled when Muted) */}
        <div className="flex-shrink-0">
          <MessageInput
            onSend={handleSend}
            onTyping={handleTyping}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            onSaveEdit={handleSaveEdit}
            isMuted={restrictions.isMuted}
            muteInfo={{
              reason: restrictions.effectiveMuteReason,
              remainingSeconds: muteCountdown,
            }}
          />
        </div>
      </div>

      {/* Group Chat Member List Drawer */}
      <AnimatePresence>
        {showMemberList && !activeDM && (
          <MemberListDrawer
            isOpen={showMemberList}
            onClose={() => setShowMemberList(false)}
            activeRoom={activeRoom}
            onSelectDM={onSelectDM}
            onUserContextMenu={onUserContextMenu}
          />
        )}
      </AnimatePresence>

      {/* Voice and Video Call Screen Overlay */}
      <AnimatePresence>
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
