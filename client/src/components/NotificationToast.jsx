import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Synthesizes a gentle, premium notification chime using the Web Audio API.
 * No external asset files needed, 100% reliable across browsers.
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Pleasant two-tone musical chime: E5 (659Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.42);
  } catch (err) {
    // Non-blocking fallback if browser blocks auto-audio
  }
}

function ToastItem({ notification, onDismiss, onOpen }) {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = 5000; // 5 seconds auto-dismiss
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const step = 50; // update every 50ms
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - (step / duration) * 100;
        if (next <= 0) {
          clearInterval(intervalRef.current);
          onDismiss(notification.id);
          return 0;
        }
        return next;
      });
    }, step);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, notification.id, onDismiss]);

  const isChannel = notification.type === "channel";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={() => onOpen(notification)}
      className="group relative w-84 sm:w-96 rounded-2xl glass-surface border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.55)] p-3.5 cursor-pointer backdrop-blur-2xl hover:border-indigo-400/40 hover:shadow-[0_16px_48px_rgba(99,102,241,0.25)] transition-all overflow-hidden select-none"
    >
      {/* Ambient Glow */}
      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none group-hover:bg-indigo-500/25 transition-all" />

      <div className="flex items-start gap-3 relative z-10">
        {/* Avatar / Icon */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-cyan-400 p-[1.5px] shadow-sm">
            <div className="w-full h-full rounded-[10px] bg-slate-900 flex items-center justify-center text-white text-xs font-bold uppercase overflow-hidden">
              {notification.avatar ? (
                <img src={notification.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                notification.senderName?.[0] || "?"
              )}
            </div>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 shadow-sm" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-white truncate">
                {notification.senderName || "Someone"}
              </span>

              {/* Room / DM Tag Badge */}
              {isChannel ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 truncate flex items-center gap-0.5">
                  <span className="text-indigo-400 font-bold">#</span>
                  {notification.room}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 truncate flex items-center gap-1">
                  <span>💬</span> DM
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">Just now</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(notification.id);
                }}
                className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Message snippet */}
          <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
            {notification.content ||
              (notification.attachment ? `📎 Sent an attachment (${notification.attachment.fileType || "file"})` : "New message")}
          </p>

          <div className="mt-1 flex items-center justify-between text-[10px] text-indigo-300 group-hover:text-indigo-200">
            <span className="flex items-center gap-1 font-medium">
              Click to reply & view
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 transition-transform group-hover:translate-x-0.5">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* Auto-Dismiss Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.06] overflow-hidden">
        <motion.div
          className={`h-full ${isChannel ? "bg-gradient-to-r from-indigo-500 to-cyan-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
          style={{ width: `${progress}%` }}
          transition={{ ease: "linear", duration: 0.05 }}
        />
      </div>
    </motion.div>
  );
}

export default function NotificationToastContainer({ notifications = [], onDismiss, onOpen }) {
  if (!notifications.length) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col items-end gap-2.5 pointer-events-none max-w-full px-4 sm:px-0">
      <AnimatePresence mode="popLayout">
        {notifications.map((notif) => (
          <div key={notif.id} className="pointer-events-auto">
            <ToastItem notification={notif} onDismiss={onDismiss} onOpen={onOpen} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
