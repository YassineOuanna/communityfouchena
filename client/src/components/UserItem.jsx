import React from "react";

export default function UserItem({ user, currentUserId, onClick, isSelected }) {
  const isMe = user.userId === currentUserId;

  return (
    <button
      type="button"
      disabled={isMe}
      onClick={() => !isMe && onClick(user)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 select-none ${
        isSelected
          ? "bg-indigo-600/70 border border-indigo-400/40 text-white shadow-bubble font-semibold backdrop-blur-md"
          : isMe
          ? "opacity-60 cursor-default text-slate-400"
          : "text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent"
      }`}
    >
      {/* Clean Avatar Badge */}
      <div className="relative flex-shrink-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
          isSelected
            ? "bg-white/20 text-white"
            : "bg-white/[0.06] border border-white/10 text-slate-200"
        }`}>
          {user.username?.[0]?.toUpperCase() || "?"}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-xs truncate ${isSelected ? "text-white font-semibold" : "text-slate-200"}`}>
          {user.username}
        </p>
        <p className="text-[10px] text-slate-400 truncate">
          Active now
        </p>
      </div>

      {isMe ? (
        <span className="text-[10px] text-slate-400 font-normal">You</span>
      ) : (
        <span className={`text-[11px] ${isSelected ? "text-cyan-200 font-medium" : "text-slate-500"}`}>
          Direct
        </span>
      )}
    </button>
  );
}
