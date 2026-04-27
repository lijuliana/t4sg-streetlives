"use client";

import { useState, useEffect } from "react";

// 2 minutes for testing — change to 24 * 60 * 60 * 1000 for production
const THRESHOLD_MS = 2 * 60 * 1000;

export function OverdueFlair({ createdAt }: { createdAt: string }) {
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsOverdue(Date.now() - new Date(createdAt).getTime() > THRESHOLD_MS);
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [createdAt]);

  if (!isOverdue) return null;

  return (
    <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium border border-red-200">
      Response overdue
    </span>
  );
}
