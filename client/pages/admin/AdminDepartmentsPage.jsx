import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { departmentApi } from "@/api";
import { DataTable, EthiopianFlag } from "@/components/ui";
import { subscribe } from "@/api/realtime";
import { describeError } from "@/utils";
import {
  Building2,
  Plus,
  MapPin,
  Edit2,
  Trash2,
  X,
  Search,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
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
    users,
  } = useStore();
  const [saving, setSaving] = useState(false);

  // Search box and dropdown filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");

  // Server-side cursor-based pagination state (3 real data items per page)
  const PAGE_SIZE = 3;
  const [cursor, setCursor] = useState(0);
  const [pagedDepts, setPagedDepts] = useState([]);
  const [cursorMetaState, setCursorMetaState] = useState({
    current: 0,
    pageSize: PAGE_SIZE,
    totalCount: 0,
    hasPrev: false,
    hasNext: false,
    nextCursor: null,
    prevCursor: null,
  });
  const [loadingPage, setLoadingPage] = useState(false);

  // Fetch departments using server-side cursor-based pagination
  const fetchPagedDepartments = useCallback(async () => {
    setLoadingPage(true);
    try {
      const res = await departmentApi.listPaged({
        search: searchQuery,
        departmentId: selectedDeptFilter,
        cursor,
        pageSize: PAGE_SIZE,
      });
      if (res && res.data) {
        setPagedDepts(res.data);
        if (res.meta?.cursor) {
          setCursorMetaState(res.meta.cursor);
          if (cursor > 0 && res.meta.cursor.totalCount <= cursor) {
            setCursor(0);
          }
        }
      }
    } catch (err) {
      toast.error(describeError(err, "load departments page"), { duration: 5000 });
    } finally {
      setLoadingPage(false);
    }
  }, [searchQuery, selectedDeptFilter, cursor]);

  useEffect(() => {
    fetchPagedDepartments();
  }, [fetchPagedDepartments]);

  // Departments live in department-service: fetch on open and whenever the catalog changes.
  useEffect(() => {
    const refresh = () => {
      fetchPagedDepartments();
      loadDepartments().catch((err) => toast.error(describeError(err, "load departments"), { duration: 5000 }));
      loadServices().catch((err) => toast.error(describeError(err, "load services"), { duration: 5000 }));
    };
    refresh();
    const offChange = subscribe("catalog.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh);
    return () => {
      offChange();
      offReconnect();
    };
  }, [fetchPagedDepartments, loadDepartments, loadServices]);

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

  const handleToggleStatus = (dept) => {
    run(`change the status of "${dept.name}"`, async () => {
      await toggleDepartmentStatus(dept.id);
      await fetchPagedDepartments();
    });
  };

  const handleDelete = (dept) => {
    const assignedCount = (services || []).filter((s) => s.departmentId === dept.id).length;
    if (assignedCount > 0) {
      toast.error(
        `Cannot delete "${dept.name}": it still has ${assignedCount} service(s) assigned. Delete or move them first in Service Management.`,
        { duration: 6000 }
      );
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${dept.name}?`)) {
      run(`delete "${dept.name}"`, async () => {
        await deleteDepartment(dept.id);
        toast.success(`Department "${dept.name}" deleted successfully.`, { duration: 5000 });
        await fetchPagedDepartments();
      });
    }
  };

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

  // Dynamic service options read directly from Service Management "Services" column values
  const serviceOptions = (services || []).filter((s) => Boolean(s.name?.trim()));

  // Dynamic department name options read directly from "Department Name" column values
  const departmentNameOptions = Array.from(
    new Set((departments || []).map((d) => (d.name || "").trim()).filter(Boolean))
  );

  const [isCustomName, setIsCustomName] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    buildingRoom: "",
    contactPhone: "+2519",
    serviceId: "",
    serviceIds: [],
  });

  const handlePhoneChange = (val) => {
    if (!val || val.length < 5) {
      setForm((prev) => ({ ...prev, contactPhone: "+2519" }));
      return;
    }
    let cleaned = val;
    if (!cleaned.startsWith("+2519")) {
      const digits = cleaned.replace(/[^\d]/g, "");
      if (digits.startsWith("2519")) {
        cleaned = "+" + digits;
      } else if (digits.startsWith("09")) {
        cleaned = "+2519" + digits.slice(2);
      } else if (digits.startsWith("9")) {
        cleaned = "+2519" + digits.slice(1);
      } else {
        cleaned = "+2519" + digits;
      }
    }
    const suffix = cleaned.slice(5).replace(/[^\d]/g, "").slice(0, 8);
    setForm((prev) => ({ ...prev, contactPhone: `+2519${suffix}` }));
  };

  const filteredDepts = departments || [];

  const handleOpenAdd = () => {
    loadServices().catch(() => {});
    setEditingDept(null);
    setIsCustomName(departmentNameOptions.length === 0);
    setForm({
      name: "",
      code: "",
      description: "",
      buildingRoom: "",
      contactPhone: "+2519",
      serviceId: "",
      serviceIds: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    loadServices().catch(() => {});
    setEditingDept(dept);
    setIsCustomName(true);
    const deptServices = (services || []).filter((s) => s.departmentId === dept.id);
    const deptServiceIds = deptServices.map((s) => s.id);
    let phoneVal = dept.contactPhone || "+2519";
    if (!phoneVal.startsWith("+2519")) {
      const digits = phoneVal.replace(/[^\d]/g, "").slice(-8);
      phoneVal = digits ? `+2519${digits}` : "+2519";
    }
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      buildingRoom: dept.buildingRoom,
      contactPhone: phoneVal,
      serviceId: deptServiceIds[0] || "",
      serviceIds: deptServiceIds,
    });
    setModalOpen(true);
  };

  const generateUniqueDeptCode = (name, currentDeptId = null) => {
    if (!name?.trim()) return "DEP";
    const words = name.trim().split(/\s+/).filter((w) => !["&", "and", "of", "the"].includes(w.toLowerCase()));
    let base = "";
    if (words.length >= 3) {
      base = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    } else {
      const clean = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      base = (clean.slice(0, 3) || "DEP").padEnd(3, "X");
    }
    base = base.slice(0, 4);

    const existingCodes = new Set(
      (departments || [])
        .filter((d) => !currentDeptId || d.id !== currentDeptId)
        .map((d) => (d.code || "").toUpperCase())
    );

    if (!existingCodes.has(base)) return base;

    for (let i = 2; i <= 99; i++) {
      const candidate = `${base.slice(0, 2)}${i}`;
      if (!existingCodes.has(candidate)) return candidate;
    }
    return `${base.slice(0, 2)}${Math.floor(10 + Math.random() * 89)}`;
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
      id: "services",
      accessorFn: (d) =>
        (services || [])
          .filter((s) => s.departmentId === d.id)
          .map((s) => s.name)
          .join(", "),
      header: "Services",
      sortFn: "text",
      cell: ({ row }) => {
        const dept = row.original;
        const deptServices = (services || []).filter((s) => s.departmentId === dept.id);
        if (deptServices.length === 0) {
          return <span className="text-xs text-slate-400 italic">No services</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5 max-w-md">
            {deptServices.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap"
              >
                {s.name}
              </span>
            ))}
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
          <EthiopianFlag className="w-3.5 h-2.5 shrink-0 shadow-2xs" />
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
            onClick={() => handleToggleStatus(dept)}
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
              onClick={() => handleDelete(dept)}
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

    const selectedServiceIds = Array.from(
      new Set([
        ...(form.serviceId ? [form.serviceId] : []),
        ...(form.serviceIds || []),
      ])
    ).filter(Boolean);

    // Identify if the chosen department name already exists in the municipality
    const existingDept =
      editingDept ||
      (departments || []).find(
        (d) => d.name.trim().toLowerCase() === form.name.trim().toLowerCase()
      );

    // Prevent assigning services that already belong to another department
    for (const sId of selectedServiceIds) {
      const srv = (services || []).find((s) => s.id === sId);
      if (srv && srv.departmentId && srv.departmentId !== existingDept?.id) {
        const otherDept =
          (departments || []).find((d) => d.id === srv.departmentId)?.name || "another department";
        toast.error(
          `Cannot assign "${srv.name}": it is already assigned to "${otherDept}". A service cannot be assigned to multiple departments.`,
          { duration: 5000 }
        );
        return;
      }
    }

    const deptCode = (
      existingDept?.code ||
      form.code ||
      generateUniqueDeptCode(form.name, existingDept?.id)
    ).trim().toUpperCase();

    const payload = {
      name: form.name.trim(),
      code: deptCode,
      description: form.description || existingDept?.description || "",
      buildingRoom: form.buildingRoom || existingDept?.buildingRoom || "Building A, Room 101",
      contactPhone: form.contactPhone || existingDept?.contactPhone || "+251911223344",
      serviceIds: selectedServiceIds,
    };

    setSaving(true);
    const ok = await run(existingDept ? "update the department" : "create the department", async () => {
      if (existingDept) {
        await updateDepartment(existingDept.id, payload);
        toast.success(
          `Department "${payload.name}" updated successfully with ${selectedServiceIds.length} service(s).`,
          { duration: 5000 }
        );
      } else {
        await addDepartment(payload);
        toast.success(
          `Department "${payload.name}" created successfully with ${selectedServiceIds.length} service(s).`,
          { duration: 5000 }
        );
      }

      await Promise.all([
        fetchPagedDepartments(),
        loadDepartments().catch(() => {}),
        loadServices().catch(() => {}),
      ]);
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
          <span>Add Department</span>
        </button>
      </div>

      {/* Search Box filter and Dropdown filter bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Box Filter */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Search by name, code, office, services..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCursor(0);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filter & Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Dropdown Filter for Department */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => {
                setSelectedDeptFilter(e.target.value);
                setCursor(0);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-[#0b2545] focus:outline-none shadow-2xs max-w-xs"
              title="Filter by department"
            >
              <option value="ALL">All Departments</option>
              {(departments || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || selectedDeptFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedDeptFilter("ALL");
                setCursor(0);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-rose-200 shadow-2xs"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <div className="text-xs text-slate-500 font-medium ml-auto md:ml-2">
            Total: <strong className="text-slate-800">{cursorMetaState.totalCount}</strong>{" "}
            {cursorMetaState.totalCount === 1 ? "department" : "departments"}
          </div>
        </div>
      </div>

      {/* Main Content Section - Table with 5 real data items per page */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={pagedDepts}
          columns={departmentColumns}
          getRowId={(d) => d.id}
          initialSorting={[{ id: "name", desc: false }]}
          pageSize={null}
          itemLabel="departments"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400 py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Building2 className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {searchQuery || selectedDeptFilter !== "ALL"
                    ? "No matching departments found"
                    : "No departments added yet"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedDeptFilter !== "ALL"
                    ? "Try adjusting your search terms or department dropdown filter."
                    : "Woreda administrative departments, offices, and service desks configured by Central Administration will appear here."}
                </p>
              </div>
            </div>
          }
        />

        {/* Cursor-Based Pagination Navigation Footer */}
        <div className="bg-slate-50/70 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (cursorMetaState.prevCursor !== null && cursorMetaState.prevCursor !== undefined) {
                  setCursor(cursorMetaState.prevCursor);
                } else {
                  setCursor((prev) => Math.max(0, prev - PAGE_SIZE));
                }
              }}
              disabled={!cursorMetaState.hasPrev || loadingPage}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              aria-label="Previous page"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-slate-700 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              Page {Math.floor(cursor / PAGE_SIZE) + 1} of{" "}
              {Math.max(1, Math.ceil((cursorMetaState.totalCount || 0) / PAGE_SIZE))}
            </span>

            <button
              type="button"
              onClick={() => {
                if (cursorMetaState.nextCursor !== null && cursorMetaState.nextCursor !== undefined) {
                  setCursor(cursorMetaState.nextCursor);
                } else {
                  setCursor((prev) => prev + PAGE_SIZE);
                }
              }}
              disabled={!cursorMetaState.hasNext || loadingPage}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              aria-label="Next page"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="dept-modal-title">
            <div className="modal-header relative flex items-center justify-center">
              <div className="w-full text-center px-6">
                <h3 id="dept-modal-title" className="modal-title text-center">
                  {editingDept ? "Edit Department" : "Add Department"}
                </h3>
                <p className="modal-subtitle text-center">
                  {editingDept
                    ? "Update the department's name, office and contact line."
                    : "Citizens will see this department when they book a service."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="modal-close absolute right-5 top-5"
                aria-label="Close"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="modal-field">
                  <label htmlFor={isCustomName ? "dept-name" : "dept-name-select"} className="modal-label">
                    Department Name <span className="modal-required">*</span>
                  </label>

                  {!isCustomName && departmentNameOptions.length > 0 ? (
                    <select
                      id="dept-name-select"
                      required
                      value={form.name || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__NEW__") {
                          setIsCustomName(true);
                          setForm((prev) => ({
                            ...prev,
                            name: "",
                            code: "",
                            buildingRoom: "",
                            contactPhone: "+2519",
                            serviceId: "",
                            serviceIds: [],
                          }));
                        } else {
                          const matched = (departments || []).find((d) => d.name === val);
                          const matchedServices = matched
                            ? (services || []).filter((s) => s.departmentId === matched.id).map((s) => s.id)
                            : [];
                          setForm((prev) => {
                            let phoneVal = matched?.contactPhone || prev.contactPhone || "+2519";
                            if (!phoneVal.startsWith("+2519")) {
                              const digits = phoneVal.replace(/[^\d]/g, "").slice(-8);
                              phoneVal = digits ? `+2519${digits}` : "+2519";
                            }
                            return {
                              ...prev,
                              name: val,
                              code: matched?.code || generateUniqueDeptCode(val, editingDept?.id),
                              description: matched?.description || prev.description || "",
                              buildingRoom: matched?.buildingRoom || prev.buildingRoom || "Building A, Room 101",
                              contactPhone: phoneVal,
                              serviceId: "",
                              serviceIds: matchedServices,
                            };
                          });
                        }
                      }}
                      className="modal-input cursor-pointer"
                    >
                      <option value="">Select Department Name</option>
                      {departmentNameOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value="__NEW__">+ Create New Department Name...</option>
                    </select>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative flex items-center">
                        <input
                          id="dept-name"
                          type="text"
                          required
                          autoFocus
                          value={form.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            const matched = (departments || []).find(
                              (d) => d.name.trim().toLowerCase() === newName.trim().toLowerCase()
                            );
                            const matchedServices = matched
                              ? (services || []).filter((s) => s.departmentId === matched.id).map((s) => s.id)
                              : [];
                            setForm((prev) => ({
                              ...prev,
                              name: newName,
                              code: matched ? matched.code : editingDept ? prev.code : generateUniqueDeptCode(newName, editingDept?.id),
                              ...(matched && {
                                buildingRoom: matched.buildingRoom || prev.buildingRoom,
                                contactPhone: matched.contactPhone || prev.contactPhone,
                                serviceIds: prev.serviceIds.length ? prev.serviceIds : matchedServices,
                              }),
                            }));
                          }}
                          placeholder="e.g. Kebele Administration Office"
                          className="modal-input"
                        />
                        {departmentNameOptions.length > 0 && !editingDept && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomName(false);
                              setForm((prev) => ({ ...prev, name: "", code: "" }));
                            }}
                            className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                            title="Back to dropdown list"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Type a new department name to create and register in the municipality.
                      </span>
                    </div>
                  )}
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
                  <div className="relative flex items-center">
                    <div className="absolute left-3 flex items-center gap-2 pointer-events-none select-none z-10">
                      <EthiopianFlag className="w-5 h-3.5 shadow-2xs rounded-xs shrink-0" />
                      <span className="w-px h-4 bg-slate-300" />
                    </div>
                    <input
                      id="dept-phone"
                      type="tel"
                      value={form.contactPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="+251 9XX XXX XXX"
                      className="modal-input font-mono"
                      style={{ paddingLeft: "3.5rem" }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Ethiopian mobile number starting with +2519
                  </span>
                </div>

                <div className="modal-field">
                  <label htmlFor="dept-service" className="modal-label">
                    Services
                  </label>
                  <select
                    id="dept-service"
                    value=""
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const targetDeptId = editingDept?.id || (departments || []).find((d) => d.name === form.name)?.id;
                      const srv = (services || []).find((s) => s.id === selectedId);
                      if (srv && srv.departmentId && srv.departmentId !== targetDeptId) {
                        const otherDept =
                          (departments || []).find((d) => d.id === srv.departmentId)?.name || "another department";
                        toast.error(
                          `"${srv.name}" is already assigned to "${otherDept}". A service cannot be assigned to multiple departments.`,
                          { duration: 5000 }
                        );
                        return;
                      }
                      setForm((prev) => {
                        const current = prev.serviceIds || [];
                        const updated = current.includes(selectedId) ? current : [...current, selectedId];
                        return {
                          ...prev,
                          serviceId: "",
                          serviceIds: updated,
                        };
                      });
                    }}
                    className="modal-input cursor-pointer"
                  >
                    <option value="">Select Services to Assign</option>
                    {serviceOptions.length === 0 ? (
                      <option value="" disabled>
                        No services available (configure services in Service Management first)
                      </option>
                    ) : (
                      serviceOptions.map((srv) => {
                        const targetDeptId = editingDept?.id || (departments || []).find((d) => d.name === form.name)?.id;
                        const isAssigned = (form.serviceIds || []).includes(srv.id);
                        const otherDept =
                          srv.departmentId && srv.departmentId !== targetDeptId
                            ? departments.find((d) => d.id === srv.departmentId)?.name
                            : null;
                        const isForbidden = Boolean(otherDept);
                        return (
                          <option key={srv.id} value={srv.id} disabled={isAssigned || isForbidden}>
                            {srv.name} {isAssigned ? "✓ (Assigned to this department)" : otherDept ? `(Already assigned to ${otherDept})` : ""}
                          </option>
                        );
                      })
                    )}
                  </select>
                  {(form.serviceIds || []).length > 0 && (
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
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  serviceIds: (prev.serviceIds || []).filter((id) => id !== sId),
                                }));
                              }}
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
                  {serviceOptions.length === 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      No services found. Please configure services in Service Management first.
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
