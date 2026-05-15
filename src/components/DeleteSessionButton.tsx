"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? `Delete failed (${res.status})`);
        setConfirming(false);
        return;
      }
      toast.success("Session deleted");
      router.refresh();
    } catch {
      toast.error("Network error — could not delete session");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  function handleTrash(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(true);
  }

  return (
    <div
      className="flex-shrink-0"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {confirming ? (
        <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
          <span className="text-xs text-red-600 font-medium mr-1">Delete?</span>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            title="Confirm delete"
            className="p-0.5 rounded text-red-500 hover:bg-red-100 transition disabled:opacity-40"
          >
            {loading ? (
              <span className="block w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={13} />
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            title="Cancel"
            className="p-0.5 rounded text-gray-400 hover:bg-gray-100 transition disabled:opacity-40"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleTrash}
          title="Delete session permanently"
          className="p-1.5 rounded transition text-gray-300 hover:text-red-500 hover:bg-red-50"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
