import React, { useEffect, useRef, useState } from "react";

// ── Local types (mirror backend shapes) ──────────────────────────────────────

interface DashSession {
  sessionId: string;
  matrixRoomId: string;
  status: "active" | "closed";
  createdAt: string;
  navigatorId: string | null;
  referralId: string | null;
  closedAt: string | null;
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
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: DashSession["status"] }> = ({ status }) => (
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
      background: status === "active" ? "#f5c800" : "#374151",
      color: status === "active" ? "#111" : "#9ca3af",
    }}
  >
    {status}
  </span>
);

// ── Session list (left panel) ─────────────────────────────────────────────────

const SessionListPanel: React.FC<{
  sessions: DashSession[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}> = ({ sessions, selectedId, loading, onSelect, onRefresh }) => (
  <div
    style={{
      width: "280px",
      flexShrink: 0,
      background: "#111",
      borderRight: "1px solid #1f2937",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
    }}
  >
    {/* Header */}
    <div
      style={{
        padding: "20px 18px 14px",
        borderBottom: "1px solid #1f2937",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.01em",
          }}
        >
          Navigator Dashboard
        </div>
        <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
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
          lineHeight: 1,
        }}
      >
        ↻
      </button>
    </div>

    {/* List */}
    <div style={{ flex: 1, overflowY: "auto" }}>
      {loading && sessions.length === 0 && (
        <div style={{ padding: "24px 18px", color: "#6b7280", fontSize: "13px" }}>
          Loading…
        </div>
      )}
      {!loading && sessions.length === 0 && (
        <div style={{ padding: "24px 18px", color: "#6b7280", fontSize: "13px" }}>
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
            padding: "12px 18px",
            cursor: "pointer",
            transition: "background 0.1s",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "4px",
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
          <div style={{ fontSize: "11px", color: "#6b7280" }}>{fmt(s.createdAt)}</div>
        </button>
      ))}
    </div>
  </div>
);

// ── Empty state (right panel, no session selected) ────────────────────────────

const EmptyPanel: React.FC = () => (
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
);

// ── Session detail (right panel) ──────────────────────────────────────────────

const SessionDetailPanel: React.FC<{
  session: DashSession;
  onSessionUpdated: (updated: DashSession) => void;
}> = ({ session, onSessionUpdated }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [closing, setClosing] = useState(false);

  // Note form
  const [noteBody, setNoteBody] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Referral form
  const [refTitle, setRefTitle] = useState("");
  const [refDesc, setRefDesc] = useState("");
  const [refAuthor, setRefAuthor] = useState("");
  const [addingRef, setAddingRef] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  const detailRef = useRef<HTMLDivElement>(null);

  const loadNotes = () =>
    apiFetch<Note[]>(`/api/sessions/${session.sessionId}/notes`).then(setNotes).catch(console.error);
  const loadReferrals = () =>
    apiFetch<Referral[]>(`/api/sessions/${session.sessionId}/referrals`).then(setReferrals).catch(console.error);

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
      await apiFetch(`/api/sessions/${session.sessionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      onSessionUpdated({ ...session, status: "closed", closedAt: new Date().toISOString() });
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

  return (
    <div
      ref={detailRef}
      style={{
        flex: 1,
        overflowY: "auto",
        background: "#f9fafb",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          padding: "18px 28px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#111",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontFamily: "'DM Mono', monospace" }}>
              #{session.sessionId.slice(0, 8)}
            </span>
            <StatusPill status={session.status} />
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "3px" }}>
            Created {fmt(session.createdAt)}
            {session.closedAt && ` · Closed ${fmt(session.closedAt)}`}
          </div>
        </div>
        {session.status === "active" && (
          <button
            onClick={handleClose}
            disabled={closing}
            style={{
              padding: "7px 16px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#b91c1c",
              fontSize: "13px",
              fontWeight: 600,
              cursor: closing ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {closing ? "Closing…" : "Close session"}
          </button>
        )}
      </div>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ── Session info card ── */}
        <Section title="Session info">
          <InfoRow label="Session ID" value={session.sessionId} mono />
          <InfoRow label="Matrix room" value={session.matrixRoomId} mono />
          <InfoRow label="Status" value={session.status} />
          <InfoRow label="Created" value={fmt(session.createdAt)} />
          {session.closedAt && <InfoRow label="Closed" value={fmt(session.closedAt)} />}
          {session.navigatorId && <InfoRow label="Navigator" value={session.navigatorId} />}
        </Section>

        {/* ── Notes ── */}
        <Section title={`Notes (${notes.length})`}>
          {notes.length === 0 && (
            <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "12px" }}>
              No notes yet.
            </p>
          )}
          {notes.map((n) => (
            <NoteCard key={n.noteId} note={n} />
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
            <ReferralCard key={r.referralId} referral={r} />
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
    </div>
  );
};

// ── Detail sub-components ─────────────────────────────────────────────────────

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
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.06em",
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

const InfoRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({
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
    <span style={{ color: "#9ca3af", minWidth: "96px", flexShrink: 0 }}>{label}</span>
    <span
      style={{
        color: "#111",
        fontFamily: mono ? "'DM Mono', monospace" : undefined,
        fontSize: mono ? "12px" : "13px",
        wordBreak: "break-all",
      }}
    >
      {value}
    </span>
  </div>
);

const NoteCard: React.FC<{ note: Note }> = ({ note }) => (
  <div
    style={{
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      padding: "10px 14px",
      marginBottom: "8px",
    }}
  >
    <p style={{ fontSize: "13px", color: "#111", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
      {note.body}
    </p>
    <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "6px" }}>
      {note.createdBy ? `${note.createdBy} · ` : ""}
      {fmt(note.createdAt)}
    </p>
  </div>
);

const ReferralCard: React.FC<{ referral: Referral }> = ({ referral }) => (
  <div
    style={{
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: "8px",
      padding: "10px 14px",
      marginBottom: "8px",
    }}
  >
    <p style={{ fontSize: "13px", fontWeight: 600, color: "#111", marginBottom: "4px" }}>
      {referral.title}
    </p>
    {referral.description && (
      <p style={{ fontSize: "13px", color: "#374151", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
        {referral.description}
      </p>
    )}
    <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "6px" }}>
      {referral.createdBy ? `${referral.createdBy} · ` : ""}
      {fmt(referral.createdAt)}
    </p>
  </div>
);

const SubmitButton: React.FC<{ loading: boolean; label: string }> = ({ loading, label }) => (
  <button
    type="submit"
    disabled={loading}
    style={{
      padding: "7px 16px",
      borderRadius: "8px",
      border: "none",
      background: loading ? "#e5b800" : "#f5c800",
      color: "#111",
      fontSize: "13px",
      fontWeight: 600,
      cursor: loading ? "not-allowed" : "pointer",
      whiteSpace: "nowrap",
      fontFamily: "'DM Sans', sans-serif",
    }}
  >
    {loading ? "Saving…" : label}
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

// ── Shared form styles ────────────────────────────────────────────────────────

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

// ── Root dashboard component ──────────────────────────────────────────────────

const NavigatorDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<DashSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    try {
      const data = await apiFetch<DashSession[]>("/api/sessions");
      setSessions(data);
    } catch (err) {
      console.error("[NavigatorDashboard] Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { background: #111; }
      `}</style>
      <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
        <SessionListPanel
          sessions={sessions}
          selectedId={selectedId}
          loading={loading}
          onSelect={setSelectedId}
          onRefresh={loadSessions}
        />
        {selectedSession ? (
          <SessionDetailPanel
            session={selectedSession}
            onSessionUpdated={handleSessionUpdated}
          />
        ) : (
          <EmptyPanel />
        )}
      </div>
    </>
  );
};

export default NavigatorDashboard;
