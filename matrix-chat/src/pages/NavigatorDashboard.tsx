import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/pages/NavigatorDashboard.module.css";

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

type AvailabilitySchedule = Record<string, { start: string; end: string }>;

interface Navigator {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  navGroup: NavGroup;
  expertiseTags: string[];
  languages: string[];
  capacity: number;
  status: NavStatus;
  isGeneralIntake: boolean;
  availabilitySchedule?: AvailabilitySchedule;
  createdAt: string;
  updatedAt: string;
}

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function isInScheduledHours(schedule: AvailabilitySchedule | undefined): boolean {
  if (!schedule) return false;
  const now = new Date();
  const slot = schedule[DAY_KEYS[now.getDay()]];
  if (!slot) return false;
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= toMins(slot.start) && cur < toMins(slot.end);
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

const StatusPill: React.FC<{ status: SessionStatus }> = ({ status }) => (
  <span className={styles.statusPill} data-status={status}>
    {status}
  </span>
);

const NavStatusDot: React.FC<{ status: NavStatus }> = ({ status }) => (
  <span className={styles.navStatusDot} data-status={status} />
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>{title}</h3>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className={styles.infoRow}>
    <span className={styles.infoRowLabel}>{label}</span>
    <span className={styles.infoRowValue} data-mono={String(!!mono)}>
      {value ?? <span className={styles.infoRowEmpty}>—</span>}
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
    className={styles.submitButton}
    data-danger={String(!!danger)}
    data-loading={String(loading)}
  >
    {loading ? (loadingLabel ?? "Saving…") : label}
  </button>
);

const ErrorMsg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className={styles.errorMsg}>{children}</p>
);

// ── Session list panel (left sidebar) ────────────────────────────────────────

const SessionListPanel: React.FC<{
  sessions: DashSession[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}> = ({ sessions, selectedId, loading, onSelect, onRefresh }) => (
  <div className={styles.sessionListPanel}>
    <div className={styles.sessionListHeader}>
      <div>
        <div className={styles.sessionListTitle}>Sessions</div>
        <div className={styles.sessionListCount}>{sessions.length} total</div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        title="Refresh"
        className={styles.refreshButton}
      >
        ↻
      </button>
    </div>

    <div className={styles.sessionListBody}>
      {loading && sessions.length === 0 && (
        <div className={styles.sessionListEmpty}>Loading…</div>
      )}
      {!loading && sessions.length === 0 && (
        <div className={styles.sessionListEmpty}>No sessions yet.</div>
      )}
      {sessions.map((s) => (
        <button
          key={s.sessionId}
          type="button"
          onClick={() => onSelect(s.sessionId)}
          className={styles.sessionButton}
          data-selected={String(selectedId === s.sessionId)}
        >
          <div className={styles.sessionButtonRow}>
            <span className={styles.sessionButtonId}>
              #{s.sessionId.slice(0, 8)}
            </span>
            <StatusPill status={s.status} />
          </div>
          <div className={styles.sessionButtonMeta}>
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
    let cancelled = false;
    apiFetch<SessionEvent[]>(`/api/sessions/${sessionId}/events`)
      .then((data) => { if (!cancelled) { setEvents(data); setLoading(false); } })
      .catch((e) => { if (!cancelled) { console.error(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <Section title={`Events (${events.length})`}>
      <button
        type="button"
        onClick={loadEvents}
        className={styles.eventsRefreshButton}
      >
        Refresh
      </button>

      {loading && <p className={styles.eventsEmpty}>Loading…</p>}
      {!loading && events.length === 0 && (
        <p className={styles.eventsEmpty}>No events yet.</p>
      )}

      <div className={styles.eventsList}>
        {events.map((ev) => (
          <div
            key={ev.id}
            className={styles.eventRow}
            data-event-type={ev.eventType}
          >
            <div className={styles.eventRowHeader}>
              <span
                className={styles.eventType}
                data-event-type={ev.eventType}
              >
                {ev.eventType}
              </span>
              <span className={styles.eventMeta}>
                {fmt(ev.timestamp)}
                {ev.actor ? ` · ${ev.actor}` : ""}
              </span>
            </div>
            {Object.keys(ev.metadata).length > 0 && (
              <pre className={styles.eventMetaJson}>
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
  const [language, setLanguage] = useState("");
  const [reason, setReason] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
        <p className={styles.transferClosed}>Session is closed.</p>
      </Section>
    );
  }

  return (
    <Section title="Transfer">
      {/* Mode toggle */}
      <div className={styles.transferModeRow}>
        {(["manual", "auto"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={styles.transferModeButton}
            data-active={String(mode === m)}
          >
            {m === "manual" ? "Pick navigator" : "Re-run routing"}
          </button>
        ))}
      </div>

      <form onSubmit={handleTransfer} className={styles.transferForm}>
        {mode === "manual" ? (
          <div>
            <label htmlFor="transfer-target" className={styles.transferFieldLabel}>
              Target navigator
            </label>
            <select
              id="transfer-target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={[styles.selectControl, styles.inputWidthFull].join(" ")}
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
              <p className={styles.noNavMessage}>
                No available navigators to transfer to.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="transfer-language" className={styles.transferFieldLabel}>
              Language (optional override)
            </label>
            <input
              id="transfer-language"
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. es, zh (leave blank to match any)"
              className={[styles.inputControl, styles.inputWidthFull].join(" ")}
            />
          </div>
        )}

        <div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            aria-label="Transfer reason"
            className={[styles.inputControl, styles.inputWidthFull].join(" ")}
          />
        </div>

        <div>
          <SubmitButton loading={transferring} label="Transfer" loadingLabel="Transferring…" />
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {success && <p className={styles.transferSuccess}>{success}</p>}
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
    <div className={styles.threadRoot}>
      {/* Header */}
      <div className={styles.threadHeader}>
        <h3 className={styles.threadHeaderTitle}>
          Conversation ({messages.length})
        </h3>
        <span className={styles.threadPollNote}>polls every 4s</span>
      </div>

      {/* Message list */}
      <div className={styles.threadMessageList}>
        {messages.length === 0 && (
          <p className={styles.threadEmptyMsg}>No messages yet.</p>
        )}
        {messages.map((msg) => {
          const isGuest = msg.senderType === "guest";
          const isSystem = msg.senderType === "system";
          const align = isGuest ? "start" : isSystem ? "center" : "end";
          return (
            <div
              key={msg.id}
              className={styles.threadMsgWrapper}
              data-align={align}
            >
              {!isSystem && (
                <span className={styles.threadSenderLabel}>{msg.senderLabel}</span>
              )}
              <div
                className={styles.threadBubble}
                data-sender={msg.senderType}
              >
                {msg.text}
              </div>
              <span className={styles.threadTimestamp}>
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
        <form onSubmit={handleSend} className={styles.threadReplyForm}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
            }}
            placeholder={`Reply as ${assignedNav?.userId.replace(/@|:.*$/g, "") ?? "navigator"}…`}
            rows={2}
            disabled={sending}
            className={styles.threadReplyTextarea}
          />
          <button
            type="submit"
            disabled={sending || !replyText.trim()}
            className={styles.threadSendButton}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      ) : (
        <div className={styles.threadDisabledReply}>
          {session.status === "closed"
            ? "Session closed — replies disabled."
            : "No navigator assigned — replies disabled."}
        </div>
      )}

      {sendError && (
        <div className={styles.threadSendErrorWrapper}>
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
    <div className={styles.detailPanelRoot}>
      {/* Top bar */}
      <div className={styles.detailTopBar}>
        <div>
          <div className={styles.detailTopBarTitle}>
            <span className={styles.detailTopBarTitleId}>
              #{session.sessionId.slice(0, 8)}
            </span>
            <StatusPill status={session.status} />
          </div>
          <div className={styles.detailTopBarMeta}>
            Created {fmt(session.createdAt)}
            {session.closedAt && ` · Closed ${fmt(session.closedAt)}`}
          </div>
        </div>
        {session.status !== "closed" && (
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className={styles.closeSessionButton}
          >
            {closing ? "Closing…" : "Close session"}
          </button>
        )}
      </div>

      {/* Two-column body */}
      <div className={styles.detailBody}>
        {/* Left sidebar: metadata / debug / controls */}
        <div ref={detailRef} className={styles.detailSidebar}>
          {/* Session metadata */}
          <Section title="Session">
            <InfoRow label="Session ID" value={session.sessionId} mono />
            <InfoRow label="Matrix room" value={session.matrixRoomId} mono />
            <InfoRow label="Status" value={<StatusPill status={session.status} />} />
            <InfoRow label="Need category" value={session.needCategory} />
            <InfoRow label="Created" value={fmt(session.createdAt)} />
            {session.closedAt && <InfoRow label="Closed" value={fmt(session.closedAt)} />}
          </Section>

          {/* Routing debug */}
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
                  <span className={styles.routingFailReason}>{session.routingFailReason}</span>
                }
              />
            )}
            {session.routingReason && (
              <div>
                <div className={styles.routingReasonHeading}>Routing reason</div>
                <div className={styles.routingChips}>
                  {[
                    ["Intake only", session.routingReason.generalIntakeOnly ? "yes" : "no"],
                    ["Language", session.routingReason.languageRequested ?? "any"],
                    ["Lang match", session.routingReason.languageMatch ? "yes" : "no"],
                    ["Load ratio", session.routingReason.loadRatio.toFixed(2)],
                    ["Score", session.routingReason.score.toFixed(2)],
                  ].map(([k, v]) => (
                    <span key={k} className={styles.routingChip}>
                      {k}: <strong>{v}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Transfer */}
          <TransferSection
            session={session}
            navigators={navigators}
            onTransferred={onSessionUpdated}
          />

          {/* Events audit log */}
          <SessionEventsSection sessionId={session.sessionId} />

          {/* Notes */}
          <Section title={`Notes (${notes.length})`}>
            {notes.length === 0 && (
              <p className={styles.emptyMsg}>No notes yet.</p>
            )}
            {notes.map((n) => (
              <div key={n.noteId} className={styles.noteCard}>
                <p className={styles.noteBody}>{n.body}</p>
                <p className={styles.noteMeta}>
                  {n.createdBy ? `${n.createdBy} · ` : ""}
                  {fmt(n.createdAt)}
                </p>
              </div>
            ))}
            <form onSubmit={handleAddNote} className={styles.noteFormWrapper}>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                className={styles.textareaControl}
              />
              <div className={styles.noteFormRow}>
                <input
                  type="text"
                  value={noteAuthor}
                  onChange={(e) => setNoteAuthor(e.target.value)}
                  placeholder="Your name (optional)"
                  aria-label="Note author"
                  className={[styles.inputControl, styles.inputFlexOne].join(" ")}
                />
                <SubmitButton loading={addingNote} label="Add note" />
              </div>
              {noteError && <ErrorMsg>{noteError}</ErrorMsg>}
            </form>
          </Section>

          {/* Referrals */}
          <Section title={`Referrals (${referrals.length})`}>
            {referrals.length === 0 && (
              <p className={styles.emptyMsg}>No referrals yet.</p>
            )}
            {referrals.map((r) => (
              <div key={r.referralId} className={styles.refCard}>
                <p className={styles.refTitle}>{r.title}</p>
                {r.description && (
                  <p className={styles.refDesc}>{r.description}</p>
                )}
                <p className={styles.refMeta}>
                  {r.createdBy ? `${r.createdBy} · ` : ""}
                  {fmt(r.createdAt)}
                </p>
              </div>
            ))}
            <form onSubmit={handleAddReferral} className={styles.refFormWrapper}>
              <input
                type="text"
                value={refTitle}
                onChange={(e) => setRefTitle(e.target.value)}
                placeholder="Referral title *"
                className={[styles.inputControl, styles.inputWidthFull, styles.inputMarginBottom].join(" ")}
              />
              <textarea
                value={refDesc}
                onChange={(e) => setRefDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className={styles.textareaControl}
              />
              <div className={styles.refFormRow}>
                <input
                  type="text"
                  value={refAuthor}
                  onChange={(e) => setRefAuthor(e.target.value)}
                  placeholder="Your name (optional)"
                  aria-label="Referral author"
                  className={[styles.inputControl, styles.inputFlexOne].join(" ")}
                />
                <SubmitButton loading={addingRef} label="Add referral" />
              </div>
              {refError && <ErrorMsg>{refError}</ErrorMsg>}
            </form>
          </Section>
        </div>

        {/* Right column: full-height conversation */}
        <div className={styles.detailMainCol}>
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
    <div className={styles.poolPanel}>
      <div className={styles.poolHeader}>
        <div>
          <h2 className={styles.poolTitle}>Navigator Pool</h2>
          <p className={styles.poolSubtitle}>
            {navigators.filter((n) => n.status === "available").length} available ·{" "}
            {navigators.filter((n) => n.isGeneralIntake && n.status === "available").length}{" "}
            general-intake
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className={styles.poolRefreshButton}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Legend */}
      <div className={styles.poolLegend}>
        <span><span className={styles.legendDotAvailable}>●</span> Available</span>
        <span><span className={styles.legendDotAway}>●</span> Away</span>
        <span><span className={styles.legendDotOffline}>●</span> Offline</span>
        <span>
          <strong>Intake</strong> = eligible for initial assignment
        </span>
        <span>
          <strong>Specialist</strong> = transfer targets only
        </span>
      </div>

      {loading && navigators.length === 0 && (
        <p className={styles.emptyMsg}>Loading navigators…</p>
      )}
      {!loading && navigators.length === 0 && (
        <div className={styles.poolEmpty}>
          No navigators found.
          <br />
          <span className={styles.poolEmptyHint}>
            Start the backend with{" "}
            <code className={styles.poolEmptyCode}>SEED_NAVIGATORS=true</code>{" "}
            to load test data.
          </span>
        </div>
      )}

      <div className={styles.navCardList}>
        {sorted.map((nav) => {
          const load = activeLoad(nav.id);
          const loadPct = nav.capacity > 0 ? Math.round((load / nav.capacity) * 100) : 0;
          const loadLevel = loadPct >= 80 ? "high" : loadPct >= 50 ? "medium" : "low";

          const displayName =
            nav.firstName || nav.lastName
              ? `${nav.firstName ?? ""} ${nav.lastName ?? ""}`.trim()
              : nav.userId.replace(/@|:.*$/g, "");
          const inHours = isInScheduledHours(nav.availabilitySchedule);
          const hasSchedule = !!nav.availabilitySchedule;

          return (
            <div
              key={nav.id}
              className={styles.navCard}
              data-status={nav.status}
            >
              <div className={styles.navCardTop}>
                <div className={styles.navCardIdentity}>
                  <NavStatusDot status={nav.status} />
                  <div>
                    <div className={styles.navCardName}>{displayName}</div>
                    <div className={styles.navCardId}>{nav.navGroup.replace(/_/g, " ")}</div>
                  </div>
                </div>

                <div className={styles.navCardBadges}>
                  {hasSchedule && (
                    <span
                      className={styles.availabilityBadge}
                      data-in-hours={String(inHours)}
                    >
                      {inHours ? "In hours" : "Out of hours"}
                    </span>
                  )}
                  <span
                    className={styles.navRoleBadge}
                    data-intake={String(nav.isGeneralIntake)}
                  >
                    {nav.isGeneralIntake ? "INTAKE" : "SPECIALIST"}
                  </span>
                </div>
              </div>

              <div className={styles.navCardStats}>
                <span>
                  <strong className={styles.statLabel}>Languages:</strong>{" "}
                  {nav.languages.join(", ")}
                </span>
                <span>
                  <strong className={styles.statLabel}>Status:</strong> {nav.status}
                </span>
                <span>
                  <strong className={styles.statLabel}>Load:</strong> {load}/{nav.capacity}{" "}
                  <span className={styles.loadPct} data-level={loadLevel}>
                    ({loadPct}%)
                  </span>
                </span>
              </div>

              {nav.expertiseTags.length > 0 && (
                <div className={styles.navCardTags}>
                  {nav.expertiseTags.map((tag) => (
                    <span key={tag} className={styles.navTag}>{tag}</span>
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

  return (
    <div className={styles.dashboardRoot}>
      {/* Left sidebar */}
      <div className={styles.sidebar}>
        {/* Dashboard header */}
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarHeaderRow}>
            <div className={styles.dashboardTitle}>Navigator Dashboard</div>
            <a
              href="/supervisor"
              className={styles.supervisorLink}
              title="Supervisor view"
            >
              Supervisor ↗
            </a>
          </div>
          {/* Tabs */}
          <div className={styles.tabRow}>
            <button
              type="button"
              onClick={() => setTab("sessions")}
              className={styles.tab}
              data-active={String(tab === "sessions")}
            >
              Sessions
            </button>
            <button
              type="button"
              onClick={() => setTab("navigators")}
              className={styles.tab}
              data-active={String(tab === "navigators")}
            >
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
          <div className={styles.navCountSummary}>
            <div className={styles.navCountText}>
              {navigators.length} navigator{navigators.length !== 1 ? "s" : ""}
              {" · "}
              {navigators.filter((n) => n.status === "available").length} available
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      {tab === "sessions" ? (
        selectedSession ? (
          <SessionDetailPanel
            session={selectedSession}
            navigators={navigators}
            onSessionUpdated={handleSessionUpdated}
          />
        ) : (
          <div className={styles.emptyDetail}>
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
  );
};

export default NavigatorDashboard;
