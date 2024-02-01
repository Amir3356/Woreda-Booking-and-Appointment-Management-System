"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Search, Filter } from "lucide-react";

export default function AdminAuditLogsPage() {
  const { auditLogs } = useStore();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const filteredLogs = (auditLogs || []).filter((log) => {
    const matchesSearch =
      log.userName?.toLowerCase().includes(search.toLowerCase()) ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "ALL" || log.action?.includes(actionFilter);
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="w-full text-center min-h-[48px] flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-slate-900">Audit</h2>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, actor, entity..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE_BOOKING">Booking Creation</option>
            <option value="STATUS">Status Transitions</option>
            <option value="APPROVE">Approvals</option>
            <option value="SCHEDULE">Schedule Updates</option>
            <option value="LOGIN">User Logins</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Timestamp (UTC)</th>
                <th className="px-5 py-3">Actor / Role</th>
                <th className="px-5 py-3">Action Type</th>
                <th className="px-5 py-3">Target Entity</th>
                <th className="px-5 py-3">Operation Details</th>
                <th className="px-5 py-3 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 font-sans font-bold text-slate-900">
                    <div>{log.userName}</div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-bold text-blue-700">{log.action}</td>
                  <td className="px-5 py-3 text-slate-800">{log.entity}</td>
                  <td className="px-5 py-3 font-sans text-slate-600 max-w-sm truncate">
                    {log.details}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
