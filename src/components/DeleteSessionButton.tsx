"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Permanently delete this chat session and all its history? This cannot be undone.")) return;

    setState("loading");
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Delete failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setErrorMsg(msg);
      setState("error");
      setTimeout(() => { setState("idle"); setErrorMsg(null); }, 4000);
    }
  }

  return (
    <div
      className="flex flex-col items-end flex-shrink-0"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <button
        type="button"
        onClick={handleDelete}
        disabled={state === "loading"}
        title={state === "error" ? errorMsg ?? "Deletion failed" : "Delete session permanently"}
        className={`p-1.5 rounded transition ${
          state === "error"
            ? "text-red-500 bg-red-50"
            : "text-gray-300 hover:text-red-500 hover:bg-red-50"
        } disabled:opacity-40`}
      >
        {state === "loading" ? (
          <span className="block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 size={14} />
        )}
      </button>
      {state === "error" && errorMsg && (
        <span className="text-[10px] text-red-500 mt-0.5 max-w-[120px] text-right leading-tight">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
