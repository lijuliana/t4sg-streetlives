/**
 * Session routes.
 *
 * MVP messaging architecture:
 *   - All messages (guest and navigator) are posted to the Matrix room via the
 *     backend service account. Navigators do NOT need personal Matrix accounts.
 *   - Guest messages are prefixed "[Guest]: " in the room.
 *   - Navigator replies are prefixed "[<label>]: " (e.g. "[Alice (Navigator)]: ").
 *   - Incoming Matrix room messages are polled and stored locally for the guest UI.
 *   - The unified message thread (GET /api/sessions/:id/thread) is the source of
 *     truth for the dashboard; it returns all local message records in order.
 *
 * Future direction:
 *   Per-navigator Matrix accounts, E2E encryption, and real-time push (sync) are
 *   deferred. The service-account-as-transport model is intentional for demo simplicity
 *   and can be upgraded without changing the session lifecycle or routing logic.
 */

import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import {
  createRoom,
  sendMessage,
  fetchRoomMessages,
  inviteToRoom,
  kickFromRoom,
} from "../services/matrixService.js";
import { sessionStore } from "../services/sessionStore.js";
import { navigatorStore } from "../services/navigatorStore.js";
import { sessionEventStore } from "../services/sessionEventStore.js";
import { messageStore } from "../services/messageStore.js";
import { noteStore } from "../services/noteStore.js";
import { referralStore } from "../services/referralStore.js";
import { assignNavigator, ROUTING_VERSION } from "../services/routingService.js";
import type {
  CreateNoteRequest,
  CreateReferralRequest,
  CreateSessionRequest,
  CreateSessionResponse,
  NeedCategory,
  RoutingInput,
  SendGuestMessageRequest,
  SendNavigatorMessageRequest,
  SessionStatus,
  TransferSessionRequest,
} from "../types.js";

const router = Router();

const BASE_URL = process.env.MATRIX_BASE_URL!;

// ── Matrix sync state (in-memory per server process) ─────────────────────────
// Tracks Matrix event IDs already imported so repeated polls don't duplicate.
const importedEventIds = new Map<string, Set<string>>();
const MATRIX_SYNC_THROTTLE_MS = 5_000;
const lastMatrixSync = new Map<string, number>();

const VALID_NEED_CATEGORIES: NeedCategory[] = [
  "housing", "employment", "health", "benefits", "youth_services", "education", "other",
];

// ── Session lifecycle ─────────────────────────────────────────────────────────

/**
 * POST /api/sessions
 *
 * Creates a new guest chat session:
 *   1. Creates a private Matrix room via the service account.
 *   2. Runs routing (mode: "initial") — finds the best available general-intake navigator.
 *   3. If routing succeeds: status = "active", navigator invited to Matrix room.
 *      If routing fails:   status = "unassigned", routingFailReason recorded.
 *   4. Emits "created" and (if assigned) "assigned" audit events.
 */
router.post("/", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as CreateSessionRequest;

  const needCategory: NeedCategory = VALID_NEED_CATEGORIES.includes(
    body.needCategory as NeedCategory,
  )
    ? (body.needCategory as NeedCategory)
    : "other";

  try {
    const sessionId = randomUUID();
    const { roomId } = await createRoom(BASE_URL, sessionId);

    const routingInput: RoutingInput = {
      needCategory,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      language: typeof body.language === "string" ? body.language : undefined,
    };

    const outcome = assignNavigator(
      routingInput,
      navigatorStore.list(),
      (navId) => sessionStore.countActiveByNavigator(navId),
      "initial",
    );

    const session = sessionStore.create({
      sessionId,
      matrixRoomId: roomId,
      status: outcome.assigned ? "active" : "unassigned",
      needCategory,
      assignedNavigatorId: outcome.assigned ? outcome.navigator.id : null,
      routingVersion: outcome.routingVersion,
      routingReason: outcome.assigned ? outcome.routingReason : null,
      routingFailReason: outcome.assigned ? null : outcome.reason,
      closedAt: null,
      referralId: null,
    });

    sessionEventStore.append({
      sessionId,
      eventType: "created",
      actor: "system",
      metadata: {
        needCategory,
        language: routingInput.language ?? null,
        routingVersion: outcome.routingVersion,
        routingOutcome: outcome.assigned ? "assigned" : "unassigned",
        ...(outcome.assigned
          ? { navigatorId: outcome.navigator.id }
          : { failReason: outcome.reason }),
      },
    });

    if (outcome.assigned) {
      sessionEventStore.append({
        sessionId,
        eventType: "assigned",
        actor: "system",
        metadata: {
          navigatorId: outcome.navigator.id,
          navigatorUserId: outcome.navigator.userId,
          routingVersion: outcome.routingVersion,
          routingReason: outcome.routingReason,
        },
      });

      inviteToRoom(BASE_URL, roomId, outcome.navigator.userId).catch((err: unknown) => {
        console.error("[sessions] Matrix invite error (non-fatal):", err);
      });
    }

    const response: CreateSessionResponse = {
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
      assignedNavigatorId: session.assignedNavigatorId,
      routingVersion: session.routingVersion,
      routingReason: session.routingReason,
      routingFailReason: session.routingFailReason,
    };
    res.status(201).json(response);
  } catch (err) {
    console.error("[sessions] POST / error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create session",
    });
  }
});

/**
 * GET /api/sessions
 * Returns all sessions in reverse-chronological order.
 */
router.get("/", (_req: Request, res: Response) => {
  const sessions = sessionStore
    .list()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(sessions);
});

/**
 * GET /api/sessions/:sessionId
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
 * Manual status override. Prefer /close and /transfer for standard transitions.
 */
router.patch("/:sessionId/status", (req: Request, res: Response) => {
  const { status } = req.body as { status?: unknown };
  const VALID: SessionStatus[] = ["unassigned", "active", "closed", "transferred"];

  if (!status || !VALID.includes(status as SessionStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID.join(", ")}` });
    return;
  }

  const ok = sessionStore.updateStatus(req.params.sessionId, status as SessionStatus);
  if (!ok) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ ok: true });
});

/**
 * POST /api/sessions/:sessionId/close
 * Body: { actor?: string }
 */
router.post("/:sessionId/close", (req: Request, res: Response) => {
  const { actor } = (req.body ?? {}) as { actor?: string };

  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.status === "closed") {
    res.status(409).json({ error: "Session is already closed" });
    return;
  }

  const closedAt = new Date().toISOString();
  sessionStore.updateStatus(session.sessionId, "closed", closedAt);

  sessionEventStore.append({
    sessionId: session.sessionId,
    eventType: "closed",
    actor: actor ?? null,
    metadata: { previousStatus: session.status },
  });

  res.json({ ok: true, closedAt });
});

/**
 * POST /api/sessions/:sessionId/transfer
 */
router.post("/:sessionId/transfer", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as TransferSessionRequest;

  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.status === "closed") {
    res.status(409).json({ error: "Cannot transfer a closed session" });
    return;
  }

  const oldNavigatorId = session.assignedNavigatorId;
  let newNavigatorId: string;
  let newNavigatorUserId: string;

  if (body.targetNavigatorId) {
    const target = navigatorStore.findById(body.targetNavigatorId);
    if (!target) {
      res.status(400).json({ error: "targetNavigatorId not found" });
      return;
    }
    if (target.status !== "available") {
      res.status(400).json({ error: "Target navigator is not available" });
      return;
    }
    if (target.id === oldNavigatorId) {
      res.status(400).json({ error: "Target navigator is already assigned to this session" });
      return;
    }
    newNavigatorId = target.id;
    newNavigatorUserId = target.userId;
  } else {
    const routingInput: RoutingInput = {
      needCategory:
        body.needCategory && VALID_NEED_CATEGORIES.includes(body.needCategory)
          ? body.needCategory
          : session.needCategory ?? "other",
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      language: typeof body.language === "string" ? body.language : undefined,
    };

    const outcome = assignNavigator(
      routingInput,
      navigatorStore.list(),
      (navId) => sessionStore.countActiveByNavigator(navId),
      "transfer",
    );

    if (!outcome.assigned) {
      res.status(422).json({
        error: "No eligible navigator available for transfer",
        reason: outcome.reason,
        routingVersion: outcome.routingVersion,
      });
      return;
    }

    newNavigatorId = outcome.navigator.id;
    newNavigatorUserId = outcome.navigator.userId;
  }

  if (oldNavigatorId && oldNavigatorId !== newNavigatorId) {
    const oldNav = navigatorStore.findById(oldNavigatorId);
    if (oldNav) {
      kickFromRoom(BASE_URL, session.matrixRoomId, oldNav.userId, body.reason).catch(
        (err: unknown) => console.error("[sessions] Matrix kick error (non-fatal):", err),
      );
    }
  }

  inviteToRoom(BASE_URL, session.matrixRoomId, newNavigatorUserId).catch((err: unknown) => {
    console.error("[sessions] Matrix invite error (non-fatal):", err);
  });

  sessionStore.setNavigatorAssignment(session.sessionId, newNavigatorId, ROUTING_VERSION, null);
  sessionStore.updateStatus(session.sessionId, "active");

  sessionEventStore.append({
    sessionId: session.sessionId,
    eventType: "transferred",
    actor: body.actor ?? null,
    metadata: {
      fromNavigatorId: oldNavigatorId,
      toNavigatorId: newNavigatorId,
      reason: body.reason ?? null,
      manual: !!body.targetNavigatorId,
    },
  });

  res.json({ ok: true, assignedNavigatorId: newNavigatorId });
});

/**
 * GET /api/sessions/:sessionId/events
 */
router.get("/:sessionId/events", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(sessionEventStore.listBySession(session.sessionId));
});

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * POST /api/sessions/:sessionId/messages
 *
 * Guest message endpoint. Stores the message and mirrors it to the Matrix room
 * via the service account (best-effort).
 *
 * Body: { body: string }
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

  const { body } = req.body as SendGuestMessageRequest;
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required and must be a non-empty string" });
    return;
  }

  const text = body.trim();
  const msg = messageStore.append({
    sessionId: session.sessionId,
    matrixRoomId: session.matrixRoomId,
    senderType: "guest",
    senderNavigatorId: null,
    senderLabel: "Guest",
    text,
  });

  // Mirror to Matrix best-effort; back-fill event ID if send succeeds.
  sendMessage(BASE_URL, session.matrixRoomId, "[Guest]", text)
    .then((eventId) => {
      if (eventId) messageStore.setMatrixEventId(msg.id, eventId);
    })
    .catch((err: unknown) => {
      console.error("[sessions] Matrix sendMessage error (non-fatal):", err);
    });

  res.status(201).json(msg);
});

/**
 * GET /api/sessions/:sessionId/messages
 *
 * Legacy guest polling endpoint — syncs new messages from Matrix then returns
 * all messages in the store. Kept for backward compatibility with the guest chat UI.
 *
 * Throttled to one Matrix sync per 5 seconds per session.
 * Echo filtering: messages starting with "[Guest]: " were sent by this backend and
 * are already in the store — skip them to avoid duplicates.
 */
router.get("/:sessionId/messages", async (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await syncMatrixMessages(session.sessionId, session.matrixRoomId);

  // Return in the legacy shape the guest UI expects.
  const all = messageStore.listBySession(session.sessionId);
  const messages = all.map((m) => ({
    messageId: m.id,
    sessionId: m.sessionId,
    sender: m.senderType === "guest" ? "guest" : "service",
    body: m.text,
    sentAt: m.createdAt,
  }));
  res.json({ messages });
});

/**
 * POST /api/sessions/:sessionId/navigator-messages
 *
 * Navigator reply endpoint — allows the assigned navigator to send a message
 * from the dashboard without needing a personal Matrix account.
 *
 * The message is posted into the Matrix room via the service account with a
 * labeled prefix so it is identifiable in both the dashboard and Element.
 *
 * MVP note: messages are attributed to the navigator by label (name), not by
 * their Matrix identity. Per-navigator Matrix accounts and E2E encryption are
 * deferred to a future milestone.
 *
 * Body: { text: string, navigatorId: string }
 */
router.post("/:sessionId/navigator-messages", async (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.status === "closed") {
    res.status(409).json({ error: "Session is closed" });
    return;
  }

  const { text, navigatorId } = req.body as SendNavigatorMessageRequest;

  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required and must be a non-empty string" });
    return;
  }
  if (!navigatorId || typeof navigatorId !== "string") {
    res.status(400).json({ error: "navigatorId is required" });
    return;
  }

  // Only the currently assigned navigator may reply.
  if (session.assignedNavigatorId !== navigatorId) {
    res.status(403).json({
      error: "Only the currently assigned navigator may send messages for this session",
    });
    return;
  }

  const navigator = navigatorStore.findById(navigatorId);
  if (!navigator) {
    res.status(400).json({ error: "Navigator not found" });
    return;
  }

  const trimmed = text.trim();
  // Derive a human-friendly label from the Matrix userId (@alice-hw:... → "Alice Hw")
  const rawHandle = navigator.userId.replace(/@|:.*$/g, "").replace(/-/g, " ");
  const label = rawHandle
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const senderLabel = `${label} (Navigator)`;
  const matrixPrefix = `[${senderLabel}]`;

  const msg = messageStore.append({
    sessionId: session.sessionId,
    matrixRoomId: session.matrixRoomId,
    senderType: "navigator",
    senderNavigatorId: navigatorId,
    senderLabel,
    text: trimmed,
  });

  // Post into Matrix room via service account (best-effort).
  sendMessage(BASE_URL, session.matrixRoomId, matrixPrefix, trimmed)
    .then((eventId) => {
      if (eventId) messageStore.setMatrixEventId(msg.id, eventId);
    })
    .catch((err: unknown) => {
      console.error("[sessions] Matrix navigator sendMessage error (non-fatal):", err);
    });

  res.status(201).json(msg);
});

/**
 * GET /api/sessions/:sessionId/thread
 *
 * Returns the full message thread for a session in chronological order.
 * Syncs new messages from Matrix before responding (throttled per session).
 * Used by the navigator dashboard to render the conversation.
 */
router.get("/:sessionId/thread", async (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await syncMatrixMessages(session.sessionId, session.matrixRoomId);

  res.json(messageStore.listBySession(session.sessionId));
});

// ── Notes ─────────────────────────────────────────────────────────────────────

router.get("/:sessionId/notes", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(noteStore.listBySession(session.sessionId));
});

router.post("/:sessionId/notes", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const { body, createdBy } = req.body as CreateNoteRequest;
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  res.status(201).json(noteStore.create({
    sessionId: session.sessionId,
    body: body.trim(),
    createdBy: createdBy?.trim() || null,
  }));
});

// ── Referrals ─────────────────────────────────────────────────────────────────

router.get("/:sessionId/referrals", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(referralStore.listBySession(session.sessionId));
});

router.post("/:sessionId/referrals", (req: Request, res: Response) => {
  const session = sessionStore.findById(req.params.sessionId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const { title, description, createdBy } = req.body as CreateReferralRequest;
  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  res.status(201).json(referralStore.create({
    sessionId: session.sessionId,
    title: title.trim(),
    description: description?.trim() || null,
    createdBy: createdBy?.trim() || null,
  }));
});

export default router;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Syncs new messages from the Matrix room into the local store (throttled).
 * Skips echoes of messages the backend itself sent (identified by their prefix).
 * Only imports plain text m.room.message events not already seen.
 */
async function syncMatrixMessages(sessionId: string, matrixRoomId: string): Promise<void> {
  const now = Date.now();
  if (now - (lastMatrixSync.get(sessionId) ?? 0) < MATRIX_SYNC_THROTTLE_MS) return;
  lastMatrixSync.set(sessionId, now);

  try {
    const seen = importedEventIds.get(sessionId) ?? new Set<string>();
    importedEventIds.set(sessionId, seen);

    const matrixMessages = await fetchRoomMessages(BASE_URL, matrixRoomId);

    for (const raw of matrixMessages) {
      if (seen.has(raw.eventId)) continue;
      seen.add(raw.eventId);

      // Skip echoes of messages this backend posted.
      if (
        raw.body.startsWith("[Guest]: ") ||
        raw.body.startsWith("[") // covers "[Alice (Navigator)]: " etc.
      ) continue;

      // Import as an inbound external message (e.g. from Element/another client).
      messageStore.append({
        sessionId,
        matrixRoomId,
        matrixEventId: raw.eventId,
        senderType: "navigator",
        senderNavigatorId: null,
        senderLabel: "Navigator (Element)",
        text: raw.body,
      });
    }
  } catch (err) {
    console.error("[sessions] Matrix sync error (non-fatal):", err);
  }
}
