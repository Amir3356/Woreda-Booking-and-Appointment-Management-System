import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import { auditApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { describeError, displayDate, displayTime } from "@/utils";
import { Search, Filter, ShieldCheck } from "lucide-react";

// Admin > Audit Trail: every decision on an appointment, saved by appointment-service when it
// happens — a department officer approving or rejecting, a citizen booking (Pending) or
// cancelling, a reschedule. Newest first; updates live when appointments change.

const ACTION_STYLE = {
  BOOKED: { label: "Pending", cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  REJECTED: { label: "Rejected", cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-500" },
  RESCHEDULED: { label: "Rescheduled", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
};

// Action filter: only the three review states. "Pending" = a citizen's new booking waiting for review.
const ACTION_FILTERS = [
  { value: "BOOKED", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const ROLE_LABEL = { OFFICER: "Department Officer", CITIZEN: "Citizen", ADMIN: "Administrator" };
const STATUS_LABEL = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled" };
const PAGE_SIZE = 50;

function formatWhen(at) {
  const d = new Date(at);
  if (isNaN(d.getTime())) return { date: at, time: "" };
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }),
  };
}

export default function AdminAuditPage() {
  const { departments } = useStore();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("ALL");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, meta } = await auditApi.list({
        page,
        limit: PAGE_SIZE,
        action: action === "ALL" ? "" : action,
        departmentId: departmentId === "ALL" ? "" : departmentId,
        search: search.trim(),
      });
      setEntries(Array.isArray(data) ? data : []);
      setTotal(meta?.pagination?.totalItems ?? (Array.isArray(data) ? data.length : 0));
    } catch (err) {
      toast.error(describeError(err, "load the audit trail"), { duration: 5000 });
    } finally {
      setLoading(false);
    }
  }, [page, action, departmentId, search]);

  // Load now (search is debounced) and again whenever an appointment changes anywhere.
  useEffect(() => {
    const t = setTimeout(load, 250);
    let refresh = null;
    const soon = () => {
      clearTimeout(refresh);
      refresh = setTimeout(load, 300);
    };
    const offChange = subscribe("appointments.changed", soon);
    const offReconnect = subscribe("reconnected", soon);
    return () => {
      clearTimeout(t);
      clearTimeout(refresh);
      offChange();
      offReconnect();
    };
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetPage = (fn) => (value) => {
    setPage(1);
    fn(value);
  };

  // Audit table columns (TanStack Table via components/ui/DataTable). Sorting is off: the server
  // returns one page at a time, newest first, so re-sorting a single page would mislead.
  const auditColumns = [
    {
      id: "at",
      header: "Date & Time",
      enableSorting: false,
      meta: { className: "whitespace-nowrap" },
      cell: ({ row }) => {
        const when = formatWhen(row.original.at);
        return (
          <>
            <div className="font-semibold text-slate-900">{when.date}</div>
            <span className="text-[11px] text-slate-500">{when.time}</span>
          </>
        );
      },
    },
    {
      id: "actor",
      header: "Performed By",
      enableSorting: false,
      cell: ({ row }) => (
        <>
          <div className="font-bold text-slate-900">{row.original.actorName || "Unknown"}</div>
          <span className="text-[10px] text-slate-500">{ROLE_LABEL[row.original.actorRole] || row.original.actorRole}</span>
        </>
      ),
    },
    {
      id: "department",
      header: "Department",
      enableSorting: false,
      meta: { className: "text-slate-700" },
      cell: ({ row }) => row.original.departmentName || "—",
    },
    {
      id: "action",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original;
        const style = ACTION_STYLE[e.action] || { label: e.action, cls: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" };
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${style.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
        );
      },
    },
    {
      id: "statusChange",
      header: "Status Change",
      enableSorting: false,
      meta: { className: "whitespace-nowrap text-slate-600" },
      cell: ({ row }) => {
        const e = row.original;
        return (
          <>
            {e.fromStatus ? `${STATUS_LABEL[e.fromStatus] || e.fromStatus} → ` : "New → "}
            <span className="font-semibold text-slate-900">{STATUS_LABEL[e.toStatus] || e.toStatus}</span>
          </>
        );
      },
    },
    {
      id: "appointment",
      header: "Appointment",
      enableSorting: false,
      meta: { className: "whitespace-nowrap" },
      cell: ({ row }) => {
        const e = row.original;
        return (
          <>
            <div className="font-mono font-semibold text-blue-900 text-[11px]">{e.referenceNumber}</div>
            <span className="text-[10px] text-slate-500">
              {displayDate(e.appointmentDate)} · {displayTime(e.timeSlot)}
            </span>
          </>
        );
      },
    },
    {
      id: "citizen",
      header: "Citizen",
      enableSorting: false,
      meta: { className: "text-slate-800" },
      cell: ({ row }) => row.original.citizenName,
    },
    {
      id: "service",
      header: "Service",
      enableSorting: false,
      meta: { className: "text-slate-700" },
      cell: ({ row }) => row.original.serviceName,
    },
    {
      id: "reason",
      header: "Reason / Notes",
      enableSorting: false,
      meta: { className: "text-slate-600" },
      cell: ({ row }) =>
        row.original.reason ? (
          <p className="max-w-[220px] break-words line-clamp-3 text-[11px]" title={row.original.reason}>
            {row.original.reason}
          </p>
        ) : (
          <span className="text-[11px] text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-900">Audit Trail</h2>
        <p className="text-xs text-slate-500 mt-1">
          Every appointment decision with who made it and when: approvals and rejections by department
          officers, bookings and cancellations by citizens.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder="Search officer, citizen, reference, service..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={action}
            onChange={(e) => resetPage(setAction)(e.target.value)}
            aria-label="Action"
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            {ACTION_FILTERS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(e) => resetPage(setDepartmentId)(e.target.value)}
            aria-label="Department"
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {(departments || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* The server pages this list (newest first), so the table shows the current page as-is. */}
        <DataTable
          data={entries}
          columns={auditColumns}
          getRowId={(e) => e.id}
          pageSize={null}
          minWidth="1100px"
          emptyState={
            <div className="text-slate-400">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">{loading ? "Loading…" : "No audit entries yet"}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Approvals, rejections, bookings and cancellations will be recorded here as they happen.
              </p>
            </div>
          }
        />

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-600">
          <span>
            {total} {total === 1 ? "entry" : "entries"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
