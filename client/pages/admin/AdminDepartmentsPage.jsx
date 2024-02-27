import { useState, useEffect } from "react";
import { useStore } from "@/context";
import { subscribe } from "@/api/realtime";
import { describeError } from "@/utils";
import {
  Building2,
  Plus,
  Phone,
  MapPin,
  Edit2,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";

export default function AdminDepartmentsPage() {
  const {
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    toggleDepartmentStatus,
    loadDepartments,
    services,
    users,
  } = useStore();
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Departments live in department-service: fetch on open and whenever the catalog changes.
  useEffect(() => {
    const refresh = () => loadDepartments().catch((err) => setErrorMsg(describeError(err, "load departments")));
    refresh();
    const offChange = subscribe("catalog.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh);
    return () => {
      offChange();
      offReconnect();
    };
  }, [loadDepartments]);

  const run = async (action, fn) => {
    setErrorMsg("");
    try {
      await fn();
      return true;
    } catch (err) {
      setErrorMsg(describeError(err, action));
      return false;
    }
  };

  const [viewMode] = useState("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    buildingRoom: "",
    contactPhone: "",
  });

  const filteredDepts = departments || [];

  const handleOpenAdd = () => {
    setEditingDept(null);
    setForm({
      name: "",
      code: "",
      description: "",
      buildingRoom: "",
      contactPhone: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      buildingRoom: dept.buildingRoom,
      contactPhone: dept.contactPhone,
    });
    setModalOpen(true);
  };

  const generateDeptCode = (name) => {
    if (!name) return "DEP";
    const words = name.trim().split(/\s+/).filter((w) => !["&", "and", "of", "the"].includes(w.toLowerCase()));
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    }
    const clean = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return (clean.slice(0, 3) || "DEP").padEnd(3, "X");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;

    const payload = {
      ...form,
      name: form.name.trim(),
      code: form.code || editingDept?.code || generateDeptCode(form.name),
    };

    setSaving(true);
    await run(editingDept ? "update the department" : "create the department", () =>
      editingDept ? updateDepartment(editingDept.id, payload) : addDepartment(payload)
    );
    setSaving(false);
    setModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative flex items-center w-full min-h-[48px]" style={{ position: "relative", minHeight: "48px" }}>
        <div className="w-full text-center">
          <h2 className="text-xl font-bold text-slate-900">Department Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure Woreda administrative departments, assigned offices, contact lines, and operating statuses.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
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
          <span>Add New Department</span>
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-px" />
          <span className="flex-1">{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg("")} className="text-red-500 hover:text-red-700 cursor-pointer" aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Section */}
      {viewMode === "table" ? (
        /* Department Management Table */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Department Name</th>
                  <th className="px-5 py-3.5">Office</th>
                  <th className="px-5 py-3.5">Contact Phone</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDepts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                          <Building2 className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">
                            No departments added yet
                          </p>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            Woreda administrative departments, offices, and service desks configured by Central Administration will appear here.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDepts.map((dept) => {
                    return (
                      <tr key={dept.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Department Name */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-800 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                              {dept.code}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block text-xs">
                                {dept.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                Code: {dept.code}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Office */}
                        <td className="px-5 py-3.5 text-slate-600">
                          <div className="flex items-center gap-1.5 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{dept.buildingRoom || "Central Building"}</span>
                          </div>
                        </td>

                        {/* Contact Phone */}
                        <td className="px-5 py-3.5 text-slate-600">
                          <div className="flex items-center gap-1.5 text-xs font-mono">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{dept.contactPhone || "N/A"}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => run(`change the status of "${dept.name}"`, () => toggleDepartmentStatus(dept.id))}
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                              dept.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                            }`}
                            title={`Click to ${dept.isActive ? "deactivate" : "activate"}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                dept.isActive ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {dept.isActive ? "ACTIVE" : "INACTIVE"}
                          </button>
                        </td>

                        {/* Action */}
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(dept)}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all cursor-pointer"
                              title="Edit Department"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete ${dept.name}?`)) {
                                  run(`delete "${dept.name}"`, () => deleteDepartment(dept.id));
                                }
                              }}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
                              title="Delete Department"
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
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepts.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <Building2 className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">
                    No departments added yet
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Woreda administrative departments, offices, and service desks configured by Central Administration will appear here.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            filteredDepts.map((dept) => {
            const deptServices = services.filter((s) => s.departmentId === dept.id);
            const deptOfficers = users.filter((u) => u.departmentId === dept.id);

            return (
              <div
                key={dept.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                  dept.isActive ? "border-slate-200" : "border-slate-200 opacity-60 bg-slate-50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 font-mono font-bold text-xs flex items-center justify-center">
                      {dept.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => run(`change the status of "${dept.name}"`, () => toggleDepartmentStatus(dept.id))}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                          dept.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {dept.isActive ? "ACTIVE" : "INACTIVE"}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(dept)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Edit Department"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete ${dept.name}?`)) {
                            run(`delete "${dept.name}"`, () => deleteDepartment(dept.id));
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mb-3">{dept.name}</h3>

                  <div className="space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{dept.buildingRoom}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{dept.contactPhone}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Services: <strong className="text-slate-900">{deptServices.length}</strong>
                  </span>
                  <span>
                    Staff: <strong className="text-slate-900">{deptOfficers.length || 1}</strong>
                  </span>
                </div>
              </div>
            );
          }))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingDept ? "Edit Department" : "Add New Department"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Kebele Administration Office"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Office Location (Building & Room)
                </label>
                <input
                  type="text"
                  value={form.buildingRoom}
                  onChange={(e) => setForm({ ...form, buildingRoom: e.target.value })}
                  placeholder="Building A, Room 102"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="+251 11 551 2341"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg disabled:opacity-60 bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow cursor-pointer"
                >
                  {editingDept ? "Update Department" : "Save Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
