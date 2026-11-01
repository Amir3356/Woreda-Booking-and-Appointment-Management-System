"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatETB } from "@/lib/utils";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Edit2,
  X,
  Trash2,
} from "lucide-react";

export default function AdminServicesPage() {
  const { services, departments, addService, updateService, toggleServiceStatus } = useStore();
  const [search, setSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    departmentId: departments[0]?.id || "",
    description: "",
    durationMinutes: 30,
    dailyQuota: 40,
    feeETB: 0,
    processingDays: "Same day",
    requiredDocuments: ["Valid Kebele ID", "Proof of Residence"],
  });

  const [newDocItem, setNewDocItem] = useState("");

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase());
    const matchesDept = selectedDeptFilter === "ALL" || s.departmentId === selectedDeptFilter;
    return matchesSearch && matchesDept;
  });

  const handleOpenAdd = () => {
    setEditingService(null);
    setForm({
      name: "",
      code: "",
      departmentId: departments[0]?.id || "",
      description: "",
      durationMinutes: 30,
      dailyQuota: 40,
      feeETB: 0,
      processingDays: "Same day",
      requiredDocuments: ["Valid Kebele Identification Card", "Passport photograph"],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (srv) => {
    setEditingService(srv);
    setForm({
      name: srv.name,
      code: srv.code,
      departmentId: srv.departmentId,
      description: srv.description,
      durationMinutes: srv.durationMinutes,
      dailyQuota: srv.dailyQuota,
      feeETB: srv.feeETB,
      processingDays: srv.processingDays || "Same day",
      requiredDocuments: srv.requiredDocuments || [],
    });
    setModalOpen(true);
  };

  const handleAddDoc = () => {
    if (!newDocItem.trim()) return;
    setForm({
      ...form,
      requiredDocuments: [...form.requiredDocuments, newDocItem.trim()],
    });
    setNewDocItem("");
  };

  const handleRemoveDoc = (index) => {
    setForm({
      ...form,
      requiredDocuments: form.requiredDocuments.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.departmentId) return;

    if (editingService) {
      updateService(editingService.id, form);
    } else {
      addService(form);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Government Services Catalog</h2>
          <p className="text-xs text-slate-500">
            Define public services, time durations, required document checklists, and daily booking quotas.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-colors"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>Create New Service</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service by name or code..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Service Name</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Daily Quota</th>
                <th className="px-5 py-3">Fee</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.map((service) => {
                const dept = departments.find((d) => d.id === service.departmentId);
                return (
                  <tr key={service.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-700">
                      {service.code}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 max-w-xs">
                      <div>{service.name}</div>
                      <span className="text-[10px] text-slate-400 line-clamp-1 font-normal">
                        {service.description}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{dept?.name || "N/A"}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      {service.durationMinutes} mins
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      {service.dailyQuota} citizens/day
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-700">
                      {formatETB(service.feeETB)}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => toggleServiceStatus(service.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          service.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {service.isActive ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenEdit(service)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                        title="Edit Service"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Service Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingService ? "Edit Service" : "Create New Government Service"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Birth Certificate Registration"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Code *</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="KBL-BRT"
                    className="w-full px-3 py-2 border rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department *</label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Min)</label>
                  <input
                    type="number"
                    min="10"
                    step="5"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Daily Quota</label>
                  <input
                    type="number"
                    min="1"
                    value={form.dailyQuota}
                    onChange={(e) => setForm({ ...form, dailyQuota: parseInt(e.target.value) || 40 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fee (ETB)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.feeETB}
                    onChange={(e) => setForm({ ...form, feeETB: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* Required Documents Checklist Builder */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Required Documents Checklist
                </label>
                <div className="space-y-1.5 mb-2">
                  {form.requiredDocuments.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                      <span>{doc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(idx)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDocItem}
                    onChange={(e) => setNewDocItem(e.target.value)}
                    placeholder="Add document item..."
                    className="flex-1 px-3 py-1.5 border rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddDoc}
                    className="px-3 py-1.5 bg-slate-800 text-white font-bold rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0b2545] hover:bg-[#133b5c] text-white font-bold rounded-lg shadow"
                >
                  {editingService ? "Update Service" : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
