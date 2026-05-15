import { auth0 } from "@/lib/auth0";
import { lambdaFetch } from "@/lib/lambda";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import NavigatorProfileForm from "@/components/NavigatorProfileForm";
import { normalizeNavigatorFromLambda } from "@/lib/navigatorProfile";
import type { NavigatorProfile } from "@/lib/store";

// Fetches the logged-in navigator's profile from the real backend.
// Passes null to NavigatorProfileForm on first visit (no profile yet),
// which switches the form to creation mode.
export default async function NavigatorProfilePage() {
  const session = await auth0.getSession();
  if (!session) redirect("/auth/login");

  let profile: NavigatorProfile | null = null;
  try {
    const res = await lambdaFetch("/navigators/me");
    if (res.ok) {
      profile = normalizeNavigatorFromLambda(
        await res.json(),
        session.user?.name ?? null,
        session.user?.sub ?? null
      );
    } else if (res.status === 401) {
      redirect("/auth/login?returnTo=/dashboard/navigator/profile");
    } else {
      // Compatibility fallback for backends that don't yet expose /navigators/me
      // and for transient backend failures on /navigators/me.
      const allRes = await lambdaFetch("/navigators");
      if (allRes.ok) {
        const allBody = (await allRes.json().catch(() => [])) as unknown;
        const rows = Array.isArray(allBody)
          ? allBody
          : ((allBody as { navigators?: unknown[] })?.navigators ?? []);
        const mine = rows.find((row) => {
          if (!row || typeof row !== "object") return false;
          const r = row as Record<string, unknown>;
          return r.auth0_user_id === session.user.sub || r.userId === session.user.sub;
        });
        profile = normalizeNavigatorFromLambda(
          mine,
          session.user?.name ?? null,
          session.user?.sub ?? null
        );
      }
    }
  } catch {
    // No profile exists yet — form will create one.
  }

  const isNew = profile === null;

  return (
    <DashboardShell
      title={isNew ? "Set Up Your Profile" : "Edit Profile"}
      role="navigator"
      backHref={isNew ? undefined : "/dashboard/navigator"}
    >
      {isNew && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-5">
          <p className="text-sm text-amber-700 font-medium mb-0.5">Welcome to StreetLives</p>
          <p className="text-sm text-amber-700">
            Complete your profile before you can receive sessions. This helps the routing
            system match you to the people seeking help.
          </p>
        </div>
      )}
      <NavigatorProfileForm initialProfile={profile} auth0UserId={session.user.sub} />
    </DashboardShell>
  );
}
