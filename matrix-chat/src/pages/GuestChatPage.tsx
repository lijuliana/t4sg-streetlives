import React, { useEffect, useRef, useState } from "react";
import ChatMessage from "../components/ChatMessage";
import type { Message as ChatMessageShape } from "../components/ChatMessage";
import ChatInput from "../components/ChatInput";
import type { GuestSession } from "../lib/guestSession";

// ── Backend message shape ─────────────────────────────────────────────────────
interface BackendMessage {
  messageId: string;
  sessionId: string;
  sender: "guest" | "service";
  body: string;
  sentAt: string;
}

/** Map a backend message to the shape ChatMessage expects. */
function toDisplayMessage(m: BackendMessage): ChatMessageShape {
  return {
    eventId: m.messageId,
    sender: m.sender,
    body: m.body,
    timestamp: new Date(m.sentAt).getTime(),
  };
}

// ── Poll interval ─────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 3_000;

// ── Component ─────────────────────────────────────────────────────────────────
interface GuestChatPageProps {
  session: GuestSession;
  onError?: (message: string) => void;
}

type UIState = "loading" | "ready" | "error";

const GuestChatPage: React.FC<GuestChatPageProps> = ({ session, onError }) => {
  const { sessionId } = session;
  const [uiState, setUiState] = useState<UIState>("loading");
  const [messages, setMessages] = useState<ChatMessageShape[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set<string>());

  // ── Fetch messages from backend ──────────────────────────────────────────
  const fetchMessages = async (signal?: AbortSignal) => {
    const res = await fetch(`/api/sessions/${sessionId}/messages`, { signal });
    if (!res.ok) throw new Error(`Failed to load messages (${res.status})`);
    const data = (await res.json()) as { messages: BackendMessage[] };

    const newMessages = data.messages
      .filter((m) => !seenIds.current.has(m.messageId))
      .map((m) => {
        seenIds.current.add(m.messageId);
        return toDisplayMessage(m);
      });

    if (newMessages.length > 0) {
      setMessages((prev) => [...prev, ...newMessages]);
    }
  };

  // ── Initial load + polling ───────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController();

    fetchMessages(ac.signal)
      .then(() => {
        if (!ac.signal.aborted) setUiState("ready");
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setUiState("error");
        onError?.(msg);
      });

    const interval = setInterval(() => {
      if (ac.signal.aborted) return;
      fetchMessages(ac.signal).catch((err: unknown) => {
        if (ac.signal.aborted) return;
        console.warn("[GuestChat] Poll error:", err);
      });
    }, POLL_INTERVAL_MS);

    return () => {
      ac.abort();
      clearInterval(interval);
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    setSendError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Send failed (${res.status})`);
      }
      const message = (await res.json()) as BackendMessage;
      const display = toDisplayMessage(message);
      if (!seenIds.current.has(display.eventId)) {
        seenIds.current.add(display.eventId);
        setMessages((prev) => [...prev, display]);
      }
    } catch (err) {
      setSendError("Failed to send message. Please try again.");
      console.error("[GuestChat] Send error:", err);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .chat-messages { scrollbar-width: thin; scrollbar-color: transparent transparent; transition: scrollbar-color 0.3s; }
        .chat-messages:hover { scrollbar-color: rgba(0,0,0,0.18) transparent; }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; transition: background 0.3s; }
        .chat-messages:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "min(1100px, 92vw)",
          height: "92vh",
          borderRadius: "14px",
          overflow: "hidden",
          fontFamily: "'DM Sans', sans-serif",
          background: "#fff",
          boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #e2e8f0",
            background: "#111",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "#f5c800",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "18px" }}>💬</span>
          </div>
          <div>
            <h1
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.01em",
              }}
            >
              Chat with Navigator
            </h1>
            <p
              style={{
                fontSize: "11px",
                color: "#6b7280",
                marginTop: "2px",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              #{sessionId.slice(0, 8)}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <SessionStatusBadge status={session.status} />
            <StatusBadge state={uiState} />
          </div>
        </div>

        {/* ── Message area ── */}
        <div
          className="chat-messages"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {uiState === "loading" && (
            <CenteredNotice>
              <Spinner />
              <span style={{ marginLeft: "10px", color: "#64748b" }}>
                Starting your chat…
              </span>
            </CenteredNotice>
          )}

          {uiState === "error" && errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "14px 18px",
                color: "#b91c1c",
                fontSize: "14px",
              }}
            >
              <strong>Connection error:</strong> {errorMsg}
            </div>
          )}

          {uiState === "ready" && messages.length === 0 && (
            <CenteredNotice>
              <span style={{ color: "#94a3b8", fontSize: "14px" }}>
                You're connected. A Navigator will join shortly.
              </span>
            </CenteredNotice>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.eventId}
              message={msg}
              isNavigator={msg.sender === "service"}
              isOwnMessage={msg.sender === "guest"}
            />
          ))}

          <div ref={bottomRef} />
        </div>

        {/* ── Send error banner ── */}
        {sendError && (
          <div
            style={{
              padding: "8px 24px",
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: "13px",
              borderTop: "1px solid #fecaca",
            }}
          >
            {sendError}
          </div>
        )}

        {/* ── Input ── */}
        <ChatInput onSend={handleSend} disabled={uiState !== "ready"} />
      </div>
    </>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const SessionStatusBadge: React.FC<{ status: GuestSession["status"] }> = ({ status }) => (
  <span
    style={{
      fontSize: "11px",
      fontWeight: 600,
      letterSpacing: "0.04em",
      color: status === "active" ? "#6b7280" : "#9ca3af",
      background: "#1f2937",
      borderRadius: "6px",
      padding: "3px 9px",
      fontFamily: "'DM Mono', monospace",
      textTransform: "uppercase",
    }}
  >
    {status}
  </span>
);

const StatusBadge: React.FC<{ state: UIState }> = ({ state }) => {
  const map: Record<UIState, { label: string; color: string; bg: string }> = {
    loading: { label: "Connecting…", color: "#111", bg: "#f5c800" },
    ready: { label: "Connected", color: "#111", bg: "#f5c800" },
    error: { label: "Error", color: "#fca5a5", bg: "#7f1d1d" },
  };
  const { label, color, bg } = map[state];
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        color,
        background: bg,
        borderRadius: "6px",
        padding: "3px 9px",
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {label}
    </span>
  );
};

const CenteredNotice: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

const Spinner: React.FC = () => (
  <span
    style={{
      display: "inline-block",
      width: "16px",
      height: "16px",
      border: "2px solid #e2e8f0",
      borderTopColor: "#f5c800",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }}
  />
);

export default GuestChatPage;
