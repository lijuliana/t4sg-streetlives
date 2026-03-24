import React from "react";

export interface Message {
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
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
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isOwnMessage ? "flex-end" : "flex-start",
        marginBottom: "12px",
      }}
    >
      {/* Sender label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
          flexDirection: isOwnMessage ? "row-reverse" : "row",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: isNavigator ? "#b89500" : "#6b7280",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          {senderLabel}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "#9ca3af",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          @{senderShort}
        </span>
        {isNavigator && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              backgroundColor: "#f5c800",
              color: "#111",
              borderRadius: "4px",
              padding: "1px 6px",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            NAV
          </span>
        )}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: "70%",
          padding: "10px 14px",
          borderRadius: isOwnMessage
            ? "16px 4px 16px 16px"
            : "4px 16px 16px 16px",
          backgroundColor: isNavigator
            ? "#f5c800"
            : isOwnMessage
            ? "#111"
            : "#f1f5f9",
          color: isNavigator ? "#111" : isOwnMessage ? "#fff" : "#1e293b",
          fontSize: "14px",
          lineHeight: "1.5",
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          wordBreak: "break-word",
        }}
      >
        {message.body}
      </div>

      {/* Timestamp */}
      <span
        style={{
          fontSize: "10px",
          color: "#9ca3af",
          marginTop: "3px",
          fontFamily: "'DM Mono', monospace",
        }}
      >
        {time}
      </span>
    </div>
  );
};

export default ChatMessage;