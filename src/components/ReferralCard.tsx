"use client";

import { useStore, REFERRAL_STATUS_STYLES, REFERRAL_STATUS_LABELS, REFERRAL_STATUSES } from "@/lib/store";
import type { Referral, ReferralStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  referral: Referral;
  editable?: boolean;
}

export default function ReferralCard({ referral, editable = false }: Props) {
  const updateReferralStatus = useStore((s) => s.updateReferralStatus);

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{referral.serviceName}</p>
          <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {referral.category}
          </span>
        </div>

        {editable ? (
          <select
            aria-label="Referral status"
            value={referral.status}
            onChange={(e) =>
              updateReferralStatus(referral.id, e.target.value as ReferralStatus)
            }
            className={cn(
              "text-xs font-medium rounded-lg px-2.5 py-1 border-none outline-none cursor-pointer flex-shrink-0 appearance-none",
              REFERRAL_STATUS_STYLES[referral.status]
            )}
          >
            {REFERRAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REFERRAL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={cn(
              "text-xs font-medium rounded-full px-2.5 py-1 flex-shrink-0",
              REFERRAL_STATUS_STYLES[referral.status]
            )}
          >
            {REFERRAL_STATUS_LABELS[referral.status]}
          </span>
        )}
      </div>

      {referral.notes && (
        <p className="text-xs text-gray-500 italic">{referral.notes}</p>
      )}
    </div>
  );
}
