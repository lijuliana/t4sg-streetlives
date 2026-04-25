import React, { useEffect, useRef, useState } from "react";
import ChatMessage from "../components/ChatMessage";
import type { Message as ChatMessageShape } from "../components/ChatMessage";
import ChatInput from "../components/ChatInput";
import type { GuestSession } from "../lib/guestSession";
import styles from "../styles/pages/GuestChatPage.module.css";

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
      const raw = (await res.json()) as {
        id?: string;
        senderType?: string;
        text?: string;
        createdAt?: string;
      };
      const backendMsg: BackendMessage = {
        messageId: raw.id ?? "",
        sessionId,
        sender: "guest",
        body: raw.text ?? "",
        sentAt: raw.createdAt ?? new Date().toISOString(),
      };
      const display = toDisplayMessage(backendMsg);
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
    <div className={styles.chatShell}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <span className={styles.headerIconEmoji}>💬</span>
        </div>
        <div>
          <h1 className={styles.headerTitle}>Chat with Navigator</h1>
          <p className={styles.headerSessionId}>#{sessionId.slice(0, 8)}</p>
        </div>
        <div className={styles.headerActions}>
          <SessionStatusBadge status={session.status} />
          <StatusBadge state={uiState} />
        </div>
      </div>

      {/* ── Message area ── */}
      <div className={styles.messageArea}>
        {uiState === "loading" && (
          <CenteredNotice>
            <Spinner />
            <span className={styles.connectingText}>Starting your chat…</span>
          </CenteredNotice>
        )}

        {uiState === "error" && errorMsg && (
          <div className={styles.errorBlock}>
            <strong>Connection error:</strong> {errorMsg}
          </div>
        )}

        {uiState === "ready" && messages.length === 0 && (
          <CenteredNotice>
            <span className={styles.emptyText}>
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
        <div className={styles.sendErrorBanner}>{sendError}</div>
      )}

      {/* ── Input ── */}
      <ChatInput onSend={handleSend} disabled={uiState !== "ready"} />
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const SessionStatusBadge: React.FC<{ status: GuestSession["status"] }> = ({ status }) => (
  <span
    className={styles.sessionStatusBadge}
    data-status={status}
  >
    {status}
  </span>
);

const StatusBadge: React.FC<{ state: UIState }> = ({ state }) => {
  const labels: Record<UIState, string> = {
    loading: "Connecting…",
    ready: "Connected",
    error: "Error",
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

export default GuestChatPage;
