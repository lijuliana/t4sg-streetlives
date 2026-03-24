import React, { useState, KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled = false }) => {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setValue("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "flex-end",
        padding: "16px 20px",
        borderTop: "1px solid #2a2a2a",
        background: "#111",
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
        disabled={disabled || sending}
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          border: "1.5px solid #2a2a2a",
          borderRadius: "12px",
          padding: "10px 14px",
          fontSize: "14px",
          fontFamily: "'DM Sans', sans-serif",
          outline: "none",
          lineHeight: "1.5",
          transition: "border-color 0.15s",
          color: "#fff",
          backgroundColor: disabled ? "#1a1a1a" : "#1e1e1e",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#f5c800")}
        onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
      />
      <button
        onClick={handleSend}
        disabled={disabled || sending || !value.trim()}
        style={{
          flexShrink: 0,
          padding: "10px 20px",
          borderRadius: "12px",
          border: "none",
          background:
            disabled || sending || !value.trim() ? "#2a2a2a" : "#f5c800",
          color: disabled || sending || !value.trim() ? "#555" : "#111",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
          cursor:
            disabled || sending || !value.trim() ? "not-allowed" : "pointer",
          transition: "background 0.15s, color 0.15s",
          height: "42px",
        }}
      >
        {sending ? "…" : "Send"}
      </button>
    </div>
  );
};

export default ChatInput;