import { useState } from "react";
import { useStore } from "@/context";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/utils";
import {
  Layers,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Megaphone,
  ArrowRight,
  FileCheck2,
  AlertCircle,
  Check,
  X,
  Plus,
} from "lucide-react";
import Link from "@/components/ui/Link";

export default function OfficerDashboardPage() {
  const {
    currentUser,
    appointments,
    queue,
    callNextCitizen,
    updateQueueStatus,
    updateAppointmentStatus,
  } = useStore();

  const officerDeptId = currentUser?.departmentId || "dept-1";

  // Filter scoped to officer's assigned department
  const deptAppointments = appointments.filter((a) => a.departmentId === officerDeptId);
  const deptQueue = queue.filter((q) => q.departmentId === officerDeptId);

  const servingCitizen = deptQueue.find((q) => q.status === "SERVING");
  const waitingCount = deptQueue.filter((q) => q.status === "WAITING").length;
  const completedToday = deptAppointments.filter((a) => a.status === "COMPLETED").length;
  const noShowToday = deptAppointments.filter((a) => a.status === "NO_SHOW").length;

  const [callAlert, setCallAlert] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const handleCallNext = () => {
    const called = callNextCitizen(officerDeptId, currentUser?.counterNumber || 1);
    if (called) {
      setCallAlert(`Now calling Token ${called.tokenNumber} (${called.citizenName}) to Counter #1`);
      setTimeout(() => setCallAlert(""), 4000);
    } else {
      setCallAlert("No citizens currently waiting in the lobby queue.");
      setTimeout(() => setCallAlert(""), 3000);
    }
  };

  const handleCompleteCurrent = () => {
    if (!servingCitizen) return;
    updateQueueStatus(servingCitizen.id, "COMPLETED");
  };

  const handleNoShowCurrent = () => {
    if (!servingCitizen) return;
    updateQueueStatus(servingCitizen.id, "NO_SHOW");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Alert when calling */}
      {callAlert && (
        <div className="p-4 rounded-2xl bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            <span className="text-sm">{callAlert}</span>
          </div>
          <button onClick={() => setCallAlert("")} className="text-slate-900 font-bold text-xs">
            ✕
          </button>
        </div>
      )}

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

      {/* Currently Serving & Calling Control Station */}
      <div className="bg-white rounded-2xl border-2 border-emerald-600/40 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="font-bold text-slate-900 text-base">
              Service Counter Desk #1 (Live Desk)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCallNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Megaphone className="w-4 h-4 text-amber-300" />
              <span>Call Next Citizen</span>
            </button>

            <Link
              href="/officer/verify"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-xs"
            >
              <FileCheck2 className="w-4 h-4 text-blue-600" />
              <span>Check-in Arrival</span>
            </Link>
          </div>
        </div>

        {servingCitizen ? (
          <div className="py-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800">Queue Token</span>
                <p className="text-3xl font-mono font-black text-emerald-900">{servingCitizen.tokenNumber}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800">Citizen Name</span>
                <p className="text-base font-bold text-slate-900">{servingCitizen.citizenName}</p>
                <p className="text-xs text-slate-600">{servingCitizen.serviceName}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800">Called At</span>
                <p className="text-sm font-semibold text-slate-800">{servingCitizen.calledTime || "Just now"}</p>
                <span className="text-[10px] text-emerald-700 font-bold">STATUS: IN PROGRESS</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Internal note for citizen record..."
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  className="px-3 py-2 border rounded-xl text-xs w-full sm:w-72"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleNoShowCurrent}
                  className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Mark No-Show</span>
                </button>

                <button
                  onClick={handleCompleteCurrent}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Service Completed</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium">Counter is currently free.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Click "Call Next Citizen" to bring the next waiting person to your desk.
            </p>
          </div>
        )}
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
                <th className="px-5 py-3">Reference #</th>
                <th className="px-5 py-3">Citizen Name</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Slot</th>
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
                    <td className="px-5 py-3.5 text-slate-700">{apt.serviceName}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-semibold">{apt.timeSlot}</td>
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

