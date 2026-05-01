/**
 * streetlives-matrix Lambda
 *
 * Handles all Matrix homeserver communication on behalf of the bot account.
 * Invoked by the VPC Lambda via AWS SDK InvokeFunction (not via HTTP).
 *
 * Supported operations:
 *   createRoom    — create a private Matrix room, returns { roomId }
 *   sendMessage   — send a message to a room
 *   fetchMessages — fetch messages from a room, returns { messages }
 *
 * Event shapes:
 *   { "operation": "createRoom", "sessionId": "<uuid>" }
 *   { "operation": "sendMessage", "roomId": "!abc:matrix.org", "displayName": "Navigator", "body": "hello" }
 *   { "operation": "fetchMessages", "roomId": "!abc:matrix.org" }
 *
 * Env vars required:
 *   MATRIX_BASE_URL        e.g. https://matrix.org
 *   MATRIX_BOT_USER_ID     e.g. @streetlives-bot:matrix.org
 *   MATRIX_BOT_PASSWORD    the bot account password
 *
 * Token is held in module-level memory for the lifetime of the Lambda container.
 * On cold start (or M_UNKNOWN_TOKEN), the bot re-authenticates automatically.
 */

// Token is cached in module memory and reused across warm invocations.
// On cold start or M_UNKNOWN_TOKEN, the bot re-authenticates automatically.
let cachedToken = null;

async function login() {
  const baseUrl = process.env.MATRIX_BASE_URL;
  const userId  = process.env.MATRIX_BOT_USER_ID;
  const password = process.env.MATRIX_BOT_PASSWORD;

  if (!baseUrl || !userId || !password) {
    throw new Error("Missing required env vars: MATRIX_BASE_URL, MATRIX_BOT_USER_ID, MATRIX_BOT_PASSWORD");
  }

  const res = await fetch(`${baseUrl}/_matrix/client/v3/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "m.login.password",
      identifier: { type: "m.id.user", user: userId },
      password,
      initial_device_display_name: "Streetlives Bot Lambda",
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Matrix login failed [${res.status}]: ${body.error ?? "unknown"} (${body.errcode ?? "no errcode"})`
    );
  }

  const data = await res.json();
  cachedToken = data.access_token;
  return cachedToken;
}

async function getToken() {
  if (!cachedToken) {
    await login();
  }
  return cachedToken;
}

async function matrixRequest(method, path, body) {
  const baseUrl = process.env.MATRIX_BASE_URL;
  const token = await getToken();

  const res = await fetch(`${baseUrl}/_matrix/client/v3${path}`, {
    method,
    headers: {
      ...(method !== "GET" && { "Content-Type": "application/json" }),
      Authorization: `Bearer ${token}`,
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });

  // Token rejected — force re-login once and retry
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.errcode === "M_UNKNOWN_TOKEN") {
      console.warn("[matrixAuth] Token rejected — re-logging in");
      cachedToken = null;
      const freshToken = await login();
      const retry = await fetch(`${baseUrl}/_matrix/client/v3${path}`, {
        method,
        headers: {
          ...(method !== "GET" && { "Content-Type": "application/json" }),
          Authorization: `Bearer ${freshToken}`,
        },
        body: method !== "GET" ? JSON.stringify(body) : undefined,
      });
      if (!retry.ok) {
        const retryErr = await retry.json().catch(() => ({}));
        throw new Error(
          `Matrix ${method} ${path} failed after re-login [${retry.status}]: ${retryErr.error ?? "unknown"}`
        );
      }
      return retry.json();
    }
    throw new Error(
      `Matrix ${method} ${path} failed [${res.status}]: ${err.error ?? "unknown"} (${err.errcode ?? "no errcode"})`
    );
  }

  return res.json();
}

async function createRoom(sessionId) {
  const shortId = sessionId.slice(0, 8);
  const data = await matrixRequest("POST", "/createRoom", {
    preset: "private_chat",
    visibility: "private",
    name: `Chat · ${shortId}`,
    topic: `Streetlives session | ID: ${sessionId}`,
  });
  return { roomId: data.room_id };
}

async function sendMessage(roomId, displayName, body) {
  const txnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const data = await matrixRequest(
    "PUT",
    `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
    { msgtype: "m.text", body: `${displayName}: ${body}` }
  );
  return { eventId: data.event_id ?? null };
}

async function deleteRoom(roomId) {
  const baseUrl = process.env.MATRIX_BASE_URL;
  const token = await getToken();

  // Try Synapse Admin API first (requires bot to be a server admin).
  // This permanently purges the room and all its events.
  const adminRes = await fetch(
    `${baseUrl}/_synapse/admin/v2/rooms/${encodeURIComponent(roomId)}/delete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ purge: true, block: false }),
    }
  );

  if (adminRes.status === 404) {
    return { deleted: true, method: "not_found" };
  }

  if (adminRes.ok) {
    return { deleted: true, method: "admin_delete" };
  }

  // Bot is not a server admin (or homeserver is not Synapse) — fall back to
  // having the bot leave the room so it becomes inaccessible.
  const statusText = adminRes.status;
  console.warn(`[deleteRoom] Admin delete failed (${statusText}), falling back to leave`);
  try {
    await matrixRequest("POST", `/rooms/${encodeURIComponent(roomId)}/leave`, {});
  } catch (err) {
    // Room may already be gone or bot already left — not fatal.
    console.warn(`[deleteRoom] Leave fallback failed for ${roomId}:`, err.message);
  }
  return { deleted: true, method: "leave_fallback" };
}

async function fetchMessages(roomId) {
  const path = `/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=200`;
  const data = await matrixRequest("GET", path, null);

  const messages = (data.chunk ?? [])
    .filter(
      (ev) =>
        ev.type === "m.room.message" &&
        ev.content?.msgtype === "m.text" &&
        typeof ev.content?.body === "string"
    )
    .reverse()
    .map((ev) => ({
      eventId: ev.event_id,
      body: ev.content.body,
      timestamp: ev.origin_server_ts,
    }));

  return { messages };
}

export const handler = async (event) => {
  const { operation } = event;

  try {
    switch (operation) {
      case "createRoom": {
        if (!event.sessionId) throw new Error("Missing sessionId");
        return await createRoom(event.sessionId);
      }

      case "sendMessage": {
        if (!event.roomId) throw new Error("Missing roomId");
        if (!event.body)   throw new Error("Missing body");
        const displayName = event.displayName ?? "User";
        return await sendMessage(event.roomId, displayName, event.body);
      }

      case "fetchMessages": {
        if (!event.roomId) throw new Error("Missing roomId");
        return await fetchMessages(event.roomId);
      }

      case "deleteRoom": {
        if (!event.roomId) throw new Error("Missing roomId");
        return await deleteRoom(event.roomId);
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (err) {
    console.error(`[streetlives-matrix] Error in operation '${operation}':`, err);
    // Re-throw so the VPC Lambda receives a Lambda function error (not a 200 with error body)
    throw err;
  }
};
