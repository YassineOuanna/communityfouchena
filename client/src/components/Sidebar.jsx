import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import UserItem from "./UserItem";
import RoomModal from "./RoomModal";
import AdminModal from "./AdminModal";
import ChangePasswordModal from "./ChangePasswordModal";
import AdBanner, { AD_CONFIG } from "./AdBanner";
import api from "../utils/api";

export default function Sidebar({ activeRoom, activeDM, onSelectRoom, onSelectDM, onLogout, onUserContextMenu }) {
  const { onlineUsers = [], isConnected = false } = useSocket() || {};
  const { user } = useAuth();
  const [rooms, setRooms] = useState([{ name: "global", description: "General community chat" }]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [tab, setTab] = useState("rooms");

  useEffect(() => {
    api.get("/rooms").then((res) => {
      setRooms([{ name: "global", description: "General community chat" }, ...(res.data || [])]);
    }).catch(() => {});
  }, []);

  const handleRoomCreated = (room) => {
    setRooms((prev) => [...prev, room]);
    onSelectRoom(room);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-xl border-r border-white/10 select-none">
      {/* Workspace Header */}
      <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 border border-white/20 flex items-center justify-center text-white shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.177 7.152.521 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.75.75 0 00-.636.37l-2.482 4.135a.75.75 0 01-1.316 0l-2.482-4.135a.75.75 0 00-.636-.37 48.901 48.901 0 01-3.476-.384C3.218 16.48 1.848 14.75 1.848 12.8V6.76c0-1.946 1.37-3.678 3.348-3.97z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="font-bold text-white text-sm tracking-tight truncate drop-shadow-sm">
            CommunityFouchena
          </span>
        </div>

        {/* Live Network Status Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-rose-500"
            }`}
          />
          <span className="text-[10px] text-slate-300 font-medium">
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Glass Segmented Tab Controls */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/10 relative backdrop-blur-md">
          <button
            type="button"
            onClick={() => setTab("rooms")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 relative z-10 flex items-center justify-center gap-1.5 ${
              tab === "rooms" ? "text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "rooms" && (
              <motion.div
                layoutId="sidebarNavPill"
                className="absolute inset-0 bg-indigo-600/80 rounded-lg shadow-sm border border-indigo-400/30"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 relative z-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h13.5m-13.5 7.5h13.5m-1.5-12l-3 16.5m-6-16.5l-3 16.5" />
            </svg>
            <span className="relative z-10">Channels ({rooms?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("people")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 relative z-10 flex items-center justify-center gap-1.5 ${
              tab === "people" ? "text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "people" && (
              <motion.div
                layoutId="sidebarNavPill"
                className="absolute inset-0 bg-indigo-600/80 rounded-lg shadow-sm border border-indigo-400/30"
                transition={{ type: "spring", stiffness: 450, damping: 35 }}
              />
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 relative z-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span className="relative z-10">Online ({onlineUsers?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1">
        <AnimatePresence mode="wait">
          {tab === "rooms" ? (
            <motion.div
              key="rooms-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between px-2 pt-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Rooms</span>
                <button
                  type="button"
                  onClick={() => setShowRoomModal(true)}
                  className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                  title="Create Channel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>

              {rooms.map((room) => {
                const isSelected = activeRoom?.name === room.name && !activeDM;
                return (
                  <button
                    key={room.name}
                    type="button"
                    onClick={() => onSelectRoom(room)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                      isSelected
                        ? "bg-indigo-600/70 border border-indigo-400/40 text-white shadow-bubble font-medium backdrop-blur-md"
                        : "text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                      isSelected ? "bg-white/20 text-white" : "bg-white/[0.06] border border-white/10 text-slate-400"
                    }`}>
                      #
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs truncate ${isSelected ? "text-white font-semibold" : "text-slate-200"}`}>
                        {room.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {room.description || "Public chat"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="people-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-1"
            >
              <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Active Members
              </div>

              {onlineUsers.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No other members online right now.
                </div>
              )}

              {onlineUsers.map((u) => (
                <UserItem
                  key={u.userId}
                  user={u}
                  currentUserId={user?.id}
                  isSelected={activeDM?.userId === u.userId}
                  onClick={onSelectDM}
                  onContextMenu={(e, targetUser) =>
                    onUserContextMenu &&
                    onUserContextMenu(e, targetUser, activeRoom?.name)
                  }
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Optional Ad Banner: Only renders when AD_CONFIG.enabled is true */}
      {AD_CONFIG.enabled && (
        <div className="px-3 flex-shrink-0">
          <AdBanner variant="sidebar" />
        </div>
      )}

      {/* User Profile Footer */}
      <div className="p-3 border-t border-white/10 bg-black/20 safe-pb flex-shrink-0">
        <div className="flex items-center justify-between bg-white/[0.04] rounded-2xl p-2.5 border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm border ${
                user?.isAdmin
                  ? "bg-gradient-to-tr from-amber-500 to-orange-500 border-amber-300/40 shadow-glow"
                  : "bg-gradient-to-tr from-indigo-500 to-cyan-500 border-white/20"
              }`}
            >
              {user?.isAdmin ? "👑" : user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {user?.username}
                </p>
                {user?.isAdmin && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1 py-0.2 rounded font-extrabold uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[10px] text-emerald-400 font-medium leading-none mt-1">
                Online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Change Password Button */}
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-white/10 transition-colors"
              title="Change Password"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </button>

            {user?.isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="p-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 hover:text-white transition-colors border border-amber-500/30"
                title="Open Database Admin Panel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showRoomModal && (
          <RoomModal onClose={() => setShowRoomModal(false)} onRoomCreated={handleRoomCreated} />
        )}
        {showAdminModal && (
          <AdminModal onClose={() => setShowAdminModal(false)} />
        )}
        {showPasswordModal && (
          <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
