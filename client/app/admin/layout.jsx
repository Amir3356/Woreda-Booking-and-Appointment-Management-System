"use client";

import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-slate-100">
      <DashboardSidebar role="ADMIN" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          title="Woreda Central Administration"
          subtitle="System oversight, capacity management, and municipal analytics"
        />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

