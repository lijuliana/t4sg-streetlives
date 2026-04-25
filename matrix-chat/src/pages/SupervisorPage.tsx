import React, { useEffect, useState } from "react";
import styles from "../styles/pages/SupervisorPage.module.css";

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
    <div className={styles.pageRoot}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Supervisor View</div>
          <div className={styles.pageHeaderSubtitle}>
            Cross-session audit log · refreshes every 15s
          </div>
        </div>
        <div className={styles.pageHeaderActions}>
          <div className={styles.pageHeaderCount}>
            {sessions.length} sessions · {events.length} events
          </div>
          <button
            type="button"
            onClick={load}
            className={styles.headerRefreshButton}
          >
            ↻ Refresh
          </button>
          <a href="/navigator" className={styles.navLink}>
            ← Navigator Dashboard
          </a>
        </div>
      </div>

      <div className={styles.content}>
        {/* Session summary strip */}
        <div className={styles.sessionStrip}>
          {sessions.map((s) => (
            <div key={s.sessionId} className={styles.sessionCard}>
              <div className={styles.sessionCardId}>
                #{s.sessionId.slice(0, 8)}
              </div>
              <span
                className={styles.sessionCardPill}
                data-status={s.status}
              >
                {s.status}
              </span>
              {s.needCategory && (
                <div className={styles.sessionCardCategory}>
                  {s.needCategory}
                </div>
              )}
              <div className={styles.sessionCardDate}>{fmt(s.createdAt)}</div>
            </div>
          ))}
          {!loading && sessions.length === 0 && (
            <p className={styles.noSessions}>No sessions yet.</p>
          )}
        </div>

        {/* Filter tabs */}
        <div className={styles.filterRow}>
          {(["all", "created", "assigned", "transferred", "closed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={styles.filterButton}
              data-active={String(filter === f)}
            >
              {f === "all" ? `All (${events.length})` : f}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBanner}>{error}</div>
        )}

        {/* Events table */}
        <div className={styles.eventsTable}>
          {/* Table header */}
          <div className={styles.tableHeader}>
            <span>Session</span>
            <span>Event</span>
            <span>Time</span>
            <span>Metadata</span>
            <span>Actor</span>
          </div>

          {loading && (
            <div className={styles.tableLoading}>Loading…</div>
          )}

          {!loading && filtered.length === 0 && (
            <div className={styles.tableEmpty}>
              No events{filter !== "all" ? ` of type "${filter}"` : ""} yet.
            </div>
          )}

          {filtered.map((ev) => {
            const sess = sessionMap.get(ev.sessionId);
            const metaSummary =
              Object.keys(ev.metadata).length > 0
                ? Object.entries(ev.metadata)
                    .map(
                      ([k, v]) =>
                        `${k}: ${typeof v === "string" ? v.slice(0, 30) : JSON.stringify(v).slice(0, 30)}`,
                    )
                    .join(" · ")
                : "—";

            return (
              <div
                key={ev.id}
                className={styles.eventTableRow}
                data-event-type={ev.eventType}
              >
                {/* Session ID */}
                <div>
                  <span className={styles.cellSessionId}>
                    #{ev.sessionId.slice(0, 8)}
                  </span>
                  {sess && (
                    <div className={styles.cellSessionStatus}>{sess.status}</div>
                  )}
                </div>

                {/* Event type */}
                <span
                  className={styles.cellEventType}
                  data-event-type={ev.eventType}
                >
                  {ev.eventType}
                </span>

                {/* Time */}
                <span className={styles.cellTime}>{fmt(ev.timestamp)}</span>

                {/* Metadata */}
                <span
                  className={styles.cellMeta}
                  title={JSON.stringify(ev.metadata, null, 2)}
                >
                  {metaSummary}
                </span>

                {/* Actor */}
                <span
                  className={styles.cellActor}
                  data-has-actor={String(!!ev.actor)}
                >
                  {ev.actor ?? "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SupervisorPage;
