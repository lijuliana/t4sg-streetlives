/**
 * Routing service — tiered specialization + language + capacity.
 *
 * Algorithm (applies to both initial assignment and re-routing):
 *   1. Filter to status="available" and capacity > 0.
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
 */

import type {
  NavigatorProfile,
  RoutingInput,
  RoutingMode,
  RoutingOutcome,
  RoutingReason,
} from "../types.js";

export const ROUTING_VERSION = "v4_tiered_category_lang_capacity";

function buildReason(
  languageRequested: string | null,
  languageMatch: boolean,
  needCategoryMatch: boolean,
  loadRatio: number,
): RoutingReason {
  return {
    generalIntakeOnly: false,
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
 */
export function assignNavigator(
  input: RoutingInput,
  navigators: NavigatorProfile[],
  getActiveLoad: (navigatorId: string) => number,
  mode: RoutingMode = "initial",
): RoutingOutcome {
  void mode;

  // Step 1: available navigators with a non-zero capacity setting
  const available = navigators.filter((n) => n.status === "available" && n.capacity > 0);

  // Step 2: exclude navigators at or above their capacity ceiling
  const withCapacity = available.filter((n) => getActiveLoad(n.id) < n.capacity);

  if (withCapacity.length === 0) {
    return {
      assigned: false,
      reason: available.length === 0
        ? "No available navigators"
        : "All navigators are at full capacity",
      routingVersion: ROUTING_VERSION,
    };
  }

  const lang = input.language?.toLowerCase() ?? null;
  const needsCategory = input.needCategory !== "other";

  // Step 3 (PRIMARY): specialist match — category + language
  if (needsCategory) {
    let specialists = withCapacity.filter((n) =>
      n.expertiseTags.map((t) => t.toLowerCase()).includes(input.needCategory.toLowerCase()),
    );
    if (lang) {
      specialists = specialists.filter((n) =>
        n.languages.map((l) => l.toLowerCase()).includes(lang),
      );
    }
    if (specialists.length > 0) {
      const best = rankByLoad(specialists, getActiveLoad)[0];
      return {
        assigned: true,
        navigator: best.nav,
        routingReason: buildReason(lang, !!lang, true, best.loadRatio),
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
      return {
        assigned: false,
        reason: `No available navigator speaks "${input.language}"`,
        routingVersion: ROUTING_VERSION,
      };
    }
  }

  const best = rankByLoad(fallback, getActiveLoad)[0];
  return {
    assigned: true,
    navigator: best.nav,
    routingReason: buildReason(lang, !!lang, false, best.loadRatio),
    routingVersion: ROUTING_VERSION,
  };
}
