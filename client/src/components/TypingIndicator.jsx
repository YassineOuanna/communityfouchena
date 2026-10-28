import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TypingIndicator({ typers }) {
  if (!typers || typers.length === 0) return null;
  const label = typers.length === 1
    ? `${typers[0]} is typing`
    : `${typers.join(", ")} are typing`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        className="flex items-center gap-2 px-3 py-1 mb-2 w-fit bg-zinc-900/60 rounded-full border border-white/[0.05]"
      >
        <div className="flex items-center gap-1 pl-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-zinc-400"
              animate={{ y: [0, -3, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
            />
          ))}
        </div>
        <span className="text-[11px] text-zinc-400 pr-1">{label}</span>
      </motion.div>
    </AnimatePresence>
  );
}
