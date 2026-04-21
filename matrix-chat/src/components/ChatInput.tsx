import React, { useState, KeyboardEvent } from "react";
import styles from "../styles/components/ChatInput.module.css";

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
    <div className={styles.inputContainer}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
        disabled={disabled || sending}
        rows={1}
        className={styles.textarea}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || sending || !value.trim()}
        className={styles.sendButton}
      >
        {sending ? "…" : "Send"}
      </button>
    </div>
  );
};

export default ChatInput;
