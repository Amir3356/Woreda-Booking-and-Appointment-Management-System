import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { subscribe } from "@/api/realtime";
import { describeError } from "@/utils";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Edit2,
  X,
  Trash2,
  AlertCircle,
} from "lucide-react";

export default function AdminServicesPage() {
  const {
    services,
    departments,
    addService,
    updateService,
    toggleServiceStatus,
    deleteService,
    loadServices,
    loadDepartments,
    servicesLoaded,
  } = useStore();
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // The catalog lives in department-service; fetch it when this page opens and whenever the
  // server announces a change (e.g. another administrator edited a service).
  useEffect(() => {
    const refresh = () => {
      loadServices().catch((err) => setErrorMsg(describeError(err, "load services")));
      loadDepartments().catch((err) => setErrorMsg(describeError(err, "load departments")));
    };
    refresh();
    const offChange = subscribe("catalog.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh);
    return () => {
      offChange();
      offReconnect();
    };
  }, [loadServices, loadDepartments]);

  const showSuccess = (msg) => {
    setErrorMsg("");
    toast.success(msg);
  };
  const [search, setSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [form, setForm] = useState({
    name: "",
    departmentId: departments[0]?.id || "",
  });

  const filteredServices = (services || []).filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesDept = selectedDeptFilter === "ALL" || s.departmentId === selectedDeptFilter;
    return matchesSearch && matchesDept;
  });

  const handleOpenAdd = () => {
    setEditingService(null);
    setForm({
      name: "",
      departmentId: departments[0]?.id || "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (srv) => {
    setEditingService(srv);
    setForm({
      name: srv.name,
      departmentId: srv.departmentId || departments[0]?.id || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;

    const targetDeptId = form.departmentId || departments[0]?.id || "";
    if (!departments.some((d) => d.id === targetDeptId)) {
      setErrorMsg("Could not save the service: choose an existing department.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      departmentId: targetDeptId,
      code: editingService?.code || `SRV-${Date.now().toString(36).toUpperCase()}`,
      durationMinutes: editingService?.durationMinutes || 30,
      dailyQuota: editingService?.dailyQuota || 40,
      feeETB: editingService?.feeETB || 0,
      processingDays: editingService?.processingDays || "Same day",
      requiredDocuments: editingService?.requiredDocuments || ["Valid Kebele ID"],
    };

    setSaving(true);
    try {
      if (editingService) {
        await updateService(editingService.id, payload);
        showSuccess(`Service "${payload.name}" updated successfully.`);
      } else {
        await addService(payload);
        showSuccess(`Service "${payload.name}" created successfully.`);
      }
      setModalOpen(false);
      setEditingService(null);
    } catch (err) {
      setErrorMsg(describeError(err, editingService ? "update the service" : "create the service"));
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Are you sure you want to delete "${service.name}"?`)) return;
    try {
      await deleteService(service.id);
      showSuccess(`Service "${service.name}" deleted.`);
    } catch (err) {
      setErrorMsg(describeError(err, `delete "${service.name}"`));
    }
  };

  const handleToggleStatus = async (service) => {
    try {
      await toggleServiceStatus(service.id);
      showSuccess(`Service "${service.name}" is now ${!service.isActive ? "ACTIVE" : "INACTIVE"}.`);
    } catch (err) {
      setErrorMsg(describeError(err, `change the status of "${service.name}"`));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative flex items-center w-full min-h-[48px]" style={{ position: "relative", minHeight: "48px" }}>
        <div className="w-full text-center">
          <h2 className="text-xl font-bold text-slate-900">Service Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage Woreda public services, assigned departments, and operating statuses.
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
          <span>Add New Service</span>
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service by name..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer"
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
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Service Name</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileText className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">
                          {servicesLoaded ? "No services added yet" : "Loading services…"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Public services and department counter designations configured by Central Administration will appear here.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => {
                  const dept = departments.find((d) => d.id === service.departmentId);
                  return (
                    <tr key={service.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900 max-w-xs">
                        {service.name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {dept?.name || "Unknown department"}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleToggleStatus(service)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                            service.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {service.isActive ? "ACTIVE" : "INACTIVE"}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(service)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all cursor-pointer"
                            title="Edit Service"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(service)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
                            title="Delete Service"
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

      {/* Add / Edit Service Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-900">
                {editingService ? "Edit Service" : "Create New Government Service"}
              </h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setEditingService(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Service Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Birth Certificate Registration"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Assigned Department *</label>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-white cursor-pointer"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                  {!departments.some((d) => d.id === form.departmentId) && (
                    <option value={form.departmentId} disabled>
                      {form.departmentId ? "Department no longer exists: choose another" : "Choose a department"}
                    </option>
                  )}
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingService(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                >
                  {saving ? "Saving…" : editingService ? "Save Changes" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
