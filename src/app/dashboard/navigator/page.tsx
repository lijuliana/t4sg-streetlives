import { auth0 } from "@/lib/auth0";
import { lambdaFetch } from "@/lib/lambda";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import moment from "moment";
import { Home, ChevronDown } from "lucide-react";

const CATEGORY_ICONS: Record<string, string> = {
  housing:        "/new-icons/house.svg",
  accommodations: "/new-icons/house.svg",
  health:         "/new-icons/heart-chart.svg",
  benefits:       "/new-icons/checklist.svg",
  work:           "/new-icons/checklist.svg",
  legal:          "/new-icons/scales.svg",
  food:           "/new-icons/store.svg",
  clothing:       "/new-icons/bag.svg",
  personal_care:  "/new-icons/umbrella.svg",
  family_services:"/new-icons/person.svg",
  youth_services: "/new-icons/person.svg",
  connection:     "/new-icons/wifi.svg",
  education:      "/new-icons/checklist.svg",
  other:          "/new-icons/chat.svg",
};
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", zh: "Chinese",
  ar: "Arabic", pt: "Portuguese", ru: "Russian", ko: "Korean",
  vi: "Vietnamese", ht: "Haitian Creole", pl: "Polish", it: "Italian",
};

function languageLabel(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

import { OverdueFlair } from "@/components/OverdueFlair";
import { DashboardPoller } from "@/components/DashboardPoller";
import ShowMoreList from "@/components/ShowMoreList";
import { isProfileComplete } from "@/lib/store";
import type { NavigatorProfile } from "@/lib/store";
import { normalizeNavigatorFromLambda } from "@/lib/navigatorProfile";

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




function SessionRow({ session }: { session: RealSession }) {
  const isUnassigned = session.navigator_id === null;
  const isClosed = session.status === "closed";

  return (
    <Link
      href={`/dashboard/navigator/${session.id}`}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:shadow-sm transition"
    >
      <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
        <Image
          src={CATEGORY_ICONS[session.need_category] ?? "/new-icons/chat.svg"}
          alt=""
          width={20}
          height={20}
          aria-hidden
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 capitalize">
          {session.need_category.replace(/_/g, " ")}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {session.language && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {languageLabel(session.language)}
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

  const [sessionsRes, meRes] = await Promise.all([
    lambdaFetch("/sessions"),
    lambdaFetch("/navigators/me"),
  ]);

  if (meRes.status === 401) {
    redirect("/auth/login?returnTo=/dashboard/navigator");
  }

  let meBody: unknown = null;
  if (meRes.ok) {
    meBody = await meRes.json().catch(() => null);
  } else {
    const allRes = await lambdaFetch("/navigators");
    const allBody = await allRes.json().catch(() => []);
    if (allRes.ok) {
      const rows = Array.isArray(allBody)
        ? allBody
        : ((allBody as { navigators?: unknown[] }).navigators ?? []);
      meBody =
        rows.find((row: unknown) => {
          if (!row || typeof row !== "object") return false;
          const record = row as Record<string, unknown>;
          return (
            record.auth0_user_id === session.user?.sub ||
            record.userId === session.user?.sub
          );
        }) ?? null;
    }
  }

  const sessionsBody = await sessionsRes.json().catch(() => []);

  const allSessions: RealSession[] = sessionsRes.ok
    ? Array.isArray(sessionsBody) ? sessionsBody : (sessionsBody.sessions ?? [])
    : [];
  const myProfile = normalizeNavigatorFromLambda(
    meBody,
    session.user?.name ?? null,
    session.user?.sub ?? null
  );

  if (!myProfile) {
    redirect("/dashboard/navigator/profile");
  }

  const sessionName = session.user?.name?.trim() ?? "";
  const sessionNameParts = (() => {
    if (!sessionName) return { first: "", last: "" };
    const i = sessionName.indexOf(" ");
    if (i === -1) return { first: sessionName, last: "" };
    return { first: sessionName.slice(0, i).trim(), last: sessionName.slice(i + 1).trim() };
  })();

  const profileForGate: NavigatorProfile = {
    ...myProfile,
    first_name: (myProfile.first_name?.trim() || sessionNameParts.first) || "",
    last_name: (myProfile.last_name?.trim() || sessionNameParts.last) || "",
  };
  if (!isProfileComplete(profileForGate)) {
    redirect("/dashboard/navigator/profile");
  }
  const myProfileDisplay = profileForGate;

  const byRecent = (a: RealSession, b: RealSession) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const mySessions = allSessions.filter((s) => s.navigator_id === myProfileDisplay.id);
  const unassigned = allSessions.filter((s) => s.navigator_id === null).sort(byRecent);
  const active = mySessions.filter((s) => s.status !== "closed").sort(byRecent);
  const closed = mySessions.filter((s) => s.status === "closed").sort(byRecent);

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
            {`${myProfileDisplay.first_name} ${myProfileDisplay.last_name}`.trim() ||
              myProfileDisplay.nav_group ||
              session.user.name ||
              session.user.email}
          </span>
          <Link
            href="/dashboard/navigator/profile"
            className="text-xs font-medium text-gray-500 hover:text-gray-800 transition ml-2"
          >
            Edit profile
          </Link>
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
          <details open suppressHydrationWarning className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none select-none mb-3">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active</h2>
              <ChevronDown size={14} className="text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="space-y-3">
              {active.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">No active sessions</p>
                </div>
              ) : (
                active.map((s) => <SessionRow key={s.id} session={s} />)
              )}
            </div>
          </details>

          <details open suppressHydrationWarning className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none select-none mb-3">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unassigned</h2>
              <ChevronDown size={14} className="text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="space-y-3">
              {unassigned.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">No unassigned sessions</p>
                </div>
              ) : (
                unassigned.map((s) => <SessionRow key={s.id} session={s} />)
              )}
            </div>
          </details>
        </div>

        {/* Right: Closed sessions */}
        <div className="flex-1 min-w-0 overflow-y-auto px-5 py-5">
          <details open suppressHydrationWarning className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none select-none mb-3">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Closed</h2>
              <ChevronDown size={14} className="text-gray-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="space-y-3">
              {closed.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">No closed sessions yet</p>
                </div>
              ) : (
                <ShowMoreList>
                  {closed.map((s) => <SessionRow key={s.id} session={s} />)}
                </ShowMoreList>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
