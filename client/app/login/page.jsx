"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { INITIAL_USERS } from "@/lib/mock-data";
import {
  Building,
  Mail,
  Lock,
  Shield,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Citizen"); // Options: Citizen, Department Officer, Admin
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    let targetRole = "CITIZEN";
    let targetPath = "/citizen";
    let deptName = null;
    let deptId = null;
    let displayName = email.split("@")[0].replace(/[._-]/g, " ");
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

    if (role === "Admin") {
      targetRole = "ADMIN";
      targetPath = "/admin";
      deptName = "Woreda Central Administration";
      displayName = displayName || "Ato Kibreab Demissie";
    } else if (role === "Department Officer") {
      targetRole = "OFFICER";
      targetPath = "/officer";
      deptName = "Kebele Administration & Vital Events";
      deptId = "dept-1";
      displayName = displayName || "W/ro Tigist Mulugeta";
    } else {
      targetRole = "CITIZEN";
      targetPath = "/citizen";
      displayName = displayName || "Citizen User";
    }

    const authenticatedUser = {
      id: `usr-${Date.now()}`,
      fullName: displayName,
      email: email.trim(),
      phone: "+251911000000",
      nationalId: `ET-${targetRole.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      role: targetRole,
      departmentId: deptId,
      departmentName: deptName,
      isActive: true,
      address: "Kebele 03, Woreda Center",
    };

    setCurrentUser(authenticatedUser);

    setTimeout(() => {
      setLoading(false);
      router.push(targetPath);
    }, 400);
  };

  const handleQuickFill = (roleName) => {
    setRole(roleName);
    if (roleName === "Citizen") {
      setEmail("bekele@citizen.et");
      setPassword("password123");
    } else if (roleName === "Department Officer") {
      setEmail("tigist.kbl@woreda.gov.et");
      setPassword("password123");
    } else if (roleName === "Admin") {
      setEmail("admin@woreda.gov.et");
      setPassword("password123");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-[#0b2545] via-[#103058] to-[#133b5c] p-4 text-slate-800">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10">
        <div className="bg-[#0b2545] text-white p-6 text-center border-b border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-md">
            <Building className="w-7 h-7" />
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-300">
            FDRE — Woreda Public Administration
          </p>
          <h1 className="text-xl font-extrabold text-white tracking-tight mt-1">
            WoredaCare Portal Login
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Appointment & Queue Management System
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email (e.g. name@woreda.gov.et)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Role *
              </label>
              <div className="relative">
                <Shield className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="Citizen">Citizen</option>
                  <option value="Department Officer">Department Officer</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2 active:scale-98 disabled:opacity-70"
            >
              <span>{loading ? "Signing In..." : `Login as ${role}`}</span>
              <ArrowRight className="w-4 h-4 text-amber-300" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
              Quick Test Credentials
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("Citizen")}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all text-center ${
                  role === "Citizen"
                    ? "bg-blue-50 border-blue-300 text-blue-700 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Citizen
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("Department Officer")}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all text-center ${
                  role === "Department Officer"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Officer
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("Admin")}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all text-center ${
                  role === "Admin"
                    ? "bg-purple-50 border-purple-300 text-purple-700 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Admin
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Role-Based Access Control (RBAC) Protected</span>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400 text-center">
        © 2026 Woreda Booking & Appointment Management System. All Rights Reserved.
      </p>
    </div>
  );
}
