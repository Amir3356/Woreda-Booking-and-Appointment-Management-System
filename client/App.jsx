import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useStore } from "@/context";
import { profileApi, authApi } from "@/api";
import { subscribe } from "@/api/realtime";

// Layouts
import { AdminLayout, OfficerLayout, CitizenLayout } from "@/layout";

// Public pages
import AuthPage from "@/pages/AuthPage";
import RegisterPage from "@/pages/RegisterPage";
import AboutPage from "@/pages/AboutPage";
import ServicesPage from "@/pages/ServicesPage";
import DepartmentsPage from "@/pages/DepartmentsPage";
import ContactPage from "@/pages/ContactPage";
import BookPage from "@/pages/BookPage";
import TrackPage from "@/pages/TrackPage";

// Admin pages
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminAppointmentsPage from "@/pages/admin/AdminAppointmentsPage";
import AdminDepartmentsPage from "@/pages/admin/AdminDepartmentsPage";
import AdminServicesPage from "@/pages/admin/AdminServicesPage";
import OperatingHoursPage from "@/pages/admin/schedule/OperatingHoursPage";
import ExceptionsPage from "@/pages/admin/schedule/ExceptionsPage";
import ScheduleSection from "@/pages/admin/schedule/ScheduleSection";
import AdminAccountProvisionPage from "@/pages/admin/AdminAccountProvisionPage";
import AdminCitizenManagementPage from "@/pages/admin/AdminCitizenManagementPage";
import AdminReportsPage from "@/pages/admin/AdminReportsPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminAuditPage from "@/pages/admin/AdminAuditPage";

// Officer pages
import OfficerAppointmentsPage from "@/pages/officer/OfficerAppointmentsPage";
import OfficerQueuePage from "@/pages/officer/OfficerQueuePage";
import OfficerVerifyPage from "@/pages/officer/OfficerVerifyPage";
import OfficerReportsPage from "@/pages/officer/OfficerReportsPage";

// Citizen pages
import CitizenBookAppointmentPage from "@/pages/citizen/CitizenBookAppointmentPage";
import CitizenProfilePage from "@/pages/citizen/CitizenProfilePage";
import CitizenNotificationsPage from "@/pages/citizen/CitizenNotificationsPage";
import CitizenQueuePage from "@/pages/citizen/CitizenQueuePage";

export default function App() {
  // Departments come from the server; until the fetch returns the seeded defaults are shown,
  // so a failed fetch (server down) only keeps those defaults.
  const loadDepartments = useStore((state) => state.loadDepartments);
  useEffect(() => {
    loadDepartments().catch(() => {});
    const offCatalog = subscribe("catalog.changed", () => loadDepartments().catch(() => {}));
    const offReconnect = subscribe("reconnected", () => loadDepartments().catch(() => {}));
    return () => {
      offCatalog();
      offReconnect();
    };
  }, [loadDepartments]);

  // A session restored from the token only knows the officer's department id: show its real
  // name (sidebar, page headings) once the departments are loaded.
  const deptId = useStore((state) => state.currentUser?.departmentId || "");
  const deptName = useStore(
    (state) => state.departments.find((d) => d.id === state.currentUser?.departmentId)?.name || ""
  );
  useEffect(() => {
    const user = useStore.getState().currentUser;
    if (deptId && deptName && user?.departmentName !== deptName) {
      useStore.setState({ currentUser: { ...user, departmentName: deptName } });
    }
  }, [deptId, deptName]);

  // Appointments come from appointment-service, each role seeing its own part (a citizen their
  // bookings, an officer their department's). Re-read them whenever the server reports a booking
  // or a status change, so an officer sees a new booking and a citizen sees Approved/Rejected
  // without refreshing.
  const userKey = useStore((state) => (state.currentUser ? `${state.currentUser.id}|${state.currentUser.role}` : ""));
  const loadAppointments = useStore((state) => state.loadAppointments);
  useEffect(() => {
    if (!userKey) {
      useStore.setState({ appointments: [] });
      return undefined;
    }
    // A burst of changes (several bookings in a second) is fetched once, 300 ms after the last one.
    let timer = null;
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadAppointments().catch(() => {}), 300);
    };
    loadAppointments().catch(() => {});
    // A citizen session restored from the token has no phone number; fill it from the profile.
    const { currentUser } = useStore.getState();
    if (currentUser?.role === "CITIZEN" && !currentUser.phone) {
      profileApi
        .get()
        .then(({ data }) => {
          const now = useStore.getState().currentUser;
          if (now?.id === currentUser.id) useStore.setState({ currentUser: { ...now, ...data, role: "CITIZEN" } });
        })
        .catch(() => {});
    } else if (currentUser?.role === "OFFICER") {
      authApi
        .me()
        .then(({ data }) => {
          const now = useStore.getState().currentUser;
          if (now?.id === currentUser.id && data) {
            useStore.setState({
              currentUser: {
                ...now,
                ...data,
                role: "OFFICER",
                serviceIds: Array.isArray(data.serviceIds) ? data.serviceIds : (now.serviceIds || []),
              },
            });
          }
        })
        .catch(() => {});
    }
    const offChange = subscribe("appointments.changed", refreshSoon);
    const offReconnect = subscribe("reconnected", refreshSoon);
    return () => {
      clearTimeout(timer);
      offChange();
      offReconnect();
    };
  }, [userKey, loadAppointments]);

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<AuthPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/departments" element={<DepartmentsPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/book" element={<BookPage />} />
      <Route path="/track" element={<TrackPage />} />

      {/* Admin Portal */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="account-provision" replace />} />
        <Route path="appointments" element={<AdminAppointmentsPage />} />
        <Route path="departments" element={<AdminDepartmentsPage />} />
        <Route path="services" element={<AdminServicesPage />} />
        {/* Schedule Management (administrator only) */}
        <Route path="schedule" element={<ScheduleSection />}>
          <Route index element={<Navigate to="hours" replace />} />
          <Route path="hours" element={<OperatingHoursPage />} />
          <Route path="exceptions" element={<ExceptionsPage />} />
        </Route>
        <Route path="users" element={<Navigate to="account-provision" replace />} />
        <Route path="account-provision" element={<AdminAccountProvisionPage />} />
        <Route path="citizens" element={<AdminCitizenManagementPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
      </Route>

      {/* Officer Service Desk */}
      <Route path="/officer" element={<OfficerLayout />}>
        <Route index element={<Navigate to="appointments" replace />} />
        <Route path="appointments" element={<OfficerAppointmentsPage />} />
        <Route path="queue" element={<OfficerQueuePage />} />
        <Route path="verify" element={<OfficerVerifyPage />} />
        <Route path="reports" element={<OfficerReportsPage />} />
      </Route>

      {/* Citizen Portal */}
      <Route path="/citizen" element={<CitizenLayout />}>
        {/* Citizens work on Book Appointment; there is no separate start or history page. */}
        <Route index element={<Navigate to="book" replace />} />
        <Route path="book" element={<CitizenBookAppointmentPage />} />
        <Route path="queue" element={<CitizenQueuePage />} />
        <Route path="appointments" element={<Navigate to="/citizen/book" replace />} />
        <Route path="profile" element={<CitizenProfilePage />} />
        <Route path="notifications" element={<CitizenNotificationsPage />} />
      </Route>

      {/* Catch-all redirect to Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
