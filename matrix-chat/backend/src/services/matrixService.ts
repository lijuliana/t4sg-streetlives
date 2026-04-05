/**
 * Thin wrapper around the Matrix Client-Server API.
 * All Matrix I/O for the backend lives here so route handlers stay clean.
 *
 * Token management is handled by matrixAuth.ts.
 * Uses built-in fetch (Node >= 18). No matrix-js-sdk on the backend.
 *
 * Encryption note: rooms are currently created unencrypted.
 * Upgrade path: add m.room.encryption to initial_state in createRoom and call
 * initRustCrypto() on any future Matrix-connected client.
 *
 * Navigator access model:
 *   - When a navigator is assigned, they are invited to the room via inviteToRoom().
 *   - On transfer, the departing navigator is kicked via kickFromRoom() BEFORE the
 *     new navigator is invited, preserving room continuity for the guest.
 *   - The service account (room creator) always retains membership.
 *
 * Assumptions / limitations:
 *   - Navigator Matrix userIds must be pre-registered on the homeserver.
 *   - The service account must have sufficient power level to invite and kick.
 *   - Rooms are unencrypted; E2E can be layered on later without breaking the session model.
 *   - Token refresh is handled by matrixAuth.ts; invite/kick failures are non-fatal
 *     (the session assignment is still recorded in the DB even if Matrix is unreachable).
 */

import { getAuthManager } from "./matrixAuth.js";

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
      return executeRequest<T>(method, baseUrl, path, body, freshToken);
    }
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

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
  });
  return { roomId: res.room_id };
}

export interface RoomMessage {
  eventId: string;
  body: string;
  timestamp: number;
}

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
 * Returns the Matrix event_id so callers can back-fill it on the local record.
 */
export async function sendMessage(
  baseUrl: string,
  roomId: string,
  displayName: string,
  body: string,
): Promise<string | null> {
  const txnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const res = await matrixRequest<{ event_id?: string }>(
    "PUT",
    baseUrl,
    `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    { msgtype: "m.text", body: `${displayName}: ${body}` },
  );
  return res.event_id ?? null;
}

/**
 * Invites a Matrix user to a room so they can join and read messages.
 * Best-effort: Matrix errors are logged but should not block session creation.
 *
 * The invited user must accept the invite from their own Matrix client.
 * The service account must have permission to invite in this room.
 */
export async function inviteToRoom(
  baseUrl: string,
  roomId: string,
  userId: string,
): Promise<void> {
  await matrixRequest("POST", baseUrl, `/rooms/${encodeURIComponent(roomId)}/invite`, {
    user_id: userId,
  });
}

/**
 * Removes a Matrix user from a room immediately.
 * Called on navigator transfer to prevent the departing navigator from reading
 * further messages. Room continuity for the guest is unaffected.
 *
 * The service account must have sufficient power level to kick members.
 */
export async function kickFromRoom(
  baseUrl: string,
  roomId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  await matrixRequest("POST", baseUrl, `/rooms/${encodeURIComponent(roomId)}/kick`, {
    user_id: userId,
    ...(reason && { reason }),
  });
}
