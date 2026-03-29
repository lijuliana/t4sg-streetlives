/** Lifecycle states for a chat session. Closed sessions are read-only. */
export type SessionStatus = "active" | "closed";

/** Who sent a message in the backend message store. */
export type MessageSender = "guest" | "service";

/**
 * The app's system-of-record for a single guest↔navigator chat session.
 * Matrix is only the transport layer; this record owns the session lifecycle.
 *
 * Nullable expansion hooks:
 *   navigatorId — assigned navigator (from Navigator auth system, future)
 *   referralId  — primary linked referral (denormalised convenience, future)
 *   closedAt    — ISO 8601 timestamp when the session was closed
 */
export interface Session {
  sessionId: string;
  matrixRoomId: string;
  status: SessionStatus;
  createdAt: string;
  navigatorId: string | null;
  referralId: string | null;
  closedAt: string | null;
}

/** A message stored in the backend message store. Matrix is a transport mirror. */
export interface Message {
  messageId: string;
  sessionId: string;
  sender: MessageSender;
  body: string;
  sentAt: string;
}

/** A free-text note attached to a session. Stored in backend only, not in Matrix. */
export interface Note {
  noteId: string;
  sessionId: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
}

/** A referral attached to a session. Stored in backend only, not in Matrix. */
export interface Referral {
  referralId: string;
  sessionId: string;
  title: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
}

// ── Request / response shapes ─────────────────────────────────────────────────

export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
  createdAt: string;
}

export interface SendMessageRequest {
  body: string;
}

export interface MessagesResponse {
  messages: Message[];
}

export interface CreateNoteRequest {
  body: string;
  createdBy?: string;
}

export interface CreateReferralRequest {
  title: string;
  description?: string;
  createdBy?: string;
}
