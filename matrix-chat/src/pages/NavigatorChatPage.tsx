import React, { useEffect, useRef, useState } from "react";
import { BASE_URL, ACCESS_TOKEN } from "../lib/matrixClient";
import ChatMessage from "../components/ChatMessage";
import type { Message } from "../components/ChatMessage";
import ChatInput from "../components/ChatInput";

// ─── Env vars ────────────────────────────────────────────────────────────────
const ROOM_ID = import.meta.env.VITE_MATRIX_ROOM_ID as string;
const MY_USER_ID = import.meta.env.VITE_MATRIX_USER_ID as string;
const NAVIGATOR_USER_ID = import.meta.env
  .VITE_MATRIX_NAVIGATOR_USER_ID as string;
// ─────────────────────────────────────────────────────────────────────────────

type SyncState = "idle" | "syncing" | "ready" | "error";

type RawEvent = {
  event_id: string;
  sender: string;
  type: string;
  content: { msgtype?: string; body?: string };
  origin_server_ts: number;
};

function toMessage(ev: RawEvent): Message {
  return {
    eventId: ev.event_id,
    sender: ev.sender,
    body: ev.content.body ?? "",
    timestamp: ev.origin_server_ts,
  };
}

const ENV_ERROR =
  !import.meta.env.VITE_MATRIX_BASE_URL ||
  !import.meta.env.VITE_MATRIX_ACCESS_TOKEN ||
  !import.meta.env.VITE_MATRIX_USER_ID ||
  !ROOM_ID
    ? "Missing environment variables. Please fill in your .env.local file."
    : null;

const NavigatorChatPage: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>(
    ENV_ERROR ? "error" : "syncing"
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(ENV_ERROR);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ENV_ERROR) return;

    let stopped = false;
    const controller = new AbortController();
    const headers = { Authorization: `Bearer ${ACCESS_TOKEN}` };

    const run = async () => {
      // ── Step 1: get a sync token so we don't miss live messages during load ──
      let since: string;
      try {
        const res = await fetch(`${BASE_URL}/_matrix/client/v3/sync?timeout=0`, {
          headers,
          signal: controller.signal,
        });
        const data = (await res.json()) as { next_batch: string };
        since = data.next_batch;
      } catch {
        if (!stopped) {
          setErrorMsg("Failed to connect to Matrix.");
          setSyncState("error");
        }
        return;
      }

      // ── Step 2: load initial messages from /messages ──────────────────────
      try {
        const encodedRoom = encodeURIComponent(ROOM_ID);
        const res = await fetch(
          `${BASE_URL}/_matrix/client/v3/rooms/${encodedRoom}/messages?dir=b&limit=50`,
          { headers, signal: controller.signal }
        );
        const data = (await res.json()) as { chunk: RawEvent[] };
        const msgs = data.chunk
          .filter(
            (ev) =>
              ev.type === "m.room.message" && ev.content.msgtype === "m.text"
          )
          .reverse()
          .map(toMessage);
        if (!stopped) {
          setMessages(msgs);
          setSyncState("ready");
        }
      } catch {
        if (!stopped) {
          setErrorMsg("Failed to load messages.");
          setSyncState("error");
        }
        return;
      }

      // ── Step 3: long-poll sync loop for live updates ──────────────────────
      while (!stopped) {
        try {
          const res = await fetch(
            `${BASE_URL}/_matrix/client/v3/sync?timeout=30000&since=${since}`,
            { headers, signal: controller.signal }
          );
          const data = (await res.json()) as {
            next_batch: string;
            rooms?: {
              join?: Record<string, { timeline?: { events: RawEvent[] } }>;
            };
          };
          since = data.next_batch;

          const roomEvents =
            data.rooms?.join?.[ROOM_ID]?.timeline?.events ?? [];
          const newMsgs = roomEvents
            .filter(
              (ev) =>
                ev.type === "m.room.message" && ev.content.msgtype === "m.text"
            )
            .map(toMessage);

          if (newMsgs.length > 0 && !stopped) {
            setMessages((prev) => {
              const ids = new Set(prev.map((m) => m.eventId));
              const fresh = newMsgs.filter((m) => !ids.has(m.eventId));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        } catch {
          break;
        }
      }
    };

    run();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    setSendError(null);
    const txnId = Date.now().toString();
    try {
      const encodedRoom = encodeURIComponent(ROOM_ID);
      const res = await fetch(
        `${BASE_URL}/_matrix/client/v3/rooms/${encodedRoom}/send/m.room.message/${txnId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ msgtype: "m.text", body: text }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setSendError("Failed to send message. Please try again.");
      console.error("[NavigatorChat] Send error:", err);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const isNavigator = (sender: string) =>
    NAVIGATOR_USER_ID ? sender === NAVIGATOR_USER_ID : false;

  const isOwn = (sender: string) => sender === MY_USER_ID;

  // ── UI ────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Google Fonts */}
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
          </div>
          <div style={{ marginLeft: "auto" }}>
            <StatusBadge state={syncState} />
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
          {/* Loading */}
          {syncState === "syncing" && (
            <CenteredNotice>
              <Spinner />
              <span style={{ marginLeft: "10px", color: "#64748b" }}>
                Connecting to Matrix…
              </span>
            </CenteredNotice>
          )}

          {/* Error */}
          {syncState === "error" && errorMsg && (
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
              <strong>⚠ Error:</strong> {errorMsg}
            </div>
          )}

          {/* Empty state */}
          {syncState === "ready" && messages.length === 0 && (
            <CenteredNotice>
              <span style={{ color: "#94a3b8", fontSize: "14px" }}>
                No messages yet. Be the first to say something!
              </span>
            </CenteredNotice>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.eventId}
              message={msg}
              isNavigator={isNavigator(msg.sender)}
              isOwnMessage={isOwn(msg.sender)}
            />
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Send error */}
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
        <ChatInput onSend={handleSend} disabled={syncState !== "ready"} />
      </div>
    </>
  );
};

// ── Small helper components ───────────────────────────────────────────────────

const StatusBadge: React.FC<{ state: SyncState }> = ({ state }) => {
  const map: Record<SyncState, { label: string; color: string; bg: string }> =
    {
      idle: { label: "Idle", color: "#9ca3af", bg: "#374151" },
      syncing: { label: "Connecting…", color: "#111", bg: "#f5c800" },
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
  >
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </span>
);

export default NavigatorChatPage;
