import { Outlet, Navigate } from "react-router-dom";
import { useStore } from "@/context";
import { getJwtCookie, parseJwtToken } from "@/services";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";

export default function CitizenLayout({ children }) {
  const { currentUser } = useStore();
  const token = getJwtCookie();
  const claims = parseJwtToken(token);

  // Enforce valid JWT in browser cookie or authenticated user state with CITIZEN role
  const isCitizenClaim = claims?.role === "CITIZEN";
  const isCitizenUser = currentUser?.role === "CITIZEN";

  if (!isCitizenClaim && (!currentUser || !isCitizenUser)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="dashboard-shell min-h-screen flex bg-slate-100" style={{ backgroundColor: "#f1f5f9" }}>
      <DashboardSidebar role="CITIZEN" />
      <div className="dashboard-main-area flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader showNotifications={false} />
        <main className="flex-1 p-6 overflow-y-auto" style={{ backgroundColor: "#f1f5f9" }}>
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
