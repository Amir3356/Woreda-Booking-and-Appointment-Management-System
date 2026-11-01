"use client";

import { APPOINTMENT_STATUS_CONFIG } from "@/lib/utils";

export default function StatusBadge({ status, className = "" }) {
  const config = APPOINTMENT_STATUS_CONFIG[status] || {
    label: status || "Unknown",
    bg: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
