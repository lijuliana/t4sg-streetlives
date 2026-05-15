import type { NavigatorProfile, ReferralCategory } from "@/lib/store";
import { REFERRAL_CATEGORIES } from "@/lib/store";

function isReferralCategory(x: string): x is ReferralCategory {
  return (REFERRAL_CATEGORIES as readonly string[]).includes(x);
}

/** Map RDS / Lambda row shape → app `NavigatorProfile` (Matrix form + dashboard). */
export function normalizeNavigatorFromLambda(
  raw: unknown,
  fallbackDisplayName?: string | null,
  fallbackAuth0UserId?: string | null
): NavigatorProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = row.id ?? row.navigator_id ?? row.navigatorId;
  const auth0_user_id =
    row.auth0_user_id ??
    row.userId ??
    row.auth0UserId ??
    row.auth0_sub ??
    row.sub ??
    fallbackAuth0UserId;
  if (typeof id !== "string" || typeof auth0_user_id !== "string") return null;

  let first_name = typeof row.first_name === "string" ? row.first_name.trim() : "";
  let last_name = typeof row.last_name === "string" ? row.last_name.trim() : "";

  const dbCombined =
    (typeof row.display_name === "string" && row.display_name.trim()) ||
    (typeof row.name === "string" && row.name.trim()) ||
    "";
  const fallback = fallbackDisplayName?.trim() ?? "";
  const combinedForSplit = !first_name && !last_name ? dbCombined || fallback : "";

  if (combinedForSplit) {
    const idx = combinedForSplit.indexOf(" ");
    if (idx === -1) {
      first_name = combinedForSplit;
    } else {
      first_name = combinedForSplit.slice(0, idx).trim();
      last_name = combinedForSplit.slice(idx + 1).trim();
    }
  }

  const tags = row.expertise_tags ?? row.specialties;
  const expertiseFiltered: string[] = Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === "string" && isReferralCategory(t))
    : [];
  const expertise_tags = expertiseFiltered.length ? expertiseFiltered : null;

  const languagesRaw = row.languages ?? row.language_preferences;
  const languages = Array.isArray(languagesRaw)
    ? languagesRaw.filter((l): l is string => typeof l === "string")
    : [];

  const statusRaw = row.status;
  const status: NavigatorProfile["status"] =
    statusRaw === "available" || statusRaw === "away" || statusRaw === "offline" ? statusRaw : "offline";

  const cap = row.capacity;
  const capacity = typeof cap === "number" && Number.isFinite(cap) ? cap : 5;

  const schedRaw = row.availability_schedule;
  const availability_schedule =
    schedRaw && typeof schedRaw === "object" && !Array.isArray(schedRaw)
      ? (schedRaw as Record<string, { start: string; end: string }>)
      : null;

  const is_general_intake =
    typeof row.is_general_intake === "boolean" ? row.is_general_intake : undefined;

  return {
    id,
    auth0_user_id,
    first_name,
    last_name,
    nav_group:
      typeof row.nav_group === "string"
        ? row.nav_group
        : typeof row.navGroup === "string"
          ? row.navGroup
          : "",
    status,
    capacity,
    languages,
    expertise_tags,
    availability_schedule,
    ...(is_general_intake !== undefined ? { is_general_intake } : {}),
  };
}

/** Body from client may use `specialties`; Lambda may expect `expertise_tags`. */
export function mapNavigatorUpsertBodyForLambda(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  if (Array.isArray(body.specialties) && !Array.isArray(body.expertise_tags)) {
    out.expertise_tags = body.specialties;
  }
  delete out.specialties;
  return out;
}
