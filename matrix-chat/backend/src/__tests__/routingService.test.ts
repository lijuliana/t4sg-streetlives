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
import { assignNavigator, isWithinSchedule, ROUTING_VERSION } from "../services/routingService.js";
import type { NavigatorProfile } from "../types.js";

const makeNav = (overrides: Partial<NavigatorProfile>): NavigatorProfile => ({
  id: "nav-1",
  userId: "@test:matrix.example.org",
  navGroup: "HOUSING_WORKS",
  expertiseTags: ["Accommodations", "Work", "Health", "Food", "Clothing", "Personal Care", "Family Services", "Legal", "Connection"],
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

// ── Basic eligibility ─────────────────────────────────────────────────────────

describe("basic eligibility", () => {
  it("returns unassigned when navigator list is empty", () => {
    const outcome = assignNavigator({ needCategory: "accommodations" }, [], noLoad);
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
      makeNav({ id: "n1", expertiseTags: ["Work"],           status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["Accommodations"], status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "accommodations" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n2");
      expect(outcome.routingReason.needCategoryMatch).toBe(true);
    }
  });

  it("falls back to any available navigator when no specialist handles the category", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["Work"], status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "accommodations" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n1");
      expect(outcome.routingReason.needCategoryMatch).toBe(false);
    }
  });

  it("prefers a specialist over a generalist when both are available", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["Work"],           status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["Accommodations"], status: "available" }),
    ];
    const outcome = assignNavigator({ needCategory: "accommodations" }, navs, noLoad);
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
    const outcome = assignNavigator({ needCategory: "accommodations" }, [], noLoad);
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
    const navs = [makeNav({ id: "n1", languages: ["en"], expertiseTags: ["Work"], status: "available" })];
    // Accommodations specialist unavailable → fallback → but no one speaks "es" → queue
    const outcome = assignNavigator({ needCategory: "accommodations", language: "es" }, navs, noLoad);
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
      makeNav({ id: "n1", expertiseTags: ["Accommodations"], languages: ["en"],       status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["Work"],           languages: ["en", "es"], status: "available" }),
    ];
    // Only n1 has accommodations; n1 speaks "en"; n2 is a non-specialist that speaks "es"
    const outcome = assignNavigator({ needCategory: "accommodations", language: "en" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n1");
      expect(outcome.routingReason.needCategoryMatch).toBe(true);
      expect(outcome.routingReason.languageMatch).toBe(true);
    }
  });

  it("FALLBACK: routes to any navigator with language match when no specialist is available", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["Work"], languages: ["en", "es"], status: "available" }),
    ];
    // No accommodations specialist; n1 speaks "es" → fallback to n1
    const outcome = assignNavigator({ needCategory: "accommodations", language: "es" }, navs, noLoad);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) {
      expect(outcome.navigator.id).toBe("n1");
      expect(outcome.routingReason.needCategoryMatch).toBe(false);
      expect(outcome.routingReason.languageMatch).toBe(true);
    }
  });

  it("FALLBACK: picks lowest-load navigator in fallback tier", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["Work"], languages: ["es"], capacity: 4, status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["Work"], languages: ["es"], capacity: 4, status: "available" }),
    ];
    // n1 has 2 active sessions (ratio 0.5); n2 is idle → n2 wins in fallback
    const outcome = assignNavigator(
      { needCategory: "accommodations", language: "es" },
      navs,
      (id) => (id === "n1" ? 2 : 0),
    );
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });

  it("FALLBACK: queues when language unmatched even after dropping category", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["Work"], languages: ["en"], status: "available" }),
    ];
    // No accommodations specialist, and no one speaks "zh" → queue
    const outcome = assignNavigator({ needCategory: "accommodations", language: "zh" }, navs, noLoad);
    expect(outcome.assigned).toBe(false);
    if (!outcome.assigned) expect(outcome.reason).toContain('"zh"');
  });

  it("specialist at full capacity falls through to non-specialist fallback", () => {
    const navs = [
      makeNav({ id: "n1", expertiseTags: ["Accommodations"], capacity: 2, status: "available" }),
      makeNav({ id: "n2", expertiseTags: ["Work"],           capacity: 2, status: "available" }),
    ];
    // n1 (accommodations specialist) is full; n2 (work) has capacity → fallback to n2
    const outcome = assignNavigator(
      { needCategory: "accommodations" },
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

// ── Availability schedule ─────────────────────────────────────────────────────

// January 1 2024 was a Monday. Use fixed timestamps for deterministic day/time checks.
const mon10am  = new Date(2024, 0, 1, 10,  0); // Mon 10:00
const mon8am   = new Date(2024, 0, 1,  8,  0); // Mon 08:00 (before window)
const mon6pm   = new Date(2024, 0, 1, 18,  0); // Mon 18:00 (after window)
const mon9am   = new Date(2024, 0, 1,  9,  0); // Mon 09:00 (exactly at start)
const mon5pm   = new Date(2024, 0, 1, 17,  0); // Mon 17:00 (exactly at end — exclusive)
const tue10am  = new Date(2024, 0, 2, 10,  0); // Tue 10:00 (different day)
const sun10am  = new Date(2024, 0, 7, 10,  0); // Sun 10:00 (day not in schedule)

describe("isWithinSchedule", () => {
  const navWithSchedule = makeNav({
    availabilitySchedule: {
      Mon: { start: "09:00", end: "17:00" },
      Tue: { start: "09:00", end: "17:00" },
    },
  });

  it("returns false when no schedule is set (incomplete profile — not matchable)", () => {
    const nav = makeNav({ availabilitySchedule: undefined });
    expect(isWithinSchedule(nav, mon10am)).toBe(false);
  });

  it("returns false when schedule is an empty object (incomplete profile — not matchable)", () => {
    const nav = makeNav({ availabilitySchedule: {} });
    expect(isWithinSchedule(nav, mon10am)).toBe(false);
  });

  it("returns true when now is within the day's window", () => {
    expect(isWithinSchedule(navWithSchedule, mon10am)).toBe(true);
  });

  it("returns true exactly at the start boundary (inclusive)", () => {
    expect(isWithinSchedule(navWithSchedule, mon9am)).toBe(true);
  });

  it("returns false exactly at the end boundary (exclusive)", () => {
    expect(isWithinSchedule(navWithSchedule, mon5pm)).toBe(false);
  });

  it("returns false when now is before the day's window", () => {
    expect(isWithinSchedule(navWithSchedule, mon8am)).toBe(false);
  });

  it("returns false when now is after the day's window", () => {
    expect(isWithinSchedule(navWithSchedule, mon6pm)).toBe(false);
  });

  it("returns false when the current day is not in the schedule", () => {
    expect(isWithinSchedule(navWithSchedule, sun10am)).toBe(false);
  });

  it("returns true for a different day that is in the schedule", () => {
    expect(isWithinSchedule(navWithSchedule, tue10am)).toBe(true);
  });
});

describe("availability schedule — assignNavigator integration", () => {
  it("queues user when navigator is available status but outside schedule hours", () => {
    const nav = makeNav({
      id: "n1",
      status: "available",
      availabilitySchedule: { Mon: { start: "09:00", end: "17:00" } },
    });
    const outcome = assignNavigator({ needCategory: "other" }, [nav], noLoad, "initial", mon8am);
    expect(outcome.assigned).toBe(false);
  });

  it("assigns navigator when within schedule hours", () => {
    const nav = makeNav({
      id: "n1",
      status: "available",
      availabilitySchedule: { Mon: { start: "09:00", end: "17:00" } },
    });
    const outcome = assignNavigator({ needCategory: "other" }, [nav], noLoad, "initial", mon10am);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n1");
  });

  it("queues user when available navigator's scheduled day does not match", () => {
    const nav = makeNav({
      id: "n1",
      status: "available",
      availabilitySchedule: { Mon: { start: "09:00", end: "17:00" } },
    });
    const outcome = assignNavigator({ needCategory: "other" }, [nav], noLoad, "initial", sun10am);
    expect(outcome.assigned).toBe(false);
  });

  it("routes to wide-schedule navigator when narrow-schedule one is outside window", () => {
    const narrow = makeNav({
      id: "n1",
      status: "available",
      availabilitySchedule: { Mon: { start: "09:00", end: "17:00" } },
    });
    // n2 uses the makeNav default: full-week 00:00-24:00, so eligible at mon8am
    const wide = makeNav({ id: "n2", status: "available" });
    const outcome = assignNavigator({ needCategory: "other" }, [narrow, wide], noLoad, "initial", mon8am);
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n2");
  });

  it("load balances among in-schedule navigators, ignoring out-of-schedule ones", () => {
    const outOfSchedule = makeNav({
      id: "n1",
      status: "available",
      capacity: 10,
      availabilitySchedule: { Tue: { start: "09:00", end: "17:00" } }, // Mon not included
    });
    const highLoad = makeNav({ id: "n2", status: "available", capacity: 4 }); // default full-week schedule
    const lowLoad  = makeNav({ id: "n3", status: "available", capacity: 4 }); // default full-week schedule
    // n2 has load ratio 0.5, n3 is idle → n3 wins; n1 is excluded by schedule
    const outcome = assignNavigator(
      { needCategory: "other" },
      [outOfSchedule, highLoad, lowLoad],
      (id) => (id === "n2" ? 2 : 0),
      "initial",
      mon10am,
    );
    expect(outcome.assigned).toBe(true);
    if (outcome.assigned) expect(outcome.navigator.id).toBe("n3");
  });
});
