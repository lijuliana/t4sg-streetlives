"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, MessageSquare } from "lucide-react";
import moment from "moment";
import { useStore } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import ReferralCard from "@/components/ReferralCard";
import ReferralForm from "@/components/ReferralForm";

export default function NavigatorSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const getSessionById = useStore((s) => s.getSessionById);
  const updateSessionStatus = useStore((s) => s.updateSessionStatus);
  const endSession = useStore((s) => s.endSession);
  const activeRole = useStore((s) => s.activeRole);
  const chatMessageCount = useStore((s) => s.chatMessages[sessionId]?.length ?? 0);

  const session = getSessionById(sessionId);

  const [referralOpen, setReferralOpen] = useState(false);
  const [summaryText, setSummaryText] = useState(session?.summary ?? "");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  if (!session) {
    return (
      <DashboardShell title="Session Not Found" role={activeRole === "supervisor" ? "supervisor" : "navigator"} backHref={activeRole === "supervisor" ? "/dashboard/supervisor" : "/dashboard/navigator"}>
        <p className="text-sm text-gray-500">This session could not be found.</p>
      </DashboardShell>
    );
  }

  const isClosed = session.status === "closed";
  const isSupervisor = activeRole === "supervisor";

  const handleClose = () => {
    endSession(session.id, summaryText || undefined);
    toast.success("Session closed");
    setShowCloseConfirm(false);
    router.push("/dashboard/navigator");
  };

  return (
    <DashboardShell
      title={session.userDisplayName}
      role={isSupervisor ? "supervisor" : "navigator"}
      backHref={isSupervisor ? "/dashboard/supervisor" : "/dashboard/navigator"}
      action={
        <button
          type="button"
          onClick={() => router.push(`/dashboard/navigator/${sessionId}/chat`)}
          className="flex items-center gap-1.5 text-xs font-medium bg-brand-yellow text-gray-900 px-3 py-1.5 rounded-lg hover:brightness-95 transition"
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
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {session.topics.map((t) => (
              <span
                key={t}
                className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize"
              >
                {t}
              </span>
            ))}
          </div>
          <SessionStatusBadge status={session.status} />
        </div>
        <div className="text-xs text-gray-400 space-y-0.5">
          <p>Started {moment(session.startedAt).format("MMM D, YYYY [at] h:mm A")}</p>
          {session.closedAt && (
            <p>Closed {moment(session.closedAt).format("MMM D, YYYY [at] h:mm A")}</p>
          )}
        </div>
      </div>

      {/* Action buttons — navigators only */}
      {!isClosed && !isSupervisor && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCloseConfirm(true)}
            className="flex-1 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-800 transition"
          >
            Close Session
          </button>
        </div>
      )}

      {/* Close confirm panel */}
      {showCloseConfirm && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Close this session?</p>
          <textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            rows={3}
            placeholder="Session summary (optional)..."
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCloseConfirm(false)}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-brand-yellow text-gray-900 text-sm font-medium py-2.5 rounded-xl hover:brightness-95 transition"
            >
              Confirm Close
            </button>
          </div>
        </div>
      )}

      {/* Summary (editable while active, read-only when closed) */}
      {!showCloseConfirm && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Session Notes
          </h2>
          {isClosed || isSupervisor ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
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
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none bg-white"
            />
          )}
        </div>
      )}

      {/* Referrals */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Referrals ({session.referrals.length})
          </h2>
          {!isClosed && !isSupervisor && (
            <button
              type="button"
              onClick={() => setReferralOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-gray-900 bg-brand-yellow px-3 py-1.5 rounded-lg hover:brightness-95 transition"
            >
              <Plus size={13} strokeWidth={2.5} />
              Add Referral
            </button>
          )}
        </div>

        {session.referrals.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-6 text-center">
            <p className="text-sm text-gray-400">No referrals yet</p>
            {!isClosed && (
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
              <ReferralCard key={ref.id} referral={ref} editable={!isClosed} />
            ))}
          </div>
        )}
      </div>

      <ReferralForm
        sessionId={session.id}
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
      />
    </DashboardShell>
  );
}
