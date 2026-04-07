"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { ChatMessage } from "@/lib/store";

const EMPTY_MSGS: ChatMessage[] = [];

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

export default function SupervisorChatTranscriptPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const getSessionById = useStore((s) => s.getSessionById);
  const messages = useStore((s) => s.chatMessages[sessionId] ?? EMPTY_MSGS);
  const session = getSessionById(sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!session) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-500">Session not found.</p>
        <button type="button" onClick={() => router.back()} className="mt-3 text-xs text-gray-400 underline">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 w-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/supervisor/${sessionId}`)}
          className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition"
          aria-label="Back to session"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            Transcript · {session.userDisplayName}
          </p>
          <p className="text-xs text-gray-400">Read-only</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center px-6 h-full">
            <p className="text-sm text-gray-400">No messages in this session.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            if (msg.role === "system") {
              return (
                <div key={msg.id} className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <p className="text-xs text-gray-400 whitespace-nowrap">{msg.content}</p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              );
            }

            const ts = moment(msg.timestamp).format("h:mm A");

            if (msg.serviceId) {
              return (
                <div key={msg.id} className="flex flex-col items-end mb-3 max-w-[80%] ml-auto">
                  <div className="bg-brand-yellow text-gray-900 text-sm px-4 py-3 rounded-md rounded-br-sm w-fit">
                    <p className="font-medium">{msg.content}</p>
                    <p className="text-xs mt-0.5 text-gray-700">Referral shared</p>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 mr-1">{ts}</span>
                </div>
              );
            }

            if (msg.role === "navigator" || msg.role === "bot") {
              const isNavigator = msg.role === "navigator";
              return (
                <div key={msg.id} className="flex flex-col items-end mb-3 max-w-[80%] ml-auto">
                  <div
                    className={cn(
                      "text-sm px-4 py-2.5 rounded-md rounded-br-sm w-fit",
                      isNavigator ? "bg-brand-yellow text-gray-900" : "bg-gray-200 text-gray-700"
                    )}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 mr-1">{ts}</span>
                </div>
              );
            }

            const prevMsg = messages[i - 1];
            const showAvatar = !prevMsg || prevMsg.role !== "user" || (prevMsg.role as string) === "system";
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
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
