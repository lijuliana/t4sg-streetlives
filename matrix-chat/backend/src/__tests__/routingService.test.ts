/**
 * Unit tests for the v2 routing service.
 *
 * Routing rules under test:
 *   - All navigators are cross-trained; need_category does NOT constrain eligibility.
 *   - Initial assignment (mode: "initial") restricts to is_general_intake navigators.
 *   - Transfer routing (mode: "transfer") considers all available navigators.
 *   - Language is the primary routing filter; hard-reject if language requested but unmatched.
 *   - Among eligible candidates, lowest load ratio wins; stable tie-breaker on id.
 */

import { describe, it, expect } from "vitest";
import { assignNavigator, ROUTING_VERSION } from "../services/routingService.js";
import type { NavigatorProfile } from "../types.js";

const makeNav = (overrides: Partial<NavigatorProfile>): NavigatorProfile => ({
  id: "nav-1",
  userId: "@test:matrix.example.org",
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

// ── Basic eligibility ─────────────────────────────────────────────────────────

describe("basic eligibility", () => {
  it("returns unassigned when navigator list is empty", () => {
    const outcome = assignNavigator({ needCategory: "housing" }, [], noLoad);
    expect(outcome.assigned).toBe(false);
  });

  it("excludes away navigators", () => {
    const navs = [makeNav({ id: "n1", status: "away" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.assigned).toBe(false);
  });

  it("excludes offline navigators", () => {
    const navs = [makeNav({ id: "n1", status: "offline" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.assigned).toBe(false);
  });
});

// ── General-intake gate (initial mode) ───────────────────────────────────────

describe("general-intake gate — initial mode", () => {
  it("only considers is_general_intake navigators for initial assignment", () => {
    const navs = [
      makeNav({ id: "n1", isGeneralIntake: false, status: "available" }),
      makeNav({ id: "n2", isGeneralIntake: true,  status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });

  it("returns unassigned when no general-intake navigators are available", () => {
    const navs = [makeNav({ id: "n1", isGeneralIntake: false, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) expect(outcome.reason).toContain("general-intake");
  });

  it("sets generalIntakeOnly=true in routingReason", () => {
    const navs = [makeNav({ isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.routingReason.generalIntakeOnly).toBe(true);
  });
});

// ── Transfer mode — any navigator eligible ────────────────────────────────────

describe("transfer mode", () => {
  it("considers non-general-intake navigators in transfer mode", () => {
    const navs = [
      makeNav({ id: "n1", isGeneralIntake: false, status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad, "transfer");
    expect(outcome.assigned).toBe(true);
  });

  it("sets generalIntakeOnly=false in routingReason", () => {
    const navs = [makeNav({ isGeneralIntake: false, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad, "transfer");
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.routingReason.generalIntakeOnly).toBe(false);
  });

  it("is not blocked by need_category — housing routes to any available navigator", () => {
    const navs = [
      makeNav({ id: "n1", navGroup: "DYCD",          isGeneralIntake: false, status: "available" }),
      makeNav({ id: "n2", navGroup: "HOUSING_WORKS",  isGeneralIntake: false, status: "available" }),
    ];
    // In v1 this would have hard-filtered to HOUSING_WORKS only.
    // In v2 both are eligible; stable tie-breaker picks n1 (lower id).
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad, "transfer");
    expect(outcome.assigned).toBe(true);
  });
});

// ── need_category does not constrain routing ──────────────────────────────────

describe("need_category no longer constrains routing", () => {
  it("a DYCD navigator can be assigned to a housing session", () => {
    const navs = [makeNav({ id: "n1", navGroup: "DYCD", isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
  });

  it("a CUNY_PIN navigator can be assigned to an employment session", () => {
    const navs = [makeNav({ id: "n1", navGroup: "CUNY_PIN", isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "employment" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
  });
});

// ── Language routing ──────────────────────────────────────────────────────────

describe("language routing", () => {
  it("assigns a navigator who speaks the requested language", () => {
    const navs = [
      makeNav({ id: "n1", languages: ["en"],       isGeneralIntake: true, status: "available" }),
      makeNav({ id: "n2", languages: ["en", "es"], isGeneralIntake: true, status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "other", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n2");
      expect(outcome.routingReason.languageMatch).toBe(true);
    }
  });

  it("hard-rejects in initial mode when no general-intake navigator speaks the language", () => {
    const navs = [makeNav({ id: "n1", languages: ["en"], isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other", language: "es" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) {
      expect(outcome.reason).toContain('"es"');
      expect(outcome.reason).toContain("general-intake");
    }
  });

  it("hard-rejects in transfer mode when no available navigator speaks the language", () => {
    const navs = [makeNav({ id: "n1", languages: ["en"], isGeneralIntake: false, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other", language: "es" }, navs, noLoad, "transfer");
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) expect(outcome.reason).toContain('"es"');
  });

  it("sets languageRequested in routingReason", () => {
    const navs = [makeNav({ languages: ["en", "es"], isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.routingReason.languageRequested).toBe("es");
  });

  it("routes without language constraint when no language requested", () => {
    const navs = [makeNav({ languages: ["zh"], isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.routingReason.languageRequested).toBeNull();
      expect(outcome.routingReason.languageMatch).toBe(false);
    }
  });

  it("normalises language to lowercase before matching", () => {
    const navs = [makeNav({ languages: ["es"], isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other", language: "ES" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
  });
});

// ── Load balancing ────────────────────────────────────────────────────────────

describe("load balancing", () => {
  it("prefers the navigator with the lower load ratio", () => {
    const navs = [
      makeNav({ id: "n1", capacity: 4, isGeneralIntake: true, status: "available" }),
      makeNav({ id: "n2", capacity: 4, isGeneralIntake: true, status: "available" }),
    ];
    // n1 has 2 active sessions (ratio 0.5); n2 is idle
    const outcome = assignNavigator(
      { needCategory: "other" },
      navs,
      (id) => (id === "n1" ? 2 : 0),
    );
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });

  it("uses stable id tie-breaker when load ratios are equal", () => {
    const navs = [
      makeNav({ id: "b-nav", isGeneralIntake: true, status: "available" }),
      makeNav({ id: "a-nav", isGeneralIntake: true, status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("a-nav");
  });
});

// ── Routing version ───────────────────────────────────────────────────────────

describe("routing version", () => {
  it("returns the current routing version", () => {
    const navs = [makeNav({ isGeneralIntake: true, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.routingVersion).toBe(ROUTING_VERSION);
  });

  it("includes routing version even in unassigned outcomes", () => {
    const outcome = assignNavigator({ needCategory: "other" }, [], noLoad);
    expect(outcome.routingVersion).toBe(ROUTING_VERSION);
  });
});
