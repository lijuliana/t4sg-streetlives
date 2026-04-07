"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { ChatContent } from "@/app/chat/page";

export default function ChatFAB() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Don't render until we know the screen size — prevents flash of wrong version on first load
  if (isDesktop === null) return null;

  if (!isDesktop) {
    return (
      <Link
        href="/chat"
        className="fixed bottom-20 right-5 w-14 h-14 bg-brand-yellow rounded-full shadow-lg flex items-center justify-center hover:brightness-95 transition z-50"
        aria-label="Chat with a peer navigator"
      >
        <Image src="/new-icons/chat-search.svg" alt="" width={24} height={24} aria-hidden />
      </Link>
    );
  }

  return (
    <>
      {/* Desktop floating panel */}
      {open && (
        <div className="fixed bottom-24 right-6 w-[480px] h-[700px] rounded-md shadow-2xl overflow-hidden z-50 border border-gray-200">
          <ChatContent onClose={() => setOpen(false)} />
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-yellow rounded-full shadow-lg flex items-center justify-center hover:brightness-95 transition z-50"
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
