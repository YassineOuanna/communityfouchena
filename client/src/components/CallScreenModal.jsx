import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../context/SocketContext";
import {
  MicIcon,
  VolumeXIcon,
  VideoIcon,
  EyeOffIcon,
  MonitorIcon,
  PhoneCallIcon,
  XIcon,
} from "./Icons";

// Free public STUN servers for WebRTC peer-to-peer connection
const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

// Web Audio API Outgoing Dial / Ringing Tone
function createOutgoingDialTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return () => {};
    const ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();

    let isRunning = true;
    const playRingBurst = () => {
      if (!isRunning) return;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, now); // Standard 440 Hz
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(480, now); // Standard 480 Hz

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.05);
      gain.gain.setValueAtTime(0.07, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.35);
      osc2.stop(now + 1.35);
    };

    playRingBurst();
    const interval = setInterval(playRingBurst, 3500);

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

export default function CallScreenModal({
  target,
  type = "voice",
  isCaller = true,
  incomingOffer = null,
  onClose,
}) {
  const { socket } = useSocket();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === "voice");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState(
    isCaller ? "Calling..." : "Connecting..."
  );
  const [permissionError, setPermissionError] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const stopDialToneRef = useRef(null);
  const candidateQueueRef = useRef([]);

  const targetName = target?.username || target?.name || "Global Chat";
  const targetId = target?.userId || target?.id || target?._id;

  // Format MM:SS duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    let isMounted = true;

    // Start outgoing dial tone if caller
    if (isCaller) {
      stopDialToneRef.current = createOutgoingDialTone();
    }

    // Call duration timer once connected
    let timerInterval = null;

    const setupWebRTC = async () => {
      try {
        // 1. Request Local Media Stream
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === "video",
          });
        } catch (mediaErr) {
          // If video failed (e.g. no camera attached), fallback to audio only
          if (type === "video") {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
              });
              setIsVideoOff(true);
            } catch (audioErr) {
              setPermissionError("Microphone access is required to place or receive calls.");
              setCallStatus("Permission denied");
              return;
            }
          } else {
            setPermissionError("Microphone access is required to place or receive calls.");
            setCallStatus("Permission denied");
            return;
          }
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && type === "video") {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Initialize RTCPeerConnection
        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Send ICE candidates to remote peer
        pc.onicecandidate = (event) => {
          if (event.candidate && socket && targetId) {
            socket.emit("ice_candidate", {
              toUserId: targetId,
              candidate: event.candidate,
            });
          }
        };

        // Receive remote stream
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            const remoteStream = event.streams[0];
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
            }

            if (stopDialToneRef.current) {
              stopDialToneRef.current();
              stopDialToneRef.current = null;
            }

            setIsConnected(true);
            setCallStatus("Connected • HD Audio");

            if (!timerInterval) {
              timerInterval = setInterval(() => {
                setCallDuration((prev) => prev + 1);
              }, 1000);
            }
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            if (stopDialToneRef.current) {
              stopDialToneRef.current();
              stopDialToneRef.current = null;
            }
            setIsConnected(true);
            setCallStatus("Connected • HD Audio");
          } else if (
            pc.connectionState === "disconnected" ||
            pc.connectionState === "failed"
          ) {
            setCallStatus("Call disconnected");
          }
        };

        // 3. Caller vs Answerer Flow
        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket?.emit("call_user", {
            toUserId: targetId,
            toUsername: targetName,
            room: target?.room,
            type,
            offer,
          });
        } else if (incomingOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));

          // Drain queued ICE candidates
          while (candidateQueueRef.current.length > 0) {
            const cand = candidateQueueRef.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {}
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket?.emit("call_answer", {
            toUserId: targetId,
            answer,
          });
        }
      } catch (err) {
        console.error("WebRTC initialization error:", err);
        setCallStatus("Connection failed");
      }
    };

    setupWebRTC();

    // 4. Socket Listeners for Real-Time Call Signaling
    if (socket) {
      const handleCallAnswered = async ({ answer }) => {
        if (stopDialToneRef.current) {
          stopDialToneRef.current();
          stopDialToneRef.current = null;
        }

        if (pcRef.current && answer) {
          try {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
            // Drain queued ICE candidates
            while (candidateQueueRef.current.length > 0) {
              const cand = candidateQueueRef.current.shift();
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
              } catch {}
            }
          } catch (e) {
            console.error("Error setting remote description:", e);
          }
        }
      };

      const handleIceCandidate = async ({ candidate }) => {
        if (!candidate) return;
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("Error adding ICE candidate:", e);
          }
        } else {
          candidateQueueRef.current.push(candidate);
        }
      };

      const handleCallStatus = ({ action, reason, message }) => {
        if (stopDialToneRef.current) {
          stopDialToneRef.current();
          stopDialToneRef.current = null;
        }

        if (action === "declined") {
          setCallStatus("Call Declined");
          setTimeout(() => {
            if (isMounted) onClose();
          }, 1500);
        } else if (action === "offline") {
          setCallStatus(message || "User is currently offline");
          setTimeout(() => {
            if (isMounted) onClose();
          }, 2000);
        }
      };

      const handleCallEnded = () => {
        if (stopDialToneRef.current) {
          stopDialToneRef.current();
          stopDialToneRef.current = null;
        }
        setCallStatus("Call Ended");
        setTimeout(() => {
          if (isMounted) onClose();
        }, 1000);
      };

      socket.on("call_answered", handleCallAnswered);
      socket.on("ice_candidate", handleIceCandidate);
      socket.on("call_status", handleCallStatus);
      socket.on("call_ended", handleCallEnded);

      return () => {
        isMounted = false;
        clearInterval(timerInterval);

        if (stopDialToneRef.current) {
          stopDialToneRef.current();
          stopDialToneRef.current = null;
        }

        socket.off("call_answered", handleCallAnswered);
        socket.off("ice_candidate", handleIceCandidate);
        socket.off("call_status", handleCallStatus);
        socket.off("call_ended", handleCallEnded);

        // Notify other peer that call ended
        socket.emit("end_call", { toUserId: targetId, room: target?.room });

        // Clean up streams & peer connection
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
      };
    }

    return () => {
      isMounted = false;
      clearInterval(timerInterval);
      if (stopDialToneRef.current) {
        stopDialToneRef.current();
        stopDialToneRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [socket, targetId, targetName, type, isCaller, incomingOffer, onClose]);

  // Toggle Microphone Mute
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = isMuted; // Toggle enabled state
      });
    }
    setIsMuted(!isMuted);
  };

  // Toggle Local Camera
  const toggleVideo = async () => {
    if (isVideoOff) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const vStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          const newVideoTrack = vStream.getVideoTracks()[0];

          if (localStreamRef.current) {
            localStreamRef.current.addTrack(newVideoTrack);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          if (pcRef.current) {
            const sender = pcRef.current
              .getSenders()
              .find((s) => s.track && s.track.kind === "video");
            if (sender) {
              sender.replaceTrack(newVideoTrack);
            } else {
              pcRef.current.addTrack(newVideoTrack, localStreamRef.current);
            }
          }
        }
      } catch (err) {}
      setIsVideoOff(false);
    } else {
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((t) => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      setIsVideoOff(true);
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
          });
          const screenTrack = displayStream.getVideoTracks()[0];

          if (pcRef.current) {
            const sender = pcRef.current
              .getSenders()
              .find((s) => s.track && s.track.kind === "video");
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          }

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = displayStream;
          }

          setIsScreenSharing(true);
          screenTrack.onended = () => {
            setIsScreenSharing(false);
            if (localStreamRef.current && localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              if (videoTrack && pcRef.current) {
                const sender = pcRef.current
                  .getSenders()
                  .find((s) => s.track && s.track.kind === "video");
                if (sender) sender.replaceTrack(videoTrack);
              }
            }
          };
        }
      } catch (err) {}
    } else {
      setIsScreenSharing(false);
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack && pcRef.current) {
          const sender = pcRef.current
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(videoTrack);
        }
      }
    }
  };

  // Hang Up Call
  const handleHangUp = () => {
    if (stopDialToneRef.current) {
      stopDialToneRef.current();
      stopDialToneRef.current = null;
    }
    socket?.emit("end_call", { toUserId: targetId, room: target?.room });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none">
      {/* Hidden Audio element for remote audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Dark Ambient Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleHangUp}
        className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl"
      />

      {/* Main Call Container */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="relative w-full max-w-3xl h-[540px] sm:h-[620px] rounded-3xl bg-slate-900 border border-white/15 shadow-2xl flex flex-col overflow-hidden z-10"
      >
        {/* Call Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-ping"
              }`}
            />
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {type === "video" ? "HD Video Call" : "Voice Call"}
              </span>
              <p className="text-[11px] text-slate-400 font-medium">{callStatus}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <div className="px-3 py-1 rounded-full bg-white/10 text-xs font-mono text-white font-semibold border border-white/10">
                {formatDuration(callDuration)}
              </div>
            )}
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Peer-to-Peer Encrypted</span>
            </div>
          </div>
        </div>

        {/* Permission Error Notice */}
        {permissionError && (
          <div className="bg-rose-500/20 border-b border-rose-500/30 px-4 py-2 text-xs text-rose-300 text-center font-medium">
            {permissionError}
          </div>
        )}

        {/* Call Stage (Remote Stream + Local PIP) */}
        <div className="flex-1 relative flex items-center justify-center bg-gradient-to-b from-slate-900 to-black overflow-hidden p-4 sm:p-6">
          {/* Ambient Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.12, 0.3, 0.12],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-80 h-80 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 blur-3xl"
            />
          </div>

          {/* Remote Video Stream (if video call and connected) */}
          {type === "video" && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover rounded-2xl border border-white/10 ${
                isConnected ? "block" : "hidden"
              }`}
            />
          )}

          {/* Voice Call Avatar or Ringing State */}
          {(!isConnected || type === "voice") && (
            <div className="flex flex-col items-center justify-center text-center z-10">
              <div className="relative mb-5">
                {/* Audio pulse wave rings */}
                <motion.div
                  animate={{ scale: [1, 1.45, 1], opacity: [0.35, 0, 0.35] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                  className="absolute -inset-4 rounded-full border-2 border-indigo-400/50"
                />
                <motion.div
                  animate={{ scale: [1, 1.8, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                  className="absolute -inset-8 rounded-full border border-cyan-400/40"
                />

                <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center text-4xl font-extrabold text-white shadow-2xl border-4 border-white/20">
                  {targetName?.[0]?.toUpperCase() || "?"}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white tracking-tight drop-shadow-sm">
                @{targetName}
              </h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span>
                  {isConnected
                    ? "Live connected • Microphone active"
                    : isCaller
                    ? "Ringing remote device..."
                    : "Connecting to remote peer..."}
                </span>
              </p>
            </div>
          )}

          {/* Local Camera Picture-in-Picture (PIP) Window */}
          {type === "video" && !isVideoOff && (
            <motion.div
              drag
              dragConstraints={{ top: -180, bottom: 20, left: -260, right: 20 }}
              className="absolute bottom-4 right-4 z-20 w-32 h-24 sm:w-44 sm:h-32 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-950 backdrop-blur-md cursor-grab active:cursor-grabbing"
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute bottom-1 left-2 text-[10px] text-white/90 font-medium bg-black/60 px-1.5 py-0.2 rounded">
                You
              </div>
            </motion.div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="px-6 py-5 bg-black/60 border-t border-white/10 backdrop-blur-xl flex items-center justify-center gap-3 sm:gap-5 z-20">
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
            onClick={handleHangUp}
            className="w-14 h-12 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.5)] active:scale-95 transition-all"
            title="End Call"
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
        </div>
      </motion.div>
    </div>
  );
}
