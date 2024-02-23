import { useState } from "react";
import { useStore } from "@/context";
import StatusBadge from "@/components/ui/StatusBadge";
import AppointmentSlip from "@/features/appointments/AppointmentSlip";
import { formatDate } from "@/utils";
import {
  Calendar,
  Search,
  Printer,
  RefreshCw,
  XCircle,
  Clock,
  Building,
  Plus,
} from "lucide-react";
import Link from "@/components/ui/Link";

export default function CitizenAppointmentsPage() {
  const {
    currentUser,
    appointments,
    services,
    updateAppointmentStatus,
    rescheduleAppointment,
  } = useStore();

  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlipApt, setSelectedSlipApt] = useState(null);

  // Reschedule state
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00 AM");

  const myAppointments = appointments.filter(
    (a) => a.citizenId === currentUser?.id || a.citizenPhone === currentUser?.phone
  );

  const filteredAppointments = myAppointments.filter((apt) => {
    const matchesSearch =
      apt.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.departmentName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "ACTIVE") {
      return apt.status === "PENDING" || apt.status === "APPROVED" || apt.status === "CHECKED_IN";
    }
    if (activeTab === "COMPLETED") {
      return apt.status === "COMPLETED";
    }
    if (activeTab === "CANCELLED") {
      return apt.status === "CANCELLED" || apt.status === "REJECTED" || apt.status === "NO_SHOW";
    }
    return true;
  });

  const handleCancel = (id) => {
    if (confirm("Are you sure you want to cancel this appointment request?")) {
      updateAppointmentStatus(id, "CANCELLED", "Cancelled by citizen from dashboard.");
    }
  };

  const handleRescheduleSubmit = () => {
    if (!newDate || !rescheduleTarget) return;
    rescheduleAppointment(rescheduleTarget.id, newDate, newTime, "Rescheduled by citizen");
    setRescheduleTarget(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Government Appointments</h2>
          <p className="text-xs text-slate-500">
            View, track, reschedule, or print appointment slips for your requests.
          </p>
        </div>

        <Link
          href="/book"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-colors"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>Book New Appointment</span>
        </Link>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto">
          {[
            { id: "ALL", label: `All (${myAppointments.length})` },
            {
              id: "ACTIVE",
              label: `Active / Upcoming (${
                myAppointments.filter(
                  (a) => a.status === "PENDING" || a.status === "APPROVED" || a.status === "CHECKED_IN"
                ).length
              })`,
            },
            {
              id: "COMPLETED",
              label: `Completed (${
                myAppointments.filter((a) => a.status === "COMPLETED").length
              })`,
            },
            {
              id: "CANCELLED",
              label: `Cancelled / Others (${
                myAppointments.filter(
                  (a) => a.status === "CANCELLED" || a.status === "REJECTED" || a.status === "NO_SHOW"
                ).length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-[#0b2545] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reference or service..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-900 text-sm">No Appointments Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              There are no records matching your current filter criteria.
            </p>
          </div>
        ) : (
          filteredAppointments.map((apt) => (
            <div
              key={apt.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-black text-sm text-[#0b2545]">
                    {apt.referenceNumber}
                  </span>
                  <StatusBadge status={apt.status} />
                  {apt.tokenNumber && (
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      Token: {apt.tokenNumber}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-sm">{apt.serviceName}</h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    {apt.departmentName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    {formatDate(apt.date)} at {apt.timeSlot}
                  </span>
                </div>

                {apt.officerNotes && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 inline-block mr-2">
                    Officer Note: {apt.officerNotes}
                  </p>
                )}

                {apt.rejectionReason && (
                  <p className="text-[11px] text-rose-800 bg-rose-50 p-2 rounded-lg border border-rose-200 inline-block">
                    Rejection Reason: {apt.rejectionReason}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <button
                  onClick={() => setSelectedSlipApt(apt)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Official Slip</span>
                </button>

                {apt.status !== "COMPLETED" && apt.status !== "CANCELLED" && (
                  <>
                    <button
                      onClick={() => {
                        setRescheduleTarget(apt);
                        setNewDate(apt.date);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </button>

                    <button
                      onClick={() => handleCancel(apt.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-semibold text-rose-700"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
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

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              Reschedule Appointment
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Select a new date and time for {rescheduleTarget.referenceNumber}.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Time Slot</label>
                <select
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white"
                >
                  <option value="09:00 AM">09:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:30 AM">11:30 AM</option>
                  <option value="14:00 PM">14:00 PM</option>
                  <option value="15:30 PM">15:30 PM</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRescheduleSubmit}
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
                >
                  Confirm Reschedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

