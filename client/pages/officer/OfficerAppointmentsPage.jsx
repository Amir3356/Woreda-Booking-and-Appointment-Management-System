import { useState } from "react";
import { useStore } from "@/context";
import StatusBadge from "@/components/ui/StatusBadge";
import AppointmentSlip from "@/features/appointments/AppointmentSlip";
import { formatDate } from "@/utils";
import {
  Calendar,
  Search,
  Filter,
  AlertCircle,
} from "lucide-react";

export default function OfficerAppointmentsPage() {
  const {
    currentUser,
    appointments,
    services,
  } = useStore();

  const [timeFilter, setTimeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedSlipApt, setSelectedSlipApt] = useState(null);

  const effectiveAppointments = appointments || [];

  // Scoped to officer's assigned department (or all if unassigned)
  const deptAppointments = effectiveAppointments.filter((a) => {
    if (!currentUser?.departmentId) return true;
    return (
      a.departmentId === currentUser.departmentId ||
      (currentUser.departmentName &&
        a.departmentName?.toLowerCase() === currentUser.departmentName?.toLowerCase())
    );
  });

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

  const todayStr = getTodayStr();

  const filtered = deptAppointments.filter((a) => {
    const matchesSearch =
      a.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      a.citizenName.toLowerCase().includes(search.toLowerCase()) ||
      a.citizenPhone.includes(search) ||
      (a.serviceName && a.serviceName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "REJECTED"
        ? a.status === "REJECTED" || a.status === "REJECT"
        : a.status === statusFilter;

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
      {/* Centered Page Header with Action Badge at Right Edge */}
      <div
        className="relative flex items-center justify-center w-full min-h-[48px]"
        style={{ position: "relative", minHeight: "48px", width: "100%" }}
      >
        <div className="w-full text-center" style={{ textAlign: "center", width: "100%" }}>
          <h2 className="text-xl font-bold text-slate-900" style={{ textAlign: "center" }}>
            Appointment Management
          </h2>
          <p className="text-xs text-slate-500 mt-1" style={{ textAlign: "center" }}>
            {currentUser?.departmentName ? `${currentUser.departmentName} — ` : ""}
            Review citizen bookings and scheduled appointments for your department.
          </p>
        </div>

        <span
          className="text-xs bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold shadow-xs shrink-0"
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          Assigned: {deptAppointments.length}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search citizen, phone, reference..."
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
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today's Visits</option>
              <option value="UPCOMING">Upcoming Visits</option>
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
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Citizen Name</th>
                <th className="px-5 py-3.5">Requested Service</th>
                <th className="px-5 py-3.5">Scheduled Date & Time</th>
                <th className="px-5 py-3.5">Booked On</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No appointments found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No citizen appointments match your selected filter criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((apt) => (
                  <tr
                    key={apt.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedSlipApt(apt)}
                    title="Click to preview official appointment confirmation slip"
                  >
                    {/* Citizen Details */}
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div className="font-bold text-slate-900">{apt.citizenName}</div>
                      <div className="text-[11px] font-mono text-blue-900 font-semibold mt-0.5">
                        {apt.referenceNumber}
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal">{apt.citizenPhone}</span>
                      {apt.tokenNumber && (
                        <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                          Token: {apt.tokenNumber}
                        </span>
                      )}
                    </td>

                    {/* Service */}
                    <td className="px-5 py-3.5 text-slate-700 font-medium">
                      <div>{apt.serviceName}</div>
                      {apt.citizenNotes && (
                        <span className="text-[10px] text-slate-400 truncate block max-w-xs" title={apt.citizenNotes}>
                          "{apt.citizenNotes}"
                        </span>
                      )}
                    </td>

                    {/* Scheduled Date & Time */}
                    <td className="px-5 py-3.5 text-slate-600">
                      <div className="font-semibold text-slate-900">{formatDate(apt.date)}</div>
                      <span className="text-[10px] text-blue-700 font-bold">{apt.timeSlot}</span>
                    </td>

                    {/* Booked Date */}
                    <td className="px-5 py-3.5 text-slate-500 font-medium">
                      {formatRequestDate(apt.createdAt)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={apt.status} />
                      {apt.rejectionReason && (
                        <span
                          className="text-[10px] text-rose-600 block mt-0.5 truncate max-w-[130px]"
                          title={apt.rejectionReason}
                        >
                          Reason: {apt.rejectionReason}
                        </span>
                      )}
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
              className="absolute -top-10 right-0 text-white font-bold text-xs bg-slate-800 px-3 py-1.5 rounded-lg no-print cursor-pointer"
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
