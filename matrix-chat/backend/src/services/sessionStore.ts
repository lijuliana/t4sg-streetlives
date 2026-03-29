import type { Session, SessionStatus } from "../types.js";

/**
 * Interface for the session store.
 * The in-memory implementation below is sufficient for local development.
 * Swap for a Postgres/SQLite implementation that satisfies the same interface
 * when persistence across restarts is needed.
 */
interface SessionStoreInterface {
  /**
   * Persists a new session. The caller is responsible for generating sessionId
   * (so it can be used in the Matrix room name before this record is written).
   */
  create(data: Omit<Session, "createdAt">): Session;
  findById(sessionId: string): Session | undefined;
  updateStatus(sessionId: string, status: SessionStatus): boolean;
  list(): Session[];
}

class InMemorySessionStore implements SessionStoreInterface {
  private readonly sessions = new Map<string, Session>();

  create(data: Omit<Session, "createdAt">): Session {
    const session: Session = {
      ...data,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  findById(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  updateStatus(sessionId: string, status: SessionStatus): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = status;
    return true;
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }
}

// Singleton — replace this export with a DB-backed implementation later.
export const sessionStore: SessionStoreInterface = new InMemorySessionStore();
