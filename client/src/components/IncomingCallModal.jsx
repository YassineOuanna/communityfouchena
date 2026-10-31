import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { PhoneCallIcon, VideoIcon, XIcon } from "./Icons";

// Color gradient generator based on name
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

// Synthesizes a melodic incoming phone call ringtone using the Web Audio API
function startIncomingRingtone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return () => {};
    const ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();

    let isRunning = true;
    const playRingSequence = () => {
      if (!isRunning) return;
      const now = ctx.currentTime;

      // Note 1: 523.25 Hz (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: 659.25 Hz (E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      gain2.gain.setValueAtTime(0.001, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.18, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);

      // Note 3: 783.99 Hz (G5)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(783.99, now + 0.3);
      gain3.gain.setValueAtTime(0.001, now + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.22, now + 0.35);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.3);
      osc3.stop(now + 0.9);
    };

    playRingSequence();
    const interval = setInterval(playRingSequence, 2400);

    return () => {
      isRunning = false;
      clearInterval(interval);
      try {
        ctx.close();
      } catch {}
    };
  } catch (err) {
    return () => {};
  }
}

export default function IncomingCallModal({ call, onAccept, onDecline }) {
  const callerName = call?.fromUsername || "Community Member";
  const callType = call?.type === "video" ? "Video" : "Voice";

  const stopRingtoneRef = useRef(null);

  useEffect(() => {
    stopRingtoneRef.current = startIncomingRingtone();
    return () => {
      if (stopRingtoneRef.current) {
        stopRingtoneRef.current();
        stopRingtoneRef.current = null;
      }
    };
  }, []);

  const handleAccept = () => {
    if (stopRingtoneRef.current) {
      stopRingtoneRef.current();
      stopRingtoneRef.current = null;
    }
    onAccept();
  };

  const handleDecline = () => {
    if (stopRingtoneRef.current) {
      stopRingtoneRef.current();
      stopRingtoneRef.current = null;
    }
    onDecline();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      {/* Dark Ambient Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleDecline}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
      />

      {/* Incoming Call Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-white/20 p-6 sm:p-7 shadow-[0_0_50px_rgba(99,102,241,0.35)] flex flex-col items-center text-center overflow-hidden z-10"
      >
        {/* Glowing Background Radial */}
        <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-indigo-500/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-cyan-500/30 blur-3xl pointer-events-none" />

        {/* Pulsing Avatar */}
        <div className="relative mb-5 mt-2">
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            className="absolute -inset-3 rounded-full border-2 border-emerald-400/50"
          />
          <motion.div
            animate={{ scale: [1, 1.7, 1], opacity: [0.25, 0, 0.25] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            className="absolute -inset-6 rounded-full border border-cyan-400/40"
          />

          <div
            className={`w-24 h-24 rounded-full bg-gradient-to-tr ${getAvatarGradient(
              callerName
            )} flex items-center justify-center text-3xl font-extrabold text-white shadow-2xl border-4 border-white/20`}
          >
            {callerName?.[0]?.toUpperCase() || "?"}
          </div>
        </div>

        <h3 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">
          @{callerName}
        </h3>
        <p className="text-xs font-semibold text-cyan-300 mt-1 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Incoming {callType} Call...</span>
        </p>

        {/* Action Controls */}
        <div className="flex items-center gap-8 mt-8 w-full justify-center">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleDecline}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.5)] active:scale-95 transition-all"
              title="Decline Call"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 rotate-[135deg]"
              >
                <path
                  fillRule="evenodd"
                  d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <span className="text-[11px] font-medium text-slate-400">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleAccept}
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.6)] active:scale-95 transition-all animate-bounce"
              title="Accept Call"
            >
              {call?.type === "video" ? (
                <VideoIcon className="w-6 h-6" />
              ) : (
                <PhoneCallIcon className="w-6 h-6" />
              )}
            </button>
            <span className="text-[11px] font-medium text-emerald-400">Accept</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
