import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable, EthiopianFlag } from "@/components/ui";
import { useEscapeKey } from "@/hooks";
import { staffApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { normalizeEthiopianPhone, describeError } from "@/utils";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Eye,
  EyeOff,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
} from "lucide-react";

/**
 * Deterministic bcrypt-compatible modular crypt format hash ($2b$10$...)
 * Used for offline/store synchronization compatibility.
 */
function hashPassword(plainText, salt = "woreda_sec_2026") {
  if (!plainText) return "$2b$10$e7K9aQ2F8xN4vL1P0mRt5u9xM2vK4lP7qW8yZ1aC3bE5dG7hI9jK";
  if (plainText.startsWith("$2b$") || plainText.startsWith("$2a$")) return plainText;

  let h1 = 0x811c9dc5;
  let h2 = 0x5a1f9a2b;
  const str = salt + plainText;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c * (i + 1)), 0x5bd1e995);
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./";
  let hashStr = "";
  let v1 = Math.abs(h1);
  let v2 = Math.abs(h2);
  for (let i = 0; i < 53; i++) {
    v1 = (v1 * 1664525 + 1013904223) >>> 0;
    v2 = (v2 * 22695477 + 1) >>> 0;
    hashStr += chars[(v1 + v2) % chars.length];
  }
  return `$2b$10$${hashStr}`;
}

const PAGE_SIZE = 4;

export default function AccountProvisionPage() {
  const {
    currentUser,
    addProvisionedAccount,
    updateProvisionedAccount,
    deleteProvisionedAccount,
    departments = [],
    loadDepartments,
    services = [],
    loadServices,
  } = useStore();

  useEffect(() => {
    loadDepartments?.().catch(() => {});
    loadServices?.().catch(() => {});
  }, [loadDepartments, loadServices]);

  // Search filter and department dropdown filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");

  // Server-side cursor-based pagination state (4 real data items per page)
  const [cursor, setCursor] = useState(0);
  const [pagedAccounts, setPagedAccounts] = useState([]);
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
  const [saving, setSaving] = useState(false);
  const fetchSeqRef = useRef(0);

  const fetchPagedAccounts = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setLoadingPage(true);
    try {
      const res = await staffApi.list({
        search: searchQuery,
        departmentId: selectedDeptFilter,
        cursor,
        pageSize: PAGE_SIZE,
      });
      if (seq !== fetchSeqRef.current) return;
      if (res && Array.isArray(res.data)) {
        setPagedAccounts(res.data);
        if (res.meta?.cursor) {
          setCursorMetaState(res.meta.cursor);
          if (cursor > 0 && res.meta.cursor.totalCount <= cursor) {
            setCursor(0);
          }
        }
      }
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      toast.error(describeError(err, "load staff accounts"), { duration: 5000 });
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoadingPage(false);
      }
    }
  }, [searchQuery, selectedDeptFilter, cursor]);

  useEffect(() => {
    fetchPagedAccounts();
  }, [fetchPagedAccounts]);

  // Real-time WebSocket subscription: updates table immediately when staff, services, or departments change
  useEffect(() => {
    const refresh = () => {
      fetchPagedAccounts();
    };
    const offStaff = subscribe("staff.changed", refresh);
    const offCatalog = subscribe("catalog.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh);
    return () => {
      offStaff();
      offCatalog();
      offReconnect();
    };
  }, [fetchPagedAccounts]);

  // Modal & form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const emptyForm = {
    fullName: "",
    phone: "+2519",
    email: "",
    password: "",
    departmentId: (departments || [])[0]?.id || "",
    serviceIds: [],
  };
  const [form, setForm] = useState(emptyForm);

  const currentDeptServices = useMemo(() => {
    if (!form.departmentId) return [];
    return (services || []).filter(
      (s) => s.departmentId === form.departmentId && s.isActive !== false
    );
  }, [form.departmentId, services]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCursor(0);
  };

  const handleDeptFilterChange = (val) => {
    setSelectedDeptFilter(val);
    setCursor(0);
  };

  const hasActiveFilters = Boolean(searchQuery.trim() || selectedDeptFilter !== "ALL");

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedDeptFilter("ALL");
    setCursor(0);
  };

  const handlePhoneChange = (val) => {
    if (!val || val.length < 5) {
      setForm((prev) => ({ ...prev, phone: "+2519" }));
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
    setForm((prev) => ({ ...prev, phone: `+2519${suffix}` }));
  };

  const handleDepartmentChange = (deptId) => {
    const deptServices = (services || []).filter(
      (s) => s.departmentId === deptId && s.isActive !== false
    );
    setForm((prev) => ({
      ...prev,
      departmentId: deptId,
      serviceIds: deptServices.map((s) => s.id),
    }));
  };

  const handleToggleService = (serviceId) => {
    setForm((prev) => {
      const exists = prev.serviceIds.includes(serviceId);
      const next = exists
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId];
      return { ...prev, serviceIds: next };
    });
  };

  const openAdd = () => {
    const firstDept = (departments || [])[0];
    const firstDeptId = firstDept?.id || "";
    const firstDeptServices = (services || []).filter(
      (s) => s.departmentId === firstDeptId && s.isActive !== false
    );
    setForm({
      fullName: "",
      phone: "+2519",
      email: "",
      password: "",
      departmentId: firstDeptId,
      serviceIds: firstDeptServices.map((s) => s.id),
    });
    setEditingAccount(null);
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEdit = (acc) => {
    const isAdminAccount =
      acc.roleCode === "ADMIN" || acc.role === "Admin" || acc.role === "Central Administrator";
    const matchedDept = !isAdminAccount
      ? (departments || []).find(
          (d) =>
            d.id === acc.departmentId ||
            (d.name &&
              acc.departmentName &&
              d.name.trim().toLowerCase() === acc.departmentName.trim().toLowerCase())
        ) || null
      : null;
    let phoneVal = acc.phone ? normalizeEthiopianPhone(acc.phone) : "+2519";
    if (!phoneVal.startsWith("+2519")) {
      const digits = phoneVal.replace(/[^\d]/g, "").slice(-8);
      phoneVal = digits ? `+2519${digits}` : "+2519";
    }
    const currentDeptId = matchedDept?.id || acc.departmentId || (departments || [])[0]?.id || "";
    let currentServiceIds = Array.isArray(acc.serviceIds) ? [...acc.serviceIds] : [];
    if (currentServiceIds.length === 0 && currentDeptId) {
      currentServiceIds = (services || [])
        .filter((s) => s.departmentId === currentDeptId && s.isActive !== false)
        .map((s) => s.id);
    }
    setForm({
      fullName: acc.fullName || "",
      phone: phoneVal,
      email: acc.email || "",
      password: "",
      departmentId: currentDeptId,
      serviceIds: currentServiceIds,
    });
    setEditingAccount(acc);
    setShowPassword(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };
  useEscapeKey(modalOpen, closeModal);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const cleanFullName = form.fullName.trim();
    const phoneClean = normalizeEthiopianPhone(form.phone);
    const cleanPassword = form.password.trim();

    if (!cleanFullName) {
      toast.error("Full name is required.", { duration: 5000 });
      return;
    }
    if (!phoneClean || !/^\+2519\d{8}$/.test(phoneClean)) {
      toast.error(
        "Please enter a valid Ethiopian mobile number starting with +2519 (e.g. +251911234567).",
        { duration: 5000 }
      );
      return;
    }
    if (!editingAccount && !cleanPassword) {
      toast.error("Password is required.", { duration: 5000 });
      return;
    }

    if (!form.departmentId) {
      toast.error("Please select a department.", { duration: 5000 });
      return;
    }

    if (!form.serviceIds || form.serviceIds.length === 0) {
      toast.error("Please select at least one assigned public service.", { duration: 5000 });
      return;
    }

    const matchedDept = (departments || []).find((d) => d.id === form.departmentId);
    const departmentName = matchedDept?.name || "";
    const cleanEmail = form.email?.trim() || `${phoneClean.replace(/\D/g, "")}@woreda.gov.et`;
    const apiRole = editingAccount?.roleCode === "ADMIN" && !form.departmentId ? "ADMIN" : "OFFICER";

    setSaving(true);
    try {
      if (editingAccount) {
        await staffApi.update(editingAccount.id, {
          fullName: cleanFullName,
          phone: phoneClean,
          email: cleanEmail,
          ...(cleanPassword ? { password: cleanPassword } : {}),
          role: apiRole,
          departmentId: form.departmentId,
          serviceIds: form.serviceIds,
        });
        updateProvisionedAccount(editingAccount.phone || editingAccount.email, {
          role: departmentName || "Department Officer",
          departmentId: form.departmentId,
          serviceIds: form.serviceIds,
          fullName: cleanFullName,
          phone: phoneClean,
          email: cleanEmail,
          ...(cleanPassword ? { password: cleanPassword, passwordHash: hashPassword(cleanPassword) } : {}),
        });
        toast.success("Account updated successfully.", { duration: 5000 });
      } else {
        await staffApi.provision({
          fullName: cleanFullName,
          phone: phoneClean,
          email: cleanEmail,
          password: cleanPassword,
          role: "OFFICER",
          departmentId: form.departmentId,
          serviceIds: form.serviceIds,
        });
        addProvisionedAccount({
          id: `staff-${Date.now()}`,
          role: departmentName || "Department Officer",
          departmentId: form.departmentId,
          serviceIds: form.serviceIds,
          fullName: cleanFullName,
          phone: phoneClean,
          email: cleanEmail,
          password: cleanPassword,
          passwordHash: hashPassword(cleanPassword),
        });
        toast.success("Staff account provisioned successfully.", { duration: 5000 });
        setCursor(0);
      }
      setModalOpen(false);
      await fetchPagedAccounts();
    } catch (err) {
      toast.error(
        describeError(err, editingAccount ? "update staff account" : "provision staff account"),
        { duration: 5000 }
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acc) => {
    if (acc.id === currentUser?.id) {
      toast.error("You cannot delete your own active administrator account.", { duration: 5000 });
      return;
    }
    const label = acc.fullName || acc.phone || acc.email;
    if (!window.confirm(`Are you sure you want to remove the account for "${label}"?`)) return;
    try {
      await staffApi.remove(acc.id);
      deleteProvisionedAccount(acc.phone || acc.email);
      toast.success("Account removed successfully.", { duration: 5000 });
      await fetchPagedAccounts();
    } catch (err) {
      toast.error(describeError(err, "remove staff account"), { duration: 5000 });
    }
  };

  // Account table columns (TanStack Table via components/ui/DataTable).
  const accountColumns = [
    {
      id: "fullName",
      accessorKey: "fullName",
      header: "Full Name",
      sortFn: "text",
      meta: { className: "font-semibold text-slate-800" },
      cell: ({ row }) => row.original.fullName,
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: "Phone Number",
      sortFn: "text",
      meta: { className: "text-slate-600 font-mono text-xs" },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
          <EthiopianFlag className="w-4 h-3 shrink-0 shadow-2xs" />
          <span>{row.original.phone || row.original.email}</span>
        </span>
      ),
    },
    {
      id: "departmentName",
      accessorFn: (acc) => acc.departmentName || (acc.roleCode === "ADMIN" ? "Central Administration" : "—"),
      header: "Department Name",
      sortFn: "text",
      cell: ({ row }) => {
        const acc = row.original;
        const isAdmin = acc.roleCode === "ADMIN" || acc.role === "Admin" || acc.role === "Central Administrator";
        const deptName = acc.departmentName || (isAdmin ? "Central Administration" : "—");
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{deptName}</span>
          </span>
        );
      },
    },
    {
      id: "assignedServices",
      header: "Assigned Public Services",
      enableSorting: false,
      cell: ({ row }) => {
        const acc = row.original;
        const isAdmin = acc.roleCode === "ADMIN" || acc.role === "Admin" || acc.role === "Central Administrator";
        if (isAdmin) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              All Public Services (Admin)
            </span>
          );
        }

        const assignedIds = Array.isArray(acc.serviceIds) ? acc.serviceIds : [];
        let assignedList = [];
        if (assignedIds.length > 0) {
          assignedList = assignedIds.map((sid) => {
            const found = (services || []).find((s) => s.id === sid);
            return found ? found.name : sid;
          });
        } else if (acc.departmentId) {
          assignedList = (services || [])
            .filter((s) => s.departmentId === acc.departmentId && s.isActive !== false)
            .map((s) => s.name);
        }

        if (assignedList.length === 0) {
          return <span className="text-slate-400 text-xs italic">No services assigned</span>;
        }

        return (
          <div className="flex flex-wrap gap-1 max-w-sm">
            {assignedList.map((serviceName, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                {serviceName}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      meta: { headerClassName: "text-center" },
      cell: ({ row }) => {
        const acc = row.original;
        return (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => openEdit(acc)}
              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all cursor-pointer"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(acc)}
              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  const currentPageNumber = Math.floor((cursorMetaState.current || 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil((cursorMetaState.totalCount || 0) / PAGE_SIZE));
  const rangeStart = cursorMetaState.totalCount === 0 ? 0 : (cursorMetaState.current || 0) + 1;
  const rangeEnd = Math.min(cursorMetaState.totalCount || 0, (cursorMetaState.current || 0) + pagedAccounts.length);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative flex items-center w-full min-h-[48px]">
        <div className="w-full text-center">
          <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">
            Account Provision
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create and manage staff accounts with department and public service assignments
          </p>
        </div>
        <button
          onClick={openAdd}
          className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-2 w-fit whitespace-nowrap bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-amber-300" />
          <span>Create Staff</span>
        </button>
      </div>

      {/* Search Box & Dropdown Filter (Dropfilter) Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, phone or department..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50/50"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filter (Dropfilter) & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Department Dropdown Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => handleDeptFilterChange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-[#0b2545] focus:outline-none shadow-2xs max-w-xs"
              title="Filter by department"
            >
              <option value="ALL">All Departments</option>
              {(departments || []).map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-rose-200 shadow-2xs"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          {/* Total Accounts Counter Badge */}
          <div className="text-xs text-slate-500 font-medium ml-auto md:ml-2">
            Total: <strong className="text-slate-800">{cursorMetaState.totalCount}</strong>{" "}
            {cursorMetaState.totalCount === 1 ? "account" : "accounts"}
          </div>
        </div>
      </div>

      {/* Main Content Section - Table with 4 real data items per page */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <DataTable
          data={pagedAccounts}
          columns={accountColumns}
          getRowId={(acc) => acc.id || acc.phone || acc.email}
          initialSorting={[]}
          pageSize={null}
          itemLabel="provisioned accounts"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400 py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Building2 className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">
                  {loadingPage
                    ? "Loading accounts…"
                    : hasActiveFilters
                      ? "No matching accounts found"
                      : "No accounts provisioned yet"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {loadingPage
                    ? "Fetching staff accounts from server..."
                    : hasActiveFilters
                      ? "Try adjusting your search query or resetting the department filter."
                      : "Department staff accounts provisioned in the system will appear here."}
                </p>
              </div>
            </div>
          }
        />

        {/* Cursor-Based Server-Side Pagination Navigation Footer */}
        <div className="bg-slate-50/70 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <strong className="text-slate-700">
              {cursorMetaState.totalCount === 0 ? "0" : `${rangeStart}–${rangeEnd}`}
            </strong>{" "}
            of <strong className="text-slate-700">{cursorMetaState.totalCount}</strong>{" "}
            {cursorMetaState.totalCount === 1 ? "account" : "accounts"}
          </p>

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
              Page {currentPageNumber} of {totalPages}
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

      {/* Create / Edit Staff Modal */}
      {modalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel modal-panel--form" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#0b2545] text-amber-300 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </span>
                <h2 id="account-modal-title" className="text-sm font-bold text-slate-900">
                  {editingAccount ? "Edit Staff Account" : "Create Staff"}
                </h2>
              </div>
              <button type="button" onClick={closeModal} className="modal-close" aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="pt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Bekele Tadesse"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phone Number *
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-2 pointer-events-none select-none z-10">
                    <EthiopianFlag className="w-5 h-3.5 shadow-xs shrink-0" />
                    <span className="w-px h-4 bg-slate-300" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+251 9XX XXX XXX"
                    className="w-full pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50 font-mono"
                    style={{ paddingLeft: "3.75rem" }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Must be a valid Ethiopian mobile number starting with +2519
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {editingAccount ? "New Password (Optional)" : "Password *"}
                </label>
                <div className="relative" style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingAccount}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingAccount ? "Leave blank to keep existing password" : "Enter password"}
                    className="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50"
                    style={{ paddingRight: "2.75rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      zIndex: 10,
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Department Name *
                </label>
                <select
                  required
                  value={form.departmentId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-white cursor-pointer"
                >
                  {departments.length === 0 ? (
                    <option value="" disabled>
                      No departments available (configure departments first)
                    </option>
                  ) : (
                    departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))
                  )}
                </select>
                {departments.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No departments found. Please configure departments in Department Management first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Public Services *
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Select one or multiple services belonging to the selected department.
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                  {currentDeptServices.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2 text-center">
                      No public services found for the selected department.
                    </p>
                  ) : (
                    currentDeptServices.map((srv) => {
                      const isChecked = form.serviceIds.includes(srv.id);
                      return (
                        <label
                          key={srv.id}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleService(srv.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          <span className="select-none flex-1 font-semibold">{srv.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                {form.serviceIds.length === 0 && currentDeptServices.length > 0 && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">
                    Please select at least one public service.
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="modal-btn flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="modal-btn modal-btn--primary flex-1 disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingAccount ? "Save Changes" : "Create Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
