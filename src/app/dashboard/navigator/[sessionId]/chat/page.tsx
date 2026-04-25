"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, X } from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;

interface RealSession {
  id: string;
  navigator_id: string | null;
  need_category: string;
  status: string;
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

function parseMessage(body: string): { sender: string; text: string } {
  const colonIdx = body.indexOf(": ");
  if (colonIdx === -1) return { sender: "Navigator", text: body };
  return { sender: body.slice(0, colonIdx), text: body.slice(colonIdx + 2) };
}

function UserAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

export default function NavigatorChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [session, setSession] = useState<RealSession | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch session info once on mount
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then(setSession)
      .catch(console.error);
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

  // Poll messages
  useEffect(() => {
    const poll = () => {
      fetch(`/api/sessions/${sessionId}/messages`)
        .then((r) => r.json())
        .then((data) => appendMessages(data.messages ?? []))
        .catch(console.error);
    };
    poll(); // immediate first fetch
    pollRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, appendMessages]);

  const isReadOnly = session?.status === "closed";

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isReadOnly) return;
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
      }
    } catch {
      setSendError("Network error");
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleEndSession = async () => {
    await fetch(`/api/sessions/${sessionId}/close`, { method: "POST" });
    setShowEndConfirm(false);
    router.push("/dashboard/navigator");
  };

  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <div>
            <p className="text-sm text-gray-400">No messages yet.</p>
            {!isReadOnly && (
              <p className="text-xs text-gray-400 mt-1">
                The user will start the conversation from the chat interface.
              </p>
            )}
          </div>
        </div>
      );
    }

    return messages.map((msg, i) => {
      const ts = moment(msg.timestamp).format("h:mm A");

      if (msg.role === "navigator") {
        return (
          <div key={msg.id} className="flex flex-col items-end mb-3 max-w-[80%] ml-auto">
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
        <div key={msg.id} className={cn("flex gap-3 mb-3 max-w-[80%]", !showAvatar && "pl-13")}>
          {showAvatar ? <UserAvatar /> : <div className="w-10 flex-shrink-0" />}
          <div className="flex flex-col">
            <div className="bg-white text-gray-900 text-sm px-4 py-2.5 rounded-md rounded-tl-sm shadow-sm w-fit">
              {msg.content}
            </div>
            <span className="text-[10px] text-gray-400 mt-1 ml-1">{ts}</span>
          </div>
        </div>
      );
    });
  };

  const categoryLabel = session?.need_category?.replace("_", " ") ?? "Chat";

  return (
    <div className="flex flex-col h-screen bg-gray-100 w-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          type="button"
          onClick={() => router.push("/dashboard/navigator")}
          className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate capitalize">
            {isReadOnly ? "Transcript" : "Chat"} · {categoryLabel}
          </p>
          <p className="text-xs text-gray-400">
            {isReadOnly ? "Read-only" : "Responding as you"}
          </p>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setShowEndConfirm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition"
          >
            END
            <X size={16} strokeWidth={2.5} />
          </button>
        )}
      </header>

      {/* End session confirm banner */}
      {showEndConfirm && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <p className="text-sm text-gray-700 flex-1">End this session?</p>
          <button
            type="button"
            onClick={() => setShowEndConfirm(false)}
            className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEndSession}
            className="text-xs font-medium text-gray-900 px-3 py-1.5 rounded-lg bg-brand-yellow hover:brightness-95 transition"
          >
            Confirm End
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {renderMessages()}
        <div ref={messagesEndRef} />
      </div>

      {sendError && (
        <p className="px-4 py-1 text-xs text-red-500 bg-white border-t border-gray-100">{sendError}</p>
      )}

      {/* Input bar */}
      {!isReadOnly && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-center gap-3 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
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
  );
}
