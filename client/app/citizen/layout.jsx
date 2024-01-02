"use client";

import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";

export default function CitizenLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-slate-100">
      <DashboardSidebar role="CITIZEN" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          title="Citizen Self-Service Portal"
          subtitle="Manage your public bookings, slips, and notifications"
        />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
