"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Menu, Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatState = "greeting" | "user_replied" | "connecting" | "live";

type MessageRole = "bot" | "user" | "navigator" | "system";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

const QUICK_REPLIES = [
  "A place to sleep tonight",
  "A job",
  "A hot shower",
  "Something to eat",
  "Help with finding housing",
];

function BotAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </div>
  );
}

function NavigatorAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center flex-shrink-0">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 18v-1a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v1" />
        <circle cx="12" cy="7" r="4" />
        <path d="M8 10s1 2 4 2 4-2 4-2" />
      </svg>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [chatState, setChatState] = useState<ChatState>("greeting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [topic, setTopic] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const newMsg = { ...msg, id: crypto.randomUUID() };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg;
  }, []);

  const hasInitialized = useRef(false);

  // Seed initial bot messages on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    let sid = sessionStorage.getItem("chat_session_id");

    const initSession = async () => {
      if (!sid) {
        sid = crypto.randomUUID();
        sessionStorage.setItem("chat_session_id", sid);
      }

      setTimeout(() => {
        addMessage({
          role: "bot",
          content: "Hi, we're here to help guide you through this service",
        });
      }, 300);

      setTimeout(() => {
        addMessage({ role: "bot", content: "What can I help you with?" });
      }, 750);
    };

    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerNavigatorConnection = useCallback(
    (selectedTopic: string) => {
      setChatState("connecting");

      setTimeout(() => {
        setIsTyping(true);
      }, 400);

      setTimeout(() => {
        setIsTyping(false);
        addMessage({
          role: "bot",
          content: "Thanks, let me connect you with a peer navigator to help you",
        });

        setTimeout(() => {
          addMessage({
            role: "system",
            content: "You are being connected with Jenna",
          });

          setTimeout(() => {
            setIsTyping(true);
          }, 600);

          setTimeout(() => {
            setIsTyping(false);
            addMessage({
              role: "navigator",
              content: `Hi, I'm Jenna, I see you need help with ${selectedTopic.toLowerCase()}.`,
            });

            setTimeout(() => {
              addMessage({
                role: "navigator",
                content: "Can you tell me a little more about what you need?",
              });
              setChatState("live");
              setTimeout(() => inputRef.current?.focus(), 100);
            }, 800);
          }, 1800);
        }, 600);
      }, 1000);
    },
    [addMessage]
  );

  const handleQuickReply = (chip: string) => {
    if (chatState !== "greeting") return;
    setChatState("user_replied");
    setTopic(chip);
    addMessage({ role: "user", content: chip });
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
    if (!text || chatState !== "live") return;
    setInputValue("");
    addMessage({ role: "user", content: text });
  };

  const handleEndChat = () => {
    sessionStorage.removeItem("chat_session_id");
    router.push("/");
  };

  // Group consecutive same-role bot/navigator messages to share one avatar
  const renderMessages = () => {
    return messages.map((msg, i) => {
      if (msg.role === "system") {
        return (
          <div key={msg.id} className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <p className="text-xs text-gray-400 whitespace-nowrap">{msg.content}</p>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        );
      }

      if (msg.role === "user") {
        return (
          <div key={msg.id} className="flex justify-end mb-3">
            <div className="bg-brand-yellow text-gray-900 text-sm font-medium px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[75%]">
              {msg.content}
            </div>
          </div>
        );
      }

      // bot or navigator — show avatar only if previous message was different role
      const prevMsg = messages[i - 1];
      const showAvatar = !prevMsg || prevMsg.role !== msg.role || (prevMsg.role as string) === "system";

      return (
        <div key={msg.id} className={cn("flex gap-3 mb-3", !showAvatar && "pl-13")}>
          {showAvatar ? (
            msg.role === "navigator" ? <NavigatorAvatar /> : <BotAvatar />
          ) : (
            <div className="w-10 flex-shrink-0" />
          )}
          <div className="bg-white text-gray-900 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm max-w-[75%]">
            {msg.content}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 w-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button type="button" aria-label="Menu" className="p-1 text-gray-800">
          <Menu size={22} strokeWidth={2} />
        </button>
        <span className="font-black text-base text-gray-900">StreetLives</span>
        <button
          type="button"
          onClick={handleEndChat}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
          aria-label="End chat"
        >
          END CHAT
          <X size={18} strokeWidth={2.5} />
        </button>
      </header>

      {/* Connection status */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex-shrink-0">
        <p className="text-xs text-gray-400 text-center">
          You are connected with StreetLives assistant
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {renderMessages()}

        {/* Typing indicator */}
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
            <button
              type="button"
              key={chip}
              onClick={() => handleQuickReply(chip)}
              className="border border-brand-yellow text-gray-900 text-sm px-4 py-2 rounded-xl hover:bg-brand-yellow/10 transition"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Bottom input bar */}
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

      {/* LIVE FAB */}
      {(chatState === "greeting" || chatState === "user_replied") && (
        <button
          type="button"
          onClick={handleLiveFAB}
          className="fixed bottom-20 right-5 w-16 h-16 bg-brand-yellow rounded-full shadow-lg flex flex-col items-center justify-center gap-0.5 hover:brightness-95 transition z-50"
          aria-label="Connect with a live peer navigator"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 18v-1a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v1" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="text-[9px] font-black text-gray-900 tracking-widest">LIVE</span>
        </button>
      )}
    </div>
  );
}
