import { auth0 } from "@/lib/auth0";
import { lambdaFetch } from "@/lib/lambda";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import NavigatorProfileForm from "@/components/NavigatorProfileForm";
import type { NavigatorProfile } from "@/lib/store";

// Fetches the logged-in navigator's profile from the real backend.
// Passes null to NavigatorProfileForm on first visit (no profile yet),
// which switches the form to creation mode.
export default async function NavigatorProfilePage() {
  const session = await auth0.getSession();
  if (!session) redirect("/auth/login");

  let profile: NavigatorProfile | null = null;
  try {
    const allRes = await lambdaFetch("/navigators");
    if (allRes.ok) {
      const all = await allRes.json().catch(() => []);
      const list: NavigatorProfile[] = Array.isArray(all) ? all : (all.navigators ?? []);
      profile = list.find((n) => n.auth0_user_id === session.user.sub) ?? null;
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
