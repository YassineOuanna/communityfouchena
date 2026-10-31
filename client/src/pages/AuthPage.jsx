import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import {
  SparklesIcon,
  ShieldAlertIcon,
  LockIcon,
  HashIcon,
  MessageSquareIcon,
  SunIcon,
  MoonIcon,
  PaletteIcon,
} from "../components/Icons";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { login, register, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const res =
      mode === "login"
        ? await login(username, password)
        : await register(username, password, email);
    if (res.success) navigate("/chat");
    else setError(res.message);
  };

  const scrollToAuth = () => {
    const el = document.getElementById("auth-form-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#0c0f1d] text-slate-100 relative overflow-x-hidden select-none">
      {/* Dynamic Ambient Mesh Glow Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -25, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-36 -left-36 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-indigo-600/25 to-purple-600/15 blur-[140px]"
        />
        <motion.div
          animate={{
            x: [0, -40, 0],
            y: [0, 35, 0],
            scale: [1.1, 1, 1.1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-40 -right-40 w-[580px] h-[580px] rounded-full bg-gradient-to-tl from-cyan-500/20 to-blue-600/15 blur-[150px]"
        />
      </div>

      {/* Top Navbar */}
      <header className="relative z-20 w-full border-b border-white/10 bg-slate-900/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-glow border border-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.177 7.152.521 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.75.75 0 00-.636.37l-2.482 4.135a.75.75 0 01-1.316 0l-2.482-4.135a.75.75 0 00-.636-.37 48.901 48.901 0 01-3.476-.384C3.218 16.48 1.848 14.75 1.848 12.8V6.76c0-1.946 1.37-3.678 3.348-3.97z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <span className="font-heading font-extrabold text-base tracking-tight text-white block leading-none">
                CommunityFouchena
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                Secure Real-Time Network
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>Live & Encrypted</span>
            </div>

            {/* Dark Mode Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5"
              title={`Switch Theme (Current: ${theme})`}
              aria-label="Toggle theme appearance"
            >
              {theme === "light" ? (
                <SunIcon className="w-4 h-4 text-amber-400" />
              ) : theme === "oled" ? (
                <MoonIcon className="w-4 h-4 text-indigo-400" />
              ) : theme === "slate" ? (
                <PaletteIcon className="w-4 h-4 text-cyan-400" />
              ) : (
                <MoonIcon className="w-4 h-4 text-purple-400" />
              )}
              <span className="hidden md:inline capitalize font-medium">{theme}</span>
            </button>

            <button
              type="button"
              onClick={scrollToAuth}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-bubble transition-all"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        {/* HERO SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Clear Hero Headline, Explanation, and Main CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="lg:col-span-7 space-y-6"
          >
            {/* Eyebrow Trust Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold backdrop-blur-md">
              <span className="text-cyan-400">✦</span>
              <span>Next-Generation Anonymous Community Chat</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
              Real-time community conversations, built for{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                total privacy.
              </span>
            </h1>

            {/* One-Line Explanation */}
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
              Connect anonymously across dynamic topic rooms, send private direct messages, and moderate with live mute, kick, and blacklist tools — zero phone numbers or tracking required.
            </p>

            {/* Main Hero Call To Action */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={scrollToAuth}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-glow transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2.5 cursor-pointer"
              >
                <span>Enter Live Community</span>
                <span className="text-cyan-200 font-extrabold">&rarr;</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Instant join in under 5 seconds</span>
              </div>
            </div>

            {/* Three Trust Pillars */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/10">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="text-indigo-400 text-sm mb-1 font-bold flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-indigo-400" />
                  <span>Instant WebSocket</span>
                </div>
                <p className="text-[11.5px] text-slate-400 leading-normal">
                  Sub-second live delivery with seen receipts and real-time typing indicators.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="text-cyan-400 text-sm mb-1 font-bold flex items-center gap-1.5">
                  <ShieldAlertIcon className="w-4 h-4 text-cyan-400" />
                  <span>Moderation Controls</span>
                </div>
                <p className="text-[11.5px] text-slate-400 leading-normal">
                  Right-click any user or message for timed mutes, room bans, and instant kicks.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="text-emerald-400 text-sm mb-1 font-bold flex items-center gap-1.5">
                  <LockIcon className="w-4 h-4 text-emerald-400" />
                  <span>Privacy First</span>
                </div>
                <p className="text-[11.5px] text-slate-400 leading-normal">
                  No SMS, no phone verification, and no invasive trackers. You own your identity.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: High-Converting Auth Card */}
          <motion.div
            id="auth-form-section"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-5"
          >
            <div className="w-full glass-surface rounded-3xl p-6 sm:p-8 shadow-glass border border-white/15 relative">
              {/* Card Header */}
              <div className="mb-6">
                <h2 className="font-heading text-xl font-bold text-white tracking-tight">
                  {mode === "login" ? "Welcome back" : "Join the community"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {mode === "login"
                    ? "Enter your credentials to access your channels and DMs."
                    : "Choose any anonymous handle to get started immediately."}
                </p>
              </div>

              {/* Segmented Mode Switcher */}
              <div className="flex rounded-xl glass-pill p-1 mb-5 border border-white/10 relative">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 relative z-10 ${
                    mode === "login" ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {mode === "login" && (
                    <motion.div
                      layoutId="authSegment"
                      className="absolute inset-0 bg-indigo-600/90 rounded-lg shadow-sm border border-indigo-400/30"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 relative z-10 ${
                    mode === "register" ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {mode === "register" && (
                    <motion.div
                      layoutId="authSegment"
                      className="absolute inset-0 bg-indigo-600/90 rounded-lg shadow-sm border border-indigo-400/30"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">Create Account</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 block">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. wanderer, fouchena_coder"
                    required
                    autoCapitalize="none"
                    autoComplete="username"
                    className="w-full bg-white/[0.05] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 block">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="w-full bg-white/[0.05] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                  />
                </div>

                <AnimatePresence>
                  {mode === "register" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 block">
                        Email Address <span className="text-cyan-400 lowercase font-normal">(optional)</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Optional backup email"
                        autoComplete="email"
                        className="w-full bg-white/[0.05] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
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
                      className="text-rose-300 text-xs bg-rose-500/15 rounded-xl px-3.5 py-2.5 border border-rose-500/30 flex items-center gap-2"
                    >
                      <span>⚠️</span>
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all duration-150 shadow-bubble border border-white/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Connecting to network...</span>
                  ) : mode === "login" ? (
                    <span>Sign In to Network &rarr;</span>
                  ) : (
                    <span>Create Account & Join &rarr;</span>
                  )}
                </motion.button>
              </form>

              <div className="mt-5 pt-4 border-t border-white/10 text-center">
                <p className="text-slate-400 text-[11px] leading-relaxed flex items-center justify-center gap-1.5">
                  <LockIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>No phone or identity verification. All accounts enjoy full anonymous freedom.</span>
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* FEATURE SHOWCASE SECTION (Generous Whitespace & Sharp Visual Cards) */}
        <section className="mt-20 lg:mt-28 pt-10 border-t border-white/10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h3 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Engineered for seamless community flow
            </h3>
            <p className="text-slate-400 text-sm mt-2 font-normal">
              Everything you need for engaging group rooms, 1-on-1 direct conversations, and effortless community moderation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-indigo-400/40 hover:-translate-y-1 transition-all duration-200 backdrop-blur-xl group">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-4 border border-indigo-500/30">
                <HashIcon className="w-5 h-5 text-indigo-300" />
              </div>
              <h4 className="font-heading font-bold text-base text-white mb-2 group-hover:text-indigo-300 transition-colors">
                Public & Topic Channels
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Chat in `#global` or create custom topic rooms with descriptions. Users can jump between active discussions instantly.
              </p>
              <div className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1">
                <span>Explore public rooms</span>
                <span>&rarr;</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-cyan-400/40 hover:-translate-y-1 transition-all duration-200 backdrop-blur-xl group">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center mb-4 border border-cyan-500/30">
                <MessageSquareIcon className="w-5 h-5 text-cyan-300" />
              </div>
              <h4 className="font-heading font-bold text-base text-white mb-2 group-hover:text-cyan-300 transition-colors">
                Direct Conversations
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Private peer-to-peer chats with seen avatars, live typing indicators, and instant notification banners when you receive a message.
              </p>
              <div className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1">
                <span>1-on-1 private messaging</span>
                <span>&rarr;</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-purple-400/40 hover:-translate-y-1 transition-all duration-200 backdrop-blur-xl group">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-4 border border-purple-500/30">
                <ShieldAlertIcon className="w-5 h-5 text-purple-300" />
              </div>
              <h4 className="font-heading font-bold text-base text-white mb-2 group-hover:text-purple-300 transition-colors">
                Right-Click Moderation
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Right-click any message or member to apply timed mutes (15m, 1h, 24h, permanent), room kicks, blacklists, or admin password resets.
              </p>
              <div className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1">
                <span>Total community control</span>
                <span>&rarr;</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/10 py-8 px-4 text-center bg-black/20 text-xs text-slate-500">
        <p className="mb-1 text-slate-400">
          CommunityFouchena &copy; {new Date().getFullYear()} &bull; Anonymous Real-Time Platform
        </p>
        <p className="text-[11px] text-slate-500">
          Encrypted WebSockets &bull; HTTPS Security &bull; High-Performance MongoDB Atlas
        </p>
      </footer>
    </div>
  );
}
