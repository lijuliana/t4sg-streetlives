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

function sortByUrgency(
  sessions: Session[],
  chatMessages: Record<string, ChatMessage[]>
): Session[] {
  return [...sessions].sort((a, b) => {
    const aU = hasUnresponded24h(a.id, chatMessages);
    const bU = hasUnresponded24h(b.id, chatMessages);
    if (aU !== bU) return aU ? -1 : 1;
    const aR = a.reviewStatus === "returned";
    const bR = b.reviewStatus === "returned";
    if (aR !== bR) return aR ? -1 : 1;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });
}

export default function NavigatorDashboardPage() {
  const allSessions = useStore((s) => s.sessions);
  const chatMessages = useStore((s) => s.chatMessages);

  const byRecent = (a: Session, b: Session) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();

  const mySessions = allSessions.filter((s) => s.navigatorId === DEMO_NAVIGATOR_ID);
  const newRequests = allSessions.filter((s) => s.navigatorId === null).sort(byRecent);
  const active = mySessions.filter((s) => s.status !== "closed");
  const past = mySessions.filter((s) => s.status === "closed");

  const activeCount = active.length;
  const newCount = newRequests.length;
  const closedCount = past.length;

  const sortedActiveAndNew = sortByUrgency([...active, ...newRequests], chatMessages);
  const sortedPast = sortByUrgency(past, chatMessages);

  const summaryStrip = (
    <div className="flex gap-4 bg-white border border-gray-200 rounded-md px-5 py-4">
      <div className="flex-1 text-center">
        <p className="text-2xl font-normal text-gray-900">{activeCount}</p>
        <p className="text-xs text-green-600 font-medium mt-0.5">Active</p>
      </div>
      <div className="w-px bg-gray-200" />
      <div className="flex-1 text-center">
        <p className={`text-2xl font-normal mt-0.5 ${newCount > 0 ? "text-amber-600" : "text-gray-900"}`}>{newCount}</p>
        <p className="text-xs text-amber-600 font-medium mt-0.5">New Requests</p>
      </div>
      <div className="w-px bg-gray-200" />
      <div className="flex-1 text-center">
        <p className="text-2xl font-normal text-gray-900">{closedCount}</p>
        <p className="text-xs text-gray-400 font-medium mt-0.5">Closed</p>
      </div>
    </div>
  );

  return (
    <DashboardShell title="My Sessions" role="navigator" fullWidth>
      {/* ── Mobile layout (< lg) ── */}
      <div className="lg:hidden px-4 py-5 space-y-5">
        {summaryStrip}

        <section>
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">Active</h2>
          {active.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No active sessions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortByUrgency(active, chatMessages).map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  viewerRole="navigator"
                  urgent24h={hasUnresponded24h(session.id, chatMessages)}
                />
              ))}
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
              {newRequests.map((session) => (
                <SessionCard key={session.id} session={session} viewerRole="navigator" />
              ))}
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
              {sortByUrgency(past, chatMessages).map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  viewerRole="navigator"
                  urgent24h={hasUnresponded24h(session.id, chatMessages)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Desktop layout (lg+) ── */}
      <div className="hidden lg:block overflow-y-auto px-6 py-5 space-y-5">
        {summaryStrip}

        <div className="grid grid-cols-2 gap-5">
          {/* Left column: Active + New Requests */}
          <section>
            <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">
              Active &amp; New Requests
            </h2>
            {sortedActiveAndNew.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No active sessions or new requests</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedActiveAndNew.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    viewerRole="navigator"
                    urgent24h={hasUnresponded24h(session.id, chatMessages)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right column: Past Sessions */}
          <section>
            <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">
              Past Sessions
            </h2>
            {sortedPast.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No closed sessions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedPast.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    viewerRole="navigator"
                    urgent24h={hasUnresponded24h(session.id, chatMessages)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
