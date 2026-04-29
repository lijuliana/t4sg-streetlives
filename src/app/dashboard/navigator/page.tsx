import { auth0 } from "@/lib/auth0";
import { lambdaFetch } from "@/lib/lambda";
import { redirect } from "next/navigation";
import Link from "next/link";
import moment from "moment";
import { Home } from "lucide-react";
import { OverdueFlair } from "@/components/OverdueFlair";
import { DashboardPoller } from "@/components/DashboardPoller";
import DashboardShell from "@/components/DashboardShell";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import { isProfileComplete } from "@/lib/store";
import type { NavigatorProfile } from "@/lib/store";

interface RealSession {
  id: string;
  navigator_id: string | null;
  need_category: string;
  language: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  routing_reason: object | null;
  submitted_for_review: boolean | null;
  approved: boolean | null;
  coaching_notes: string | null;
}

interface NavProfile {
  id: string;
  auth0_user_id: string;
  nav_group: string;
  status: string;
  capacity: number;
function mapStatus(s: string): "queued" | "active" | "closed" {
  if (s === "unassigned") return "queued";
  if (s === "closed") return "closed";
  return "active";
}

function SessionRow({ session }: { session: RealSession }) {
  const isUnassigned = session.navigator_id === null;
  const isClosed = session.status === "closed";

  return (
    <Link
      href={`/dashboard/navigator/${session.id}`}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:shadow-sm transition"
    >
      <div className="w-9 h-9 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-gray-900">
          {session.need_category.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 capitalize">
          {session.need_category.replace(/_/g, " ")}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {session.language && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {session.language.toUpperCase()}
            </span>
          )}
          {session.routing_reason && (
            <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">Routed</span>
          )}
          {!isClosed && !isUnassigned && <OverdueFlair sessionId={session.id} createdAt={session.created_at} />}
          <span className="text-xs text-gray-400" suppressHydrationWarning>
            {moment(session.created_at).calendar(null, {
              sameDay: "[Today at] h:mm A",
              lastDay: "[Yesterday at] h:mm A",
              lastWeek: "MMM D [at] h:mm A",
              sameElse: "MMM D, YYYY [at] h:mm A",
            })}
          </span>
        </div>
      </div>
      {isUnassigned ? (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
          New Request
        </span>
      ) : isClosed ? (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          Closed
        </span>
      ) : (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
          Active
        </span>
      )}
    </Link>
  );
}

export default async function NavigatorDashboardPage() {
  const session = await auth0.getSession();
  if (!session) redirect("/auth/login");

  const [sessionsRes, navsRes, meRes] = await Promise.all([
    lambdaFetch("/sessions"),
    lambdaFetch("/navigators"),
    lambdaFetch("/navigators/me"),
  ]);

  // No profile yet — require setup before anything else
  if (!meRes.ok) redirect("/dashboard/navigator/profile");

  const allSessions: RealSession[] = sessionsRes.ok
    ? Array.isArray(sessionsBody) ? sessionsBody : (sessionsBody.sessions ?? [])
    : [];
  const navigators: NavProfile[] = navsRes.ok
    ? Array.isArray(navsBody) ? navsBody : (navsBody.navigators ?? [])
    : [];

  const byRecent = (a: RealSession, b: RealSession) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const mySessions = allSessions.filter((s) => s.navigator_id === myProfile.id);
  const unassigned = allSessions.filter((s) => s.navigator_id === null).sort(byRecent);
  const active = mySessions.filter((s) => s.status !== "closed").sort(byRecent);
  const closed = mySessions.filter((s) => s.status === "closed").sort(byRecent);

  const editProfileAction = (
    <Link
      href="/dashboard/navigator/profile"
      className="text-xs font-medium text-gray-500 hover:text-gray-800 transition"
    >
      Edit profile
    </Link>
  );

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <DashboardPoller />
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-3">
          <Link href="/" aria-label="Home" className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition">
            <Home size={18} />
          </Link>
          <span className="text-sm text-gray-500">
            {myProfile?.nav_group ?? session.user.name ?? session.user.email}
          </span>
          <a href="https://www.google.com" className="ml-auto flex items-center gap-1.5 text-brand-exit text-xs font-medium uppercase tracking-wide">
            Quick Exit <span className="w-5 h-5 rounded-full bg-brand-exit text-white flex items-center justify-center font-bold text-[11px]">!</span>
          </a>
        </div>
        <div className="px-4 sm:px-6 lg:px-8 pb-3 pt-0.5 flex items-end justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-normal text-gray-900 tracking-tight">My Sessions</h1>
            <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-brand-yellow text-gray-900">Navigator</span>
          </div>
          {/* Metrics strip */}
          <div className="flex items-center gap-5 pb-0.5">
            <div className="text-center">
              <span className="text-lg font-normal tabular-nums text-green-700">{active.length}</span>
              <span className="text-xs text-green-600 font-medium ml-1.5">Active</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="text-center">
              <span className={`text-lg font-normal tabular-nums ${unassigned.length > 0 ? "text-amber-600" : "text-gray-900"}`}>
                {unassigned.length}
              </span>
              <span className="text-xs text-amber-600 font-medium ml-1.5">Unassigned</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="text-center">
              <span className="text-lg font-normal tabular-nums text-gray-900">{closed.length}</span>
              <span className="text-xs text-gray-400 font-medium ml-1.5">Closed</span>
            </div>
          </div>
        </div>
      </header>

      {/* Two-column body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Open sessions (Active + Unassigned) */}
        <div className="flex-1 min-w-0 overflow-y-auto border-r border-gray-200 px-5 py-5 space-y-5">
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active</h2>
            {active.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No active sessions</p>
              </div>
            ) : (
              active.map((s) => <SessionRow key={s.id} session={s} />)
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unassigned</h2>
            {unassigned.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No unassigned sessions</p>
              </div>
            ) : (
              unassigned.map((s) => <SessionRow key={s.id} session={s} />)
            )}
          </section>
        </div>

        {/* Right: Closed sessions */}
        <div className="flex-1 min-w-0 overflow-y-auto px-5 py-5 space-y-3">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Closed</h2>
          {closed.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No closed sessions yet</p>
            </div>
          ) : (
            closed.map((s) => <SessionRow key={s.id} session={s} />)
          )}
        </div>
      </div>
    </div>
  );
}
