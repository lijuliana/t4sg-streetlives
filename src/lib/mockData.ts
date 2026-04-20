import type { Navigator, Session } from "./store";

// ─── Navigators ───────────────────────────────────────────────────────────────

export const MOCK_NAVIGATORS: Navigator[] = [
  {
    id: "nav-1",
    name: "Jenna Rivera",
    avatarInitials: "JR",
    specialties: ["Accommodations", "Food", "Personal Care"],
    capacity: 4,
    available: true,
  },
  {
    id: "nav-2",
    name: "Marcus Thompson",
    avatarInitials: "MT",
    specialties: ["Health", "Legal", "Work"],
    capacity: 3,
    available: true,
  },
];

// ─── Sessions (anonymous users) ───────────────────────────────────────────────

const now = Date.now();
const mins = (n: number) => new Date(now - n * 60 * 1000).toISOString();
const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

export const MOCK_SESSIONS: Session[] = [
  {
    id: "ses-1",
    userId: "user-1",
    userDisplayName: "User #4821",
    navigatorId: "nav-1",
    navigatorName: "Jenna Rivera",
    status: "active",
    startedAt: mins(22),
    topics: ["housing"],
    assignedByRouting: true,
    events: [
      { id: "e-ses1-1", type: "created", actorName: "System", timestamp: mins(22) },
      { id: "e-ses1-2", type: "assigned", actorName: "System", timestamp: mins(22), note: "Assigned to Jenna Rivera" },
    ],
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
    userDisplayName: "User #7563",
    navigatorId: "nav-1",
    navigatorName: "Jenna Rivera",
    status: "closed",
    startedAt: days(2),
    closedAt: days(2),
    topics: ["food"],
    summary: "Connected with local food pantry.",
    assignedByRouting: true,
    events: [
      { id: "e-ses2-1", type: "created", actorName: "System", timestamp: days(2) },
      { id: "e-ses2-2", type: "assigned", actorName: "System", timestamp: days(2), note: "Assigned to Jenna Rivera" },
      { id: "e-ses2-3", type: "closed", actorName: "Jenna Rivera", timestamp: days(2) },
    ],
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
    userDisplayName: "User #2198",
    navigatorId: "nav-2",
    navigatorName: "Marcus Thompson",
    status: "active",
    startedAt: mins(45),
    topics: ["health"],
    assignedByRouting: true,
    events: [
      { id: "e-ses3-1", type: "created", actorName: "System", timestamp: mins(45) },
      { id: "e-ses3-2", type: "assigned", actorName: "System", timestamp: mins(45), note: "Assigned to Marcus Thompson" },
    ],
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
  {
    id: "ses-4",
    userId: "user-4",
    userDisplayName: "User #9034",
    navigatorId: null,
    navigatorName: "",
    status: "active",
    startedAt: mins(5),
    topics: ["Legal"],
    assignedByRouting: false,
    events: [
      { id: "e-ses4-1", type: "created", actorName: "System", timestamp: mins(5) },
    ],
    referrals: [],
  },
  {
    id: "ses-5",
    userId: "user-5",
    userDisplayName: "User #3317",
    navigatorId: null,
    navigatorName: "",
    status: "active",
    startedAt: mins(2),
    topics: ["food", "health"],
    assignedByRouting: false,
    events: [
      { id: "e-ses5-1", type: "created", actorName: "System", timestamp: mins(2) },
    ],
    referrals: [],
  },
];

// ─── Services ─────────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  neighborhood: string;
  walkMinutes: number;
  verifiedDaysAgo: number;
  isOpen: boolean;
  closesAt: string;
  services: string[];
  beds: number;
  description: string;
  eligibility: string[];
}

export const MOCK_SERVICES: Service[] = [
  {
    id: "seek-steps-center",
    name: "The Seek Steps Center",
    neighborhood: "East Village",
    walkMinutes: 3,
    verifiedDaysAgo: 30,
    isOpen: true,
    closesAt: "9PM",
    services: ["Shelter", "Food", "Medical care", "Wi-fi"],
    beds: 12,
    description:
      "This service provides housing and supportive services to youth facing homelessness. They help young people transform their lives and put them on a path to independence.",
    eligibility: [
      "18–24 yrs old",
      "Haven't been assigned to other shelters",
      "ID required (1 week grace period before ID is required)",
      "Unemployment verification letter (for housing options)",
    ],
  },
  {
    id: "hope-house",
    name: "Hope House Emergency Shelter",
    neighborhood: "Bronx",
    walkMinutes: 8,
    verifiedDaysAgo: 14,
    isOpen: true,
    closesAt: "11PM",
    services: ["Shelter", "Food"],
    beds: 24,
    description:
      "Emergency shelter providing safe overnight stays and meals for adults in crisis. No reservation required — first come, first served.",
    eligibility: [
      "18+ yrs old",
      "No active warrants",
      "Sobriety required on premises",
    ],
  },
  {
    id: "bronxcare-clinic",
    name: "BronxCare Community Clinic",
    neighborhood: "South Bronx",
    walkMinutes: 12,
    verifiedDaysAgo: 7,
    isOpen: false,
    closesAt: "5PM",
    services: ["Primary care", "Mental health", "Dental"],
    beds: 0,
    description:
      "Community health center offering sliding-scale medical, mental health, and dental services. No insurance required.",
    eligibility: [
      "All ages welcome",
      "Sliding-scale fees based on income",
      "No insurance required",
    ],
  },
  {
    id: "harlem-food-pantry",
    name: "Harlem Community Food Pantry",
    neighborhood: "Harlem",
    walkMinutes: 10,
    verifiedDaysAgo: 5,
    isOpen: true,
    closesAt: "6PM",
    services: ["Food", "Groceries"],
    beds: 0,
    description:
      "Weekly food distribution providing groceries and prepared meals to families and individuals in need. No documentation required.",
    eligibility: [
      "All residents welcome",
      "No ID required",
    ],
  },
  {
    id: "brooklyn-legal-aid",
    name: "Brooklyn Legal Aid Society",
    neighborhood: "Brooklyn",
    walkMinutes: 20,
    verifiedDaysAgo: 10,
    isOpen: true,
    closesAt: "5PM",
    services: ["Legal aid", "Housing court", "Benefits"],
    beds: 0,
    description:
      "Free legal assistance for low-income residents facing housing, family, and immigration matters.",
    eligibility: [
      "Income below 200% federal poverty line",
      "NYC resident",
    ],
  },
  {
    id: "queens-workforce",
    name: "Queens Workforce Center",
    neighborhood: "Queens",
    walkMinutes: 15,
    verifiedDaysAgo: 21,
    isOpen: true,
    closesAt: "7PM",
    services: ["Job training", "Resume help", "Employment placement"],
    beds: 0,
    description:
      "Free job training and employment services including resume workshops, interview prep, and job placement assistance.",
    eligibility: [
      "18+ yrs old",
      "Currently unemployed or underemployed",
      "NYC resident",
    ],
  },
  {
    id: "lower-east-care",
    name: "Lower East Side Care Center",
    neighborhood: "Lower East Side",
    walkMinutes: 6,
    verifiedDaysAgo: 3,
    isOpen: true,
    closesAt: "8PM",
    services: ["Personal care", "Hygiene supplies", "Showers"],
    beds: 0,
    description:
      "Drop-in center offering showers, hygiene supplies, laundry, and personal care services to individuals experiencing homelessness.",
    eligibility: [
      "Walk-in welcome",
      "No ID required",
    ],
  },
];

// Lookup map for quick service resolution by name
export const SERVICE_BY_NAME: Record<string, Service> = Object.fromEntries(
  MOCK_SERVICES.map((s) => [s.name.toLowerCase(), s])
);
