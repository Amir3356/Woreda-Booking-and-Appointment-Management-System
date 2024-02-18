import { Clock } from "lucide-react";

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="w-full text-center min-h-[48px] flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-slate-900">Audit</h2>
      </div>

      {/* Main Content Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-16 text-center max-w-xl mx-auto my-6 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-xs">
          <Clock className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Coming Soon</h3>
      </div>
    </div>
  );
}
