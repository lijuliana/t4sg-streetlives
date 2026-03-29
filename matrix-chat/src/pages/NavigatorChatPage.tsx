import React, { useEffect, useRef, useState } from "react";
import {
  RoomEvent,
  EventType,
  MsgType,
  MatrixEventEvent,
  HttpApiEvent,
} from "matrix-js-sdk";
import type { MatrixEvent, Room, IRoomTimelineData } from "matrix-js-sdk";
import {
  getMatrixClient,
  NAVIGATOR_USER_ID,
  MatrixAuthError,
} from "../lib/matrixClient";
import ChatMessage from "../components/ChatMessage";
import type { Message } from "../components/ChatMessage";
import ChatInput from "../components/ChatInput";

type UISyncState = "idle" | "syncing" | "ready" | "error" | "auth-error";

interface NavigatorChatPageProps {
  /** The Matrix room ID for this user's chat session. Provided by App.tsx. */
  roomId: string;
  /** Called when a session-expiry / auth error is detected mid-session. */
  onAuthError?: () => void;
}

// ── Convert a MatrixEvent to our local Message shape ─────────────────────────
// After the SDK decrypts an m.room.encrypted event, getType() returns the
// real decrypted type (e.g. m.room.message) and getContent() returns the
// plaintext — so this works identically for plain and encrypted rooms.
function matrixEventToMessage(ev: MatrixEvent): Message | null {
  const id = ev.getId();
  const sender = ev.getSender();
  const content = ev.getContent();
  if (
    ev.getType() !== EventType.RoomMessage ||
    content["msgtype"] !== MsgType.Text ||
    !id ||
    !sender
  ) {
    return null;
  }
  return {
    eventId: id,
    sender,
    body: (content["body"] as string) ?? "",
    timestamp: ev.getTs(),
  };
}

const NavigatorChatPage: React.FC<NavigatorChatPageProps> = ({
  roomId,
  onAuthError,
}) => {
  const [uiState, setUiState] = useState<UISyncState>("syncing");
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {

    let mounted = true;
    let removeListeners: (() => void) | undefined;

    // Helper used by both the initial load and the live listener to append a
    // message without duplicating an event that's already in state.
    const addMessage = (msg: Message) => {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.eventId));
        if (ids.has(msg.eventId)) return prev;
        return [...prev, msg];
      });
    };

    // Attach a late-decryption listener to a single encrypted MatrixEvent.
    // When Element sends a message, it ships the Megolm session key to our
    // device via a to-device message in the next /sync response. The SDK
    // decrypts the event and fires MatrixEventEvent.Decrypted — at that point
    // getType() and getContent() return the decrypted values.
    const watchDecryption = (ev: MatrixEvent) => {
      ev.once(MatrixEventEvent.Decrypted, () => {
        if (!mounted) return;
        const msg = matrixEventToMessage(ev);
        if (msg) addMessage(msg);
      });
    };

    const handleAuthFailure = () => {
      if (!mounted) return;
      setUiState("auth-error");
      onAuthError?.();
    };

    getMatrixClient()
      .then(async (client) => {
        if (!mounted) return;

        // Capture the authenticated user's ID for isOwn() checks.
        setMyUserId(client.getUserId() ?? "");

        const crypto = client.getCrypto();

        // ── Load initial messages from the live timeline ──────────────────
        // The timeline is populated by the initial sync that already ran
        // inside getMatrixClient(). Events the SDK could decrypt appear as
        // m.room.message; events with missing keys are still m.room.encrypted
        // and get a late-decryption watcher attached below.
        const room = client.getRoom(roomId);
        console.log("[NavigatorChat] Room found:", !!room, "| Room ID:", roomId);

        if (room) {
          const allEvents = room.getLiveTimeline().getEvents();
          let plain = 0,
            encrypted = 0;
          for (const ev of allEvents) {
            const msg = matrixEventToMessage(ev);
            if (msg) {
              plain++;
              setMessages((prev) => [...prev, msg]);
            } else if (ev.getType() === "m.room.encrypted") {
              encrypted++;
              watchDecryption(ev);
            }
          }
          console.log(
            `[NavigatorChat] Initial events: ${plain} plain, ${encrypted} still-encrypted`,
          );

          // prepareToEncrypt pre-fetches device keys for all room members and
          // creates the outbound Megolm session. The SDK docs mark this as
          // required before the first sendTextMessage() in an encrypted room.
          crypto?.prepareToEncrypt(room);
        }
        setUiState("ready");

        // ── Live-message listener ─────────────────────────────────────────
        // RoomEvent.Timeline fires for every event appended to the live
        // timeline. The SDK decrypts m.room.encrypted events synchronously
        // when the Megolm session key is already cached; otherwise the event
        // stays encrypted until the key arrives and we attach a watcher.
        const onTimeline = (
          event: MatrixEvent,
          room: Room | undefined,
          _toStartOfTimeline: boolean | undefined,
          _removed: boolean,
          data: IRoomTimelineData,
        ) => {
          if (
            !mounted ||
            !room ||
            room.roomId !== roomId ||
            !data.liveEvent
          )
            return;
          const msg = matrixEventToMessage(event);
          if (msg) {
            addMessage(msg);
          } else if (event.getType() === "m.room.encrypted") {
            watchDecryption(event);
          }
        };

        // ── Mid-session auth failure listener ─────────────────────────────
        // The SDK fires HttpApiEvent.SessionLoggedOut when the server returns
        // M_UNKNOWN_TOKEN (token revoked or expired after a successful init).
        const onSessionLoggedOut = () => handleAuthFailure();

        client.on(RoomEvent.Timeline, onTimeline);
        client.on(HttpApiEvent.SessionLoggedOut, onSessionLoggedOut);

        removeListeners = () => {
          client.off(RoomEvent.Timeline, onTimeline);
          client.off(HttpApiEvent.SessionLoggedOut, onSessionLoggedOut);
        };
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        if (err instanceof MatrixAuthError) {
          handleAuthFailure();
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[NavigatorChat] Initialization error:", err);
        setErrorMsg(msg);
        setUiState("error");
      });

    return () => {
      mounted = false;
      removeListeners?.();
      // Do NOT call client.stopClient() — the singleton must remain running
      // across React StrictMode's unmount/remount cycles.
    };
  }, [roomId, onAuthError]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    setSendError(null);
    try {
      const client = await getMatrixClient();
      // sendTextMessage encrypts automatically when the room has encryption
      // enabled — the SDK handles Megolm session key sharing transparently.
      await client.sendTextMessage(roomId, text);
    } catch (err) {
      if (err instanceof MatrixAuthError) {
        setUiState("auth-error");
        onAuthError?.();
        return;
      }
      setSendError("Failed to send message. Please try again.");
      console.error("[NavigatorChat] Send error:", err);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const isNavigator = (sender: string) =>
    NAVIGATOR_USER_ID ? sender === NAVIGATOR_USER_ID : false;
  const isOwn = (sender: string) => !!myUserId && sender === myUserId;

  // ── UI ────────────────────────────────────────────────────────────────────
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
          {/* Loading */}
          {uiState === "syncing" && (
            <CenteredNotice>
              <Spinner />
              <span style={{ marginLeft: "10px", color: "#64748b" }}>
                Connecting to Matrix…
              </span>
            </CenteredNotice>
          )}

          {/* Auth error */}
          {uiState === "auth-error" && (
            <CenteredNotice>
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "20px 24px",
                  color: "#b91c1c",
                  fontSize: "14px",
                  textAlign: "center",
                  maxWidth: "360px",
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: "8px" }}>
                  Session expired
                </p>
                <p style={{ color: "#dc2626", marginBottom: "16px" }}>
                  Your login session is no longer valid. Please sign in again.
                </p>
                <button
                  onClick={() => onAuthError?.()}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#f5c800",
                    color: "#111",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Sign in again
                </button>
              </div>
            </CenteredNotice>
          )}

          {/* Generic error */}
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
              <strong>⚠ Error:</strong> {errorMsg}
            </div>
          )}

          {/* Empty state */}
          {uiState === "ready" && messages.length === 0 && (
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
        <ChatInput onSend={handleSend} disabled={uiState !== "ready"} />
      </div>
    </>
  );
};

// ── Small helper components ───────────────────────────────────────────────────

const StatusBadge: React.FC<{ state: UISyncState }> = ({ state }) => {
  const map: Record<UISyncState, { label: string; color: string; bg: string }> =
    {
      idle: { label: "Idle", color: "#9ca3af", bg: "#374151" },
      syncing: { label: "Connecting…", color: "#111", bg: "#f5c800" },
      ready: { label: "Connected", color: "#111", bg: "#f5c800" },
      error: { label: "Error", color: "#fca5a5", bg: "#7f1d1d" },
      "auth-error": {
        label: "Session Expired",
        color: "#fca5a5",
        bg: "#7f1d1d",
      },
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
