"use client";

import { useStore } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionCard from "@/components/SessionCard";
// Demo: Jenna Rivera is always the logged-in navigator
const DEMO_NAVIGATOR_ID = "nav-1";

export default function NavigatorDashboardPage() {
  const allSessions = useStore((s) => s.sessions);
  const sessions = allSessions.filter((s) => s.navigatorId === DEMO_NAVIGATOR_ID);

  const active = sessions.filter((s) => s.status !== "closed");
  const past = sessions.filter((s) => s.status === "closed");

  const activeCount = sessions.filter((s) => s.status === "active").length;
  const closedCount = sessions.filter((s) => s.status === "closed").length;

  return (
    <DashboardShell title="My Sessions" role="navigator">
      {/* Summary strip */}
      <div className="flex gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4">
        <div className="flex-1 text-center">
          <p className="text-2xl font-semibold text-gray-900">{activeCount}</p>
          <p className="text-xs text-green-600 font-medium mt-0.5">Active</p>
        </div>
        <div className="w-px bg-gray-200" />
        <div className="flex-1 text-center">
          <p className="text-2xl font-semibold text-gray-900">{closedCount}</p>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Closed</p>
        </div>
      </div>

      {/* Active & Queued */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Active &amp; Queued
        </h2>
        {active.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No active sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                viewerRole="navigator"
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
            <p className="text-sm text-gray-400">No closed sessions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                viewerRole="navigator"
                index={i}
              />
            ))}
          </div>
        )}
      </section>

    </DashboardShell>
  );
}
