import { Router } from "express";
import type { Request, Response } from "express";
import { navigatorStore } from "../services/navigatorStore.js";
import type {
  CreateNavigatorProfileRequest,
  UpdateNavigatorProfileRequest,
  NavGroup,
  NavigatorStatus,
} from "../types.js";

const router = Router();

const VALID_NAV_GROUPS: NavGroup[] = ["CUNY_PIN", "HOUSING_WORKS", "DYCD"];
const VALID_STATUSES: NavigatorStatus[] = ["available", "away", "offline"];

/**
 * POST /api/navigators
 *
 * Creates a navigator profile from onboarding form data.
 *
 * Body:
 *   userId          string   required — Matrix user ID e.g. @alice:homeserver.org
 *   navGroup        string   required — "CUNY_PIN" | "HOUSING_WORKS" | "DYCD"
 *                            (stored for future routing; not a hard filter right now)
 *   expertiseTags   string[] optional — e.g. ["emergency_housing","shelter"]
 *   languages       string[] optional — ISO 639-1 codes e.g. ["en","es"]   (default: ["en"])
 *   capacity        number   optional — max concurrent sessions              (default: 5)
 *   status          string   optional — "available"|"away"|"offline"         (default: "available")
 *   isGeneralIntake boolean  optional — eligible for initial assignment      (default: false)
 */
router.post("/", (req: Request, res: Response) => {
  const body = req.body as CreateNavigatorProfileRequest & Record<string, unknown>;

  if (!body.userId || typeof body.userId !== "string" || !body.userId.trim()) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  if (!body.navGroup || !VALID_NAV_GROUPS.includes(body.navGroup as NavGroup)) {
    res.status(400).json({ error: `navGroup must be one of: ${VALID_NAV_GROUPS.join(", ")}` });
    return;
  }
  if (body.expertiseTags !== undefined && !Array.isArray(body.expertiseTags)) {
    res.status(400).json({ error: "expertiseTags must be an array" });
    return;
  }
  if (body.languages !== undefined && !Array.isArray(body.languages)) {
    res.status(400).json({ error: "languages must be an array" });
    return;
  }
  if (body.capacity !== undefined && (typeof body.capacity !== "number" || body.capacity < 1)) {
    res.status(400).json({ error: "capacity must be a positive number" });
    return;
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as NavigatorStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }
  if (body.isGeneralIntake !== undefined && typeof body.isGeneralIntake !== "boolean") {
    res.status(400).json({ error: "isGeneralIntake must be a boolean" });
    return;
  }

  if (navigatorStore.findByUserId(body.userId.trim())) {
    res.status(409).json({ error: "A navigator profile already exists for this userId" });
    return;
  }

  const profile = navigatorStore.create({
    userId: body.userId.trim(),
    navGroup: body.navGroup as NavGroup,
    expertiseTags: (body.expertiseTags as string[] | undefined) ?? [],
    languages: body.languages as string[] | undefined,
    capacity: body.capacity as number | undefined,
    status: body.status as NavigatorStatus | undefined,
    isGeneralIntake: body.isGeneralIntake as boolean | undefined,
  });

  res.status(201).json(profile);
});

/**
 * GET /api/navigators
 * Returns all navigator profiles.
 */
router.get("/", (_req: Request, res: Response) => {
  res.json(navigatorStore.list());
});

/**
 * GET /api/navigators/:id
 */
router.get("/:id", (req: Request, res: Response) => {
  const profile = navigatorStore.findById(req.params.id);
  if (!profile) {
    res.status(404).json({ error: "Navigator not found" });
    return;
  }
  res.json(profile);
});

/**
 * PATCH /api/navigators/:id
 *
 * Partial update — all fields optional.
 * Use this to update status, capacity, languages, isGeneralIntake, etc.
 */
router.patch("/:id", (req: Request, res: Response) => {
  const body = req.body as UpdateNavigatorProfileRequest & Record<string, unknown>;

  if (body.navGroup !== undefined && !VALID_NAV_GROUPS.includes(body.navGroup as NavGroup)) {
    res.status(400).json({ error: `navGroup must be one of: ${VALID_NAV_GROUPS.join(", ")}` });
    return;
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as NavigatorStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }
  if (body.expertiseTags !== undefined && !Array.isArray(body.expertiseTags)) {
    res.status(400).json({ error: "expertiseTags must be an array" });
    return;
  }
  if (body.languages !== undefined && !Array.isArray(body.languages)) {
    res.status(400).json({ error: "languages must be an array" });
    return;
  }
  if (body.capacity !== undefined && (typeof body.capacity !== "number" || body.capacity < 1)) {
    res.status(400).json({ error: "capacity must be a positive number" });
    return;
  }
  if (body.isGeneralIntake !== undefined && typeof body.isGeneralIntake !== "boolean") {
    res.status(400).json({ error: "isGeneralIntake must be a boolean" });
    return;
  }

  const updated = navigatorStore.update(req.params.id, {
    navGroup: body.navGroup as NavGroup | undefined,
    expertiseTags: body.expertiseTags as string[] | undefined,
    languages: body.languages as string[] | undefined,
    capacity: body.capacity as number | undefined,
    status: body.status as NavigatorStatus | undefined,
    isGeneralIntake: body.isGeneralIntake as boolean | undefined,
  });

  if (!updated) {
    res.status(404).json({ error: "Navigator not found" });
    return;
  }

  res.json(updated);
});

export default router;
