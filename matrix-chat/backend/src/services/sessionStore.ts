import type { Session, SessionStatus, RoutingReason } from "../types.js";

export interface SessionStoreInterface {
  create(data: Omit<Session, "createdAt">): Session;
  findById(sessionId: string): Session | undefined;
  updateStatus(sessionId: string, status: SessionStatus, closedAt?: string): boolean;
  setNavigatorAssignment(
    sessionId: string,
    navigatorId: string | null,
    routingVersion: string | null,
    routingReason: RoutingReason | null,
  ): boolean;
  countActiveByNavigator(navigatorId: string): number;
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

  updateStatus(sessionId: string, status: SessionStatus, closedAt?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = status;
    if (closedAt !== undefined) session.closedAt = closedAt;
    return true;
  }

  setNavigatorAssignment(
    sessionId: string,
    navigatorId: string | null,
    routingVersion: string | null,
    routingReason: RoutingReason | null,
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.assignedNavigatorId = navigatorId;
    session.routingVersion = routingVersion;
    session.routingReason = routingReason;
    return true;
  }

  countActiveByNavigator(navigatorId: string): number {
    return Array.from(this.sessions.values()).filter(
      (s) => s.assignedNavigatorId === navigatorId && s.status === "active",
    ).length;
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }
}

// Singleton — replace with a DB-backed implementation when persistence is needed.
export const sessionStore: SessionStoreInterface = new InMemorySessionStore();
