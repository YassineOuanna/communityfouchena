import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker from "emoji-picker-react";

export default function MessageInput({ onSend, onTyping }) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const typingTimeout = useRef(null);
  const inputRef = useRef(null);

  const handleChange = (e) => {
    setText(e.target.value);
    onTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    onTyping(false);
    clearTimeout(typingTimeout.current);
    setShowEmoji(false);
    inputRef.current?.focus();
  }, [text, onSend, onTyping]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="relative px-3 sm:px-4 py-2.5 bg-slate-900/30 border-t border-white/10 backdrop-blur-md safe-pb">
      {/* Floating Emoji Picker */}
      <AnimatePresence>
        {showEmoji && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowEmoji(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-3 right-3 sm:left-4 sm:right-auto mb-2 z-30 shadow-glass rounded-2xl overflow-hidden max-w-[340px] border border-white/15"
            >
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                theme="dark"
                width="100%"
                height={350}
                previewConfig={{ showPreview: false }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 bg-white/[0.04] rounded-2xl px-3 py-1.5 border border-white/10 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 backdrop-blur-xl transition-all">
        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className={`p-1.5 rounded-xl text-slate-400 hover:text-white transition-colors ${
            showEmoji ? "text-indigo-400 bg-indigo-500/10" : "hover:bg-white/[0.06]"
          }`}
          title="Insert Emoji"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
          </svg>
        </button>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 focus:outline-none py-1.5"
        />

        {/* Send Action Button */}
        <motion.button
          type="button"
          onClick={handleSend}
          disabled={!text.trim()}
          whileTap={{ scale: 0.95 }}
          className={`p-2 rounded-xl transition-all duration-150 ${
            text.trim()
              ? "bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-bubble cursor-pointer"
              : "text-slate-600 cursor-not-allowed"
          }`}
          title="Send"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
