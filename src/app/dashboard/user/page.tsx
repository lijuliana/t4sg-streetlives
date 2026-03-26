"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionCard from "@/components/SessionCard";

// Demo: Jordan M. is the logged-in user
const DEMO_USER_ID = "user-1";

export default function UserDashboardPage() {
  const allSessions = useStore((s) => s.sessions);
  const sessions = allSessions.filter((session) => session.userId === DEMO_USER_ID);

  const active = sessions.filter((s) => s.status !== "closed");
  const past = sessions.filter((s) => s.status === "closed");

  return (
    <DashboardShell title="My Sessions" role="user">
      {/* Current Session */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Current Session
        </h2>
        {active.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center space-y-3">
            <p className="text-sm text-gray-500">You don&apos;t have an active session.</p>
            <Link
              href="/chat"
              className="inline-block bg-brand-yellow text-gray-900 text-sm font-medium px-5 py-2.5 rounded-xl hover:brightness-95 transition"
            >
              Chat with a Peer Navigator
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <Link
              href="/chat"
              className="flex items-center justify-center gap-2 w-full bg-brand-yellow text-gray-900 text-sm font-medium py-3 rounded-xl hover:brightness-95 transition"
            >
              Continue Chat
            </Link>
            {active.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                viewerRole="user"
                index={i}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past Sessions */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Past Sessions
        </h2>
        {past.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No past sessions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                viewerRole="user"
                index={i}
              />
            ))}
          </div>
        )}
      </section>

    </DashboardShell>
  );
}
