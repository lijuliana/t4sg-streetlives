/**
 * Dev/test seed data for navigator profiles.
 *
 * Loaded automatically when NODE_ENV=development or SEED_NAVIGATORS=true.
 *
 * Pool design:
 *   - 3 general-intake navigators (eligible for initial session assignment)
 *     covering English, Spanish, and Mandarin
 *   - 3 specialist navigators (available for transfer but not initial assignment)
 *   - Varied nav_groups (stored for future routing; not a current filter)
 *   - Varied capacity and status to exercise load balancing
 *
 * All navigators are assumed cross-trained on all need categories.
 */

import { navigatorStore } from "../services/navigatorStore.js";

export function seedNavigators(): void {
  // Guard: skip if already seeded (e.g., hot reload in dev).
  if (navigatorStore.list().length > 0) return;

  const profiles = [
    // ── General-intake navigators (eligible for initial assignment) ───────────

    {
      userId: "@intake-alice:matrix.example.org",
      navGroup: "HOUSING_WORKS" as const,
      expertiseTags: ["intake", "general", "housing", "benefits"],
      languages: ["en", "es"],
      capacity: 6,
      status: "available" as const,
      isGeneralIntake: true,
    },
    {
      userId: "@intake-bob:matrix.example.org",
      navGroup: "DYCD" as const,
      expertiseTags: ["intake", "general", "employment", "youth_services"],
      languages: ["en"],
      capacity: 8,
      status: "available" as const,
      isGeneralIntake: true,
    },
    {
      userId: "@intake-carol:matrix.example.org",
      navGroup: "CUNY_PIN" as const,
      expertiseTags: ["intake", "general", "education"],
      languages: ["en", "zh"],
      capacity: 5,
      status: "available" as const,
      isGeneralIntake: true,
    },

    // ── Specialist navigators (transfer targets only) ─────────────────────────

    {
      userId: "@specialist-diana:matrix.example.org",
      navGroup: "HOUSING_WORKS" as const,
      expertiseTags: ["emergency_housing", "shelter", "eviction_prevention"],
      languages: ["en", "es"],
      capacity: 4,
      status: "available" as const,
      isGeneralIntake: false,
    },
    {
      userId: "@specialist-eve:matrix.example.org",
      navGroup: "DYCD" as const,
      expertiseTags: ["job_training", "resume", "workforce_development"],
      languages: ["en", "zh"],
      capacity: 5,
      status: "away" as const,        // away — excluded from routing
      isGeneralIntake: false,
    },
    {
      userId: "@specialist-frank:matrix.example.org",
      navGroup: "CUNY_PIN" as const,
      expertiseTags: ["college_access", "financial_aid", "transfer_credits"],
      languages: ["en"],
      capacity: 5,
      status: "offline" as const,     // offline — excluded from routing
      isGeneralIntake: false,
    },
  ];

  for (const p of profiles) {
    navigatorStore.create(p);
  }
}
