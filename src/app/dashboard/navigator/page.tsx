"use client";

import { useStore } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionCard from "@/components/SessionCard";

const DEMO_NAVIGATOR_ID = "nav-1";

export default function NavigatorDashboardPage() {
  const allSessions = useStore((s) => s.sessions);

  const byRecent = (a: (typeof allSessions)[0], b: (typeof allSessions)[0]) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();

  const mySessions = allSessions.filter((s) => s.navigatorId === DEMO_NAVIGATOR_ID);
  const newRequests = allSessions.filter((s) => s.navigatorId === null).sort(byRecent);

  const active = mySessions.filter((s) => s.status !== "closed").sort(byRecent);
  const past = mySessions.filter((s) => s.status === "closed").sort(byRecent);

  const activeCount = active.length;
  const newCount = newRequests.length;
  const closedCount = past.length;

  return (
    <DashboardShell title="My Sessions" role="navigator">
      {/* Summary strip */}
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

      {/* Active */}
      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">
          Active
        </h2>
        {active.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No active sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((session, i) => (
              <SessionCard key={session.id} session={session} viewerRole="navigator" />
            ))}
          </div>
        )}
      </section>

      {/* New Requests (unassigned) */}
      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">
          New Requests
        </h2>
        {newRequests.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No new requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {newRequests.map((session, i) => (
              <SessionCard key={session.id} session={session} viewerRole="navigator" />
            ))}
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
            <p className="text-sm text-gray-400">No closed sessions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((session, i) => (
              <SessionCard key={session.id} session={session} viewerRole="navigator" />
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
