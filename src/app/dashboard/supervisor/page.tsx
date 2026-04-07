"use client";

import { useState } from "react";
import Link from "next/link";
import moment from "moment";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Navigator } from "@/lib/store";
import DashboardShell from "@/components/DashboardShell";
import SessionCard from "@/components/SessionCard";

function loadBarClass(active: number, capacity: number): string {
  if (capacity === 0 || active === 0) return "w-0";
  const r = active / capacity;
  if (r >= 1) return "w-full";
  if (r >= 0.75) return "w-3/4";
  if (r >= 0.5) return "w-1/2";
  if (r >= 0.25) return "w-1/4";
  return "w-1/12";
}

function NavigatorRow({
  navigator,
  expanded,
  onToggle,
}: {
  navigator: Navigator;
  expanded: boolean;
  onToggle: () => void;
}) {
  const allSessions = useStore((s) => s.sessions);
  const sessions = allSessions
    .filter((s) => s.navigatorId === navigator.id)
    .sort((a, b) => {
      const aActive = a.status !== "closed" ? 0 : 1;
      const bActive = b.status !== "closed" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });

  const activeCount = sessions.filter((s) => s.status === "active" || s.status === "queued").length;
  const closedCount = sessions.filter((s) => s.status === "closed").length;
  const isHighLoad = navigator.capacity > 0 && activeCount / navigator.capacity > 0.75;
  const hasSubmitted = sessions.some((s) => s.reviewStatus === "submitted");

  return (
    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition text-left"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0 relative">
          <span className="text-xs font-medium text-gray-900">{navigator.avatarInitials}</span>
          {/* Availability dot */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${navigator.available ? "bg-green-500" : "bg-gray-400"}`}
          />
        </div>

        {/* Name + load */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-900">{navigator.name}</p>
            {hasSubmitted && (
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex gap-2 mt-0.5 items-center">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {activeCount} active
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
              {closedCount} closed
            </span>
            <span className="text-xs text-gray-400">
              {activeCount}/{navigator.capacity}
            </span>
          </div>
          {/* Load bar */}
          <div className="mt-1.5 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${loadBarClass(activeCount, navigator.capacity)} ${isHighLoad ? "bg-amber-400" : "bg-green-400"}`}
            />
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
  const [expandedNavId, setExpandedNavId] = useState<string | null>(null);

  const today = moment().startOf("day");

  const totalSessions = sessions.length;
  const activeNow = sessions.filter(
    (s) => (s.status === "active" || s.status === "queued") && s.navigatorId !== null
  ).length;
  const newRequests = sessions.filter((s) => s.navigatorId === null).length;
  const closedToday = sessions.filter(
    (s) => s.status === "closed" && moment(s.closedAt).isAfter(today)
  ).length;
  const totalReferrals = sessions.reduce((sum, s) => sum + s.referrals.length, 0);
  const awaitingReview = sessions.filter((s) => s.reviewStatus === "submitted").length;

  return (
    <DashboardShell title="Sessions" role="supervisor">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-md px-4 py-4 text-center">
          <p className="text-3xl font-normal text-gray-900">{totalSessions}</p>
          <p className="text-xs text-gray-500 mt-1">Total Sessions</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-md px-4 py-4 text-center">
          <p className="text-3xl font-normal text-green-700">{activeNow}</p>
          <p className="text-xs text-gray-500 mt-1">Active</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-md px-4 py-4 text-center">
          <p className={`text-3xl font-normal ${newRequests > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {newRequests}
          </p>
          <p className={`text-xs mt-1 font-medium ${newRequests > 0 ? "text-amber-600" : "text-gray-500"}`}>
            New Requests
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-md px-4 py-4 text-center">
          <p className="text-3xl font-normal text-blue-600">{totalReferrals}</p>
          <p className="text-xs text-gray-500 mt-1">Total Referrals</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-md px-4 py-4 text-center">
          <p className={`text-3xl font-normal ${awaitingReview > 0 ? "text-amber-600" : "text-gray-900"}`}>{awaitingReview}</p>
          <p className={`text-xs mt-1 ${awaitingReview > 0 ? "text-amber-600 font-medium" : "text-gray-500"}`}>Awaiting Review</p>
        </div>
      </div>

      {/* Per-navigator breakdown */}
      <section>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-3">
          By Navigator
        </h2>
        <div className="space-y-2">
          {navigators.map((nav) => (
            <NavigatorRow
              key={nav.id}
              navigator={nav}
              expanded={expandedNavId === nav.id}
              onToggle={() => setExpandedNavId(expandedNavId === nav.id ? null : nav.id)}
            />
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
