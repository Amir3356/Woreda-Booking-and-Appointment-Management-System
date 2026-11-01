"use client";

import { useStore } from "@/lib/store";
import {
  BarChart3,
  Printer,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function OfficerReportsPage() {
  const { currentUser, appointments } = useStore();

  const officerDeptId = currentUser?.departmentId || "dept-1";
  const deptAppointments = appointments.filter((a) => a.departmentId === officerDeptId);

  const completed = deptAppointments.filter((a) => a.status === "COMPLETED");
  const noShows = deptAppointments.filter((a) => a.status === "NO_SHOW");
  const pending = deptAppointments.filter((a) => a.status === "PENDING");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {currentUser?.departmentName || "Department"} — Daily Desk Report
          </h2>
          <p className="text-xs text-slate-500">
            Performance summary, served consultations log, and no-show audit record.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs no-print"
        >
          <Printer className="w-3.5 h-3.5 text-slate-600" />
          <span>Print Daily Summary</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total Scheduled</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{deptAppointments.length}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Services Delivered</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{completed.length}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Absent / No-Show</span>
          <p className="text-2xl font-black text-rose-600 mt-1">{noShows.length}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase text-slate-400">Avg. Consultation Time</span>
          <p className="text-2xl font-black text-blue-700 mt-1">16 mins</p>
        </div>
      </div>

      {/* Completed Consultations Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Completed Citizen Consultations</h3>
          <span className="text-xs text-slate-400">{completed.length} services fulfilled</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Reference #</th>
                <th className="px-5 py-3">Citizen Name</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Scheduled Slot</th>
                <th className="px-5 py-3">Internal Note</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No completed appointments recorded for today yet.
                  </td>
                </tr>
              ) : (
                completed.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{apt.referenceNumber}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{apt.citizenName}</td>
                    <td className="px-5 py-3.5 text-slate-600">{apt.serviceName}</td>
                    <td className="px-5 py-3.5 text-slate-600">{apt.timeSlot}</td>
                    <td className="px-5 py-3.5 text-slate-500">{apt.officerNotes || "Completed in order"}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-700">COMPLETED</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* No-Show / Absent Log */}
      {noShows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">No-Show / Absent Citizen Log</h3>
            <span className="text-xs text-rose-600 font-bold">{noShows.length} missed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Reference #</th>
                  <th className="px-5 py-3">Citizen Name & Contact</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Scheduled Slot</th>
                  <th className="px-5 py-3 text-right">Desk Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {noShows.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{apt.referenceNumber}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      <div>{apt.citizenName}</div>
                      <span className="text-[10px] text-slate-400">{apt.citizenPhone}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{apt.serviceName}</td>
                    <td className="px-5 py-3.5 text-slate-600">{apt.timeSlot}</td>
                    <td className="px-5 py-3.5 text-right text-rose-700 font-medium">
                      {apt.officerNotes || "Absent after multiple call announcements"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
