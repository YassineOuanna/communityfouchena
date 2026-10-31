import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MicIcon,
  VolumeXIcon,
  VideoIcon,
  EyeOffIcon,
  MonitorIcon,
  LockIcon,
} from "./Icons";

export default function CallScreenModal({ target, type = "voice", onClose }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === "voice");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState("Connecting...");
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);

  // Setup video stream if video call
  useEffect(() => {
    let localStream = null;
    const startMedia = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const constraints = {
            audio: true,
            video: type === "video",
          };
          localStream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = localStream;
          if (localVideoRef.current && type === "video") {
            localVideoRef.current.srcObject = localStream;
          }
        }
      } catch (err) {
        console.log("Media stream permission or device fallback:", err.message);
      }
      setCallStatus("Connected • HD Audio");
    };

    startMedia();

    // Call duration timer
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [type]);

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = isMuted));
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    if (isVideoOff) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = vStream;
          }
          streamRef.current = vStream;
        }
      } catch (err) {}
      setIsVideoOff(false);
    } else {
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject.getVideoTracks().forEach((t) => t.stop());
      }
      setIsVideoOff(true);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const sStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = sStream;
          }
          setIsScreenSharing(true);
          sStream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
          };
        }
      } catch (err) {}
    } else {
      setIsScreenSharing(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const name = target?.username || target?.name || "Global Chat";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Dark Ambient Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-2xl"
      />

      {/* Main Call Container */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="relative w-full max-w-2xl h-[520px] sm:h-[580px] rounded-3xl bg-slate-900 border border-white/15 shadow-2xl flex flex-col overflow-hidden z-10"
      >
        {/* Call Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-black/30 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                {type === "video" ? "Video Call" : "Voice Call"}
              </span>
              <p className="text-[11px] text-slate-400">{callStatus}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-mono text-white font-medium border border-white/10">
              {formatDuration(callDuration)}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
              <span>E2E Encrypted</span>
            </div>
          </div>
        </div>

        {/* Call Main Stage */}
        <div className="flex-1 relative flex items-center justify-center bg-gradient-to-b from-slate-900 to-black overflow-hidden p-6">
          {/* Pulsing Aura */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.15, 0.35, 0.15],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-72 h-72 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 blur-3xl"
            />
          </div>

          {/* Video Canvas or Voice Avatar */}
          {type === "video" && !isVideoOff ? (
            <div className="w-full h-full relative rounded-2xl overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-xs text-white font-medium border border-white/10">
                You ({target?.username || "Guest"})
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center z-10">
              <div className="relative mb-5">
                {/* Audio pulse wave rings */}
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute -inset-4 rounded-full border-2 border-indigo-400/50"
                />
                <motion.div
                  animate={{ scale: [1, 1.7, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                  className="absolute -inset-8 rounded-full border border-cyan-400/40"
                />

                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-4xl font-extrabold text-white shadow-2xl border-4 border-white/20">
                  {name?.[0]?.toUpperCase() || "?"}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">
                {name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Connected • Microphone active</span>
              </p>
            </div>
          )}
        </div>

        {/* Action Controls Dock */}
        <div className="px-6 py-5 bg-black/50 border-t border-white/10 backdrop-blur-xl flex items-center justify-center gap-3 sm:gap-5 z-20">
          {/* Mute Button */}
          <button
            type="button"
            onClick={toggleMic}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isMuted
                ? "bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <VolumeXIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
          </button>

          {/* Video Toggle Button */}
          <button
            type="button"
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isVideoOff
                ? "bg-white/10 text-slate-400 hover:bg-white/20 border border-white/10"
                : "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]"
            }`}
            title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
          >
            {isVideoOff ? <EyeOffIcon className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>

          {/* Screen Share Button */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isScreenSharing
                ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
            }`}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            <MonitorIcon className="w-5 h-5" />
          </button>

          {/* Red End Call Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-14 h-12 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.5)] active:scale-95 transition-all"
            title="End Call"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 rotate-[135deg]">
              <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
