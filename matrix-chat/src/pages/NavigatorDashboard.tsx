import React, { useEffect, useRef, useState } from "react";

// ── Types (mirror backend shapes) ─────────────────────────────────────────────

type SessionStatus = "unassigned" | "active" | "closed" | "transferred";
type NavStatus = "available" | "away" | "offline";
type NavGroup = "CUNY_PIN" | "HOUSING_WORKS" | "DYCD";
type EventType = "created" | "assigned" | "transferred" | "closed";

interface RoutingReason {
  generalIntakeOnly: boolean;
  languageRequested: string | null;
  languageMatch: boolean;
  loadRatio: number;
  score: number;
}

interface DashSession {
  sessionId: string;
  matrixRoomId: string;
  status: SessionStatus;
  createdAt: string;
  closedAt: string | null;
  needCategory: string | null;
  assignedNavigatorId: string | null;
  routingVersion: string | null;
  routingReason: RoutingReason | null;
  routingFailReason: string | null;
  referralId: string | null;
}

interface Navigator {
  id: string;
  userId: string;
  navGroup: NavGroup;
  expertiseTags: string[];
  languages: string[];
  capacity: number;
  status: NavStatus;
  isGeneralIntake: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: EventType;
  actor: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

type SenderType = "guest" | "navigator" | "system";

interface SessionMessage {
  id: string;
  sessionId: string;
  matrixRoomId: string;
  matrixEventId: string | null;
  senderType: SenderType;
  senderNavigatorId: string | null;
  senderLabel: string;
  text: string;
  createdAt: string;
}

interface Note {
  noteId: string;
  sessionId: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
}

interface Referral {
  referralId: string;
  sessionId: string;
  title: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ── Shared small components ───────────────────────────────────────────────────

const StatusPill: React.FC<{ status: SessionStatus }> = ({ status }) => {
  const map: Record<SessionStatus, { bg: string; color: string }> = {
    active:      { bg: "#f5c800", color: "#111" },
    unassigned:  { bg: "#f59e0b", color: "#111" },
    closed:      { bg: "#374151", color: "#9ca3af" },
    transferred: { bg: "#6366f1", color: "#fff" },
  };
  const { bg, color } = map[status] ?? { bg: "#374151", color: "#9ca3af" };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: "4px",
        fontFamily: "'DM Mono', monospace",
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
};

const NavStatusDot: React.FC<{ status: NavStatus }> = ({ status }) => {
  const color = status === "available" ? "#22c55e" : status === "away" ? "#f59e0b" : "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: "10px",
      border: "1px solid #e5e7eb",
      padding: "18px 20px",
    }}
  >
    <h3
      style={{
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "#6b7280",
        marginBottom: "14px",
      }}
    >
      {title}
    </h3>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div
    style={{
      display: "flex",
      gap: "12px",
      fontSize: "13px",
      marginBottom: "8px",
      alignItems: "flex-start",
    }}
  >
    <span style={{ color: "#9ca3af", minWidth: "128px", flexShrink: 0 }}>{label}</span>
    <span
      style={{
        color: "#111",
        fontFamily: mono ? "'DM Mono', monospace" : undefined,
        fontSize: mono ? "12px" : "13px",
        wordBreak: "break-all",
        flex: 1,
      }}
    >
      {value ?? <span style={{ color: "#d1d5db" }}>—</span>}
    </span>
  </div>
);

const SubmitButton: React.FC<{
  loading: boolean;
  label: string;
  loadingLabel?: string;
  danger?: boolean;
}> = ({ loading, label, loadingLabel, danger }) => (
  <button
    type="submit"
    disabled={loading}
    style={{
      padding: "7px 16px",
      borderRadius: "8px",
      border: danger ? "1px solid #fecaca" : "none",
      background: loading ? (danger ? "#fee2e2" : "#e5b800") : danger ? "#fff" : "#f5c800",
      color: danger ? "#b91c1c" : "#111",
      fontSize: "13px",
      fontWeight: 600,
      cursor: loading ? "not-allowed" : "pointer",
      whiteSpace: "nowrap",
      fontFamily: "'DM Sans', sans-serif",
    }}
  >
    {loading ? (loadingLabel ?? "Saving…") : label}
  </button>
);

const ErrorMsg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      fontSize: "12px",
      color: "#b91c1c",
      marginTop: "6px",
      padding: "6px 10px",
      background: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: "6px",
    }}
  >
    {children}
  </p>
);

const inputStyle: React.CSSProperties = {
  fontSize: "13px",
  padding: "7px 10px",
  borderRadius: "7px",
  border: "1px solid #e5e7eb",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  background: "#fff",
  color: "#111",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  width: "100%",
  resize: "vertical",
  display: "block",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

// ── Session list panel (left sidebar) ────────────────────────────────────────

const SessionListPanel: React.FC<{
  sessions: DashSession[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}> = ({ sessions, selectedId, loading, onSelect, onRefresh }) => (
  <div
    style={{
      width: "268px",
      flexShrink: 0,
      background: "#111",
      borderRight: "1px solid #1f2937",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
    }}
  >
    <div
      style={{
        padding: "18px 16px 14px",
        borderBottom: "1px solid #1f2937",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
          Sessions
        </div>
        <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
          {sessions.length} total
        </div>
      </div>
      <button
        onClick={onRefresh}
        title="Refresh"
        style={{
          background: "none",
          border: "1px solid #374151",
          borderRadius: "6px",
          color: "#9ca3af",
          cursor: "pointer",
          fontSize: "13px",
          padding: "4px 8px",
        }}
      >
        ↻
      </button>
    </div>

    <div style={{ flex: 1, overflowY: "auto" }}>
      {loading && sessions.length === 0 && (
        <div style={{ padding: "24px 16px", color: "#6b7280", fontSize: "13px" }}>
          Loading…
        </div>
      )}
      {!loading && sessions.length === 0 && (
        <div style={{ padding: "24px 16px", color: "#6b7280", fontSize: "13px" }}>
          No sessions yet.
        </div>
      )}
      {sessions.map((s) => (
        <button
          key={s.sessionId}
          onClick={() => onSelect(s.sessionId)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            background: selectedId === s.sessionId ? "#1f2937" : "none",
            border: "none",
            borderBottom: "1px solid #1a1a1a",
            padding: "11px 16px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "3px",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#e5e7eb",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              #{s.sessionId.slice(0, 8)}
            </span>
            <StatusPill status={s.status} />
          </div>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>
            {s.needCategory ? `${s.needCategory} · ` : ""}
            {fmt(s.createdAt)}
          </div>
        </button>
      ))}
    </div>
  </div>
);

// ── Session events panel ──────────────────────────────────────────────────────

const SessionEventsSection: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = () =>
    apiFetch<SessionEvent[]>(`/api/sessions/${sessionId}/events`)
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    setLoading(true);
    loadEvents();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const eventColor: Record<EventType, string> = {
    created:     "#6b7280",
    assigned:    "#22c55e",
    transferred: "#6366f1",
    closed:      "#374151",
  };

  return (
    <Section title={`Events (${events.length})`}>
      <button
        onClick={loadEvents}
        style={{
          background: "none",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          color: "#6b7280",
          cursor: "pointer",
          fontSize: "11px",
          padding: "3px 8px",
          marginBottom: "12px",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Refresh
      </button>

      {loading && <p style={{ fontSize: "13px", color: "#9ca3af" }}>Loading…</p>}
      {!loading && events.length === 0 && (
        <p style={{ fontSize: "13px", color: "#9ca3af" }}>No events yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {events.map((ev) => (
          <div
            key={ev.id}
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderLeft: `3px solid ${eventColor[ev.eventType] ?? "#e5e7eb"}`,
              borderRadius: "6px",
              padding: "8px 12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: eventColor[ev.eventType] ?? "#6b7280",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {ev.eventType}
              </span>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                {fmt(ev.timestamp)}
                {ev.actor ? ` · ${ev.actor}` : ""}
              </span>
            </div>
            {Object.keys(ev.metadata).length > 0 && (
              <pre
                style={{
                  fontSize: "11px",
                  color: "#374151",
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {JSON.stringify(ev.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
};

// ── Transfer section ──────────────────────────────────────────────────────────

const TransferSection: React.FC<{
  session: DashSession;
  navigators: Navigator[];
  onTransferred: (updated: DashSession) => void;
}> = ({ session, navigators, onTransferred }) => {
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [targetId, setTargetId] = useState("");
  const [language, setLanguage] = useState(session.needCategory ?? "");
  const [reason, setReason] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter out current assignee for manual target list
  const eligibleManual = navigators.filter(
    (n) => n.status === "available" && n.id !== session.assignedNavigatorId,
  );

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setTransferring(true);

    try {
      const body: Record<string, unknown> = { reason: reason || undefined };
      if (mode === "manual") {
        if (!targetId) {
          setError("Select a navigator to transfer to.");
          setTransferring(false);
          return;
        }
        body.targetNavigatorId = targetId;
      } else {
        if (language) body.language = language;
      }

      const result = await apiFetch<{ ok: boolean; assignedNavigatorId: string }>(
        `/api/sessions/${session.sessionId}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      setSuccess(`Transferred to navigator ${result.assignedNavigatorId.slice(0, 8)}`);
      setReason("");
      setTargetId("");

      // Refresh session from backend to get updated state
      const updated = await apiFetch<DashSession>(`/api/sessions/${session.sessionId}`);
      onTransferred(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  if (session.status === "closed") {
    return (
      <Section title="Transfer">
        <p style={{ fontSize: "13px", color: "#9ca3af" }}>Session is closed.</p>
      </Section>
    );
  }

  return (
    <Section title="Transfer">
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {(["manual", "auto"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "5px 14px",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: mode === m ? "#111" : "#e5e7eb",
              background: mode === m ? "#111" : "#fff",
              color: mode === m ? "#fff" : "#374151",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              textTransform: "capitalize",
            }}
          >
            {m === "manual" ? "Pick navigator" : "Re-run routing"}
          </button>
        ))}
      </div>

      <form onSubmit={handleTransfer} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {mode === "manual" ? (
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "#6b7280",
                marginBottom: "5px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Target navigator
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              style={{ ...selectStyle, width: "100%" }}
            >
              <option value="">— Select —</option>
              {eligibleManual.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.userId.replace(/@|:.*$/g, "")}
                  {" "}· {n.languages.join("/")}
                  {n.isGeneralIntake ? " · intake" : " · specialist"}
                </option>
              ))}
            </select>
            {eligibleManual.length === 0 && (
              <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                No available navigators to transfer to.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "#6b7280",
                marginBottom: "5px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Language (optional override)
            </label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. es, zh (leave blank to match any)"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
        )}

        <div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>

        <div>
          <SubmitButton loading={transferring} label="Transfer" loadingLabel="Transferring…" />
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {success && (
          <p
            style={{
              fontSize: "12px",
              color: "#166534",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              padding: "6px 10px",
            }}
          >
            {success}
          </p>
        )}
      </form>
    </Section>
  );
};

// ── Message thread + reply box ────────────────────────────────────────────────

const THREAD_POLL_MS = 4_000;

const MessageThread: React.FC<{
  session: DashSession;
  assignedNav: Navigator | undefined;
}> = ({ session, assignedNav }) => {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchThread = async (signal?: AbortSignal) => {
    const msgs = await apiFetch<SessionMessage[]>(
      `/api/sessions/${session.sessionId}/thread`,
      signal ? { signal } : undefined,
    );
    setMessages(msgs);
  };

  useEffect(() => {
    const ac = new AbortController();
    setMessages([]);
    fetchThread(ac.signal).catch(() => {});
    const interval = setInterval(() => fetchThread(ac.signal).catch(() => {}), THREAD_POLL_MS);
    return () => { ac.abort(); clearInterval(interval); };
  }, [session.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !assignedNav) return;
    setSendError(null);
    setSending(true);
    try {
      await apiFetch<SessionMessage>(`/api/sessions/${session.sessionId}/navigator-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim(), navigatorId: assignedNav.id }),
      });
      setReplyText("");
      await fetchThread();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const canReply =
    session.status !== "closed" &&
    assignedNav !== undefined;

  return (
    <div
      style={{
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "#6b7280",
            margin: 0,
          }}
        >
          Conversation ({messages.length})
        </h3>
        <span style={{ fontSize: "11px", color: "#d1d5db", fontFamily: "'DM Mono', monospace" }}>
          polls every 4s
        </span>
      </div>

      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {messages.length === 0 && (
          <p style={{ fontSize: "13px", color: "#9ca3af", textAlign: "center", margin: "auto" }}>
            No messages yet.
          </p>
        )}
        {messages.map((msg) => {
          const isGuest = msg.senderType === "guest";
          const isSystem = msg.senderType === "system";
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isGuest ? "flex-start" : isSystem ? "center" : "flex-end",
              }}
            >
              {!isSystem && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "#9ca3af",
                    marginBottom: "2px",
                    fontWeight: 600,
                  }}
                >
                  {msg.senderLabel}
                </span>
              )}
              <div
                style={{
                  maxWidth: "80%",
                  padding: isSystem ? "4px 10px" : "8px 12px",
                  borderRadius: isGuest ? "4px 12px 12px 12px" : isSystem ? "6px" : "12px 4px 12px 12px",
                  background: isGuest
                    ? "#f3f4f6"
                    : isSystem
                      ? "transparent"
                      : "#111",
                  color: isGuest ? "#111" : isSystem ? "#9ca3af" : "#fff",
                  fontSize: isSystem ? "11px" : "13px",
                  lineHeight: 1.5,
                  border: isSystem ? "1px dashed #e5e7eb" : "none",
                  fontStyle: isSystem ? "italic" : "normal",
                }}
              >
                {msg.text}
              </div>
              <span style={{ fontSize: "10px", color: "#d1d5db", marginTop: "2px" }}>
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {canReply ? (
        <form
          onSubmit={handleSend}
          style={{
            borderTop: "1px solid #f3f4f6",
            padding: "10px 12px",
            display: "flex",
            gap: "8px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
            }}
            placeholder={`Reply as ${assignedNav?.userId.replace(/@|:.*$/g, "") ?? "navigator"}…`}
            rows={2}
            disabled={sending}
            style={{
              flex: 1,
              fontSize: "13px",
              padding: "7px 10px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontFamily: "'DM Sans', sans-serif",
              resize: "none",
              outline: "none",
              color: "#111",
            }}
          />
          <button
            type="submit"
            disabled={sending || !replyText.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: sending || !replyText.trim() ? "#e5e7eb" : "#111",
              color: sending || !replyText.trim() ? "#9ca3af" : "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: sending || !replyText.trim() ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              fontFamily: "'DM Sans', sans-serif",
              alignSelf: "flex-end",
            }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      ) : (
        <div
          style={{
            borderTop: "1px solid #f3f4f6",
            padding: "10px 16px",
            fontSize: "12px",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          {session.status === "closed"
            ? "Session closed — replies disabled."
            : "No navigator assigned — replies disabled."}
        </div>
      )}

      {sendError && (
        <div style={{ padding: "0 12px 10px" }}>
          <ErrorMsg>{sendError}</ErrorMsg>
        </div>
      )}
    </div>
  );
};

// ── Session detail panel (right panel) ───────────────────────────────────────

const SessionDetailPanel: React.FC<{
  session: DashSession;
  navigators: Navigator[];
  onSessionUpdated: (updated: DashSession) => void;
}> = ({ session, navigators, onSessionUpdated }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [closing, setClosing] = useState(false);

  const [noteBody, setNoteBody] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [refTitle, setRefTitle] = useState("");
  const [refDesc, setRefDesc] = useState("");
  const [refAuthor, setRefAuthor] = useState("");
  const [addingRef, setAddingRef] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  const detailRef = useRef<HTMLDivElement>(null);

  const loadNotes = () =>
    apiFetch<Note[]>(`/api/sessions/${session.sessionId}/notes`)
      .then(setNotes)
      .catch(console.error);
  const loadReferrals = () =>
    apiFetch<Referral[]>(`/api/sessions/${session.sessionId}/referrals`)
      .then(setReferrals)
      .catch(console.error);

  useEffect(() => {
    setNotes([]);
    setReferrals([]);
    loadNotes();
    loadReferrals();
    detailRef.current?.scrollTo(0, 0);
  }, [session.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = async () => {
    if (!confirm("Close this session? This cannot be undone.")) return;
    setClosing(true);
    try {
      await apiFetch(`/api/sessions/${session.sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const updated = await apiFetch<DashSession>(`/api/sessions/${session.sessionId}`);
      onSessionUpdated(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to close session");
    } finally {
      setClosing(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setAddingNote(true);
    setNoteError(null);
    try {
      await apiFetch(`/api/sessions/${session.sessionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim(), createdBy: noteAuthor.trim() || undefined }),
      });
      setNoteBody("");
      setNoteAuthor("");
      await loadNotes();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleAddReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refTitle.trim()) return;
    setAddingRef(true);
    setRefError(null);
    try {
      await apiFetch(`/api/sessions/${session.sessionId}/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: refTitle.trim(),
          description: refDesc.trim() || undefined,
          createdBy: refAuthor.trim() || undefined,
        }),
      });
      setRefTitle("");
      setRefDesc("");
      setRefAuthor("");
      await loadReferrals();
    } catch (err) {
      setRefError(err instanceof Error ? err.message : "Failed to add referral");
    } finally {
      setAddingRef(false);
    }
  };

  const assignedNav = navigators.find((n) => n.id === session.assignedNavigatorId);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
        minWidth: 0,
      }}
    >
      {/* Top bar — spans full width */}
      <div
        style={{
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#111",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace" }}>
              #{session.sessionId.slice(0, 8)}
            </span>
            <StatusPill status={session.status} />
          </div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px" }}>
            Created {fmt(session.createdAt)}
            {session.closedAt && ` · Closed ${fmt(session.closedAt)}`}
          </div>
        </div>
        {session.status !== "closed" && (
          <button
            onClick={handleClose}
            disabled={closing}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "1px solid #fecaca",
              background: "#fff",
              color: "#b91c1c",
              fontSize: "13px",
              fontWeight: 600,
              cursor: closing ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            {closing ? "Closing…" : "Close session"}
          </button>
        )}
      </div>

      {/* Two-column body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Left sidebar: metadata / debug / controls ── */}
        <div
          ref={detailRef}
          style={{
            width: "240px",
            flexShrink: 0,
            overflowY: "auto",
            background: "#f9fafb",
            borderRight: "1px solid #e5e7eb",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* ── Session metadata ── */}
          <Section title="Session">
            <InfoRow label="Session ID" value={session.sessionId} mono />
            <InfoRow label="Matrix room" value={session.matrixRoomId} mono />
            <InfoRow label="Status" value={<StatusPill status={session.status} />} />
            <InfoRow label="Need category" value={session.needCategory} />
            <InfoRow label="Created" value={fmt(session.createdAt)} />
            {session.closedAt && <InfoRow label="Closed" value={fmt(session.closedAt)} />}
          </Section>

          {/* ── Routing debug ── */}
          <Section title="Routing">
            <InfoRow label="Routing version" value={session.routingVersion} mono />
            <InfoRow
              label="Assigned navigator"
              value={
                assignedNav
                  ? `${assignedNav.userId} (${assignedNav.id.slice(0, 8)})`
                  : session.assignedNavigatorId
                    ? session.assignedNavigatorId
                    : null
              }
              mono={!!session.assignedNavigatorId}
            />
            {session.routingFailReason && (
              <InfoRow
                label="Fail reason"
                value={
                  <span style={{ color: "#b91c1c" }}>{session.routingFailReason}</span>
                }
              />
            )}
            {session.routingReason && (
              <div style={{ marginTop: "6px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#9ca3af",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Routing reason
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {[
                    ["Intake only", session.routingReason.generalIntakeOnly ? "yes" : "no"],
                    ["Language", session.routingReason.languageRequested ?? "any"],
                    ["Lang match", session.routingReason.languageMatch ? "yes" : "no"],
                    ["Load ratio", session.routingReason.loadRatio.toFixed(2)],
                    ["Score", session.routingReason.score.toFixed(2)],
                  ].map(([k, v]) => (
                    <span
                      key={k}
                      style={{
                        fontSize: "11px",
                        fontFamily: "'DM Mono', monospace",
                        background: "#f3f4f6",
                        border: "1px solid #e5e7eb",
                        borderRadius: "4px",
                        padding: "2px 7px",
                        color: "#374151",
                      }}
                    >
                      {k}: <strong>{v}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── Transfer ── */}
          <TransferSection
            session={session}
            navigators={navigators}
            onTransferred={onSessionUpdated}
          />

          {/* ── Events audit log ── */}
          <SessionEventsSection sessionId={session.sessionId} />

          {/* ── Notes ── */}
          <Section title={`Notes (${notes.length})`}>
          {notes.length === 0 && (
            <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "12px" }}>
              No notes yet.
            </p>
          )}
          {notes.map((n) => (
            <div
              key={n.noteId}
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "8px",
              }}
            >
              <p style={{ fontSize: "13px", color: "#111", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {n.body}
              </p>
              <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "6px" }}>
                {n.createdBy ? `${n.createdBy} · ` : ""}
                {fmt(n.createdAt)}
              </p>
            </div>
          ))}
          <form onSubmit={handleAddNote} style={{ marginTop: "12px" }}>
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              style={textareaStyle}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <input
                type="text"
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                placeholder="Your name (optional)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <SubmitButton loading={addingNote} label="Add note" />
            </div>
            {noteError && <ErrorMsg>{noteError}</ErrorMsg>}
          </form>
        </Section>

        {/* ── Referrals ── */}
        <Section title={`Referrals (${referrals.length})`}>
          {referrals.length === 0 && (
            <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "12px" }}>
              No referrals yet.
            </p>
          )}
          {referrals.map((r) => (
            <div
              key={r.referralId}
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "8px",
              }}
            >
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginBottom: "4px" }}>
                {r.title}
              </p>
              {r.description && (
                <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {r.description}
                </p>
              )}
              <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "6px" }}>
                {r.createdBy ? `${r.createdBy} · ` : ""}
                {fmt(r.createdAt)}
              </p>
            </div>
          ))}
          <form onSubmit={handleAddReferral} style={{ marginTop: "12px" }}>
            <input
              type="text"
              value={refTitle}
              onChange={(e) => setRefTitle(e.target.value)}
              placeholder="Referral title *"
              style={{ ...inputStyle, width: "100%", marginBottom: "6px" }}
            />
            <textarea
              value={refDesc}
              onChange={(e) => setRefDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              style={textareaStyle}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <input
                type="text"
                value={refAuthor}
                onChange={(e) => setRefAuthor(e.target.value)}
                placeholder="Your name (optional)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <SubmitButton loading={addingRef} label="Add referral" />
            </div>
            {refError && <ErrorMsg>{refError}</ErrorMsg>}
          </form>
        </Section>
        </div>
        {/* ── Right column: full-height conversation ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <MessageThread session={session} assignedNav={assignedNav} />
        </div>
      </div>
    </div>
  );
};

// ── Navigator pool tab ────────────────────────────────────────────────────────

const NavigatorPoolPanel: React.FC<{
  navigators: Navigator[];
  sessions: DashSession[];
  loading: boolean;
  onRefresh: () => void;
}> = ({ navigators, sessions, loading, onRefresh }) => {
  // Compute active load per navigator
  const activeLoad = (navId: string) =>
    sessions.filter(
      (s) => s.assignedNavigatorId === navId && s.status === "active",
    ).length;

  const navStatusOrder: NavStatus[] = ["available", "away", "offline"];
  const sorted = [...navigators].sort(
    (a, b) =>
      navStatusOrder.indexOf(a.status) - navStatusOrder.indexOf(b.status),
  );

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: "#f9fafb",
        fontFamily: "'DM Sans', sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#111" }}>
            Navigator Pool
          </h2>
          <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
            {navigators.filter((n) => n.status === "available").length} available ·{" "}
            {navigators.filter((n) => n.isGeneralIntake && n.status === "available").length}{" "}
            general-intake
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{
            background: "none",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: "12px",
            padding: "5px 12px",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Legend */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "16px",
          fontSize: "12px",
          color: "#6b7280",
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <span>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>●</span> Available
        </span>
        <span>
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>●</span> Away
        </span>
        <span>
          <span style={{ color: "#9ca3af", fontWeight: 700 }}>●</span> Offline
        </span>
        <span>
          <strong style={{ color: "#111" }}>Intake</strong> = eligible for initial assignment
        </span>
        <span>
          <strong style={{ color: "#6366f1" }}>Specialist</strong> = transfer targets only
        </span>
      </div>

      {loading && navigators.length === 0 && (
        <p style={{ fontSize: "13px", color: "#9ca3af" }}>Loading navigators…</p>
      )}
      {!loading && navigators.length === 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "24px",
            textAlign: "center",
            color: "#9ca3af",
            fontSize: "14px",
          }}
        >
          No navigators found.
          <br />
          <span style={{ fontSize: "12px", marginTop: "6px", display: "block" }}>
            Start the backend with <code style={{ fontFamily: "'DM Mono', monospace" }}>SEED_NAVIGATORS=true</code> to load test data.
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sorted.map((nav) => {
          const load = activeLoad(nav.id);
          const loadPct = nav.capacity > 0 ? Math.round((load / nav.capacity) * 100) : 0;

          return (
            <div
              key={nav.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "14px 16px",
                opacity: nav.status === "offline" ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <NavStatusDot status={nav.status} />
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#111",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {nav.userId.replace(/@|:.*$/g, "")}
                    </div>
                    <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "1px" }}>
                      {nav.id.slice(0, 12)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontFamily: "'DM Mono', monospace",
                      letterSpacing: "0.05em",
                      background: nav.isGeneralIntake ? "#f0fdf4" : "#f5f3ff",
                      color: nav.isGeneralIntake ? "#166534" : "#6366f1",
                      border: `1px solid ${nav.isGeneralIntake ? "#bbf7d0" : "#ddd6fe"}`,
                    }}
                  >
                    {nav.isGeneralIntake ? "INTAKE" : "SPECIALIST"}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      fontFamily: "'DM Mono', monospace",
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    {nav.navGroup}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  flexWrap: "wrap",
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                <span>
                  <strong style={{ color: "#374151" }}>Languages:</strong>{" "}
                  {nav.languages.join(", ")}
                </span>
                <span>
                  <strong style={{ color: "#374151" }}>Status:</strong> {nav.status}
                </span>
                <span>
                  <strong style={{ color: "#374151" }}>Load:</strong> {load}/{nav.capacity}{" "}
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: loadPct >= 80 ? "#b91c1c" : loadPct >= 50 ? "#f59e0b" : "#22c55e",
                    }}
                  >
                    ({loadPct}%)
                  </span>
                </span>
              </div>

              {nav.expertiseTags.length > 0 && (
                <div style={{ marginTop: "8px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {nav.expertiseTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: "10px",
                        padding: "1px 6px",
                        borderRadius: "3px",
                        background: "#f3f4f6",
                        color: "#6b7280",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Navigator Dashboard root ──────────────────────────────────────────────────

type Tab = "sessions" | "navigators";

const NavigatorDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<DashSession[]>([]);
  const [navigators, setNavigators] = useState<Navigator[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingNavs, setLoadingNavs] = useState(true);
  const [tab, setTab] = useState<Tab>("sessions");

  const loadSessions = async () => {
    try {
      const data = await apiFetch<DashSession[]>("/api/sessions");
      setSessions(data);
    } catch (err) {
      console.error("[NavigatorDashboard] Failed to load sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadNavigators = async () => {
    try {
      const data = await apiFetch<Navigator[]>("/api/navigators");
      setNavigators(data);
    } catch (err) {
      console.error("[NavigatorDashboard] Failed to load navigators:", err);
    } finally {
      setLoadingNavs(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadNavigators();
    const interval = setInterval(loadSessions, 10_000);
    return () => clearInterval(interval);
  }, []);

  const selectedSession = sessions.find((s) => s.sessionId === selectedId) ?? null;

  const handleSessionUpdated = (updated: DashSession) => {
    setSessions((prev) =>
      prev.map((s) => (s.sessionId === updated.sessionId ? updated : s)),
    );
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    border: "none",
    borderBottom: active ? "2px solid #f5c800" : "2px solid transparent",
    background: "none",
    color: active ? "#fff" : "#6b7280",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "color 0.1s",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { background: #111; }
      `}</style>
      <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
        {/* ── Left sidebar ── */}
        <div
          style={{
            width: "268px",
            flexShrink: 0,
            background: "#111",
            borderRight: "1px solid #1f2937",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          {/* Dashboard header */}
          <div
            style={{
              padding: "16px 16px 0",
              borderBottom: "1px solid #1f2937",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
                Navigator Dashboard
              </div>
              <a
                href="/supervisor"
                style={{
                  fontSize: "11px",
                  color: "#6b7280",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
                title="Supervisor view"
              >
                Supervisor ↗
              </a>
            </div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "0" }}>
              <button onClick={() => setTab("sessions")} style={tabStyle(tab === "sessions")}>
                Sessions
              </button>
              <button onClick={() => setTab("navigators")} style={tabStyle(tab === "navigators")}>
                Navigators
              </button>
            </div>
          </div>

          {/* Session list (only when tab = sessions) */}
          {tab === "sessions" && (
            <SessionListPanel
              sessions={sessions}
              selectedId={selectedId}
              loading={loadingSessions}
              onSelect={(id) => {
                setSelectedId(id);
              }}
              onRefresh={loadSessions}
            />
          )}

          {/* Navigator count summary (only when tab = navigators) */}
          {tab === "navigators" && (
            <div style={{ padding: "16px", flex: 1 }}>
              <div style={{ fontSize: "11px", color: "#6b7280" }}>
                {navigators.length} navigator{navigators.length !== 1 ? "s" : ""}
                {" · "}
                {navigators.filter((n) => n.status === "available").length} available
              </div>
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        {tab === "sessions" ? (
          selectedSession ? (
            <SessionDetailPanel
              session={selectedSession}
              navigators={navigators}
              onSessionUpdated={handleSessionUpdated}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f9fafb",
                color: "#9ca3af",
                fontSize: "14px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Select a session to view details
            </div>
          )
        ) : (
          <NavigatorPoolPanel
            navigators={navigators}
            sessions={sessions}
            loading={loadingNavs}
            onRefresh={loadNavigators}
          />
        )}
      </div>
    </>
  );
};

export default NavigatorDashboard;
