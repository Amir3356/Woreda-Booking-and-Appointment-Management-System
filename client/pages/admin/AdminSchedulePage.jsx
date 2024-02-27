import { useState, useEffect } from "react";
import { useStore } from "@/context";
import { subscribe } from "@/api/realtime";
import { describeError, formatWorkingDays, localIsoDate, displayDate } from "@/utils";
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Search,
  Filter,
  Circle,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Department-wide schedule: applies to every service of the department that has no schedule of its own.
const ALL_SERVICES = "";

export default function AdminSchedulePage() {
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
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Schedules live in booking-service. Re-read them (and the departments/services the form
  // offers) when the page opens and whenever the server announces a catalog change.
  useEffect(() => {
    const refresh = () => {
      loadSchedules().catch((err) => setErrorMsg(describeError(err, "load schedules")));
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
    setErrorMsg("");
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg("");
    }, 3500);
  };

  // Department names for the table filter
  const availableDeptNames = (departments || []).map((d) => d.name);

  // Services of a department (from Admin > Services Management)
  const getServicesForDept = (departmentId) =>
    (services || []).filter((s) => s.departmentId === departmentId);

  const emptyForm = {
    departmentId: departments?.[0]?.id || "",
    serviceId: getServicesForDept(departments?.[0]?.id)[0]?.id || ALL_SERVICES,
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
      serviceId: getServicesForDept(departmentId)[0]?.id || ALL_SERVICES,
    }));
  };

  const formatDaysDisplay = formatWorkingDays;

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setForm(emptyForm);
    setErrorMsg("");
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
    setErrorMsg("");
    setModalOpen(true);
  };

  const run = async (action, fn) => {
    try {
      await fn();
      return true;
    } catch (err) {
      setErrorMsg(describeError(err, action));
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

  const handleToggleStatus = async (sch) => {
    const nextStatus = sch.status === "Active" ? "Inactive" : "Active";
    if (await run(`change the status of schedule ${sch.id}`, () => toggleScheduleStatus(sch.id))) {
      triggerToast(`Schedule ${sch.id} marked as ${nextStatus}.`);
    }
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
      setErrorMsg("Could not save the schedule: choose a department.");
      return;
    }
    if (form.workingDays.length === 0) {
      setErrorMsg("Could not save the schedule: choose at least one working day.");
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Title, Description, and Create Schedule Button at the right edge */}
      <div
        className="relative flex items-center w-full min-h-[48px]"
        style={{ position: "relative", minHeight: "48px" }}
      >
        <div className="w-full text-center">
          <h2 className="text-xl font-bold text-slate-900">Schedule Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure working days, operating hours, and daily capacity.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-colors cursor-pointer shrink-0"
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>Create Schedule</span>
        </button>
      </div>

      {/* Success Toast Notification */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-xs animate-in fade-in duration-150">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && !modalOpen && (
        <div role="alert" className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-px" />
          <span className="flex-1">{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg("")} className="text-red-500 hover:text-red-700 cursor-pointer" aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Schedule ID</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Service</th>
                <th className="px-5 py-3.5">Working Days</th>
                <th className="px-5 py-3.5">Operating Hours</th>
                <th className="px-5 py-3.5">Daily Capacity</th>
                <th className="px-5 py-3.5">Effective Period</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
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
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((sch) => {
                  const isActive = sch.status === "Active";
                  return (
                    <tr key={sch.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Schedule ID */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs border border-slate-200">
                          {sch.id}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {sch.department}
                      </td>

                      {/* Service */}
                      <td className="px-5 py-3.5 text-slate-700 font-medium">
                        {sch.service || <span className="italic text-slate-500">All services (department-wide)</span>}
                      </td>

                      {/* Working Days */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md text-[11px]">
                          {formatDaysDisplay(sch.workingDays)}
                        </span>
                      </td>

                      {/* Operating Hours */}
                      <td className="px-5 py-3.5 font-mono text-slate-700 font-medium">
                        {sch.openingTime} – {sch.closingTime}
                      </td>

                      {/* Daily Capacity */}
                      <td className="px-5 py-3.5 text-slate-600">
                        <span className="font-semibold text-slate-900">{sch.dailyCapacity}</span> slots/day
                      </td>

                      {/* Effective Period */}
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        <div className="font-medium text-slate-800">From {displayDate(sch.effectiveStartDate)}</div>
                        <div className="text-[11px] text-slate-500">
                          {sch.effectiveEndDate ? `Until ${displayDate(sch.effectiveEndDate)}` : "No end date"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
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
                      </td>

                      {/* Actions: Edit, Delete */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(sch)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all cursor-pointer"
                            title="Edit Schedule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(sch)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
                            title="Delete Schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* C. Create / Edit Schedule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingSchedule ? "Edit Appointment Schedule" : "Create Appointment Schedule"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure department service operating hours and daily limits.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              {errorMsg && (
                <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-px" />
                  <span className="flex-1">{errorMsg}</span>
                </div>
              )}
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
                  {formServiceOptions.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name}
                    </option>
                  ))}
                  <option value={ALL_SERVICES}>All services in this department</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Citizens can book this service only on the working days, hours and dates set here.
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
                  Daily Capacity (Slots)
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-xs font-bold disabled:opacity-60 bg-[#0b2545] hover:bg-[#133b5c] text-white rounded-xl shadow transition-colors cursor-pointer"
                >
                  {editingSchedule ? "Save Changes" : "Create Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Schedule</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete schedule{" "}
                <span className="font-semibold text-slate-800">{deleteTarget.id}</span> ({deleteTarget.service || "all services"})?
                This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
