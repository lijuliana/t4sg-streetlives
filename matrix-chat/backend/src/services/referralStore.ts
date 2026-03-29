import { randomUUID } from "node:crypto";
import type { Referral } from "../types.js";

interface ReferralStoreInterface {
  create(data: Omit<Referral, "referralId" | "createdAt">): Referral;
  listBySession(sessionId: string): Referral[];
}

class InMemoryReferralStore implements ReferralStoreInterface {
  private readonly referrals = new Map<string, Referral[]>();

  create(data: Omit<Referral, "referralId" | "createdAt">): Referral {
    const referral: Referral = {
      ...data,
      referralId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const list = this.referrals.get(data.sessionId) ?? [];
    list.push(referral);
    this.referrals.set(data.sessionId, list);
    return referral;
  }

  listBySession(sessionId: string): Referral[] {
    return this.referrals.get(sessionId) ?? [];
  }
}

export const referralStore: ReferralStoreInterface = new InMemoryReferralStore();
