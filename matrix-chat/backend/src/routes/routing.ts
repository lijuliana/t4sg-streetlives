import { Router } from "express";
import type { Request, Response } from "express";
import { navigatorStore } from "../services/navigatorStore.js";
import { sessionStore } from "../services/sessionStore.js";
import { assignNavigator, ROUTING_VERSION } from "../services/routingService.js";
import type { AssignRoutingRequest, NeedCategory, RoutingMode } from "../types.js";

const router = Router();

const VALID_NEED_CATEGORIES: NeedCategory[] = [
  "housing", "employment", "health", "benefits", "youth_services", "education", "other",
];
const VALID_MODES: RoutingMode[] = ["initial", "transfer"];

/**
 * POST /api/routing/assign
 *
 * Dry-run routing: returns the best available navigator without creating a session.
 * Useful for testing routing logic and previewing assignment before session creation.
 *
 * Body:
 *   needCategory  string            required — stored for audit; does not constrain routing
 *   language      string            optional — ISO 639-1 code; primary routing filter
 *   tags          string[]          optional — retained for future scoring; ignored in v2
 *   mode          "initial"|"transfer"  optional — default "initial"
 *                   initial:  only considers is_general_intake navigators
 *                   transfer: considers all available navigators
 *
 * Response (assigned):
 *   { assigned: true, navigator, routingReason, routingVersion }
 *
 * Response (no match):
 *   { assigned: false, reason: string, routingVersion }
 */
router.post("/assign", (req: Request, res: Response) => {
  const body = req.body as AssignRoutingRequest & Record<string, unknown>;

  if (!body.needCategory || !VALID_NEED_CATEGORIES.includes(body.needCategory as NeedCategory)) {
    res.status(400).json({
      error: `needCategory is required and must be one of: ${VALID_NEED_CATEGORIES.join(", ")}`,
    });
    return;
  }
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    res.status(400).json({ error: "tags must be an array if provided" });
    return;
  }
  if (body.language !== undefined && typeof body.language !== "string") {
    res.status(400).json({ error: "language must be a string if provided" });
    return;
  }
  if (body.mode !== undefined && !VALID_MODES.includes(body.mode as RoutingMode)) {
    res.status(400).json({ error: `mode must be one of: ${VALID_MODES.join(", ")}` });
    return;
  }

  const mode: RoutingMode = (body.mode as RoutingMode | undefined) ?? "initial";

  const outcome = assignNavigator(
    {
      needCategory: body.needCategory as NeedCategory,
      tags: body.tags as string[] | undefined,
      language: body.language as string | undefined,
    },
    navigatorStore.list(),
    (navId) => sessionStore.countActiveByNavigator(navId),
    mode,
  );

  if (!outcome.assigned) {
    res.json({ assigned: false, reason: outcome.reason, routingVersion: outcome.routingVersion });
    return;
  }

  res.json({
    assigned: true,
    navigator: outcome.navigator,
    routingReason: outcome.routingReason,
    routingVersion: outcome.routingVersion,
  });
});

export default router;
