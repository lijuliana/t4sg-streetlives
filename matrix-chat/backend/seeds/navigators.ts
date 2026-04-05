/**
 * Dev/test seed data for navigator profiles.
 *
 * Loaded automatically when NODE_ENV=development or SEED_NAVIGATORS=true.
 * Provides a representative set of navigators across all three nav_groups
 * so routing can be exercised without manual setup.
 */

import { navigatorStore } from "../src/services/navigatorStore.js";

export function seedNavigators(): void {
  // Guard: skip if already seeded (e.g., hot reload)
  if (navigatorStore.list().length > 0) return;

  const profiles = [
    {
      userId: "@alice-hw:matrix.example.org",
      navGroup: "HOUSING_WORKS" as const,
      expertiseTags: ["emergency_housing", "shelter", "housing_vouchers", "eviction_prevention"],
      languages: ["en", "es"],
      capacity: 5,
      status: "available" as const,
    },
    {
      userId: "@bob-hw:matrix.example.org",
      navGroup: "HOUSING_WORKS" as const,
      expertiseTags: ["transitional_housing", "supportive_housing", "benefits"],
      languages: ["en"],
      capacity: 4,
      status: "available" as const,
    },
    {
      userId: "@carol-dycd:matrix.example.org",
      navGroup: "DYCD" as const,
      expertiseTags: ["employment", "job_training", "resume", "youth_services"],
      languages: ["en", "es"],
      capacity: 8,
      status: "available" as const,
    },
    {
      userId: "@diana-dycd:matrix.example.org",
      navGroup: "DYCD" as const,
      expertiseTags: ["youth_services", "after_school", "summer_programs"],
      languages: ["en", "zh"],
      capacity: 6,
      status: "away" as const,
    },
    {
      userId: "@eve-cuny:matrix.example.org",
      navGroup: "CUNY_PIN" as const,
      expertiseTags: ["education", "college_access", "financial_aid", "youth_services"],
      languages: ["en", "zh"],
      capacity: 6,
      status: "available" as const,
    },
    {
      userId: "@frank-cuny:matrix.example.org",
      navGroup: "CUNY_PIN" as const,
      expertiseTags: ["education", "transfer_credits", "vocational_training"],
      languages: ["en"],
      capacity: 5,
      status: "offline" as const,
    },
  ];

  for (const p of profiles) {
    navigatorStore.create(p);
  }
}
