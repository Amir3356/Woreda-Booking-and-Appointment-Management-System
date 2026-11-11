import { useState } from "react";
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
    appointmentError,
    clearAppointmentError,
  } = useStore();

  const [busyId, setBusyId] = useState(null);

  // Action column: a department officer decides PENDING bookings of their own department.
  const handleApprove = async (e, apt) => {
    e.stopPropagation();
    setBusyId(apt.id);
    await updateAppointmentStatus(apt.id, "APPROVED");
    setBusyId(null);
  };
  const handleReject = async (e, apt) => {
    e.stopPropagation();
    const reason = window.prompt(
      `Reason for rejecting ${apt.citizenName}'s booking (${apt.referenceNumber}):`,
      "Quota or invalid paperwork"
    );
    if (reason === null) return; // cancelled
    setBusyId(apt.id);
    await updateAppointmentStatus(apt.id, "REJECTED", "", reason.trim() || "Quota or invalid paperwork");
    setBusyId(null);
  };

  const effectiveAppointments = appointments || [];

  // Only the department the Admin assigned to this officer in Account Provision. The server
  // already returns only that department's appointments; this keeps the page strict as well, and
  // an officer without a department sees none.
  const deptAppointments = effectiveAppointments.filter(
    (a) => Boolean(currentUser?.departmentId) && a.departmentId === currentUser.departmentId
  );

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

  const filtered = deptAppointments;

  // Appointment table columns (TanStack Table via components/ui/DataTable).
  const appointmentColumns = [
    {
      id: "citizen",
      accessorKey: "citizenName",
      header: "Citizen Details",
      sortFn: "text",
      meta: { className: "font-medium text-slate-900" },
      cell: ({ row }) => {
        const apt = row.original;
        return (
          <>
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
      id: "scheduled",
      // "YYYY-MM-DD HH:MM": slot labels use 24h hours ("13:30 PM"), so text order is time order.
      accessorFn: (apt) => `${apt.date} ${apt.timeSlot}`,
      header: "Scheduled Date & Time",
      meta: { className: "text-slate-600" },
      cell: ({ row }) => (
        <>
          <div className="font-semibold text-slate-900">{formatDate(row.original.date)}</div>
          <span className="text-[10px] text-blue-700 font-bold">{row.original.timeSlot}</span>
        </>
      ),
    },
    {
      id: "booked",
      accessorFn: (apt) => apt.createdAt || "",
      header: "Booked Date",
      meta: { className: "text-slate-500 font-medium" },
      cell: ({ row }) => formatRequestDate(row.original.createdAt),
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
              onClick={(e) => handleReject(e, apt)}
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

      {appointmentError && (
        <div role="alert" className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{appointmentError.message}</span>
          </div>
          <button
            type="button"
            onClick={clearAppointmentError}
            className="text-red-700 hover:text-red-900 cursor-pointer p-0.5"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
    </div>
  );
}
