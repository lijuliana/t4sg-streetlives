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

  const tags = row.expertise_tags ?? row.specialties;
  const specialties: ReferralCategory[] = Array.isArray(tags)
    ? tags.filter((t): t is ReferralCategory => typeof t === "string" && isReferralCategory(t))
    : [];

  const languagesRaw = row.languages ?? row.language_preferences;
  const languages = Array.isArray(languagesRaw)
    ? languagesRaw.filter((l): l is string => typeof l === "string")
    : [];

  const statusRaw = row.status;
  const status: NavigatorProfile["status"] =
    statusRaw === "available" || statusRaw === "away" || statusRaw === "offline" ? statusRaw : "offline";

  const dbName =
    (typeof row.display_name === "string" && row.display_name.trim()) ||
    (typeof row.name === "string" && row.name.trim()) ||
    "";
  const name = dbName || (fallbackDisplayName?.trim() ?? "") || null;

  const cap = row.capacity;
  const capacity = typeof cap === "number" && Number.isFinite(cap) ? cap : 5;

  return {
    id,
    auth0_user_id,
    name,
    nav_group:
      typeof row.nav_group === "string"
        ? row.nav_group
        : typeof row.navGroup === "string"
          ? row.navGroup
          : "",
    status,
    capacity,
    languages,
    specialties: specialties.length ? specialties : null,
    availability_days: Array.isArray(row.availability_days ?? row.availabilityDays)
      ? ((row.availability_days ?? row.availabilityDays) as unknown[])
          .filter((d): d is string => typeof d === "string")
      : null,
    availability_start:
      typeof row.availability_start === "string"
        ? row.availability_start
        : typeof row.availabilityStart === "string"
          ? row.availabilityStart
          : null,
    availability_end:
      typeof row.availability_end === "string"
        ? row.availability_end
        : typeof row.availabilityEnd === "string"
          ? row.availabilityEnd
          : null,
  };
}

/** Body from `NavigatorProfileForm` uses `specialties`; Lambda expects `expertise_tags`. */
export function mapNavigatorUpsertBodyForLambda(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  if (Array.isArray(body.specialties)) {
    out.expertise_tags = body.specialties;
    out.specialties = body.specialties;
  }
  return out;
}
