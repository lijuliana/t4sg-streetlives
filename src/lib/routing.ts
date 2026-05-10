/**
 * Client-side routing algorithm for Next.js API layer.
 *
 * Mirrors the Express routingService logic but works against Lambda's
 * navigator data shape (snake_case fields, full language names).
 *
 * Algorithm:
 *   1. Filter: status=available, has schedule set, within schedule window, under capacity.
 *   2. PRIMARY: expertise_tags match needCategory + language match → lowest load ratio.
 *   3. FALLBACK: any eligible navigator, language preserved → lowest load ratio.
 *   4. If language cannot be served → null (queue).
 */

const DAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Maps ISO 639-1 codes to the full language name format Lambda stores.
const ISO_TO_FULL: Record<string, string> = {
  en: "english",
  es: "spanish",
  fr: "french",
  zh: "mandarin",
  ar: "arabic",
  pt: "portuguese",
  ru: "russian",
  de: "german",
  it: "italian",
  ja: "japanese",
  ko: "korean",
  hi: "hindi",
  so: "somali",
  ht: "haitiancreole",
  yi: "yiddish",
};

export interface LambdaNavigator {
  id: string;
  status: string;
  capacity: number;
  languages: string[];
  expertise_tags: string[];
  availability_schedule: Record<string, { start: string; end: string }> | null | undefined;
  // Optional display fields returned by Lambda but not used in routing logic
  first_name?: string | null;
  last_name?: string | null;
  nav_group?: string | null;
}

export interface RoutingInput {
  needCategory: string;
  language?: string;
}

export interface RoutingPick {
  navigatorId: string;
  tier: "primary" | "fallback";
  loadRatio: number;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}

function languageMatches(navLanguages: string[], requestedIso: string): boolean {
  const isoNorm = normalize(requestedIso);
  const fullNorm = ISO_TO_FULL[isoNorm] ?? isoNorm;
  return navLanguages.some((l) => {
    const lNorm = normalize(l);
    return lNorm === isoNorm || lNorm === fullNorm;
  });
}

export function isWithinSchedule(
  schedule: Record<string, { start: string; end: string }> | null | undefined,
  now: Date,
): boolean {
  // No schedule set = incomplete profile = not available for routing
  if (!schedule || Object.keys(schedule).length === 0) return false;
  const dayKey = DAY_ABBREVIATIONS[now.getDay()];
  const hours = schedule[dayKey];
  if (!hours) return false;
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= toMinutes(hours.start) && current < toMinutes(hours.end);
}

export function pickNavigator(
  navigators: LambdaNavigator[],
  activeLoadMap: Record<string, number>,
  input: RoutingInput,
  now: Date = new Date(),
): RoutingPick | null {
  const eligible = navigators.filter((n) => {
    if (n.status !== "available" || (n.capacity ?? 0) <= 0) return false;
    if (!n.expertise_tags?.length || !n.languages?.length) return false;
    if (!isWithinSchedule(n.availability_schedule, now)) return false;
    return (activeLoadMap[n.id] ?? 0) < (n.capacity ?? 0);
  });

  if (eligible.length === 0) return null;

  const rankByLoad = (pool: LambdaNavigator[]) =>
    pool
      .map((n) => ({ n, ratio: (activeLoadMap[n.id] ?? 0) / n.capacity }))
      .sort((a, b) => a.ratio - b.ratio || a.n.id.localeCompare(b.n.id));

  const lang = input.language?.toLowerCase() ?? null;
  const needsCategory = input.needCategory !== "other";

  // PRIMARY tier: expertise tag match + language match
  if (needsCategory) {
    let specialists = eligible.filter((n) =>
      n.expertise_tags.some((t) => normalize(t) === normalize(input.needCategory)),
    );
    if (lang) specialists = specialists.filter((n) => languageMatches(n.languages, lang));
    if (specialists.length > 0) {
      const best = rankByLoad(specialists)[0];
      return { navigatorId: best.n.id, tier: "primary", loadRatio: best.ratio };
    }
  }

  // FALLBACK tier: any eligible navigator, language preserved
  let fallback = eligible;
  if (lang) {
    fallback = eligible.filter((n) => languageMatches(n.languages, lang));
    if (fallback.length === 0) return null;
  }

  const best = rankByLoad(fallback)[0];
  return { navigatorId: best.n.id, tier: "fallback", loadRatio: best.ratio };
}
