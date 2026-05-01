/**
 * Unit tests for the v4 routing service.
 *
 * Routing rules under test:
 *   - PRIMARY tier: category (specialization) match + language match, capacity-balanced.
 *   - FALLBACK tier: if no specialist is available, any navigator is eligible (language preserved).
 *   - Language is hard-rejected only when NO available navigator speaks it at all.
 *   - Capacity is a hard ceiling: navigators at or above capacity are excluded.
 *   - Queue (assigned: false) only when no navigator has remaining capacity.
 *   - isGeneralIntake does not restrict routing; all available navigators are eligible.
 *   - Among eligible candidates, lowest load ratio wins; stable tie-breaker on id.
 */

import { describe, it, expect } from "vitest";
import { assignNavigator, ROUTING_VERSION } from "../services/routingService.js";
import type { NavigatorProfile } from "../types.js";

const makeNav = (overrides: Partial<NavigatorProfile>): NavigatorProfile => ({
  id: "nav-1",
  userId: "@test:matrix.example.org",
  navGroup: "HOUSING_WORKS",
  expertiseTags: ["housing", "employment", "health", "benefits", "youth_services", "education"],
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

  it("routes to any available navigator regardless of isGeneralIntake", () => {
    const navs = [
      makeNav({ id: "n1", isGeneralIntake: false, status: "available" }),
      makeNav({ id: "n2", isGeneralIntake: true,  status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad, "initial");
    expect(outcome.assigned).toBe(true);
  });
});

// ── need_category routing ─────────────────────────────────────────────────────

describe("need_category routing", () => {
  it("assigns to a navigator whose expertiseTags includes the needCategory (primary tier)", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["employment"], status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["housing"],    status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n2");
      expect(outcome.routingReason.needCategoryMatch).toBe(true);
    }
  });

  it("falls back to any available navigator when no specialist handles the category", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["employment"], status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n1");
      expect(outcome.routingReason.needCategoryMatch).toBe(false);
    }
  });

  it("prefers a specialist over a generalist when both are available", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["employment"], status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["housing"],    status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "housing" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });

  it('"other" needCategory skips the category filter — any navigator is eligible', () => {
    const navs = [makeNav({ expertiseTags: [], status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.routingReason.needCategoryMatch).toBe(false);
  });

  it("queues when no navigators are available at all (not a category failure)", () => {
    const outcome = assignNavigator({ needCategory: "housing" }, [], noLoad);
    expect(outcome.assigned).toBe(false);
  });
});

// ── Language routing ──────────────────────────────────────────────────────────

describe("language routing", () => {
  it("assigns a navigator who speaks the requested language", () => {
    const navs = [
      makeNav({ id: "n1", languages: ["en"],       status: "available" }),
      makeNav({ id: "n2", languages: ["en", "es"], status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "other", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n2");
      expect(outcome.routingReason.languageMatch).toBe(true);
    }
  });

  it("hard-rejects when no available navigator speaks the requested language", () => {
    const navs = [makeNav({ id: "n1", languages: ["en"], status: "available" })];
    const outcome = assignNavigator({ needCategory: "other", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) expect(outcome.reason).toContain('"es"');
  });

  it("hard-rejects on language even in fallback (category unmatched + language unmatched)", () => {
    const navs = [makeNav({ id: "n1", languages: ["en"], expertiseTags: ["employment"], status: "available" })];
    // Housing specialist unavailable → fallback → but no one speaks "es" → queue
    const outcome = assignNavigator({ needCategory: "housing", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) expect(outcome.reason).toContain('"es"');
  });

  it("sets languageRequested in routingReason", () => {
    const navs = [makeNav({ languages: ["en", "es"], status: "available" })];
    const outcome = assignNavigator({ needCategory: "other", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.routingReason.languageRequested).toBe("es");
  });

  it("routes without language constraint when no language requested", () => {
    const navs = [makeNav({ languages: ["zh"], status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.routingReason.languageRequested).toBeNull();
      expect(outcome.routingReason.languageMatch).toBe(false);
    }
  });

  it("normalises language input to lowercase before matching", () => {
    const navs = [makeNav({ languages: ["es"], status: "available" })];
    const outcome = assignNavigator({ needCategory: "other", language: "ES" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
  });

  it("normalises navigator language values to lowercase before matching", () => {
    const navs = [makeNav({ languages: ["ES"], status: "available" })];
    const outcome = assignNavigator({ needCategory: "other", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
  });
});

// ── Tiered routing ────────────────────────────────────────────────────────────

describe("tiered routing", () => {
  it("PRIMARY: routes to specialist with category + language match", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["housing"],    languages: ["en"],       status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["employment"], languages: ["en", "es"], status: "available" }),
    ];
    // Only n1 has housing; n1 speaks "en"; n2 is a non-specialist that speaks "es"
    const outcome = assignNavigator({ needCategory: "housing", language: "en" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n1");
      expect(outcome.routingReason.needCategoryMatch).toBe(true);
      expect(outcome.routingReason.languageMatch).toBe(true);
    }
  });

  it("FALLBACK: routes to any navigator with language match when no specialist is available", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["employment"], languages: ["en", "es"], status: "available" }),
    ];
    // No housing specialist; n1 speaks "es" → fallback to n1
    const outcome = assignNavigator({ needCategory: "housing", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n1");
      expect(outcome.routingReason.needCategoryMatch).toBe(false);
      expect(outcome.routingReason.languageMatch).toBe(true);
    }
  });

  it("FALLBACK: picks lowest-load navigator in fallback tier", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["employment"], languages: ["es"], capacity: 4, status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["employment"], languages: ["es"], capacity: 4, status: "available" }),
    ];
    // n1 has 2 active sessions (ratio 0.5); n2 is idle → n2 wins in fallback
    const outcome = assignNavigator(
      { needCategory: "housing", language: "es" },
      navs,
      (id) => (id === "n1" ? 2 : 0),
    );
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });

  it("FALLBACK: queues when language unmatched even after dropping category", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["employment"], languages: ["en"], status: "available" }),
    ];
    // No housing specialist, and no one speaks "zh" → queue
    const outcome = assignNavigator({ needCategory: "housing", language: "zh" }, navs, noLoad);
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) expect(outcome.reason).toContain('"zh"');
  });

  it("specialist at full capacity falls through to non-specialist fallback", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["housing"],    capacity: 2, status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["employment"], capacity: 2, status: "available" }),
    ];
    // n1 (housing specialist) is full; n2 (employment) has capacity → fallback to n2
    const outcome = assignNavigator(
      { needCategory: "housing" },
      navs,
      (id) => (id === "n1" ? 2 : 0),
    );
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n2");
      expect(outcome.routingReason.needCategoryMatch).toBe(false);
    }
  });
});

// ── Capacity ceiling ──────────────────────────────────────────────────────────

describe("capacity ceiling", () => {
  it("excludes navigators with capacity <= 0", () => {
    const navs = [makeNav({ id: "n1", capacity: 0, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.assigned).toBe(false);
  });

  it("excludes navigators already at full capacity", () => {
    const navs = [makeNav({ id: "n1", capacity: 2, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, () => 2);
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) expect(outcome.reason).toContain("full capacity");
  });

  it("excludes navigators over capacity", () => {
    const navs = [makeNav({ id: "n1", capacity: 2, status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, () => 3);
    expect(outcome.assigned).toBe(false);
  });

  it("assigns to a navigator with remaining capacity", () => {
    const navs = [
      makeNav({ id: "n1", capacity: 2, status: "available" }),
      makeNav({ id: "n2", capacity: 2, status: "available" }),
    ];
    // n1 is at capacity (2/2), n2 has one slot remaining (1/2)
    const outcome = assignNavigator(
      { needCategory: "other" },
      navs,
      (id) => (id === "n1" ? 2 : 1),
    );
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });
});

// ── Load balancing ────────────────────────────────────────────────────────────

describe("load balancing", () => {
  it("prefers the navigator with the lower load ratio", () => {
    const navs = [
      makeNav({ id: "n1", capacity: 4, status: "available" }),
      makeNav({ id: "n2", capacity: 4, status: "available" }),
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
      makeNav({ id: "b-nav", status: "available" }),
      makeNav({ id: "a-nav", status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("a-nav");
  });

  it("load balances across specialists in primary tier", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["housing"], capacity: 4, status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["housing"], capacity: 4, status: "available" }),
    ];
    // n1 has 3 active sessions (ratio 0.75); n2 has 1 (ratio 0.25) → n2 wins
    const outcome = assignNavigator(
      { needCategory: "housing" },
      navs,
      (id) => (id === "n1" ? 3 : 1),
    );
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });
});

// ── Routing version ───────────────────────────────────────────────────────────

describe("routing version", () => {
  it("returns the current routing version on success", () => {
    const navs = [makeNav({ status: "available" })];
    const outcome = assignNavigator({ needCategory: "other" }, navs, noLoad);
    expect(outcome.routingVersion).toBe(ROUTING_VERSION);
  });

  it("includes routing version in unassigned outcomes", () => {
    const outcome = assignNavigator({ needCategory: "other" }, [], noLoad);
    expect(outcome.routingVersion).toBe(ROUTING_VERSION);
  });
});
