import { auth0 } from "@/lib/auth0";
import { lambdaFetch } from "@/lib/lambda";
import { redirect } from "next/navigation";
import Link from "next/link";
import moment from "moment";
import DashboardShell from "@/components/DashboardShell";
import SessionStatusBadge from "@/components/SessionStatusBadge";

interface RealSession {
  id: string;
  navigator_id: string | null;
  need_category: string;
  language: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  routing_reason: object | null;
}

interface NavProfile {
  id: string;
  auth0_user_id: string;
  nav_group: string;
  status: string;
  capacity: number;
}

function mapStatus(s: string): "queued" | "active" | "closed" {
  if (s === "unassigned") return "queued";
  if (s === "closed") return "closed";
  return "active";
}

function SessionRow({ session }: { session: RealSession }) {
  const status = mapStatus(session.status);
  return (
    <Link
      href={`/dashboard/navigator/${session.id}/chat`}
      className="block bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-gray-300 hover:shadow-md transition"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-gray-900 capitalize">
            {session.need_category.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 capitalize">{session.need_category.replace("_", " ")}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {session.language && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {session.language.toUpperCase()}
              </span>
            )}
            {session.routing_reason && (
              <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">Routed</span>
            )}
            <span className="text-xs text-gray-400">
              {moment(session.created_at).calendar(null, {
                sameDay: "[Today at] h:mm A",
                lastDay: "[Yesterday at] h:mm A",
                lastWeek: "MMM D [at] h:mm A",
                sameElse: "MMM D, YYYY [at] h:mm A",
              })}
            </span>
          </div>
        </div>
        <SessionStatusBadge status={status} size="sm" />
      </div>
    </Link>
  );
}

export default async function NavigatorDashboardPage() {
  const session = await auth0.getSession();
  if (!session) redirect("/auth/login");

  const [sessionsRes, navsRes] = await Promise.all([
    lambdaFetch("/sessions"),
    lambdaFetch("/navigators"),
  ]);

  const sessionsBody = await sessionsRes.json().catch(() => ({}));
  const navsBody = await navsRes.json().catch(() => ({}));

  if (!sessionsRes.ok) console.error("[nav-dashboard] /sessions Lambda error body:", JSON.stringify(sessionsBody));
  if (!navsRes.ok) console.error("[nav-dashboard] /navigators Lambda error body:", JSON.stringify(navsBody));

  const allSessions: RealSession[] = sessionsRes.ok ? sessionsBody : [];
  const navigators: NavProfile[] = navsRes.ok ? navsBody : [];

  const myProfile = navigators.find((n) => n.auth0_user_id === session.user.sub);

  const byRecent = (a: RealSession, b: RealSession) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const mySessions = myProfile
    ? allSessions.filter((s) => s.navigator_id === myProfile.id)
    : [];

  const newRequests = allSessions.filter((s) => s.navigator_id === null).sort(byRecent);
  const active = mySessions.filter((s) => s.status !== "closed").sort(byRecent);
  const past = mySessions.filter((s) => s.status === "closed").sort(byRecent);

  return (
    <DashboardShell title="My Sessions" role="navigator">
      {!myProfile && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-700">
          No navigator profile found for your account. Ask a supervisor to create one.
        </div>
      )}

      {/* Summary strip */}
      <div className="flex gap-4 bg-white border border-gray-200 rounded-md px-5 py-4">
        <div className="flex-1 text-center">
          <p className="text-2xl font-normal text-gray-900">{active.length}</p>
          <p className="text-xs text-green-600 font-medium mt-0.5">Active</p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="flex-1 text-center">
          <p className={`text-2xl font-normal mt-0.5 ${newRequests.length > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {newRequests.length}
          </p>
          <p className="text-xs text-amber-600 font-medium mt-0.5">New Requests</p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="flex-1 text-center">
          <p className="text-2xl font-normal text-gray-900">{past.length}</p>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Closed</p>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">Active</h2>
        {active.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No active sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((s) => <SessionRow key={s.id} session={s} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">New Requests</h2>
        {newRequests.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No new requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {newRequests.map((s) => <SessionRow key={s.id} session={s} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">Past Sessions</h2>
        {past.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No closed sessions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((s) => <SessionRow key={s.id} session={s} />)}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
