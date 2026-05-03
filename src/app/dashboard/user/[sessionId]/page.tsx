"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import moment from "moment";
import { fetchMessages } from "@/lib/chatApi";
import type { Message } from "@/lib/chatApi";
import { cn } from "@/lib/utils";

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

function NavigatorAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-1a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v1" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

export default function UserSessionTranscriptPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const past = JSON.parse(localStorage.getItem("sl_past_sessions") ?? "[]");
    const stored = past.find((s: { id: string }) => s.id === sessionId);
    if (!stored) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    fetchMessages(sessionId, stored.token)
      .then((raw: Message[]) => {
        setMessages(
          raw.map((m) => {
            const { sender, text } = parseMessage(m.body);
            return {
              id: m.eventId,
              role: sender === "User" ? "user" : "navigator",
              content: text,
              timestamp: new Date(m.timestamp).toISOString(),
            };
          })
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button type="button" onClick={() => router.push("/dashboard/user")} aria-label="Back" className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <span className="text-sm font-medium text-gray-900">Session Not Found</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">This session transcript is no longer available on this device.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          type="button"
          onClick={() => router.push("/dashboard/user")}
          className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">Chat Transcript</p>
          <p className="text-xs text-gray-400">Read-only</p>
        </div>
      </header>

      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex-shrink-0">
        <p className="text-xs text-gray-400 text-center">This session has ended</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">No messages in this session.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const ts = moment(msg.timestamp).format("h:mm A");
            if (msg.role === "user") {
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
            const showAvatar = !prevMsg || prevMsg.role !== "navigator";
            return (
              <div key={msg.id} className={cn("flex gap-3 mb-3 max-w-[80%]", !showAvatar && "pl-11")}>
                {showAvatar ? <NavigatorAvatar /> : <div className="w-8 flex-shrink-0" />}
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
      </div>
    </div>
  );
}
