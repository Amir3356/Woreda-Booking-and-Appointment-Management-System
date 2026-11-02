import { useState } from "react";
import { useStore } from "@/context";
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  X,
  Layers,
  Users,
  Check,
  Circle,
  Building2,
  FileText,
} from "lucide-react";

// Initial benchmark schedule items reflecting user specifications and municipal departments
const INITIAL_SCHEDULES = [
  {
    id: "SCH-001",
    department: "Health",
    service: "Medical Certificate",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingDaysDisplay: "Mon–Fri",
    openingTime: "08:00",
    closingTime: "17:00",
    slotDuration: 20,
    dailyCapacity: 25,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-002",
    department: "Finance",
    service: "Tax Clearance",
    workingDays: ["Mon", "Tue", "Wed", "Thu"],
    workingDaysDisplay: "Mon–Thu",
    openingTime: "08:30",
    closingTime: "16:30",
    slotDuration: 30,
    dailyCapacity: 20,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-003",
    department: "Education",
    service: "Student Registration",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingDaysDisplay: "Mon–Fri",
    openingTime: "08:00",
    closingTime: "16:00",
    slotDuration: 20,
    dailyCapacity: 30,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-004",
    department: "Civil Registration",
    service: "Birth Certificate",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingDaysDisplay: "Mon–Fri",
    openingTime: "08:30",
    closingTime: "17:00",
    slotDuration: 15,
    dailyCapacity: 40,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-005",
    department: "Kebele Administration & Vital Events",
    service: "Kebele Digital ID Registration",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingDaysDisplay: "Mon–Fri",
    openingTime: "08:30",
    closingTime: "17:30",
    slotDuration: 30,
    dailyCapacity: 45,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-006",
    department: "Land Administration & Urban Development",
    service: "Landholding Rights Verification",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingDaysDisplay: "Mon–Fri",
    openingTime: "08:30",
    closingTime: "17:00",
    slotDuration: 45,
    dailyCapacity: 20,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-007",
    department: "Trade, Industry & Enterprise Development",
    service: "Annual Trade License Renewal",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingDaysDisplay: "Mon–Fri",
    openingTime: "08:30",
    closingTime: "16:30",
    slotDuration: 30,
    dailyCapacity: 25,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-008",
    department: "Revenue & Tax Administration",
    service: "Annual Business Tax Declaration",
    workingDays: ["Mon", "Tue", "Wed", "Thu"],
    workingDaysDisplay: "Mon–Thu",
    openingTime: "08:30",
    closingTime: "17:00",
    slotDuration: 30,
    dailyCapacity: 35,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-009",
    department: "Social Affairs & Community Welfare",
    service: "Social Protection & Pension Registry",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingDaysDisplay: "Mon–Fri",
    openingTime: "08:30",
    closingTime: "17:00",
    slotDuration: 30,
    dailyCapacity: 20,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Active",
  },
  {
    id: "SCH-010",
    department: "Sanitation & Environmental Protection",
    service: "Municipal Commercial Sanitation Clearance",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingDaysDisplay: "Mon–Fri",
    openingTime: "08:30",
    closingTime: "16:30",
    slotDuration: 20,
    dailyCapacity: 20,
    effectiveStartDate: "2026-01-01",
    effectiveEndDate: "",
    status: "Inactive",
  },
];

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_DEPARTMENTS = [
  "Health",
  "Finance",
  "Education",
  "Civil Registration",
  "Kebele Administration & Vital Events",
  "Land Administration & Urban Development",
  "Trade, Industry & Enterprise Development",
  "Revenue & Tax Administration",
  "Social Affairs & Community Welfare",
  "Sanitation & Environmental Protection",
];

const DEFAULT_SERVICES = [
  "Medical Certificate",
  "Tax Clearance",
  "Student Registration",
  "Birth Certificate",
  "Kebele Digital ID Registration",
  "Landholding Rights Verification",
  "Annual Trade License Renewal",
  "Annual Business Tax Declaration",
  "Social Protection & Pension Registry",
  "Municipal Commercial Sanitation Clearance",
];

export default function AdminSchedulePage() {
  const { departments, services } = useStore();

  const [schedules, setSchedules] = useState(INITIAL_SCHEDULES);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Form State matching Create Appointment Schedule modal
  const emptyForm = {
    department: "",
    service: "",
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

  // Available options merging store and defaults
  const deptOptions = Array.from(
    new Set([
      ...DEFAULT_DEPARTMENTS,
      ...(departments || []).map((d) => d.name),
    ])
  );

  const serviceOptions = Array.from(
    new Set([
      ...DEFAULT_SERVICES,
      ...(services || []).map((s) => s.name),
    ])
  );

  // Working days helper to generate clean display like "Mon–Fri"
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
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleOpenEdit = (sch) => {
    setEditingSchedule(sch);
    setForm({
      department: sch.department,
      service: sch.service,
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

  const handleOpenView = (sch) => {
    setSelectedSchedule(sch);
    setViewModalOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleToggleStatus = (id) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "Active" ? "Inactive" : "Active" }
          : s
      )
    );
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

    if (editingSchedule) {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === editingSchedule.id
            ? {
                ...s,
                ...form,
                workingDaysDisplay,
              }
            : s
        )
      );
    } else {
      const nextNum = schedules.length + 1;
      const newId = `SCH-${String(nextNum).padStart(3, "0")}`;
      const newSchedule = {
        id: newId,
        ...form,
        workingDaysDisplay,
      };
      setSchedules((prev) => [newSchedule, ...prev]);
    }

    setModalOpen(false);
  };

  // Top summary card metrics as specified by the user
  const totalSchedulesCount = 24;
  const activeSchedulesCount = 20;

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
            Configure working days, operating hours, slot duration, and daily capacity.
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
            <span className="text-[11px] text-slate-400 mt-0.5 block">Registered schedules</span>
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
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center text-slate-400">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium">No schedules configured</p>
                  </td>
                </tr>
              ) : (
                schedules.map((sch) => {
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
                          onClick={() => handleToggleStatus(sch.id)}
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

                      {/* Actions: View, Edit, Delete */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => handleOpenView(sch)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all cursor-pointer"
                            title="View Schedule"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

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
                            onClick={() => handleDelete(sch.id)}
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
                  Configure department service operating hours, slot duration, and daily limits.
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
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select department</option>
                  {deptOptions.map((dept) => (
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
                  <option value="">Select service</option>
                  {serviceOptions.map((srv) => (
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
                  Daily Capacity
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

      {/* View Schedule Details Modal */}
      {viewModalOpen && selectedSchedule && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200">
                  {selectedSchedule.id}
                </span>
                <h3 className="text-base font-bold text-slate-900">Schedule Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 py-4 text-xs">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 text-[11px] block">Department</span>
                  <span className="font-bold text-slate-900">{selectedSchedule.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Service</span>
                  <span className="font-bold text-slate-900">{selectedSchedule.service}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 text-[11px] block">Working Days</span>
                  <span className="font-semibold text-slate-800">
                    {selectedSchedule.workingDaysDisplay ||
                      formatDaysDisplay(selectedSchedule.workingDays)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Operating Hours</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedSchedule.openingTime} – {selectedSchedule.closingTime}
                  </span>
                </div>
              </div>

              <div className="pb-3 border-b border-slate-100">
                <span className="text-slate-400 text-[11px] block">Daily Capacity</span>
                <span className="font-semibold text-slate-800">
                  {selectedSchedule.dailyCapacity} appointments/day
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 text-[11px] block">Effective Start Date</span>
                  <span className="font-semibold text-slate-800">
                    {selectedSchedule.effectiveStartDate || "Immediate"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Effective End Date</span>
                  <span className="font-semibold text-slate-800">
                    {selectedSchedule.effectiveEndDate || "Open-ended (No expiry)"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block mb-1">Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    selectedSchedule.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-300"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedSchedule.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  {selectedSchedule.status}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
