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
import type { AvailabilitySchedule, CreateNavigatorProfileRequest } from "../types.js";

export function seedNavigators(): void {
  // Guard: skip if already seeded (e.g., hot reload in dev).
  if (navigatorStore.list().length > 0) return;

  const weekdays: AvailabilitySchedule = {
    Mon: { start: "09:00", end: "17:00" },
    Tue: { start: "09:00", end: "17:00" },
    Wed: { start: "09:00", end: "17:00" },
    Thu: { start: "09:00", end: "17:00" },
    Fri: { start: "09:00", end: "17:00" },
  };

  const profiles: CreateNavigatorProfileRequest[] = [
    // ── General-intake navigators (eligible for initial assignment) ───────────

    {
      userId: "@intake-alice:matrix.example.org",
      firstName: "Alice",
      lastName: "Reyes",
      navGroup: "HOUSING_WORKS" as const,
      expertiseTags: ["intake", "general", "housing", "benefits", "health"],
      languages: ["en", "es"],
      capacity: 6,
      status: "available" as const,
      isGeneralIntake: true,
      availabilitySchedule: weekdays,
    },
    {
      userId: "@intake-bob:matrix.example.org",
      firstName: "Bob",
      lastName: "Chen",
      navGroup: "DYCD" as const,
      expertiseTags: ["intake", "general", "employment", "youth_services", "education"],
      languages: ["en"],
      capacity: 8,
      status: "available" as const,
      isGeneralIntake: true,
      availabilitySchedule: {
        Mon: { start: "10:00", end: "18:00" },
        Tue: { start: "10:00", end: "18:00" },
        Wed: { start: "10:00", end: "18:00" },
        Thu: { start: "10:00", end: "18:00" },
        Fri: { start: "10:00", end: "16:00" },
      },
    },
    {
      userId: "@intake-carol:matrix.example.org",
      firstName: "Carol",
      lastName: "Park",
      navGroup: "CUNY_PIN" as const,
      expertiseTags: ["intake", "general", "education", "youth_services", "benefits"],
      languages: ["en", "zh"],
      capacity: 5,
      status: "available" as const,
      isGeneralIntake: true,
      availabilitySchedule: {
        Mon: { start: "09:00", end: "17:00" },
        Tue: { start: "09:00", end: "17:00" },
        Wed: { start: "09:00", end: "17:00" },
        Thu: { start: "09:00", end: "17:00" },
        Fri: { start: "09:00", end: "17:00" },
        Sat: { start: "09:00", end: "13:00" },
      },
    },

    // ── Specialist navigators (transfer targets only) ─────────────────────────

    {
      userId: "@specialist-diana:matrix.example.org",
      firstName: "Diana",
      lastName: "Okafor",
      navGroup: "HOUSING_WORKS" as const,
      expertiseTags: ["housing", "emergency_housing", "shelter", "eviction_prevention"],
      languages: ["en", "es"],
      capacity: 4,
      status: "available" as const,
      isGeneralIntake: false,
      availabilitySchedule: weekdays,
    },
    {
      userId: "@specialist-eve:matrix.example.org",
      firstName: "Eve",
      lastName: "Huang",
      navGroup: "DYCD" as const,
      expertiseTags: ["employment", "job_training", "resume", "workforce_development"],
      languages: ["en", "zh"],
      capacity: 5,
      status: "away" as const,
      isGeneralIntake: false,
      availabilitySchedule: weekdays,
    },
    {
      userId: "@specialist-frank:matrix.example.org",
      firstName: "Frank",
      lastName: "Santos",
      navGroup: "CUNY_PIN" as const,
      expertiseTags: ["education", "college_access", "financial_aid", "transfer_credits"],
      languages: ["en"],
      capacity: 5,
      status: "offline" as const,
      isGeneralIntake: false,
      availabilitySchedule: {
        Tue: { start: "12:00", end: "20:00" },
        Wed: { start: "12:00", end: "20:00" },
        Thu: { start: "12:00", end: "20:00" },
        Fri: { start: "12:00", end: "20:00" },
        Sat: { start: "10:00", end: "16:00" },
      },
    },
  ];

  for (const p of profiles) {
    navigatorStore.create(p);
  }
}
