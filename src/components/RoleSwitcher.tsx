"use client";

import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { AppRole } from "@/lib/store";
import { cn } from "@/lib/utils";

const ROLES: { id: AppRole; label: string }[] = [
  { id: "user", label: "User" },
  { id: "navigator", label: "Navigator" },
  { id: "supervisor", label: "Supervisor" },
];

const ROLE_DESTINATIONS: Record<AppRole, string> = {
  user: "/dashboard/user",
  navigator: "/dashboard/navigator",
  supervisor: "/dashboard/supervisor",
};

export default function RoleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const activeRole = useStore((s) => s.activeRole);
  const setRole = useStore((s) => s.setRole);

  // Hide on the chat page (immersive full-screen experience)
  if (pathname === "/chat") return null;

  const handleSwitch = (role: AppRole) => {
    setRole(role);
    router.push(ROLE_DESTINATIONS[role]);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-brand-dark border-t border-gray-700">
      <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-3">
        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          Viewing as:
        </span>
        <div className="flex gap-1.5 flex-1">
          {ROLES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSwitch(id)}
              className={cn(
                "flex-1 text-xs font-medium py-1.5 rounded-md transition",
                activeRole === id
                  ? "bg-brand-yellow text-gray-900"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
