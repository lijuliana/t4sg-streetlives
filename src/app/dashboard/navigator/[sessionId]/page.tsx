"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, MessageSquare, Circle, UserPlus, ArrowRight, CheckCircle, RotateCcw } from "lucide-react";
import moment from "moment";
import { useStore } from "@/lib/store";
import type { SessionEvent, SessionLog } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import ReferralCard from "@/components/ReferralCard";
import ReferralForm from "@/components/ReferralForm";

const DEMO_NAVIGATOR_ID = "nav-1";

const EVENT_LABELS: Record<SessionEvent["type"], string> = {
  created: "Session created",
  assigned: "Assigned",
  transferred: "Transferred",
  closed: "Session closed",
  returned: "Returned to navigator",
};

function EventIcon({ type }: { type: SessionEvent["type"] }) {
  const cls = "flex-shrink-0 mt-0.5";
  if (type === "created") return <Circle size={14} className={`${cls} text-gray-400`} />;
  if (type === "assigned") return <UserPlus size={14} className={`${cls} text-blue-400`} />;
  if (type === "transferred") return <ArrowRight size={14} className={`${cls} text-amber-500`} />;
  if (type === "returned") return <RotateCcw size={14} className={`${cls} text-orange-400`} />;
  return <CheckCircle size={14} className={`${cls} text-green-500`} />;
}

function TimelineEvent({ event }: { event: SessionEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-2.5">
      <EventIcon type={event.type} />
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

export default function NavigatorSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const getSessionById = useStore((s) => s.getSessionById);
  const navigators = useStore((s) => s.navigators);
  const updateSessionStatus = useStore((s) => s.updateSessionStatus);
  const endSession = useStore((s) => s.endSession);
  const assignSession = useStore((s) => s.assignSession);
  const transferSession = useStore((s) => s.transferSession);
  const rerouteSession = useStore((s) => s.rerouteSession);
  const activeRole = useStore((s) => s.activeRole);
  const chatMessageCount = useStore((s) => s.chatMessages[sessionId]?.length ?? 0);
  const logSession = useStore((s) => s.logSession);
  const submitForReview = useStore((s) => s.submitForReview);
  const approveSession = useStore((s) => s.approveSession);
  const returnSession = useStore((s) => s.returnSession);

  const session = getSessionById(sessionId);

  const [referralOpen, setReferralOpen] = useState(false);
  const [summaryText, setSummaryText] = useState(session?.summary ?? "");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Wrap-up form state
  const [wrapOutcome, setWrapOutcome] = useState<SessionLog["outcome"]>([]);
  const [wrapNotes, setWrapNotes] = useState("");
  const [wrapFollowUp, setWrapFollowUp] = useState(false);
  const [wrapFollowUpDate, setWrapFollowUpDate] = useState("");

  // Supervisor review state
  const [coachingNote, setCoachingNote] = useState(session?.supervisorNote ?? "");

  if (!session) {
    return (
      <DashboardShell
        title="Session Not Found"
        role={activeRole === "supervisor" ? "supervisor" : "navigator"}
        backHref={activeRole === "supervisor" ? "/dashboard/supervisor" : "/dashboard/navigator"}
      >
        <p className="text-sm text-gray-500">This session could not be found.</p>
      </DashboardShell>
    );
  }

  const isClosed = session.status === "closed";
  const isSupervisor = activeRole === "supervisor";
  const isUnassigned = session.navigatorId === null;
  const isMySession = session.navigatorId === DEMO_NAVIGATOR_ID;

  const wrapOutcomeValid = wrapOutcome.length > 0;

  const handleClose = () => {
    endSession(session.id, wrapNotes || undefined);
    logSession(session.id, {
      outcome: wrapOutcome,
      referralsShared: session.referrals.map((r) => r.serviceName),
      notes: wrapNotes,
      followUp: wrapFollowUp || wrapOutcome.includes("follow_up_needed"),
      followUpDate: wrapFollowUpDate || undefined,
    });
    submitForReview(session.id);
    toast.success("Session closed and submitted for review");
    setShowCloseConfirm(false);
  };

  const otherNavigators = navigators.filter((n) => n.id !== session.navigatorId);

  return (
    <DashboardShell
      title={`#${session.id.slice(-5).toUpperCase()}`}
      role={isSupervisor ? "supervisor" : "navigator"}
      backHref={isSupervisor ? "/dashboard/supervisor" : "/dashboard/navigator"}
      action={
        <button
          type="button"
          onClick={() => router.push(`/dashboard/navigator/${sessionId}/chat`)}
          className="flex items-center gap-1.5 text-xs font-medium bg-brand-yellow text-gray-900 px-3 py-1.5 rounded-md hover:brightness-95 transition"
        >
          <MessageSquare size={13} strokeWidth={2} />
          {isSupervisor ? "Transcript" : "Open Chat"}
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
            {session.assignedByRouting && (
              <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">
                Routed
              </span>
            )}
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

      {/* Assign to me — unassigned + navigator role */}
      {isUnassigned && !isSupervisor && (
        <button
          type="button"
          onClick={() => {
            assignSession(session.id, DEMO_NAVIGATOR_ID);
            toast.success("Session accepted");
          }}
          className="w-full bg-brand-yellow text-gray-900 text-sm font-medium py-2.5 rounded-md hover:brightness-95 transition"
        >
          Accept Session
        </button>
      )}

      {/* Assign to… — unassigned + supervisor role */}
      {isUnassigned && isSupervisor && (
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

      {/* Transfer + Re-run routing — supervisor only */}
      {!isClosed && !isUnassigned && isSupervisor && (
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

      {/* Close session — navigator only, active session */}
      {!isClosed && !isSupervisor && isMySession && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCloseConfirm(true)}
            className="flex-1 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-gray-800 transition"
          >
            Close Session
          </button>
        </div>
      )}

      {/* Wrap-up form */}
      {showCloseConfirm && (
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-4">
          <p className="text-sm font-medium text-gray-900">Close this session?</p>

          {/* Outcome checkboxes */}
          <div>
            <p className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
              Outcome <span className="text-red-400 normal-case font-normal">* required</span>
            </p>
            <div className="space-y-2">
              {(
                [
                  { value: "referrals_shared", label: "Referrals shared" },
                  { value: "information_only", label: "Information only" },
                  { value: "follow_up_needed", label: "Follow-up needed" },
                ] as { value: SessionLog["outcome"][number]; label: string }[]
              ).map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wrapOutcome.includes(value)}
                    onChange={(e) =>
                      setWrapOutcome((prev) =>
                        e.target.checked ? [...prev, value] : prev.filter((v) => v !== value)
                      )
                    }
                    className="w-4 h-4 rounded accent-gray-900"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">Notes</p>
            <textarea
              value={wrapNotes}
              onChange={(e) => setWrapNotes(e.target.value)}
              rows={3}
              placeholder="Session notes (optional)..."
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none"
            />
          </div>

          {/* Follow-up toggle + date */}
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={wrapFollowUp || wrapOutcome.includes("follow_up_needed")}
                onChange={(e) => setWrapFollowUp(e.target.checked)}
                className="w-4 h-4 rounded accent-gray-900"
              />
              <span className="text-sm text-gray-700">Schedule follow-up</span>
            </label>
            {(wrapFollowUp || wrapOutcome.includes("follow_up_needed")) && (
              <input
                type="date"
                aria-label="Follow-up date"
                value={wrapFollowUpDate}
                onChange={(e) => setWrapFollowUpDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow"
              />
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCloseConfirm(false)}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={!wrapOutcomeValid}
              className="flex-1 bg-brand-yellow text-gray-900 text-sm font-medium py-2.5 rounded-md hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Close & Submit for Review
            </button>
          </div>
        </div>
      )}

      {/* Outcome Log — read-only, shown when session is closed and logged */}
      {isClosed && session.logged && session.sessionLog && (
        <div>
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
            Outcome Log
          </h2>
          <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {session.sessionLog.outcome.map((o) => (
                <span key={o} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize">
                  {o === "referrals_shared" ? "Referrals shared" : o === "information_only" ? "Information only" : "Follow-up needed"}
                </span>
              ))}
            </div>
            {session.sessionLog.notes && (
              <p className="text-sm text-gray-700">{session.sessionLog.notes}</p>
            )}
            {session.sessionLog.followUp && (
              <p className="text-xs text-amber-600 font-medium">
                Follow-up scheduled{session.sessionLog.followUpDate ? `: ${moment(session.sessionLog.followUpDate).format("MMM D, YYYY")}` : ""}
              </p>
            )}
            {session.sessionLog.referralsShared.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Referrals at close</p>
                <div className="flex flex-wrap gap-1.5">
                  {session.sessionLog.referralsShared.map((name) => (
                    <span key={name} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session Notes */}
      {!showCloseConfirm && (
        <div>
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
            Session Notes
          </h2>
          {isClosed || isSupervisor ? (
            <div className="bg-white border border-gray-200 rounded-md px-5 py-4">
              {session.summary ? (
                <p className="text-sm text-gray-700">{session.summary}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No summary recorded.</p>
              )}
            </div>
          ) : (
            <textarea
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              onBlur={() => {
                if (summaryText !== session.summary) {
                  updateSessionStatus(session.id, session.status, summaryText);
                }
              }}
              rows={3}
              placeholder="Add session notes..."
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none bg-white"
            />
          )}
        </div>
      )}

      {/* Referrals */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide">
            Referrals ({session.referrals.length})
          </h2>
          {!isClosed && !isSupervisor && isMySession && (
            <button
              type="button"
              onClick={() => setReferralOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-gray-900 bg-brand-yellow px-3 py-1.5 rounded-md hover:brightness-95 transition"
            >
              <Plus size={13} strokeWidth={2.5} />
              Add Referral
            </button>
          )}
        </div>
        {session.referrals.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-6 text-center">
            <p className="text-sm text-gray-400">No referrals yet</p>
            {!isClosed && !isSupervisor && isMySession && (
              <button
                type="button"
                onClick={() => setReferralOpen(true)}
                className="mt-2 text-xs text-gray-500 underline hover:text-gray-700 transition"
              >
                Add the first one
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {session.referrals.map((ref) => (
              <ReferralCard key={ref.id} referral={ref} editable={!isClosed && !isSupervisor} />
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">
          Timeline
        </h2>
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
          {session.events.length === 0 ? (
            <p className="text-sm text-gray-400">No events recorded.</p>
          ) : (
            session.events.map((event) => (
              <TimelineEvent key={event.id} event={event} />
            ))
          )}
        </div>
      </div>

      {/* Review status — navigator view, after closing */}
      {!isSupervisor && isClosed && session.logged && (
        <div>
          {session.reviewStatus === "returned" && (
            <div className="bg-red-50 border border-red-200 rounded-md px-5 py-3 space-y-1">
              <p className="text-xs font-medium text-red-600">Returned by supervisor</p>
              <p className="text-sm text-red-700">{session.supervisorReturnNote}</p>
            </div>
          )}
          {session.reviewStatus === "approved" && (
            <div className="bg-green-50 border border-green-200 rounded-md px-5 py-3 text-center">
              <p className="text-xs font-medium text-green-600">
                Approved by supervisor{session.reviewedAt ? ` · ${moment(session.reviewedAt).format("MMM D, YYYY")}` : ""}
              </p>
              {session.supervisorNote && (
                <p className="text-sm text-gray-700 mt-1">{session.supervisorNote}</p>
              )}
            </div>
          )}
          {session.reviewStatus === "submitted" && (
            <div className="bg-white border border-gray-200 rounded-md px-5 py-3 text-center">
              <p className="text-xs text-gray-400">Awaiting supervisor review</p>
            </div>
          )}
        </div>
      )}

      {/* Supervisor Review — approve or return */}
      {isSupervisor && isClosed && session.logged && session.reviewStatus !== "approved" && session.reviewStatus !== "returned" && (
        <div>
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
            Supervisor Review
          </h2>
          <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
            <textarea
              value={coachingNote}
              onChange={(e) => setCoachingNote(e.target.value)}
              rows={3}
              placeholder="Coaching notes (optional for approval, required to return)..."
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!coachingNote.trim()}
                onClick={() => { returnSession(session.id, coachingNote); toast.success("Returned to navigator"); }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-md hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Return to Navigator
              </button>
              <button
                type="button"
                onClick={() => { approveSession(session.id, coachingNote); toast.success("Session approved"); }}
                className="flex-1 bg-brand-yellow text-gray-900 text-sm font-medium py-2.5 rounded-md hover:brightness-95 transition"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Review — read-only after decision */}
      {isSupervisor && (session.reviewStatus === "approved" || session.reviewStatus === "returned") && (
        <div>
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
            Supervisor Review
          </h2>
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

      <ReferralForm
        sessionId={session.id}
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
      />
    </DashboardShell>
  );
}
