import { useState, useEffect } from "react";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
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
    loadServices,
    updateService,
    users,
  } = useStore();
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Departments live in department-service: fetch on open and whenever the catalog changes.
  useEffect(() => {
    const refresh = () => {
      loadDepartments().catch((err) => setErrorMsg(describeError(err, "load departments")));
      loadServices().catch((err) => setErrorMsg(describeError(err, "load services")));
    };
    refresh();
    const offChange = subscribe("catalog.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh);
    return () => {
      offChange();
      offReconnect();
    };
  }, [loadDepartments, loadServices]);

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

  // Escape closes the add / edit dialog.
  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    buildingRoom: "",
    contactPhone: "",
    serviceIds: [],
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
      serviceIds: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    const deptServiceIds = (services || []).filter((s) => s.departmentId === dept.id).map((s) => s.id);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      buildingRoom: dept.buildingRoom,
      contactPhone: dept.contactPhone,
      serviceIds: deptServiceIds,
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

  // Department table columns (TanStack Table via components/ui/DataTable).
  const departmentColumns = [
    {
      id: "name",
      accessorKey: "name",
      header: "Department Name",
      sortFn: "text",
      cell: ({ row }) => {
        const dept = row.original;
        return (
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
        );
      },
    },
    {
      id: "office",
      accessorFn: (d) => d.buildingRoom || "",
      header: "Office",
      sortFn: "text",
      meta: { className: "text-slate-600" },
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{row.original.buildingRoom || "Central Building"}</span>
        </div>
      ),
    },
    {
      id: "phone",
      accessorFn: (d) => d.contactPhone || "",
      header: "Contact Phone",
      meta: { className: "text-slate-600" },
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{row.original.contactPhone || "N/A"}</span>
        </div>
      ),
    },
    {
      id: "status",
      accessorFn: (d) => (d.isActive ? "Active" : "Inactive"),
      header: "Status",
      cell: ({ row }) => {
        const dept = row.original;
        return (
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
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => {
        const dept = row.original;
        return (
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
        );
      },
    },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;

    const payload = {
      name: form.name.trim(),
      code: form.code || editingDept?.code || generateDeptCode(form.name),
      description: form.description || "",
      buildingRoom: form.buildingRoom || "Building A, Room 101",
      contactPhone: form.contactPhone || "+251 11 551 2341",
      serviceIds: form.serviceIds || [],
    };

    setSaving(true);
    const ok = await run(editingDept ? "update the department" : "create the department", async () => {
      let deptId = editingDept?.id;
      if (editingDept) {
        await updateDepartment(editingDept.id, payload);
      } else {
        const created = await addDepartment(payload);
        deptId = created?.id;
      }

      // Ensure all selected services are updated with this departmentId
      if (deptId && form.serviceIds) {
        const currentAssigned = (services || []).filter((s) => s.departmentId === deptId).map((s) => s.id);
        const toAdd = form.serviceIds.filter((id) => !currentAssigned.includes(id));
        const toRemove = currentAssigned.filter((id) => !form.serviceIds.includes(id));

        for (const sId of toAdd) {
          const s = services.find((srv) => srv.id === sId);
          if (s && s.departmentId !== deptId) {
            await updateService(sId, { ...s, departmentId: deptId });
          }
        }
        for (const sId of toRemove) {
          const s = services.find((srv) => srv.id === sId);
          if (s) {
            await updateService(sId, { ...s, departmentId: null });
          }
        }
      }
    });
    setSaving(false);
    if (ok) setModalOpen(false);
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
          <DataTable
            data={filteredDepts}
            columns={departmentColumns}
            getRowId={(d) => d.id}
            initialSorting={[{ id: "name", desc: false }]}
            itemLabel="departments"
            emptyState={
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
            }
          />
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
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="dept-modal-title">
            <div className="modal-header">
              <div>
                <h3 id="dept-modal-title" className="modal-title">
                  {editingDept ? "Edit Department" : "Add New Department"}
                </h3>
                <p className="modal-subtitle">
                  {editingDept
                    ? "Update the department's name, office and contact line."
                    : "Citizens will see this department when they book a service."}
                </p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="modal-close" aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="modal-field">
                  <label htmlFor="dept-name" className="modal-label">
                    Department Name <span className="modal-required">*</span>
                  </label>
                  <input
                    id="dept-name"
                    type="text"
                    required
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Kebele Administration Office"
                    className="modal-input"
                  />
                </div>

                <div className="modal-field">
                  <label htmlFor="dept-room" className="modal-label">
                    Office Location
                  </label>
                  <input
                    id="dept-room"
                    type="text"
                    value={form.buildingRoom}
                    onChange={(e) => setForm({ ...form, buildingRoom: e.target.value })}
                    placeholder="Building A, Room 102"
                    className="modal-input"
                  />
                </div>

                <div className="modal-field">
                  <label htmlFor="dept-phone" className="modal-label">
                    Contact Phone
                  </label>
                  <input
                    id="dept-phone"
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="+251 11 551 2341"
                    className="modal-input"
                  />
                </div>

                <div className="modal-field">
                  <label htmlFor="dept-services" className="modal-label">
                    Services
                  </label>
                  <select
                    id="dept-services"
                    value=""
                    onChange={(e) => {
                      const sId = e.target.value;
                      if (sId && !form.serviceIds.includes(sId)) {
                        setForm({ ...form, serviceIds: [...form.serviceIds, sId] });
                      }
                    }}
                    className="modal-input cursor-pointer"
                  >
                    <option value="">-- Select Services to Assign (from Services Management) --</option>
                    {(services || []).map((s) => {
                      const isAssigned = form.serviceIds.includes(s.id);
                      const otherDept =
                        s.departmentId && s.departmentId !== editingDept?.id
                          ? departments.find((d) => d.id === s.departmentId)?.name
                          : null;
                      return (
                        <option key={s.id} value={s.id} disabled={isAssigned}>
                          {s.name} {isAssigned ? "✓ (Assigned)" : otherDept ? `(Currently: ${otherDept})` : ""}
                        </option>
                      );
                    })}
                  </select>
                  {form.serviceIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.serviceIds.map((sId) => {
                        const s = (services || []).find((srv) => srv.id === sId);
                        if (!s) return null;
                        return (
                          <span
                            key={sId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 text-xs font-semibold border border-blue-200 shadow-2xs"
                          >
                            <span>{s.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setForm({ ...form, serviceIds: form.serviceIds.filter((id) => id !== sId) })
                              }
                              className="text-blue-400 hover:text-blue-800 cursor-pointer p-0.5 rounded-full hover:bg-blue-100 transition-colors"
                              aria-label={`Remove ${s.name}`}
                              title={`Remove ${s.name}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {(services || []).length === 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      No services available. Configure services in Services Management first.
                    </p>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setModalOpen(false)} className="modal-btn">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="modal-btn modal-btn--primary">
                  {saving ? "Saving…" : editingDept ? "Update Department" : "Save Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
