"use client";

import { useState } from "react";
import Link from "next/link";
import moment from "moment";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Navigator } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionCard from "@/components/SessionCard";

function NavigatorRow({ navigator }: { navigator: Navigator }) {
  const [expanded, setExpanded] = useState(false);
  const allSessions = useStore((s) => s.sessions);
  const sessions = allSessions.filter((s) => s.navigatorId === navigator.id);

  const activeCount = sessions.filter((s) => s.status === "active" || s.status === "queued").length;
  const closedCount = sessions.filter((s) => s.status === "closed").length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition text-left"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-gray-900">{navigator.avatarInitials}</span>
        </div>

        {/* Name + counts */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{navigator.name}</p>
          <div className="flex gap-2 mt-0.5">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {activeCount} active
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
              {closedCount} closed
            </span>
          </div>
        </div>

        {expanded ? (
          <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && sessions.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-2 bg-gray-50">
          {sessions.map((session, i) => (
            <SessionCard
              key={session.id}
              session={session}
              viewerRole="supervisor"
              index={i}
            />
          ))}
        </div>
      )}

      {expanded && sessions.length === 0 && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 text-center">
          <p className="text-sm text-gray-400">No sessions</p>
        </div>
      )}
    </div>
  );
}

export default function SupervisorDashboardPage() {
  const sessions = useStore((s) => s.sessions);
  const navigators = useStore((s) => s.navigators);

  const today = moment().startOf("day");

  const totalSessions = sessions.length;
  const activeNow = sessions.filter(
    (s) => s.status === "active" || s.status === "queued"
  ).length;
  const closedToday = sessions.filter(
    (s) => s.status === "closed" && moment(s.closedAt).isAfter(today)
  ).length;
  const totalReferrals = sessions.reduce((sum, s) => sum + s.referrals.length, 0);

  return (
    <DashboardShell title="Overview" role="supervisor">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Sessions", value: totalSessions, color: "text-gray-900" },
          { label: "Active Now", value: activeNow, color: "text-green-700" },
          { label: "Closed Today", value: closedToday, color: "text-gray-500" },
          { label: "Total Referrals", value: totalReferrals, color: "text-blue-600" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white border border-gray-200 rounded-xl px-4 py-4 text-center"
          >
            <p className={`text-3xl font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-navigator breakdown */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          By Navigator
        </h2>
        <div className="space-y-2">
          {navigators.map((nav) => (
            <NavigatorRow key={nav.id} navigator={nav} />
          ))}
        </div>
      </section>

      <div className="pt-2 text-center">
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition">
          ← Back to home
        </Link>
      </div>
    </DashboardShell>
  );
}
