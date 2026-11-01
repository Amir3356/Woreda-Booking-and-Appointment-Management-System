"use client";

import { Calendar } from "lucide-react";

export default function AdminSchedulePage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Schedule Management</h2>
        <p className="text-xs text-slate-500">
          Configure official municipal operating days, desk opening hours, time slot intervals, and public holiday blackout dates.
        </p>
      </div>

      {/* Main Content Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-16 text-center text-slate-400">
        <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-xs font-medium text-slate-500">No schedule data available.</p>
      </div>
    </div>
  );
}
