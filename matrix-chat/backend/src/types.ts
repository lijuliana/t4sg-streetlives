/** Lifecycle states for a chat session. */
export type SessionStatus = "unassigned" | "active" | "closed" | "transferred";

// ── Navigator types ───────────────────────────────────────────────────────────

export type NavGroup = "CUNY_PIN" | "HOUSING_WORKS" | "DYCD";
export type NavigatorStatus = "available" | "away" | "offline";

export interface NavigatorProfile {
  id: string;
  userId: string;             // Matrix user ID, e.g. @alice:homeserver.org
  navGroup: NavGroup;         // Stored for future routing use; not a hard filter right now
  expertiseTags: string[];
  languages: string[];        // ISO 639-1 codes, lowercase
  capacity: number;           // max concurrent active sessions
  status: NavigatorStatus;
  isGeneralIntake: boolean;   // if true, eligible for initial session assignment
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}

// ── Need categories ───────────────────────────────────────────────────────────

export type NeedCategory =
  | "housing"
  | "employment"
  | "health"
  | "benefits"
  | "youth_services"
  | "education"
  | "other";

// ── Routing types ─────────────────────────────────────────────────────────────

export type RoutingMode = "initial" | "transfer";

export interface RoutingInput {
  needCategory: NeedCategory;
  tags?: string[];
  language?: string;
}

/**
 * Explainability payload included in successful assignments.
 * need_category is retained in sessions for analytics but does not constrain
 * routing in v2 — all navigators are treated as cross-trained.
 */
export interface RoutingReason {
  generalIntakeOnly: boolean;     // true for initial assignment, false for transfer
  languageRequested: string | null;
  languageMatch: boolean;
  loadRatio: number;              // active / capacity at assignment time
  score: number;                  // deterministic sort key (lower loadRatio = higher score)
}

export interface RoutingResult {
  navigator: NavigatorProfile;
  routingReason: RoutingReason;
  routingVersion: string;
}

/** Discriminated union returned by assignNavigator(). */
export type RoutingOutcome =
  | { assigned: true;  navigator: NavigatorProfile; routingReason: RoutingReason; routingVersion: string }
  | { assigned: false; reason: string; routingVersion: string };

// ── Session ───────────────────────────────────────────────────────────────────

/**
 * The app's system-of-record for a single guest↔navigator chat session.
 * Matrix is only the transport layer; this record owns the session lifecycle.
 */
export interface Session {
  sessionId: string;
  matrixRoomId: string;
  status: SessionStatus;
  createdAt: string;
  closedAt: string | null;
  needCategory: NeedCategory | null;
  assignedNavigatorId: string | null;
  routingVersion: string | null;
  routingReason: RoutingReason | null;
  routingFailReason: string | null;
  referralId: string | null;
}

// ── Session events (audit log) ────────────────────────────────────────────────

export type SessionEventType = "created" | "assigned" | "transferred" | "closed";

export interface SessionEvent {
  id: string;
  sessionId: string;
  eventType: SessionEventType;
  actor: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

// ── Notes, Referrals ──────────────────────────────────────────────────────────

export interface Note {
  noteId: string;
  sessionId: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
}

export interface Referral {
  referralId: string;
  sessionId: string;
  title: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
}

// ── Request / response shapes ─────────────────────────────────────────────────

export interface CreateSessionRequest {
  needCategory?: NeedCategory;
  tags?: string[];
  language?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
  createdAt: string;
  assignedNavigatorId: string | null;
  routingVersion: string | null;
  routingReason: RoutingReason | null;
  routingFailReason: string | null;
}

export interface SendGuestMessageRequest {
  body: string;
}

export interface SendNavigatorMessageRequest {
  text: string;
  navigatorId: string;
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

export interface CreateNavigatorProfileRequest {
  userId: string;
  navGroup: NavGroup;
  expertiseTags?: string[];
  languages?: string[];
  capacity?: number;
  status?: NavigatorStatus;
  isGeneralIntake?: boolean;
}

export interface UpdateNavigatorProfileRequest {
  navGroup?: NavGroup;
  expertiseTags?: string[];
  languages?: string[];
  capacity?: number;
  status?: NavigatorStatus;
  isGeneralIntake?: boolean;
}

export interface AssignRoutingRequest {
  needCategory: NeedCategory;
  tags?: string[];
  language?: string;
  mode?: RoutingMode;
}

export interface TransferSessionRequest {
  targetNavigatorId?: string;
  needCategory?: NeedCategory;
  tags?: string[];
  language?: string;
  reason?: string;
  actor?: string;
}
