/**
 * Unified message store for all session messages.
 *
 * MVP architecture note:
 *   Navigator replies are sent via the backend service account and stored here
 *   with sender_type = "navigator". This means navigators do not need personal
 *   Matrix accounts for the demo flow — the service account posts on their behalf.
 *   Per-navigator Matrix identities and encrypted rooms are deferred to a future
 *   milestone.
 *
 * senderType values:
 *   "guest"     — message from the guest (posted to Matrix via service account)
 *   "navigator" — reply from a navigator sent through the dashboard
 *   "system"    — synthetic event injected locally (e.g. session-closed notice)
 *
 * matrixEventId is populated when the message was successfully echoed into
 * the Matrix room; null for system messages or if the Matrix send failed.
 */

import { randomUUID } from "node:crypto";

export type SenderType = "guest" | "navigator" | "system";

export interface SessionMessage {
  id: string;
  sessionId: string;
  matrixRoomId: string;
  matrixEventId: string | null;
  senderType: SenderType;
  senderNavigatorId: string | null;
  senderLabel: string;
  text: string;
  createdAt: string;
}

interface AppendInput {
  sessionId: string;
  matrixRoomId: string;
  matrixEventId?: string | null;
  senderType: SenderType;
  senderNavigatorId?: string | null;
  senderLabel: string;
  text: string;
}

export interface MessageStoreInterface {
  append(input: AppendInput): SessionMessage;
  listBySession(sessionId: string): SessionMessage[];
  /** Back-fill a Matrix event ID after a successful room send. */
  setMatrixEventId(messageId: string, eventId: string): void;
}

class InMemoryMessageStore implements MessageStoreInterface {
  private readonly messages = new Map<string, SessionMessage[]>();
  private readonly byId = new Map<string, SessionMessage>();

  append(input: AppendInput): SessionMessage {
    const msg: SessionMessage = {
      id: randomUUID(),
      sessionId: input.sessionId,
      matrixRoomId: input.matrixRoomId,
      matrixEventId: input.matrixEventId ?? null,
      senderType: input.senderType,
      senderNavigatorId: input.senderNavigatorId ?? null,
      senderLabel: input.senderLabel,
      text: input.text,
      createdAt: new Date().toISOString(),
    };
    const list = this.messages.get(input.sessionId) ?? [];
    list.push(msg);
    this.messages.set(input.sessionId, list);
    this.byId.set(msg.id, msg);
    return msg;
  }

  listBySession(sessionId: string): SessionMessage[] {
    return this.messages.get(sessionId) ?? [];
  }

  setMatrixEventId(messageId: string, eventId: string): void {
    const msg = this.byId.get(messageId);
    if (msg) msg.matrixEventId = eventId;
  }
}

// Singleton — swap for a DB-backed implementation when persistence is needed.
export const messageStore: MessageStoreInterface = new InMemoryMessageStore();
