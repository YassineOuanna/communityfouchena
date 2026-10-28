import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import MessageInput from "./MessageInput";
import api from "../utils/api";

export default function ChatWindow({ activeRoom, activeDM, onBack, onToggleSidebar, sidebarOpen }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [typers, setTypers] = useState([]);
  const bottomRef = useRef(null);

  const currentRoom = activeDM
    ? `dm_${[user.id, activeDM.userId].sort().join("_")}`
    : activeRoom?.name || "global";

  // Helper: Strictly check if this tab is active, focused and visible to the user
  const isTabActiveAndVisible = useCallback(() => {
    if (typeof document === "undefined") return false;
    // 1. Must be visible (not minimized, not a background/inactive tab)
    if (document.visibilityState !== "visible") return false;
    // 2. Must have active window focus
    if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
    return true;
  }, []);

  // Load history
  useEffect(() => {
    setMessages([]);
    setTypers([]);

    const fetchHistory = async () => {
      try {
        let res;
        if (activeDM) {
          res = await api.get(`/rooms/dm/${activeDM.userId}`);
        } else {
          res = await api.get(`/rooms/${currentRoom}/messages`);
        }
        setMessages(res.data);
        // Only mark seen if the user is actively viewing this tab right now!
        if (socket && isTabActiveAndVisible()) {
          socket.emit("mark_seen", { room: currentRoom });
        }
      } catch {}
    };
    fetchHistory();
  }, [currentRoom, socket, activeDM, isTabActiveAndVisible]);

  // When user switches back to this tab or focuses the window, mark messages as seen!
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

  // Join room via socket & listen for events
  useEffect(() => {
    if (!socket) return;
    socket.emit("join_room", { room: currentRoom });

    const onNewMsg = (msg) => {
      setMessages((prev) => {
        if (prev.find((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      // ONLY mark as seen if tab is actively focused and visible!
      if (msg.senderName !== user.username && isTabActiveAndVisible()) {
        socket.emit("mark_seen", { room: currentRoom });
      }
    };

    const onNewDM = (msg) => {
      if (msg.room === currentRoom) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        // ONLY mark as seen if tab is actively focused and visible!
        if (msg.senderName !== user.username && isTabActiveAndVisible()) {
          socket.emit("mark_seen", { room: currentRoom });
        }
      }
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
      if (username === user.username) return;
      setTypers((prev) =>
        isTyping ? [...new Set([...prev, username])] : prev.filter((t) => t !== username)
      );
    };

    socket.on("new_message", onNewMsg);
    socket.on("new_dm", onNewDM);
    socket.on("messages_seen", onMessagesSeen);
    socket.on("user_typing", onTyping);

    return () => {
      socket.off("new_message", onNewMsg);
      socket.off("new_dm", onNewDM);
      socket.off("messages_seen", onMessagesSeen);
      socket.off("user_typing", onTyping);
    };
  }, [socket, currentRoom, user.username, isTabActiveAndVisible]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typers]);

  const handleSend = useCallback((content) => {
    if (!socket) return;
    if (activeDM) {
      socket.emit("send_dm", { toUserId: activeDM.userId, toUsername: activeDM.username, content });
    } else {
      socket.emit("send_message", { room: currentRoom, content });
    }
  }, [socket, activeDM, currentRoom]);

  const handleTyping = useCallback((isTyping) => {
    socket?.emit("typing", { room: currentRoom, isTyping });
  }, [socket, currentRoom]);

  const title = activeDM ? `@${activeDM.username}` : (activeRoom?.name === "global" ? "global" : activeRoom?.name || "global");
  const subtitle = activeDM ? "Direct Conversation" : (activeRoom?.description || "Public Channel");

  return (
    <div className="flex flex-col h-full bg-slate-900/20 backdrop-blur-md select-text overflow-hidden">
      {/* Frosted Glass Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl z-10">
        {(onBack || onToggleSidebar) && (
          <button
            type="button"
            onClick={onBack || onToggleSidebar}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.06] text-slate-300 hover:text-white transition-colors mr-0.5 border border-white/10"
            title="Channels & Members"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}

        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 border border-white/20 flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0">
          {activeDM ? (
            activeDM.username?.[0]?.toUpperCase()
          ) : (
            <span className="text-white text-sm font-semibold">#</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-white text-sm tracking-tight truncate leading-tight drop-shadow-sm">
              {title}
            </h2>
            {activeDM && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] flex-shrink-0" title="Online" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Message Stream */}
      <motion.div
        key={`messages-${currentRoom}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 select-none">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-indigo-400 mb-3 shadow-glass">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.774-.974 4.545 4.545 0 00.41-1.385C3.398 16.924 3 14.568 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">No messages here yet</p>
            <p className="text-xs text-slate-400 mt-1">Start chatting by typing below!</p>
          </div>
        )}

        {messages.map((msg, index) => {
          // STRICT RULE: ONLY the literal LAST message in the conversation displays seen receipts!
          const isLastMessage = index === messages.length - 1;
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
              isOwn={msg.senderName === user.username}
              seenBy={activeSeenBy}
            />
          );
        })}

        <TypingIndicator typers={typers} />
        <div ref={bottomRef} />
      </motion.div>

      {/* Pinned Input Dock */}
      <div className="flex-shrink-0">
        <MessageInput onSend={handleSend} onTyping={handleTyping} />
      </div>
    </div>
  );
}
