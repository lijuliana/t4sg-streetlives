"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import moment from "moment";
import { useStore } from "@/lib/store";
import type { SessionEvent } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import ReferralCard from "@/components/ReferralCard";

const EVENT_LABELS: Record<SessionEvent["type"], string> = {
  created: "Session created",
  assigned: "Assigned",
  transferred: "Transferred",
  closed: "Session closed",
  returned: "Returned to navigator",
};

function SupervisorTimelineEvent({ event }: { event: SessionEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-gray-200 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-gray-700">{EVENT_LABELS[event.type]}</p>
          {event.note && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[10px] text-gray-400 hover:text-gray-600 transition"
            >
              {open ? "▲" : "▼"}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5" suppressHydrationWarning>
          {moment(event.timestamp).format("MMM D [at] h:mm A")} · {event.actorName}
        </p>
        {open && event.note && (
          <div className="mt-1 bg-gray-50 rounded px-2 py-1">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">Notes</p>
            <p className="text-xs text-gray-500">{event.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupervisorSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const getSessionById = useStore((s) => s.getSessionById);
  const navigators = useStore((s) => s.navigators);
  const assignSession = useStore((s) => s.assignSession);
  const transferSession = useStore((s) => s.transferSession);
  const rerouteSession = useStore((s) => s.rerouteSession);
  const approveSession = useStore((s) => s.approveSession);
  const returnSession = useStore((s) => s.returnSession);
  const chatMessageCount = useStore((s) => s.chatMessages[sessionId]?.length ?? 0);

  const session = getSessionById(sessionId);
  const [coachingNote, setCoachingNote] = useState(session?.supervisorNote ?? "");

  if (!session) {
    return (
      <DashboardShell title="Session Not Found" role="supervisor" backHref="/dashboard/supervisor">
        <p className="text-sm text-gray-500">This session could not be found.</p>
      </DashboardShell>
    );
  }

  const isClosed = session.status === "closed";
  const isUnassigned = session.navigatorId === null;
  const otherNavigators = navigators.filter((n) => n.id !== session.navigatorId);

  return (
    <DashboardShell
      title={`#${session.id.slice(-5).toUpperCase()}`}
      role="supervisor"
      backHref="/dashboard/supervisor"
      action={
        <button
          type="button"
          onClick={() => router.push(`/dashboard/supervisor/${sessionId}/chat`)}
          className="flex items-center gap-1.5 text-xs font-medium bg-brand-yellow text-gray-900 px-3 py-1.5 rounded-md hover:brightness-95 transition"
        >
          <MessageSquare size={13} strokeWidth={2} />
          Transcript
          {chatMessageCount > 0 && (
            <span className="bg-gray-900 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none">
              {chatMessageCount}
            </span>
          )}
        </button>
      }
    >
      {/* Session header */}
      <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {session.topics.map((t) => (
              <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize">
                {t}
              </span>
            ))}
          </div>
          <SessionStatusBadge status={session.status} />
        </div>
        <div className="text-xs text-gray-400 space-y-0.5">
          <p suppressHydrationWarning className={session.navigatorId ? undefined : "text-amber-500"}>
            {session.navigatorId ? `Navigator: ${session.navigatorName}` : "Unassigned"}
          </p>
          <p suppressHydrationWarning>Started {moment(session.startedAt).format("MMM D, YYYY [at] h:mm A")}</p>
          {session.closedAt && (
            <p suppressHydrationWarning>Closed {moment(session.closedAt).format("MMM D, YYYY [at] h:mm A")}</p>
          )}
        </div>
      </div>

      {/* Assign to navigator — unassigned sessions */}
      {isUnassigned && (
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-2">
          <p className="text-xs font-normal text-gray-500 uppercase tracking-wide">Assign to Navigator</p>
          <select
            aria-label="Assign to navigator"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                assignSession(session.id, e.target.value);
                toast.success("Session assigned");
              }
            }}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
          >
            <option value="" disabled>Select a navigator…</option>
            {navigators.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Transfer + Re-run routing — active assigned sessions */}
      {!isClosed && !isUnassigned && (
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
          <p className="text-xs font-normal text-gray-500 uppercase tracking-wide">Routing</p>
          <div className="flex gap-2">
            <select
              aria-label="Transfer to navigator"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) transferSession(session.id, e.target.value);
              }}
              className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
            >
              <option value="" disabled>Transfer to…</option>
              {otherNavigators.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => rerouteSession(session.id)}
              className="text-xs font-medium text-gray-700 border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50 transition whitespace-nowrap"
            >
              Re-run Routing
            </button>
          </div>
        </div>
      )}

      {/* Session Notes — read-only */}
      <div>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">Session Notes</h2>
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4">
          {session.summary ? (
            <p className="text-sm text-gray-700">{session.summary}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No summary recorded.</p>
          )}
        </div>
      </div>

      {/* Referrals — read-only */}
      <div>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
          Referrals ({session.referrals.length})
        </h2>
        {session.referrals.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-6 text-center">
            <p className="text-sm text-gray-400">No referrals</p>
          </div>
        ) : (
          <div className="space-y-2">
            {session.referrals.map((ref) => (
              <ReferralCard key={ref.id} referral={ref} editable={false} />
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">Timeline</h2>
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
          {session.events.length === 0 ? (
            <p className="text-sm text-gray-400">No events recorded.</p>
          ) : (
            session.events.map((event) => (
              <SupervisorTimelineEvent key={event.id} event={event} />
            ))
          )}
        </div>
      </div>

      {/* Supervisor Review */}
      {isClosed && session.logged && session.reviewStatus !== "approved" && session.reviewStatus !== "returned" && (
        <div>
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">Supervisor Review</h2>
          <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
            <textarea
              value={coachingNote}
              onChange={(e) => setCoachingNote(e.target.value)}
              rows={3}
              placeholder="Coaching notes (optional for approval, required to return)…"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!coachingNote.trim()}
                onClick={() => { returnSession(session.id, coachingNote); toast.success("Returned to navigator"); router.push("/dashboard/supervisor"); }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-md hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Return to Navigator
              </button>
              <button
                type="button"
                onClick={() => { approveSession(session.id, coachingNote); toast.success("Session approved"); router.push("/dashboard/supervisor"); }}
                className="flex-1 bg-brand-yellow text-gray-900 text-sm font-medium py-2.5 rounded-md hover:brightness-95 transition"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review decision — read-only */}
      {isClosed && (session.reviewStatus === "approved" || session.reviewStatus === "returned") && (
        <div>
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">Supervisor Review</h2>
          <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-2">
            {session.reviewStatus === "approved" ? (
              <p className="text-xs text-green-600 font-medium" suppressHydrationWarning>
                Approved{session.reviewedAt ? ` · ${moment(session.reviewedAt).format("MMM D, YYYY [at] h:mm A")}` : ""}
              </p>
            ) : (
              <p className="text-xs text-red-500 font-medium">Returned to navigator</p>
            )}
            {session.supervisorNote && (
              <p className="text-sm text-gray-700">{session.supervisorNote}</p>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
