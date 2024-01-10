"use client";

import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";

export default function CitizenLayout({ children }) {
  return (
    <div className="dashboard-shell min-h-screen flex bg-slate-100" style={{ backgroundColor: "#f1f5f9" }}>
      <DashboardSidebar role="CITIZEN" />
      <div className="dashboard-main-area flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          title="Citizen Self-Service Portal"
          subtitle="Manage your public bookings, slips, and notifications"
        />
        <main className="flex-1 p-6 overflow-y-auto" style={{ backgroundColor: "#f1f5f9" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

