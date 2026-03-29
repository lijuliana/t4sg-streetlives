import { createClient, IndexedDBStore, ClientEvent, SyncState } from "matrix-js-sdk";
import type { MatrixClient } from "matrix-js-sdk";

// ── Static config from env (non-sensitive, deployment-time values) ────────────
export const DEFAULT_BASE_URL = import.meta.env.VITE_MATRIX_BASE_URL as string;
export const NAVIGATOR_USER_ID = import.meta.env
  .VITE_MATRIX_NAVIGATOR_USER_ID as string;

// ── Auth error class ─────────────────────────────────────────────────────────
export class MatrixAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatrixAuthError";
  }
}

// ── Session credentials accepted by this module ──────────────────────────────
// Intentionally minimal — matrixClient.ts does not care whether the session
// came from backend guest-provisioning or Navigator password login.
export interface MatrixSessionConfig {
  accessToken: string;
  userId: string;
  deviceId: string;
  baseUrl: string;
  isGuest: boolean;
}

// ── Singleton state ──────────────────────────────────────────────────────────
let _session: MatrixSessionConfig | null = null;
let _clientPromise: Promise<MatrixClient> | null = null;
let _activeClient: MatrixClient | null = null;

/**
 * Call once after a session is obtained (from backend or cache) before calling
 * getMatrixClient(). Stops and discards any previously running client.
 */
export function setMatrixSession(session: MatrixSessionConfig): void {
  if (_activeClient) {
    _activeClient.stopClient();
    _activeClient = null;
  }
  _session = session;
  _clientPromise = null;
}

/**
 * Stops the running client and clears all session state.
 */
export function resetMatrixClient(): void {
  if (_activeClient) {
    _activeClient.stopClient();
    _activeClient = null;
  }
  _session = null;
  _clientPromise = null;
}

/**
 * Returns a Promise that resolves to the ready MatrixClient singleton.
 * setMatrixSession() must be called before the first call.
 * Rejects with MatrixAuthError if no session is set or the session is invalid.
 */
export function getMatrixClient(): Promise<MatrixClient> {
  if (!_clientPromise) {
    if (!_session) {
      return Promise.reject(
        new MatrixAuthError("No active session."),
      );
    }
    const session = _session;
    _clientPromise = _init(session).catch((err) => {
      _clientPromise = null; // allow retry after transient failure
      throw err;
    });
  }
  return _clientPromise;
}

async function _init(session: MatrixSessionConfig): Promise<MatrixClient> {
  const { accessToken, userId, deviceId, baseUrl } = session;

  // ── 1. Clear the IndexedDB room store if the device ID has changed ────────
  // The room store holds per-device sync state. A stale store from a prior
  // device causes the SDK to resume from the wrong sync token.
  const storedDeviceId = localStorage.getItem("mx_device_id");
  if (storedDeviceId !== null && storedDeviceId !== deviceId) {
    console.warn(
      `[matrixClient] Device changed ${storedDeviceId} → ${deviceId}. Clearing room store.`,
    );
    await new Promise<void>((resolve) => {
      const req = window.indexedDB.deleteDatabase("mx-room-store");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
  localStorage.setItem("mx_device_id", deviceId);

  // ── 2. Open IndexedDB room store ─────────────────────────────────────────
  console.log("[matrixClient] Opening IndexedDB room store …");
  const store = new IndexedDBStore({
    indexedDB: window.indexedDB,
    localStorage: window.localStorage,
    dbName: "mx-room-store",
  });
  await store.startup();

  // ── 3. Create SDK client ─────────────────────────────────────────────────
  console.log("[matrixClient] Creating MatrixClient …");
  const client = createClient({
    baseUrl,
    accessToken,
    userId,
    deviceId,
    store,
    timelineSupport: true,
  });

  client.setGuest(session.isGuest);

  // E2E encryption is disabled (unencrypted-first).
  // Upgrade path when ready: call await client.initRustCrypto() here and add
  // { type: "m.room.encryption", ... } to the room's initial_state in the backend.

  // ── 4. Start sync and wait for PREPARED ──────────────────────────────────
  console.log("[matrixClient] Starting sync, waiting for PREPARED …");
  client.startClient({ initialSyncLimit: 50 });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(ClientEvent.Sync, onSync);
      reject(new Error("Sync timed out after 30 s."));
    }, 30_000);

    const onSync = (state: SyncState) => {
      if (state === SyncState.Prepared) {
        clearTimeout(timer);
        client.off(ClientEvent.Sync, onSync);
        resolve();
      } else if (state === SyncState.Stopped) {
        clearTimeout(timer);
        client.off(ClientEvent.Sync, onSync);
        reject(new MatrixAuthError("Sync stopped. Your session may have expired."));
      } else if (state === SyncState.Error) {
        console.warn("[matrixClient] Sync error (will retry) …");
      }
    };
    client.on(ClientEvent.Sync, onSync);
  });

  _activeClient = client;
  console.log("[matrixClient] Client ready.");
  return client;
}
