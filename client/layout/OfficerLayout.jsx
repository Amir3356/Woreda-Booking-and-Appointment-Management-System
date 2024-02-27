import { Outlet, Navigate } from "react-router-dom";
import { useStore } from "@/context";
import { getJwtCookie, parseJwtToken } from "@/services";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";

export default function OfficerLayout({ children }) {
  const { currentUser } = useStore();
  const token = getJwtCookie();
  const claims = parseJwtToken(token);

  // Enforce valid JWT in browser cookie with OFFICER role
  const isOfficerClaim =
    claims?.role === "OFFICER" ||
    claims?.role === "Department Officer" ||
    (Boolean(claims?.role) && claims.role !== "ADMIN" && claims.role !== "CITIZEN");
  const isOfficerUser =
    currentUser?.role === "OFFICER" ||
    currentUser?.role === "Department Officer" ||
    (Boolean(currentUser?.role) && currentUser.role !== "ADMIN" && currentUser.role !== "CITIZEN");

  // Allow access if valid officer JWT cookie claim exists or currentUser is an officer
  if (!isOfficerClaim && (!currentUser || !isOfficerUser)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dashboard-shell min-h-screen flex bg-slate-100" style={{ backgroundColor: "#f1f5f9" }}>
      <DashboardSidebar role="OFFICER" />
      <div className="dashboard-main-area flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader showNotifications={false} />
        <main className="flex-1 p-6 overflow-y-auto" style={{ backgroundColor: "#f1f5f9" }}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
