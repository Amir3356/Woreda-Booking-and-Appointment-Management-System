import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/utils";
import { AlertCircle, Check, X } from "lucide-react";

export default function OfficerAppointmentsPage() {
  const {
    currentUser,
    appointments,
    updateAppointmentStatus,
  } = useStore();

  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Action column: a department officer decides PENDING bookings of their own department.
  const handleApprove = async (e, apt) => {
    e.stopPropagation();
    setBusyId(apt.id);
    const ok = await updateAppointmentStatus(apt.id, "APPROVED");
    setBusyId(null);
    if (ok) {
      toast.success(`Appointment approved.`, { duration: 5000 });
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
      toast.success(`Appointment rejected.`, { duration: 5000 });
      setRejectTarget(null);
      setRejectReason("");
    } else {
      const err = useStore.getState().appointmentError;
      toast.error(err?.message || "Failed to reject appointment.", { duration: 5000 });
    }
  };

  const effectiveAppointments = appointments || [];

  // Only the department the Admin assigned to this officer in Account Provision. The server
  // already returns only that department's appointments; this keeps the page strict as well, and
  // an officer without a department sees none.
  const deptAppointments = effectiveAppointments.filter(
    (a) => Boolean(currentUser?.departmentId) && a.departmentId === currentUser.departmentId
  );

  // When a new appointment comes in, ensure it is displayed in the first row (newest first)
  const sortedAppointments = [...deptAppointments].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return String(b.id || "").localeCompare(String(a.id || ""), undefined, { numeric: true });
  });

  const filtered = sortedAppointments;

  // Appointment table columns (TanStack Table via components/ui/DataTable).
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
            {apt.tokenNumber && (
              <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                Token: {apt.tokenNumber}
              </span>
            )}
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
      cell: ({ row }) => <div>{row.original.serviceName}</div>,
    },
    {
      id: "message",
      header: "Message",
      enableSorting: false,
      meta: { className: "text-slate-700 align-top" },
      cell: ({ row }) =>
        row.original.citizenNotes ? (
          <p
            className="max-w-[220px] whitespace-pre-line break-words line-clamp-3 text-[11px] leading-snug"
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              title="Approve this booking"
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              type="button"
              onClick={(e) => handleOpenReject(e, apt)}
              disabled={busyId === apt.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              title="Reject this booking"
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400" title="Only pending bookings can be approved or rejected">
            —
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Centered Page Header */}
      <div className="w-full text-center">
        <h2 className="text-xl font-bold text-slate-900" style={{ textAlign: "center" }}>
          Appointment Management
        </h2>
        <p className="text-xs text-slate-500 mt-1" style={{ textAlign: "center" }}>
          {currentUser?.departmentName ? `${currentUser.departmentName} — ` : ""}
          Review citizen bookings and scheduled appointments for your department.
        </p>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={filtered}
          columns={appointmentColumns}
          getRowId={(apt) => apt.id}
          itemLabel="appointments"
          minWidth="1040px"
          emptyState={
            <div className="text-slate-400">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No appointments found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                No citizen appointments booked for your department yet.
              </p>
            </div>
          }
        />
      </div>

      {/* Rejection Modal with Reason Input Field */}
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
                Reject Appointment
              </h3>
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
                  className="block text-xs font-bold text-slate-700 mb-1.5 text-center"
                  style={{ textAlign: "center" }}
                >
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="rejection-reason-input"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., Incomplete documentation, quota limit reached, missing original kebele ID..."
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
