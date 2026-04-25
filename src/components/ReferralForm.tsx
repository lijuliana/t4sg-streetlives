"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Search } from "lucide-react";
import { toast } from "sonner";
import { useStore, REFERRAL_STATUSES, REFERRAL_STATUS_LABELS, REFERRAL_CATEGORIES } from "@/lib/store";
import type { ReferralCategory, ReferralStatus } from "@/lib/store";
import { MOCK_SERVICES } from "@/lib/mockData";
import type { Service } from "@/lib/mockData";
import { cn } from "@/lib/utils";

function mapServiceToCategory(services: string[]): ReferralCategory {
  const joined = services.join(" ").toLowerCase();
  if (/shelter|housing/.test(joined)) return "Accommodations";
  if (/food|meal|grocer/.test(joined)) return "Food";
  if (/medical|health|dental|care/.test(joined)) return "Health";
  if (/legal|court|benefit/.test(joined)) return "Legal";
  if (/job|work|employ|resume|training/.test(joined)) return "Work";
  if (/hygiene|personal|shower/.test(joined)) return "Personal Care";
  if (/family|child/.test(joined)) return "Family Services";
  return "Other";
}

interface FormValues {
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

  const [search, setSearch] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [locationFilter, setLocationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<ReferralCategory | "all">("all");

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { status: "shared", notes: "" },
  });

  const neighborhoods = useMemo(
    () => ["all", ...Array.from(new Set(MOCK_SERVICES.map((s) => s.neighborhood))).sort()],
    []
  );

  const filtered = MOCK_SERVICES.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchLocation = locationFilter === "all" || s.neighborhood === locationFilter;
    const matchCategory = categoryFilter === "all" || mapServiceToCategory(s.services) === categoryFilter;
    return matchSearch && matchLocation && matchCategory;
  });

  const onSubmit = (data: FormValues) => {
    if (!selectedService) return;
    addReferral(sessionId, {
      serviceName: selectedService.name,
      category: mapServiceToCategory(selectedService.services),
      status: data.status,
      notes: data.notes || undefined,
    });
    addChatMessage(sessionId, {
      role: "navigator",
      content: selectedService.name,
      serviceId: selectedService.id,
    });
    toast.success("Referral added");
    reset();
    setSelectedService(null);
    setSearch("");
    setLocationFilter("all");
    setCategoryFilter("all");
    onClose();
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      reset();
      setSelectedService(null);
      setSearch("");
      setLocationFilter("all");
      setCategoryFilter("all");
      onClose();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-md shadow-xl p-6 focus:outline-none">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-normal text-gray-900">
              Create Referral
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="text-gray-400 hover:text-gray-700 transition" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedService(null); }}
                placeholder="Search for services..."
                className="w-full text-sm border border-gray-200 rounded-md pl-3 pr-9 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400"
              />
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <select
                  aria-label="Filter by location"
                  value={locationFilter}
                  onChange={(e) => { setLocationFilter(e.target.value); setSelectedService(null); }}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
                >
                  <option value="all">All neighborhoods</option>
                  {neighborhoods.filter((n) => n !== "all").map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value as ReferralCategory | "all"); setSelectedService(null); }}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
                >
                  <option value="all">All categories</option>
                  {REFERRAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Results {filtered.length > 0 && `(${filtered.length})`}
              </p>
              <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-md border border-gray-200 p-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No services match your filters</p>
                ) : (
                  filtered.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedService(service)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-md border transition",
                        selectedService?.id === service.id
                          ? "border-brand-yellow bg-brand-yellow/10"
                          : "border-transparent hover:bg-gray-50"
                      )}
                    >
                      <p className="text-sm font-medium text-gray-900">{service.name}</p>
                      <p className="text-xs text-gray-500">{service.neighborhood}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                {...register("status")}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
              >
                {REFERRAL_STATUSES.map((s) => (
                  <option key={s} value={s}>{REFERRAL_STATUS_LABELS[s]}</option>
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
                rows={2}
                placeholder="Any details the client should know..."
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!selectedService}
              className="w-full bg-brand-yellow text-gray-900 font-medium text-sm py-3 rounded-md hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send to Chat
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
