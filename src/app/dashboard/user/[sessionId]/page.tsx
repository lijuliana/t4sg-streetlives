"use client";

import { useParams } from "next/navigation";
import moment from "moment";
import { useStore } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionStatusBadge from "@/components/SessionStatusBadge";
import ReferralCard from "@/components/ReferralCard";

export default function UserSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const getSessionById = useStore((s) => s.getSessionById);
  const session = getSessionById(sessionId);

  if (!session) {
    return (
      <DashboardShell title="Session Not Found" role="user" backHref="/dashboard/user">
        <p className="text-sm text-gray-500">This session could not be found.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Session Details"
      role="user"
      backHref="/dashboard/user"
    >
      {/* Session header */}
      <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Navigator</p>
            <p className="text-sm font-medium text-gray-900">{session.navigatorName}</p>
          </div>
          <SessionStatusBadge status={session.status} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {session.topics.map((t) => (
            <span
              key={t}
              className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="text-xs text-gray-400 space-y-0.5">
          <p>Started {moment(session.startedAt).format("MMM D, YYYY [at] h:mm A")}</p>
          {session.closedAt && (
            <p>Closed {moment(session.closedAt).format("MMM D, YYYY [at] h:mm A")}</p>
          )}
        </div>
      </div>

      {/* Summary */}
      {session.summary && (
        <div>
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
            Session Summary
          </h2>
          <div className="bg-white border border-gray-200 rounded-md px-5 py-4">
            <p className="text-sm text-gray-700">{session.summary}</p>
          </div>
        </div>
      )}

      {/* Referrals */}
      <div>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
          Referrals ({session.referrals.length})
        </h2>
        {session.referrals.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-6 text-center">
            <p className="text-sm text-gray-400">No referrals in this session</p>
          </div>
        ) : (
          <div className="space-y-2">
            {session.referrals.map((ref) => (
              <ReferralCard key={ref.id} referral={ref} editable={false} />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
