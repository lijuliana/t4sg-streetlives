/**
 * Guest session management for the Streetlives chat app.
 *
 * Guests have no Matrix credentials — the backend service account owns all
 * Matrix interaction. A guest session is an opaque sessionId plus the
 * metadata the backend returns at creation time.
 */

export type SessionStatus = "active" | "closed";

export interface GuestSession {
  sessionId: string;
  status: SessionStatus;
  createdAt: string; // ISO 8601
}

const CACHE_KEY = "sl_guest_session";

// ── Backend session creation ──────────────────────────────────────────────────

/**
 * Calls POST /api/sessions to create a new session and Matrix room.
 * The backend handles all Matrix interaction; the frontend receives session metadata only.
 */
export async function createGuestSession(): Promise<GuestSession> {
  const res = await fetch("/api/sessions", { method: "POST" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to create session (${res.status}): ${body}`);
  }
  const data = (await res.json()) as {
    sessionId: string;
    status: SessionStatus;
    createdAt: string;
  };
  return { sessionId: data.sessionId, status: data.status, createdAt: data.createdAt };
}

// ── Local session cache ───────────────────────────────────────────────────────

export function saveCachedGuestSession(session: GuestSession): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(session));
}

/** Returns the cached session, or null if missing or malformed. */
export function loadCachedGuestSession(): GuestSession | null {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (typeof p.sessionId === "string") {
      return {
        sessionId: p.sessionId,
        // Gracefully handle caches written before status/createdAt were added.
        status: p.status === "closed" ? "closed" : "active",
        createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Clears the cached guest session and any legacy keys from prior versions. */
export function clearCachedGuestSession(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem("mx_guest_session");
  localStorage.removeItem("mx_session");
  localStorage.removeItem("mx_room_id");
  localStorage.removeItem("mx_device_id");
}

// ── Session validation ────────────────────────────────────────────────────────

/**
 * Checks whether a cached sessionId is still known to the backend.
 * Returns the session if valid, null if the backend returns 404 (e.g. after server restart).
 */
export async function validateGuestSession(
  session: GuestSession,
): Promise<GuestSession | null> {
  try {
    const res = await fetch(`/api/sessions/${session.sessionId}`);
    if (res.status === 404) return null;
    // On any other error (network down, 5xx) assume still valid — will surface later.
    if (!res.ok) return session;
    const data = (await res.json()) as { status?: SessionStatus };
    // Sync status from server in case it was updated.
    return { ...session, status: data.status ?? session.status };
  } catch {
    return session;
  }
}
