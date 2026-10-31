import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckIcon,
  CheckCheckIcon,
  PlayIcon,
  PauseIcon,
  ReplyIcon,
  EditIcon,
  TrashIcon,
  FileTextIcon,
  XIcon,
  MoreVerticalIcon,
} from "./Icons";

function getAvatarGradient(name = "") {
  const gradients = [
    "from-indigo-500 to-purple-600",
    "from-cyan-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-fuchsia-500 to-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function MessageBubble({
  msg,
  isOwn,
  isConsecutive = false,
  seenBy = [],
  onUserContextMenu,
  onReply,
  onEdit,
  onDelete,
  onReact,
  currentUsername,
}) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const audioRef = useRef(null);
  const touchTimerRef = useRef(null);
  const touchMovedRef = useRef(false);

  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const openContextMenu = (e, clientX, clientY) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const x = clientX ?? e?.clientX ?? (typeof window !== "undefined" ? window.innerWidth / 2 : 150);
    const y = clientY ?? e?.clientY ?? (typeof window !== "undefined" ? window.innerHeight / 2 : 200);
    if (onUserContextMenu) {
      onUserContextMenu(
        { clientX: x, clientY: y, preventDefault: () => {}, stopPropagation: () => {} },
        { userId: msg.sender, username: msg.senderName },
        null,
        {
          message: msg,
          onReply,
          onEdit,
          onDelete,
          onReact,
        }
      );
    }
  };

  const handleTouchStart = (e) => {
    touchMovedRef.current = false;
    const touch = e.touches?.[0];
    const x = touch?.clientX;
    const y = touch?.clientY;
    touchTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        if (navigator.vibrate) navigator.vibrate(30);
        openContextMenu(e, x, y);
      }
    }, 380);
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className={`relative group/msg flex flex-col px-1 ${
        isConsecutive ? "mt-1" : "mt-3.5"
      } ${isOwn ? "items-end" : "items-start"}`}
    >
      {/* Sender Name (only on first message in a consecutive group) */}
      {!isOwn && !isConsecutive && (
        <span
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onUserContextMenu &&
              onUserContextMenu(e, { userId: msg.sender, username: msg.senderName });
          }}
          onClick={(e) => {
            e.stopPropagation();
            onUserContextMenu &&
              onUserContextMenu(e, { userId: msg.sender, username: msg.senderName });
          }}
          className="text-[11px] font-semibold text-[var(--text-muted)] mb-1 ml-11 cursor-pointer hover:text-indigo-400 transition-colors"
          title="Click or right-click for options"
        >
          {msg.senderName}
        </span>
      )}

      {/* Row: Profile Pic & Message Bubble */}
      <div
        className={`relative flex items-end gap-2 max-w-[85%] sm:max-w-[70%] ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Profile Avatar (only shown if not consecutive) */}
        {!isOwn && (
          <div className="w-8 flex-shrink-0 flex items-end">
            {!isConsecutive ? (
              <div
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUserContextMenu &&
                    onUserContextMenu(e, { userId: msg.sender, username: msg.senderName });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onUserContextMenu &&
                    onUserContextMenu(e, { userId: msg.sender, username: msg.senderName });
                }}
                className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                  msg.senderName
                )} flex items-center justify-center text-xs font-bold text-white shadow-sm border border-white/20 cursor-pointer hover:scale-105 transition-transform`}
                title={`${msg.senderName} (Click for options)`}
              >
                {msg.senderName?.[0]?.toUpperCase() || "?"}
              </div>
            ) : (
              <div className="w-8" />
            )}
          </div>
        )}

        {/* Message Bubble Box */}
        <div
          onContextMenu={openContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={`relative px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed break-words shadow-sm transition-all select-text cursor-pointer ${
            isOwn
              ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-xs shadow-bubble"
              : "bg-[var(--neutral-bubble)] text-[var(--text-main)] rounded-bl-xs border border-white/10"
          } ${msg.isDeleted ? "italic opacity-60" : ""}`}
        >
          {/* Quoted Reply Banner if this message replied to someone */}
          {msg.replyTo && (
            <div
              className={`mb-2 px-2.5 py-1.5 rounded-xl border-l-2 text-xs flex flex-col gap-0.5 ${
                isOwn
                  ? "bg-black/20 border-white/60 text-white/90"
                  : "bg-black/10 dark:bg-white/5 border-indigo-400 text-[var(--text-main)]"
              }`}
            >
              <span className="font-bold text-[10px] text-indigo-300">
                Replying to @{msg.replyTo.senderName}
              </span>
              <span className="truncate max-w-[240px] text-[11px] opacity-80">
                {msg.replyTo.content}
              </span>
            </div>
          )}

          {/* Image Attachment Preview */}
          {msg.attachment?.fileType === "image" && (
            <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
              <img
                src={msg.attachment.url}
                alt="Uploaded media"
                onClick={() => setShowImageModal(true)}
                className="max-h-60 max-w-full rounded-xl object-cover hover:brightness-105 transition-all"
                loading="lazy"
              />
            </div>
          )}

          {/* Voice Note Audio Attachment */}
          {msg.attachment?.fileType === "audio" && (
            <div className="mb-2 p-2 rounded-xl bg-black/20 flex items-center gap-3 min-w-[200px]">
              <audio
                ref={audioRef}
                src={msg.attachment.url}
                onEnded={handleAudioEnded}
                className="hidden"
              />
              <button
                type="button"
                onClick={toggleAudio}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center flex-shrink-0 transition-transform active:scale-95"
              >
                {isPlayingAudio ? (
                  <PauseIcon className="w-4 h-4" />
                ) : (
                  <PlayIcon className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Waveform graphic */}
              <div className="flex-1 flex items-center gap-1 h-6">
                {[14, 22, 10, 18, 26, 12, 20, 16, 24, 8, 14, 20, 12].map((height, i) => (
                  <div
                    key={i}
                    style={{ height: `${height}px` }}
                    className={`w-1 rounded-full transition-all ${
                      isPlayingAudio ? "bg-cyan-300 animate-pulse" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>

              <span className="text-[10px] text-white/80 font-mono">
                {msg.attachment.duration ? `${msg.attachment.duration}s` : "Voice"}
              </span>
            </div>
          )}

          {/* Regular File Attachment */}
          {msg.attachment?.fileType === "file" && (
            <a
              href={msg.attachment.url}
              download={msg.attachment.fileName}
              className="mb-2 p-2.5 rounded-xl bg-black/20 hover:bg-black/30 flex items-center gap-2.5 text-xs text-white transition-colors"
            >
              <FileTextIcon className="w-5 h-5 text-indigo-300 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{msg.attachment.fileName}</p>
                <p className="text-[10px] text-white/70">
                  {msg.attachment.fileSize
                    ? `${(msg.attachment.fileSize / 1024).toFixed(1)} KB`
                    : "File attachment"}
                </p>
              </div>
            </a>
          )}

          {/* Message Text Content */}
          <div className="whitespace-pre-wrap">{msg.content}</div>

          {/* Edited indicator */}
          {msg.isEdited && !msg.isDeleted && (
            <span className="text-[10px] opacity-70 ml-1.5">(edited)</span>
          )}
        </div>

        {/* Quick Context / Moderation Action Button (Always tapable on mobile, visible on hover on PC) */}
        {!msg.isDeleted && (
          <button
            type="button"
            onClick={openContextMenu}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center opacity-40 sm:opacity-0 group-hover/msg:opacity-100 transition-opacity flex-shrink-0 self-center active:scale-95 cursor-pointer"
            title="Options & Moderation"
          >
            <MoreVerticalIcon className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Hover Action Menu Bar (Quick Reactions, Reply, Edit, Delete) */}
        {!msg.isDeleted && (
          <div
            className={`opacity-0 group-hover/msg:opacity-100 transition-opacity absolute -top-4 z-20 flex items-center gap-0.5 bg-slate-900/95 border border-white/15 px-1.5 py-0.5 rounded-full shadow-lg backdrop-blur-md ${
              isOwn ? "right-1" : "left-11"
            }`}
          >
            {/* Quick emoji reactions */}
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact && onReact(msg._id, emoji)}
                className="w-6 h-6 flex items-center justify-center text-xs hover:scale-125 transition-transform"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}

            <div className="w-[1px] h-3 bg-white/20 mx-0.5" />

            {/* Reply Button */}
            <button
              type="button"
              onClick={() => onReply && onReply(msg)}
              className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              title="Reply to message"
            >
              <ReplyIcon className="w-3.5 h-3.5" />
            </button>

            {/* Edit Button (if own) */}
            {isOwn && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(msg)}
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                title="Edit message"
              >
                <EditIcon className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete Button */}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(msg._id)}
                className="w-6 h-6 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-colors"
                title="Delete message"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Emoji Reactions Pills */}
      {msg.reactions && msg.reactions.length > 0 && (
        <div
          className={`flex flex-wrap gap-1 mt-1 ${
            isOwn ? "mr-1 justify-end" : "ml-11 justify-start"
          }`}
        >
          {msg.reactions.map((r) => {
            const hasReacted = r.users?.some(
              (u) => u.username === currentUsername
            );
            return (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact && onReact(msg._id, r.emoji)}
                className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-all ${
                  hasReacted
                    ? "bg-indigo-600/30 border-indigo-400/50 text-indigo-300 shadow-sm"
                    : "bg-white/[0.05] border-white/10 text-[var(--text-main)] hover:bg-white/[0.1]"
                }`}
                title={`Reacted by ${r.users?.map((u) => u.username).join(", ")}`}
              >
                <span>{r.emoji}</span>
                <span className="text-[10px] font-bold">{r.users?.length || 1}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Timestamp & Read Receipts Status Row */}
      <div
        className={`flex items-center gap-1.5 mt-0.5 select-none ${
          isOwn ? "justify-end mr-1" : "justify-start ml-11"
        }`}
      >
        <span className="text-[10px] text-[var(--text-muted)] font-normal">{time}</span>

        {/* Read Receipt & Delivery Status for Own Messages */}
        {isOwn && (
          <span className="inline-flex items-center ml-0.5" title={seenBy?.length > 0 ? "Seen" : "Delivered"}>
            {seenBy && seenBy.length > 0 ? (
              <CheckCheckIcon
                className="w-3.5 h-3.5 text-cyan-400"
                title={`Seen by ${seenBy.map((s) => s.username).join(", ")}`}
              />
            ) : (
              <CheckCheckIcon className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-70" />
            )}
          </span>
        )}
      </div>

      {/* Image Modal for Fullscreen View */}
      <AnimatePresence>
        {showImageModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowImageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl"
            >
              <img
                src={msg.attachment?.url}
                alt="Enlarged view"
                className="w-full h-full object-contain rounded-2xl"
              />
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
