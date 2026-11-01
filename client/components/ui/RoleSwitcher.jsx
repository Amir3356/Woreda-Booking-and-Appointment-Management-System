"use client";

import { useStore } from "@/lib/store";
import { INITIAL_USERS } from "@/lib/mock-data";
import { Shield, User, Building2, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RoleSwitcher() {
  const router = useRouter();
  const { currentUser, setCurrentUser } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const roles = [
    {
      role: "CITIZEN",
      user: INITIAL_USERS.find((u) => u.role === "CITIZEN"),
      title: "Citizen Portal",
      desc: "Book, track & manage personal appointments",
      dashboardUrl: "/citizen",
      icon: User,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      role: "ADMIN",
      user: INITIAL_USERS.find((u) => u.role === "ADMIN"),
      title: "Woreda Administrator",
      desc: "Full system control, services, staff & analytics",
      dashboardUrl: "/admin",
      icon: Shield,
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      role: "OFFICER",
      user: INITIAL_USERS.find((u) => u.role === "OFFICER"),
      title: "Department Officer",
      desc: "Desk service, queue calls & verification",
      dashboardUrl: "/officer",
      icon: Building2,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
  ];

  const handleSelectRole = (roleOption) => {
    setCurrentUser(roleOption.user);
    setIsOpen(false);
    router.push(roleOption.dashboardUrl);
  };

  const currentRoleConfig = roles.find((r) => r.role === currentUser?.role) || roles[0];
  const Icon = currentRoleConfig.icon;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-xs font-medium text-slate-700 shadow-sm"
        title="Switch Simulated User Role"
      >
        <span className={`p-1 rounded-md ${currentRoleConfig.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="text-left hidden sm:block">
          <span className="block font-semibold text-slate-800">{currentUser?.fullName}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{currentUser?.role}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-900">Switch System Role</p>
            <p className="text-[11px] text-slate-500">
              Test role-based access control and dashboard features.
            </p>
          </div>
          <div className="p-1 space-y-1">
            {roles.map((r) => {
              const RoleIcon = r.icon;
              const isSelected = currentUser?.role === r.role;
              return (
                <button
                  key={r.role}
                  onClick={() => handleSelectRole(r)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-slate-100 text-slate-900 font-medium"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${r.color} shrink-0 mt-0.5`}>
                    <RoleIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">{r.title}</p>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{r.user?.fullName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

