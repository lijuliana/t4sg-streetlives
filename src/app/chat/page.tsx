"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, X } from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { ChatMessageRole } from "@/lib/store";

type ChatState = "greeting" | "user_replied" | "connecting" | "live";

interface LocalMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
}

const QUICK_REPLIES = [
  "A place to sleep tonight",
  "A job",
  "A hot shower",
  "Something to eat",
  "Help with finding housing",
];

// Stable empty array to avoid selector infinite loop
const EMPTY_MSGS: import("@/lib/store").ChatMessage[] = [];

function BotAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </div>
  );
}

function NavigatorAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-1a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v1" />
        <circle cx="12" cy="7" r="4" />
        <path d="M8 10s1 2 4 2 4-2 4-2" />
      </svg>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();

  const createSession = useStore((s) => s.createSession);
  const updateSessionStatus = useStore((s) => s.updateSessionStatus);
  const endSessionInStore = useStore((s) => s.endSession);
  const addChatMessage = useStore((s) => s.addChatMessage);
  const seedChatMessages = useStore((s) => s.seedChatMessages);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Watch session status so we can detect when navigator closes the session
  const sessionStatus = useStore((s) =>
    activeSessionId ? s.sessions.find((sess) => sess.id === activeSessionId)?.status : undefined
  );
  const isClosed = sessionStatus === "closed";
  const [chatState, setChatState] = useState<ChatState>("greeting");
  // Pre-session messages (bot greeting, connecting phase)
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [topic, setTopic] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ref to capture current local messages inside stale closures
  const localMessagesRef = useRef<LocalMessage[]>([]);

  // Store-backed messages once session is live
  const storeMessages = useStore((s) =>
    activeSessionId ? (s.chatMessages[activeSessionId] ?? EMPTY_MSGS) : EMPTY_MSGS
  );

  // What actually renders — pre-session: local, live: store
  const displayMessages = activeSessionId ? storeMessages : localMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, isTyping]);

  const addLocalMessage = useCallback((msg: Omit<LocalMessage, "id" | "timestamp">) => {
    const newMsg = { ...msg, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    setLocalMessages((prev) => [...prev, newMsg]);
    localMessagesRef.current = [...localMessagesRef.current, newMsg];
    return newMsg;
  }, []);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    setTimeout(() => addLocalMessage({ role: "bot", content: "Hi, we're here to help guide you through this service" }), 300);
    setTimeout(() => addLocalMessage({ role: "bot", content: "What can I help you with?" }), 750);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerNavigatorConnection = useCallback(
    (selectedTopic: string) => {
      setChatState("connecting");

      setTimeout(() => setIsTyping(true), 400);

      setTimeout(() => {
        setIsTyping(false);
        addLocalMessage({ role: "bot", content: "Thanks, let me connect you with a peer navigator to help you" });

        setTimeout(() => {
          addLocalMessage({ role: "system", content: "You are being connected with Jenna" });

          setTimeout(() => setIsTyping(true), 600);

          setTimeout(() => {
            setIsTyping(false);
            addLocalMessage({ role: "navigator", content: `Hi, I'm Jenna, I see you need help with ${selectedTopic.toLowerCase()}.` });

            setTimeout(() => {
              addLocalMessage({ role: "navigator", content: "Can you tell me a little more about what you need?" });
              setChatState("live");

              // Create session and seed the store with the full conversation so far
              const newSession = createSession("user-1", "Jordan M.", "nav-1", selectedTopic);
              setActiveSessionId(newSession.id);
              sessionStorage.setItem("chat_session_id", newSession.id);
              updateSessionStatus(newSession.id, "active");
              seedChatMessages(newSession.id, localMessagesRef.current.map((m) => ({ role: m.role, content: m.content })));

              setTimeout(() => inputRef.current?.focus(), 100);
            }, 800);
          }, 1800);
        }, 600);
      }, 1000);
    },
    [addLocalMessage, createSession, updateSessionStatus, seedChatMessages]
  );

  const handleQuickReply = (chip: string) => {
    if (chatState !== "greeting") return;
    setChatState("user_replied");
    setTopic(chip);
    addLocalMessage({ role: "user", content: chip });
    triggerNavigatorConnection(chip);
  };

  const handleLiveFAB = () => {
    if (chatState === "connecting" || chatState === "live") return;
    const t = topic || "general support";
    setTopic(t);
    setChatState("user_replied");
    triggerNavigatorConnection(t);
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || chatState !== "live" || !activeSessionId) return;
    setInputValue("");
    addChatMessage(activeSessionId, { role: "user", content: text });
  };

  const handleEndChat = () => {
    const sid = sessionStorage.getItem("chat_session_id") ?? activeSessionId;
    if (sid) endSessionInStore(sid);
    sessionStorage.removeItem("chat_session_id");
    router.push("/");
  };

  // Full reset so the user can start a fresh conversation
  const handleStartNewChat = () => {
    sessionStorage.removeItem("chat_session_id");
    window.location.reload();
  };

  const renderMessages = () => {
    return displayMessages.map((msg, i) => {
      if (msg.role === "system") {
        return (
          <div key={msg.id} className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <p className="text-xs text-gray-400 whitespace-nowrap">{msg.content}</p>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        );
      }

      const ts = "timestamp" in msg ? moment(msg.timestamp).format("h:mm A") : "";

      if (msg.role === "user") {
        return (
          <div key={msg.id} className="flex flex-col items-end mb-3 max-w-[80%] ml-auto">
            <div className="bg-brand-yellow text-gray-900 text-sm px-4 py-2.5 rounded-2xl rounded-br-sm w-fit">
              {msg.content}
            </div>
            {ts && <span className="text-[10px] text-gray-400 mt-1 mr-1">{ts}</span>}
          </div>
        );
      }

      const prevMsg = displayMessages[i - 1];
      const showAvatar = !prevMsg || prevMsg.role !== msg.role || (prevMsg.role as string) === "system";

      return (
        <div key={msg.id} className={cn("flex gap-3 mb-3 max-w-[80%]", !showAvatar && "pl-13")}>
          {showAvatar ? (
            msg.role === "navigator" ? <NavigatorAvatar /> : <BotAvatar />
          ) : (
            <div className="w-10 flex-shrink-0" />
          )}
          <div className="flex flex-col">
            <div className="bg-white text-gray-900 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm w-fit">
              {msg.content}
            </div>
            {ts && <span className="text-[10px] text-gray-400 mt-1 ml-1">{ts}</span>}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 w-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="w-8" />
        <span className="font-bold text-base text-gray-900">StreetLives</span>
        <button type="button" onClick={handleEndChat} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition" aria-label="End chat">
          END CHAT
          <X size={18} strokeWidth={2.5} />
        </button>
      </header>

      {/* Connection status */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex-shrink-0">
        <p className="text-xs text-gray-400 text-center">
          {chatState === "live" ? "Connected with Jenna · Peer Navigator" : "You are connected with StreetLives assistant"}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {renderMessages()}
        {isTyping && (
          <div className="flex gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0" />
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce typing-dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce typing-dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce typing-dot-3" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick reply chips */}
      {chatState === "greeting" && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 flex-shrink-0">
          {QUICK_REPLIES.map((chip) => (
            <button type="button" key={chip} onClick={() => handleQuickReply(chip)} className="border border-brand-yellow text-gray-900 text-sm px-4 py-2 rounded-xl hover:bg-brand-yellow/10 transition">
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Closed session banner */}
      {isClosed ? (
        <div className="px-4 py-4 bg-white border-t border-gray-200 flex-shrink-0 text-center space-y-2">
          <p className="text-xs text-gray-500">This session has been closed.</p>
          <button
            type="button"
            onClick={handleStartNewChat}
            className="inline-block bg-brand-yellow text-gray-900 text-sm font-medium px-5 py-2 rounded-xl hover:brightness-95 transition"
          >
            Start New Chat
          </button>
        </div>
      ) : (
        /* Input bar */
        <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-center gap-3 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Or tell us about what you need…"
            disabled={chatState !== "live"}
            className="flex-1 text-sm text-gray-500 bg-transparent outline-none placeholder-gray-400 disabled:cursor-default"
          />
          <button type="button" aria-label="Voice input (coming soon)" className="text-gray-400">
            <Mic size={20} />
          </button>
        </div>
      )}

      {/* LIVE FAB */}
      {(chatState === "greeting" || chatState === "user_replied") && (
        <button type="button" onClick={handleLiveFAB} className="fixed bottom-20 right-5 w-16 h-16 bg-brand-yellow rounded-full shadow-lg flex flex-col items-center justify-center gap-0.5 hover:brightness-95 transition z-50" aria-label="Connect with a live peer navigator">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-1a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v1" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-[9px] font-bold text-gray-900 tracking-widest">LIVE</span>
        </button>
      )}
    </div>
  );
}
