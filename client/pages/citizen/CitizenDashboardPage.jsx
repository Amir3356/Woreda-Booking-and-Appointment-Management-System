import Link from "@/components/ui/Link";
import { useStore } from "@/context";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/utils";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  Printer,
} from "lucide-react";
import { useState } from "react";
import AppointmentSlip from "@/features/appointments/AppointmentSlip";

export default function CitizenDashboardPage() {
  const { currentUser, appointments, services } = useStore();
  const [selectedSlipApt, setSelectedSlipApt] = useState(null);

  // Filter citizen appointments
  const myAppointments = appointments.filter(
    (a) => a.citizenId === currentUser?.id || a.citizenPhone === currentUser?.phone
  );

  const upcoming = myAppointments.filter(
    (a) => a.status === "PENDING" || a.status === "APPROVED" || a.status === "CHECKED_IN"
  );
  const completed = myAppointments.filter((a) => a.status === "COMPLETED");
  const cancelled = myAppointments.filter(
    (a) => a.status === "CANCELLED" || a.status === "REJECTED" || a.status === "NO_SHOW"
  );

  const nextAppointment = upcoming[0];
  const nextService = nextAppointment
    ? services.find((s) => s.id === nextAppointment.serviceId)
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0b2545] to-[#133b5c] rounded-2xl p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold text-amber-300 tracking-wider">
            Citizen Dashboard
          </span>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">
            Welcome back, {currentUser?.fullName || "Citizen"}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Registered Phone: {currentUser?.phone} • Kebele Address: {currentUser?.address || "Kebele 03"}
          </p>
        </div>

        <Link
          href="/book"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition-all shrink-0"
        >
          <Calendar className="w-4 h-4" />
          <span>Book New Appointment</span>
        </Link>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Bookings</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{myAppointments.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">All historical requests</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Upcoming / Active</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{upcoming.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Scheduled appointments</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{completed.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Services fulfilled</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Cancelled / Missed</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-600">{cancelled.length}</p>
          <p className="text-[11px] text-slate-400 mt-1">Withdrawn requests</p>
        </div>
      </div>

      {/* Next Upcoming Highlight */}
      {nextAppointment && (
        <div className="bg-white rounded-2xl border-2 border-blue-600/30 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
                <Clock className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-700">Next Scheduled Visit</span>
                <h3 className="font-bold text-slate-900 text-base">{nextAppointment.serviceName}</h3>
              </div>
            </div>
            <StatusBadge status={nextAppointment.status} />
          </div>

          <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Department</span>
              <p className="font-bold text-slate-800">{nextAppointment.departmentName}</p>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Date & Time</span>
              <p className="font-bold text-slate-800">
                {formatDate(nextAppointment.date)} at <span className="text-blue-700">{nextAppointment.timeSlot}</span>
              </p>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Reference Code</span>
              <p className="font-mono font-bold text-slate-900">{nextAppointment.referenceNumber}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Please arrive 15 minutes before your time slot with required documents.
            </p>
            <button
              onClick={() => setSelectedSlipApt(nextAppointment)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Print Official Slip</span>
            </button>
          </div>
        </div>
      )}

      {/* Recent Appointments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Appointment History</h3>
          <Link
            href="/citizen/appointments"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <span>View All History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Reference #</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Date & Slot</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No appointments booked yet. Click "Book New Appointment" to get started.
                  </td>
                </tr>
              ) : (
                myAppointments.slice(0, 5).map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">
                      {apt.referenceNumber}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">{apt.serviceName}</td>
                    <td className="px-5 py-3 text-slate-500">{apt.departmentName}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(apt.date)} • {apt.timeSlot}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setSelectedSlipApt(apt)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View Slip
                      </button>
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

