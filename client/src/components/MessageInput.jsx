import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import { useTheme } from "../context/ThemeContext";

export default function MessageInput({
  onSend,
  onTyping,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}) {
  const { isDark } = useTheme();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const typingTimeout = useRef(null);

  // Populate text if editing
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || "");
      if (textareaRef.current) {
        textareaRef.current.focus();
        adjustHeight();
      }
    }
  }, [editingMessage]);

  // Adjust textarea height dynamically as user types
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 140);
    el.style.height = `${nextHeight}px`;
  };

  const handleChange = (e) => {
    setText(e.target.value);
    adjustHeight();
    onTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && !attachmentPreview) return;

    if (editingMessage && onSaveEdit) {
      onSaveEdit(editingMessage._id, trimmed);
    } else {
      onSend({
        content: trimmed,
        attachment: attachmentPreview,
      });
    }

    setText("");
    setAttachmentPreview(null);
    onTyping(false);
    clearTimeout(typingTimeout.current);
    setShowEmoji(false);
    setShowAttachMenu(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  }, [text, attachmentPreview, editingMessage, onSaveEdit, onSend, onTyping]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
    adjustHeight();
    textareaRef.current?.focus();
  };

  // Image Upload Handler
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachmentPreview({
        url: event.target.result,
        fileType: "image",
        fileName: file.name,
        fileSize: file.size,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // File Upload Handler
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachmentPreview({
        url: event.target.result,
        fileType: "file",
        fileName: file.name,
        fileSize: file.size,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Voice recording is not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentPreview({
            url: reader.result,
            fileType: "audio",
            fileName: "voice-message.webm",
            fileSize: audioBlob.size,
            duration: recordingSeconds,
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      setShowAttachMenu(false);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone permission denied or unavailable.");
    }
  };

  const stopRecording = (cancel = false) => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    if (cancel) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    } else {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="relative px-3 sm:px-4 py-2.5 bg-slate-900/40 border-t border-white/10 backdrop-blur-xl safe-pb select-none">
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Floating Emoji Picker */}
      <AnimatePresence>
        {showEmoji && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowEmoji(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-3 right-3 sm:left-4 sm:right-auto mb-2 z-40 shadow-2xl rounded-2xl overflow-hidden max-w-[340px] border border-white/15"
            >
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                theme={isDark ? "dark" : "light"}
                width="100%"
                height={340}
                previewConfig={{ showPreview: false }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold">Replying to @{replyingTo.senderName}:</span>
            <span className="truncate opacity-80">{replyingTo.content}</span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-indigo-300 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <span className="font-bold">Editing message:</span>
            <span className="truncate max-w-[200px]">{editingMessage.content}</span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-amber-300 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Attachment Preview Chip */}
      {attachmentPreview && (
        <div className="mb-2 p-2 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {attachmentPreview.fileType === "image" ? (
              <img
                src={attachmentPreview.url}
                alt="Preview"
                className="w-10 h-10 rounded-lg object-cover border border-white/20"
              />
            ) : attachmentPreview.fileType === "audio" ? (
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                🎙️
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                📎
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-main)] truncate">
                {attachmentPreview.fileName}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {attachmentPreview.duration
                  ? `${attachmentPreview.duration}s voice note`
                  : `${(attachmentPreview.fileSize / 1024).toFixed(1)} KB`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachmentPreview(null)}
            className="w-6 h-6 rounded-full bg-white/10 hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Voice Recording Active Bar */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/30 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-bold text-rose-300">Recording Voice Note...</span>
            <span className="text-xs font-mono text-white bg-black/30 px-2 py-0.5 rounded-md">
              {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
            >
              Attach Audio
            </button>
          </div>
        </div>
      ) : (
        /* Standard Message Input Box */
        <div className="flex items-end gap-2 bg-white/[0.04] rounded-2xl px-3 py-2 border border-white/10 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 backdrop-blur-xl transition-all">
          {/* Attach Menu Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/10 transition-colors"
              title="Attach File, Image, or Voice Note"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>

            {/* Attach Popup Menu */}
            <AnimatePresence>
              {showAttachMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowAttachMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 z-40 w-44 rounded-2xl bg-slate-900 border border-white/15 shadow-2xl p-1.5 space-y-0.5 text-xs select-none"
                  >
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white hover:bg-white/10 transition-colors"
                    >
                      <span>🖼️</span>
                      <span>Send Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white hover:bg-white/10 transition-colors"
                    >
                      <span>📎</span>
                      <span>Attach File</span>
                    </button>
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                    >
                      <span>🎙️</span>
                      <span>Record Voice Note</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Emoji Picker Button */}
          <button
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className={`p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors ${
              showEmoji ? "text-indigo-400 bg-indigo-500/10" : "hover:bg-white/[0.06]"
            }`}
            title="Insert Emoji"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
            </svg>
          </button>

          {/* Auto-growing Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 bg-transparent text-[var(--text-main)] text-sm placeholder-[var(--text-muted)] focus:outline-none py-1.5 max-h-36 resize-none leading-relaxed"
          />

          {/* Send Button */}
          <motion.button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() && !attachmentPreview}
            whileTap={{ scale: 0.95 }}
            className={`p-2.5 rounded-xl transition-all duration-150 flex-shrink-0 ${
              text.trim() || attachmentPreview
                ? "bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-bubble cursor-pointer hover:brightness-110"
                : "text-[var(--text-muted)] cursor-not-allowed opacity-40"
            }`}
            title="Send Message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </motion.button>
        </div>
      )}
    </div>
  );
}
