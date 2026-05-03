"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  children: React.ReactNode[];
  initialCount?: number;
}

export default function ShowMoreList({ children, initialCount = 3 }: Props) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? children : children.slice(0, initialCount);
  const hidden = children.length - initialCount;

  return (
    <div className="space-y-2">
      {visible}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-2 border border-dashed border-gray-200 rounded-xl transition hover:border-gray-300"
        >
          <ChevronDown size={13} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}
