import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

export default function ConversationList({
  rooms = [],
  onlineUsers = [],
  activeRoom,
  activeDM,
  onSelectRoom,
  onSelectDM,
  onCreateRoom,
  onUserContextMenu,
  unreadCounts = {},
  lastMessages = {},
  isLoading = false,
  filterView = "all", // "all", "channels", "dms"
  onFilterChange,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const activeFilter = filterView || "all";

  // Filter conversations with strict deduplication
  const filteredRooms = useMemo(() => {
    if (activeFilter === "dms") return [];
    const seen = new Set();
    const result = [];
    const query = searchQuery.trim().toLowerCase();

    for (const r of rooms || []) {
      if (!r || !r.name || typeof r.name !== "string") continue;
      const key = r.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const matches =
        !query ||
        key.includes(query) ||
        (r.description && r.description.toLowerCase().includes(query));

      if (matches) {
        result.push(r);
      }
    }
    return result;
  }, [rooms, searchQuery, activeFilter]);

  const filteredUsers = useMemo(() => {
    if (activeFilter === "channels") return [];
    const seen = new Set();
    const result = [];
    const query = searchQuery.trim().toLowerCase();

    for (const u of onlineUsers || []) {
      if (!u || !u.username) continue;
      const key = (u.userId || u.id || u.username).toString();
      if (seen.has(key)) continue;
      seen.add(key);

      const matches =
        !query ||
        u.username.toLowerCase().includes(query) ||
        (u.customStatus && u.customStatus.toLowerCase().includes(query));

      if (matches) {
        result.push(u);
      }
    }
    return result;
  }, [onlineUsers, searchQuery, activeFilter]);

  const totalUniqueRooms = useMemo(() => {
    const seen = new Set();
    for (const r of rooms || []) {
      if (r && r.name) seen.add(r.name.trim().toLowerCase());
    }
    return seen.size;
  }, [rooms]);

  const totalUniqueUsers = useMemo(() => {
    const seen = new Set();
    for (const u of onlineUsers || []) {
      if (u && u.username) seen.add((u.userId || u.id || u.username).toString());
    }
    return seen.size;
  }, [onlineUsers]);

  return (
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-xl border-r border-white/10 select-none overflow-hidden">
      {/* Top Header: Title & Create Action */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-[var(--text-main)] tracking-tight">
            Conversations
          </h2>
          <p className="text-[11px] text-[var(--text-muted)]">
            {totalUniqueUsers} online • {totalUniqueRooms} channels
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateRoom}
          className="w-8 h-8 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center justify-center shadow-sm border border-indigo-400/30 active:scale-95 transition-all"
          title="Create New Channel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {/* Search Bar Across Conversations & Messages */}
      <div className="px-3 pb-2.5 flex-shrink-0">
        <div className="relative flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 absolute left-3 text-[var(--text-muted)] pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 text-xs text-[var(--text-muted)] hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-3 pb-2 flex items-center gap-1.5 flex-shrink-0 overflow-x-auto no-scrollbar">
        {[
          { id: "all", label: "All" },
          { id: "channels", label: "Channels" },
          { id: "dms", label: "Direct Messages" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange && onFilterChange(f.id)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeFilter === f.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white/[0.04] text-[var(--text-muted)] hover:bg-white/[0.08] hover:text-[var(--text-main)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Conversation Stream List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
        {/* Skeleton Loaders if Loading */}
        {isLoading && (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-24 h-3 rounded bg-white/10" />
                  <div className="w-36 h-2.5 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <>
            {/* Channels Header & List */}
            {activeFilter !== "dms" && filteredRooms.length > 0 && (
              <div>
                <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
                  <span>Channels</span>
                  <span className="text-[10px]">{filteredRooms.length}</span>
                </div>

                <div className="space-y-0.5">
                  {filteredRooms.map((room) => {
                    const isSelected = activeRoom?.name === room.name && !activeDM;
                    const unread = unreadCounts[room.name] || 0;
                    const lastMsg = lastMessages[room.name];

                    return (
                      <button
                        key={room.name}
                        type="button"
                        onClick={() => onSelectRoom(room)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all ${
                          isSelected
                            ? "bg-indigo-600/80 text-white shadow-bubble font-semibold border border-indigo-400/30"
                            : "text-[var(--text-main)] hover:bg-white/[0.06]"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-white/[0.06] border border-white/10 text-indigo-400"
                          }`}
                        >
                          #
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold truncate leading-tight">
                              {room.name}
                            </p>
                            {lastMsg && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-indigo-100" : "text-[var(--text-muted)]"}`}>
                            {lastMsg ? `${lastMsg.senderName}: ${lastMsg.content}` : (room.description || "Public community room")}
                          </p>
                        </div>

                        {unread > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct Messages Header & List */}
            {activeFilter !== "channels" && (
              <div className="pt-2">
                <div className="px-2 pb-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
                  <span>Direct Messages</span>
                  <span className="text-[10px]">{filteredUsers.length}</span>
                </div>

                <div className="space-y-0.5">
                  {filteredUsers.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] px-3 py-2">
                      No matching direct messages
                    </p>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = activeDM?.userId === u.userId;
                      const dmRoomKey = `dm_${u.userId}`;
                      const unread = unreadCounts[dmRoomKey] || 0;
                      const lastMsg = lastMessages[dmRoomKey];

                      return (
                        <div
                          key={u.userId}
                          onClick={() => onSelectDM(u)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onUserContextMenu && onUserContextMenu(e, u, activeRoom?.name);
                          }}
                          className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600/80 text-white shadow-bubble font-semibold border border-indigo-400/30"
                              : "text-[var(--text-main)] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                                u.username
                              )} flex items-center justify-center text-xs font-bold text-white shadow-sm border border-white/20`}
                            >
                              {u.username?.[0]?.toUpperCase() || "?"}
                            </div>
                            <span
                              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[var(--bg-base)] shadow-sm"
                              title="Online"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold truncate leading-tight">
                                {u.username}
                              </p>
                              {lastMsg && (
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <p className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-indigo-100" : "text-[var(--text-muted)]"}`}>
                              {lastMsg ? lastMsg.content : (u.customStatus || "Online")}
                            </p>
                          </div>

                          {unread > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                              {unread}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
