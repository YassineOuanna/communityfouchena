import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  MessagesSquareIcon,
  HashIcon,
  UsersIcon,
  PhoneCallIcon,
  SunIcon,
  MoonIcon,
  PaletteIcon,
  LogOutIcon,
  MessageSquareIcon,
} from "./Icons";

export default function NavigationRail({
  currentView = "all",
  onSelectView,
  unreadTotal = 0,
  onOpenProfile,
  onOpenSettings,
  onStartCall,
  onLogout,
}) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    {
      id: "all",
      label: "All Chats",
      badge: unreadTotal,
      icon: <MessagesSquareIcon className="w-5 h-5" />,
    },
    {
      id: "channels",
      label: "Channels",
      icon: <HashIcon className="w-5 h-5" />,
    },
    {
      id: "dms",
      label: "Direct Messages",
      icon: <UsersIcon className="w-5 h-5" />,
    },
    {
      id: "calls",
      label: "Voice & Video Calls",
      onClick: onStartCall,
      icon: <PhoneCallIcon className="w-5 h-5" />,
    },
  ];

  return (
    <div className="w-16 h-full flex flex-col items-center py-4 justify-between border-r border-white/10 bg-slate-950/40 backdrop-blur-2xl flex-shrink-0 select-none z-20">
      {/* Top: Brand Logo / Workspace Icon */}
      <div className="flex flex-col items-center gap-6">
        <div
          className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-cyan-400 p-[1.5px] shadow-[0_0_20px_rgba(99,102,241,0.35)] cursor-pointer hover:scale-105 transition-transform"
          title="CommunityFouchena"
        >
          <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center text-white">
            <MessageSquareIcon className="w-5 h-5 text-indigo-400" />
          </div>
        </div>

        {/* Navigation Bar Icons */}
        <div className="flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => (item.onClick ? item.onClick() : onSelectView(item.id))}
                className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-bubble"
                    : "text-[var(--text-muted)] hover:text-white hover:bg-white/10"
                }`}
                title={item.label}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeRailPill"
                    className="absolute -left-3.5 w-1.5 h-6 rounded-r-full bg-indigo-400"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                {item.icon}

                {/* Unread Pill Badge */}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-sm border border-slate-950">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom: Theme Toggle & User Avatar */}
      <div className="flex flex-col items-center gap-3">
        {/* Theme Switcher Button with crisp SVG icons */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
          title={`Theme: ${theme}`}
        >
          {theme === "light" ? (
            <SunIcon className="w-5 h-5 text-amber-400" />
          ) : theme === "oled" ? (
            <MoonIcon className="w-5 h-5 text-indigo-400" />
          ) : theme === "slate" ? (
            <PaletteIcon className="w-5 h-5 text-cyan-400" />
          ) : (
            <MoonIcon className="w-5 h-5 text-purple-400" />
          )}
        </button>

        {/* User Profile Avatar with Online Dot */}
        <div className="relative">
          <button
            type="button"
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 p-[1.5px] cursor-pointer hover:scale-105 transition-transform"
            title={`${user?.username} (Click to open profile)`}
          >
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.username?.[0] || "?"
              )}
            </div>
          </button>
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--bg-base)] shadow-sm"
            title="Online"
          />
        </div>

        {/* Logout with Icon */}
        <button
          type="button"
          onClick={onLogout}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Sign out"
        >
          <LogOutIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
