/**
 * Routing service — tiered specialization + language + schedule + capacity.
 *
 * Algorithm (applies to both initial assignment and re-routing):
 *   1. Filter to status="available", capacity > 0, and within availabilitySchedule (if set).
 *   2. Exclude navigators at or above capacity (active load >= capacity).
 *   3. If none remain → queue (assigned: false).
 *   4. PRIMARY: find specialists — category match (unless "other") + language match (if specified).
 *      If any found → sort by load ratio (asc), assign top candidate.
 *   5. FALLBACK: no specialists available → any navigator below capacity, language preserved.
 *      If any found → sort by load ratio (asc), assign top candidate.
 *   6. If fallback empty → queue (language cannot be served by any available navigator).
 *
 * Load balancing (all tiers): sort by activeLoad / capacity (ascending); id as stable tie-breaker.
 * Navigators with a lower active:capacity ratio always receive new users over busier ones.
 *
 * Schedule check: if a navigator has an availabilitySchedule, they are only eligible during the
 * configured time window for the current day. Missing a day means unavailable that day. Navigators
 * with no schedule set are considered reachable whenever their status is "available".
 */

import type {
  NavigatorProfile,
  RoutingInput,
  RoutingMode,
  RoutingOutcome,
  RoutingReason,
} from "../types.js";

export const ROUTING_VERSION = "v6_tiered_category_lang_schedule_capacity";

const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Returns true when `now` falls within the navigator's availability window for the current day.
 * Navigators with no schedule (undefined or empty) are NOT eligible — an empty schedule indicates
 * an incomplete onboarding profile.
 */
export function isWithinSchedule(nav: NavigatorProfile, now: Date): boolean {
  const schedule = nav.availabilitySchedule;
  if (!schedule || Object.keys(schedule).length === 0) return false;

  const dayKey = DAY_ABBREVIATIONS[now.getDay()];
  const hours = schedule[dayKey];
  if (!hours) return false;

  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= toMinutes(hours.start) && currentMinutes < toMinutes(hours.end);
}

function routingLog(entry: {
  category: string;
  language: string | null;
  roster: number;
  excluded: { notAvailable: number; outsideSchedule: number; overCapacity: number };
  pool: number;
  tier: "primary" | "fallback" | null;
  candidates: Array<{ id: string; ratio: number }>;
  selected: string | null;
  outcome: "assigned" | "unassigned";
  failReason: string | null;
  routingReason?: RoutingReason;
}): void {
  console.log(`[routing] ${JSON.stringify(entry)}`);
  if (entry.routingReason) {
    const r = entry.routingReason;
    console.log(
      `[routing:reason] assigned to ${entry.selected}` +
      ` tier=${entry.tier}` +
      ` languageRequested=${r.languageRequested ?? "none"} languageMatch=${r.languageMatch}` +
      ` needCategoryMatch=${r.needCategoryMatch}` +
      ` loadRatio=${r.loadRatio.toFixed(3)}`,
    );
  } else if (entry.failReason) {
    console.log(`[routing:reason] unassigned — ${entry.failReason}`);
  }
}

function buildReason(
  languageRequested: string | null,
  languageMatch: boolean,
  needCategoryMatch: boolean,
  loadRatio: number,
): RoutingReason {
  return {
    languageRequested,
    languageMatch,
    needCategoryMatch,
    loadRatio,
    score: -loadRatio,
  };
}

function rankByLoad(
  pool: NavigatorProfile[],
  getActiveLoad: (id: string) => number,
): Array<{ nav: NavigatorProfile; loadRatio: number }> {
  return pool
    .map((nav) => ({ nav, loadRatio: getActiveLoad(nav.id) / nav.capacity }))
    .sort((a, b) => a.loadRatio - b.loadRatio || a.nav.id.localeCompare(b.nav.id));
}

/**
 * Assigns the best available navigator for the given routing input.
 *
 * @param input         Routing parameters (needCategory and language drive filtering)
 * @param navigators    Full roster (caller passes navigatorStore.list())
 * @param getActiveLoad Returns current active-session count for a navigator id
 * @param mode          Retained for API compatibility; does not restrict routing behavior
 * @param now           Timestamp used for schedule evaluation (defaults to current time)
 */
export function assignNavigator(
  input: RoutingInput,
  navigators: NavigatorProfile[],
  getActiveLoad: (navigatorId: string) => number,
  mode: RoutingMode = "initial",
  now: Date = new Date(),
): RoutingOutcome {
  void mode;

  // Step 1: filter by status + capacity, then by schedule
  const statusEligible = navigators.filter((n) => n.status === "available" && n.capacity > 0);
  const available = statusEligible.filter((n) => isWithinSchedule(n, now));

  // Step 2: exclude navigators at or above their capacity ceiling
  const withCapacity = available.filter((n) => getActiveLoad(n.id) < n.capacity);

  const excluded = {
    notAvailable: navigators.length - statusEligible.length,
    outsideSchedule: statusEligible.length - available.length,
    overCapacity: available.length - withCapacity.length,
  };
  const logBase = {
    category: input.needCategory,
    language: input.language ?? null,
    roster: navigators.length,
    excluded,
    pool: withCapacity.length,
  };

  // Per-navigator diagnostic log: shows exactly why each navigator was included or excluded.
  const dayKey = DAY_ABBREVIATIONS[now.getDay()];
  console.log(`[routing:navigators] request=category:${input.needCategory} language:${input.language ?? "any"} time:${now.toISOString()} day:${dayKey}`);
  for (const n of navigators) {
    const load = getActiveLoad(n.id);
    const scheduleEntry = n.availabilitySchedule?.[dayKey];
    const scheduleStr = n.availabilitySchedule
      ? (scheduleEntry ? `${scheduleEntry.start}-${scheduleEntry.end}` : `no entry for ${dayKey}`)
      : "no schedule (incomplete)";
    let exclusionReason = "";
    if (n.status !== "available") exclusionReason = `status=${n.status}`;
    else if (n.capacity <= 0) exclusionReason = `capacity=${n.capacity}`;
    else if (!isWithinSchedule(n, now)) exclusionReason = `outside schedule [${scheduleStr}]`;
    else if (load >= n.capacity) exclusionReason = `over capacity (${load}/${n.capacity})`;
    const eligible = exclusionReason === "";
    console.log(
      `[routing:navigators]   ${eligible ? "✓" : "✗"} id=${n.id} userId=${n.userId}` +
      ` status=${n.status} load=${load}/${n.capacity}` +
      ` schedule=[${scheduleStr}]` +
      ` tags=[${n.expertiseTags.join(",")}]` +
      ` languages=[${n.languages.join(",")}]` +
      (exclusionReason ? ` → EXCLUDED: ${exclusionReason}` : " → eligible"),
    );
  }

  if (withCapacity.length === 0) {
    const reason = available.length === 0
      ? "No available navigators"
      : "All navigators are at full capacity";
    routingLog({ ...logBase, tier: null, candidates: [], selected: null, outcome: "unassigned", failReason: reason });
    return { assigned: false, reason, routingVersion: ROUTING_VERSION };
  }

  const lang = input.language?.toLowerCase() ?? null;
  const needsCategory = input.needCategory !== "other";

  // Normalises a tag or category slug for comparison: lowercase, strip spaces and underscores.
  // Allows "Personal Care" tags to match "personal_care" slugs and vice versa.
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_]/g, "");

  // Step 3 (PRIMARY): specialist match — category + language
  if (needsCategory) {
    let specialists = withCapacity.filter((n) =>
      n.expertiseTags.some((t) => normalize(t) === normalize(input.needCategory)),
    );
    if (lang) {
      specialists = specialists.filter((n) =>
        n.languages.map((l) => l.toLowerCase()).includes(lang),
      );
    }
    if (specialists.length > 0) {
      const ranked = rankByLoad(specialists, getActiveLoad);
      const best = ranked[0];
      const reason = buildReason(lang, !!lang, true, best.loadRatio);
      routingLog({ ...logBase, tier: "primary", candidates: ranked.map((r) => ({ id: r.nav.id, ratio: r.loadRatio })), selected: best.nav.id, outcome: "assigned", failReason: null, routingReason: reason });
      return {
        assigned: true,
        navigator: best.nav,
        routingReason: reason,
        routingVersion: ROUTING_VERSION,
      };
    }
    // No specialist available — fall through to any-navigator fallback
  }

  // Step 4 (FALLBACK): any available navigator below capacity, language preserved
  let fallback = withCapacity;
  if (lang) {
    fallback = withCapacity.filter((n) =>
      n.languages.map((l) => l.toLowerCase()).includes(lang),
    );
    if (fallback.length === 0) {
      const reason = `No available navigator speaks "${input.language}"`;
      routingLog({ ...logBase, tier: "fallback", candidates: [], selected: null, outcome: "unassigned", failReason: reason });
      return { assigned: false, reason, routingVersion: ROUTING_VERSION };
    }
  }

  const ranked = rankByLoad(fallback, getActiveLoad);
  const best = ranked[0];
  const reason = buildReason(lang, !!lang, false, best.loadRatio);
  routingLog({ ...logBase, tier: "fallback", candidates: ranked.map((r) => ({ id: r.nav.id, ratio: r.loadRatio })), selected: best.nav.id, outcome: "assigned", failReason: null, routingReason: reason });
  return {
    assigned: true,
    navigator: best.nav,
    routingReason: reason,
    routingVersion: ROUTING_VERSION,
  };
}
