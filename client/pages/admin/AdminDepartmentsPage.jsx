"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  Building2,
  Plus,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  X,
} from "lucide-react";

export default function AdminDepartmentsPage() {
  const {
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    toggleDepartmentStatus,
    services,
    users,
  } = useStore();

  const [viewMode] = useState("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    buildingRoom: "",
    contactPhone: "+251 11 ",
  });

  const filteredDepts = departments;

  const handleOpenAdd = () => {
    setEditingDept(null);
    setForm({
      name: "",
      code: "",
      description: "",
      buildingRoom: "Building A, Ground Floor",
      contactPhone: "+251 11 ",
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.code) return;

    if (editingDept) {
      updateDepartment(editingDept.id, form);
    } else {
      addDepartment(form);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="w-full text-center">
          <h2 className="text-xl font-bold text-slate-900 text-center">Department Management</h2>
          <p className="text-xs text-slate-500 text-center mt-1">
            Configure Woreda administrative departments, assigned offices, contact lines, and operating statuses.
          </p>
        </div>

        <div className="sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 flex justify-center">
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Add New Department</span>
          </button>
        </div>
      </div>

      {/* Main Content Section */}
      {viewMode === "table" ? (
        /* Department Management Table */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Department Name</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Office</th>
                  <th className="px-5 py-3.5">Contact Phone</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDepts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-slate-400">
                      <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-medium">No departments found matching your criteria</p>
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

                        {/* Description */}
                        <td className="px-5 py-3.5 text-slate-600 max-w-xs md:max-w-md">
                          <p className="line-clamp-2 text-xs leading-relaxed">
                            {dept.description || "No description provided"}
                          </p>
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
                            onClick={() => toggleDepartmentStatus(dept.id)}
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
                                  deleteDepartment?.(dept.id);
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
          {filteredDepts.map((dept) => {
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
                        onClick={() => toggleDepartmentStatus(dept.id)}
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
                            deleteDepartment?.(dept.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mb-1">{dept.name}</h3>
                  <p className="text-xs text-slate-600 mb-4 line-clamp-2 leading-relaxed">
                    {dept.description}
                  </p>

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
          })}
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
                  Department Code (e.g. KBL, LND, TRD) *
                </label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="KBL"
                  className="w-full px-3 py-2 border rounded-lg text-xs uppercase"
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
                  Desk Contact Phone
                </label>
                <input
                  type="text"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Summary of responsibilities..."
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
                  className="px-4 py-2 rounded-lg bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow cursor-pointer"
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
