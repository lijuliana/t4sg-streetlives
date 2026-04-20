"use client";

import { useRouter } from "next/navigation";
import moment from "moment";
import SessionStatusBadge from "./SessionStatusBadge";
import type { Session, AppRole } from "@/lib/store";

interface Props {
  session: Session;
  viewerRole: AppRole;
}

export default function SessionCard({ session, viewerRole }: Props) {
  const router = useRouter();

  const href =
    viewerRole === "supervisor"
      ? `/dashboard/supervisor/${session.id}`
      : viewerRole === "navigator"
      ? `/dashboard/navigator/${session.id}`
      : `/dashboard/user/${session.id}`;

  const isUnassigned = session.navigatorId === null;
  const awaitingReview = session.reviewStatus === "submitted";
  const returned = session.reviewStatus === "returned";

  const primaryName =
    viewerRole === "navigator" || viewerRole === "supervisor"
      ? `#${session.id.slice(-5).toUpperCase()}`
      : session.navigatorName;

  const initials =
    session.navigatorName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="w-full text-left bg-white border border-gray-200 rounded-md shadow-sm px-4 py-3.5 flex items-center gap-3 hover:border-gray-300 hover:shadow-md transition"
    >
      {/* Avatar — gray silhouette for navigator/supervisor (anonymous), yellow with initials for user view */}
      {(isUnassigned || viewerRole === "navigator" || viewerRole === "supervisor") ? (
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-gray-900">{initials}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{primaryName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {session.topics.map((t) => (
            <span
              key={t}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize"
            >
              {t}
            </span>
          ))}
          {awaitingReview && viewerRole === "supervisor" && (
            <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
              Needs Review
            </span>
          )}
          {returned && viewerRole === "navigator" && (
            <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium">
              Returned
            </span>
          )}
          <span className="text-xs text-gray-400">
            {moment(session.startedAt).calendar(null, {
              sameDay: "[Today at] h:mm A",
              lastDay: "[Yesterday at] h:mm A",
              lastWeek: "MMM D [at] h:mm A",
              sameElse: "MMM D, YYYY [at] h:mm A",
            })}
          </span>
        </div>
      </div>

      {/* Badge */}
      {isUnassigned && viewerRole === "navigator" ? (
        <span className="inline-flex items-center rounded-full font-medium px-2 py-0.5 text-xs bg-orange-100 text-orange-600">
          New Request
        </span>
      ) : (
        <SessionStatusBadge status={session.status} size="sm" />
      )}
    </button>
  );
}
