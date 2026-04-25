import { auth0 } from "@/lib/auth0";
import { lambdaFetch } from "@/lib/lambda";
import { redirect } from "next/navigation";
import Link from "next/link";
import moment from "moment";
import DashboardShell from "@/components/DashboardShell";
import SessionStatusBadge from "@/components/SessionStatusBadge";

interface Session {
  id: string;
  navigator_id: string | null;
  need_category: string;
  language: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  submitted_for_review: boolean | null;
  approved: boolean | null;
  notes: string | null;
  outcome: string[] | null;
  follow_up_date: string | null;
  coaching_notes: string | null;
}

interface NavProfile {
  id: string;
  auth0_user_id: string;
  nav_group: string;
  status: string;
  capacity: number;
}

function mapStatus(s: Session): "queued" | "active" | "closed" {
  if (s.status === "unassigned") return "queued";
  if (s.status === "closed") return "closed";
  return "active";
}

function SessionRow({ session, navigators }: { session: Session; navigators: NavProfile[] }) {
  const nav = navigators.find((n) => n.id === session.navigator_id);
  return (
    <Link
      href={`/dashboard/supervisor/${session.id}`}
      className="block bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-gray-300 hover:shadow-md transition"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-gray-900">
            {session.need_category.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 capitalize">
            {session.need_category.replace(/_/g, " ")}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {nav && (
              <span className="text-xs text-gray-500">{nav.nav_group}</span>
            )}
            {session.language && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {session.language.toUpperCase()}
              </span>
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
        <SessionStatusBadge status={mapStatus(session)} size="sm" />
      </div>
    </Link>
  );
}

export default async function SupervisorDashboardPage() {
  const session = await auth0.getSession();
  if (!session) redirect("/auth/login");

  const [sessionsRes, navsRes] = await Promise.all([
    lambdaFetch("/sessions"),
    lambdaFetch("/navigators"),
  ]);

  const sessionsBody = await sessionsRes.json().catch(() => []);
  const navsBody = await navsRes.json().catch(() => []);

  const allSessions: Session[] = sessionsRes.ok ? sessionsBody : [];
  const navigators: NavProfile[] = navsRes.ok ? navsBody : [];

  const byRecent = (a: Session, b: Session) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const needsReview = allSessions
    .filter((s) => s.submitted_for_review === true && s.approved !== true)
    .sort(byRecent);

  const active = allSessions
    .filter((s) => s.status !== "closed")
    .sort(byRecent);

  const approvedArchive = allSessions
    .filter((s) => s.approved === true)
    .sort(byRecent);

  return (
    <DashboardShell title="Overview" role="supervisor">
      {/* Summary strip */}
      <div className="flex gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4">
        <div className="flex-1 text-center">
          <p className={`text-2xl font-normal ${needsReview.length > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {needsReview.length}
          </p>
          <p className={`text-xs font-medium mt-0.5 ${needsReview.length > 0 ? "text-amber-600" : "text-gray-400"}`}>
            Needs Review
          </p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="flex-1 text-center">
          <p className="text-2xl font-normal text-green-700">{active.length}</p>
          <p className="text-xs text-green-600 font-medium mt-0.5">Active</p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="flex-1 text-center">
          <p className="text-2xl font-normal text-gray-900">{approvedArchive.length}</p>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Approved</p>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">Needs Review</h2>
        {needsReview.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No sessions pending review</p>
          </div>
        ) : (
          <div className="space-y-2">
            {needsReview.map((s) => <SessionRow key={s.id} session={s} navigators={navigators} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">Active</h2>
        {active.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No active sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((s) => <SessionRow key={s.id} session={s} navigators={navigators} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">Approved Archive</h2>
        {approvedArchive.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No approved sessions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {approvedArchive.map((s) => <SessionRow key={s.id} session={s} navigators={navigators} />)}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
