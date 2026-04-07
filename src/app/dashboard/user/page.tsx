"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import moment from "moment";
import { useStore } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionCard from "@/components/SessionCard";
import SessionStatusBadge from "@/components/SessionStatusBadge";

// Demo: Jordan M. is the logged-in user
const DEMO_USER_ID = "user-1";

export default function UserDashboardPage() {
  const router = useRouter();
  const allSessions = useStore((s) => s.sessions);
  const sessions = allSessions.filter((session) => session.userId === DEMO_USER_ID);

  const allActive = sessions.filter((s) => s.status !== "closed").sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  // A user should only have one active session at a time — show the most recent
  const active = allActive.slice(0, 1);
  const past = sessions.filter((s) => s.status === "closed");

  return (
    <DashboardShell title="My Sessions" role="user">
      {/* Current Session */}
      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">
          Current Session
        </h2>
        {active.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center space-y-3">
            <p className="text-sm text-gray-500">You don&apos;t have an active session.</p>
            <Link
              href="/chat"
              className="inline-block bg-brand-yellow text-gray-900 text-sm font-medium px-5 py-2.5 rounded-md hover:brightness-95 transition"
            >
              Chat with a Peer Navigator
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((session) => {
              const initials = session.navigatorName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
              return (
                <div key={session.id} className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
                  {/* Session info row — taps to session detail */}
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/user/${session.id}`)}
                    className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-gray-900">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{session.navigatorName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {session.topics.map((t) => (
                          <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{t}</span>
                        ))}
                        <span className="text-xs text-gray-400" suppressHydrationWarning>
                          {moment(session.startedAt).calendar(null, {
                            sameDay: "[Today at] h:mm A",
                            lastDay: "[Yesterday at] h:mm A",
                            lastWeek: "MMM D [at] h:mm A",
                            sameElse: "MMM D, YYYY [at] h:mm A",
                          })}
                        </span>
                      </div>
                    </div>
                    <SessionStatusBadge status={session.status} size="sm" />
                  </button>
                  {/* Continue Chat — goes to home screen where the chat FAB lives */}
                  <div className="px-4 pb-3 border-t border-gray-100 pt-2">
                    <Link
                      href="/"
                      className="flex items-center justify-center w-full bg-brand-yellow text-gray-900 text-sm font-medium py-2.5 rounded-md hover:brightness-95 transition"
                    >
                      Continue Chat
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past Sessions */}
      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">
          Past Sessions
        </h2>
        {past.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No past sessions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                viewerRole="user"
              />
            ))}
          </div>
        )}
      </section>

    </DashboardShell>
  );
}
