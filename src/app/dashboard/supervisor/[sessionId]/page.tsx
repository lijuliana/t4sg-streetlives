"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Circle, UserPlus, ArrowRight, CheckCircle, Home } from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;

interface Session {
  id: string;
  navigator_id: string | null;
  need_category: string;
  language: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  notes: string | null;
  outcome: string[] | null;
  follow_up_date: string | null;
  submitted_for_review: boolean | null;
  approved: boolean | null;
  coaching_notes: string | null;
}

interface NavProfile {
  id: string;
  auth0_user_id: string;
  nav_group: string;
  status: string;
}

interface SessionEvent {
  id: string;
  event_type: "created" | "assigned" | "transferred" | "closed" | "returned";
  actor_id: string | null;
  created_at: string;
}

interface MatrixMessage {
  eventId: string;
  body: string;
  timestamp: number;
}

interface LocalMessage {
  id: string;
  role: "user" | "navigator";
  content: string;
  timestamp: string;
}

function resolveActorName(actorId: string, navList: NavProfile[]): string {
  if (actorId === "system") return "System";
  if (actorId === "user" || actorId.endsWith("@clients")) return "User";
  const nav = navList.find((n) => n.auth0_user_id === actorId || n.id === actorId);
  return nav ? (nav.nav_group || actorId) : "Supervisor";
}

const EVENT_LABELS: Record<SessionEvent["event_type"], string> = {
  created: "Session created",
  assigned: "Assigned to navigator",
  transferred: "Transferred",
  closed: "Session closed",
  returned: "Returned to navigator",
};

function EventIcon({ type }: { type: SessionEvent["event_type"] }) {
  const cls = "flex-shrink-0 mt-0.5";
  if (type === "created") return <Circle size={14} className={`${cls} text-gray-400`} />;
  if (type === "assigned") return <UserPlus size={14} className={`${cls} text-blue-400`} />;
  if (type === "transferred") return <ArrowRight size={14} className={`${cls} text-amber-500`} />;
  if (type === "returned") return <ArrowRight size={14} className={`${cls} text-red-400`} />;
  return <CheckCircle size={14} className={`${cls} text-green-500`} />;
}

function parseMessage(body: string): { sender: string; text: string } {
  const colonIdx = body.indexOf(": ");
  if (colonIdx === -1) return { sender: "Navigator", text: body };
  return { sender: body.slice(0, colonIdx), text: body.slice(colonIdx + 2) };
}

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

export default function SupervisorSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [navigators, setNavigators] = useState<NavProfile[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Approve / return flow
  const [coachingNotes, setCoachingNotes] = useState("");
  const [approving, setApproving] = useState(false);
  const [returning, setReturning] = useState(false);

  // Transfer
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Return + transfer
  const [returnTransferTarget, setReturnTransferTarget] = useState("");

  // Chat transcript
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenEventIds = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resizable split panel
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.max(260, Math.min(rect.width - 300, e.clientX - rect.left));
      if (leftPanelRef.current) leftPanelRef.current.style.width = `${w}px`;
    };
    const onUp = () => { isDragging.current = false; document.body.style.cursor = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    async function load() {
      const [sessionRes, navsRes, eventsRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/navigators`),
        fetch(`/api/sessions/${sessionId}/events`),
      ]);
      const [s, navs, evts] = await Promise.all([
        sessionRes.json(),
        navsRes.json(),
        eventsRes.json(),
      ]);
      setSession(s);
      setNavigators(Array.isArray(navs) ? navs : []);
      setEvents(Array.isArray(evts) ? evts : []);
      setCoachingNotes(s.coaching_notes ?? "");
      setLoading(false);
    }
    load().catch(console.error);
  }, [sessionId]);

  const appendMessages = useCallback((raw: MatrixMessage[]) => {
    const newMsgs: LocalMessage[] = [];
    for (const m of raw) {
      if (seenEventIds.current.has(m.eventId)) continue;
      seenEventIds.current.add(m.eventId);
      const { sender, text } = parseMessage(m.body);
      newMsgs.push({
        id: m.eventId,
        role: sender === "User" ? "user" : "navigator",
        content: text,
        timestamp: new Date(m.timestamp).toISOString(),
      });
    }
    if (newMsgs.length > 0) setMessages((prev) => [...prev, ...newMsgs]);
  }, []);

  useEffect(() => {
    const poll = () => {
      fetch(`/api/sessions/${sessionId}/messages`)
        .then((r) => r.json())
        .then((d) => appendMessages(d.messages ?? []))
        .catch(console.error);
    };
    poll();
    // Active sessions poll live; closed sessions only need one fetch
    if (session?.status !== "closed") {
      pollRef.current = setInterval(poll, POLL_MS);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, appendMessages, session?.status]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coaching_notes: coachingNotes }),
      });
      if (res.ok) {
        toast.success("Session approved");
        router.refresh();
        router.push("/dashboard/supervisor");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Approval failed");
      }
    } finally {
      setApproving(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    setTransferring(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_navigator_id: transferTarget }),
      });
      if (res.ok) {
        toast.success("Session transferred");
        router.refresh();
        router.push("/dashboard/supervisor");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Transfer failed");
      }
    } finally {
      setTransferring(false);
    }
  };

  const handleReturn = async () => {
    if (!coachingNotes.trim()) {
      toast.error("Coaching notes required to return session");
      return;
    }
    setReturning(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitted_for_review: false, coaching_notes: coachingNotes, status: "active" }),
      });
      if (res.ok) {
        await fetch(`/api/sessions/${sessionId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_type: "returned" }),
        }).catch(() => {});
        if (returnTransferTarget) {
          await fetch(`/api/sessions/${sessionId}/transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_navigator_id: returnTransferTarget }),
          }).catch(() => {});
        }
        toast.success("Returned to navigator");
        router.refresh();
        router.push("/dashboard/supervisor");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Return failed");
      }
    } finally {
      setReturning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-sm text-gray-500">Session not found.</p>
      </div>
    );
  }

  const nav = navigators.find((n) => n.id === session.navigator_id);
  const categoryLabel = session.need_category.replace(/_/g, " ");
  const isNeedsReview = session.status === "closed" && session.approved !== true;
  const isClosed = session.status === "closed";

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <Link href="/" aria-label="Home" className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition">
          <Home size={18} />
        </Link>
        <button
          type="button"
          onClick={() => { router.refresh(); router.push("/dashboard/supervisor"); }}
          className="p-1 text-gray-500 hover:text-gray-800 transition"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 capitalize">{categoryLabel}</p>
          <p className="text-xs text-gray-400">
            {isClosed ? "Closed" : session.approved ? "Approved" : isNeedsReview ? "Needs Review" : "Active"} · {nav?.nav_group ?? "Unassigned"}
          </p>
        </div>
        <span className={cn(
          "text-xs font-medium px-2.5 py-1 rounded-full",
          session.approved ? "bg-green-100 text-green-700" :
          isNeedsReview ? "bg-amber-100 text-amber-700" :
          isClosed ? "bg-gray-100 text-gray-500" :
          "bg-green-100 text-green-700"
        )}>
          {session.approved ? "Approved" : isNeedsReview ? "Needs Review" : isClosed ? "Closed" : "Active"}
        </span>
        <a href="https://www.google.com" className="flex items-center gap-1.5 text-brand-exit text-xs font-medium uppercase tracking-wide">
          Quick Exit <span className="w-5 h-5 rounded-full bg-brand-exit text-white flex items-center justify-center font-bold text-[11px]">!</span>
        </a>
      </header>

      {/* Split layout */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left panel — session details */}
        <div ref={leftPanelRef} className="w-[420px] flex-shrink-0 overflow-y-auto bg-white p-5 space-y-5">

          {/* Session info */}
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="text-gray-400">Category:</span> <span className="capitalize">{categoryLabel}</span></p>
            {session.language && <p><span className="text-gray-400">Language:</span> {session.language.toUpperCase()}</p>}
            <p><span className="text-gray-400">Navigator:</span> {nav?.nav_group ?? "Unassigned"}</p>
            <p><span className="text-gray-400">Started:</span> {moment(session.created_at).format("MMM D, YYYY [at] h:mm A")}</p>
            {session.closed_at && (
              <p><span className="text-gray-400">Closed:</span> {moment(session.closed_at).format("MMM D, YYYY [at] h:mm A")}</p>
            )}
            {session.follow_up_date && (
              <p><span className="text-gray-400">Follow-up:</span> {moment(session.follow_up_date).format("MMM D, YYYY")}</p>
            )}
            {session.outcome && session.outcome.length > 0 && (
              <p>
                <span className="text-gray-400">Outcome: </span>
                {session.outcome.map((o) => (
                  <span key={o} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full mr-1 capitalize">
                    {o.replace(/_/g, " ")}
                  </span>
                ))}
              </p>
            )}
          </div>

          {/* Session notes — read only */}
          <div>
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Session Notes</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              {session.notes ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{session.notes}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No notes recorded.</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Timeline</h2>
            <div className="space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-gray-400">No events recorded.</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="flex items-start gap-2.5">
                    <EventIcon type={event.event_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{EVENT_LABELS[event.event_type]}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {moment(event.created_at).format("MMM D [at] h:mm A")}
                        {event.actor_id ? ` · ${resolveActorName(event.actor_id, navigators)}` : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transfer */}
          {!isClosed && (
            <div className="space-y-2">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transfer Session</h2>
              <select
                aria-label="Select navigator to transfer to"
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
              >
                <option value="">Select a navigator…</option>
                {navigators
                  .filter((n) => n.id !== session.navigator_id && n.status === "available")
                  .map((n) => (
                    <option key={n.id} value={n.id}>{n.nav_group}</option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={!transferTarget || transferring}
                className="w-full border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-40"
              >
                {transferring ? "Transferring…" : "Transfer"}
              </button>
            </div>
          )}

          {/* Coaching notes + approve — only for Needs Review sessions */}
          {isNeedsReview && (
            <div className="space-y-3">
              <div>
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Coaching Notes</h2>
                <textarea
                  aria-label="Coaching notes"
                  value={coachingNotes}
                  onChange={(e) => setCoachingNotes(e.target.value)}
                  rows={4}
                  placeholder="Add coaching feedback for the navigator…"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Transfer to navigator <span className="text-red-500">*</span></p>
                <select
                  aria-label="Transfer to navigator on return"
                  value={returnTransferTarget}
                  onChange={(e) => setReturnTransferTarget(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
                >
                  <option value="" disabled>Select a navigator…</option>
                  {navigators
                    .filter((n) => n.id !== session.navigator_id && n.status === "available")
                    .map((n) => (
                      <option key={n.id} value={n.id}>{n.nav_group}</option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReturn}
                  disabled={returning || approving || !returnTransferTarget}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {returning ? "Returning…" : "Return to Navigator"}
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approving || returning}
                  className="flex-1 bg-brand-yellow text-gray-900 text-sm font-medium py-2.5 rounded-xl hover:brightness-95 transition disabled:opacity-50"
                >
                  {approving ? "Approving…" : "Approve"}
                </button>
              </div>
            </div>
          )}

          {/* Read-only coaching notes for already approved sessions */}
          {session.approved && session.coaching_notes && (
            <div>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Coaching Notes</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{session.coaching_notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={() => { isDragging.current = true; document.body.style.cursor = "col-resize"; }}
          className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-brand-yellow cursor-col-resize transition-colors"
        />

        {/* Right panel — read-only chat transcript */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-100">
          <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chat Transcript</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">No messages.</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const ts = moment(msg.timestamp).format("h:mm A");
                if (msg.role === "navigator") {
                  return (
                    <div key={msg.id} className="flex flex-col items-end mb-3 max-w-[80%] self-end">
                      <div className="bg-brand-yellow text-gray-900 text-sm px-4 py-2.5 rounded-2xl rounded-br-sm w-fit">
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 mr-1">{ts}</span>
                    </div>
                  );
                }
                const prevMsg = messages[i - 1];
                const showAvatar = !prevMsg || prevMsg.role !== "user";
                return (
                  <div key={msg.id} className="flex gap-3 mb-3 max-w-[80%] self-start">
                    {showAvatar ? <UserAvatar /> : <div className="w-8 flex-shrink-0" />}
                    <div className="flex flex-col">
                      <div className="bg-white text-gray-900 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm w-fit">
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 ml-1">{ts}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* No send input — supervisors view transcript only */}
        </div>
      </div>
    </div>
  );
}
