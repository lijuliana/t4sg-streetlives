"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import type { AppRole } from "@/lib/store";

const ROLE_LABELS: Record<AppRole, string> = {
  user: "User",
  navigator: "Navigator",
  supervisor: "Supervisor",
};

const ROLE_COLORS: Record<AppRole, string> = {
  user: "bg-blue-100 text-blue-700",
  navigator: "bg-brand-yellow text-gray-900",
  supervisor: "bg-purple-100 text-purple-700",
};

interface Props {
  title: string;
  role: AppRole;
  backHref?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export default function DashboardShell({ title, role, backHref, action, children }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-14">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {backHref && (
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="p-1 -ml-1 text-gray-500 hover:text-gray-800 transition"
              aria-label="Go back"
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
          )}
          <Link href="/" className="font-medium text-sm text-gray-900 hover:opacity-70 transition-opacity">
            StreetLives
          </Link>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}
          >
            {ROLE_LABELS[role]}
          </span>
          <div className="flex-1" />
          {action}
          {role === "user" && !action && (
            <Link
              href="/chat"
              className="p-1 text-gray-500 hover:text-gray-800 transition"
              aria-label="Open chat"
            >
              <MessageCircle size={20} strokeWidth={2} />
            </Link>
          )}
        </div>
        <div className="max-w-lg mx-auto px-4 pb-3">
          <h1 className="text-xl font-normal text-gray-900">{title}</h1>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-5">
        {children}
      </main>
    </div>
  );
}
