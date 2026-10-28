import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../utils/api";

export default function AdminModal({ onClose }) {
  const [tab, setTab] = useState("overview"); // "overview" | "users" | "messages"
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState("");

  const fetchStats = async () => {
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch (err) {
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

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (tab === "users") fetchUsers();
    if (tab === "messages") fetchMessages();
  }, [tab]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-slate-900/90 border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-sm shadow-md">
              👑
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                Database Admin Panel
              </h3>
              <p className="text-[11px] text-slate-400">
                CommunityFouchena Cloud Database Control
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 px-6 pt-4 border-b border-white/10 bg-slate-900/40">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              tab === "overview"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📊 Database Stats
          </button>
          <button
            type="button"
            onClick={() => setTab("users")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              tab === "users"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            👥 Manage Users ({stats?.totalUsers ?? "..."})
          </button>
          <button
            type="button"
            onClick={() => setTab("messages")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              tab === "messages"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            💬 Moderation ({stats?.totalMessages ?? "..."})
          </button>
        </div>

        {alert && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex justify-between items-center">
            <span>{alert}</span>
            <button type="button" onClick={() => setAlert("")} className="hover:text-white font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                    Public Channels
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Recent Registered Accounts
                </h4>
                <div className="divide-y divide-white/5 bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                  {stats.recentUsers.map((u) => (
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
                              {u.username}
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
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg transition-colors"
                        >
                          Delete User
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                            {m.senderName}
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
                        className="px-2 py-1 text-[10px] text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors border border-rose-500/20"
                        title="Delete message"
                      >
                        Delete
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
