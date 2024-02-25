import { Routes, Route, Navigate } from "react-router-dom";

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
import AdminSchedulePage from "@/pages/admin/AdminSchedulePage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminAccountProvisionPage from "@/pages/admin/AdminAccountProvisionPage";
import AdminReportsPage from "@/pages/admin/AdminReportsPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";

// Officer pages
import OfficerDashboardPage from "@/pages/officer/OfficerDashboardPage";
import OfficerAppointmentsPage from "@/pages/officer/OfficerAppointmentsPage";
import OfficerQueuePage from "@/pages/officer/OfficerQueuePage";
import OfficerVerifyPage from "@/pages/officer/OfficerVerifyPage";
import OfficerReportsPage from "@/pages/officer/OfficerReportsPage";

// Citizen pages
import CitizenDashboardPage from "@/pages/citizen/CitizenDashboardPage";
import CitizenBookAppointmentPage from "@/pages/citizen/CitizenBookAppointmentPage";
import CitizenAppointmentsPage from "@/pages/citizen/CitizenAppointmentsPage";
import CitizenProfilePage from "@/pages/citizen/CitizenProfilePage";
import CitizenNotificationsPage from "@/pages/citizen/CitizenNotificationsPage";

export default function App() {
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
        <Route index element={<AdminDashboardPage />} />
        <Route path="appointments" element={<AdminAppointmentsPage />} />
        <Route path="departments" element={<AdminDepartmentsPage />} />
        <Route path="services" element={<AdminServicesPage />} />
        <Route path="schedule" element={<AdminSchedulePage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="account-provision" element={<AdminAccountProvisionPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      {/* Officer Service Desk */}
      <Route path="/officer" element={<OfficerLayout />}>
        <Route index element={<OfficerDashboardPage />} />
        <Route path="appointments" element={<OfficerAppointmentsPage />} />
        <Route path="queue" element={<OfficerQueuePage />} />
        <Route path="verify" element={<OfficerVerifyPage />} />
        <Route path="reports" element={<OfficerReportsPage />} />
      </Route>

      {/* Citizen Portal */}
      <Route path="/citizen" element={<CitizenLayout />}>
        <Route index element={<CitizenDashboardPage />} />
        <Route path="book" element={<CitizenBookAppointmentPage />} />
        <Route path="appointments" element={<CitizenAppointmentsPage />} />
        <Route path="profile" element={<CitizenProfilePage />} />
        <Route path="notifications" element={<CitizenNotificationsPage />} />
      </Route>

      {/* Catch-all redirect to Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
