import { Outlet, Navigate } from "react-router-dom";
import { useStore } from "@/context";
import { getJwtCookie, parseJwtToken } from "@/services";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";

export default function AdminLayout({ children }) {
  const { currentUser } = useStore();
  const token = getJwtCookie();
  const claims = parseJwtToken(token);

  // Enforce valid JWT in browser cookie with ADMIN role
  const isAdminClaim = claims?.role === "ADMIN" || claims?.role === "Central Administrator";
  const isAdminUser = currentUser?.role === "ADMIN" || currentUser?.role === "Central Administrator";

  // Allow access if valid admin JWT cookie claim exists or currentUser is an admin
  if (!isAdminClaim && (!currentUser || !isAdminUser)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dashboard-shell min-h-screen flex bg-slate-100" style={{ backgroundColor: "#f1f5f9" }}>
      <DashboardSidebar role="ADMIN" />
      <div className="dashboard-main-area flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader showNotifications={false} />
        <main className="flex-1 p-6 overflow-y-auto" style={{ backgroundColor: "#f1f5f9" }}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
