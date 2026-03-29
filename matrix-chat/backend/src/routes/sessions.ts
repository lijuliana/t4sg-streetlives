import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import { createRoom, sendMessage, fetchRoomMessages } from "../services/matrixService.js";
import { sessionStore } from "../services/sessionStore.js";
import { messageStore } from "../services/messageStore.js";
import { noteStore } from "../services/noteStore.js";
import { referralStore } from "../services/referralStore.js";
import type {
  CreateNoteRequest,
  CreateReferralRequest,
  CreateSessionResponse,
  MessagesResponse,
  SendMessageRequest,
  SessionStatus,
} from "../types.js";

const router = Router();

// Validated at server startup — safe to assert non-null here.
const BASE_URL = process.env.MATRIX_BASE_URL!;

// ── Matrix sync state (in-memory per server process) ─────────────────────────
// Tracks which Matrix event IDs have already been imported into the message
// store so we don't create duplicates on repeated polls.
// Key: sessionId → Set of imported Matrix event IDs.
const importedEventIds = new Map<string, Set<string>>();

// Minimum ms between Matrix fetches per session (avoids hammering the homeserver).
const MATRIX_SYNC_THROTTLE_MS = 5_000;
const lastMatrixSync = new Map<string, number>(); // sessionId → epoch ms

/**
 * POST /api/sessions
 *
 * Creates a new guest chat session:
 *   1. Creates a private Matrix room via the service account
 *   2. Persists the session record (sessionId ↔ matrixRoomId)
 *   3. Returns only the opaque sessionId to the frontend
 *
 * Guests receive no Matrix credentials — all Matrix I/O goes through the backend.
 */
router.post("/", async (_req: Request, res: Response) => {
  try {
    // Generate the ID first so it can be embedded in the Matrix room name/topic.
    const sessionId = randomUUID();
    const { roomId } = await createRoom(BASE_URL, sessionId);

    const session = sessionStore.create({
      sessionId,
      matrixRoomId: roomId,
      status: "active",
      navigatorId: null,
      referralId: null,
      closedAt: null,
    });

    const body: CreateSessionResponse = {
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
    };
    res.status(201).json(body);
  } catch (err) {
    console.error("[sessions] POST / error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create session",
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 *
 * Returns session metadata. Primarily for the Navigator dashboard (future).
 */
router.get("/:sessionId", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

/**
 * PATCH /api/sessions/:sessionId/status
 *
 * Updates session status. Body: { "status": "active" | "closed" }
 */
router.patch("/:sessionId/status", (req: Request, res: Response) => {
  const { status } = req.body as { status?: unknown };

  if (status !== "active" && status !== "closed") {
    res.status(400).json({ error: 'status must be "active" or "closed"' });
    return;
  }

  const ok = sessionStore.updateStatus(
    req.params.sessionId,
    status as SessionStatus,
  );
  if (!ok) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({ ok: true });
});

/**
 * POST /api/sessions/:sessionId/messages
 *
 * Accepts a message from the guest, stores it, then mirrors it to the Matrix
 * room as the service account. The Matrix send is best-effort — a Matrix
 * failure does not fail the request so the guest always gets a response.
 *
 * Body: { "body": string }
 */
router.post("/:sessionId/messages", async (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.status === "closed") {
    res.status(409).json({ error: "Session is closed" });
    return;
  }

  const { body } = req.body as SendMessageRequest;
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required and must be a non-empty string" });
    return;
  }

  const message = messageStore.append(session.sessionId, "guest", body.trim());

  // Mirror to Matrix best-effort so Navigators can read it from their Matrix client.
  sendMessage(BASE_URL, session.matrixRoomId, "[Guest]", body.trim()).catch(
    (err: unknown) => {
      console.error("[sessions] Matrix sendMessage error (non-fatal):", err);
    },
  );

  res.status(201).json(message);
});

/**
 * GET /api/sessions/:sessionId/messages
 *
 * Returns all messages for a session in chronological order.
 * Before responding, syncs new messages from the Matrix room so replies
 * sent via Element (or any Matrix client) appear on the guest side.
 *
 * Sync is throttled to at most once per MATRIX_SYNC_THROTTLE_MS to avoid
 * hammering the homeserver on every frontend poll.
 *
 * Deduplication: Matrix event IDs already imported are tracked in
 * importedEventIds so repeated polls never create duplicate messages.
 *
 * Echo filtering: messages whose body starts with "[Guest]: " were sent by
 * this backend on behalf of the guest and are already in the store — skip them.
 */
router.get("/:sessionId/messages", async (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { sessionId, matrixRoomId } = session;
  const now = Date.now();
  const lastSync = lastMatrixSync.get(sessionId) ?? 0;

  if (now - lastSync >= MATRIX_SYNC_THROTTLE_MS) {
    lastMatrixSync.set(sessionId, now);
    try {
      const seen = importedEventIds.get(sessionId) ?? new Set<string>();
      importedEventIds.set(sessionId, seen);

      const matrixMessages = await fetchRoomMessages(BASE_URL, matrixRoomId);

      for (const msg of matrixMessages) {
        if (seen.has(msg.eventId)) continue;
        seen.add(msg.eventId);
        // Skip echoes of guest messages that the backend already stored.
        if (msg.body.startsWith("[Guest]: ")) continue;
        messageStore.append(sessionId, "service", msg.body);
      }
    } catch (err) {
      // Non-fatal: if Matrix is unreachable, return whatever is in the store.
      console.error("[sessions] Matrix sync error (non-fatal):", err);
    }
  }

  const messages = messageStore.listBySession(sessionId);
  const body: MessagesResponse = { messages };
  res.json(body);
});

// ── Navigator dashboard routes ────────────────────────────────────────────────

/**
 * GET /api/sessions
 * Returns all sessions in reverse-chronological order (newest first).
 */
router.get("/", (_req: Request, res: Response) => {
  const sessions = sessionStore.list().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  res.json(sessions);
});

/**
 * GET /api/sessions/:sessionId/notes
 */
router.get("/:sessionId/notes", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(noteStore.listBySession(session.sessionId));
});

/**
 * POST /api/sessions/:sessionId/notes
 * Body: { body: string, createdBy?: string }
 */
router.post("/:sessionId/notes", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const { body, createdBy } = req.body as CreateNoteRequest;
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const note = noteStore.create({
    sessionId: session.sessionId,
    body: body.trim(),
    createdBy: createdBy?.trim() || null,
  });
  res.status(201).json(note);
});

/**
 * GET /api/sessions/:sessionId/referrals
 */
router.get("/:sessionId/referrals", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(referralStore.listBySession(session.sessionId));
});

/**
 * POST /api/sessions/:sessionId/referrals
 * Body: { title: string, description?: string, createdBy?: string }
 */
router.post("/:sessionId/referrals", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const { title, description, createdBy } = req.body as CreateReferralRequest;
  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const referral = referralStore.create({
    sessionId: session.sessionId,
    title: title.trim(),
    description: description?.trim() || null,
    createdBy: createdBy?.trim() || null,
  });
  res.status(201).json(referral);
});

export default router;
