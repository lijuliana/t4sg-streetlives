"use client";

import { removeFavorite } from "@/app/actions/favorites";
import { useState } from "react";

type Props = { serviceId: string };

export function RemoveButton({ serviceId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    await removeFavorite(serviceId);
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={loading}
      className="flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm bg-amber-200 text-gray-800 hover:bg-amber-300 disabled:opacity-50"
    >
      {loading ? "..." : "Remove"}
    </button>
  );
}
