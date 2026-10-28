import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const res = mode === "login"
      ? await login(username, password)
      : await register(username, password, email);
    if (res.success) navigate("/chat");
    else setError(res.message);
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#0c0f1d] px-4 py-8 relative overflow-hidden select-none">
      {/* Ambient Mesh Glow Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -25, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-indigo-600/30 to-purple-600/20 blur-[130px]"
        />

        <motion.div
          animate={{
            x: [0, -35, 0],
            y: [0, 30, 0],
            scale: [1.1, 1, 1.1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-32 -right-32 w-[520px] h-[520px] rounded-full bg-gradient-to-tl from-cyan-500/25 to-blue-600/20 blur-[140px]"
        />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px] z-10"
      >
        {/* Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl glass-surface border border-white/15 shadow-glow mb-3.5 text-indigo-400 p-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
              <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.177 7.152.521 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.75.75 0 00-.636.37l-2.482 4.135a.75.75 0 01-1.316 0l-2.482-4.135a.75.75 0 00-.636-.37 48.901 48.901 0 01-3.476-.384C3.218 16.48 1.848 14.75 1.848 12.8V6.76c0-1.946 1.37-3.678 3.348-3.97z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
            CommunityFouchena
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 font-normal">
            Real-time live anonymous network
          </p>
        </div>

        {/* Frosted Glass Card */}
        <div className="glass-surface rounded-3xl p-6 sm:p-8 shadow-glass">
          {/* Segmented Controls */}
          <div className="flex rounded-xl glass-pill p-1 mb-6 border border-white/10 relative">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 relative z-10 ${
                mode === "login" ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {mode === "login" && (
                <motion.div
                  layoutId="authSegmentPill"
                  className="absolute inset-0 bg-indigo-600/80 rounded-lg shadow-sm border border-indigo-400/30"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10">Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 relative z-10 ${
                mode === "register" ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {mode === "register" && (
                <motion.div
                  layoutId="authSegmentPill"
                  className="absolute inset-0 bg-indigo-600/80 rounded-lg shadow-sm border border-indigo-400/30"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10">Create Account</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-slate-300 uppercase tracking-wide mb-1.5 block">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Pick an anonymous handle..."
                required
                autoCapitalize="none"
                autoComplete="username"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 backdrop-blur-md transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 uppercase tracking-wide mb-1.5 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 backdrop-blur-md transition-all"
              />
            </div>

            <AnimatePresence>
              {mode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="text-[11px] font-medium text-slate-300 uppercase tracking-wide mb-1.5 block">
                    Email Address <span className="text-cyan-400 lowercase font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 backdrop-blur-md transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-rose-300 text-xs bg-rose-500/10 rounded-xl px-3 py-2 border border-rose-500/20"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.99 }}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all duration-150 shadow-bubble border border-white/20 disabled:opacity-50"
            >
              {loading ? (
                <span>Connecting...</span>
              ) : mode === "login" ? (
                <span>Enter Live Network</span>
              ) : (
                <span>Register & Join</span>
              )}
            </motion.button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            <p className="text-slate-400 text-[11px]">
              No verification needed. Pick any handle and chat instantly.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
