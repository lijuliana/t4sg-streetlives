import React from "react";
import styles from "../styles/components/ChatMessage.module.css";

export interface Message {
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
  pending?: boolean;
}

interface ChatMessageProps {
  message: Message;
  isNavigator: boolean;
  isOwnMessage: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isNavigator,
  isOwnMessage,
}) => {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const senderLabel = isNavigator ? "Navigator" : "User";
  const senderShort = message.sender.split(":")[0].replace("@", "");

  return (
    <div
      className={styles.messageWrapper}
      data-own={String(isOwnMessage)}
      data-pending={String(!!message.pending)}
    >
      {/* Sender label row */}
      <div
        className={styles.senderRow}
        data-own={String(isOwnMessage)}
      >
        <span
          className={styles.senderLabel}
          data-navigator={String(isNavigator)}
        >
          {senderLabel}
        </span>
        <span className={styles.senderHandle}>@{senderShort}</span>
        {isNavigator && (
          <span className={styles.navBadge}>NAV</span>
        )}
      </div>

      {/* Bubble */}
      <div
        className={styles.bubble}
        data-own={String(isOwnMessage)}
        data-navigator={String(isNavigator)}
      >
        {message.body}
      </div>

      {/* Timestamp */}
      <span className={styles.timestamp}>
        {message.pending ? "Sending…" : time}
      </span>
    </div>
  );
};

export default ChatMessage;
