import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
}

export interface Session {
  id: string;
  userId: string;
  userDisplayName: string;
  navigatorId: string;
  navigatorName: string;
  status: SessionStatus;
  startedAt: string;
  closedAt?: string;
  summary?: string;
  topics: string[];
  referrals: Referral[];
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
    navigatorId: string,
    topic: string
  ) => Session;
  updateSessionStatus: (
    sessionId: string,
    status: SessionStatus,
    summary?: string
  ) => void;
  endSession: (sessionId: string, summary?: string) => void;

  addReferral: (
    sessionId: string,
    partial: Omit<Referral, "id" | "sessionId" | "sharedAt">
  ) => void;
  updateReferralStatus: (referralId: string, status: ReferralStatus) => void;

  getSessionById: (id: string) => Session | undefined;
  getSessionsForNavigator: (navigatorId: string) => Session[];
  getActiveSessionsForUser: (userId: string) => Session[];

  chatMessages: Record<string, ChatMessage[]>;
  addChatMessage: (sessionId: string, msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  seedChatMessages: (sessionId: string, msgs: Omit<ChatMessage, "id" | "timestamp">[]) => void;
}

export const useStore = create<StreetLivesStore>()(
  persist(
    (set, get) => ({
  activeRole: "user",
  setRole: (role) => set({ activeRole: role }),

  navigators: MOCK_NAVIGATORS,
  sessions: MOCK_SESSIONS,

  createSession: (userId, userDisplayName, navigatorId, topic) => {
    const navigator = get().navigators.find((n) => n.id === navigatorId);
    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      userDisplayName,
      navigatorId,
      navigatorName: navigator?.name ?? "Peer Navigator",
      status: "active",
      startedAt: new Date().toISOString(),
      topics: [topic],
      referrals: [],
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
    get().updateSessionStatus(sessionId, "closed", summary);
  },

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
  seedChatMessages: (sessionId, msgs) => {
    const messages: ChatMessage[] = msgs.map((m) => ({
      ...m,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }));
    set((state) => ({
      chatMessages: {
        ...state.chatMessages,
        [sessionId]: [...(state.chatMessages[sessionId] ?? []), ...messages],
      },
    }));
  },
    }),
    {
      name: "streetlives-store-v3",
      storage: createJSONStorage(() => localStorage),
      // Only persist shared data — activeRole stays per-tab so each tab can
      // independently act as User, Navigator, or Supervisor
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
