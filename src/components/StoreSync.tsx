"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Listens for localStorage changes made by other browser tabs and rehydrates
 * the Zustand store so sessions and chat messages sync in real time.
 */
export default function StoreSync() {
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "streetlives-store-v9") {
        useStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
