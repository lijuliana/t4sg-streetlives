"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import moment from "moment";
import SessionStatusBadge from "./SessionStatusBadge";
import type { Session, AppRole } from "@/lib/store";

interface Props {
  session: Session;
  viewerRole: AppRole;
  index?: number;
}

export default function SessionCard({ session, viewerRole, index = 0 }: Props) {
  const router = useRouter();

  const href =
    viewerRole === "navigator" || viewerRole === "supervisor"
      ? `/dashboard/navigator/${session.id}`
      : `/dashboard/user/${session.id}`;

  const primaryName =
    viewerRole === "navigator" || viewerRole === "supervisor"
      ? session.userDisplayName
      : session.navigatorName;

  const initials =
    viewerRole === "navigator" || viewerRole === "supervisor"
      ? session.userDisplayName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : session.navigatorName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

  return (
    <motion.button
      type="button"
      onClick={() => router.push(href)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="w-full text-left bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3.5 flex items-center gap-3 hover:border-gray-300 hover:shadow-md transition"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-gray-900">{initials}</span>
      </div>

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
      <SessionStatusBadge status={session.status} size="sm" />
    </motion.button>
  );
}
