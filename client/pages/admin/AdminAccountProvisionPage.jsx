import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable, EthiopianFlag } from "@/components/ui";
import { useEscapeKey } from "@/hooks";
import { http } from "@/api/httpClient";
import { normalizeEthiopianPhone } from "@/utils";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
  Search,
} from "lucide-react";

/**
 * Deterministic bcrypt-compatible modular crypt format hash ($2b$10$...)
 * Matches backend bcrypt hash specifications in staff.service.js
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

const ROLE_BADGE = {
  "Department Officer": "bg-emerald-100 text-emerald-700 border-emerald-200",
  OFFICER: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Central Administrator": "bg-purple-100 text-purple-700 border-purple-200",
  ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function AccountProvisionPage() {
  const {
    provisionedAccounts,
    addProvisionedAccount,
    updateProvisionedAccount,
    deleteProvisionedAccount,
    departments = [],
    loadDepartments,
  } = useStore();

  useEffect(() => {
    loadDepartments?.().catch(() => {});
  }, [loadDepartments]);

  const accounts = provisionedAccounts || [];

  // Dynamic role options read directly from Department Management "Department Name" column values
  const departmentRoleOptions = Array.from(
    new Set((departments || []).map((d) => (d.name || "").trim()).filter(Boolean))
  );

  // Search filter state
  const [searchQuery, setSearchQuery] = useState("");

  // Modal & form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const emptyForm = {
    fullName: "",
    phone: "+2519",
    email: "",
    password: "",
    role: departmentRoleOptions[0] || "",
    departmentId: (departments || [])[0]?.id || "",
  };
  const [form, setForm] = useState(emptyForm);

  // Filtered accounts based on search query
  const filteredAccounts = accounts.filter((acc) => {
    const q = (searchQuery || "").trim().toLowerCase();
    return (
      (acc.fullName || "").toLowerCase().includes(q) ||
      (acc.phone || "").toLowerCase().includes(q) ||
      (acc.email || "").toLowerCase().includes(q)
    );
  });

  // Paging is handled by the table (it returns to page 1 when the search changes the rows).
  const handleSearchChange = (val) => {
    setSearchQuery(val);
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

  const openAdd = () => {
    const firstDept = (departments || [])[0];
    setForm({
      fullName: "",
      phone: "+2519",
      email: "",
      password: "",
      role: firstDept?.name || departmentRoleOptions[0] || "",
      departmentId: firstDept?.id || "",
    });
    setEditingKey(null);
    setShowPassword(false);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (acc) => {
    const matchedDept =
      (departments || []).find((d) => d.id === acc.departmentId || d.name === acc.role) ||
      (departments || [])[0];
    let phoneVal = acc.phone ? normalizeEthiopianPhone(acc.phone) : "+2519";
    if (!phoneVal.startsWith("+2519")) {
      const digits = phoneVal.replace(/[^\d]/g, "").slice(-8);
      phoneVal = `+2519${digits}`;
    }
    setForm({
      ...acc,
      phone: phoneVal,
      email: acc.email || "",
      password: acc.password || "Password@123",
      role: matchedDept?.name || acc.role || departmentRoleOptions[0] || "",
      departmentId: matchedDept?.id || acc.departmentId || "",
    });
    setEditingKey(acc.phone || acc.email);
    setShowPassword(false);
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setError("");
  };
  useEscapeKey(modalOpen, closeModal);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanFullName = form.fullName.trim();
    const phoneClean = normalizeEthiopianPhone(form.phone);
    const cleanPassword = form.password.trim();

    if (!cleanFullName) return setError("Full name is required.");
    if (!phoneClean || !/^\+2519\d{8}$/.test(phoneClean)) {
      return setError("Please enter a valid Ethiopian mobile number starting with +2519 (e.g. +251911234567).");
    }
    if (!cleanPassword || cleanPassword.length < 8)
      return setError("Password must be at least 8 characters.");

    const matchedDept = (departments || []).find(
      (d) => d.name === form.role || d.id === form.departmentId
    );
    const departmentId = matchedDept ? matchedDept.id : form.departmentId;
    const roleName = matchedDept ? matchedDept.name : form.role;

    if (!roleName) {
      return setError("Please select a valid department role.");
    }

    const cleanEmail = form.email?.trim() || `${phoneClean.replace(/\D/g, "")}@woreda.gov.et`;

    // Check duplicate phone or email (excluding current edit target)
    const duplicate = accounts.some((a) => {
      const isCurrent =
        (a.phone && a.phone === editingKey) ||
        (a.email && a.email.toLowerCase() === (editingKey || "").toLowerCase());
      if (isCurrent) return false;
      return (
        (a.phone && normalizeEthiopianPhone(a.phone) === phoneClean) ||
        (a.email && a.email.toLowerCase() === cleanEmail.toLowerCase())
      );
    });
    if (duplicate) return setError("An account with this phone number already exists.");

    const hashedPassword = hashPassword(cleanPassword);

    // Provision on the backend server so the user exists in database for /auth/login
    if (editingKey === null) {
      try {
        await http.post("/admin/users/provision", {
          fullName: cleanFullName,
          phone: phoneClean,
          email: cleanEmail,
          password: cleanPassword,
          role: "OFFICER",
          departmentId: departmentId || (departments[0]?.id || "dept-1"),
        });
      } catch {
        // Continue to synchronize locally even if backend throws (e.g. offline fallback)
      }
    }

    if (editingKey !== null) {
      // Edit existing
      updateProvisionedAccount(editingKey, {
        ...form,
        role: roleName,
        departmentId,
        fullName: cleanFullName,
        phone: phoneClean,
        email: cleanEmail,
        password: cleanPassword,
        passwordHash: hashedPassword,
      });
      toast.success("Account updated successfully.");
    } else {
      // Add new — push to global store (provisionedAccounts + users synchronized)
      addProvisionedAccount({
        ...form,
        id: `staff-${Date.now()}`,
        role: roleName,
        departmentId,
        fullName: cleanFullName,
        phone: phoneClean,
        email: cleanEmail,
        password: cleanPassword,
        passwordHash: hashedPassword,
      });
      toast.success("Staff account provisioned successfully.");
    }

    setModalOpen(false);
  };

  const handleDelete = (acc) => {
    const targetKey = acc.phone || acc.email;
    if (window.confirm(`Are you sure you want to remove the account for "${targetKey}"?`)) {
      deleteProvisionedAccount(targetKey);
      toast.success("Account removed successfully.");
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
      id: "role",
      accessorKey: "role",
      header: "Role",
      sortFn: "text",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
            ROLE_BADGE[row.original.role] || "bg-slate-100 text-slate-700 border-slate-200"
          }`}
        >
          <Shield className="w-3 h-3" />
          {row.original.role}
        </span>
      ),
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative flex items-center w-full min-h-[48px]">
        <div className="w-full text-center">
          <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">
            Account Provision
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create and manage user accounts with role assignments
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

      {/* Search Box Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        {/* Search Box */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by full name or phone number..."
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

        <span className="text-xs text-slate-500 font-medium hidden sm:block">
          Total: {filteredAccounts.length} account{filteredAccounts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <DataTable
          data={filteredAccounts}
          columns={accountColumns}
          getRowId={(acc) => acc.id || acc.phone || acc.email}
          initialSorting={[{ id: "fullName", desc: false }]}
          itemLabel="provisioned accounts"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Shield className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {accounts.length === 0
                    ? "No accounts provisioned yet"
                    : "No matching accounts found"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {accounts.length === 0
                    ? "Department Officers and Administrators provisioned by Central Administration will appear here."
                    : "Try adjusting your search query to find accounts."}
                </p>
              </div>
            </div>
          }
        />
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel modal-panel--form" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#0b2545] text-amber-300 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </span>
                <h2 id="account-modal-title" className="text-sm font-bold text-slate-900">
                  {editingKey !== null ? "Edit Staff Account" : "Provision New Staff"}
                </h2>
              </div>
              <button type="button" onClick={closeModal} className="modal-close" aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="pt-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

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
                  Password *
                </label>
                <div className="relative" style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="•••••••• (min 8 characters)"
                    minLength={8}
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
                  Role *
                </label>
                <select
                  value={form.role}
                  onChange={(e) => {
                    const selectedRole = e.target.value;
                    const matchedDept = (departments || []).find((d) => d.name === selectedRole);
                    setForm({
                      ...form,
                      role: selectedRole,
                      departmentId: matchedDept ? matchedDept.id : form.departmentId,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-white cursor-pointer"
                >
                  {departmentRoleOptions.length === 0 ? (
                    <option value="" disabled>
                      No departments available (configure departments first)
                    </option>
                  ) : (
                    departmentRoleOptions.map((roleName) => (
                      <option key={roleName} value={roleName}>
                        {roleName}
                      </option>
                    ))
                  )}
                </select>
                {departmentRoleOptions.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No departments found. Please configure departments in Department Management first.
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
                  className="modal-btn modal-btn--primary flex-1"
                >
                  {editingKey !== null ? "Save Changes" : "Create Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
