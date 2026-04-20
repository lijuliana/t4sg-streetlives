"use client";

import { useStore } from "@/lib/store";
import { hasUnresponded24h } from "@/lib/utils";
import type { Session, ChatMessage } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionCard from "@/components/SessionCard";

const DEMO_NAVIGATOR_ID = "nav-1";

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
