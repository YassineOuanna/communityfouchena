import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function UserContextMenu({
  target, // { x, y, user: { userId, username, isAdmin }, room }
  onClose,
  onStartDM,
}) {
  const { socket } = useSocket();
  const { user: currentUser } = useAuth();
  const [activeSubmenu, setActiveSubmenu] = useState(null); // "mute" | "blacklist" | null
  const [statusMsg, setStatusMsg] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const menuRef = useRef(null);

  const targetUser = target?.user || {};
  const isSelf = !!(targetUser.username && currentUser?.username && targetUser.username === currentUser.username);
  const isMasterAdmin = ["admin", "wana"].includes(targetUser.username);
  const canModerate =
    !!currentUser?.isAdmin || ["admin", "wana"].includes(currentUser?.username);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!target || !target.user) return null;

  // Adjust coordinates so menu does not overflow screen
  const menuWidth = 230;
  const menuHeight = 280;
  const safeX = typeof target.x === "number" ? target.x : 100;
  const safeY = typeof target.y === "number" ? target.y : 100;
  const winWidth = typeof window !== "undefined" ? window.innerWidth : 800;
  const winHeight = typeof window !== "undefined" ? window.innerHeight : 600;
  const x = Math.max(10, Math.min(safeX, winWidth - menuWidth - 10));
  const y = Math.max(10, Math.min(safeY, winHeight - menuHeight - 10));

  const targetId = targetUser.userId || targetUser.id || targetUser._id;
  const targetUsername = targetUser.username || "user";

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
        `Are you sure you want to kick @${targetUsername} from #${target.room}? They will not be able to see or rejoin this room.`
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
    if (
      !window.confirm(
        `Blacklist @${targetUsername} from #${target.room}?`
      )
    )
      return;
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
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.12 }}
        style={{ left: `${x}px`, top: `${y}px` }}
        className="absolute w-[220px] rounded-2xl bg-[#0f172a]/95 border border-white/15 backdrop-blur-xl shadow-2xl py-1.5 text-xs text-slate-200 select-none z-50 font-medium"
      >
        {/* User Card Header */}
        <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-[10px]">
            {targetUser.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-white block truncate text-[11px]">
              @{targetUser.username}
            </span>
            <span className="text-[9px] text-slate-400 block leading-none">
              {targetUser.isAdmin ? "👑 Administrator" : "Community Member"}
            </span>
          </div>
        </div>

        {/* 1. Direct Message */}
        {!isSelf && onStartDM && (
          <button
            type="button"
            onClick={() => {
              onStartDM(targetUser);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white transition-colors"
          >
            <span>💬</span> Send Direct Message
          </button>
        )}

        {/* Moderation Controls (Admin or Room Creator) */}
        {!isSelf && canModerate && !isMasterAdmin && (
          <>
            <div className="my-1 border-t border-white/10" />

            {/* MUTE MENU WITH HOVER DURATIONS */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu("mute")}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-indigo-600/30 flex items-center justify-between text-slate-200 hover:text-white transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <span>🔇</span> Mute User
                </span>
                <span className="text-[10px] text-slate-400 group-hover:text-white">
                  ›
                </span>
              </button>

              {/* Submenu: Mute Durations */}
              <AnimatePresence>
                {activeSubmenu === "mute" && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    className="absolute left-[210px] top-0 w-[170px] rounded-2xl bg-[#0f172a]/95 border border-white/15 backdrop-blur-xl shadow-2xl py-1 text-xs text-slate-200 z-50"
                  >
                    <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-slate-400 font-bold border-b border-white/10 mb-1">
                      Mute Duration
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMute(15)}
                      className="w-full text-left px-3 py-1.5 hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white"
                    >
                      ⏱️ 15 Minutes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMute(60)}
                      className="w-full text-left px-3 py-1.5 hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white"
                    >
                      ⏳ 1 Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMute(1440)}
                      className="w-full text-left px-3 py-1.5 hover:bg-white/10 flex items-center gap-2 text-slate-200 hover:text-white"
                    >
                      📅 24 Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMute(null)}
                      className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 flex items-center gap-2 font-semibold"
                    >
                      ♾️ Permanent Mute
                    </button>
                    <div className="my-1 border-t border-white/10" />
                    <button
                      type="button"
                      onClick={handleUnmute}
                      className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 flex items-center gap-2 font-semibold"
                    >
                      🔊 Unmute User
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* BLACKLIST / BAN MENU */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu("blacklist")}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-rose-600/20 flex items-center justify-between text-rose-300 hover:text-rose-100 transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <span>🚫</span> Blacklist / Ban
                </span>
                <span className="text-[10px] text-slate-400 group-hover:text-white">
                  ›
                </span>
              </button>

              {/* Submenu: Blacklist Scope */}
              <AnimatePresence>
                {activeSubmenu === "blacklist" && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    className="absolute left-[210px] top-0 w-[200px] rounded-2xl bg-[#0f172a]/95 border border-white/15 backdrop-blur-xl shadow-2xl py-1 text-xs text-slate-200 z-50"
                  >
                    <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-slate-400 font-bold border-b border-white/10 mb-1">
                      Blacklist Target
                    </div>
                    {target.room && !target.room.startsWith("dm_") && (
                      <>
                        <button
                          type="button"
                          onClick={handleBanRoom}
                          className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 flex items-center gap-2"
                        >
                          🚪 Blacklist from #{target.room}
                        </button>
                        <button
                          type="button"
                          onClick={handleUnbanRoom}
                          className="w-full text-left px-3 py-1.5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-2"
                        >
                          🔓 Remove #{target.room} Blacklist
                        </button>
                      </>
                    )}

                    {currentUser?.isAdmin && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <button
                          type="button"
                          onClick={handleGlobalBan}
                          className="w-full text-left px-3 py-1.5 hover:bg-rose-700/30 text-rose-400 hover:text-rose-200 flex items-center gap-2 font-bold"
                        >
                          🌐 Blacklist Globally (All Rooms)
                        </button>
                        <button
                          type="button"
                          onClick={handleUnbanGlobal}
                          className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 flex items-center gap-2"
                        >
                          🌍 Lift Global Blacklist
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* KICK FROM CHANNEL */}
            {target.room && !target.room.startsWith("dm_") && (
              <button
                type="button"
                onClick={handleKick}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 flex items-center gap-2 transition-colors"
                title="User will be kicked and won't be able to see or rejoin this room"
              >
                <span>👢</span> Kick from #{target.room}
              </button>
            )}

            {/* RESET PASSWORD (Admin Only) */}
            {currentUser?.isAdmin && (
              <>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  onClick={() => setShowPasswordPrompt(true)}
                  className="w-full text-left px-3 py-1.5 hover:bg-amber-500/20 text-amber-300 hover:text-amber-100 flex items-center gap-2 transition-colors font-semibold"
                >
                  <span>🔑</span> Reset User Password
                </button>
              </>
            )}
          </>
        )}
      </motion.div>

      {/* Password Reset Dialog */}
      <AnimatePresence>
        {showPasswordPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/20 p-5 shadow-2xl"
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
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPasswordPrompt(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-xs bg-amber-500 hover:bg-amber-400 font-bold text-slate-950 shadow-md"
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
