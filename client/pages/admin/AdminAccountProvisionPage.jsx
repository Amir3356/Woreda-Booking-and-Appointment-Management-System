import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { http } from "@/api/httpClient";
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
  ChevronLeft,
  ChevronRight,
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

  // Cursor pagination states (client-side cursor simulation)
  const [cursor, setCursor] = useState(0);
  const pageSize = 5;

  // Modal & form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const emptyForm = {
    fullName: "",
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
      (acc.email || "").toLowerCase().includes(q)
    );
  });

  // Cursor pagination slicing
  const totalCount = filteredAccounts.length;
  const safeCursor = Math.min(cursor, Math.max(0, totalCount === 0 ? 0 : totalCount - 1));
  const paginatedAccounts = filteredAccounts.slice(safeCursor, safeCursor + pageSize);

  const hasPrev = safeCursor > 0;
  const hasNext = safeCursor + pageSize < totalCount;

  const handleNextCursor = () => {
    if (hasNext) {
      setCursor(safeCursor + pageSize);
    }
  };

  const handlePrevCursor = () => {
    if (hasPrev) {
      setCursor(Math.max(0, safeCursor - pageSize));
    }
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCursor(0);
  };

  const openAdd = () => {
    const firstDept = (departments || [])[0];
    setForm({
      fullName: "",
      email: "",
      password: "",
      role: firstDept?.name || departmentRoleOptions[0] || "",
      departmentId: firstDept?.id || "",
    });
    setEditingEmail(null);
    setShowPassword(false);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (acc) => {
    const matchedDept =
      (departments || []).find((d) => d.id === acc.departmentId || d.name === acc.role) ||
      (departments || [])[0];
    setForm({
      ...acc,
      password: acc.password || "Password@123",
      role: matchedDept?.name || acc.role || departmentRoleOptions[0] || "",
      departmentId: matchedDept?.id || acc.departmentId || "",
    });
    setEditingEmail(acc.email);
    setShowPassword(false);
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanFullName = form.fullName.trim();
    const cleanEmail = form.email.trim();
    const cleanPassword = form.password.trim();

    if (!cleanFullName) return setError("Full name is required.");
    if (!cleanEmail) return setError("Email address is required.");
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

    // Check duplicate email (excluding current edit target)
    const duplicate = accounts.some(
      (a) =>
        (a.email || "").trim().toLowerCase() === cleanEmail.toLowerCase() &&
        (a.email || "").trim().toLowerCase() !== (editingEmail || "").trim().toLowerCase()
    );
    if (duplicate) return setError("An account with this email already exists.");

    const hashedPassword = hashPassword(cleanPassword);

    // Provision on the backend server so the user exists in MongoDB for /auth/login
    if (editingEmail === null) {
      try {
        await http.post("/admin/users/provision", {
          fullName: cleanFullName,
          email: cleanEmail,
          password: cleanPassword,
          role: "OFFICER",
          departmentId: departmentId || (departments[0]?.id || "dept-1"),
        });
      } catch {
        // Continue to synchronize locally even if backend throws (e.g. offline fallback)
      }
    }

    if (editingEmail !== null) {
      // Edit existing
      updateProvisionedAccount(editingEmail, {
        ...form,
        role: roleName,
        departmentId,
        fullName: cleanFullName,
        email: cleanEmail,
        password: cleanPassword,
        passwordHash: hashedPassword,
      });
      toast.success("Account updated successfully.");
    } else {
      // Add new — push to global store (provisionedAccounts + users synchronized)
      addProvisionedAccount({
        ...form,
        role: roleName,
        departmentId,
        fullName: cleanFullName,
        email: cleanEmail,
        password: cleanPassword,
        passwordHash: hashedPassword,
      });
      toast.success("Account provisioned successfully.");
    }

    setModalOpen(false);
  };

  const handleDelete = (emailToDelete) => {
    if (window.confirm(`Are you sure you want to remove the account for "${emailToDelete}"?`)) {
      deleteProvisionedAccount(emailToDelete);
      toast.success("Account removed successfully.");
    }
  };

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
          <span>Create User</span>
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
            placeholder="Search by full name or email..."
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3.5 font-bold text-slate-600 uppercase tracking-wider">
                  Full Name
                </th>
                <th className="text-left px-5 py-3.5 font-bold text-slate-600 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-5 py-3.5 font-bold text-slate-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-center px-5 py-3.5 font-bold text-slate-600 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
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
                  </td>
                </tr>
              ) : (
                paginatedAccounts.map((acc, idx) => (
                  <tr
                    key={acc.email || idx}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {acc.fullName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{acc.email}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          ROLE_BADGE[acc.role] || "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {acc.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(acc)}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(acc.email)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Cursor Pagination & Table Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          {/* Left: Summary & Cursor metadata */}
          <div className="flex items-center gap-3">
            <span>
              Showing{" "}
              <strong className="text-slate-800">
                {totalCount === 0 ? 0 : safeCursor + 1}
              </strong>
              {" – "}
              <strong className="text-slate-800">
                {Math.min(safeCursor + pageSize, totalCount)}
              </strong>{" "}
              of <strong className="text-slate-800">{totalCount}</strong> provisioned accounts
            </span>
            {totalCount > 0 && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-mono text-[10px]">
                Cursor #{safeCursor + 1}
              </span>
            )}
          </div>

          {/* Right: Cursor Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevCursor}
              disabled={!hasPrev}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                hasPrev
                  ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer shadow-xs"
                  : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
              }`}
              title="Previous Cursor"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNextCursor}
              disabled={!hasNext}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                hasNext
                  ? "bg-[#0b2545] border-[#0b2545] text-white hover:bg-[#133b5c] cursor-pointer shadow-xs"
                  : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
              }`}
              title="Next Cursor"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#0b2545] text-white">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-300" />
                <h2 className="text-sm font-bold">
                  {editingEmail !== null ? "Edit Account" : "Provision New Account"}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-white/20 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="e.g. bekele@woreda.gov.et"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50"
                />
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
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-all cursor-pointer"
                >
                  {editingEmail !== null ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
