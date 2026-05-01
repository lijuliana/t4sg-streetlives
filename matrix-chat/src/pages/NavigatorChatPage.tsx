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
import styles from "../styles/pages/NavigatorChatPage.module.css";

type UISyncState = "idle" | "syncing" | "ready" | "error" | "auth-error";

interface NavigatorChatPageProps {
  /** The Matrix room ID for this user's chat session. Provided by App.tsx. */
  roomId: string;
  /** Called when a session-expiry / auth error is detected mid-session. */
  onAuthError?: () => void;
}

// ── Convert a MatrixEvent to our local Message shape ─────────────────────────
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

    const addMessage = (msg: Message) => {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.eventId));
        if (ids.has(msg.eventId)) return prev;
        return [...prev, msg];
      });
    };

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

        setMyUserId(client.getUserId() ?? "");

        const crypto = client.getCrypto();

        const room = client.getRoom(roomId);

        if (room) {
          const allEvents = room.getLiveTimeline().getEvents();
          for (const ev of allEvents) {
            const msg = matrixEventToMessage(ev);
            if (msg) {
              setMessages((prev) => [...prev, msg]);
            } else if (ev.getType() === "m.room.encrypted") {
              watchDecryption(ev);
            }
          }

          crypto?.prepareToEncrypt(room);
        }
        setUiState("ready");

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
    };
  }, [roomId, onAuthError]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    setSendError(null);

    const pendingId = `pending-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { eventId: pendingId, sender: myUserId, body: text, timestamp: Date.now(), pending: true },
    ]);

    try {
      const client = await getMatrixClient();
      await client.sendTextMessage(roomId, text);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.eventId !== pendingId));
      if (err instanceof MatrixAuthError) {
        setUiState("auth-error");
        onAuthError?.();
        return;
      }
      setSendError("Failed to send message. Please try again.");
      return;
    }

    // Real event arrives via the timeline listener; remove the optimistic copy.
    setMessages((prev) => prev.filter((m) => m.eventId !== pendingId));
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const isNavigator = (sender: string) =>
    NAVIGATOR_USER_ID ? sender === NAVIGATOR_USER_ID : false;
  const isOwn = (sender: string) => !!myUserId && sender === myUserId;

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.chatShell}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <span className={styles.headerIconEmoji}>💬</span>
        </div>
        <div>
          <h1 className={styles.headerTitle}>Chat with Navigator</h1>
        </div>
        <div className={styles.headerActions}>
          <StatusBadge state={uiState} />
        </div>
      </div>

      {/* ── Message area ── */}
      <div className={styles.messageArea}>
        {/* Loading */}
        {uiState === "syncing" && (
          <CenteredNotice>
            <Spinner />
            <span className={styles.connectingText}>Connecting to Matrix…</span>
          </CenteredNotice>
        )}

        {/* Auth error */}
        {uiState === "auth-error" && (
          <CenteredNotice>
            <div className={styles.authErrorBox}>
              <p className={styles.authErrorTitle}>Session expired</p>
              <p className={styles.authErrorBody}>
                Your login session is no longer valid. Please sign in again.
              </p>
              <button
                type="button"
                onClick={() => onAuthError?.()}
                className={styles.authErrorButton}
              >
                Sign in again
              </button>
            </div>
          </CenteredNotice>
        )}

        {/* Generic error */}
        {uiState === "error" && errorMsg && (
          <div className={styles.errorBlock}>
            <strong>⚠ Error:</strong> {errorMsg}
          </div>
        )}

        {/* Empty state */}
        {uiState === "ready" && messages.length === 0 && (
          <CenteredNotice>
            <span className={styles.emptyText}>
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
        <div className={styles.sendErrorBanner}>{sendError}</div>
      )}

      {/* ── Input ── */}
      <ChatInput onSend={handleSend} disabled={uiState !== "ready"} />
    </div>
  );
};

// ── Small helper components ───────────────────────────────────────────────────

const StatusBadge: React.FC<{ state: UISyncState }> = ({ state }) => {
  const labels: Record<UISyncState, string> = {
    idle: "Idle",
    syncing: "Connecting…",
    ready: "Connected",
    error: "Error",
    "auth-error": "Session Expired",
  };
  return (
    <span className={styles.statusBadge} data-state={state}>
      {labels[state]}
    </span>
  );
};

const CenteredNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={styles.centeredNotice}>{children}</div>
);

const Spinner: React.FC = () => (
  <span className={styles.spinner} />
);

export default NavigatorChatPage;
