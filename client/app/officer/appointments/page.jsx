"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import StatusBadge from "@/components/shared/StatusBadge";
import AppointmentSlip from "@/components/shared/AppointmentSlip";
import { formatDate } from "@/lib/utils";
import {
  Calendar,
  Search,
  Filter,
  Check,
  X,
  RefreshCw,
  Printer,
  CheckCircle2,
  Eye,
} from "lucide-react";

export default function OfficerAppointmentsPage() {
  const {
    currentUser,
    appointments,
    services,
    updateAppointmentStatus,
    rescheduleAppointment,
  } = useStore();

  const officerDeptId = currentUser?.departmentId || "dept-1";
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedSlipApt, setSelectedSlipApt] = useState(null);

  const deptAppointments = appointments.filter((a) => a.departmentId === officerDeptId);

  const filtered = deptAppointments.filter((a) => {
    const matchesSearch =
      a.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      a.citizenName.toLowerCase().includes(search.toLowerCase()) ||
      a.citizenPhone.includes(search);
    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {currentUser?.departmentName || "Department"} Appointments
          </h2>
          <p className="text-xs text-slate-500">
            Review requests, approve bookings, and process citizens arriving at your office.
          </p>
        </div>

        <span className="text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold shadow-xs">
          Total Assigned: {deptAppointments.length}
        </span>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search citizen, reference number..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Reference #</th>
                <th className="px-5 py-3">Citizen Name</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Date & Slot</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Desk Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No appointments found matching this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      <div>{apt.referenceNumber}</div>
                      {apt.tokenNumber && (
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          Token: {apt.tokenNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div>{apt.citizenName}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{apt.citizenPhone}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">{apt.serviceName}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <div>{formatDate(apt.date)}</div>
                      <span className="text-[10px] text-blue-700 font-bold">{apt.timeSlot}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSlipApt(apt)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                          title="View Slip"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {apt.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => updateAppointmentStatus(apt.id, "APPROVED", "Approved by desk officer")}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateAppointmentStatus(apt.id, "REJECTED", "", "Paperwork incomplete")}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {apt.status === "APPROVED" && (
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, "CHECKED_IN")}
                            className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs"
                          >
                            Check In
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Modal */}
      {selectedSlipApt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative max-w-2xl w-full">
            <button
              onClick={() => setSelectedSlipApt(null)}
              className="absolute -top-10 right-0 text-white font-bold text-xs bg-slate-800 px-3 py-1.5 rounded-lg no-print"
            >
              ✕ Close
            </button>
            <AppointmentSlip
              appointment={selectedSlipApt}
              service={services.find((s) => s.id === selectedSlipApt.serviceId)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
