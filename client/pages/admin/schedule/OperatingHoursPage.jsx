// Admin > Schedule Management > Operating Hours: working days and opening / closing times per
// department (department-wide) or per service, each with its own per-service daily limit and an
// effective period. A weekly view shows the hours in force for every department.
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import { useEscapeKey } from "@/hooks";
import { subscribe } from "@/api/realtime";
import { addDays, describeError, formatWorkingDays, localIsoDate, displayDate } from "@/utils";
import { ConfirmDialog } from "@/features/schedule";
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Search,
  Filter,
  Circle,
} from "lucide-react";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Department-wide schedule: applies to every service of the department that has no schedule of its own.
const ALL_SERVICES = "";

/** Booked appointments a change to this schedule could affect: from today to its end (or a year ahead). */
function impactOf(sch) {
  const today = localIsoDate();
  const start = sch.effectiveStartDate > today ? sch.effectiveStartDate : today;
  const end = sch.effectiveEndDate || addDays(today, 365);
  return end < start ? null : { from: start, to: end, departmentIds: [sch.departmentId] };
}

/** Hours of a department on a weekday, from its schedules in force today (department-wide first). */
function hoursOn(deptSchedules, day) {
  const wide = deptSchedules.find((s) => !s.serviceId);
  const list = wide ? [wide] : deptSchedules;
  const open = list.filter((s) => (s.workingDays || []).includes(day));
  if (open.length === 0) return null;
  const opening = open.map((s) => s.openingTime).sort()[0];
  const closing = open.map((s) => s.closingTime).sort().at(-1);
  return { opening, closing, services: wide ? null : open.length };
}

export default function OperatingHoursPage() {
  const {
    departments,
    services,
    schedules: storeSchedules,
    loadSchedules,
    loadServices,
    loadDepartments,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleScheduleStatus,
  } = useStore();

  const schedules = storeSchedules || [];

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Confirmation before saving an edit or deactivating: { kind: "save" | "toggle", sch, payload? }
  const [pending, setPending] = useState(null);
  useEscapeKey(modalOpen && !pending, () => setModalOpen(false));
  const [saving, setSaving] = useState(false);

  // Schedules live in booking-service. Re-read them (and the departments/services the form
  // offers) when the page opens and whenever the server announces a catalog change.
  useEffect(() => {
    const refresh = () => {
      loadSchedules().catch((err) => toast.error(describeError(err, "load schedules"), { duration: 5000 }));
      loadServices().catch(() => {});
      loadDepartments().catch(() => {});
    };
    refresh();
    const offChange = subscribe("catalog.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh);
    return () => {
      offChange();
      offReconnect();
    };
  }, [loadSchedules, loadServices, loadDepartments]);

  const triggerToast = (msg) => {
    toast.success(msg, { duration: 5000 });
  };

  // Department names for the table filter
  const availableDeptNames = (departments || []).map((d) => d.name);

  // Services of a department (from Admin > Services Management)
  const getServicesForDept = (departmentId) =>
    (services || []).filter((s) => s.departmentId === departmentId);

  const emptyForm = {
    departmentId: departments?.[0]?.id || "",
    serviceId: ALL_SERVICES,
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    openingTime: "08:30",
    closingTime: "17:30",
    dailyCapacity: 20,
    effectiveStartDate: localIsoDate(),
    effectiveEndDate: "",
    status: "Active",
  };

  const [form, setForm] = useState(emptyForm);

  // Available services for the current form department
  const formServiceOptions = getServicesForDept(form.departmentId);

  // Handle department change in form
  const handleDeptChange = (departmentId) => {
    setForm((prev) => ({
      ...prev,
      departmentId,
      serviceId: ALL_SERVICES,
    }));
  };

  const formatDaysDisplay = formatWorkingDays;

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleOpenEdit = (sch) => {
    setEditingSchedule(sch);
    setForm({
      departmentId: sch.departmentId || "",
      serviceId: sch.serviceId || ALL_SERVICES,
      workingDays: sch.workingDays || ["Mon", "Tue", "Wed", "Thu", "Fri"],
      openingTime: sch.openingTime || "08:30",
      closingTime: sch.closingTime || "17:30",
      dailyCapacity: sch.dailyCapacity || 20,
      effectiveStartDate: sch.effectiveStartDate || localIsoDate(),
      effectiveEndDate: sch.effectiveEndDate || "",
      status: sch.status || "Active",
    });
    setModalOpen(true);
  };

  const run = async (action, fn) => {
    try {
      await fn();
      return true;
    } catch (err) {
      const msg = describeError(err, action);
      toast.error(msg, { duration: 5000 });
      return false;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (await run(`delete schedule ${target.id}`, () => deleteSchedule(target.id))) {
      triggerToast(`Schedule ${target.id} deleted successfully.`);
    }
  };

  const toggleNow = async (sch) => {
    const nextStatus = sch.status === "Active" ? "Inactive" : "Active";
    if (await run(`change the status of schedule ${sch.id}`, () => toggleScheduleStatus(sch.id))) {
      triggerToast(`Schedule ${sch.id} marked as ${nextStatus}.`);
    }
  };

  const handleToggleStatus = (sch) => setPending({ kind: "toggle", sch });

  const confirmPending = async () => {
    const p = pending;
    if (p.kind === "toggle") {
      setSaving(true);
      await toggleNow(p.sch);
      setSaving(false);
      setPending(null);
      return;
    }
    await save(p.payload);
    setPending(null);
  };

  const toggleDayInForm = (day) => {
    setForm((prev) => {
      const exists = prev.workingDays.includes(day);
      const updated = exists
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays: ALL_DAYS.filter((d) => updated.includes(d)) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.departmentId) {
      toast.error("Could not save the schedule: choose a department.", { duration: 5000 });
      return;
    }
    if (form.workingDays.length === 0) {
      toast.error("Could not save the schedule: choose at least one working day.", { duration: 5000 });
      return;
    }

    const payload = {
      departmentId: form.departmentId,
      serviceId: form.serviceId || null,
      workingDays: form.workingDays,
      openingTime: form.openingTime,
      closingTime: form.closingTime,
      dailyCapacity: Number(form.dailyCapacity) || 1,
      effectiveStartDate: form.effectiveStartDate || localIsoDate(),
      effectiveEndDate: form.effectiveEndDate || null,
      status: form.status,
    };

    // Changing an existing schedule: confirm, showing appointments booked under it.
    if (editingSchedule) {
      setPending({ kind: "save", sch: editingSchedule, payload });
      return;
    }
    await save(payload);
  };

  const save = async (payload) => {
    setSaving(true);
    const action = editingSchedule ? `update schedule ${editingSchedule.id}` : "create the schedule";
    let saved = null;
    const ok = await run(action, async () => {
      saved = editingSchedule
        ? await updateSchedule(editingSchedule.id, payload)
        : await addSchedule(payload);
    });
    setSaving(false);
    if (!ok) return; // keep the form open so the administrator can correct it
    triggerToast(
      editingSchedule
        ? `Schedule ${editingSchedule.id} updated successfully.`
        : `Schedule ${saved?.id || ""} created successfully.`
    );
    setModalOpen(false);
  };

  // Filtered schedules
  const filteredSchedules = schedules.filter((sch) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      (sch.service || "all services").toLowerCase().includes(term) ||
      (sch.department && sch.department.toLowerCase().includes(term)) ||
      (sch.id && sch.id.toLowerCase().includes(term));

    const matchesDept =
      deptFilter === "ALL" || sch.department?.toLowerCase() === deptFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "ALL" || sch.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Dynamic summary card metrics based on actual schedules
  const totalSchedulesCount = schedules.length;
  const activeSchedulesCount = schedules.filter((s) => s.status === "Active").length;

  // Schedule table columns (TanStack Table via components/ui/DataTable).
  const scheduleColumns = [
    {
      id: "id",
      accessorKey: "id",
      header: "Schedule ID",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-900 bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs border border-slate-200">
          {row.original.id}
        </span>
      ),
    },
    {
      id: "department",
      accessorFn: (sch) => sch.department || "",
      header: "Department",
      sortFn: "text",
      meta: { className: "font-bold text-slate-900" },
      cell: ({ row }) => row.original.department,
    },
    {
      id: "service",
      accessorFn: (sch) => sch.service || "",
      header: "Service",
      sortFn: "text",
      meta: { className: "text-slate-700 font-medium" },
      cell: ({ row }) => row.original.service || <span className="italic text-slate-500">All services (department-wide)</span>,
    },
    {
      id: "workingDays",
      header: "Working Days",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md text-[11px]">
          {formatDaysDisplay(row.original.workingDays)}
        </span>
      ),
    },
    {
      id: "hours",
      accessorKey: "openingTime",
      header: "Operating Hours",
      meta: { className: "font-mono text-slate-700 font-medium" },
      cell: ({ row }) => `${row.original.openingTime} – ${row.original.closingTime}`,
    },
    {
      id: "capacity",
      accessorKey: "dailyCapacity",
      header: "Limit / Service",
      sortFn: "basic",
      meta: { className: "text-slate-600" },
      cell: ({ row }) => (
        <>
          <span className="font-semibold text-slate-900">{row.original.dailyCapacity}</span> slots/day
        </>
      ),
    },
    {
      id: "period",
      accessorKey: "effectiveStartDate",
      header: "Effective Period",
      meta: { className: "text-slate-600 whitespace-nowrap" },
      cell: ({ row }) => {
        const sch = row.original;
        return (
          <>
            <div className="font-medium text-slate-800">From {displayDate(sch.effectiveStartDate)}</div>
            <div className="text-[11px] text-slate-500">
              {sch.effectiveEndDate ? `Until ${displayDate(sch.effectiveEndDate)}` : "No end date"}
            </div>
          </>
        );
      },
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const sch = row.original;
        const isActive = sch.status === "Active";
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(sch)}
            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              isActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
            }`}
            title={`Click to ${isActive ? "deactivate" : "activate"}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isActive ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {isActive ? "Active" : "Inactive"}
          </button>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => {
        const sch = row.original;
        return (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => handleOpenEdit(sch)}
              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all cursor-pointer"
              title="Edit Schedule"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(sch)}
              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
              title="Delete Schedule"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="sm-page">
      <header className="sm-header">
        <div>
          <p className="sm-eyebrow">Schedule Management</p>
          <h1 className="sm-title">Operating Hours</h1>
          <p className="sm-subtitle">
            Working days and opening hours for each department, or for individual services. A department-wide schedule applies
            to every service of the department that has no schedule of its own. Holidays and exceptional days are set in
            Calendar Exceptions.
          </p>
        </div>
        <button type="button" onClick={handleOpenCreate} className="sm-btn sm-btn--primary">
          <Plus aria-hidden="true" />
          Create Schedule
        </button>
      </header>

      {/* A. Summary Cards - Displayed Horizontally */}
      <div
        className="grid-cols-2"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "1rem",
          width: "100%",
        }}
      >
        {/* Card 1: Total Schedules */}
        <div
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem",
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            border: "1px solid #e2e8f0",
          }}
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Schedules</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
              {totalSchedulesCount}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Configured schedules</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Active Schedules */}
        <div
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem",
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            border: "1px solid #e2e8f0",
          }}
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Active Schedules</span>
            <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
              {activeSchedulesCount}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Currently available</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Weekly view: hours in force today for every department */}
      <section className="sm-card" aria-label="Weekly operating hours">
        <div className="sm-card-header">
          <div>
            <h2 className="sm-card-title">Weekly view</h2>
            <p className="sm-card-sub">Operating hours in force today, by department and weekday</p>
          </div>
        </div>
        <div className="sm-table-wrap">
          <table className="sm-table">
            <thead>
              <tr>
                <th>Department</th>
                {ALL_DAYS.map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(departments || [])
                .filter((d) => deptFilter === "ALL" || d.name === deptFilter)
                .map((dept) => {
                  const today = localIsoDate();
                  const inForce = schedules.filter(
                    (s) =>
                      s.departmentId === dept.id &&
                      s.status === "Active" &&
                      s.effectiveStartDate <= today &&
                      (!s.effectiveEndDate || s.effectiveEndDate >= today)
                  );
                  return (
                    <tr key={dept.id}>
                      <td>
                        <b style={{ color: "#0f172a" }}>{dept.name}</b>
                        {inForce.length > 0 && !inForce.some((s) => !s.serviceId) && (
                          <div className="sm-hint">Service schedules only</div>
                        )}
                      </td>
                      {ALL_DAYS.map((day) => {
                        const h = hoursOn(inForce, day);
                        return (
                          <td key={day} className={`sm-hours-cell${h ? "" : " is-off"}`}>
                            {h ? (
                              <>
                                {h.opening}–{h.closing}
                                {h.services ? <div className="sm-hint">{h.services} service{h.services > 1 ? "s" : ""}</div> : null}
                              </>
                            ) : (
                              "Closed"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              {(departments || []).length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="sm-empty">No departments yet: add one in Department Management.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by schedule ID, service, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Departments</option>
              {availableDeptNames.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>

          {(searchTerm || deptFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setDeptFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* B. Schedule List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={filteredSchedules}
          columns={scheduleColumns}
          getRowId={(sch) => sch.id}
          initialSorting={[{ id: "department", desc: false }]}
          itemLabel="schedules"
          minWidth="1080px"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Clock className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {schedules.length === 0
                    ? "No schedules configured yet"
                    : "No schedules match the selected filters"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {schedules.length === 0
                    ? "Configure municipal service operating hours, slot intervals, and daily quotas by clicking 'Create Schedule'."
                    : "Try adjusting your search keywords or resetting the department and status filters."}
                </p>
              </div>
            </div>
          }
        />
      </div>

      {/* C. Create / Edit Schedule Modal */}
      {modalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-panel modal-panel--form modal-panel--wide" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 id="schedule-modal-title" className="text-base font-bold text-slate-900">
                  {editingSchedule ? "Edit Appointment Schedule" : "Create Appointment Schedule"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure department service operating hours and daily limits.
                </p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="modal-close" aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              {/* Department * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={form.departmentId}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {(departments || []).length === 0 && (
                    <option value="" disabled>
                      No departments yet: add one in Department Management
                    </option>
                  )}
                  {(departments || []).map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.serviceId}
                  onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={ALL_SERVICES}>All services (department-wide)</option>
                  {formServiceOptions.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {form.serviceId
                    ? "Citizens can book this service only on the working days, hours and dates set here."
                    : "Applies to every service of the department that has no schedule of its own."}
                </p>
              </div>

              {/* Working Days */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Working Days
                </label>
                <div
                  className="grid-cols-7"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    gap: "0.5rem",
                  }}
                >
                  {ALL_DAYS.map((day) => {
                    const isChecked = form.workingDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDayInForm(day)}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isChecked
                            ? "bg-[#0b2545] text-white border-[#0b2545] shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {isChecked ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{day}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opening Time & Closing Time */}
              <div
                className="grid-cols-2"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    required
                    value={form.openingTime}
                    onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    required
                    value={form.closingTime}
                    onChange={(e) => setForm({ ...form, closingTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Daily Capacity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Daily Appointment Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={form.dailyCapacity}
                  onChange={(e) =>
                    setForm({ ...form, dailyCapacity: parseInt(e.target.value) || 20 })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Bookings per day for each service under this schedule.
                </p>
              </div>

              {/* Effective Start Date & Effective End Date (Optional) */}
              <div
                className="grid-cols-2"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Effective Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.effectiveStartDate}
                    onChange={(e) => setForm({ ...form, effectiveStartDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Effective End Date (Optional)
                  </label>
                  <input
                    type="date"
                    min={form.effectiveStartDate || undefined}
                    value={form.effectiveEndDate}
                    onChange={(e) => setForm({ ...form, effectiveEndDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Schedule Status Radio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Schedule Status
                </label>
                <div className="flex items-center gap-6">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleStatus"
                      value="Active"
                      checked={form.status === "Active"}
                      onChange={() => setForm({ ...form, status: "Active" })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Active</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="scheduleStatus"
                      value="Inactive"
                      checked={form.status === "Inactive"}
                      onChange={() => setForm({ ...form, status: "Inactive" })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Inactive</span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="modal-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="modal-btn modal-btn--primary"
                >
                  {editingSchedule ? "Save Changes" : "Create Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation, with the appointments booked under this schedule */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete schedule?"
          tone="danger"
          confirmLabel="Delete schedule"
          busy={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          impact={impactOf(deleteTarget)}
          message={
            <>
              Schedule <strong>{deleteTarget.id}</strong> ({deleteTarget.department} · {deleteTarget.service || "all services"}) will be
              deleted. Without another schedule in force, citizens can no longer book these services.
            </>
          }
        />
      )}

      {/* Confirmation before saving an edit or deactivating */}
      {pending && (
        <ConfirmDialog
          title={pending.kind === "save" ? "Save changes to this schedule?" : pending.sch.status === "Active" ? "Deactivate schedule?" : "Activate schedule?"}
          tone={pending.kind === "toggle" && pending.sch.status === "Active" ? "danger" : "primary"}
          confirmLabel={pending.kind === "save" ? "Save changes" : pending.sch.status === "Active" ? "Deactivate" : "Activate"}
          busy={saving}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
          impact={pending.kind === "toggle" && pending.sch.status !== "Active" ? null : impactOf(pending.sch)}
          message={
            pending.kind === "save" ? (
              <>
                The new hours apply to bookings made from now on for{" "}
                <strong>{pending.sch.department} · {pending.sch.service || "all services"}</strong>.
              </>
            ) : pending.sch.status === "Active" ? (
              <>
                Citizens will no longer be able to book under schedule <strong>{pending.sch.id}</strong> ({pending.sch.department} ·{" "}
                {pending.sch.service || "all services"}).
              </>
            ) : (
              <>
                Schedule <strong>{pending.sch.id}</strong> will be used for bookings again.
              </>
            )
          }
        />
      )}
    </div>
  );
}
