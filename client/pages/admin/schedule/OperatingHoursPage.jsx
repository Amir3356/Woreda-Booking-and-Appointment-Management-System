// Admin > Schedule Management > Working Hours: one set of working days, opening / closing times
// and lunch break shared by every department of the Woreda, with a daily appointment capacity
// and an effective period.
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { scheduleApi } from "@/api";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import { useCursorList, useEscapeKey } from "@/hooks";
import { addDays, describeError, formatWorkingDays, localIsoDate, displayDate } from "@/utils";
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
} from "lucide-react";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAGE_SIZE = 5;


/** The lunch break line under the working hours in the table. */
const lunchText = (sch) => (sch.lunchStart && sch.lunchEnd ? `Lunch ${sch.lunchStart} – ${sch.lunchEnd}` : "No lunch break");

/** Booked appointments a change to this schedule could affect: from today to its end (or a year ahead). */
function impactOf(sch) {
  const today = localIsoDate();
  const start = sch.effectiveStartDate > today ? sch.effectiveStartDate : today;
  const end = sch.effectiveEndDate || addDays(today, 365);
  // No department = the Woreda-wide schedule: every department is affected.
  return end < start ? null : { from: start, to: end, departmentIds: sch.departmentId ? [sch.departmentId] : [] };
}

export default function OperatingHoursPage() {
  const {
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleScheduleStatus,
  } = useStore();

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Confirmation before saving an edit or deactivating: { kind: "save" | "toggle", sch, payload? }
  const [pending, setPending] = useState(null);
  useEscapeKey(modalOpen && !pending, () => setModalOpen(false));
  const [saving, setSaving] = useState(false);

  const triggerToast = (msg) => {
    toast.success(msg, { duration: 5000 });
  };

  const emptyForm = {
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    openingTime: "08:30",
    closingTime: "17:30",
    lunchStart: "12:30",
    lunchEnd: "13:30",
    dailyCapacity: 20,
    effectiveStartDate: localIsoDate(),
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
      reloadSchedules();
    }
  };

  const toggleNow = async (sch) => {
    const nextStatus = sch.status === "Active" ? "Inactive" : "Active";
    if (await run(`change the status of schedule ${sch.id}`, () => toggleScheduleStatus(sch.id))) {
      triggerToast(`Schedule ${sch.id} marked as ${nextStatus}.`);
      reloadSchedules();
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
    if (form.workingDays.length === 0) {
      toast.error("Could not save the schedule: choose at least one working day.", { duration: 5000 });
      return;
    }
    if (form.closingTime <= form.openingTime) {
      toast.error("Could not save the schedule: closing time must be after opening time.", { duration: 5000 });
      return;
    }
    const hasLunch = Boolean(form.lunchStart || form.lunchEnd);
    if (hasLunch) {
      if (!form.lunchStart || !form.lunchEnd) {
        toast.error("Could not save the schedule: set both the lunch start and end time, or clear both.", { duration: 5000 });
        return;
      }
      if (form.lunchEnd <= form.lunchStart) {
        toast.error("Could not save the schedule: lunch end must be after lunch start.", { duration: 5000 });
        return;
      }
      if (form.lunchStart <= form.openingTime || form.lunchEnd >= form.closingTime) {
        toast.error("Could not save the schedule: the lunch break must fall within the working hours.", { duration: 5000 });
        return;
      }
    }

    const payload = {
      departmentId: null, // the same working hours for every department of the Woreda
      serviceId: null,
      workingDays: form.workingDays,
      openingTime: form.openingTime,
      closingTime: form.closingTime,
      lunchStart: hasLunch ? form.lunchStart : null,
      lunchEnd: hasLunch ? form.lunchEnd : null,
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
    reloadSchedules();
  };

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
      header: "Working Hours",
      meta: { className: "font-mono text-slate-700 font-medium" },
      cell: ({ row }) => (
        <>
          <div>{`${row.original.openingTime} – ${row.original.closingTime}`}</div>
          <div className="text-[11px] text-slate-500">{lunchText(row.original)}</div>
        </>
      ),
    },
    {
      id: "capacity",
      accessorKey: "dailyCapacity",
      header: "Daily Capacity",
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
              Schedule <strong>{deleteTarget.id}</strong> will be deleted. Without another schedule in force,
              citizens can no longer book any department.
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
                The new hours apply to bookings made from now on for <strong>all departments</strong>.
              </>
            ) : pending.sch.status === "Active" ? (
              <>
                Citizens will no longer be able to book under schedule <strong>{pending.sch.id}</strong>.
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
