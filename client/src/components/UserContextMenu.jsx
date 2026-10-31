import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import {
  MessageSquareIcon,
  VolumeXIcon,
  UserMinusIcon,
  BanIcon,
  ShieldAlertIcon,
  UnlockIcon,
  KeyIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckIcon,
  CopyIcon,
  ReplyIcon,
  EditIcon,
  TrashIcon,
  XIcon,
} from "./Icons";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function UserContextMenu({
  target, // { x, y, user: { userId, username, isAdmin }, room, message, onReply, onEdit, onDelete, onReact }
  onClose,
  onStartDM,
}) {
  const { socket } = useSocket();
  const { user: currentUser } = useAuth();
  const [activeSubmenu, setActiveSubmenu] = useState(null); // "mute" | "blacklist" | null
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [copiedText, setCopiedText] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!target || (!target.user && !target.message)) return null;

  const targetUser = target?.user || (target?.message ? { userId: target.message.sender, username: target.message.senderName } : {});
  const targetMessage = target?.message;
  const isSelf = !!(targetUser.username && currentUser?.username && targetUser.username.toLowerCase() === currentUser.username.toLowerCase());
  const canModerate = true; // Always show moderation & mute controls

  // Coordinates calculation for desktop floating mode
  const menuWidth = 240;
  const menuHeight = 360;
  const safeX = typeof target.x === "number" ? target.x : 100;
  const safeY = typeof target.y === "number" ? target.y : 100;
  const winWidth = typeof window !== "undefined" ? window.innerWidth : 800;
  const winHeight = typeof window !== "undefined" ? window.innerHeight : 600;
  const posX = Math.max(12, Math.min(safeX, winWidth - menuWidth - 16));
  const posY = Math.max(12, Math.min(safeY, winHeight - menuHeight - 16));

  const targetId = targetUser.userId || targetUser.id || targetUser._id;
  const targetUsername = targetUser.username || "user";

  const handleCopy = () => {
    if (targetMessage?.content) {
      navigator.clipboard?.writeText(targetMessage.content);
      setCopiedText(true);
      setTimeout(() => {
        setCopiedText(false);
        onClose();
      }, 700);
    }
  };

  const handleMute = (durationMinutes) => {
    socket?.emit("moderate_user", {
      targetUserId: targetId,
      targetUsername: targetUsername,
      action: "mute_room",
      room: target.room,
      durationMinutes,
    });
    onClose();
  };

  const handleUnmute = () => {
    socket?.emit("moderate_user", {
      targetUserId: targetId,
      targetUsername: targetUsername,
      action: "unmute_room",
      room: target.room,
    });
    onClose();
  };

  const handleKick = () => {
    if (
      !window.confirm(
        `Are you sure you want to kick @${targetUsername} from #${target.room}? They will be removed immediately.`
      )
    )
      return;
    socket?.emit("moderate_user", {
      targetUserId: targetId,
      targetUsername: targetUsername,
      action: "kick_room",
      room: target.room,
    });
    onClose();
  };

  const handleBanRoom = () => {
    if (!window.confirm(`Blacklist @${targetUsername} from #${target.room}?`)) return;
    socket?.emit("moderate_user", {
      targetUserId: targetId,
      targetUsername: targetUsername,
      action: "ban_room",
      room: target.room,
    });
    onClose();
  };

  const handleUnbanRoom = () => {
    socket?.emit("moderate_user", {
      targetUserId: targetId,
      targetUsername: targetUsername,
      action: "unban_room",
      room: target.room,
    });
    onClose();
  };

  const handleGlobalBan = () => {
    if (
      !window.confirm(
        `🚨 PERMANENT GLOBAL BLACKLIST: Ban @${targetUsername} from ALL rooms in the community?`
      )
    )
      return;
    socket?.emit("moderate_user", {
      targetUserId: targetId,
      targetUsername: targetUsername,
      action: "ban_global",
    });
    onClose();
  };

  const handleUnbanGlobal = () => {
    socket?.emit("moderate_user", {
      targetUserId: targetId,
      targetUsername: targetUsername,
      action: "unban_global",
    });
    onClose();
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) return;
    try {
      await api.post(`/admin/users/${targetId}/reset-password`, {
        newPassword,
      });
      alert(`Password for @${targetUsername} has been reset successfully!`);
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reset password");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-start pointer-events-auto">
      {/* Semi-transparent Backdrop for outside clicks */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
      />

      {/* Main Menu Container: Bottom Sheet on Mobile, Floating on Desktop */}
      <motion.div
        ref={menuRef}
        initial={isMobile ? { y: 200, opacity: 0 } : { opacity: 0, scale: 0.95, y: -4 }}
        animate={isMobile ? { y: 0, opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobile ? { y: 200, opacity: 0 } : { opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        style={!isMobile ? { left: `${posX}px`, top: `${posY}px` } : {}}
        className={`${
          isMobile
            ? "fixed bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-slate-900 border-t border-white/20 p-4 pb-8 shadow-2xl z-50"
            : "absolute w-[240px] max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900/98 border border-white/15 backdrop-blur-2xl shadow-2xl py-2 z-50 text-xs"
        } select-none text-slate-200 font-medium`}
      >
        {/* Mobile Drag Indicator */}
        {isMobile && (
          <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-3" />
        )}

        {/* Message Options Header (if opened on a message) */}
        {targetMessage && (
          <div className="px-3 pb-2 border-b border-white/10 mb-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">
              Reactions
            </p>
            <div className="flex items-center justify-between gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    target.onReact?.(targetMessage._id, emoji);
                    onClose();
                  }}
                  className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/20 hover:scale-125 flex items-center justify-center text-sm transition-transform active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="mt-2 space-y-1">
              {target.onReply && (
                <button
                  type="button"
                  onClick={() => {
                    target.onReply(targetMessage);
                    onClose();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white transition-colors"
                >
                  <ReplyIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Reply</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white transition-colors"
              >
                {copiedText ? (
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <CopyIcon className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{copiedText ? "Copied!" : "Copy Text"}</span>
              </button>

              {isSelf && target.onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    target.onEdit(targetMessage);
                    onClose();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white transition-colors"
                >
                  <EditIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Edit Message</span>
                </button>
              )}

              {(isSelf || currentUser?.isAdmin) && target.onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    target.onDelete(targetMessage._id);
                    onClose();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 flex items-center gap-2 transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete Message</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* User Card Header */}
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
              {targetUser.username?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white block truncate text-xs">
                  @{targetUser.username}
                </span>
                {isSelf && (
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-1 rounded font-semibold">
                    You
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block leading-none mt-0.5">
                {targetUser.isAdmin ? "👑 Administrator" : "Community Member"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-lg text-slate-400 hover:text-white flex items-center justify-center sm:hidden"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Direct Message */}
        {!isSelf && onStartDM && (
          <button
            type="button"
            onClick={() => {
              onStartDM(targetUser);
              onClose();
            }}
            className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white transition-colors"
          >
            <MessageSquareIcon className="w-4 h-4 text-indigo-400" />
            <span>Send Direct Message</span>
          </button>
        )}

        {/* Moderation Controls (Available for all moderation and administration) */}
        {canModerate && (
          <>
            <div className="my-1 border-t border-white/10" />

            {/* MUTE USER (Vertical In-Place Accordion) */}
            <div>
              <button
                type="button"
                onClick={() => setActiveSubmenu(activeSubmenu === "mute" ? null : "mute")}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-600/25 flex items-center justify-between text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <VolumeXIcon className="w-4 h-4 text-indigo-400" />
                  <span>Mute User</span>
                </span>
                {activeSubmenu === "mute" ? (
                  <ChevronDownIcon className="w-3.5 h-3.5 text-indigo-400" />
                ) : (
                  <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              <AnimatePresence>
                {activeSubmenu === "mute" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pl-3 pr-1 py-1 space-y-1 bg-white/[0.03] rounded-xl border border-white/5 my-1"
                  >
                    <button
                      type="button"
                      onClick={() => handleMute(15)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span>15 Minutes</span>
                      <span className="text-[10px] text-slate-500">15m</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMute(60)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span>1 Hour</span>
                      <span className="text-[10px] text-slate-500">1h</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMute(1440)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between text-xs text-slate-300 hover:text-white"
                    >
                      <span>24 Hours</span>
                      <span className="text-[10px] text-slate-500">1d</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMute(null)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-xs text-rose-300 hover:text-rose-100 flex items-center justify-between font-semibold"
                    >
                      <span>Permanent Mute</span>
                      <span className="text-[10px] text-rose-400 font-bold">Perma</span>
                    </button>
                    <div className="border-t border-white/10 my-0.5" />
                    <button
                      type="button"
                      onClick={handleUnmute}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 text-xs text-emerald-300 hover:text-emerald-100 flex items-center gap-2 font-semibold"
                    >
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Lift Channel Mute</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* BLACKLIST / BAN (Vertical In-Place Accordion) */}
            <div>
              <button
                type="button"
                onClick={() => setActiveSubmenu(activeSubmenu === "blacklist" ? null : "blacklist")}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-600/20 flex items-center justify-between text-rose-300 hover:text-rose-100 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <BanIcon className="w-4 h-4 text-rose-400" />
                  <span>Blacklist / Ban</span>
                </span>
                {activeSubmenu === "blacklist" ? (
                  <ChevronDownIcon className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              <AnimatePresence>
                {activeSubmenu === "blacklist" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden pl-3 pr-1 py-1 space-y-1 bg-rose-500/[0.04] rounded-xl border border-rose-500/10 my-1"
                  >
                    {target.room && !target.room.startsWith("dm_") && (
                      <>
                        <button
                          type="button"
                          onClick={handleBanRoom}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-xs text-rose-300 hover:text-rose-100 flex items-center gap-2"
                        >
                          <BanIcon className="w-3.5 h-3.5 text-rose-400" />
                          <span>Blacklist from #{target.room}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleUnbanRoom}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-2"
                        >
                          <UnlockIcon className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Remove #{target.room} Blacklist</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleGlobalBan}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-700/30 text-xs text-rose-400 hover:text-rose-200 flex items-center gap-2 font-bold"
                    >
                      <ShieldAlertIcon className="w-3.5 h-3.5 text-rose-500" />
                      <span>Blacklist Globally</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUnbanGlobal}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 text-xs text-emerald-300 hover:text-emerald-100 flex items-center gap-2"
                    >
                      <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Lift Global Blacklist</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* KICK FROM ROOM */}
            {target.room && !target.room.startsWith("dm_") && (
              <button
                type="button"
                onClick={handleKick}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 flex items-center gap-2 transition-colors cursor-pointer"
                title="Kick user from room"
              >
                <UserMinusIcon className="w-4 h-4 text-amber-400" />
                <span>Kick from #{target.room}</span>
              </button>
            )}

            {/* RESET PASSWORD */}
            <div className="my-1 border-t border-white/10" />
            <button
              type="button"
              onClick={() => setShowPasswordPrompt(true)}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-500/20 text-amber-300 hover:text-amber-100 flex items-center gap-2 transition-colors font-semibold cursor-pointer"
            >
              <KeyIcon className="w-4 h-4 text-amber-400" />
              <span>Reset User Password</span>
            </button>
          </>
        )}
      </motion.div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showPasswordPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/20 p-5 shadow-2xl"
            >
              <h4 className="text-sm font-bold text-white mb-1">
                Reset Password for @{targetUser.username}
              </h4>
              <p className="text-[11px] text-slate-400 mb-3">
                Enter a new password for this user in the MongoDB database.
              </p>
              <form onSubmit={handleResetPassword} className="space-y-3">
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 4 chars)..."
                  required
                  minLength={4}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPasswordPrompt(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl text-xs bg-amber-500 hover:bg-amber-400 font-bold text-slate-950 shadow-md"
                  >
                    Save Password
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
