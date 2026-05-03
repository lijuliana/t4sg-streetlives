"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import moment from "moment";
import { ChevronDown } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { getSession } from "@/lib/chatApi";

interface StoredSession {
  id: string;
  token: string;
  need_category: string;
  created_at: string;
}

interface ActiveSession {
  id: string;
  state: string;
  need_category: string;
}

export default function UserDashboardPage() {
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [past, setPast] = useState<StoredSession[]>([]);

  useEffect(() => {
    const id = localStorage.getItem("sl_session_id");
    const state = localStorage.getItem("sl_session_state");
    const token = localStorage.getItem("sl_session_token");
    const need_category = localStorage.getItem("sl_session_need_category") ?? "other";
    const created_at = localStorage.getItem("sl_session_created_at") ?? new Date().toISOString();

    if (id && token && state && state !== "closed") {
      // Verify real status — navigator may have closed it since the last visit
      getSession(id, token)
        .then((session) => {
          if (session.status === "closed") {
            localStorage.setItem("sl_session_state", "closed");
            // Archive to past sessions
            const past = JSON.parse(localStorage.getItem("sl_past_sessions") ?? "[]");
            if (!past.find((p: { id: string }) => p.id === id)) {
              past.unshift({ id, token, need_category, created_at });
              localStorage.setItem("sl_past_sessions", JSON.stringify(past));
            }
            setPast(JSON.parse(localStorage.getItem("sl_past_sessions") ?? "[]"));
          } else {
            setActive({ id, state, need_category });
          }
        })
        .catch(() => {
          // If we can't verify, show it as active — safer than hiding it
          setActive({ id, state, need_category });
        });
    }

    const stored = JSON.parse(localStorage.getItem("sl_past_sessions") ?? "[]");
    setPast(stored);
  }, []);

  return (
    <DashboardShell title="My Sessions" role="user">
      <details open className="group">
        <summary className="flex items-center justify-between cursor-pointer list-none select-none mb-3">
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide">Active Session</h2>
          <ChevronDown size={14} className="text-gray-400 group-open:rotate-180 transition-transform" />
        </summary>
        {!active ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center space-y-3">
            <p className="text-sm text-gray-500">You don&apos;t have an active session.</p>
            <Link
              href="/chat"
              className="inline-block bg-brand-yellow text-gray-900 text-sm font-medium px-5 py-2.5 rounded-md hover:brightness-95 transition"
            >
              Chat with a Peer Navigator
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <Link
              href="/chat"
              className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-300 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {active.need_category.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {active.state === "waiting" ? "Waiting for navigator…" : "In progress"}
                  </p>
                </div>
                <span className="text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                  Continue →
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("sl_session_id");
                localStorage.removeItem("sl_session_token");
                localStorage.removeItem("sl_session_state");
                window.location.href = "/chat";
              }}
              aria-label="Start a new chat instead"
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center py-1 transition"
            >
              Start a new chat instead →
            </button>
          </div>
        )}
      </details>

      <details open className="group">
        <summary className="flex items-center justify-between cursor-pointer list-none select-none mb-3">
          <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide">Past Sessions</h2>
          <ChevronDown size={14} className="text-gray-400 group-open:rotate-180 transition-transform" />
        </summary>
        {past.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md px-5 py-8 text-center">
            <p className="text-sm text-gray-400">No past sessions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/user/${s.id}`}
                className="block bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-gray-300 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {s.need_category.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {moment(s.created_at).format("MMM D, YYYY [at] h:mm A")}
                    </p>
                  </div>
                  <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                    Closed
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </details>
    </DashboardShell>
  );
}
