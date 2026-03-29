/**
 * provision-guest.mjs
 *
 * Provisions a guest chat session for local development and testing.
 * Outputs a ready-to-use URL that you can open in a browser.
 *
 * Usage:
 *   node scripts/provision-guest.mjs
 *
 * Requires a .env.local with:
 *   VITE_MATRIX_BASE_URL=https://…
 *   VITE_MATRIX_NAVIGATOR_USER_ID=@navigator:server.org
 *
 * Also requires NAVIGATOR_ACCESS_TOKEN set as an environment variable
 * (not in .env.local to avoid accidental commits):
 *   NAVIGATOR_ACCESS_TOKEN=mat_xxx node scripts/provision-guest.mjs
 *
 * What this script does:
 *   1. Registers an anonymous guest on the homeserver
 *   2. Creates a private encrypted room using the Navigator account
 *   3. Invites the guest to that room
 *   4. Prints the URL with session params for the dev app (localhost:5173)
 *
 * In production a backend service does these same steps and redirects the
 * user to the app URL instead of printing it.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.error("Could not read .env.local — make sure it exists.");
    process.exit(1);
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    env[key] = val;
  }
  return env;
}

// ── Matrix API helpers ───────────────────────────────────────────────────────
async function matrixRequest(method, baseUrl, path, body, token) {
  const url = `${baseUrl}/_matrix/client/v3${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → HTTP ${res.status}: ${json.error ?? JSON.stringify(json)}`,
    );
  }
  return json;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const env = loadEnv();
  const BASE_URL = env["VITE_MATRIX_BASE_URL"];
  const NAVIGATOR_USER_ID = env["VITE_MATRIX_NAVIGATOR_USER_ID"];
  const NAVIGATOR_TOKEN = process.env["NAVIGATOR_ACCESS_TOKEN"];
  const APP_URL = process.env["APP_URL"] ?? "http://localhost:5173";

  if (!BASE_URL) {
    console.error("VITE_MATRIX_BASE_URL is not set in .env.local");
    process.exit(1);
  }
  if (!NAVIGATOR_TOKEN) {
    console.error(
      "Set NAVIGATOR_ACCESS_TOKEN in your shell before running this script.\n" +
      "  Example: NAVIGATOR_ACCESS_TOKEN=mat_xxx node scripts/provision-guest.mjs",
    );
    process.exit(1);
  }

  // Step 1: Register guest
  process.stdout.write("1. Registering guest… ");
  const guest = await matrixRequest("POST", BASE_URL, "/register?kind=guest", {});
  const { access_token: guestToken, user_id: guestUserId, device_id: deviceId } = guest;
  if (!guestToken || !guestUserId || !deviceId) {
    throw new Error("Guest registration did not return credentials: " + JSON.stringify(guest));
  }
  console.log(`✓  ${guestUserId}`);

  // Step 2: Create room (Navigator account)
  process.stdout.write("2. Creating room… ");
  const createBody = {
    preset: "private_chat",
    visibility: "private",
    name: "Chat with Navigator",
    initial_state: [
      {
        type: "m.room.encryption",
        state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      },
    ],
  };
  const { room_id: roomId } = await matrixRequest(
    "POST", BASE_URL, "/createRoom", createBody, NAVIGATOR_TOKEN,
  );
  console.log(`✓  ${roomId}`);

  // Step 3: Invite guest
  process.stdout.write("3. Inviting guest to room… ");
  await matrixRequest(
    "POST", BASE_URL, `/rooms/${encodeURIComponent(roomId)}/invite`,
    { user_id: guestUserId },
    NAVIGATOR_TOKEN,
  );
  console.log("✓");

  // Step 4: Optionally invite Navigator (if configured and different from token owner)
  if (NAVIGATOR_USER_ID) {
    process.stdout.write(`4. Navigator user ID configured: ${NAVIGATOR_USER_ID} (already in room as creator)\n`);
  }

  // Build the handoff URL
  const params = new URLSearchParams({
    token: guestToken,
    userId: guestUserId,
    deviceId,
    roomId,
    baseUrl: BASE_URL,
  });
  const handoffUrl = `${APP_URL}/?${params.toString()}`;

  console.log("\n─────────────────────────────────────────────");
  console.log("Guest session ready. Open this URL:\n");
  console.log(`  ${handoffUrl}`);
  console.log("\n─────────────────────────────────────────────");
  console.log("(The Navigator can join this room in Element");
  console.log(` using room ID: ${roomId})`);
}

main().catch((err) => {
  console.error("\n✗  Error:", err.message);
  process.exit(1);
});
