import { Router } from "express";
import { sessionEventStore } from "../services/sessionEventStore.js";
import { sessionStore } from "../services/sessionStore.js";

const router = Router();

/**
 * GET /api/supervisor/events
 * Returns all session events across every session, newest-first.
 * Intended for the supervisor audit-log view (no auth for demo).
 */
router.get("/events", (_req, res) => {
  res.json(sessionEventStore.listAll());
});

/**
 * GET /api/supervisor/sessions
 * Returns all sessions (same as /api/sessions but mounted under supervisor
 * for semantic clarity; the supervisor view fetches from here).
 */
router.get("/sessions", (_req, res) => {
  res.json(sessionStore.list());
});

export default router;
