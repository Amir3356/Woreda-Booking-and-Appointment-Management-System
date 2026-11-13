import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/utils";
import {
  AlertCircle,
  Check,
  X,
  Clock,
  Briefcase,
  Layers,
  CheckCircle2,
  Clock4,
  FileText,
  Filter,
  Building2,
  ChevronRight,
} from "lucide-react";

export default function OfficerAppointmentsPage() {
  const {
    currentUser,
    appointments,
    services,
    loadServices,
    updateAppointmentStatus,
  } = useStore();

  useEffect(() => {
    loadServices?.().catch(() => {});
  }, [loadServices]);

  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedServiceFilter, setSelectedServiceFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");

  // Action column: a department officer decides PENDING bookings of their own department.
  const handleApprove = async (e, apt) => {
    e.stopPropagation();
    setBusyId(apt.id);
    const ok = await updateAppointmentStatus(apt.id, "APPROVED");
    setBusyId(null);
    if (ok) {
      toast.success(`Appointment approved for ${apt.citizenName}.`, { duration: 5000 });
    } else {
      const err = useStore.getState().appointmentError;
      toast.error(err?.message || "Failed to approve appointment.", { duration: 5000 });
    }
  };

  const handleOpenReject = (e, apt) => {
    e.stopPropagation();
    setRejectTarget(apt);
    setRejectReason("");
  };

  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault();
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Please enter a reason for rejecting the appointment.", { duration: 5000 });
      return;
    }
    setBusyId(rejectTarget.id);
    const ok = await updateAppointmentStatus(rejectTarget.id, "REJECTED", "", reason);
    setBusyId(null);
    if (ok) {
      toast.success(`Appointment rejected for ${rejectTarget.citizenName}.`, { duration: 5000 });
      setRejectTarget(null);
      setRejectReason("");
    } else {
      const err = useStore.getState().appointmentError;
      toast.error(err?.message || "Failed to reject appointment.", { duration: 5000 });
    }
  };

  // 1. All services assigned to this Department Head by the Administrator (RBAC Scoped)
  const assignedServices = useMemo(() => {
    if (!currentUser?.departmentId) return [];
    return (services || []).filter(
      (s) => s.departmentId === currentUser.departmentId && s.isActive !== false
    );
  }, [services, currentUser?.departmentId]);

  // 2. Strict department scoping for appointments (RBAC Scoped)
  const effectiveAppointments = appointments || [];
  const deptAppointments = useMemo(() => {
    return effectiveAppointments.filter(
      (a) => Boolean(currentUser?.departmentId) && a.departmentId === currentUser.departmentId
    );
  }, [effectiveAppointments, currentUser?.departmentId]);

  // 3. Count bookings per assigned service
  const serviceBookingCounts = useMemo(() => {
    const map = new Map();
    deptAppointments.forEach((a) => {
      if (a.serviceId) map.set(a.serviceId, (map.get(a.serviceId) || 0) + 1);
      if (a.serviceName) map.set(a.serviceName, (map.get(a.serviceName) || 0) + 1);
    });
    return map;
  }, [deptAppointments]);

  // 4. Summary metrics
  const totalBookings = deptAppointments.length;
  const pendingCount = deptAppointments.filter((a) => a.status === "PENDING").length;
  const approvedCount = deptAppointments.filter((a) =>
    ["APPROVED", "CHECKED_IN", "IN_PROGRESS"].includes(a.status)
  ).length;
  const completedCount = deptAppointments.filter((a) => a.status === "COMPLETED").length;
  const rejectedCount = deptAppointments.filter((a) =>
    ["REJECTED", "CANCELLED"].includes(a.status)
  ).length;

  // 5. Sort newest first
  const sortedAppointments = useMemo(() => {
    return [...deptAppointments].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return String(b.id || "").localeCompare(String(a.id || ""), undefined, { numeric: true });
    });
  }, [deptAppointments]);

  // 6. Filter by service and status
  const filtered = useMemo(() => {
    return sortedAppointments.filter((apt) => {
      if (selectedServiceFilter !== "ALL") {
        const matches =
          apt.serviceId === selectedServiceFilter ||
          apt.serviceName === selectedServiceFilter;
        if (!matches) return false;
      }
      if (selectedStatusFilter === "PENDING") {
        return apt.status === "PENDING";
      }
      if (selectedStatusFilter === "APPROVED") {
        return ["APPROVED", "CHECKED_IN", "IN_PROGRESS"].includes(apt.status);
      }
      if (selectedStatusFilter === "COMPLETED") {
        return apt.status === "COMPLETED";
      }
      if (selectedStatusFilter === "REJECTED") {
        return ["REJECTED", "CANCELLED"].includes(apt.status);
      }
      return true;
    });
  }, [sortedAppointments, selectedServiceFilter, selectedStatusFilter]);

  // Appointment table columns
  const appointmentColumns = [
    {
      id: "citizen",
      accessorKey: "citizenName",
      header: "Citizen Name",
      sortFn: "text",
      meta: { className: "font-medium text-slate-900" },
      cell: ({ row }) => {
        const apt = row.original;
        return (
          <>
            <div className="font-bold text-slate-900">{apt.citizenName}</div>
            <span className="text-[10px] text-slate-500 font-normal">{apt.citizenPhone}</span>
          </>
        );
      },
    },
    {
      id: "service",
      accessorFn: (apt) => apt.serviceName || "",
      header: "Service Requested",
      sortFn: "text",
      meta: { className: "text-slate-700 font-medium" },
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs block">
            {row.original.serviceName || "Municipal Service"}
          </span>
          <span className="text-[10px] text-slate-400">
            {currentUser?.departmentName || "Assigned Department"}
          </span>
        </div>
      ),
    },
    {
      id: "message",
      header: "Message",
      enableSorting: false,
      meta: { className: "text-slate-700 align-top" },
      cell: ({ row }) =>
        row.original.citizenNotes ? (
          <p
            className="max-w-[200px] whitespace-pre-line break-words line-clamp-3 text-[11px] leading-snug"
            title={row.original.citizenNotes}
          >
            {row.original.citizenNotes}
          </p>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        ),
    },
    {
      id: "appointmentDate",
      accessorKey: "date",
      header: "Appointment Date",
      meta: { className: "text-slate-900 font-semibold whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: "appointmentTime",
      accessorKey: "timeSlot",
      header: "Appointment Time",
      meta: { className: "text-blue-700 font-bold whitespace-nowrap" },
      cell: ({ row }) => row.original.timeSlot,
    },
    {
      id: "requestedAt",
      accessorFn: (apt) => apt.createdAt || "",
      header: () => (
        <span title="Requested at">
          Requested at
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Requested at
          </span>
        </span>
      ),
      sortFn: "datetime",
      meta: { className: "whitespace-nowrap" },
      cell: ({ row }) => {
        const createdAt = row.original.createdAt;
        if (!createdAt) return <span className="text-xs text-slate-400">—</span>;
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) return <span className="text-xs text-slate-700">{createdAt}</span>;
        const dateStr = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const timeStr = d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        return (
          <div className="whitespace-nowrap">
            <div className="font-semibold text-slate-800 text-xs">{dateStr}</div>
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{timeStr}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const apt = row.original;
        return (
          <>
            <StatusBadge status={apt.status} />
            {apt.rejectionReason && (
              <span
                className="text-[10px] text-rose-600 block mt-0.5 truncate max-w-[130px]"
                title={apt.rejectionReason}
              >
                Reason: {apt.rejectionReason}
              </span>
            )}
          </>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => {
        const apt = row.original;
        return apt.status === "PENDING" ? (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={(e) => handleApprove(e, apt)}
              disabled={busyId === apt.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait transition-colors"
              title="Approve this citizen appointment request"
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              type="button"
              onClick={(e) => handleOpenReject(e, apt)}
              disabled={busyId === apt.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait transition-colors"
              title="Reject this citizen appointment request"
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400" title="Only pending bookings can be decided">
            Decided
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Department Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold shrink-0">
              <Building2 className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {currentUser?.departmentName || "Municipal Department"}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  Department Head Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Logged in as <strong className="text-slate-700">{currentUser?.fullName || "Department Officer"}</strong>
                {currentUser?.phone ? ` (${currentUser.phone})` : ""} · Counter Desk #{currentUser?.counterNumber || 1}
              </p>
            </div>
          </div>
          <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 self-start sm:self-center">
            Role: <span className="font-bold text-slate-800">Department Head (RBAC)</span>
          </div>
        </div>
      </div>

      {/* 2. Assigned Services Section (View Assigned Services by Admin) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Assigned Services ({assignedServices.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Public services assigned to your department by Central Administration. Citizens book these services to be served at your desk.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 font-medium shrink-0">
            {assignedServices.length === 1 ? "1 service assigned" : `${assignedServices.length} services assigned`}
          </span>
        </div>

        {assignedServices.length === 0 ? (
          <div className="py-6 text-center text-slate-400">
            <AlertCircle className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
            <p className="text-xs font-semibold text-slate-700">No Services Assigned Yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-md mx-auto">
              Central Administration has not yet mapped public services to this department. Once assigned in Department Management, they will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3.5">
            {assignedServices.map((srv) => {
              const bookingsCount = serviceBookingCounts.get(srv.id) || serviceBookingCounts.get(srv.name) || 0;
              const isSelected = selectedServiceFilter === srv.id || selectedServiceFilter === srv.name;
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => setSelectedServiceFilter(isSelected ? "ALL" : srv.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-500"
                      : "border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 line-clamp-1">{srv.name}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" title="Service Active" />
                  </div>
                  {srv.description && (
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">{srv.description}</p>
                  )}
                  <div className="flex items-center justify-between text-[11px] mt-2.5 pt-2 border-t border-slate-200/60">
                    <span className="text-slate-500">Citizen Bookings</span>
                    <span className="font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full text-[10px]">
                      {bookingsCount} {bookingsCount === 1 ? "booking" : "bookings"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Assigned Services</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{assignedServices.length}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Assigned by Admin</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Pending Review</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              pendingCount > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
            }`}>
              <Clock4 className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black mt-2 ${pendingCount > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {pendingCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Awaiting decision</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Approved / Active</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{approvedCount}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Scheduled for service</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Completed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{completedCount}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Citizens served</p>
        </div>
      </div>

      {/* 4. Filter Controls (Service filter & Status filter) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSelectedStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
              selectedStatusFilter === "ALL"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Requests ({totalBookings})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatusFilter("PENDING")}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
              selectedStatusFilter === "PENDING"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Pending Approval ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatusFilter("APPROVED")}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
              selectedStatusFilter === "APPROVED"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatusFilter("COMPLETED")}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
              selectedStatusFilter === "COMPLETED"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatusFilter("REJECTED")}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
              selectedStatusFilter === "REJECTED"
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {/* Assigned Service Chips for Quick Scope Filtering */}
        {assignedServices.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-semibold text-[11px] shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Service:
            </span>
            <button
              type="button"
              onClick={() => setSelectedServiceFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                selectedServiceFilter === "ALL"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
            >
              All Services ({totalBookings})
            </button>
            {assignedServices.map((srv) => {
              const count = serviceBookingCounts.get(srv.id) || serviceBookingCounts.get(srv.name) || 0;
              const isSelected = selectedServiceFilter === srv.id || selectedServiceFilter === srv.name;
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => setSelectedServiceFilter(srv.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {srv.name} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Citizen Appointments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={filtered}
          columns={appointmentColumns}
          getRowId={(apt) => apt.id}
          itemLabel="appointments"
          minWidth="1040px"
          emptyState={
            <div className="text-slate-400 py-8">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No appointments found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedServiceFilter !== "ALL" || selectedStatusFilter !== "ALL"
                  ? "No citizen appointments match the selected service or status filters."
                  : "No citizen appointments booked for your department's services yet."}
              </p>
            </div>
          }
        />
      </div>

      {/* 6. Rejection Modal with Reason Input Field */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
          >
            <div className="relative pb-3 border-b border-slate-100 mb-4">
              <h3
                id="reject-modal-title"
                className="font-bold text-base text-slate-900 text-center"
                style={{ textAlign: "center" }}
              >
                Reject Citizen Appointment
              </h3>
              <p className="text-xs text-slate-500 text-center mt-1">
                Citizen: <strong className="text-slate-700">{rejectTarget.citizenName}</strong> · Service: <strong className="text-slate-700">{rejectTarget.serviceName}</strong>
              </p>
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="absolute right-0 top-0 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div className="mb-4">
                <label
                  htmlFor="rejection-reason-input"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="rejection-reason-input"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., Incomplete documentation, missing original kebele ID, quota reached for this day..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setRejectTarget(null);
                    setRejectReason("");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-300 cursor-pointer"
                  style={{ backgroundColor: "#ffffff", color: "#334155" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === rejectTarget.id}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-60 cursor-pointer transition-colors"
                  style={{ backgroundColor: "#e11d48", color: "#ffffff", border: "1px solid #be123c" }}
                >
                  {busyId === rejectTarget.id ? "Rejecting…" : "Confirm Reject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
