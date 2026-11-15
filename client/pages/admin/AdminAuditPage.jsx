import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import { auditApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { describeError, displayDate, displayTime } from "@/utils";
import { Search, Filter, ShieldCheck } from "lucide-react";

// Admin > Audit Logs: every action on an appointment, saved by the server when it happens.
//   Citizen:            Appointment Requested (the request then awaits a decision: Pending), Cancelled
//   Department officer: Approved, Rejected, Completed Service, No-show, Rescheduled, Cancelled
// Each entry shows the exact date and time of the action and who performed it. Newest first;
// updates live.

// Badge text per action; colours come from .audit-badge--<action> in styles/table.css.
const ACTION_LABEL = {
  BOOKED: "Appointment Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed Service",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Rescheduled",
};

// Action filter: citizen activities first, then department officer decisions.
const ACTION_FILTERS = [
  { value: "BOOKED", label: "Appointment Requested (Pending)" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "COMPLETED", label: "Completed Service" },
  { value: "NO_SHOW", label: "No-show" },
  { value: "RESCHEDULED", label: "Rescheduled" },
];

const ROLE_LABEL = { OFFICER: "Department Officer", CITIZEN: "Citizen", ADMIN: "Administrator" };
// Appointment status right after the action ("Pending" = awaiting the department's decision).
const STATUS_LABEL = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  CHECKED_IN: "Checked in",
  IN_PROGRESS: "In service",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
};
// Entries per page; the server pages with a keyset cursor (stable while new entries arrive).
const PAGE_SIZE = 5;

function formatWhen(at) {
  const d = new Date(at);
  if (isNaN(d.getTime())) return { date: at, time: "" };
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }),
  };
}

/**
 * One side of the Before/After comparison: the appointment's status, date and time slot.
 * compareTo (the other side) highlights the values the action changed.
 */
function Snapshot({ snap, compareTo, emptyLabel }) {
  if (!snap) {
    return <span className="audit-snapshot-empty">{emptyLabel}</span>;
  }
  const changed = (key) => compareTo !== undefined && (compareTo?.[key] ?? null) !== (snap[key] ?? null);
  const status = STATUS_LABEL[snap.status] || snap.status || "—";
  const date = snap.date ? displayDate(snap.date) || snap.date : "—";
  const time = snap.timeSlot ? displayTime(snap.timeSlot) || snap.timeSlot : "";
  return (
    <div className="audit-snapshot">
      <span className={`audit-pill audit-pill--${(snap.status || "").toLowerCase()}${changed("status") ? " is-changed" : ""}`}>
        {status}
      </span>
      <div className={`audit-snapshot-line${changed("date") ? " is-changed" : ""}`}>{date}</div>
      {time && <div className={`audit-snapshot-line font-mono${changed("timeSlot") ? " is-changed" : ""}`}>{time}</div>}
    </div>
  );
}

export default function AdminAuditPage() {
  const { departments } = useStore();
  const [entries, setEntries] = useState([]);
  // null = first page; otherwise the opaque cursor the server returned for the page shown.
  const [cursor, setCursor] = useState(null);
  const [pageMeta, setPageMeta] = useState(null);
  const [action, setAction] = useState("ALL");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const request = useRef(0);

  // background: live/polling refresh of the page shown (no loading state, so Previous/Next stay usable).
  const load = useCallback(async (background = false) => {
    const id = ++request.current;
    if (!background) setLoading(true);
    try {
      const { data, meta } = await auditApi.list({
        cursor: cursor ?? "",
        pageSize: PAGE_SIZE,
        action: action === "ALL" ? "" : action,
        departmentId: departmentId === "ALL" ? "" : departmentId,
        search: search.trim(),
      });
      if (id !== request.current) return; // a newer request (another page or filter) is under way
      setEntries(Array.isArray(data) ? data : []);
      setPageMeta(meta?.cursor ?? null);
    } catch (err) {
      if (id !== request.current) return;
      if (err?.status === 422 && cursor) {
        setCursor(null); // the saved cursor is no longer valid: back to the newest entries
        return;
      }
      toast.error(describeError(err, "load the audit trail"), { duration: 5000 });
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [cursor, action, departmentId, search]);

  // Live: reload the page shown when entries are added (new entries appear on the first page; a
  // later page keeps its rows because it is anchored to a cursor). 3 s polling is the fallback.
  useEffect(() => {
    load();
    const refresh = () => load(true);
    const offAudit = subscribe("audit.changed", refresh);
    const offAppt = subscribe("appointments.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh);
    const interval = setInterval(refresh, 3000);
    return () => {
      offAudit();
      offAppt();
      offReconnect();
      clearInterval(interval);
    };
  }, [load]);

  // A filter change starts again from the newest entries.
  const resetPage = (fn) => (value) => {
    setCursor(null);
    fn(value);
  };

  // Audit table columns: Citizen, Performed By, Service, Action, Before, After, Date & Time (of the action)
  const auditColumns = [
    {
      id: "citizenName",
      accessorKey: "citizenName",
      header: "Citizen",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="audit-nowrap">
          <div className="font-semibold text-slate-900">{row.original.citizenName || "—"}</div>
        </div>
      ),
    },
    {
      id: "actor",
      accessorKey: "actorName",
      header: "Performed By",
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="audit-nowrap">
            <div className="font-semibold text-slate-800">{e.actorName || "System"}</div>
            <div className="text-[11px] text-slate-500">{ROLE_LABEL[e.actorRole] || e.actorRole || "—"}</div>
          </div>
        );
      },
    },
    {
      id: "services",
      accessorKey: "serviceName",
      header: "Service",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="audit-nowrap">
          <div className="font-medium text-slate-800">{row.original.serviceName || "—"}</div>
          {row.original.departmentName && (
            <div className="text-[11px] text-slate-500">{row.original.departmentName}</div>
          )}
        </div>
      ),
    },
    {
      id: "action",
      accessorKey: "action",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div>
            <span className={`audit-badge audit-badge--${(e.action || "").toLowerCase()}`}>
              <span className="audit-badge-dot" aria-hidden="true" />
              {ACTION_LABEL[e.action] || e.action}
            </span>
            {e.reason && <div className="audit-reason">{e.reason}</div>}
          </div>
        );
      },
    },
    {
      id: "before",
      accessorKey: "before",
      header: "Before",
      enableSorting: false,
      cell: ({ row }) => (
        <Snapshot snap={row.original.before} emptyLabel="Not booked yet" />
      ),
    },
    {
      id: "after",
      accessorKey: "after",
      header: "After",
      enableSorting: false,
      cell: ({ row }) => (
        <Snapshot
          snap={row.original.after}
          compareTo={row.original.before ?? undefined}
          emptyLabel="—"
        />
      ),
    },
    {
      id: "at",
      accessorKey: "at",
      header: "Date & Time",
      enableSorting: false,
      cell: ({ row }) => {
        const { date, time } = formatWhen(row.original.at);
        return (
          <div className="audit-nowrap">
            <div className="font-semibold text-slate-800">{date}</div>
            <div className="font-mono text-[11px] text-slate-500">{time}</div>
          </div>
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
            Citizen requests and cancellations, and every department decision: approvals, rejections and completed services, with the exact time and who did it
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
            placeholder="Search citizen, officer, reference, service..."
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden audit-table">
        {/* The server pages this list (newest first, 5 per page, keyset cursor); the footer pages through it. */}
        <DataTable
          data={entries}
          columns={auditColumns}
          getRowId={(e) => e.id}
          pageSize={null}
          itemLabel="entries"
          serverPagination={{ meta: pageMeta, loading, onCursorChange: (next) => setCursor(next || null) }}
          minWidth="1080px"
          emptyState={
            <div className="text-slate-400">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">{loading ? "Loading…" : "No audit entries yet"}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Appointment requests, cancellations, approvals, rejections and completed services are recorded here as they happen.
              </p>
            </div>
          }
        />

      </div>
    </div>
  );
}
