"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Calendar,
  Clock,
  UserCog,
  CheckCircle2,
  ShieldAlert,
  Layers,
  Bell,
  User,
  ArrowLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useStore } from "@/lib/store";

export default function DashboardSidebar({ role = "ADMIN" }) {
  const pathname = usePathname();
  const { currentUser, appointments, queue, notifications } = useStore();

  const pendingAppointmentsCount = appointments.filter((a) => a.status === "PENDING").length;
  const waitingQueueCount = queue.filter((q) => q.status === "WAITING").length;
  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;

  const adminNav = [
    { href: "/admin/appointments", label: "Appointment Management", icon: Calendar },
    { href: "/admin/departments", label: "Department Management", icon: Building2 },
    { href: "/admin/services", label: "Service Management", icon: FileText },
    { href: "/admin/schedule", label: "Schedule Management", icon: Clock },
    { href: "/admin/account-provision", label: "Account Provision", icon: UserCog },
    { href: "/admin/audit", label: "Audit", icon: ShieldAlert },
  ];

  const officerNav = [
    {
      href: "/officer/appointments",
      label: "Appointment Management",
      icon: Calendar,
      badge: pendingAppointmentsCount > 0 ? pendingAppointmentsCount : null,
    },
    { href: "/officer/verify", label: "Citizen Check-In", icon: CheckCircle2 },
  ];

  const citizenNav = [
    { href: "/citizen", label: "Overview", icon: LayoutDashboard },
    { href: "/book", label: "Book Appointment", icon: Calendar },
    { href: "/citizen/appointments", label: "My Appointments", icon: FileText },
    {
      href: "/citizen/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotifsCount > 0 ? unreadNotifsCount : null,
    },
    { href: "/citizen/profile", label: "Profile & Kebele ID", icon: User },
  ];

  let items = adminNav;
  let title = "Administrator Portal";
  let subtitle = "System Administration";
  let badgeColor = "bg-purple-100 text-purple-800";

  if (role === "OFFICER") {
    items = officerNav;
    title = "Officer Service Desk";
    subtitle = currentUser?.departmentName || "Kebele Office";
    badgeColor = "bg-emerald-100 text-emerald-800";
  } else if (role === "CITIZEN") {
    items = citizenNav;
    title = "Citizen Portal";
    subtitle = "Public Self-Service";
    badgeColor = "bg-blue-100 text-blue-800";
  }

  const isAdmin = role === "ADMIN" || pathname?.startsWith("/admin");
  const brandHref = role === "ADMIN" ? "/admin" : role === "OFFICER" ? "/officer/verify" : "/citizen";

  return (
    <aside
      className="dashboard-sidebar w-64 bg-[#0b2545] text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800"
      style={{
        backgroundColor: "#0b2545",
        color: "#cbd5e1",
        width: "260px",
        minWidth: "260px",
        borderRight: "1px solid #16365c",
      }}
    >
      {/* Brand & Portal Header */}
      <div className="p-4 border-b border-white/10">
        <Link href={brandHref} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center font-bold text-sm shadow">
            W
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              WoredaCare
              {role !== "ADMIN" && !isAdmin && (
                <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${badgeColor}`}>
                  {role}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{subtitle}</p>
          </div>
        </Link>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-white/15 text-white font-semibold shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-400 text-slate-950 font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom Public Return & User Tag */}
      {!isAdmin && (
        <div className="p-3 border-t border-white/10 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit to Public Portal</span>
          </Link>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {currentUser?.fullName?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{currentUser?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser?.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

