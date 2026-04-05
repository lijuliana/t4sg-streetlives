/**
 * Guest session management for the Streetlives chat app.
 *
 * Guests have no Matrix credentials — the backend service account owns all
 * Matrix interaction. A guest session is an opaque sessionId plus the
 * metadata the backend returns at creation time.
 */

export type SessionStatus = "unassigned" | "active" | "closed" | "transferred";

export type NeedCategory =
  | "housing"
  | "employment"
  | "health"
  | "benefits"
  | "youth_services"
  | "education"
  | "other";

export interface GuestSession {
  sessionId: string;
  status: SessionStatus;
  createdAt: string;              // ISO 8601
  assignedNavigatorId: string | null;
  routingVersion: string | null;
  routingFailReason: string | null;
}

export interface SessionStartOptions {
  language?: string;
  needCategory?: NeedCategory;
}

/**
 * Session cache is keyed in sessionStorage (tab-scoped) so each browser tab
 * acts as an independent guest. Refreshing the tab resumes the same session;
 * opening a new tab always starts fresh.
 */
const CACHE_KEY = "sl_guest_session";

// ── Backend session creation ──────────────────────────────────────────────────

/**
 * Calls POST /api/sessions to create a new session and Matrix room.
 * Accepts optional routing hints (language, needCategory) that are passed
 * to the backend routing algorithm.
 */
export async function createGuestSession(opts: SessionStartOptions = {}): Promise<GuestSession> {
  const body: Record<string, unknown> = {};
  if (opts.language) body.language = opts.language;
  if (opts.needCategory) body.needCategory = opts.needCategory;

  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to create session (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    sessionId: string;
    status: SessionStatus;
    createdAt: string;
    assignedNavigatorId: string | null;
    routingVersion: string | null;
    routingFailReason: string | null;
  };
  return {
    sessionId: data.sessionId,
    status: data.status,
    createdAt: data.createdAt,
    assignedNavigatorId: data.assignedNavigatorId,
    routingVersion: data.routingVersion,
    routingFailReason: data.routingFailReason,
  };
}

// ── Local session cache ───────────────────────────────────────────────────────

export function saveCachedGuestSession(session: GuestSession): void {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(session));
}

export function loadCachedGuestSession(): GuestSession | null {
  const raw = sessionStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (typeof p.sessionId === "string") {
      return {
        sessionId: p.sessionId,
        status: (p.status as SessionStatus | undefined) ?? "active",
        createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
        assignedNavigatorId: (p.assignedNavigatorId as string | null | undefined) ?? null,
        routingVersion: (p.routingVersion as string | null | undefined) ?? null,
        routingFailReason: (p.routingFailReason as string | null | undefined) ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCachedGuestSession(): void {
  sessionStorage.removeItem(CACHE_KEY);
}

// ── Session validation ────────────────────────────────────────────────────────

export async function validateGuestSession(
  session: GuestSession,
): Promise<GuestSession | null> {
  try {
    const res = await fetch(`/api/sessions/${session.sessionId}`);
    if (res.status === 404) return null;
    if (!res.ok) return session;
    const data = (await res.json()) as {
      status?: SessionStatus;
      assignedNavigatorId?: string | null;
      routingVersion?: string | null;
      routingFailReason?: string | null;
    };
    return {
      ...session,
      status: data.status ?? session.status,
      assignedNavigatorId: data.assignedNavigatorId ?? session.assignedNavigatorId,
      routingVersion: data.routingVersion ?? session.routingVersion,
      routingFailReason: data.routingFailReason ?? session.routingFailReason,
    };
  } catch {
    return session;
  }
}
