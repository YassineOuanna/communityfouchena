import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useTheme } from "../context/ThemeContext";
import api from "../utils/api";
import {
  UserIcon,
  XIcon,
  KeyIcon,
  SunIcon,
  MoonIcon,
  PaletteIcon,
  ShieldAlertIcon,
  LogOutIcon,
} from "./Icons";

const PRESET_STATUSES = [
  { emoji: "⚡", text: "Building something awesome" },
  { emoji: "🎧", text: "Listening to music" },
  { emoji: "💻", text: "Deep in focus mode" },
  { emoji: "☕", text: "Taking a coffee break" },
  { emoji: "🌴", text: "Away / Relaxing" },
  { emoji: "🚀", text: "Shipping fast" },
];

export default function UserProfileModal({
  onClose,
  onChangePassword,
  onOpenAdmin,
  onLogout,
}) {
  const { user, setUser } = useAuth();
  const { socket } = useSocket();
  const { theme, toggleTheme, setTheme } = useTheme();
  const [customStatus, setCustomStatus] = useState(
    user?.customStatus || "Exploring the community ✨"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    setMessage("");
    try {
      const res = await api.put("/auth/profile", { customStatus });
      if (res.data) {
        if (setUser) {
          setUser((prev) => ({ ...prev, ...res.data }));
        }
        socket?.emit("update_custom_status", { status: customStatus });
        setMessage("Profile updated successfully! ✨");
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setMessage("Failed to update status. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative w-full max-w-md rounded-3xl glass-surface border border-white/15 p-6 shadow-2xl z-10 overflow-hidden"
      >
        {/* Glowing Ambient Header */}
        <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-indigo-400" />
            <span>User Profile</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/10 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card Summary */}
        <div className="mt-5 flex items-center gap-4 p-4 rounded-2xl glass-card relative z-10">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 text-white flex items-center justify-center text-xl font-extrabold shadow-md border-2 border-white/20">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <span
              className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[var(--bg-base)] shadow-sm"
              title="Online"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--text-main)] truncate">
                {user?.username}
              </h3>
              {user?.isAdmin && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
              {user?.email || `@${user?.username}`}
            </p>
          </div>
        </div>

        {/* Custom Status Input */}
        <form onSubmit={handleSave} className="mt-5 space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-main)] mb-1.5">
              Custom Status Message
            </label>
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="What's happening? (e.g. Working on a project)"
              maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {/* Preset Status Chips */}
          <div>
            <span className="block text-[11px] font-medium text-[var(--text-muted)] mb-2">
              Quick presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_STATUSES.map((preset) => (
                <button
                  key={preset.text}
                  type="button"
                  onClick={() => setCustomStatus(`${preset.emoji} ${preset.text}`)}
                  className="px-2.5 py-1 rounded-lg text-xs bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[var(--text-main)] transition-colors flex items-center gap-1.5"
                >
                  <span>{preset.emoji}</span>
                  <span className="truncate max-w-[130px]">{preset.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme Appearance Selector */}
          <div>
            <span className="block text-[11px] font-medium text-[var(--text-muted)] mb-2">
              Appearance Theme:
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "dark", label: "Midnight", icon: <MoonIcon className="w-3.5 h-3.5 text-purple-400" /> },
                { id: "oled", label: "OLED", icon: <MoonIcon className="w-3.5 h-3.5 text-indigo-400" /> },
                { id: "slate", label: "Slate", icon: <PaletteIcon className="w-3.5 h-3.5 text-cyan-400" /> },
                { id: "light", label: "Light", icon: <SunIcon className="w-3.5 h-3.5 text-amber-400" /> },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme && setTheme(t.id)}
                  className={`py-1.5 px-2 rounded-xl text-xs border flex flex-col items-center gap-1 transition-all ${
                    theme === t.id
                      ? "bg-indigo-600/30 border-indigo-400/60 text-white font-bold"
                      : "bg-white/[0.04] border-white/10 text-[var(--text-muted)] hover:text-white"
                  }`}
                >
                  {t.icon}
                  <span className="text-[10px]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Account Controls (Admin & Logout) */}
          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-white/10">
            {user?.isAdmin && onOpenAdmin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ShieldAlertIcon className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </button>
            )}

            {onChangePassword && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChangePassword();
                }}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <KeyIcon className="w-3.5 h-3.5" />
                <span>Password</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold text-rose-300 hover:text-white flex items-center gap-1.5 transition-colors ml-auto"
              >
                <LogOutIcon className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>

          {message && (
            <p className="text-xs text-center font-medium text-emerald-400">
              {message}
            </p>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-bubble hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Status"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
