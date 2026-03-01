"use client";

import type { Service } from "@/types";
import { addFavorite, removeFavorite } from "@/app/actions/favorites";
import { useState } from "react";
import Link from "next/link";

type Props = {
  service: Service;
  isSaved: boolean;
  signedIn: boolean;
};

export function ServiceCard({ service, isSaved, signedIn }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isSaved);

  async function handleToggle() {
    if (!signedIn) return;
    setSaving(true);
    try {
      if (saved) {
        const res = await removeFavorite(service.id);
        if (!res.error) setSaved(false);
      } else {
        const res = await addFavorite(service.id);
        if (!res.error) setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-amber-200/80 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {service.category}
        </span>
        <h2 className="font-semibold text-gray-900 mt-0.5">{service.name}</h2>
        <p className="text-sm text-gray-700 mt-1">{service.description}</p>
      </div>
      <div className="flex-shrink-0">
        {signedIn ? (
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              saved
                ? "bg-amber-200 text-gray-800 hover:bg-amber-300"
                : "bg-gray-900 text-white hover:bg-black"
            } disabled:opacity-50`}
          >
            {saving ? "..." : saved ? "Saved" : "Save"}
          </button>
        ) : (
          <Link
            href="/auth"
            className="inline-block px-4 py-2 rounded-lg font-medium text-sm bg-gray-900 text-white hover:bg-black"
          >
            Sign in to save
          </Link>
        )}
      </div>
    </div>
  );
}
