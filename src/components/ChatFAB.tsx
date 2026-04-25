"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { ChatContent } from "@/components/ChatContent";

type ChatFABProps = {
  /** When set, FAB opens the staff dashboard instead of anonymous chat (matches middleware). */
  staffDashboardHref?: string | null;
};

export default function ChatFAB({ staffDashboardHref = null }: ChatFABProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const staffHref = staffDashboardHref ?? undefined;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!isDesktop) {
    return (
      <Link
        href={staffHref ?? "/chat"}
        className="fixed bottom-20 right-5 w-14 h-14 bg-brand-yellow rounded-full shadow-lg flex items-center justify-center hover:brightness-95 transition z-50"
        aria-label={staffHref ? "Open dashboard" : "Chat with a peer navigator"}
      >
        <Image src="/new-icons/chat-search.svg" alt="" width={24} height={24} aria-hidden />
      </Link>
    );
  }

  if (staffHref) {
    return (
      <Link
        href={staffHref}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-yellow rounded-full shadow-lg flex items-center justify-center hover:brightness-95 transition z-50"
        aria-label="Open dashboard"
      >
        <Image src="/new-icons/chat-search.svg" alt="" width={24} height={24} aria-hidden />
      </Link>
    );
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 w-[420px] h-[650px] rounded-md shadow-2xl overflow-hidden z-50 border border-gray-200 hidden lg:block">
          <ChatContent onClose={() => setOpen(false)} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 w-14 h-14 bg-brand-yellow rounded-full shadow-lg items-center justify-center hover:brightness-95 transition z-50 hidden lg:flex"
        aria-label="Toggle chat"
      >
        {open ? (
          <X size={22} strokeWidth={2} className="text-brand-dark" />
        ) : (
          <Image src="/new-icons/chat-search.svg" alt="" width={24} height={24} aria-hidden />
        )}
      </button>
    </>
  );
}
