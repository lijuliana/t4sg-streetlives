import { randomUUID } from "node:crypto";
import type { SessionEvent, SessionEventType } from "../types.js";

interface AppendEventInput {
  sessionId: string;
  eventType: SessionEventType;
  actor?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SessionEventStoreInterface {
  append(input: AppendEventInput): SessionEvent;
  listBySession(sessionId: string): SessionEvent[];
  listAll(): SessionEvent[];
}

class InMemorySessionEventStore implements SessionEventStoreInterface {
  private readonly events: SessionEvent[] = [];

  append(input: AppendEventInput): SessionEvent {
    const event: SessionEvent = {
      id: randomUUID(),
      sessionId: input.sessionId,
      eventType: input.eventType,
      actor: input.actor ?? null,
      timestamp: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };
    this.events.push(event);
    return event;
  }

  listBySession(sessionId: string): SessionEvent[] {
    return this.events.filter((e) => e.sessionId === sessionId);
  }

  listAll(): SessionEvent[] {
    return [...this.events].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }
}

export const sessionEventStore: SessionEventStoreInterface = new InMemorySessionEventStore();
