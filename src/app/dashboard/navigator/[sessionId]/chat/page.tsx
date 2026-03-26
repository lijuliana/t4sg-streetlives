"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, X } from "lucide-react";
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


export default function NavigatorChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const getSessionById = useStore((s) => s.getSessionById);
  const addChatMessage = useStore((s) => s.addChatMessage);
  const endSession = useStore((s) => s.endSession);
  const activeRole = useStore((s) => s.activeRole);

  // Stable selector — returns same reference until messages change
  const messages = useStore((s) => s.chatMessages[sessionId] ?? EMPTY_MSGS);

  const session = getSessionById(sessionId);
  const [inputValue, setInputValue] = useState("");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = activeRole === "supervisor" || session?.status === "closed";

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

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isReadOnly) return;
    setInputValue("");
    addChatMessage(sessionId, { role: "navigator", content: text });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleEndSession = () => {
    endSession(sessionId);
    setShowEndConfirm(false);
    router.push(`/dashboard/navigator/${sessionId}`);
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
      // System message — divider
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

      // Navigator + bot messages — right-aligned (our side)
      if (msg.role === "navigator" || msg.role === "bot") {
        const isNavigator = msg.role === "navigator";
        return (
          <div key={msg.id} className="flex flex-col items-end mb-3 max-w-[80%] ml-auto">
            <div
              className={cn(
                "text-sm px-4 py-2.5 rounded-2xl rounded-br-sm w-fit",
                isNavigator
                  ? "bg-brand-yellow text-gray-900"
                  : "bg-gray-200 text-gray-700"
              )}
            >
              {msg.content}
            </div>
            <span className="text-[10px] text-gray-400 mt-1 mr-1">{ts}</span>
          </div>
        );
      }

      // User messages — left-aligned
      const prevMsg = messages[i - 1];
      const showAvatar = !prevMsg || prevMsg.role !== "user" || (prevMsg.role as string) === "system";
      return (
        <div key={msg.id} className={cn("flex gap-3 mb-3 max-w-[80%]", !showAvatar && "pl-13")}>
          {showAvatar ? <UserAvatar /> : <div className="w-10 flex-shrink-0" />}
          <div className="flex flex-col">
            <div className="bg-white text-gray-900 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm w-fit">
              {msg.content}
            </div>
            <span className="text-[10px] text-gray-400 mt-1 ml-1">{ts}</span>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 w-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/navigator/${sessionId}`)}
          className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition"
          aria-label="Back to session"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {isReadOnly ? "Transcript" : "Chat"} · {session.userDisplayName}
          </p>
          <p className="text-xs text-gray-400">
            {isReadOnly ? "Read-only" : `Responding as ${session.navigatorName}`}
          </p>
        </div>
        {!isReadOnly && session.status !== "closed" && (
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
          <button type="button" onClick={() => setShowEndConfirm(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button type="button" onClick={handleEndSession} className="text-xs font-medium text-gray-900 px-3 py-1.5 rounded-lg bg-brand-yellow hover:brightness-95 transition">
            Confirm End
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
        {renderMessages()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar — hidden for read-only */}
      {!isReadOnly && (
        <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-center gap-3 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`Reply as ${session.navigatorName}…`}
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
