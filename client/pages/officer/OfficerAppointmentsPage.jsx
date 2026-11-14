import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/utils";
import { subscribe, isLive } from "@/api/realtime";
import {
  AlertCircle,
  Check,
  X,
  Clock,
  Briefcase,
  FileText,
  Filter,
  Search,
  ChevronRight,
} from "lucide-react";

export default function OfficerAppointmentsPage() {
  const {
    currentUser,
    appointments,
    services,
    loadServices,
    loadDepartments,
    updateAppointmentStatus,
  } = useStore();

  useEffect(() => {
    let timer = null;
    const refreshCatalog = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadServices?.().catch(() => {});
        loadDepartments?.().catch(() => {});
      }, 150);
    };

    // Initial load
    refreshCatalog();

    // Live catalog change updates without refreshing the page
    const offCatalog = subscribe("catalog.changed", refreshCatalog);
    const offReconnect = subscribe("reconnected", refreshCatalog);

    return () => {
      clearTimeout(timer);
      offCatalog();
      offReconnect();
    };
  }, [loadServices, loadDepartments]);

  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [search, setSearch] = useState("");
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
    const deptServices = (services || []).filter(
      (s) => s.departmentId === currentUser.departmentId && s.isActive !== false
    );
    const userAssignedIds = Array.isArray(currentUser.serviceIds) ? currentUser.serviceIds : [];
    if (userAssignedIds.length > 0) {
      return deptServices.filter((s) => userAssignedIds.includes(s.id));
    }
    return deptServices;
  }, [services, currentUser?.departmentId, currentUser?.serviceIds]);

  // Reset selected service filter if the selected service was removed/unassigned
  useEffect(() => {
    if (selectedServiceFilter !== "ALL" && assignedServices.length > 0) {
      const stillAssigned = assignedServices.some(
        (s) => s.id === selectedServiceFilter || s.name === selectedServiceFilter
      );
      if (!stillAssigned) {
        setSelectedServiceFilter("ALL");
      }
    }
  }, [assignedServices, selectedServiceFilter]);

  // 2. Strict department and assigned public services scoping for appointments (RBAC Scoped)
  const effectiveAppointments = appointments || [];
  const deptAppointments = useMemo(() => {
    if (!currentUser?.departmentId) return [];
    const allowedServiceIds = new Set(assignedServices.map((s) => s.id));
    return effectiveAppointments.filter((a) => {
      if (a.departmentId !== currentUser.departmentId) return false;
      if (allowedServiceIds.size > 0 && !allowedServiceIds.has(a.serviceId)) return false;
      return true;
    });
  }, [effectiveAppointments, currentUser?.departmentId, assignedServices]);

  // 3. Sort newest first
  const sortedAppointments = useMemo(() => {
    return [...deptAppointments].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return String(b.id || "").localeCompare(String(a.id || ""), undefined, { numeric: true });
    });
  }, [deptAppointments]);

  // 6. Filter by service, status, and search query
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedAppointments.filter((apt) => {
      if (selectedServiceFilter !== "ALL") {
        const matches =
          apt.serviceId === selectedServiceFilter ||
          apt.serviceName === selectedServiceFilter;
        if (!matches) return false;
      }
      if (selectedStatusFilter === "PENDING") {
        if (apt.status !== "PENDING") return false;
      } else if (selectedStatusFilter === "APPROVED") {
        if (!["APPROVED", "CHECKED_IN", "IN_PROGRESS"].includes(apt.status)) return false;
      } else if (selectedStatusFilter === "COMPLETED") {
        if (apt.status !== "COMPLETED") return false;
      } else if (selectedStatusFilter === "REJECTED") {
        if (!["REJECTED", "CANCELLED"].includes(apt.status)) return false;
      }

      if (q) {
        const citizen = (apt.citizenName || "").toLowerCase();
        const phone = (apt.citizenPhone || "").toLowerCase();
        const service = (apt.serviceName || "").toLowerCase();
        const ref = (apt.referenceNumber || "").toLowerCase();
        const date = (apt.date || "").toLowerCase();
        const time = (apt.timeSlot || "").toLowerCase();
        const notes = (apt.citizenNotes || apt.notes || "").toLowerCase();
        const status = (apt.status || "").toLowerCase();
        const matchesQuery =
          citizen.includes(q) ||
          phone.includes(q) ||
          service.includes(q) ||
          ref.includes(q) ||
          date.includes(q) ||
          time.includes(q) ||
          notes.includes(q) ||
          status.includes(q);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [sortedAppointments, selectedServiceFilter, selectedStatusFilter, search]);

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
      {/* Search & Dropdown Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input Box */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search citizen, phone, service, date, ref..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Public Services Dropdown Filter */}
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedServiceFilter}
              onChange={(e) => setSelectedServiceFilter(e.target.value)}
              onFocus={() => {
                if (!isLive()) {
                  loadServices?.().catch(() => {});
                  loadDepartments?.().catch(() => {});
                }
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="ALL">All Services</option>
              {assignedServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Reject</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(search || selectedServiceFilter !== "ALL" || selectedStatusFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedServiceFilter("ALL");
                setSelectedStatusFilter("ALL");
              }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer font-medium"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
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
                {search || selectedServiceFilter !== "ALL" || selectedStatusFilter !== "ALL"
                  ? "No citizen appointments match the selected search or filter criteria."
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
