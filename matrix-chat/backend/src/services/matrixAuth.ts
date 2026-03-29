/**
 * Backend-owned Matrix session manager for the service account.
 *
 * Responsibilities:
 *   - Log in to the Matrix homeserver using username + password (from env)
 *   - Persist the resulting token, refresh_token, device_id, and expiry to disk
 *   - Proactively refresh the access token before expiry (if the homeserver
 *     returns refresh tokens and expires_in_ms — matrix.org may or may not)
 *   - Re-login transparently when a refresh is unavailable or fails
 *   - Serialise concurrent refresh/login attempts so only one in-flight call
 *     runs at a time
 *
 * Usage:
 *   1. Call initMatrixAuth() once in server.ts
 *   2. Call authManager.init() to load any persisted session from disk
 *   3. matrixService.ts calls getAuthManager().getToken() before each request
 *      and getAuthManager().handleTokenRejected() on M_UNKNOWN_TOKEN
 */

import { readFile, writeFile } from "node:fs/promises";

// ── Stored credentials ────────────────────────────────────────────────────────

interface StoredCredentials {
  accessToken: string;
  /** Present only when the homeserver supports sliding-sync / refresh tokens. */
  refreshToken: string | null;
  deviceId: string;
  userId: string;
  /** Epoch ms at which the access token expires, or null if no expiry was given. */
  expiresAt: number | null;
}

/** Refresh the token this many ms before it actually expires. */
const REFRESH_BUFFER_MS = 5 * 60 * 1_000;

// ── Auth manager ──────────────────────────────────────────────────────────────

export class MatrixAuthManager {
  private creds: StoredCredentials | null = null;
  /** Serialises concurrent refresh/re-login attempts. */
  private refreshInProgress: Promise<void> | null = null;

  constructor(
    private readonly baseUrl: string,
    /** Full Matrix user ID, e.g. @streetlives-bot:matrix.org */
    private readonly serviceUserId: string,
    private readonly servicePassword: string,
    /** Absolute path to the session file on disk. */
    private readonly sessionFile: string,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Load any previously persisted credentials from disk.
   * Call once at server startup before handling any requests.
   */
  async init(): Promise<void> {
    try {
      const raw = await readFile(this.sessionFile, "utf8");
      this.creds = JSON.parse(raw) as StoredCredentials;
      console.log(
        `[matrixAuth] Loaded persisted session (userId: ${this.creds.userId}, device: ${this.creds.deviceId})`,
      );
    } catch {
      console.log("[matrixAuth] No persisted session found — will log in on first request");
    }
  }

  /**
   * Returns a valid access token.
   * Proactively refreshes/re-logs-in if the token is within REFRESH_BUFFER_MS
   * of expiry or if no credentials are held yet.
   */
  async getToken(): Promise<string> {
    if (!this.creds || this.isNearExpiry()) {
      await this.triggerRefresh();
    }
    return this.creds!.accessToken;
  }

  /**
   * Called by matrixService when a request receives M_UNKNOWN_TOKEN.
   * Forces an immediate refresh or re-login regardless of stored expiry,
   * then returns the new access token.
   * Concurrent callers await the same in-flight attempt.
   */
  async handleTokenRejected(): Promise<string> {
    console.warn("[matrixAuth] Token rejected (M_UNKNOWN_TOKEN) — forcing credential refresh");
    await this.triggerRefresh();
    return this.creds!.accessToken;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Ensures only one refresh/login runs at a time.
   * All concurrent callers await the same promise.
   */
  private triggerRefresh(): Promise<void> {
    if (!this.refreshInProgress) {
      this.refreshInProgress = this.refreshOrRelogin().finally(() => {
        this.refreshInProgress = null;
      });
    }
    return this.refreshInProgress;
  }

  /** Try refresh token first; fall back to full re-login on any failure. */
  private async refreshOrRelogin(): Promise<void> {
    if (this.creds?.refreshToken) {
      try {
        await this.refresh();
        return;
      } catch (err) {
        console.warn("[matrixAuth] Token refresh failed — falling back to re-login:", err);
      }
    }
    await this.login();
  }

  private async login(): Promise<void> {
    console.log("[matrixAuth] Logging in as", this.serviceUserId, "...");
    const res = await fetch(`${this.baseUrl}/_matrix/client/v3/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "m.login.password",
        identifier: { type: "m.id.user", user: this.serviceUserId },
        password: this.servicePassword,
        initial_device_display_name: "Streetlives Backend",
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        errcode?: string;
      };
      throw new Error(
        `Matrix login failed [${res.status}]: ${body.error ?? "unknown"} (${body.errcode ?? "no errcode"})`,
      );
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      device_id: string;
      user_id: string;
      expires_in_ms?: number;
    };

    this.creds = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      deviceId: data.device_id,
      userId: data.user_id,
      expiresAt: data.expires_in_ms ? Date.now() + data.expires_in_ms : null,
    };

    await this.save();
    console.log(
      `[matrixAuth] Logged in — device: ${this.creds.deviceId}`,
      this.creds.expiresAt
        ? `| expires: ${new Date(this.creds.expiresAt).toISOString()}`
        : "| no expiry reported",
      this.creds.refreshToken ? "| refresh token present" : "| no refresh token",
    );
  }

  private async refresh(): Promise<void> {
    if (!this.creds?.refreshToken) throw new Error("No refresh token available");

    const res = await fetch(`${this.baseUrl}/_matrix/client/v3/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: this.creds.refreshToken }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        `Matrix token refresh failed [${res.status}]: ${body.error ?? "unknown"}`,
      );
    }

    const data = (await res.json()) as {
      access_token: string;
      /** The homeserver may rotate the refresh token on each use. */
      refresh_token?: string;
      expires_in_ms?: number;
    };

    this.creds = {
      ...this.creds,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.creds.refreshToken,
      expiresAt: data.expires_in_ms ? Date.now() + data.expires_in_ms : null,
    };

    await this.save();
    console.log("[matrixAuth] Access token refreshed successfully");
  }

  private async save(): Promise<void> {
    if (!this.creds) return;
    try {
      await writeFile(this.sessionFile, JSON.stringify(this.creds, null, 2), "utf8");
    } catch (err) {
      console.error("[matrixAuth] Failed to persist session to disk (non-fatal):", err);
    }
  }

  private isNearExpiry(): boolean {
    if (!this.creds?.expiresAt) return false;
    return Date.now() > this.creds.expiresAt - REFRESH_BUFFER_MS;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _manager: MatrixAuthManager | null = null;

export function initMatrixAuth(
  baseUrl: string,
  serviceUserId: string,
  servicePassword: string,
  sessionFile: string,
): MatrixAuthManager {
  _manager = new MatrixAuthManager(baseUrl, serviceUserId, servicePassword, sessionFile);
  return _manager;
}

/** Returns the singleton auth manager. Throws if initMatrixAuth() was not called. */
export function getAuthManager(): MatrixAuthManager {
  if (!_manager) {
    throw new Error("[matrixAuth] Not initialized — call initMatrixAuth() before first request");
  }
  return _manager;
}
