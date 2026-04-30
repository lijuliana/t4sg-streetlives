import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";
import { MOCK_NAVIGATORS, MOCK_SESSIONS } from "./mockData";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionStatus = "queued" | "active" | "closed";

export type ReferralStatus =
  | "shared"
  | "called_together"
  | "appointment_scheduled"
  | "contacted"
  | "visited"
  | "waitlisted";

export type ReferralCategory =
  | "Accommodations"
  | "Food"
  | "Health"
  | "Legal"
  | "Work"
  | "Personal Care"
  | "Family Services"
  | "Connection"
  | "Other";

export type AppRole = "user" | "navigator" | "supervisor";

export interface Navigator {
  id: string;
  name: string;
  avatarInitials: string;
  specialties: ReferralCategory[];
  capacity: number;
  available: boolean;
}

export interface NavigatorProfile {
  id: string;
  auth0_user_id: string;
  first_name: string;
  last_name: string;
  nav_group: string;
  status: "available" | "away" | "offline";
  capacity: number;
  languages: string[];
  expertise_tags?: string[] | null;
  availability_schedule?: Record<string, { start: string; end: string }> | null;
  is_general_intake?: boolean;
}

export function profileToNavigator(profile: NavigatorProfile): Navigator {
  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    id: profile.id,
    name: fullName,
    avatarInitials: initials || "NA",
    specialties: (profile.expertise_tags as ReferralCategory[]) ?? [],
    capacity: profile.capacity,
    available: profile.status === "available",
  };
}

export function isProfileComplete(profile: NavigatorProfile): boolean {
  return (
    (profile.first_name?.trim() ?? "").length > 0 &&
    (profile.last_name?.trim() ?? "").length > 0 &&
    (profile.languages?.length ?? 0) > 0 &&
    (profile.expertise_tags?.length ?? 0) > 0 &&
    (profile.nav_group?.trim() ?? "").length > 0
  );
}

export interface Referral {
  id: string;
  sessionId: string;
  serviceName: string;
  category: ReferralCategory;
  status: ReferralStatus;
  sharedAt: string;
  notes?: string;
}

export type ChatMessageRole = "bot" | "user" | "navigator" | "system";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  serviceId?: string;
}

export interface SessionEvent {
  id: string;
  type: "created" | "assigned" | "transferred" | "closed" | "returned";
  actorName: string;
  timestamp: string;
  note?: string;
}

export interface SessionLog {
  outcome: ("referrals_shared" | "information_only" | "follow_up_needed")[];
  referralsShared: string[];
  notes: string;
  followUp: boolean;
  followUpDate?: string;
}

export interface Session {
  id: string;
  userId: string;
  userDisplayName: string;
  navigatorId: string | null;
  navigatorName: string;
  status: SessionStatus;
  startedAt: string;
  closedAt?: string;
  summary?: string;
  topics: string[];
  referrals: Referral[];
  assignedByRouting: boolean;
  events: SessionEvent[];
  logged?: boolean;
  sessionLog?: SessionLog;
  reviewStatus?: "submitted" | "approved" | "returned";
  supervisorNote?: string;
  supervisorReturnNote?: string;
  reviewedAt?: string;
}

function routeSession(needCategory: string, navigators: Navigator[], sessions: Session[]): string | null {
  const pool = navigators.filter((n) => n.available);
  const matching = pool.filter((n) => n.specialties.some((s) => s.toLowerCase() === needCategory.toLowerCase()));
  const candidates = matching.length > 0 ? matching : pool;
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const load = (nav: Navigator) => sessions.filter((s) => s.navigatorId === nav.id && s.status === "active").length / nav.capacity;
    return load(a) - load(b);
  })[0].id;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface StreetLivesStore {
  activeRole: AppRole;
  setRole: (role: AppRole) => void;

  navigators: Navigator[];
  sessions: Session[];

  createSession: (
    userId: string,
    userDisplayName: string,
    navigatorId: string | null,
    topic: string,
    assignedByRouting?: boolean
  ) => Session;
  updateSessionStatus: (
    sessionId: string,
    status: SessionStatus,
    summary?: string
  ) => void;
  endSession: (sessionId: string, summary?: string) => void;
  assignSession: (sessionId: string, navigatorId: string) => void;
  transferSession: (sessionId: string, navigatorId: string) => void;
  rerouteSession: (sessionId: string) => void;
  logSession: (sessionId: string, log: SessionLog) => void;
  submitForReview: (sessionId: string) => void;
  approveSession: (sessionId: string, note: string) => void;
  returnSession: (sessionId: string, note: string) => void;

  addReferral: (
    sessionId: string,
    partial: Omit<Referral, "id" | "sessionId" | "sharedAt">
  ) => void;
  updateReferralStatus: (referralId: string, status: ReferralStatus) => void;

  setNavigators: (navigators: Navigator[]) => void;

  ownProfile: NavigatorProfile | null;
  setOwnProfile: (profile: NavigatorProfile) => void;

  getSessionById: (id: string) => Session | undefined;
  getSessionsForNavigator: (navigatorId: string) => Session[];
  getActiveSessionsForUser: (userId: string) => Session[];

  chatMessages: Record<string, ChatMessage[]>;
  addChatMessage: (sessionId: string, msg: Omit<ChatMessage, "id" | "timestamp">) => void;
}

export const useStore = create<StreetLivesStore>()(
  persist(
    (set, get) => ({
      activeRole: "user",
      setRole: (role) => set({ activeRole: role }),

      navigators: MOCK_NAVIGATORS,
      sessions: MOCK_SESSIONS,

      createSession: (userId, userDisplayName, navigatorId, topic, assignedByRouting = false) => {
        const navigator = navigatorId
          ? get().navigators.find((n) => n.id === navigatorId)
          : undefined;
        const now = new Date().toISOString();
        const session: Session = {
          id: crypto.randomUUID(),
          userId,
          userDisplayName,
          navigatorId,
          navigatorName: navigator?.name ?? "",
          status: "active",
          startedAt: now,
          topics: [topic],
          referrals: [],
          assignedByRouting,
          events: [
            { id: crypto.randomUUID(), type: "created", actorName: "System", timestamp: now },
            ...(navigator
              ? [{ id: crypto.randomUUID(), type: "assigned" as const, actorName: "System", timestamp: now, note: `Assigned to ${navigator.name}` }]
              : []),
          ],
        };
        set((state) => ({ sessions: [session, ...state.sessions] }));
        return session;
      },

      updateSessionStatus: (sessionId, status, summary) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  status,
                  ...(summary !== undefined ? { summary } : {}),
                  ...(status === "closed" ? { closedAt: new Date().toISOString() } : {}),
                }
              : s
          ),
        })),

      endSession: (sessionId, summary) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        const actorName = session?.navigatorName || "Navigator";
        const now = new Date().toISOString();
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  status: "closed",
                  closedAt: now,
                  ...(summary !== undefined ? { summary } : {}),
                  events: [
                    ...s.events,
                    { id: crypto.randomUUID(), type: "closed" as const, actorName, timestamp: now },
                  ],
                }
              : s
          ),
        }));
      },

      assignSession: (sessionId, navigatorId) => {
        const navigator = get().navigators.find((n) => n.id === navigatorId);
        if (!navigator) return;
        const now = new Date().toISOString();
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  navigatorId,
                  navigatorName: navigator.name,
                  events: [
                    ...s.events,
                    { id: crypto.randomUUID(), type: "assigned" as const, actorName: navigator.name, timestamp: now, note: `Assigned to ${navigator.name}` },
                  ],
                }
              : s
          ),
        }));
      },

      transferSession: (sessionId, navigatorId) => {
        const navigator = get().navigators.find((n) => n.id === navigatorId);
        if (!navigator) return;
        const session = get().sessions.find((s) => s.id === sessionId);
        const actorName = session?.navigatorName || "Navigator";
        const now = new Date().toISOString();
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  navigatorId,
                  navigatorName: navigator.name,
                  events: [
                    ...s.events,
                    { id: crypto.randomUUID(), type: "transferred" as const, actorName, timestamp: now, note: `Transferred to ${navigator.name}` },
                  ],
                }
              : s
          ),
        }));
        toast.success(`Transferred to ${navigator.name}`);
      },

      rerouteSession: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;
        const category = session.topics[0] ?? "Other";
        const { navigators, sessions } = get();
        const newNavId = routeSession(category, navigators, sessions);
        if (!newNavId || newNavId === session.navigatorId) {
          toast("Already assigned to the best-fit navigator");
          return;
        }
        get().transferSession(sessionId, newNavId);
      },

      logSession: (sessionId, log) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, logged: true, sessionLog: log } : s
          ),
        })),

      submitForReview: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, reviewStatus: "submitted" } : s
          ),
        })),

      approveSession: (sessionId, note) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, reviewStatus: "approved", supervisorNote: note, reviewedAt: new Date().toISOString() }
              : s
          ),
        })),

      returnSession: (sessionId, note) =>
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const now = new Date().toISOString();
            return {
              ...s,
              reviewStatus: "returned",
              supervisorReturnNote: note,
              status: "active",
              events: [
                ...s.events,
                { id: crypto.randomUUID(), type: "returned" as const, actorName: "Supervisor", timestamp: now, note: note || undefined },
              ],
            };
          }),
        })),

      addReferral: (sessionId, partial) => {
        const referral: Referral = {
          ...partial,
          id: crypto.randomUUID(),
          sessionId,
          sharedAt: new Date().toISOString(),
        };
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, referrals: [...s.referrals, referral] }
              : s
          ),
        }));
      },

      updateReferralStatus: (referralId, status) =>
        set((state) => ({
          sessions: state.sessions.map((s) => ({
            ...s,
            referrals: s.referrals.map((r) =>
              r.id === referralId ? { ...r, status } : r
            ),
          })),
        })),

      setNavigators: (navigators) => set({ navigators }),

      ownProfile: null,
      setOwnProfile: (ownProfile) => set({ ownProfile }),

      getSessionById: (id) => get().sessions.find((s) => s.id === id),
      getSessionsForNavigator: (navigatorId) =>
        get().sessions.filter((s) => s.navigatorId === navigatorId),
      getActiveSessionsForUser: (userId) =>
        get().sessions.filter((s) => s.userId === userId && s.status !== "closed"),

      chatMessages: {},
      addChatMessage: (sessionId, msg) => {
        const message: ChatMessage = {
          ...msg,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          chatMessages: {
            ...state.chatMessages,
            [sessionId]: [...(state.chatMessages[sessionId] ?? []), message],
          },
        }));
      },
    }),
    {
      name: "streetlives-store-v10",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        chatMessages: state.chatMessages,
      }),
    }
  )
);

// ─── Referral Status Helpers ──────────────────────────────────────────────────

export const REFERRAL_STATUS_STYLES: Record<ReferralStatus, string> = {
  shared: "bg-blue-50 text-blue-600",
  called_together: "bg-purple-50 text-purple-700",
  appointment_scheduled: "bg-amber-50 text-amber-700",
  contacted: "bg-teal-50 text-teal-700",
  visited: "bg-green-50 text-green-700",
  waitlisted: "bg-red-50 text-red-600",
};

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  shared: "Shared",
  called_together: "Called Together",
  appointment_scheduled: "Appointment Scheduled",
  contacted: "Contacted",
  visited: "Visited",
  waitlisted: "Waitlisted",
};

export const REFERRAL_CATEGORIES: ReferralCategory[] = [
  "Accommodations",
  "Food",
  "Health",
  "Legal",
  "Work",
  "Personal Care",
  "Family Services",
  "Connection",
  "Other",
];

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "shared",
  "called_together",
  "appointment_scheduled",
  "contacted",
  "visited",
  "waitlisted",
];
