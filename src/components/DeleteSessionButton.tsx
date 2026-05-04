"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Permanently delete this chat session and all its history? This cannot be undone.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? `Delete failed (${res.status})`);
        return;
      }
      toast.success("Session deleted");
      router.refresh();
    } catch {
      toast.error("Network error — could not delete session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex-shrink-0"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        title="Delete session permanently"
        className="p-1.5 rounded transition text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
      >
        {loading ? (
          <span className="block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 size={14} />
        )}
      </button>
    </div>
  );
}
