"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Building2,
  FileCheck2,
  TrendingUp,
  Percent,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminReportsPage() {
  const { appointments, departments, services } = useStore();
  const [reportPeriod, setReportPeriod] = useState("THIS_MONTH");

  const total = appointments.length;
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const noShow = appointments.filter((a) => a.status === "NO_SHOW").length;
  const cancelled = appointments.filter((a) => a.status === "CANCELLED").length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;

  const handleExportCSV = () => {
    const headers = ["ReferenceNumber,CitizenName,Phone,Department,Service,Date,TimeSlot,Status\n"];
    const rows = appointments.map((a) =>
      `"${a.referenceNumber}","${a.citizenName}","${a.citizenPhone}","${a.departmentName}","${a.serviceName}","${a.date}","${a.timeSlot}","${a.status}"`
    );
    const blob = new Blob([headers.concat(rows.join("\n"))], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `woreda_appointment_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reports & Analytics Export</h2>
          <p className="text-xs text-slate-500">
            Generate and export department operational reports, service throughput, and citizen attendance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            <span>Export CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Total Appointments</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
          <span className="text-[10px] text-slate-500">100% recorded bookings</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Service Completion Rate</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{completionRate}%</p>
          <span className="text-[10px] text-emerald-700 font-medium">Successfully delivered</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Citizen No-Show Rate</span>
          <p className="text-2xl font-bold text-rose-600 mt-1">{noShowRate}%</p>
          <span className="text-[10px] text-slate-400">Did not attend desk</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Avg. Processing Speed</span>
          <p className="text-2xl font-bold text-blue-700 mt-1">18 mins</p>
          <span className="text-[10px] text-blue-600 font-medium">Target: &lt; 25 mins</span>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Department Performance Benchmark</h3>
          <span className="text-[11px] text-slate-400">Aggregated Woreda metrics</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Total Requests</th>
                <th className="px-5 py-3">Completed</th>
                <th className="px-5 py-3">Pending</th>
                <th className="px-5 py-3">Cancelled / No Show</th>
                <th className="px-5 py-3 text-right">Fulfillment Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((dept) => {
                const deptApts = appointments.filter((a) => a.departmentId === dept.id);
                const dComp = deptApts.filter((a) => a.status === "COMPLETED").length;
                const dPend = deptApts.filter((a) => a.status === "PENDING").length;
                const dMiss = deptApts.filter(
                  (a) => a.status === "CANCELLED" || a.status === "NO_SHOW"
                ).length;
                const dRate = deptApts.length > 0 ? Math.round((dComp / deptApts.length) * 100) : 100;

                return (
                  <tr key={dept.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{dept.name}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{deptApts.length}</td>
                    <td className="px-5 py-3.5 text-emerald-700 font-semibold">{dComp}</td>
                    <td className="px-5 py-3.5 text-amber-600 font-semibold">{dPend}</td>
                    <td className="px-5 py-3.5 text-rose-600 font-semibold">{dMiss}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 font-mono">
                        {dRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
