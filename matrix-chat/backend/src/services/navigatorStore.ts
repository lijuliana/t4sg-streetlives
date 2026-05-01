import { randomUUID } from "node:crypto";
import type {
  NavigatorProfile,
  NavGroup,
  NavigatorStatus,
  CreateNavigatorProfileRequest,
  UpdateNavigatorProfileRequest,
} from "../types.js";

export interface NavigatorStoreInterface {
  create(data: CreateNavigatorProfileRequest): NavigatorProfile;
  findById(id: string): NavigatorProfile | undefined;
  findByUserId(userId: string): NavigatorProfile | undefined;
  update(id: string, data: UpdateNavigatorProfileRequest): NavigatorProfile | undefined;
  list(): NavigatorProfile[];
}

const DEFAULT_CAPACITY = 5;
const DEFAULT_STATUS: NavigatorStatus = "available";

class InMemoryNavigatorStore implements NavigatorStoreInterface {
  private readonly navigators = new Map<string, NavigatorProfile>();

  create(data: CreateNavigatorProfileRequest): NavigatorProfile {
    const now = new Date().toISOString();
    const profile: NavigatorProfile = {
      id: randomUUID(),
      userId: data.userId,
      firstName: data.firstName,
      lastName: data.lastName,
      navGroup: data.navGroup,
      expertiseTags: data.expertiseTags ?? [],
      languages: (data.languages ?? ["en"]).map((l) => l.toLowerCase()),
      capacity: data.capacity ?? DEFAULT_CAPACITY,
      status: data.status ?? DEFAULT_STATUS,
      isGeneralIntake: data.isGeneralIntake ?? false,
      availabilitySchedule: data.availabilitySchedule,
      createdAt: now,
      updatedAt: now,
    };
    this.navigators.set(profile.id, profile);
    return profile;
  }

  findById(id: string): NavigatorProfile | undefined {
    return this.navigators.get(id);
  }

  findByUserId(userId: string): NavigatorProfile | undefined {
    return Array.from(this.navigators.values()).find((n) => n.userId === userId);
  }

  update(id: string, data: UpdateNavigatorProfileRequest): NavigatorProfile | undefined {
    const profile = this.navigators.get(id);
    if (!profile) return undefined;
    if (data.firstName !== undefined) profile.firstName = data.firstName;
    if (data.lastName !== undefined) profile.lastName = data.lastName;
    if (data.navGroup !== undefined) profile.navGroup = data.navGroup;
    if (data.expertiseTags !== undefined) profile.expertiseTags = data.expertiseTags;
    if (data.languages !== undefined) profile.languages = data.languages.map((l) => l.toLowerCase());
    if (data.capacity !== undefined) profile.capacity = data.capacity;
    if (data.status !== undefined) profile.status = data.status;
    if (data.isGeneralIntake !== undefined) profile.isGeneralIntake = data.isGeneralIntake;
    if (data.availabilitySchedule !== undefined) profile.availabilitySchedule = data.availabilitySchedule;
    profile.updatedAt = new Date().toISOString();
    return profile;
  }

  list(): NavigatorProfile[] {
    return Array.from(this.navigators.values());
  }
}

export const navigatorStore: NavigatorStoreInterface = new InMemoryNavigatorStore();
