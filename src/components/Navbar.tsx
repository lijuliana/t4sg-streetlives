import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { auth0 } from "@/lib/auth0";

interface NavbarProps {
  className?: string;
}

export default async function Navbar({ className }: NavbarProps) {
  const session = await auth0.getSession();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200",
        className
      )}
    >
      {/* Dashboard link */}
      <Link
        href={ROLE_DASHBOARD[activeRole]}
        className="p-1 text-gray-800 hover:opacity-70 transition-opacity"
        aria-label="Go to dashboard"
      >
        <LayoutDashboard size={22} strokeWidth={2} />
      </Link>

      {/* Wordmark */}
      <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
        <span className="font-black">StreetLives</span>
      </Link>

      {/* Right group */}
      <div className="flex items-center gap-3">
        {session ? (
          <a
            href="/auth/logout"
            className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            Log out
          </a>
        ) : (
          <>
            <a
              href="/auth/signin"
              className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
            >
              Sign In
            </a>
            <a
              href="/auth/signup"
              className="text-sm font-semibold text-gray-900 bg-brand-yellow px-3 py-1.5 rounded-full hover:brightness-95 transition"
            >
              Sign Up
            </a>
          </>
        )}
        <a
          href="https://www.google.com"
          className="flex items-center gap-1.5 bg-brand-exit text-white text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
          aria-label="Quick exit — leave this site"
        >
          Quick Exit
          <span className="w-4 h-4 rounded-full bg-white text-brand-exit flex items-center justify-center text-xs font-black leading-none">
            !
          </span>
        </a>
      </div>
    </header>
  );
}
