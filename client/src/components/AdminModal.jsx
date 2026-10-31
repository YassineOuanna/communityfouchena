import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../utils/api";
import {
  ShieldAlertIcon,
  XIcon,
  SparklesIcon,
  UsersIcon,
  MessageSquareIcon,
  HashIcon,
  TrashIcon,
  PlusIcon,
  LockIcon,
  CheckIcon,
} from "./Icons";

export default function AdminModal({ onClose }) {
  const [tab, setTab] = useState("overview"); // "overview" | "rooms" | "users" | "messages"
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState("");

  // Room Creation Form State
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [isNewRoomPrivate, setIsNewRoomPrivate] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState("");

  const fetchStats = async () => {
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch {
      setAlert("Failed to load database stats");
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch {
      setAlert("Failed to load users list");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/messages");
      setMessages(res.data);
    } catch {
      setAlert("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/rooms");
      setRooms(res.data);
    } catch {
      setAlert("Failed to load channels list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    setSearch("");
    if (tab === "rooms") fetchRooms();
    if (tab === "users") fetchUsers();
    if (tab === "messages") fetchMessages();
  }, [tab]);

  // Handle Create Channel
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      const res = await api.post("/admin/rooms", {
        name: newRoomName.trim(),
        description: newRoomDesc.trim(),
        isPrivate: isNewRoomPrivate,
        password: newRoomPassword,
      });
      setRooms((prev) => [res.data, ...prev]);
      setShowCreateRoom(false);
      setNewRoomName("");
      setNewRoomDesc("");
      setIsNewRoomPrivate(false);
      setNewRoomPassword("");
      setAlert(`Channel #${res.data.name} created successfully.`);
      fetchStats();
    } catch (err) {
      setAlert(err.response?.data?.message || "Failed to create channel");
    }
  };

  // Handle Delete Channel
  const handleDeleteRoom = async (roomId, roomName) => {
    if (roomName === "global") {
      setAlert("Default #global community room cannot be deleted.");
      return;
    }
    if (
      !window.confirm(
        `⚠️ Are you sure you want to permanently delete channel #${roomName} and all its messages? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/admin/rooms/${roomId}`);
      setRooms((prev) => prev.filter((r) => r._id !== roomId && r.name !== roomName));
      setAlert(`Channel #${roomName} has been permanently deleted.`);
      fetchStats();
    } catch (err) {
      setAlert(err.response?.data?.message || "Failed to delete channel");
    }
  };

  // Handle Clear Channel Messages
  const handleClearRoomMessages = async (roomId, roomName) => {
    if (
      !window.confirm(
        `Clear all messages in #${roomName}? The channel will remain intact.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/admin/rooms/${roomId}/messages`);
      setRooms((prev) =>
        prev.map((r) => (r._id === roomId ? { ...r, messageCount: 0 } : r))
      );
      setAlert(`All messages in #${roomName} have been cleared.`);
      fetchStats();
    } catch (err) {
      setAlert(err.response?.data?.message || "Failed to clear channel messages");
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user @${username}?`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
      setAlert(`User @${username} deleted from database.`);
      fetchStats();
    } catch (err) {
      setAlert(err.response?.data?.message || "Failed to delete user");
    }
  };

  // Handle Delete Message
  const handleDeleteMessage = async (msgId) => {
    try {
      await api.delete(`/admin/messages/${msgId}`);
      setMessages((prev) => prev.filter((m) => m._id !== msgId));
      fetchStats();
    } catch {
      setAlert("Failed to delete message");
    }
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-slate-900 border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden select-none"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-sm shadow-md">
              <ShieldAlertIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                Database Admin Panel
              </h3>
              <p className="text-[11px] text-slate-400">
                CommunityFouchena Full System & Chat Controls
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-1 sm:gap-2 px-4 sm:px-6 pt-3 border-b border-white/10 bg-slate-900/60 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 flex-shrink-0 ${
              tab === "overview"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("rooms")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 flex-shrink-0 ${
              tab === "rooms"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <HashIcon className="w-3.5 h-3.5" />
            <span>Manage Channels ({stats?.totalRooms ?? "..."})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("users")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 flex-shrink-0 ${
              tab === "users"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <UsersIcon className="w-3.5 h-3.5" />
            <span>Users ({stats?.totalUsers ?? "..."})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("messages")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 flex-shrink-0 ${
              tab === "messages"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquareIcon className="w-3.5 h-3.5" />
            <span>Messages ({stats?.totalMessages ?? "..."})</span>
          </button>
        </div>

        {alert && (
          <div className="mx-4 sm:mx-6 mt-3 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex justify-between items-center">
            <span>{alert}</span>
            <button type="button" onClick={() => setAlert("")} className="hover:text-white font-bold ml-2">
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: OVERVIEW */}
          {tab === "overview" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-center">
                  <span className="text-2xl font-bold text-white block">
                    {stats.totalUsers}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Total Registered Users
                  </span>
                </div>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-center">
                  <span className="text-2xl font-bold text-cyan-400 block">
                    {stats.totalMessages}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Total Messages Sent
                  </span>
                </div>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-center">
                  <span className="text-2xl font-bold text-indigo-400 block">
                    {stats.totalRooms}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Active Channels
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Recent Registered Accounts
                </h4>
                <div className="divide-y divide-white/5 bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                  {stats.recentUsers?.map((u) => (
                    <div key={u._id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/40 text-indigo-200 flex items-center justify-center text-xs font-bold">
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-white">
                            {u.username}
                          </span>
                          {u.isAdmin && (
                            <span className="ml-2 text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE CHANNELS & ROOMS */}
          {tab === "rooms" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search channels..."
                  className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />

                <button
                  type="button"
                  onClick={() => setShowCreateRoom(!showCreateRoom)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>{showCreateRoom ? "Cancel" : "Add Channel"}</span>
                </button>
              </div>

              {/* Inline Create Channel Form */}
              <AnimatePresence>
                {showCreateRoom && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreateRoom}
                    className="p-4 rounded-2xl bg-white/[0.04] border border-amber-500/30 space-y-3 overflow-hidden shadow-lg"
                  >
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <HashIcon className="w-3.5 h-3.5" />
                      <span>Create New Channel</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1 font-semibold">
                          Channel Name *
                        </label>
                        <input
                          type="text"
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          placeholder="e.g. music, announcements"
                          required
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1 font-semibold">
                          Description
                        </label>
                        <input
                          type="text"
                          value={newRoomDesc}
                          onChange={(e) => setNewRoomDesc(e.target.value)}
                          placeholder="What is this channel for?"
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                        <input
                          type="checkbox"
                          checked={isNewRoomPrivate}
                          onChange={(e) => setIsNewRoomPrivate(e.target.checked)}
                          className="rounded bg-black/40 border-white/20 text-amber-500 focus:ring-0 w-4 h-4"
                        />
                        <span>Private Channel (Password Protected)</span>
                      </label>

                      {isNewRoomPrivate && (
                        <input
                          type="password"
                          value={newRoomPassword}
                          onChange={(e) => setNewRoomPassword(e.target.value)}
                          placeholder="Channel Password"
                          required
                          className="w-48 px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      )}

                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all ml-auto"
                      >
                        Save & Broadcast Channel
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Channels List */}
              {loading ? (
                <p className="text-center text-slate-400 text-xs py-8">Loading channels...</p>
              ) : (
                <div className="space-y-2">
                  {filteredRooms.map((r) => {
                    const isGlobal = r.name === "global";
                    return (
                      <div
                        key={r._id || r.name}
                        className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold flex-shrink-0">
                            {r.isPrivate ? (
                              <LockIcon className="w-4 h-4 text-amber-400" />
                            ) : (
                              <HashIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">
                                #{r.name}
                              </span>
                              {isGlobal && (
                                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded-full font-bold">
                                  Default Community Room
                                </span>
                              )}
                              {r.isPrivate && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-bold">
                                  Private
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {r.description || "Public community room"}
                            </p>
                            <span className="text-[10px] text-slate-500 block mt-1">
                              {r.messageCount ?? 0} messages • Created{" "}
                              {new Date(r.createdAt || Date.now()).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions for this Channel */}
                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleClearRoomMessages(r._id, r.name)}
                            className="px-2.5 py-1 text-[11px] text-slate-300 hover:text-amber-300 bg-white/[0.05] hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                            title={`Clear all messages in #${r.name}`}
                          >
                            <TrashIcon className="w-3 h-3 text-amber-400" />
                            <span>Clear Chat</span>
                          </button>

                          {!isGlobal ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteRoom(r._id, r.name)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1.5"
                              title={`Delete channel #${r.name}`}
                            >
                              <TrashIcon className="w-3 h-3" />
                              <span>Delete Channel</span>
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 text-[10px] text-slate-500 font-medium bg-white/[0.03] border border-white/5 rounded-lg select-none">
                              Protected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANAGE USERS */}
          {tab === "users" && (
            <div className="space-y-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search database users by username..."
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />

              {loading ? (
                <p className="text-center text-slate-400 text-xs py-8">Loading database users...</p>
              ) : (
                <div className="divide-y divide-white/5 bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                  {filteredUsers.map((u) => (
                    <div key={u._id} className="flex items-center justify-between p-3 hover:bg-white/[0.02]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/40 text-indigo-200 flex items-center justify-center text-xs font-bold">
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">
                              @{u.username}
                            </span>
                            {u.isAdmin && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-bold">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Joined: {new Date(u.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {!u.isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u._id, u.username)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <TrashIcon className="w-3 h-3" />
                          <span>Delete User</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MODERATION MESSAGES */}
          {tab === "messages" && (
            <div className="space-y-2">
              {loading ? (
                <p className="text-center text-slate-400 text-xs py-8">Loading messages...</p>
              ) : (
                <div className="space-y-1.5">
                  {messages.map((m) => (
                    <div
                      key={m._id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-300">
                            @{m.senderName}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            in #{m.room} • {new Date(m.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 truncate mt-0.5">
                          {m.content}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(m._id)}
                        className="px-2 py-1 text-[10px] text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors border border-rose-500/20 flex items-center gap-1"
                        title="Delete message"
                      >
                        <TrashIcon className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
