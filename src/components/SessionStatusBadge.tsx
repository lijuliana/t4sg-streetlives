import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/lib/store";

const STATUS_STYLES: Record<SessionStatus, string> = {
  queued: "bg-gray-100 text-gray-500",
  active: "bg-green-100 text-green-700",
  closed: "bg-gray-200 text-gray-400",
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  queued: "Queued",
  active: "Active",
  closed: "Closed",
};

interface Props {
  status: SessionStatus;
  size?: "sm" | "md";
}

export default function SessionStatusBadge({ status, size = "md" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
