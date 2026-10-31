import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import {
  MoreVerticalIcon,
  XIcon,
  ShieldAlertIcon,
  UsersIcon,
} from "./Icons";

// Color gradient generator based on name
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

export default function MemberListDrawer({
  isOpen,
  onClose,
  activeRoom,
  onSelectDM,
  onUserContextMenu,
}) {
  const { onlineUsers = [] } = useSocket() || {};
  const { user: currentUser } = useAuth();

  if (!isOpen) return null;

  // Separate members into Admins and Online Members
  const admins = onlineUsers.filter((u) => u.isAdmin || ["admin", "wana"].includes((u.username || "").toLowerCase()));
  const regularMembers = onlineUsers.filter((u) => !u.isAdmin && !["admin", "wana"].includes((u.username || "").toLowerCase()));

  const renderUser = (u) => {
    const isSelf = u.userId === currentUser?.id || u.username === currentUser?.username;
    return (
      <div
        key={u.userId}
        onClick={() => !isSelf && onSelectDM && onSelectDM(u)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUserContextMenu && onUserContextMenu(e, u, activeRoom?.name);
        }}
        className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-all select-none cursor-pointer ${
          isSelf
            ? "bg-white/[0.04] cursor-default"
            : "hover:bg-white/[0.08] active:scale-[0.99]"
        }`}
        title={isSelf ? "You" : `${u.username} (Click to DM, right-click for moderation)`}
      >
        <div className="relative flex-shrink-0">
          <div
            className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getAvatarGradient(
              u.username
            )} flex items-center justify-center text-xs font-bold text-white shadow-sm border border-white/20`}
          >
            {u.username?.[0]?.toUpperCase() || "?"}
          </div>
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--bg-base)] shadow-sm"
            title="Online"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[var(--text-main)] truncate group-hover:text-indigo-400 transition-colors">
              {u.username}
            </span>
            {isSelf && (
              <span className="text-[10px] text-[var(--text-muted)] font-normal">
                (You)
              </span>
            )}
            {u.isAdmin && (
              <span className="text-[9px] px-1 py-0.2 rounded font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                Admin
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
            {u.customStatus || "Exploring the community ✨"}
          </p>
        </div>

        {/* Hover action icon */}
        {!isSelf && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUserContextMenu && onUserContextMenu(e, u, activeRoom?.name);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all text-xs"
            title="Moderation & options"
          >
            <MoreVerticalIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: 280, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 280, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className="fixed md:relative inset-y-0 right-0 z-40 w-72 max-w-[85vw] md:w-64 h-full border-l border-white/10 bg-slate-900/95 md:bg-slate-900/60 backdrop-blur-2xl flex flex-col flex-shrink-0 shadow-2xl md:shadow-none"
      >
        {/* Drawer Header */}
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
              Room Members
            </span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              {onlineUsers.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/10 transition-colors"
            title="Close member list"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

      {/* Member Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Admins Group */}
        {admins.length > 0 && (
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-bold text-amber-400/90 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlertIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Administrators</span>
              <span className="text-[10px] text-[var(--text-muted)] font-normal">
                ({admins.length})
              </span>
            </div>
            <div className="space-y-0.5">{admins.map(renderUser)}</div>
          </div>
        )}

        {/* Regular Members Group */}
        <div>
          <div className="px-2 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <UsersIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Online Members</span>
            <span className="text-[10px] text-[var(--text-muted)] font-normal">
              ({regularMembers.length})
            </span>
          </div>
          <div className="space-y-0.5">
            {regularMembers.length === 0 && admins.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] px-2 py-2">
                No active members online
              </p>
            ) : (
              regularMembers.map(renderUser)
            )}
          </div>
        </div>
      </div>
    </motion.div>
    </>
  );
}
