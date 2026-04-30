"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore, REFERRAL_CATEGORIES, profileToNavigator } from "@/lib/store";
import type { NavigatorProfile, ReferralCategory } from "@/lib/store";
import { cn } from "@/lib/utils";

const COMMON_LANGUAGES = [
  "English", "Spanish", "Mandarin", "Cantonese", "Russian",
  "French", "Haitian Creole", "Bengali", "Arabic", "Korean",
  "Polish", "Urdu", "Italian", "Vietnamese", "Tagalog",
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KNOWN_NAV_GROUPS: { value: string; label: string }[] = [
  { value: "CUNY_PIN", label: "CUNY PIN" },
  { value: "HOUSING_WORKS", label: "Housing Works" },
  { value: "DYCD", label: "DYCD" },
];

interface FormValues {
  first_name: string;
  last_name: string;
  nav_group: string;
  custom_nav_group: string;
  capacity: number;
}

interface Props {
  initialProfile: NavigatorProfile | null;
  auth0UserId: string;
}

export default function NavigatorProfileForm({ initialProfile, auth0UserId }: Props) {
  const router = useRouter();
  const setOwnProfile = useStore((s) => s.setOwnProfile);
  const setNavigators = useStore((s) => s.setNavigators);
  const navigators = useStore((s) => s.navigators);

  // Determine if the saved nav_group is a known one or custom
  const savedGroup = initialProfile?.nav_group ?? "";
  const isKnownGroup = KNOWN_NAV_GROUPS.some((g) => g.value === savedGroup);

  const [languages, setLanguages] = useState<string[]>(initialProfile?.languages ?? []);
  const [otherLangInput, setOtherLangInput] = useState("");
  const [showOtherLang, setShowOtherLang] = useState(false);

  const [specialties, setSpecialties] = useState<ReferralCategory[]>(
    (initialProfile?.expertise_tags as ReferralCategory[]) ?? []
  );

  const [availabilitySchedule, setAvailabilitySchedule] = useState<
    Record<string, { start: string; end: string }>
  >(initialProfile?.availability_schedule ?? {});

  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      first_name: initialProfile?.first_name ?? "",
      last_name: initialProfile?.last_name ?? "",
      nav_group: isKnownGroup ? savedGroup : (savedGroup ? "__other__" : ""),
      custom_nav_group: isKnownGroup ? "" : savedGroup,
      capacity: initialProfile?.capacity ?? 5,
    },
  });

  const navGroupValue = watch("nav_group");

  const toggleLanguage = (lang: string) =>
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );

  const addOtherLanguage = () => {
    const trimmed = otherLangInput.trim();
    if (trimmed && !languages.includes(trimmed)) {
      setLanguages((prev) => [...prev, trimmed]);
    }
    setOtherLangInput("");
    setShowOtherLang(false);
  };

  const removeLanguage = (lang: string) =>
    setLanguages((prev) => prev.filter((l) => l !== lang));

  const toggleSpecialty = (cat: ReferralCategory) =>
    setSpecialties((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const toggleDay = (day: string) => {
    setAvailabilitySchedule((prev) => {
      if (prev[day]) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      return { ...prev, [day]: { start: "09:00", end: "17:00" } };
    });
  };

  const updateDayTime = (day: string, field: "start" | "end", value: string) => {
    setAvailabilitySchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const onSubmit = async (data: FormValues) => {
    if (languages.length === 0) {
      toast.error("Select at least one language");
      return;
    }
    if (specialties.length === 0) {
      toast.error("Select at least one area of expertise");
      return;
    }

    const resolvedNavGroup =
      data.nav_group === "__other__"
        ? data.custom_nav_group.trim()
        : data.nav_group;

    if (!resolvedNavGroup) {
      toast.error("Enter your navigator group");
      return;
    }

    const payload = {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      nav_group: resolvedNavGroup,
      auth0_user_id: initialProfile?.auth0_user_id ?? auth0UserId,
      languages,
      expertise_tags: specialties,
      capacity: data.capacity,
      status: "available",
      availability_schedule: availabilitySchedule,
    };

    setSubmitting(true);

    try {
      const res = await fetch("/api/navigators/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(err.message ?? err.error ?? `Request failed (${res.status})`);
      }

      const profile: NavigatorProfile = await res.json();
      setOwnProfile(profile);

      const nav = profileToNavigator(profile);
      setNavigators(
        initialProfile
          ? navigators.map((n) => (n.id === nav.id ? nav : n))
          : [...navigators.filter((n) => n.id !== nav.id), nav]
      );

      toast.success("Profile saved");
      router.push("/dashboard/navigator");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // Custom languages are those not in the standard list
  const customLanguages = languages.filter((l) => !COMMON_LANGUAGES.includes(l));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">

      {/* First name + Last name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            First name
          </label>
          <input
            {...register("first_name", { required: "First name is required" })}
            placeholder="Jane"
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400"
          />
          {errors.first_name && (
            <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Last name
          </label>
          <input
            {...register("last_name", { required: "Last name is required" })}
            placeholder="Smith"
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400"
          />
          {errors.last_name && (
            <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      {/* Navigator group */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Navigator group
        </label>
        <select
          {...register("nav_group", { required: "Group is required" })}
          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow bg-white"
        >
          <option value="">Select a group…</option>
          {KNOWN_NAV_GROUPS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
          <option value="__other__">Other…</option>
        </select>
        {errors.nav_group && (
          <p className="mt-1 text-xs text-red-500">{errors.nav_group.message}</p>
        )}
        {navGroupValue === "__other__" && (
          <input
            {...register("custom_nav_group")}
            placeholder="Enter your group name"
            className="mt-2 w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400"
          />
        )}
      </div>

      {/* Languages */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Languages{" "}
          <span className="text-gray-400 font-normal">(select all you speak)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {COMMON_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggleLanguage(lang)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition",
                languages.includes(lang)
                  ? "bg-brand-yellow border-brand-yellow text-gray-900 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {lang}
            </button>
          ))}
          {/* Custom languages added via Other */}
          {customLanguages.map((lang) => (
            <span
              key={lang}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border bg-brand-yellow border-brand-yellow text-gray-900 font-medium"
            >
              {lang}
              <button
                type="button"
                onClick={() => removeLanguage(lang)}
                className="ml-0.5 text-gray-600 hover:text-gray-900"
                aria-label={`Remove ${lang}`}
              >
                ×
              </button>
            </span>
          ))}
          {/* Other pill */}
          <button
            type="button"
            onClick={() => setShowOtherLang((v) => !v)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition",
              showOtherLang
                ? "bg-gray-100 border-gray-300 text-gray-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            )}
          >
            + Other
          </button>
        </div>
        {showOtherLang && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={otherLangInput}
              onChange={(e) => setOtherLangInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOtherLanguage(); } }}
              placeholder="Language name"
              className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-yellow placeholder-gray-400"
              autoFocus
            />
            <button
              type="button"
              onClick={addOtherLanguage}
              className="text-xs px-4 py-2 rounded-md bg-brand-yellow text-gray-900 font-medium hover:brightness-95 transition"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Areas of expertise */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Areas of expertise{" "}
          <span className="text-gray-400 font-normal">(used for routing)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {REFERRAL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleSpecialty(cat)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition",
                specialties.includes(cat)
                  ? "bg-brand-yellow border-brand-yellow text-gray-900 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Max concurrent sessions */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Max concurrent sessions
        </label>
        <input
          type="number"
          min={1}
          max={20}
          {...register("capacity", {
            required: true,
            valueAsNumber: true,
            min: 1,
            max: 20,
          })}
          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-yellow"
        />
      </div>

      {/* Availability — per-day time slots */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Availability{" "}
          <span className="text-gray-400 font-normal">(select days and set hours)</span>
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition",
                availabilitySchedule[day]
                  ? "bg-brand-yellow border-brand-yellow text-gray-900 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {day}
            </button>
          ))}
        </div>
        {/* Time rows for each selected day, in order */}
        {DAYS_OF_WEEK.filter((day) => availabilitySchedule[day]).length > 0 && (
          <div className="space-y-2">
            {DAYS_OF_WEEK.filter((day) => availabilitySchedule[day]).map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-600 w-8 flex-shrink-0">{day}</span>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={availabilitySchedule[day].start}
                    onChange={(e) => updateDayTime(day, "start", e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-yellow"
                  />
                  <span className="text-gray-400 text-xs">to</span>
                  <input
                    type="time"
                    value={availabilitySchedule[day].end}
                    onChange={(e) => updateDayTime(day, "end", e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-brand-yellow"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-brand-yellow text-gray-900 font-medium text-sm py-3 rounded-md hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting
          ? "Saving…"
          : initialProfile
          ? "Save changes"
          : "Complete setup"}
      </button>
    </form>
  );
}
