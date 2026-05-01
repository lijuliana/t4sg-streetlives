import { auth0 } from "@/lib/auth0";
import { lambdaFetch } from "@/lib/lambda";
import { redirect } from "next/navigation";
import Link from "next/link";
import moment from "moment";
import { ChevronDown, Home } from "lucide-react";
import { DashboardPoller } from "@/components/DashboardPoller";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { cn } from "@/lib/utils";

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

type AvailabilitySchedule = Record<string, { start: string; end: string }>;

interface NavProfile {
  id: string;
  auth0_user_id: string;
  first_name: string | null;
  last_name: string | null;
  nav_group: string;
  status: string;
  capacity: number;
  availability_schedule: AvailabilitySchedule | null;
}

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function isInScheduledHours(schedule: AvailabilitySchedule | null | undefined): boolean {
  if (!schedule) return false;
  const now = new Date();
  const slot = schedule[DAY_KEYS[now.getDay()]];
  if (!slot) return false;
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= toMins(slot.start) && cur < toMins(slot.end);
}

function navDisplayName(nav: NavProfile): string {
  const name = [nav.first_name, nav.last_name].filter(Boolean).join(" ");
  return name || nav.nav_group.replace(/_/g, " ");
}

const AVATAR_COLORS = [
  "bg-blue-400",
  "bg-green-500",
  "bg-purple-400",
  "bg-rose-400",
  "bg-amber-400",
  "bg-teal-500",
];

function avatarInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

const STATUS_DOT: Record<string, string> = {
  available: "bg-green-400",
  away: "bg-amber-400",
  offline: "bg-gray-300",
};

function SessionRow({ session, badge, navigator, deletable }: { session: Session; badge?: React.ReactNode; navigator?: NavProfile; deletable?: boolean }) {
  const inHours = navigator ? isInScheduledHours(navigator.availability_schedule) : false;

  return (
    <Link
      href={`/dashboard/supervisor/${session.id}`}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:shadow-sm transition"
    >
      <div className="w-9 h-9 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-gray-900">
          {session.need_category.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        {navigator && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[navigator.status] ?? "bg-gray-300"}`} />
            <span className="text-sm font-medium text-gray-900 truncate">{navDisplayName(navigator)}</span>
            {navigator.availability_schedule && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                inHours ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"
              }`}>
                {inHours ? "In hours" : "Out of hours"}
              </span>
            )}
          </div>
        )}
        <p className="text-sm text-gray-500 capitalize">{session.need_category.replace(/_/g, " ")}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {badge}
          {session.language && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {session.language.toUpperCase()}
            </span>
          )}
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
      <span className={cn(
        "text-xs font-medium px-2 py-0.5 rounded-full",
        session.status === "closed" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"
      )}>
        {session.status === "closed" ? "Closed" : "Active"}
      </span>
      {deletable && <DeleteSessionButton sessionId={session.id} />}
    </Link>
  );
}

const BAR_WIDTHS = [
  "w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]",
  "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full",
] as const;

function barWidth(load: number): string {
  return BAR_WIDTHS[Math.min(10, Math.round(Math.min(1, load) * 10))];
}

function NavigatorRow({ nav, sessions }: { nav: NavProfile; sessions: Session[] }) {
  const navSessions = sessions.filter((s) => s.navigator_id === nav.id);
  const active = navSessions.filter((s) => s.status !== "closed");
  const closed = navSessions.filter((s) => s.status === "closed");
  const load = nav.capacity > 0 ? active.length / nav.capacity : 0;
  const barColor = load > 1 ? "bg-orange-400" : load >= 0.8 ? "bg-amber-400" : "bg-green-400";
  const displayName = navDisplayName(nav);
  const initials = avatarInitials(displayName);
  const bg = avatarColor(displayName);
  const inHours = isInScheduledHours(nav.availability_schedule);

  return (
    <details suppressHydrationWarning className="group bg-white border border-gray-200 rounded-xl overflow-hidden">
      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-gray-50 transition">
        <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
          <span className="text-xs font-semibold text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[nav.status] ?? "bg-gray-300"}`} />
            <p className="text-sm font-medium text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-400">{nav.nav_group.replace(/_/g, " ")}</p>
            {nav.availability_schedule && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                inHours ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"
              }`}>
                {inHours ? "In hours" : "Out of hours"}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 ml-3.5">
            <span className="text-green-600 font-medium">{active.length} active</span>
            {"  ·  "}
            <span>{closed.length} closed</span>
            {"  ·  "}
            <span className={load > 1 ? "text-orange-500 font-medium" : ""}>{active.length}/{nav.capacity}</span>
          </p>
          <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full ${barWidth(load)}`} />
          </div>
        </div>
        <ChevronDown size={16} className="text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
      </summary>
      {active.length > 0 && (
        <div className="px-4 pb-3 pt-2 space-y-2 border-t border-gray-100">
          {active.map((s) => (
            <SessionRow key={s.id} session={s} navigator={nav} />
          ))}
        </div>
      )}
      {active.length === 0 && (
        <div className="px-4 pb-3 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">No active sessions.</p>
        </div>
      )}
    </details>
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

  const allSessions: Session[] = sessionsRes.ok
    ? Array.isArray(sessionsBody) ? sessionsBody : (sessionsBody.sessions ?? [])
    : [];
  const navigators: NavProfile[] = navsRes.ok
    ? Array.isArray(navsBody) ? navsBody : (navsBody.navigators ?? [])
    : [];

  const navById = new Map(navigators.map((n) => [n.id, n]));

  const byRecent = (a: Session, b: Session) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const needsReview = allSessions
    .filter((s) => s.status === "closed" && s.approved !== true)
    .sort(byRecent);

  const active = allSessions.filter((s) => s.status !== "closed");
  const unassigned = allSessions.filter((s) => s.navigator_id === null && s.status !== "closed").sort(byRecent);
  const approvedArchive = allSessions
    .filter((s) => s.approved === true)
    .sort(byRecent);

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
            {session.user.name ?? session.user.email}
          </span>
          <a href="https://www.google.com" className="ml-auto flex items-center gap-1.5 text-brand-exit text-xs font-medium uppercase tracking-wide">
            Quick Exit <span className="w-5 h-5 rounded-full bg-brand-exit text-white flex items-center justify-center font-bold text-[11px]">!</span>
          </a>
        </div>
        <div className="px-4 sm:px-6 lg:px-8 pb-3 pt-0.5 flex items-end justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-normal text-gray-900 tracking-tight">My Sessions</h1>
            <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-brand-yellow text-gray-900">Supervisor</span>
          </div>
          <div className="flex items-center gap-5 pb-0.5">
            <div className="text-center">
              <span className={`text-lg font-normal tabular-nums ${needsReview.length > 0 ? "text-amber-600" : "text-gray-900"}`}>{needsReview.length}</span>
              <span className={`text-xs font-medium ml-1.5 ${needsReview.length > 0 ? "text-amber-600" : "text-gray-400"}`}>Awaiting Review</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="text-center">
              <span className="text-lg font-normal tabular-nums text-green-700">{active.length}</span>
              <span className="text-xs text-green-600 font-medium ml-1.5">Active</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="text-center">
              <span className="text-lg font-normal tabular-nums text-gray-900">{approvedArchive.length}</span>
              <span className="text-xs text-gray-400 font-medium ml-1.5">Approved</span>
            </div>
          </div>
        </div>
      </header>

      {/* Two-column body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Needs Review */}
        <div className="flex-[2] min-w-0 overflow-y-auto border-r border-gray-200 px-5 py-5 space-y-3">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
            Needs Review
            {needsReview.length > 0 && (
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                {needsReview.length}
              </span>
            )}
          </h2>
          {needsReview.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No sessions pending review</p>
            </div>
          ) : (
            needsReview.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                deletable
                navigator={s.navigator_id ? navById.get(s.navigator_id) : undefined}
                badge={s.submitted_for_review === true ? (
                  <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                    Needs Review
                  </span>
                ) : (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                    User Ended
                  </span>
                )}
              />
            ))
          )}
        </div>

        {/* Right: Metrics + By Navigator + Approved Archive */}
        <div className="flex-[3] min-w-0 overflow-y-auto px-5 py-5 space-y-6">
          {/* By Navigator */}
          <section className="space-y-2">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">By Navigator</h2>
            {navigators.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No navigators found</p>
              </div>
            ) : (
              navigators.map((nav) => (
                <NavigatorRow key={nav.id} nav={nav} sessions={allSessions} />
              ))
            )}
          </section>

          {/* Unassigned */}
          <section className="space-y-2">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
              Unassigned
              {unassigned.length > 0 && (
                <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                  {unassigned.length}
                </span>
              )}
            </h2>
            {unassigned.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No unassigned sessions</p>
              </div>
            ) : (
              unassigned.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  navigator={s.navigator_id ? navById.get(s.navigator_id) : undefined}
                  badge={
                    <span className="text-[10px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full font-medium">
                      New Request
                    </span>
                  }
                />
              ))
            )}
          </section>

          {/* Approved Archive */}
          <section className="space-y-2">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Approved Archive</h2>
            {approvedArchive.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No approved sessions yet</p>
              </div>
            ) : (
              approvedArchive.map((s) => <SessionRow key={s.id} session={s} deletable navigator={s.navigator_id ? navById.get(s.navigator_id) : undefined} />)
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
