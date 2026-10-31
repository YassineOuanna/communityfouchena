import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

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
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.774-.974 4.545 4.545 0 00.41-1.385C3.398 16.924 3 14.568 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      ),
    },
    {
      id: "channels",
      label: "Channels",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h13.5m-13.5 7.5h13.5m-1.5-12l-3 16.5m-6-16.5l-3 16.5" />
        </svg>
      ),
    },
    {
      id: "dms",
      label: "Direct Messages",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
    {
      id: "calls",
      label: "Voice & Video Calls",
      onClick: onStartCall,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
      ),
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-indigo-400">
              <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.177 7.152.521 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.75.75 0 00-.636.37l-2.482 4.135a.75.75 0 01-1.316 0l-2.482-4.135a.75.75 0 00-.636-.37 48.901 48.901 0 01-3.476-.384C3.218 16.48 1.848 14.75 1.848 12.8V6.76c0-1.946 1.37-3.678 3.348-3.97z" clipRule="evenodd" />
            </svg>
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
        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
          title={`Theme: ${theme}`}
        >
          {theme === "light" ? "☀️" : theme === "oled" ? "🖤" : theme === "slate" ? "🌑" : "🌌"}
        </button>

        {/* User Profile Avatar with Online Dot */}
        <div className="relative">
          <button
            type="button"
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 p-[1.5px] cursor-pointer hover:scale-105 transition-transform"
            title={`${user?.username} (Click to open profile)`}
          >
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white uppercase">
              {user?.username?.[0] || "?"}
            </div>
          </button>
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--bg-base)] shadow-sm"
            title="Online"
          />
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={onLogout}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Sign out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
