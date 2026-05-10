/**
 * In-process stores for session metadata not tracked by Lambda.
 * Uses globalThis so all Next.js module instances within the same Node.js process
 * share the same state (prevents API route / Server Component isolation issues).
 * Cleared on server restart.
 */
declare global {
  // eslint-disable-next-line no-var
  var __slTransferRequested: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __slNeedCategories: Map<string, string> | undefined;
}

if (!globalThis.__slTransferRequested) globalThis.__slTransferRequested = new Set<string>();
if (!globalThis.__slNeedCategories) globalThis.__slNeedCategories = new Map<string, string>();

export function markTransferRequested(sessionId: string): void {
  globalThis.__slTransferRequested!.add(sessionId);
}

export function isTransferRequested(sessionId: string): boolean {
  return globalThis.__slTransferRequested!.has(sessionId);
}

export function setSessionNeedCategory(sessionId: string, category: string): void {
  globalThis.__slNeedCategories!.set(sessionId, category);
}

export function getSessionNeedCategory(sessionId: string): string | null {
  return globalThis.__slNeedCategories!.get(sessionId) ?? null;
}
