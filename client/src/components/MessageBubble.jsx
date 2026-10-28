import React from "react";
import { motion, AnimatePresence } from "framer-motion";

// Helper to generate consistent, vibrant avatar gradient colors based on username
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

export default function MessageBubble({ msg, isOwn, seenBy = [] }) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`flex flex-col mb-3 px-1 ${isOwn ? "items-end" : "items-start"}`}
    >
      {/* Sender Name for incoming messages */}
      {!isOwn && (
        <span className="text-[11px] font-semibold text-slate-300 mb-1 ml-10">
          {msg.senderName}
        </span>
      )}

      {/* Row: Sender Profile Pic & Message Bubble locked at the exact same horizontal level */}
      <div
        className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%] ${
          isOwn ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Sender Profile Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold select-none shadow-sm ${
            isOwn
              ? "bg-gradient-to-tr from-indigo-500 to-cyan-500 text-white border border-white/20"
              : "bg-white/[0.08] border border-white/10 text-slate-200"
          }`}
          title={msg.senderName}
        >
          {msg.senderName?.[0]?.toUpperCase() || "?"}
        </div>

        {/* Message Bubble */}
        <div
          className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed break-words shadow-sm backdrop-blur-md ${
            isOwn
              ? "bg-gradient-to-r from-indigo-600/90 to-indigo-500/90 border border-indigo-400/30 text-white rounded-br-xs shadow-bubble"
              : "bg-white/[0.06] border border-white/10 text-slate-100 rounded-bl-xs"
          }`}
        >
          {msg.content}
        </div>
      </div>

      {/* Timestamp & Seen Receipt Status Bar: Clean horizontal row directly aligned below bubble */}
      <div
        className={`flex items-center gap-1.5 mt-1 select-none ${
          isOwn ? "justify-end mr-10" : "justify-start ml-10"
        }`}
      >
        <span className="text-[10.5px] text-slate-400 font-normal">{time}</span>

        {/* For Own Messages: If seen, show viewer avatar(s); otherwise show delivered checkmark */}
        {isOwn && (
          <>
            {seenBy && seenBy.length > 0 ? (
              <div
                className="flex items-center -space-x-1.5 select-none ml-1"
                title={`Seen by ${seenBy.map((r) => r.username).join(", ")}`}
              >
                <AnimatePresence>
                  {seenBy.slice(0, 5).map((reader) => (
                    <motion.div
                      key={reader.userId || reader.username}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 450, damping: 25 }}
                      className={`w-[18px] h-[18px] rounded-full bg-gradient-to-tr ${getAvatarGradient(
                        reader.username
                      )} ring-2 ring-slate-900 border border-white/20 flex items-center justify-center text-[9px] font-bold text-white shadow-sm cursor-pointer hover:scale-125 hover:z-20 transition-all leading-none`}
                      title={`Seen by ${reader.username}`}
                    >
                      {reader.username?.[0]?.toUpperCase()}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {seenBy.length > 5 && (
                  <div
                    className="w-[18px] h-[18px] rounded-full bg-slate-800 ring-2 ring-slate-900 border border-white/20 flex items-center justify-center text-[8px] font-bold text-slate-300 shadow-sm leading-none"
                    title={`And ${seenBy.length - 5} others`}
                  >
                    +{seenBy.length - 5}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium ml-0.5" title="Delivered">
                ✓
              </span>
            )}
          </>
        )}

        {/* For Incoming Messages: Display other members who also saw this last message */}
        {!isOwn && seenBy && seenBy.length > 0 && (
          <div
            className="flex items-center -space-x-1.5 select-none ml-1"
            title={`Seen by ${seenBy.map((r) => r.username).join(", ")}`}
          >
            <AnimatePresence>
              {seenBy.slice(0, 5).map((reader) => (
                <motion.div
                  key={reader.userId || reader.username}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  className={`w-[18px] h-[18px] rounded-full bg-gradient-to-tr ${getAvatarGradient(
                    reader.username
                  )} ring-2 ring-slate-900 border border-white/20 flex items-center justify-center text-[9px] font-bold text-white shadow-sm cursor-pointer hover:scale-125 hover:z-20 transition-all leading-none`}
                  title={`Seen by ${reader.username}`}
                >
                  {reader.username?.[0]?.toUpperCase()}
                </motion.div>
              ))}
            </AnimatePresence>

            {seenBy.length > 5 && (
              <div
                className="w-[18px] h-[18px] rounded-full bg-slate-800 ring-2 ring-slate-900 border border-white/20 flex items-center justify-center text-[8px] font-bold text-slate-300 shadow-sm leading-none"
                title={`And ${seenBy.length - 5} others`}
              >
                +{seenBy.length - 5}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}