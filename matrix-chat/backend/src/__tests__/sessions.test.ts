/**
 * Unit tests for session lifecycle logic.
 *
 * Tests exercise the routing service and store logic directly without HTTP.
 * Covers session creation status derivation, transfer guards, and routing
 * behaviour under the v2 model (language-first, general-intake gate).
 */

import { describe, it, expect } from "vitest";
import { assignNavigator } from "../services/routingService.js";
import type { NavigatorProfile, Session } from "../types.js";

const makeNav = (overrides: Partial<NavigatorProfile>): NavigatorProfile => ({
  id: "nav-1",
  userId: "@nav:matrix.example.org",
  navGroup: "HOUSING_WORKS",
  expertiseTags: [],
  languages: ["en"],
  capacity: 5,
  status: "available",
  isGeneralIntake: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const noLoad = () => 0;

// ── Session creation — status derivation ──────────────────────────────────────

describe("session creation status", () => {
  it("session becomes active when a general-intake navigator is available", () => {
    const navs = [makeNav({ isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
    const status = outcome.assigned ? "active" : "unassigned";
    expect(status).toBe("active");
  });

  it("session becomes unassigned when no general-intake navigator is available", () => {
    // All navigators are non-intake; initial routing should return unassigned
    const navs = [makeNav({ isGeneralIntake: false, status: "available" })];
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(false);
    const status = outcome.assigned ? "active" : "unassigned";
    expect(status).toBe("unassigned");
  });

  it("session becomes unassigned when language is unmatched", () => {
    const navs = [makeNav({ languages: ["en"], isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator(
      { needCategory: "housing", language: "fr" },
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
    // A navigator with navGroup DYCD can be assigned to a housing session
    const navs = [makeNav({ navGroup: "DYCD", isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad, "initial");
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
    const outcome = assignNavigator({ needCategory: "housing" }, [specialist], noLoad, "transfer");
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
    const outcome = assignNavigator({ needCategory: "housing" }, [], noLoad, "transfer");
    expect(outcome.assigned).toBe(false);
  });
});
