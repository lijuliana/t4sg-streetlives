import React, { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionStatus = "unassigned" | "active" | "closed" | "transferred";
type EventType = "created" | "assigned" | "transferred" | "closed";

interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: EventType;
  actor: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface DashSession {
  sessionId: string;
  status: SessionStatus;
  createdAt: string;
  closedAt: string | null;
  needCategory: string | null;
  assignedNavigatorId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_COLOR: Record<EventType, string> = {
  created:     "#6b7280",
  assigned:    "#22c55e",
  transferred: "#6366f1",
  closed:      "#374151",
};

const STATUS_COLOR: Record<SessionStatus, { bg: string; color: string }> = {
  active:      { bg: "#f5c800", color: "#111" },
  unassigned:  { bg: "#f59e0b", color: "#111" },
  closed:      { bg: "#374151", color: "#9ca3af" },
  transferred: { bg: "#6366f1", color: "#fff" },
};

// ── Supervisor Page ───────────────────────────────────────────────────────────

const SupervisorPage: React.FC = () => {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [sessions, setSessions] = useState<DashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventType | "all">("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [evts, sess] = await Promise.all([
        apiFetch<SessionEvent[]>("/api/supervisor/events"),
        apiFetch<DashSession[]>("/api/supervisor/sessions"),
      ]);
      setEvents(evts);
      setSessions(sess);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, []);

  const sessionMap = new Map(sessions.map((s) => [s.sessionId, s]));

  const filtered = filter === "all" ? events : events.filter((e) => e.eventType === filter);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #1a1a1a; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          fontFamily: "'DM Sans', sans-serif",
          color: "#111",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#111",
            borderBottom: "1px solid #1f2937",
            padding: "16px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
              Supervisor View
            </div>
            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
              Cross-session audit log · refreshes every 15s
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              {sessions.length} sessions · {events.length} events
            </div>
            <button
              onClick={load}
              style={{
                background: "none",
                border: "1px solid #374151",
                borderRadius: "6px",
                color: "#9ca3af",
                cursor: "pointer",
                fontSize: "12px",
                padding: "5px 12px",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ↻ Refresh
            </button>
            <a
              href="/navigator"
              style={{
                fontSize: "12px",
                color: "#f5c800",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Navigator Dashboard
            </a>
          </div>
        </div>

        <div style={{ padding: "24px 32px", maxWidth: "1200px", margin: "0 auto" }}>
          {/* Session summary strip */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "24px",
            }}
          >
            {sessions.map((s) => {
              const { bg, color } = STATUS_COLOR[s.status] ?? STATUS_COLOR.closed;
              return (
                <div
                  key={s.sessionId}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    minWidth: "160px",
                  }}
                >
                  <div style={{ fontSize: "12px", fontFamily: "'DM Mono', monospace", fontWeight: 600, color: "#111", marginBottom: "4px" }}>
                    #{s.sessionId.slice(0, 8)}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      background: bg,
                      color,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {s.status}
                  </span>
                  {s.needCategory && (
                    <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                      {s.needCategory}
                    </div>
                  )}
                  <div style={{ fontSize: "10px", color: "#d1d5db", marginTop: "2px" }}>
                    {fmt(s.createdAt)}
                  </div>
                </div>
              );
            })}
            {!loading && sessions.length === 0 && (
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>No sessions yet.</p>
            )}
          </div>

          {/* Filter tabs */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            {(["all", "created", "assigned", "transferred", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "5px 14px",
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: filter === f ? "#111" : "#e5e7eb",
                  background: filter === f ? "#111" : "#fff",
                  color: filter === f ? "#fff" : "#374151",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  textTransform: "capitalize",
                }}
              >
                {f === "all" ? `All (${events.length})` : f}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#b91c1c",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {/* Events table */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 90px 160px 1fr 160px",
                gap: "0",
                padding: "10px 16px",
                background: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
                fontSize: "11px",
                fontWeight: 700,
                color: "#6b7280",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              <span>Session</span>
              <span>Event</span>
              <span>Time</span>
              <span>Metadata</span>
              <span>Actor</span>
            </div>

            {loading && (
              <div style={{ padding: "24px 16px", fontSize: "13px", color: "#9ca3af" }}>
                Loading…
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div style={{ padding: "24px 16px", fontSize: "13px", color: "#9ca3af" }}>
                No events{filter !== "all" ? ` of type "${filter}"` : ""} yet.
              </div>
            )}

            {filtered.map((ev, i) => {
              const sess = sessionMap.get(ev.sessionId);
              const borderColor = EVENT_COLOR[ev.eventType] ?? "#e5e7eb";
              const metaSummary = Object.keys(ev.metadata).length > 0
                ? Object.entries(ev.metadata)
                    .map(([k, v]) => `${k}: ${typeof v === "string" ? v.slice(0, 30) : JSON.stringify(v).slice(0, 30)}`)
                    .join(" · ")
                : "—";

              return (
                <div
                  key={ev.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 90px 160px 1fr 160px",
                    gap: "0",
                    padding: "10px 16px",
                    borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none",
                    borderLeft: `3px solid ${borderColor}`,
                    background: i % 2 === 0 ? "#fff" : "#fafafa",
                    alignItems: "center",
                  }}
                >
                  {/* Session ID */}
                  <div>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#111",
                      }}
                    >
                      #{ev.sessionId.slice(0, 8)}
                    </span>
                    {sess && (
                      <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "1px" }}>
                        {sess.status}
                      </div>
                    )}
                  </div>

                  {/* Event type */}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: borderColor,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    {ev.eventType}
                  </span>

                  {/* Time */}
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>
                    {fmt(ev.timestamp)}
                  </span>

                  {/* Metadata */}
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#374151",
                      fontFamily: "'DM Mono', monospace",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={JSON.stringify(ev.metadata, null, 2)}
                  >
                    {metaSummary}
                  </span>

                  {/* Actor */}
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      fontFamily: ev.actor ? "'DM Mono', monospace" : undefined,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ev.actor ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default SupervisorPage;
