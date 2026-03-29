import { randomUUID } from "node:crypto";
import type { Message, MessageSender } from "../types.js";

/**
 * Interface for the message store.
 * The in-memory implementation below is sufficient for local development.
 * Swap for a Postgres/SQLite implementation when transcript persistence is needed.
 */
interface MessageStoreInterface {
  append(sessionId: string, sender: MessageSender, body: string): Message;
  listBySession(sessionId: string): Message[];
}

class InMemoryMessageStore implements MessageStoreInterface {
  private readonly messages = new Map<string, Message[]>();

  append(sessionId: string, sender: MessageSender, body: string): Message {
    const message: Message = {
      messageId: randomUUID(),
      sessionId,
      sender,
      body,
      sentAt: new Date().toISOString(),
    };
    const list = this.messages.get(sessionId) ?? [];
    list.push(message);
    this.messages.set(sessionId, list);
    return message;
  }

  listBySession(sessionId: string): Message[] {
    return this.messages.get(sessionId) ?? [];
  }
}

// Singleton — replace this export with a DB-backed implementation later.
export const messageStore: MessageStoreInterface = new InMemoryMessageStore();
