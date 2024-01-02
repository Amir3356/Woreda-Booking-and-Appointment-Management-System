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
  XCircle,
  Clock,
  Eye,
} from "lucide-react";

export default function AdminAppointmentsPage() {
  const {
    appointments,
    departments,
    services,
    updateAppointmentStatus,
    rescheduleAppointment,
  } = useStore();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedSlipApt, setSelectedSlipApt] = useState(null);

  // Reject dialog state
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Reschedule dialog state
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00 AM");

  const filtered = appointments.filter((a) => {
    const matchesSearch =
      a.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      a.citizenName.toLowerCase().includes(search.toLowerCase()) ||
      a.citizenPhone.includes(search);
    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    const matchesDept = deptFilter === "ALL" || a.departmentId === deptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const handleApprove = (id) => {
    updateAppointmentStatus(id, "APPROVED", "Approved by Woreda Administrator");
  };

  const handleConfirmReject = () => {
    if (!rejectTargetId) return;
    updateAppointmentStatus(
      rejectTargetId,
      "REJECTED",
      "",
      rejectReason || "Documentation incomplete or slot quota exceeded"
    );
    setRejectTargetId(null);
    setRejectReason("");
  };

  const handleConfirmReschedule = () => {
    if (!rescheduleTarget || !newDate) return;
    rescheduleAppointment(
      rescheduleTarget.id,
      newDate,
      newTime,
      "Administrative desk rescheduling"
    );
    setRescheduleTarget(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">All Woreda Appointments</h2>
          <p className="text-xs text-slate-500">
            Cross-department master registry of all citizen appointments, statuses, and desk allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold shadow-xs">
            Total Records: {appointments.length}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref, citizen, phone..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

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
            <option value="REJECTED">Rejected</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>
      </div>

      {/* Appointments Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Reference #</th>
                <th className="px-5 py-3">Citizen & Contact</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Date & Slot</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No appointments found matching your filter criteria.
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
                    <td className="px-5 py-3.5 text-slate-600">{apt.departmentName}</td>
                    <td className="px-5 py-3.5 text-slate-800 font-medium">{apt.serviceName}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      <div>{formatDate(apt.date)}</div>
                      <span className="text-[10px] text-blue-700 font-semibold">{apt.timeSlot}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedSlipApt(apt)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                          title="View Official Confirmation Slip"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {apt.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleApprove(apt.id)}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Approve Appointment"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setRejectTargetId(apt.id);
                                setRejectReason("");
                              }}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"
                              title="Reject Appointment"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {apt.status !== "COMPLETED" && apt.status !== "CANCELLED" && (
                          <button
                            onClick={() => {
                              setRescheduleTarget(apt);
                              setNewDate(apt.date);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-700 rounded-lg hover:bg-slate-100"
                            title="Reschedule"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
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

      {/* Slip Modal View */}
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

      {/* Rejection Modal with Reason */}
      {rejectTargetId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-2">Reject Appointment Request</h3>
            <p className="text-xs text-slate-500 mb-4">
              Please enter the official reason for rejecting this booking. The citizen will be notified immediately.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Missing required hospital letter, or service temporarily suspended..."
              className="w-full px-3 py-2 border rounded-lg text-xs mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectTargetId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">Reschedule Booking</h3>
            <p className="text-xs text-slate-500 mb-4">
              Assign new date and time for {rescheduleTarget.referenceNumber}.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Slot</label>
                <select
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:30 AM">11:30 AM</option>
                  <option value="14:00 PM">14:00 PM</option>
                  <option value="15:30 PM">15:30 PM</option>
                </select>
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 mt-4">
              <button
                onClick={() => setRescheduleTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReschedule}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow"
              >
                Save Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
