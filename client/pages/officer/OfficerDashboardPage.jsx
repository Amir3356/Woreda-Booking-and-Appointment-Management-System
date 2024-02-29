import { useStore } from "@/context";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { displayDate, displayTime } from "@/utils";

export default function OfficerDashboardPage() {
  const {
    currentUser,
    appointments,
    queue,
    updateAppointmentStatus,
  } = useStore();

  const officerDeptId = currentUser?.departmentId;

  // Only the department the Admin assigned in Account Provision (none when unassigned).
  const deptAppointments = appointments.filter(
    (a) => Boolean(officerDeptId) && a.departmentId === officerDeptId
  );
  const deptQueue = queue.filter((q) => {
    if (!officerDeptId) return true;
    return q.departmentId === officerDeptId;
  });

  const servingCitizen = deptQueue.find((q) => q.status === "SERVING");
  const waitingCount = deptQueue.filter((q) => q.status === "WAITING").length;
  const completedToday = deptAppointments.filter((a) => a.status === "COMPLETED").length;
  const noShowToday = deptAppointments.filter((a) => a.status === "NO_SHOW").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Desk Status Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase">Waiting in Queue</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{waitingCount}</p>
          <span className="text-[10px] text-blue-600 font-medium">Checked-in & waiting</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase">Currently Serving</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-600">{servingCitizen ? "1" : "0"}</p>
          <span className="text-[10px] text-amber-700 font-medium">At service desk</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase">Completed Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{completedToday}</p>
          <span className="text-[10px] text-emerald-700 font-medium">Fitted with service</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase">Missed / No-Show</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600">{noShowToday}</p>
          <span className="text-[10px] text-slate-400">Did not attend desk</span>
        </div>
      </div>

      {/* Today's Department Appointments Schedule */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Today's Department Appointments</h3>
            <p className="text-xs text-slate-500">Citizen requests assigned to {currentUser?.departmentName}</p>
          </div>
          <Link
            href="/officer/appointments"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <span>View All Department Bookings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Appointment Date&amp;Time</th>
                <th className="px-5 py-3">Citizen Name</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Message</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Desk Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deptAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No appointments booked for this department yet.
                  </td>
                </tr>
              ) : (
                deptAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* The date and time the citizen chose when booking */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{displayDate(apt.date)}</div>
                      <span className="text-[11px] text-blue-700 font-semibold">{displayTime(apt.timeSlot)}</span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div>{apt.citizenName}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{apt.citizenPhone}</span>
                      {apt.tokenNumber && (
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          Token: {apt.tokenNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">{apt.serviceName}</td>

                    {/* Message the citizen wrote when booking */}
                    <td className="px-5 py-3.5 text-slate-700 align-top">
                      {apt.citizenNotes ? (
                        <p
                          className="max-w-[220px] whitespace-pre-line break-words line-clamp-3 text-[11px] leading-snug"
                          title={apt.citizenNotes}
                        >
                          {apt.citizenNotes}
                        </p>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {apt.status === "APPROVED" && (
                        <button
                          onClick={() => updateAppointmentStatus(apt.id, "CHECKED_IN")}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                        >
                          Check In
                        </button>
                      )}
                      {apt.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, "APPROVED")}
                            className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            title="Confirm Booking"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, "REJECTED", "", "Quota or invalid paperwork")}
                            className="p-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {apt.status === "CHECKED_IN" && (
                        <span className="text-[11px] text-blue-700 font-bold">In Lobby Queue</span>
                      )}
                      {apt.status === "IN_PROGRESS" && (
                        <span className="text-[11px] text-purple-700 font-bold">At Counter Desk</span>
                      )}
                      {apt.status === "COMPLETED" && (
                        <span className="text-[11px] text-emerald-700 font-bold">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

