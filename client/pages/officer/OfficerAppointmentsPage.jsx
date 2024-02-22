import { useState } from "react";
import { useStore } from "@/context";
import { appointments as INITIAL_APPOINTMENTS } from "@/data";
import StatusBadge from "@/components/ui/StatusBadge";
import AppointmentSlip from "@/features/appointments/AppointmentSlip";
import { formatDate } from "@/utils";
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
  const [timeFilter, setTimeFilter] = useState("TODAY");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [selectedSlipApt, setSelectedSlipApt] = useState(null);

  // Guarantee upcoming and today sample appointments are available
  const existingIds = new Set(appointments.map((a) => a.id));
  const effectiveAppointments = [
    ...appointments,
    ...INITIAL_APPOINTMENTS.filter((a) => !existingIds.has(a.id)),
  ];

  const deptAppointments = effectiveAppointments.filter((a) => a.departmentId === officerDeptId);

  const formatRequestDate = (dateString) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const filtered = deptAppointments.filter((a) => {
    const matchesSearch =
      a.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      a.citizenName.toLowerCase().includes(search.toLowerCase()) ||
      a.citizenPhone.includes(search);
    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "REJECTED"
        ? a.status === "REJECTED" || a.status === "REJECT"
        : a.status === statusFilter;

    const todayStr = getTodayStr();
    const aptDate = (a.date || "").split("T")[0];
    let matchesTime = true;
    if (timeFilter === "TODAY") {
      matchesTime = aptDate === todayStr;
    } else if (timeFilter === "UPCOMING") {
      matchesTime = aptDate > todayStr;
    } else if (timeFilter === "ALL") {
      matchesTime = true;
    }

    return matchesSearch && matchesStatus && matchesTime;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div
        className="relative flex items-center w-full min-h-[48px]"
        style={{ position: "relative", minHeight: "48px" }}
      >
        <div className="w-full text-center" style={{ textAlign: "center" }}>
          <h2 className="text-xl font-bold text-slate-900" style={{ textAlign: "center" }}>
            Appointment Management
          </h2>
          <p className="text-xs text-slate-500 mt-1" style={{ textAlign: "center" }}>
            {currentUser?.departmentName ? `${currentUser.departmentName} — ` : ""}
            Review citizen requests, approve bookings, and process desk appointments.
          </p>
        </div>

        <span
          className="text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold shadow-xs"
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
          }}
        >
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Dropdown */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="TODAY">Today's Appointments</option>
              <option value="UPCOMING">Upcoming Appointments</option>
              <option value="ALL">All Appointments</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Reject</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Appointment Number</th>
                <th className="px-5 py-3.5">Citizen Name</th>
                <th className="px-5 py-3.5">Service</th>
                <th className="px-5 py-3.5">Scheduled Date & Time</th>
                <th className="px-5 py-3.5">Request Date</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No appointments found matching this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Appointment Number */}
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      <div className="text-blue-900 hover:text-blue-700">{apt.referenceNumber}</div>
                      {apt.tokenNumber && (
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          Token: {apt.tokenNumber}
                        </span>
                      )}
                    </td>

                    {/* Citizen Name */}
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div className="font-bold text-slate-900">{apt.citizenName}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{apt.citizenPhone}</span>
                    </td>

                    {/* Service */}
                    <td className="px-5 py-3.5 text-slate-700 font-medium">{apt.serviceName}</td>

                    {/* Scheduled Date & Time */}
                    <td className="px-5 py-3.5 text-slate-600">
                      <div className="font-medium text-slate-900">{formatDate(apt.date)}</div>
                      <span className="text-[10px] text-blue-700 font-bold">{apt.timeSlot}</span>
                    </td>

                    {/* Request Date */}
                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      {formatRequestDate(apt.createdAt)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={apt.status} />
                    </td>

                    {/* Actions: Approve and Reject buttons only */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateAppointmentStatus(apt.id, "APPROVED", "Approved by desk officer")}
                          disabled={apt.status === "APPROVED"}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            apt.status === "APPROVED"
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer shadow-xs"
                          }`}
                          title="Approve Appointment"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAppointmentStatus(apt.id, "REJECTED", "", "Paperwork incomplete")}
                          disabled={apt.status === "REJECTED"}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            apt.status === "REJECTED"
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                              : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer shadow-xs"
                          }`}
                          title="Reject Appointment"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
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

