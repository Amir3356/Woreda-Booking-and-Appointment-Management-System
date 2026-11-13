// Admin > Schedule Management > Working Hours: one set of working days, opening / closing times
// and lunch break shared by every department of the Woreda, with a daily appointment capacity
// and an effective period.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { scheduleApi } from "@/api";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import { useCursorList, useEscapeKey } from "@/hooks";
import { addDays, describeError, formatWorkingDays, localIsoDate, displayDate, displayTime } from "@/utils";
import { ConfirmDialog } from "@/features/schedule";
import {
  Clock,
  Plus,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Search,
  Circle,
  Calendar,
} from "lucide-react";

const DEFAULT_CAPACITY = 20;
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAGE_SIZE = 5;

function isoToDmy(iso) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function dmyToIso(dmy) {
  if (!dmy || typeof dmy !== "string") return null;
  const parts = dmy.split("/");
  if (parts.length !== 3) return null;
  const [dayStr, monthStr, yearStr] = parts;
  if (dayStr.length !== 2 || monthStr.length !== 2 || yearStr.length !== 4) return null;
  const d = Number(dayStr);
  const m = Number(monthStr);
  const y = Number(yearStr);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Custom Date Input matching DD/MM/YYYY with calendar icon on left & picker button on right.
 * Clicking/tapping anywhere opens the interactive date picker so manual number typing is not required.
 */
function ScheduleDateDmyInput({
  id = "effectiveStartDate",
  value,
  onChange,
  required = true,
  ariaLabel = "Effective Start Date",
}) {
  const [text, setText] = useState(() => isoToDmy(value));
  const pickerRef = useRef(null);

  useEffect(() => {
    setText(isoToDmy(value));
  }, [value]);

  const handleNativeChange = (e) => {
    const iso = e.target.value;
    if (iso) {
      setText(isoToDmy(iso));
      onChange(iso);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    let cleaned = val.replace(/[^\d/]/g, "").slice(0, 10);

    // Auto-insert slash after 2 and 5 digits when typing forward
    if (cleaned.length === 2 && !cleaned.includes("/") && val.length > text.length) {
      cleaned = `${cleaned}/`;
    } else if (
      cleaned.length === 5 &&
      (cleaned.match(/\//g) || []).length === 1 &&
      val.length > text.length
    ) {
      cleaned = `${cleaned}/`;
    }

    setText(cleaned);

    const iso = dmyToIso(cleaned);
    if (iso) {
      onChange(iso);
    }
  };

  const handleBlur = () => {
    const iso = dmyToIso(text);
    if (iso) {
      onChange(iso);
      setText(isoToDmy(iso));
    } else if (value) {
      setText(isoToDmy(value));
    } else {
      setText("");
    }
  };

  const openPicker = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try {
      if (pickerRef.current?.showPicker) {
        pickerRef.current.showPicker();
      } else {
        pickerRef.current?.focus();
      }
    } catch {
      pickerRef.current?.focus();
    }
  };

  return (
    <div className="relative flex items-center w-full">
      {/* Left Icon Button - triggers calendar picker */}
      <button
        type="button"
        onClick={openPicker}
        title="Open calendar picker"
        aria-label="Open calendar picker"
        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer z-10"
      >
        <Calendar className="w-4 h-4 text-slate-500 hover:text-slate-800" aria-hidden="true" />
      </button>

      {/* Main Formatted Text Input */}
      <input
        id={id}
        type="text"
        required={required}
        value={text}
        placeholder="DD/MM/YYYY"
        onChange={handleTextChange}
        onBlur={handleBlur}
        onClick={openPicker}
        aria-label={ariaLabel}
        maxLength={10}
        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b2545] focus:border-[#0b2545] cursor-pointer shadow-2xs tabular-nums tracking-wide placeholder:text-slate-400"
      />

      {/* Transparent native date picker layered directly over the left icon */}
      <input
        ref={pickerRef}
        type="date"
        value={value || ""}
        onChange={handleNativeChange}
        tabIndex={-1}
        aria-hidden="true"
        title="Choose date"
        style={{
          position: "absolute",
          left: "0.375rem",
          top: "50%",
          transform: "translateY(-50%)",
          width: "2rem",
          height: "2rem",
          opacity: 0,
          cursor: "pointer",
          zIndex: 20,
          border: "none",
          padding: 0,
          margin: 0,
        }}
      />
    </div>
  );
}



/**
 * Booked appointments a change to this schedule could affect: from today (or its start) to its end,
 * at most one year ahead — the server checks up to 366 days at a time.
 */
function impactOf(sch) {
  const today = localIsoDate();
  const start = sch.effectiveStartDate > today ? sch.effectiveStartDate : today;
  const yearAhead = addDays(start, 364);
  const end = sch.effectiveEndDate && sch.effectiveEndDate < yearAhead ? sch.effectiveEndDate : yearAhead;
  // No department = the Woreda-wide schedule: every department is affected.
  return end < start ? null : { from: start, to: end, departmentIds: sch.departmentId ? [sch.departmentId] : [] };
}

export default function OperatingHoursPage() {
  const {
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleScheduleStatus,
    services: storeServices,
    departments: storeDepartments,
    loadServices,
    loadDepartments,
  } = useStore();

  // Every active service gets its own Daily Appointment Capacity in the schedule form.
  useEffect(() => {
    loadServices().catch(() => {});
    loadDepartments().catch(() => {});
  }, [loadServices, loadDepartments]);
  const departmentName = (id) => (storeDepartments || []).find((d) => d.id === id)?.name || "";
  const capacityServices = (storeServices || [])
    .filter((srv) => srv.isActive)
    .map((srv) => ({ ...srv, departmentName: departmentName(srv.departmentId) }))
    .sort((a, b) => (a.departmentName || "~").localeCompare(b.departmentName || "~") || a.name.localeCompare(b.name));

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSchedulesPage = useCallback(
    ({ cursor, pageSize }) =>
      scheduleApi.list({
        search: searchTerm.trim(),
        cursor,
        pageSize,
      }),
    [searchTerm],
  );

  const {
    items: schedules,
    loading: loadingPage,
    setCursor,
    reload: reloadSchedules,
    pagination,
  } = useCursorList(fetchSchedulesPage, { pageSize: PAGE_SIZE, actionLabel: "load schedules" });

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  // Confirmation before activating / deactivating: { kind: "toggle", sch }
  const [pending, setPending] = useState(null);
  useEscapeKey(modalOpen && !pending, () => setModalOpen(false));
  const [saving, setSaving] = useState(false);

  const triggerToast = (msg) => {
    toast.success(msg, { duration: 6000 });
  };

  const emptyForm = {
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    openingTime: "08:30",
    closingTime: "17:30",
    lunchStart: "12:30",
    lunchEnd: "13:30",
    slotIntervalMinutes: 30,
    capacities: {}, // { serviceId: "20" }; a service not in it shows the default 20
    effectiveStartDate: "",
    effectiveEndDate: "",
    status: "Active",
  };

  const [form, setForm] = useState(emptyForm);

  const formatDaysDisplay = formatWorkingDays;

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleOpenEdit = (sch) => {
    setEditingSchedule(sch);
    setForm({
      workingDays: sch.workingDays || ["Mon", "Tue", "Wed", "Thu", "Fri"],
      openingTime: sch.openingTime || "08:30",
      closingTime: sch.closingTime || "17:30",
      lunchStart: sch.lunchStart || "",
      lunchEnd: sch.lunchEnd || "",
      slotIntervalMinutes: sch.slotIntervalMinutes ?? 30,
      // Each service's own capacity; services without one show the schedule's default.
      capacities: Object.fromEntries(
        (storeServices || []).map((srv) => {
          const own = (sch.serviceCapacities || []).find((c) => c.serviceId === srv.id);
          return [srv.id, String(own ? own.dailyCapacity : sch.dailyCapacity || DEFAULT_CAPACITY)];
        }),
      ),
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
      toast.error(msg, { duration: 6000 });
      return false;
    }
  };

  // The delete icon deletes the schedule straight away (no confirmation dialog).
  const handleDelete = async (target) => {
    if (await run("delete the schedule", () => deleteSchedule(target.id))) {
      triggerToast("Schedule deleted successfully.");
      reloadSchedules();
    }
  };

  const toggleNow = async (sch) => {
    const nextStatus = sch.status === "Active" ? "Inactive" : "Active";
    if (await run("change the schedule status", () => toggleScheduleStatus(sch.id))) {
      triggerToast(`Schedule marked as ${nextStatus}.`);
      reloadSchedules();
    }
  };

  const handleToggleStatus = (sch) => setPending({ kind: "toggle", sch });

  const confirmPending = async () => {
    setSaving(true);
    await toggleNow(pending.sch);
    setSaving(false);
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
    if (form.workingDays.length === 0) {
      toast.error("Could not save the schedule: choose at least one working day.", { duration: 6000 });
      return;
    }
    if (form.closingTime <= form.openingTime) {
      toast.error("Could not save the schedule: closing time must be after opening time.", { duration: 6000 });
      return;
    }
    const hasLunch = Boolean(form.lunchStart || form.lunchEnd);
    if (hasLunch) {
      if (!form.lunchStart || !form.lunchEnd) {
        toast.error("Could not save the schedule: set both the lunch start and end time, or clear both.", { duration: 6000 });
        return;
      }
      if (form.lunchEnd <= form.lunchStart) {
        toast.error("Could not save the schedule: lunch end must be after lunch start.", { duration: 6000 });
        return;
      }
      if (form.lunchStart <= form.openingTime || form.lunchEnd >= form.closingTime) {
        toast.error("Could not save the schedule: the lunch break must fall within the working hours.", { duration: 6000 });
        return;
      }
    }

    // Each service's own Daily Appointment Capacity (whole number, at least 1).
    const serviceCapacities = capacityServices.map((srv) => ({
      serviceId: srv.id,
      dailyCapacity: Number(form.capacities[srv.id] ?? DEFAULT_CAPACITY),
    }));
    const badCapacity = serviceCapacities.find((c) => !Number.isInteger(c.dailyCapacity) || c.dailyCapacity < 1 || c.dailyCapacity > 10000);
    if (badCapacity) {
      const name = capacityServices.find((srv) => srv.id === badCapacity.serviceId)?.name || "a service";
      toast.error(`Could not save the schedule: the Daily Appointment Capacity of ${name} must be a whole number from 1 to 10000.`, { duration: 6000 });
      return;
    }

    const slotInterval = Number(form.slotIntervalMinutes) || 30;
    if (!Number.isInteger(slotInterval) || slotInterval < 5 || slotInterval > 240) {
      toast.error("Could not save the schedule: the Appointment Slot Interval must be a whole number between 5 and 240 minutes.", { duration: 6000 });
      return;
    }

    if (!form.effectiveStartDate) {
      toast.error("Could not save the schedule: please select an Effective Start Date.", { duration: 6000 });
      return;
    }

    const payload = {
      departmentId: null, // the same working hours for every department of the Woreda
      serviceId: null,
      workingDays: form.workingDays,
      openingTime: form.openingTime,
      closingTime: form.closingTime,
      lunchStart: hasLunch ? form.lunchStart : null,
      lunchEnd: hasLunch ? form.lunchEnd : null,
      slotIntervalMinutes: slotInterval,
      dailyCapacity: null, // default for services added later: kept on edit, 20 on create
      serviceCapacities,
      effectiveStartDate: form.effectiveStartDate,
      effectiveEndDate: form.effectiveEndDate || null,
      status: form.status,
    };

    // Create and Save Changes both save straight away (no confirmation dialog).
    await save(payload);
  };

  const save = async (payload) => {
    setSaving(true);
    const action = editingSchedule ? "update the schedule" : "create the schedule";
    const ok = await run(action, () =>
      editingSchedule ? updateSchedule(editingSchedule.id, payload) : addSchedule(payload)
    );
    setSaving(false);
    if (!ok) return; // keep the form open so the administrator can correct it
    triggerToast(editingSchedule ? "Schedule updated successfully." : "Schedule created successfully.");
    setModalOpen(false);
    reloadSchedules();
  };

  // Schedule table columns (TanStack Table via components/ui/DataTable).
  const scheduleColumns = [
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
      id: "openingTime",
      accessorKey: "openingTime",
      header: "Opening Time",
      meta: { className: "text-slate-700 font-medium whitespace-nowrap" },
      cell: ({ row }) => displayTime(row.original.openingTime),
    },
    {
      id: "closingTime",
      accessorKey: "closingTime",
      header: "Closing Time",
      meta: { className: "text-slate-700 font-medium whitespace-nowrap" },
      cell: ({ row }) => displayTime(row.original.closingTime),
    },
    {
      id: "lunchStart",
      accessorFn: (sch) => sch.lunchStart || "",
      header: "Lunch Break Start",
      meta: { className: "text-slate-700 whitespace-nowrap" },
      cell: ({ row }) =>
        row.original.lunchStart ? displayTime(row.original.lunchStart) : <span className="text-slate-400">No break</span>,
    },
    {
      id: "lunchEnd",
      accessorFn: (sch) => sch.lunchEnd || "",
      header: "Lunch Break Stop",
      meta: { className: "text-slate-700 whitespace-nowrap" },
      cell: ({ row }) =>
        row.original.lunchEnd ? displayTime(row.original.lunchEnd) : <span className="text-slate-400">No break</span>,
    },
    {
      id: "slotInterval",
      accessorFn: (sch) => sch.slotIntervalMinutes ?? 30,
      header: "Slot Interval",
      meta: { className: "text-slate-700 whitespace-nowrap" },
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 text-xs">
          {row.original.slotIntervalMinutes ?? 30} mins
        </span>
      ),
    },
    {
      id: "capacity",
      accessorKey: "dailyCapacity",
      header: "Daily Appointment Capacity",
      enableSorting: false,
      sortFn: "basic",
      meta: { className: "text-slate-600" },
      cell: ({ row }) => (
        <>
          {(row.original.serviceCapacities || []).length === 0 ? (
            <>
              <span className="font-semibold text-slate-900">{row.original.dailyCapacity}</span> per service per day
            </>
          ) : (
            (row.original.serviceCapacities || []).map((c) => (
              <div key={c.serviceId} className="whitespace-nowrap">
                {c.service}: <span className="font-semibold text-slate-900">{c.dailyCapacity}</span>/day
              </div>
            ))
          )}
        </>
      ),
    },
    {
      id: "effectiveStartDate",
      accessorKey: "effectiveStartDate",
      header: "Effective Start Date",
      meta: { className: "text-slate-700 whitespace-nowrap" },
      cell: ({ row }) => displayDate(row.original.effectiveStartDate),
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
              onClick={() => handleDelete(sch)}
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
      <header className="sm-header sm-header--centered">
        <p className="sm-subtitle">
          Set weekly working days, opening hours, lunch breaks, and daily booking capacities.
        </p>
        <button type="button" onClick={handleOpenCreate} className="sm-btn sm-btn--primary">
          <Plus aria-hidden="true" />
          Create Schedule
        </button>
      </header>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by schedule ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCursor(0);
            }}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>

        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setCursor(0);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* B. Schedule List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={schedules}
          columns={scheduleColumns}
          getRowId={(sch) => sch.id}
          initialSorting={[]}
          pageSize={null}
          serverPagination={pagination}
          itemLabel="schedules"
          minWidth="1080px"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Clock className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {loadingPage
                    ? "Loading schedules…"
                    : !searchTerm
                      ? "No schedules configured yet"
                      : "No schedules match your search"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {loadingPage
                    ? "Fetching working hours from server..."
                    : !searchTerm
                      ? "Configure municipal service working hours, slot intervals, and daily quotas by clicking 'Create Schedule'."
                      : "Try adjusting your search keywords or clearing the search bar."}
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
                  The same working days, hours and lunch break apply to every department.
                </p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="modal-close" aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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

              {/* Lunch Break */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lunch Break
                </label>
                <div
                  className="grid-cols-2"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">Starts</span>
                    <input
                      type="time"
                      aria-label="Lunch break start"
                      value={form.lunchStart}
                      onChange={(e) => setForm({ ...form, lunchStart: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">Ends</span>
                    <input
                      type="time"
                      aria-label="Lunch break end"
                      value={form.lunchEnd}
                      onChange={(e) => setForm({ ...form, lunchEnd: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Citizens cannot book appointments during the lunch break. Clear both times for no break.
                </p>
              </div>

              {/* Custom Appointment Slot Interval */}
              <div>
                <label htmlFor="slot-interval-minutes" className="block text-xs font-bold text-slate-700 mb-1">
                  Appointment Slot Interval (Minutes)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="slot-interval-minutes"
                    min="5"
                    max="240"
                    step="1"
                    required
                    value={form.slotIntervalMinutes}
                    onChange={(e) => setForm({ ...form, slotIntervalMinutes: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Enter slot interval in minutes (e.g. 30)"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Custom duration for each appointment slot in minutes (e.g. 15, 20, 30, 45, 60). Applied to all public services.
                </p>
              </div>

              {/* Daily Appointment Capacity: one per service */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 text-center">
                  Daily Appointment Capacity per Service
                </label>
                <p className="text-[11px] text-slate-500 mb-2 text-center">
                  The most appointments each service can take per day.
                </p>
                {capacityServices.length === 0 ? (
                  <p className="text-[11px] text-slate-500 text-center">No active services yet: add them in Service Management.</p>
                ) : (
                  <div className="sm-capacity-list">
                    {capacityServices.map((srv) => (
                      <label key={srv.id} className="sm-capacity-row">
                        <span className="sm-capacity-name">
                          <span className="font-semibold text-slate-800">{srv.name}</span>
                          <span className="block text-[11px] text-slate-500">
                            {srv.departmentName || "Not assigned to a department (cannot be booked yet)"}
                          </span>
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          required
                          aria-label={`Daily Appointment Capacity for ${srv.name}`}
                          value={form.capacities[srv.id] ?? String(DEFAULT_CAPACITY)}
                          onChange={(e) => setForm({ ...form, capacities: { ...form.capacities, [srv.id]: e.target.value } })}
                          className="sm-capacity-input px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Effective Start Date */}
              <div>
                <label htmlFor="effectiveStartDate" className="block text-xs font-bold text-slate-700 mb-1">
                  Effective Start Date
                </label>
                <ScheduleDateDmyInput
                  id="effectiveStartDate"
                  required
                  value={form.effectiveStartDate}
                  onChange={(iso) => setForm({ ...form, effectiveStartDate: iso })}
                />
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


      {/* Confirmation before activating / deactivating */}
      {pending && (
        <ConfirmDialog
          title={pending.sch.status === "Active" ? "Deactivate schedule?" : "Activate schedule?"}
          tone={pending.sch.status === "Active" ? "danger" : "primary"}
          confirmLabel={pending.sch.status === "Active" ? "Deactivate" : "Activate"}
          busy={saving}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
          impact={pending.sch.status === "Active" ? impactOf(pending.sch) : null}
          message={
            pending.sch.status === "Active" ? (
              <>
                Citizens will no longer be able to book under this schedule.
              </>
            ) : (
              <>
                This schedule will be used for bookings again.
              </>
            )
          }
        />
      )}
    </div>
  );
}
