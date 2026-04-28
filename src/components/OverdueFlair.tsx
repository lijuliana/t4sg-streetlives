"use client";

import { useState, useEffect } from "react";

const THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function OverdueFlair({ sessionId, createdAt }: { sessionId: string; createdAt: string }) {
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const check = () => {
      const responded = localStorage.getItem(`sl_nav_responded_${sessionId}`);
      if (responded) {
        setIsOverdue(false);
        return;
      }
      setIsOverdue(Date.now() - new Date(createdAt).getTime() > THRESHOLD_MS);
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [sessionId, createdAt]);

  if (!isOverdue) return null;

  return (
    <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium border border-red-200">
      Response overdue
    </span>
  );
}
