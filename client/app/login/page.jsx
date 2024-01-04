"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useStore } from "@/lib/store";
import { INITIAL_USERS } from "@/lib/mock-data";
import {
  Lock,
  Phone,
  Mail,
  Shield,
  User,
  Building2,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setCurrentUser } = useStore();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleStandardLogin = (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError("Please provide phone/email and password.");
      return;
    }
    // Simulate logging in as Citizen
    const citizen = INITIAL_USERS.find((u) => u.role === "CITIZEN");
    setCurrentUser(citizen);
    router.push("/citizen");
  };

  const handleQuickRoleLogin = (role) => {
    const targetUser = INITIAL_USERS.find((u) => u.role === role);
    if (targetUser) {
      setCurrentUser(targetUser);
      if (role === "ADMIN") router.push("/admin");
      else if (role === "OFFICER") router.push("/officer");
      else router.push("/citizen");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#0b2545] text-amber-300 flex items-center justify-center mx-auto mb-3 shadow-md">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Sign In to Woreda Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Access citizen services, department desks, or administrative console.
          </p>
        </div>

        {/* 1-Click Quick Demo Login Box */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 mb-6">
          <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-700" />
            Quick Demo Sign-In (Select Role)
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleQuickRoleLogin("CITIZEN")}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-blue-200 text-left text-xs font-semibold text-slate-800 transition-colors shadow-xs"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="font-bold">Citizen Portal</p>
                  <p className="text-[10px] text-slate-500">Bekele Tadesse (Citizen)</p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => handleQuickRoleLogin("ADMIN")}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-purple-200 text-left text-xs font-semibold text-slate-800 transition-colors shadow-xs"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="font-bold">Woreda Administrator</p>
                  <p className="text-[10px] text-slate-500">Ato Kibreab Demissie (Executive)</p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => handleQuickRoleLogin("OFFICER")}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-emerald-200 text-left text-xs font-semibold text-slate-800 transition-colors shadow-xs"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="font-bold">Department Officer Desk</p>
                  <p className="text-[10px] text-slate-500">W/ro Tigist Mulugeta (Kebele Office)</p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Regular Sign-In Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleStandardLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number or Email
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="+251 9XX XXX XXX or name@woreda.gov.et"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">Password</label>
                <a href="#" className="text-[11px] text-blue-600 hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-colors"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Don't have a citizen account?{" "}
            <Link href="/register" className="font-bold text-blue-700 hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

