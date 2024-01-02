"use client";

import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { useStore } from "@/lib/store";

export default function OfficerLayout({ children }) {
  const { currentUser } = useStore();

  return (
    <div className="min-h-screen flex bg-slate-100">
      <DashboardSidebar role="OFFICER" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          title={`Service Desk — ${currentUser?.departmentName || "Department Office"}`}
          subtitle={`Counter Desk #${currentUser?.counterNumber || 1} • Officer: ${currentUser?.fullName || "Staff"}`}
        />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
