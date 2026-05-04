/**
 * Unit tests for session lifecycle logic.
 *
 * Tests exercise the routing service and store logic directly without HTTP.
 * Covers session creation status derivation, transfer guards, routing
 * behaviour, and queue processor assignment logic.
 */

import { describe, it, expect } from "vitest";
import { assignNavigator } from "../services/routingService.js";
import { processQueue } from "../services/queueProcessor.js";
import type { NavigatorProfile, Session, RoutingReason, SessionEvent } from "../types.js";
import type { QueueProcessorDeps } from "../services/queueProcessor.js";

const makeNav = (overrides: Partial<NavigatorProfile>): NavigatorProfile => ({
  id: "nav-1",
  userId: "@nav:matrix.example.org",
  navGroup: "HOUSING_WORKS",
  expertiseTags: [],
  languages: ["en"],
  capacity: 5,
  status: "available",
  isGeneralIntake: true,
  // Full-week schedule so tests aren't gated by time-of-day unless they explicitly override.
  availabilitySchedule: {
    Mon: { start: "00:00", end: "24:00" },
    Tue: { start: "00:00", end: "24:00" },
    Wed: { start: "00:00", end: "24:00" },
    Thu: { start: "00:00", end: "24:00" },
    Fri: { start: "00:00", end: "24:00" },
    Sat: { start: "00:00", end: "24:00" },
    Sun: { start: "00:00", end: "24:00" },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const noLoad = () => 0;

// ── Session creation — status derivation ──────────────────────────────────────

describe("session creation status", () => {
  it("session becomes active when a general-intake navigator is available", () => {
    const navs = [makeNav({ isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "accommodations" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
    const status = outcome.assigned ? "active" : "unassigned";
    expect(status).toBe("active");
  });

  it("session becomes active even when navigator has isGeneralIntake=false (gate removed)", () => {
    // isGeneralIntake no longer restricts routing; any available navigator is eligible
    const navs = [makeNav({ isGeneralIntake: false, status: "available" })];
    const outcome = assignNavigator({ needCategory: "accommodations" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
    const status = outcome.assigned ? "active" : "unassigned";
    expect(status).toBe("active");
  });

  it("session becomes unassigned when language is unmatched", () => {
    const navs = [makeNav({ languages: ["en"], isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator(
      { needCategory: "accommodations", language: "fr" },
      navs,
      noLoad,
      "initial",
    );
    expect(outcome.assigned).toBe(false);
  });

  it("routing version is included in the outcome", () => {
    const navs = [makeNav({ isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.routingVersion).toBeTruthy();
  });

  it("need_category does not block assignment (all navigators cross-trained)", () => {
    // A navigator with navGroup DYCD can be assigned to an accommodations session
    const navs = [makeNav({ navGroup: "DYCD", isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "accommodations" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
  });
});

// ── Transfer guards ───────────────────────────────────────────────────────────

describe("transfer guards", () => {
  it("same-navigator check: target equals current assignee", () => {
    const session = { assignedNavigatorId: "nav-1" } as Partial<Session>;
    expect(session.assignedNavigatorId === "nav-1").toBe(true);
  });

  it("transfer routing uses transfer mode (any navigator eligible)", () => {
    const specialist = makeNav({ id: "spec-1", isGeneralIntake: false, status: "available" });
    const outcome = assignNavigator({ needCategory: "accommodations" }, [specialist], noLoad, "transfer");
    expect(outcome.assigned).toBe(true);
  });

  it("transfer routing returns unassigned with reason when language has no match", () => {
    const navs = [makeNav({ languages: ["en"], isGeneralIntake: false, status: "available" })];
    const outcome = assignNavigator(
      { needCategory: "other", language: "es" },
      navs,
      noLoad,
      "transfer",
    );
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) expect(outcome.reason).toBeTruthy();
  });

  it("transfer routing selects lower-load navigator", () => {
    const n1 = makeNav({ id: "n1", capacity: 4, isGeneralIntake: false, status: "available" });
    const n2 = makeNav({ id: "n2", capacity: 4, isGeneralIntake: false, status: "available" });
    const outcome = assignNavigator(
      { needCategory: "other" },
      [n1, n2],
      (id) => (id === "n1" ? 3 : 0),
      "transfer",
    );
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });

  it("returns unassigned when no navigators exist for transfer", () => {
    const outcome = assignNavigator({ needCategory: "accommodations" }, [], noLoad, "transfer");
    expect(outcome.assigned).toBe(false);
  });
});

// ── Queue processor helpers ───────────────────────────────────────────────────

const makeSession = (overrides: Partial<Session>): Session => ({
  sessionId: "session-1",
  matrixRoomId: "!room:matrix.example.org",
  status: "unassigned",
  createdAt: new Date().toISOString(),
  closedAt: null,
  needCategory: "other",
  language: null,
  assignedNavigatorId: null,
  routingVersion: null,
  routingReason: null,
  routingFailReason: "No available navigators",
  referralId: null,
  ...overrides,
});

const dummyEvent = (): SessionEvent => ({
  id: "evt-1",
  sessionId: "",
  eventType: "assigned",
  actor: null,
  timestamp: new Date().toISOString(),
  metadata: {},
});

/** Builds a minimal QueueProcessorDeps from plain arrays; tracks committed assignments. */
function makeDeps(
  sessions: Session[],
  navs: NavigatorProfile[],
  loadMap: Record<string, number> = {},
): QueueProcessorDeps & { assigned: Map<string, string>; invites: string[] } {
  const assigned = new Map<string, string>();
  const invites: string[] = [];
  return {
    assigned,
    invites,
    listUnassigned: () => sessions.filter((s) => s.status === "unassigned"),
    listNavigators: () => navs,
    getActiveLoad: (id) => loadMap[id] ?? 0,
    commitAssignment: ({ sessionId, navigatorId }) => {
      const s = sessions.find((x) => x.sessionId === sessionId)!;
      s.assignedNavigatorId = navigatorId;
      s.status = "active";
      assigned.set(sessionId, navigatorId);
      // Reflect the load increase so subsequent iterations see it.
      loadMap[navigatorId] = (loadMap[navigatorId] ?? 0) + 1;
    },
    recordEvent: () => dummyEvent(),
    inviteNavigator: (_, userId) => { invites.push(userId); },
  };
}

// ── Queue processor tests ─────────────────────────────────────────────────────

// Fixed Monday 10 AM for schedule-aware tests (Jan 1 2024 was a Monday).
const mon10am = new Date(2024, 0, 1, 10, 0);

describe("queue processor", () => {
  it("assigns a queued session when a navigator has capacity", async () => {
    const sessions = [makeSession({ sessionId: "s1", needCategory: "accommodations", language: "en" })];
    const navs = [makeNav({ id: "n1", expertiseTags: ["Accommodations"], languages: ["en"] })];
    const deps = makeDeps(sessions, navs);

    const count = await processQueue(deps);
    expect(count).toBe(1);
    expect(deps.assigned.get("s1")).toBe("n1");
    expect(sessions[0].status).toBe("active");
  });

  it("leaves session unassigned when no navigator is eligible", async () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    const navs = [makeNav({ id: "n1", status: "offline" })];
    const deps = makeDeps(sessions, navs);

    const count = await processQueue(deps);
    expect(count).toBe(0);
    expect(deps.assigned.size).toBe(0);
    expect(sessions[0].status).toBe("unassigned");
  });

  it("processes sessions in FIFO order (oldest first)", async () => {
    const old = makeSession({ sessionId: "s-old", createdAt: "2024-01-01T08:00:00.000Z" });
    const newer = makeSession({ sessionId: "s-new", createdAt: "2024-01-01T09:00:00.000Z" });
    // Pass in reverse order to confirm sorting is applied.
    const sessions = [newer, old];
    const navs = [makeNav({ id: "n1", capacity: 1 })];
    const loadMap: Record<string, number> = {};
    const deps = makeDeps(sessions, navs, loadMap);

    await processQueue(deps);
    // Only one slot available — oldest session must be the one assigned.
    expect(deps.assigned.get("s-old")).toBe("n1");
    expect(deps.assigned.has("s-new")).toBe(false);
  });

  it("assigns to the lower-load navigator (load balancing)", async () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    const n1 = makeNav({ id: "n1", capacity: 4 });
    const n2 = makeNav({ id: "n2", capacity: 4 });
    // n1 carries 2 active sessions (ratio 0.5); n2 is idle.
    const deps = makeDeps(sessions, [n1, n2], { n1: 2, n2: 0 });

    await processQueue(deps);
    expect(deps.assigned.get("s1")).toBe("n2");
  });

  it("respects language constraint when assigning from queue", async () => {
    const sessions = [makeSession({ sessionId: "s1", language: "es" })];
    const enNav = makeNav({ id: "n1", languages: ["en"] });
    const esNav = makeNav({ id: "n2", languages: ["es"] });
    const deps = makeDeps(sessions, [enNav, esNav]);

    await processQueue(deps);
    expect(deps.assigned.get("s1")).toBe("n2");
  });

  it("leaves session unassigned when no navigator speaks the requested language", async () => {
    const sessions = [makeSession({ sessionId: "s1", language: "zh" })];
    const navs = [makeNav({ id: "n1", languages: ["en"] })];
    const deps = makeDeps(sessions, navs);

    const count = await processQueue(deps);
    expect(count).toBe(0);
    expect(sessions[0].status).toBe("unassigned");
  });

  it("respects availabilitySchedule when assigning from queue", async () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    const nav = makeNav({
      id: "n1",
      availabilitySchedule: { Mon: { start: "09:00", end: "17:00" } },
    });
    const deps = makeDeps(sessions, [nav]);

    // Outside schedule — should not assign.
    const outsideCount = await processQueue(deps, new Date(2024, 0, 1, 8, 0)); // Mon 08:00
    expect(outsideCount).toBe(0);

    // Inside schedule — should assign.
    const insideCount = await processQueue(deps, mon10am);
    expect(insideCount).toBe(1);
    expect(deps.assigned.get("s1")).toBe("n1");
  });

  it("assigns multiple queued sessions to different navigators", async () => {
    const s1 = makeSession({ sessionId: "s1", createdAt: "2024-01-01T08:00:00.000Z" });
    const s2 = makeSession({ sessionId: "s2", createdAt: "2024-01-01T09:00:00.000Z" });
    const n1 = makeNav({ id: "n1", capacity: 1 });
    const n2 = makeNav({ id: "n2", capacity: 1 });
    const loadMap: Record<string, number> = {};
    const deps = makeDeps([s1, s2], [n1, n2], loadMap);

    const count = await processQueue(deps);
    expect(count).toBe(2);
    expect(deps.assigned.get("s1")).toBeTruthy();
    expect(deps.assigned.get("s2")).toBeTruthy();
    // Each navigator should have received exactly one session.
    expect(new Set(deps.assigned.values()).size).toBe(2);
  });

  it("fires inviteNavigator for each assigned session", async () => {
    const sessions = [makeSession({ sessionId: "s1" })];
    const navs = [makeNav({ id: "n1", userId: "@nav1:matrix.example.org" })];
    const deps = makeDeps(sessions, navs);

    await processQueue(deps);
    expect(deps.invites).toContain("@nav1:matrix.example.org");
  });

  it("updates active load mid-loop so second assignment respects first", async () => {
    // Two queued sessions, two navigators each with capacity 1.
    // After the first assignment the assigned navigator should appear full to the second routing call.
    const s1 = makeSession({ sessionId: "s1", createdAt: "2024-01-01T08:00:00.000Z" });
    const s2 = makeSession({ sessionId: "s2", createdAt: "2024-01-01T09:00:00.000Z" });
    const n1 = makeNav({ id: "n1", capacity: 1 });
    const n2 = makeNav({ id: "n2", capacity: 1 });
    const loadMap: Record<string, number> = {};
    const deps = makeDeps([s1, s2], [n1, n2], loadMap);

    const count = await processQueue(deps);
    expect(count).toBe(2);
    // Both sessions assigned — each to a distinct navigator (no double-assignment).
    const assignedTo = Array.from(deps.assigned.values());
    expect(new Set(assignedTo).size).toBe(2);
  });
});
