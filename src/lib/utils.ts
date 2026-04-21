import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ChatMessage } from "@/lib/store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hasUnresponded24h(
  sessionId: string,
  chatMessages: Record<string, ChatMessage[]>
): boolean {
  const msgs = chatMessages[sessionId] ?? [];
  const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) return false;
  const lastUserIdx = msgs.lastIndexOf(lastUserMsg);
  const navigatorReplied = msgs.slice(lastUserIdx + 1).some((m) => m.role === "navigator");
  if (navigatorReplied) return false;
  return Date.now() - new Date(lastUserMsg.timestamp).getTime() > 24 * 60 * 60 * 1000;
}
