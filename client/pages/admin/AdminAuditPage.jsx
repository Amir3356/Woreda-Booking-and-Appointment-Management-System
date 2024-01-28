"use client";

import { ShieldCheck, Clock, Lock } from "lucide-react";

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="w-full text-center min-h-[48px] flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-slate-900">Audit</h2>
        <p className="text-xs text-slate-500 mt-1">
          Cryptographically timestamped audit log of all security events, status transitions, and administrative actions.
        </p>
      </div>

      {/* Main Content Section - Coming Soon */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-16 text-center max-w-2xl mx-auto my-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
          <ShieldCheck className="w-8 h-8 text-[#0b2545]" />
        </div>

        <div className="mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Coming Soon
          </span>
        </div>

        <h3 className="text-lg font-extrabold text-slate-900 mb-2">
          Audit Logging Under Development
        </h3>

        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto mb-6">
          The Woreda immutable audit trail and security compliance records module is currently being finalized. This section will soon provide tamper-evident logs for all administrative events, user permissions, and booking updates.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-4 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
            Security Event Logs
          </span>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
            Role Transition Records
          </span>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
            Cryptographic Verification
          </span>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
            Compliance Exports
          </span>
        </div>
      </div>
    </div>
  );
}
