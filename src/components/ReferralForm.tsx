"use client";

import { useForm } from "react-hook-form";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useStore, REFERRAL_CATEGORIES, REFERRAL_STATUSES, REFERRAL_STATUS_LABELS } from "@/lib/store";
import type { ReferralCategory, ReferralStatus } from "@/lib/store";
import { SERVICE_BY_NAME } from "@/lib/mockData";

interface FormValues {
  serviceName: string;
  category: ReferralCategory;
  status: ReferralStatus;
  notes: string;
}

interface Props {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

export default function ReferralForm({ sessionId, open, onClose }: Props) {
  const addReferral = useStore((s) => s.addReferral);
  const addChatMessage = useStore((s) => s.addChatMessage);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { status: "shared", category: "Accommodations", notes: "" },
  });

  const onSubmit = (data: FormValues) => {
    addReferral(sessionId, {
      serviceName: data.serviceName,
      category: data.category,
      status: data.status,
      notes: data.notes || undefined,
    });

    const matched = SERVICE_BY_NAME[data.serviceName.toLowerCase()];
    // Always send a referral card message; serviceId "unlinked" = card with no detail page
    addChatMessage(sessionId, {
      role: "navigator",
      content: data.serviceName,
      serviceId: matched?.id ?? "unlinked",
    });

    toast.success("Referral added");
    reset();
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl p-6 focus:outline-none">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-normal text-gray-900">
              Add Referral
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-700 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Service Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Service Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register("serviceName", { required: "Required" })}
                placeholder="e.g. Hope House Emergency Shelter"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400"
              />
              {errors.serviceName && (
                <p className="text-xs text-red-500 mt-1">{errors.serviceName.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                {...register("category")}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
              >
                {REFERRAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                {...register("status")}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
              >
                {REFERRAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {REFERRAL_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                {...register("notes")}
                rows={3}
                placeholder="Any details the client should know..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-yellow text-gray-900 font-medium text-sm py-3 rounded-xl hover:brightness-95 transition disabled:opacity-50"
            >
              Add Referral
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
