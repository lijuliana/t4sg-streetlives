import type { Navigator, Session } from "./store";

export const MOCK_NAVIGATORS: Navigator[] = [
  { id: "nav-1", name: "Jenna Rivera", avatarInitials: "JR" },
  { id: "nav-2", name: "Marcus D.", avatarInitials: "MD" },
];

const now = Date.now();
const mins = (n: number) => new Date(now - n * 60 * 1000).toISOString();
const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

export const MOCK_SESSIONS: Session[] = [
  {
    id: "ses-1",
    userId: "user-1",
    userDisplayName: "Jordan M.",
    navigatorId: "nav-1",
    navigatorName: "Jenna Rivera",
    status: "active",
    startedAt: mins(22),
    topics: ["housing"],
    referrals: [
      {
        id: "ref-1",
        sessionId: "ses-1",
        serviceName: "Hope House Emergency Shelter",
        category: "Accommodations",
        status: "shared",
        sharedAt: mins(18),
        notes: "Beds available tonight, call ahead",
      },
    ],
  },
  {
    id: "ses-2",
    userId: "user-2",
    userDisplayName: "Aaliyah R.",
    navigatorId: "nav-1",
    navigatorName: "Jenna Rivera",
    status: "closed",
    startedAt: days(2),
    closedAt: days(2),
    topics: ["food"],
    summary: "Connected Aaliyah with local food pantry. She plans to visit Friday.",
    referrals: [
      {
        id: "ref-2",
        sessionId: "ses-2",
        serviceName: "St. Anthony's Food Pantry",
        category: "Food",
        status: "visited",
        sharedAt: days(2),
      },
    ],
  },
  {
    id: "ses-3",
    userId: "user-3",
    userDisplayName: "Darius K.",
    navigatorId: "nav-2",
    navigatorName: "Marcus D.",
    status: "active",
    startedAt: mins(45),
    topics: ["health"],
    referrals: [
      {
        id: "ref-3",
        sessionId: "ses-3",
        serviceName: "BronxCare Community Clinic",
        category: "Health",
        status: "appointment_scheduled",
        sharedAt: mins(30),
        notes: "Tuesday 10am, bring ID",
      },
    ],
  },
];
