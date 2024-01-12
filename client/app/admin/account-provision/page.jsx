"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Eye,
  EyeOff,
  Shield,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const ROLE_OPTIONS = ["Department Officer"];

const ROLE_BADGE = {
  "Department Officer": "bg-emerald-100 text-emerald-700 border-emerald-200",
  OFFICER: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function AccountProvisionPage() {
  const { addUser, users } = useStore();

  // Local provisioned accounts list (persisted in component state for this session)
  const [accounts, setAccounts] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  const emptyForm = { fullName: "", email: "", password: "", role: "Department Officer" };
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setForm(emptyForm);
    setEditIndex(null);
    setShowPassword(false);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (idx) => {
    setForm({ ...accounts[idx] });
    setEditIndex(idx);
    setShowPassword(false);
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!form.email.trim()) return setError("Email address is required.");
    if (!form.password || form.password.length < 6)
      return setError("Password must be at least 6 characters.");

    // Check duplicate email (excluding current edit)
    const duplicate = accounts.some(
      (a, i) =>
        a.email.toLowerCase() === form.email.trim().toLowerCase() &&
        i !== editIndex
    );
    if (duplicate) return setError("An account with this email already exists.");

    if (editIndex !== null) {
      // Edit existing
      const updated = [...accounts];
      updated[editIndex] = { ...form };
      setAccounts(updated);
      setSuccessMsg("Account updated successfully.");
    } else {
      // Add new — also push to global store
      addUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: "+251911000000",
        role: "OFFICER",
        departmentId: "dept-1",
        departmentName: "Kebele Administration & Vital Events",
        nationalId: `ET-OFF-${Math.floor(1000 + Math.random() * 9000)}`,
        address: "Kebele 03, Woreda Center",
        isActive: true,
      });
      setAccounts([...accounts, { ...form }]);
      setSuccessMsg("Account provisioned successfully.");
    }

    setTimeout(() => setSuccessMsg(""), 3000);
    setModalOpen(false);
  };

  const handleDelete = (idx) => {
    setAccounts(accounts.filter((_, i) => i !== idx));
    setSuccessMsg("Account removed.");
    setTimeout(() => setSuccessMsg(""), 3000);
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
          className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-2 w-fit whitespace-nowrap bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold rounded-xl shadow transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-amber-300" />
          <span>Create User</span>
        </button>
      </div>

      {/* Success / Error Toast */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

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
                  Password
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
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Shield className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium">No accounts provisioned yet</p>
                      <p className="text-xs">Click "Create User" to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                accounts.map((acc, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {acc.fullName}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{acc.email}</td>
                    <td className="px-5 py-3.5 text-slate-500 tracking-widest font-mono">
                      {"•".repeat(Math.min(acc.password.length, 10))}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          ROLE_BADGE[acc.role]
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {acc.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(idx)}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(idx)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all"
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

        {/* Table Footer */}
        {accounts.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 font-medium">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} provisioned
          </div>
        )}
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
                  {editIndex !== null ? "Edit Account" : "Provision New Account"}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-white/20 transition-all"
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

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  placeholder="e.g. Bekele Tadesse"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50"
                />
              </div>

              {/* Email */}
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

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Role *
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-white cursor-pointer"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-all"
                >
                  {editIndex !== null ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
