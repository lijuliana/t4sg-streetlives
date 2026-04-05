/**
 * Routing service — v2 language-first, general-intake model.
 *
 * Design principles:
 *   - All navigators are assumed cross-trained on all need categories.
 *   - need_category is retained for analytics and future routing versions
 *     but does NOT constrain eligibility now.
 *   - Language compatibility is the primary routing signal.
 *   - is_general_intake gates initial assignment; transfer can reach any navigator.
 *
 * Algorithm (initial assignment):
 *   1. Exclude navigators whose status is "away" or "offline".
 *   2. Restrict to navigators with is_general_intake = true.
 *   3. If a language is requested, hard-reject if no candidate speaks it.
 *   4. Among eligible candidates, sort by ascending load ratio (active / capacity),
 *      with navigator ID as a stable tie-breaker.
 *   5. Return the top candidate.
 *
 * Algorithm (transfer):
 *   Same as above but step 2 is skipped — any available navigator is eligible.
 *   Language hard-reject still applies when a language is requested.
 *
 * Returns a discriminated RoutingOutcome so callers never silently swallow
 * the "no match" case without capturing the reason.
 */

import type {
  NavigatorProfile,
  NeedCategory,
  RoutingInput,
  RoutingMode,
  RoutingOutcome,
  RoutingReason,
} from "../types.js";

export const ROUTING_VERSION = "v2_language_first_general_intake";

function buildReason(
  generalIntakeOnly: boolean,
  languageRequested: string | null,
  languageMatch: boolean,
  loadRatio: number,
): RoutingReason {
  return {
    generalIntakeOnly,
    languageRequested,
    languageMatch,
    loadRatio,
    // score = negative load ratio so callers can reason about it as "higher is better"
    score: -loadRatio,
  };
}

/**
 * Assigns the best available navigator for the given routing input.
 *
 * @param input         Routing parameters (needCategory stored for audit; language drives filtering)
 * @param navigators    Full roster (caller passes navigatorStore.list())
 * @param getActiveLoad Returns current active-session count for a navigator id
 * @param mode          "initial" restricts to general-intake navigators; "transfer" allows all
 */
export function assignNavigator(
  input: RoutingInput,
  navigators: NavigatorProfile[],
  getActiveLoad: (navigatorId: string) => number,
  mode: RoutingMode = "initial",
): RoutingOutcome {
  const generalIntakeOnly = mode === "initial";

  // Step 1: availability filter
  let candidates = navigators.filter((n) => n.status === "available");

  // Step 2: general-intake gate (initial assignments only)
  if (generalIntakeOnly) {
    candidates = candidates.filter((n) => n.isGeneralIntake);
  }

  if (candidates.length === 0) {
    return {
      assigned: false,
      reason: generalIntakeOnly
        ? "No available general-intake navigators"
        : "No available navigators",
      routingVersion: ROUTING_VERSION,
    };
  }

  // Step 3: language filter — hard rejection when language is requested and unmatched
  const normalizedLang = input.language?.toLowerCase() ?? null;
  if (normalizedLang) {
    const langCandidates = candidates.filter((n) => n.languages.includes(normalizedLang));
    if (langCandidates.length === 0) {
      const scope = generalIntakeOnly ? "general-intake " : "";
      return {
        assigned: false,
        reason: `No available ${scope}navigator speaks "${input.language}"`,
        routingVersion: ROUTING_VERSION,
      };
    }
    candidates = langCandidates;
  }

  // Step 4: sort by ascending load ratio, then stable id tie-breaker
  const ranked = candidates
    .map((nav) => ({
      nav,
      loadRatio: getActiveLoad(nav.id) / Math.max(nav.capacity, 1),
    }))
    .sort((a, b) => a.loadRatio - b.loadRatio || a.nav.id.localeCompare(b.nav.id));

  const best = ranked[0];
  return {
    assigned: true,
    navigator: best.nav,
    routingReason: buildReason(generalIntakeOnly, normalizedLang, !!normalizedLang, best.loadRatio),
    routingVersion: ROUTING_VERSION,
  };
}
