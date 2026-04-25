"use client";

import { useParams, useSearchParams } from "next/navigation";
import { MapPin, Clock, ShieldCheck, Bed } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { MOCK_SERVICES } from "@/lib/mockData";

export default function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const searchParams = useSearchParams();
  const backHref = searchParams.get("back") ?? "/chat";
  const service = MOCK_SERVICES.find((s) => s.id === serviceId);

  if (!service) {
    return (
      <DashboardShell title="Service Not Found" backHref={backHref}>
        <p className="text-sm text-gray-500">This service could not be found.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={service.name} backHref={backHref}>
      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-3">
        <div>
          <h1 className="text-lg font-normal text-gray-900 underline">{service.name}</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={12} />
              {service.neighborhood} · {service.walkMinutes} min walk
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <ShieldCheck size={12} />
              Peer-verified {service.verifiedDaysAgo} days ago
            </span>
          </div>
        </div>

        {/* Open/Closed status */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-normal px-2.5 py-1 rounded-full ${
              service.isOpen
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            {service.isOpen ? "Open" : "Closed"}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} />
            Closes at {service.closesAt}
          </span>
        </div>
      </div>

      {/* Services offered */}
      <div>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
          Services
        </h2>
        <div className="flex flex-wrap gap-2">
          {service.services.map((s) => (
            <span
              key={s}
              className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Beds */}
      {service.beds > 0 && (
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4 flex items-center gap-2">
          <Bed size={16} className="text-gray-400 flex-shrink-0" />
          <p className="text-sm text-gray-700">
            <span className="font-normal">{service.beds}</span> beds available
          </p>
        </div>
      )}

      {/* Description */}
      <div>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
          About
        </h2>
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4">
          <p className="text-sm text-gray-700 leading-relaxed">{service.description}</p>
        </div>
      </div>

      {/* Eligibility */}
      <div>
        <h2 className="text-xs font-normal text-gray-500 uppercase tracking-wide mb-2">
          Eligibility
        </h2>
        <div className="bg-white border border-gray-200 rounded-md px-5 py-4 space-y-2">
          {service.eligibility.map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-brand-yellow font-medium text-sm leading-none mt-0.5">•</span>
              <p className="text-sm text-gray-700">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Action links */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Pre-intake Form" },
          { label: "Call" },
          { label: "Get Directions" },
          { label: "Save / Share" },
        ].map(({ label }) => (
          <button
            key={label}
            type="button"
            className="bg-white border border-gray-200 rounded-md px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition text-center"
          >
            {label}
          </button>
        ))}
      </div>
    </DashboardShell>
  );
}
