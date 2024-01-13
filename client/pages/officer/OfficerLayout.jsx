import { Outlet } from "react-router-dom";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/layout/DashboardHeader";
import { useStore } from "@/lib/store";

export default function OfficerLayout({ children }) {
  const { currentUser } = useStore();

  return (
    <div className="dashboard-shell min-h-screen flex bg-slate-100" style={{ backgroundColor: "#f1f5f9" }}>
      <DashboardSidebar role="OFFICER" />
      <div className="dashboard-main-area flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader
          title={`Service Desk — ${currentUser?.departmentName || "Department Office"}`}
          subtitle={`Counter Desk #${currentUser?.counterNumber || 1} • Officer: ${currentUser?.fullName || "Staff"}`}
        />
        <main className="flex-1 p-6 overflow-y-auto" style={{ backgroundColor: "#f1f5f9" }}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
