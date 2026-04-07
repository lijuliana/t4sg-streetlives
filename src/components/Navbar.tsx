import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { auth0 } from "@/lib/auth0";
import NavMenu from "@/components/NavMenu";

const ROLES_CLAIM = "https://streetlives.app/roles";

const ROLE_DASHBOARD: Record<string, string> = {
  navigator: "/dashboard/navigator",
  supervisor: "/dashboard/supervisor",
  user: "/dashboard/user",
};

interface NavbarProps {
  className?: string;
}

export default async function Navbar({ className }: NavbarProps) {
  const session = await auth0.getSession();

  const roles: string[] = (session?.user?.[ROLES_CLAIM] as string[]) ?? [];
  const matchedRole = roles.find((r) => ROLE_DASHBOARD[r] !== undefined) ?? (session ? "user" : null);
  const dashboardHref = matchedRole ? ROLE_DASHBOARD[matchedRole] : null;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-brand-yellow",
        className
      )}
    >
      {/* Left: hamburger menu + language selector */}
      <div className="flex items-center gap-3">
        <NavMenu />
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-brand-dark hover:opacity-70 transition-opacity"
          aria-label="Select language"
        >
          <ChevronDown size={14} strokeWidth={2} />
          English
        </button>
      </div>

      {/* Center: wordmark */}
      <Link href="/" className="text-base tracking-tight text-brand-dark absolute left-1/2 -translate-x-1/2">
        <span className="font-bold">YourPeer</span>{" "}
        <span className="font-normal">NYC</span>
      </Link>

      {/* Right: auth links + Quick Exit */}
      <div className="flex items-center gap-3">
        {session ? (
          <>
            {dashboardHref && (
              <Link
                href={dashboardHref}
                className="text-sm font-medium text-brand-dark hover:opacity-70 transition-opacity hidden sm:inline"
              >
                Dashboard
              </Link>
            )}
            <a
              href="/auth/logout"
              className="text-sm text-gray-600 hover:text-brand-dark transition-colors"
            >
              Log out
            </a>
          </>
        ) : (
          <>
            <Link
              href="/dashboard/user"
              className="text-sm font-medium text-brand-dark hover:opacity-70 transition-opacity hidden sm:inline"
            >
              Dashboard
            </Link>
            <a
              href="/auth/signin"
              className="text-sm text-gray-600 hover:opacity-70 transition-opacity hidden sm:inline"
            >
              Sign In
            </a>
            <a
              href="/auth/signup"
              className="text-sm text-brand-dark bg-brand-yellow px-3 py-1.5 rounded-lg hover:brightness-95 transition hidden sm:inline"
            >
              Sign Up
            </a>
          </>
        )}
        <a
          href="https://www.google.com"
          className="flex items-center gap-1.5 text-brand-exit text-xs font-medium uppercase tracking-wide hover:opacity-90 transition-opacity"
          aria-label="Quick exit — leave this site"
        >
          Quick Exit
          <span className="w-5 h-5 rounded-full bg-brand-exit text-white flex items-center justify-center text-xs font-medium leading-none">
            !
          </span>
        </a>
      </div>
    </header>
  );
}
