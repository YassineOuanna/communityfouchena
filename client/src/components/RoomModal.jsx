import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../utils/api";

export default function RoomModal({ onClose, onRoomCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await api.post("/rooms", { name, description, isPrivate, password });
      onRoomCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create channel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-surface rounded-3xl p-6 sm:p-7 w-full max-w-sm sm:max-w-md shadow-glass border border-white/15"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              #
            </div>
            <h2 className="text-base font-bold text-white">
              Create New Room
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-slate-300 uppercase tracking-wide mb-1.5 block">
              Room Handle / Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="e.g. night-talks"
              required
              maxLength={30}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 backdrop-blur-md transition-all"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-300 uppercase tracking-wide mb-1.5 block">
              Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this room about?"
              maxLength={80}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 backdrop-blur-md transition-all"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center justify-between cursor-pointer py-1 select-none">
              <div>
                <p className="text-xs font-semibold text-slate-200">Password Protection</p>
                <p className="text-[11px] text-slate-400">Lock this room with a passcode</p>
              </div>
              <div
                onClick={() => setIsPrivate(!isPrivate)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  isPrivate ? "bg-indigo-500" : "bg-white/15"
                } relative p-0.5 border border-white/10`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    isPrivate ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </label>
          </div>

          <AnimatePresence>
            {isPrivate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="text-[11px] font-medium text-slate-300 uppercase tracking-wide mb-1.5 block">
                  Room Passcode
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set secret passcode"
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 backdrop-blur-md transition-all"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className="text-rose-400 text-xs py-1">{error}</p>}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-bubble hover:opacity-95 transition-all disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Room"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
