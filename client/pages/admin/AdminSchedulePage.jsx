import { useState } from "react";
import { useStore } from "@/context";
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
} from "lucide-react";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_FALLBACK_DEPTS = [
  "Kebele Administration & Vital Events",
  "Land Administration & Urban Development",
  "Trade, Industry & Enterprise Development",
  "Revenue & Tax Administration",
  "Social Welfare & Community Services",
  "Public Health & Sanitation Desk",
  "General Municipal Desk",
];

const DEFAULT_SERVICES_BY_DEPT = {
  "Kebele Administration & Vital Events": [
    "Kebele Digital ID Registration & Issuance",
    "Residence Certificate (Melkeya)",
    "Vital Statistics (Birth, Death, Marriage)",
  ],
  "Land Administration & Urban Development": [
    "Landholding Rights Verification & Mapping",
    "Building Permit Pre-Check & Site Inspection",
    "Title Deed Transfer & Cadastral Updates",
  ],
  "Trade, Industry & Enterprise Development": [
    "Annual Trade License Renewal",
    "Micro & Small Enterprise (MSE) Registration",
    "Commercial Grade Inspection Certification",
  ],
  "Revenue & Tax Administration": [
    "Taxpayer Identification & Assessment",
    "Municipal Business Tax Clearance",
    "Property Tax Assessment & Filing",
  ],
  "Social Welfare & Community Services": [
    "Safety Net & Social Assistance Enrollment",
    "Elderly & Disability Support Certification",
  ],
  "Public Health & Sanitation Desk": [
    "Sanitation Inspection & Clearance",
    "Food Handlers Health Certification",
  ],
  "General Municipal Desk": [
    "General Public Consultation & Appointments",
    "Document Certification & Authentication",
    "Public Grievance & Inquiries",
  ],
};

export default function AdminSchedulePage() {
  const {
    departments,
    services,
    schedules: storeSchedules,
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

  const triggerToast = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg("");
    }, 3500);
  };

  // Derive available department options (real departments or fallbacks)
  const realDeptNames = (departments || []).map((d) => d.name);
  const availableDeptNames = realDeptNames.length > 0 ? realDeptNames : DEFAULT_FALLBACK_DEPTS;

  // Helper to get available services for a given department name
  const getServicesForDept = (deptName) => {
    const matchedDept = (departments || []).find((d) => d.name === deptName);
    const storeDeptServices = (services || [])
      .filter((s) => (matchedDept ? s.departmentId === matchedDept.id : s.departmentName === deptName))
      .map((s) => s.name);

    if (storeDeptServices.length > 0) {
      return storeDeptServices;
    }
    return DEFAULT_SERVICES_BY_DEPT[deptName] || [
      "General Public Consultation & Appointments",
      "Document Certification & Authentication",
    ];
  };

  // Form State
  const initialDept = availableDeptNames[0] || "";
  const initialSrv = getServicesForDept(initialDept)[0] || "";

  const emptyForm = {
    department: initialDept,
    service: initialSrv,
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    openingTime: "08:00",
    closingTime: "17:00",
    slotDuration: 20,
    dailyCapacity: 20,
    effectiveStartDate: "",
    effectiveEndDate: "",
    status: "Active",
  };

  const [form, setForm] = useState(emptyForm);

  // Available services for the current form department
  const formServiceOptions = getServicesForDept(form.department);

  // Handle department change in form
  const handleDeptChange = (newDept) => {
    const nextServices = getServicesForDept(newDept);
    setForm((prev) => ({
      ...prev,
      department: newDept,
      service: nextServices[0] || "",
    }));
  };

  // Format working days for display (e.g. "Mon–Fri")
  const formatDaysDisplay = (days) => {
    if (!days || days.length === 0) return "None";
    if (days.length === 7) return "Daily (Mon–Sun)";
    if (
      days.length === 5 &&
      days.includes("Mon") &&
      days.includes("Tue") &&
      days.includes("Wed") &&
      days.includes("Thu") &&
      days.includes("Fri")
    ) {
      return "Mon–Fri";
    }
    if (
      days.length === 4 &&
      days.includes("Mon") &&
      days.includes("Tue") &&
      days.includes("Wed") &&
      days.includes("Thu")
    ) {
      return "Mon–Thu";
    }
    if (
      days.length === 6 &&
      days.includes("Mon") &&
      days.includes("Tue") &&
      days.includes("Wed") &&
      days.includes("Thu") &&
      days.includes("Fri") &&
      days.includes("Sat")
    ) {
      return "Mon–Sat";
    }
    return days.join(", ");
  };

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    const defDept = availableDeptNames[0] || "";
    const defSrv = getServicesForDept(defDept)[0] || "";
    setForm({
      ...emptyForm,
      department: defDept,
      service: defSrv,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (sch) => {
    setEditingSchedule(sch);
    setForm({
      department: sch.department || availableDeptNames[0] || "",
      service: sch.service || "",
      workingDays: sch.workingDays || ["Mon", "Tue", "Wed", "Thu", "Fri"],
      openingTime: sch.openingTime || "08:00",
      closingTime: sch.closingTime || "17:00",
      slotDuration: sch.slotDuration || 20,
      dailyCapacity: sch.dailyCapacity || 20,
      effectiveStartDate: sch.effectiveStartDate || "",
      effectiveEndDate: sch.effectiveEndDate || "",
      status: sch.status || "Active",
    });
    setModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteSchedule?.(deleteTarget.id);
    triggerToast(`Schedule ${deleteTarget.id} deleted successfully.`);
    setDeleteTarget(null);
  };

  const handleToggleStatus = (sch) => {
    toggleScheduleStatus?.(sch.id);
    const nextStatus = sch.status === "Active" ? "Inactive" : "Active";
    triggerToast(`Schedule ${sch.id} marked as ${nextStatus}.`);
  };

  const toggleDayInForm = (day) => {
    setForm((prev) => {
      const exists = prev.workingDays.includes(day);
      const updated = exists
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays: updated };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.department || !form.service) {
      alert("Please select both a Department and a Service.");
      return;
    }

    const workingDaysDisplay = formatDaysDisplay(form.workingDays);

    // Map relational departmentId and serviceId
    const matchedDept = (departments || []).find((d) => d.name === form.department);
    const matchedSrv = (services || []).find((s) => s.name === form.service);
    const departmentId = matchedDept ? matchedDept.id : `dept-${form.department.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}`;
    const serviceId = matchedSrv ? matchedSrv.id : `srv-${form.service.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}`;

    if (editingSchedule) {
      updateSchedule?.(editingSchedule.id, {
        ...form,
        departmentId,
        serviceId,
        workingDaysDisplay,
      });
      triggerToast(`Schedule ${editingSchedule.id} updated successfully.`);
    } else {
      // Generate guaranteed unique schedule ID that avoids legacy mock IDs
      const uniqueSuffix = Date.now().toString().slice(-5);
      const newId = `SCH-${uniqueSuffix}`;
      const newSchedule = {
        id: newId,
        ...form,
        departmentId,
        serviceId,
        workingDaysDisplay,
      };
      addSchedule?.(newSchedule);
      triggerToast(`Schedule ${newId} created successfully.`);
    }

    setModalOpen(false);
  };

  // Filtered schedules
  const filteredSchedules = schedules.filter((sch) => {
    const matchesSearch =
      (sch.service && sch.service.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sch.department && sch.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sch.id && sch.id.toLowerCase().includes(searchTerm.toLowerCase()));

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
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
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
                        {sch.service}
                      </td>

                      {/* Working Days */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md text-[11px]">
                          {sch.workingDaysDisplay || formatDaysDisplay(sch.workingDays)}
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
              {/* Department * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={form.department}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableDeptNames.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
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
                  required
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {formServiceOptions.map((srv) => (
                    <option key={srv} value={srv}>
                      {srv}
                    </option>
                  ))}
                </select>
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
                  className="px-5 py-2.5 text-xs font-bold bg-[#0b2545] hover:bg-[#133b5c] text-white rounded-xl shadow transition-colors cursor-pointer"
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
                <span className="font-semibold text-slate-800">{deleteTarget.id}</span> ({deleteTarget.service})?
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
