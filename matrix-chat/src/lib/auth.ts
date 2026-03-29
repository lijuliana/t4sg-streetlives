import { createClient } from "matrix-js-sdk";

export interface StoredSession {
  accessToken: string;
  userId: string;
  deviceId: string;
  baseUrl: string;
  /** True for auto-registered guest sessions; false for password-authenticated accounts. */
  isGuest: boolean;
}

const SESSION_KEY = "mx_session";

export function saveSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const p = parsed as Record<string, unknown>;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof p.accessToken === "string" &&
      typeof p.userId === "string" &&
      typeof p.deviceId === "string" &&
      typeof p.baseUrl === "string"
    ) {
      return {
        accessToken: p.accessToken,
        userId: p.userId,
        deviceId: p.deviceId,
        baseUrl: p.baseUrl,
        // Backward-compat: sessions written before isGuest was added default to false.
        isGuest: typeof p.isGuest === "boolean" ? p.isGuest : false,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  // Remove legacy device ID key that the old matrixClient.ts stored separately
  localStorage.removeItem("mx_device_id");
}

/**
 * Validates a session by calling /whoami. Returns an updated session (with the
 * authoritative deviceId from the server) if the token is still valid, or null
 * if the token has expired or been revoked.
 */
export async function validateSession(
  session: StoredSession,
): Promise<StoredSession | null> {
  const tmp = createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
  });
  try {
    const whoami = await tmp.whoami();
    // Write back the server's authoritative device_id so _init() uses accurate data.
    const deviceId = whoami.device_id ?? session.deviceId;
    return { ...session, deviceId };
  } catch {
    return null;
  } finally {
    tmp.stopClient();
  }
}

/**
 * Logs in with Matrix password auth and returns a StoredSession.
 * userId may be a full MXID (@user:server.org) or a bare localpart.
 */
export async function loginWithPassword(
  baseUrl: string,
  userId: string,
  password: string,
): Promise<StoredSession> {
  const tmp = createClient({ baseUrl });
  try {
    // Map the snake_case SDK response to our camelCase StoredSession shape.
    // Pass a single request object (type field included) to use the non-deprecated overload.
    const response = await tmp.login({
      type: "m.login.password",
      identifier: { type: "m.id.user", user: userId },
      password,
      initial_device_display_name: "Streetlives Navigator",
    });
    return {
      accessToken: response.access_token,
      userId: response.user_id,
      deviceId: response.device_id,
      baseUrl,
      isGuest: false,
    };
  } finally {
    tmp.stopClient();
  }
}
