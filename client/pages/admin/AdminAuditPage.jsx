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
  REJECTED: { label: "Reject", cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  COMPLETED: { label: "Complete Services", cls: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-500" },
  RESCHEDULED: { label: "Rescheduled", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
};

// Action filter: only Approved, Reject, and Complete Services.
const ACTION_FILTERS = [
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Reject" },
  { value: "COMPLETED", label: "Complete Services" },
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

  // Live real-time updates without refreshing the page
  useEffect(() => {
    load();

    const handleRealtimeNotice = (msg) => {
      if (page === 1 && msg?.auditEntry) {
        const e = msg.auditEntry;
        const matchesAction = action === "ALL" || e.action === action;
        const matchesDept = departmentId === "ALL" || e.departmentId === departmentId;
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          (e.citizenName || "").toLowerCase().includes(q) ||
          (e.serviceName || "").toLowerCase().includes(q);

        if (matchesAction && matchesDept && matchesSearch) {
          setEntries((prev) => {
            const exists = prev.some((item) => item.id === e.id);
            if (exists) return prev;
            return [e, ...prev].slice(0, PAGE_SIZE);
          });
          setTotal((prev) => prev + 1);
        }
      }
      load();
    };

    const offAudit = subscribe("audit.changed", handleRealtimeNotice);
    const offAppt = subscribe("appointments.changed", () => load());
    const offReconnect = subscribe("reconnected", () => load());
    const interval = setInterval(load, 3000); // 3s polling fallback ensures live sync

    return () => {
      offAudit();
      offAppt();
      offReconnect();
      clearInterval(interval);
    };
  }, [load, page, action, departmentId, search]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetPage = (fn) => (value) => {
    setPage(1);
    fn(value);
  };

  // Audit table columns: Citizen Name, Services, Appointment Date, Appointment Time, Action
  const auditColumns = [
    {
      id: "citizenName",
      accessorKey: "citizenName",
      header: "Citizen Name",
      enableSorting: false,
      meta: { className: "font-semibold text-slate-900" },
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900">
          {row.original.citizenName || "—"}
        </span>
      ),
    },
    {
      id: "services",
      accessorKey: "serviceName",
      header: "Services",
      enableSorting: false,
      meta: { className: "text-slate-700" },
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">
          {row.original.serviceName || "—"}
        </span>
      ),
    },
    {
      id: "appointmentDate",
      accessorKey: "appointmentDate",
      header: "Appointment Date",
      enableSorting: false,
      meta: { className: "whitespace-nowrap text-slate-700" },
      cell: ({ row }) => (
        <span className="text-slate-700 font-medium">
          {displayDate(row.original.appointmentDate) || row.original.appointmentDate || "—"}
        </span>
      ),
    },
    {
      id: "appointmentTime",
      accessorKey: "timeSlot",
      header: "Appointment Time",
      enableSorting: false,
      meta: { className: "whitespace-nowrap font-medium text-slate-600" },
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {displayTime(row.original.timeSlot) || row.original.timeSlot || "—"}
        </span>
      ),
    },
    {
      id: "action",
      accessorKey: "action",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original;
        const style = ACTION_STYLE[e.action] || {
          label: e.action,
          cls: "bg-slate-100 text-slate-700 border-slate-200",
          dot: "bg-slate-400",
        };
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${style.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative flex items-center w-full min-h-[48px]">
        <div className="w-full text-center">
          <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">
            Audit Logs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Every appointment decision: approvals, rejections, and completed services from the desk queue
          </p>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>WebSocket Live</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder="Search by citizen name, service..."
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
          minWidth="750px"
          emptyState={
            <div className="text-slate-400">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">{loading ? "Loading…" : "No audit entries yet"}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Approved, reject, and complete service decisions will be recorded here as they happen.
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
