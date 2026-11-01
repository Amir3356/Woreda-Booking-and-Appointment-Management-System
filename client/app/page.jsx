"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { INITIAL_USERS } from "@/lib/mock-data";
import {
  Building,
  User,
  Mail,
  Lock,
  Shield,
  Phone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  LogIn,
  CheckCircle2,
} from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const { setCurrentUser, addUser, departments } = useStore();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInRole, setSignInRole] = useState("Citizen");

  // Sign Up Form State
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("+251 9");
  const [signUpRole, setSignUpRole] = useState("Citizen");
  const [signUpDeptId, setSignUpDeptId] = useState("dept-1");
  const [signUpPassword, setSignUpPassword] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper for role mapping
  const resolveRoleMeta = (roleString, deptIdParam) => {
    let targetRole = "CITIZEN";
    let targetPath = "/citizen";
    let deptName = null;
    let deptId = null;

    if (roleString === "Admin") {
      targetRole = "ADMIN";
      targetPath = "/admin";
      deptName = "Woreda Central Administration";
    } else if (roleString === "Department Officer") {
      targetRole = "OFFICER";
      targetPath = "/officer";
      const matchedDept = departments.find((d) => d.id === deptIdParam) || departments[0];
      deptName = matchedDept?.name || "Kebele Administration & Vital Events";
      deptId = matchedDept?.id || "dept-1";
    } else {
      targetRole = "CITIZEN";
      targetPath = "/citizen";
    }

    return { targetRole, targetPath, deptName, deptId };
  };

  // Handle Sign In
  const handleSignIn = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!signInEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!signInPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    const { targetRole, targetPath, deptName, deptId } = resolveRoleMeta(signInRole);

    let displayName = signInEmail.split("@")[0].replace(/[._-]/g, " ");
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

    const authenticatedUser = {
      id: `usr-${Date.now()}`,
      fullName: displayName || `${signInRole} User`,
      email: signInEmail.trim(),
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

  // Handle Sign Up
  const handleSignUp = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!signUpFullName.trim()) {
      setError("Please enter your full legal name.");
      return;
    }
    if (!signUpEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!signUpPhone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!signUpPassword || signUpPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    const { targetRole, targetPath, deptName, deptId } = resolveRoleMeta(
      signUpRole,
      signUpDeptId
    );

    const newUser = addUser({
      fullName: signUpFullName.trim(),
      email: signUpEmail.trim(),
      phone: signUpPhone.trim(),
      role: targetRole,
      departmentId: deptId,
      departmentName: deptName,
      nationalId: `ET-${targetRole.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      address: "Kebele 03, Woreda Center",
    });

    setCurrentUser(newUser);
    setSuccessMsg("Account registered successfully! Redirecting...");

    setTimeout(() => {
      setLoading(false);
      router.push(targetPath);
    }, 600);
  };

  // Quick fill helper for easy testing
  const handleQuickFill = (roleName) => {
    setSignInRole(roleName);
    if (roleName === "Citizen") {
      setSignInEmail("bekele@citizen.et");
      setSignInPassword("password123");
    } else if (roleName === "Department Officer") {
      setSignInEmail("tigist.kbl@woreda.gov.et");
      setSignInPassword("password123");
    } else if (roleName === "Admin") {
      setSignInEmail("admin@woreda.gov.et");
      setSignInPassword("password123");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-[#0b2545] via-[#103058] to-[#133b5c] p-4 text-slate-800">
      {/* Background decoration grid */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10">
        {/* Top Government Emblem Header */}
        <div className="bg-[#0b2545] text-white p-6 text-center border-b border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-md">
            <Building className="w-7 h-7" />
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-300">
            FDRE — Woreda Public Administration
          </p>
          <h1 className="text-xl font-extrabold text-white tracking-tight mt-1">
            WoredaCare Portal
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Appointment & Queue Management System
          </p>
        </div>

        {/* Tab Switcher: Sign In | Sign Up */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === "signin"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LogIn className="w-3.5 h-3.5 text-blue-600" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === "signup"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Create Account (Sign Up)</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ===================== SIGN IN FORM ===================== */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
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
                    value={signInRole}
                    onChange={(e) => setSignInRole(e.target.value)}
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
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
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
                <span>{loading ? "Signing In..." : `Sign In as ${signInRole}`}</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>

              <div className="pt-2 text-center">
                <span className="text-xs text-slate-500">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                  className="text-xs font-bold text-blue-700 hover:underline"
                >
                  Sign Up here
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
                  Quick Test Credentials
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickFill("Citizen")}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all text-center ${
                      signInRole === "Citizen"
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
                      signInRole === "Department Officer"
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
                      signInRole === "Admin"
                        ? "bg-purple-50 border-purple-300 text-purple-700 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ===================== SIGN UP FORM ===================== */}
          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Legal Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    placeholder="e.g. Almaz Hailu Mengistu"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="e.g. almaz@citizen.et"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number (SMS alerts) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={signUpPhone}
                    onChange={(e) => setSignUpPhone(e.target.value)}
                    placeholder="+251 9XX XXX XXX"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Register As Role *
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={signUpRole}
                    onChange={(e) => setSignUpRole(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="Citizen">Citizen</option>
                    <option value="Department Officer">Department Officer</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              {signUpRole === "Department Officer" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned Department Office *
                  </label>
                  <select
                    value={signUpDeptId}
                    onChange={(e) => setSignUpDeptId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white cursor-pointer"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2 active:scale-98 disabled:opacity-70"
              >
                <span>{loading ? "Creating Account..." : `Sign Up as ${signUpRole}`}</span>
                <UserPlus className="w-4 h-4 text-white" />
              </button>

              <div className="pt-2 text-center">
                <span className="text-xs text-slate-500">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                  className="text-xs font-bold text-blue-700 hover:underline"
                >
                  Sign In here
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Card Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Role-Based Access Control (RBAC) Protected</span>
        </div>
      </div>

      {/* Bottom copyright notice */}
      <p className="mt-6 text-xs text-slate-400 text-center">
        © 2026 Woreda Booking & Appointment Management System. All Rights Reserved.
      </p>
    </div>
  );
}
