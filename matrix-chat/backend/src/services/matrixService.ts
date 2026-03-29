/**
 * Thin wrapper around the Matrix Client-Server API.
 * All Matrix I/O for the backend lives here so route handlers stay clean.
 *
 * Token management is handled by matrixAuth.ts — this module calls
 * getAuthManager().getToken() before each request and retries exactly once
 * after getAuthManager().handleTokenRejected() on M_UNKNOWN_TOKEN.
 *
 * Uses the built-in fetch (Node ≥ 18). No matrix-js-sdk on the backend.
 *
 * Encryption note: rooms are created unencrypted. Upgrade path: add the
 * m.room.encryption state event to createRoom's initial_state and call
 * initRustCrypto() on any future Matrix-connected client.
 */

import { getAuthManager } from "./matrixAuth.js";

// ── Error type ────────────────────────────────────────────────────────────────

interface MatrixErrorBody {
  errcode?: string;
  error?: string;
}

class MatrixApiError extends Error {
  constructor(
    message: string,
    public readonly errcode?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MatrixApiError";
  }
}

// ── Core request helpers ──────────────────────────────────────────────────────

/** Executes one authenticated Matrix request without any retry logic. */
async function executeRequest<T>(
  method: "GET" | "POST" | "PUT",
  baseUrl: string,
  path: string,
  body: unknown,
  token: string,
): Promise<T> {
  const url = `${baseUrl}/_matrix/client/v3${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...(method !== "GET" && { "Content-Type": "application/json" }),
      Authorization: `Bearer ${token}`,
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as T | MatrixErrorBody;

  if (!res.ok) {
    const err = json as MatrixErrorBody;
    throw new MatrixApiError(
      `Matrix ${method} ${path} failed [${res.status}]: ${err.error ?? "unknown"} (${err.errcode ?? "no errcode"})`,
      err.errcode,
      res.status,
    );
  }

  return json as T;
}

/**
 * Authenticated Matrix request with automatic token-refresh retry.
 *
 * On M_UNKNOWN_TOKEN: asks the auth manager to refresh/re-login, then retries
 * the request exactly once. Any further failure propagates to the caller.
 */
async function matrixRequest<T>(
  method: "GET" | "POST" | "PUT",
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<T> {
  const auth = getAuthManager();
  const token = await auth.getToken();

  try {
    return await executeRequest<T>(method, baseUrl, path, body, token);
  } catch (err) {
    if (err instanceof MatrixApiError && err.errcode === "M_UNKNOWN_TOKEN") {
      const freshToken = await auth.handleTokenRejected();
      // Retry once with the new token. If this also fails, the error propagates.
      return executeRequest<T>(method, baseUrl, path, body, freshToken);
    }
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a private, unencrypted room using the service account.
 * The room name and topic embed the internal sessionId so navigators can
 * identify chats easily in Element and in the future dashboard.
 *
 * Naming scheme:
 *   Name:  "Chat · {sessionId[:8]}"   — short, non-sensitive identifier
 *   Topic: "Streetlives session | ID: {sessionId}"
 *
 * The service account becomes the room creator and sole initial member.
 */
export async function createRoom(
  baseUrl: string,
  sessionId: string,
): Promise<{ roomId: string }> {
  const shortId = sessionId.slice(0, 8);
  const res = await matrixRequest<{ room_id: string }>("POST", baseUrl, "/createRoom", {
    preset: "private_chat",
    visibility: "private",
    name: `Chat · ${shortId}`,
    topic: `Streetlives session | ID: ${sessionId}`,
    // Encryption upgrade path:
    //   initial_state: [{
    //     type: "m.room.encryption",
    //     state_key: "",
    //     content: { algorithm: "m.megolm.v1.aes-sha2" },
    //   }],
  });
  return { roomId: res.room_id };
}

export interface RoomMessage {
  eventId: string;
  body: string;
  timestamp: number; // epoch ms
}

/**
 * Fetches the most recent messages from a Matrix room (up to 200 events).
 * Returns events in chronological order (oldest first).
 *
 * Callers are responsible for deduplication — this function always fetches
 * from the homeserver and returns everything it finds.
 */
export async function fetchRoomMessages(
  baseUrl: string,
  roomId: string,
): Promise<RoomMessage[]> {
  const path = `/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=200`;
  const data = await matrixRequest<{
    chunk: Array<{
      event_id: string;
      type: string;
      content: { msgtype?: string; body?: string };
      origin_server_ts: number;
    }>;
  }>("GET", baseUrl, path, null);

  // chunk is newest-first; reverse for chronological order
  return data.chunk
    .filter(
      (ev) =>
        ev.type === "m.room.message" &&
        ev.content.msgtype === "m.text" &&
        typeof ev.content.body === "string",
    )
    .reverse()
    .map((ev) => ({
      eventId: ev.event_id,
      body: ev.content.body as string,
      timestamp: ev.origin_server_ts,
    }));
}

/**
 * Sends a plain-text message to a room as the service account.
 * The displayName prefix (e.g. "[Guest]") is prepended so Navigator-side
 * Matrix clients can identify the sender until per-user accounts are added.
 */
export async function sendMessage(
  baseUrl: string,
  roomId: string,
  displayName: string,
  body: string,
): Promise<void> {
  const txnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await matrixRequest(
    "PUT",
    baseUrl,
    `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    { msgtype: "m.text", body: `${displayName}: ${body}` },
  );
}
