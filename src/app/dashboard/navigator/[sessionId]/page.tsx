"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Send, Circle, UserPlus, ArrowRight, CheckCircle, Home } from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";
import { isProfileComplete } from "@/lib/store";
import type { NavigatorProfile } from "@/lib/store";

const OUTCOME_OPTIONS = [
  "Referrals shared",
  "Information Only",
];

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
  capacity: number;
  languages: string[];
}

interface SessionEvent {
  id: string;
  session_id: string;
  event_type: "created" | "assigned" | "transferred" | "closed" | "returned";
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
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

export default function NavigatorSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [myProfile, setMyProfile] = useState<NavProfile | null>(null);
  const [navigators, setNavigators] = useState<NavProfile[]>([]);
  const [myFullProfile, setMyFullProfile] = useState<NavigatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Transfer
  const [transferTarget, setTransferTarget] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Notes
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Close flow
  const [showClosePanel, setShowClosePanel] = useState(false);
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);
  const [closing, setClosing] = useState(false);

  // Chat
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());

  // Resizable split panel
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const isSplitDragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isSplitDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.max(260, Math.min(rect.width - 300, e.clientX - rect.left));
      if (leftPanelRef.current) leftPanelRef.current.style.width = `${w}px`;
    };
    const onUp = () => { isSplitDragging.current = false; document.body.style.cursor = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load session, navigators, events, and current user's profile on mount
  useEffect(() => {
    async function load() {
      const [sessionRes, navsRes, eventsRes, meRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/navigators`),
        fetch(`/api/sessions/${sessionId}/events`),
        fetch(`/api/navigators/me`),
      ]);
      const [s, navs, evts] = await Promise.all([
        sessionRes.json(),
        navsRes.json(),
        eventsRes.json(),
      ]);
      const navList: NavProfile[] = Array.isArray(navs) ? navs : [];
      setSession(s);
      setEvents(Array.isArray(evts) ? evts : []);
      setNotes(s.notes ?? "");
      setNavigators(navList);

      if (meRes.ok) {
        const fullProfile = (await meRes.json().catch(() => null)) as NavigatorProfile | null;
        if (fullProfile) setMyFullProfile(fullProfile);
      }

      if (s.navigator_id) {
        const mine = navList.find((n: NavProfile) => n.id === s.navigator_id);
        if (mine) setMyProfile(mine);
      }
      setLoading(false);
    }
    load().catch(console.error);
  }, [sessionId]);

  // Poll chat messages
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
    pollRef.current = setInterval(poll, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId, appendMessages]);

  const saveNotes = async () => {
    if (!session || notes === (session.notes ?? "")) return;
    setSavingNotes(true);
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
    } finally {
      setSavingNotes(false);
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
        router.push("/dashboard/navigator");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Transfer failed");
      }
    } finally {
      setTransferring(false);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const closeRes = await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
      if (!closeRes.ok) {
        toast.error("Failed to close session");
        return;
      }
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: selectedOutcomes,
          submitted_for_review: true,
        }),
      });
      toast.success("Session closed and submitted for review");
      router.refresh();
      router.push("/dashboard/navigator");
    } finally {
      setClosing(false);
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || session?.status === "closed") return;
    setInputValue("");
    setSendError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/navigator-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSendError(err.error ?? "Failed to send");
      } else {
        localStorage.setItem(`sl_nav_responded_${sessionId}`, Date.now().toString());
      }
    } catch {
      setSendError("Network error");
    }
    setTimeout(() => inputRef.current?.focus(), 50);
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

  const isClosed = session.status === "closed";
  const isMySession = myProfile !== null;
  const profileComplete = myFullProfile ? isProfileComplete(myFullProfile) : true;
  const otherNavigators = navigators.filter((n) => n.id !== session.navigator_id && n.status === "available");
  const categoryLabel = session.need_category.replace(/_/g, " ");

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <Link href="/" aria-label="Home" className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition">
          <Home size={18} />
        </Link>
        <button
          type="button"
          onClick={() => { router.refresh(); router.push("/dashboard/navigator"); }}
          className="p-1 text-gray-500 hover:text-gray-800 transition"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 capitalize">{categoryLabel}</p>
          <p className="text-xs text-gray-400">
            {isClosed ? "Closed" : "Active"} · Started {moment(session.created_at).format("MMM D, YYYY")}
          </p>
        </div>
        <span className={cn(
          "text-xs font-medium px-2.5 py-1 rounded-full",
          isClosed ? "bg-gray-100 text-gray-500" :
          session.status === "active" ? "bg-green-100 text-green-700" :
          "bg-amber-100 text-amber-700"
        )}>
          {isClosed ? "Closed" : "Active"}
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
            <p><span className="text-gray-400">Started:</span> {moment(session.created_at).format("MMM D, YYYY [at] h:mm A")}</p>
            {session.closed_at && (
              <p><span className="text-gray-400">Closed:</span> {moment(session.closed_at).format("MMM D, YYYY [at] h:mm A")}</p>
            )}
            {session.navigator_id ? (
              <p><span className="text-gray-400">Navigator:</span> {myProfile?.nav_group ?? session.navigator_id}</p>
            ) : (
              <p className="text-amber-500">Unassigned</p>
            )}
          </div>

          {/* Session notes */}
          <div>
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Session Notes</h2>
            <textarea
              aria-label="Session notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              disabled={isClosed}
              rows={4}
              placeholder="Add notes about this session…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none disabled:bg-gray-50 disabled:text-gray-500"
            />
            {savingNotes && <p className="text-xs text-gray-400 mt-1">Saving…</p>}
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
                        {event.actor_id ? ` · ${event.actor_id}` : ""}
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
                  .filter((n) => n.id !== myProfile?.id)
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

          {/* Close session */}
          {!isClosed && isMySession && !showClosePanel && (
            <button
              type="button"
              onClick={() => setShowClosePanel(true)}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-800 transition"
            >
              Close Session
            </button>
          )}

          {/* Close panel */}
          {showClosePanel && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <p className="text-sm font-medium text-gray-900">Close this session</p>

              <div>
                <p className="text-xs text-gray-500 mb-2">Outcome (select all that apply)</p>
                <div className="space-y-1.5">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedOutcomes.includes(opt)}
                        onChange={(e) => {
                          setSelectedOutcomes(e.target.checked
                            ? [...selectedOutcomes, opt]
                            : selectedOutcomes.filter((o) => o !== opt)
                          );
                        }}
                        className="rounded border-gray-300"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowClosePanel(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={closing}
                  className="flex-1 bg-brand-yellow text-gray-900 text-sm font-medium py-2.5 rounded-xl hover:brightness-95 transition disabled:opacity-50"
                >
                  {closing ? "Closing…" : "Confirm & Submit for Review"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={() => { isSplitDragging.current = true; document.body.style.cursor = "col-resize"; }}
          className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-brand-yellow cursor-col-resize transition-colors"
        />

        {/* Right panel — chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-100">
          <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {isClosed ? "Chat Transcript" : "Live Chat"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">No messages yet.</p>
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

          {sendError && (
            <p className="px-4 py-1 text-xs text-red-500 bg-white border-t border-gray-100">{sendError}</p>
          )}

          {!isClosed && !profileComplete && (
            <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 flex items-center justify-between gap-3 flex-shrink-0">
              <p className="text-xs text-amber-700">
                Complete your profile to send messages.
              </p>
              <Link
                href="/dashboard/navigator/profile"
                className="flex-shrink-0 text-xs font-semibold text-amber-700 underline underline-offset-2"
              >
                Edit profile
              </Link>
            </div>
          )}
          {!isClosed && profileComplete && (
            <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-center gap-3 flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                aria-label="Reply"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Reply…"
                className="flex-1 text-sm text-gray-700 bg-transparent outline-none placeholder-gray-400"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="w-9 h-9 bg-brand-yellow rounded-full flex items-center justify-center hover:brightness-95 transition disabled:opacity-40"
                aria-label="Send message"
              >
                <Send size={15} strokeWidth={2} className="text-gray-900" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
