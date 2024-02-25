// Global application state (zustand, persisted to localStorage).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  generateReferenceNumber,
  getStatusNotificationType,
  calculateAvailableSlots,
  generateTokenNumber,
  currentClockTime,
  setJwtCookie,
  clearJwtCookie,
  createJwtToken,
  getUserFromJwtCookie,
} from "@/services";
import { serviceApi } from "@/api";
import { http } from "@/api/httpClient";

export const DEFAULT_TIME_SLOTS = [
  "08:30 AM",
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "13:30 PM",
  "14:00 PM",
  "14:30 PM",
  "15:00 PM",
  "15:30 PM",
  "16:00 PM",
  "16:30 PM",
];

export const DEFAULT_SCHEDULE_CONFIGS = {
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  officeHours: { start: "08:30", end: "17:30" },
  lunchBreak: { start: "12:30", end: "13:30" },
  slotIntervalMinutes: 30,
  maxParallelSlots: 3,
  advanceBookingDays: 14,
  cancellationCutoffHours: 4,
  publicHolidays: [
    { date: "2026-01-07", name: "Genna (Ethiopian Christmas)" },
    { date: "2026-01-19", name: "Timket (Epiphany)" },
    { date: "2026-03-02", name: "Victory of Adwa Day" },
    { date: "2026-05-01", name: "International Labour Day" },
    { date: "2026-05-05", name: "Patriots' Victory Day" },
  ],
};

export const DEFAULT_DEPARTMENTS = [
  {
    id: "dept-1",
    name: "Kebele Administration & Vital Events",
    code: "KBL",
    description: "Citizen registration, residence identification, birth/marriage certificates, and neighborhood civil records.",
    buildingRoom: "Building A, Ground Floor, Room 102",
    contactPhone: "+251 11 551 2341",
    isActive: true,
    createdAt: "2026-01-15T08:00:00Z",
    officerCount: 4,
    serviceCount: 4,
  },
  {
    id: "dept-2",
    name: "Land Administration & Urban Development",
    code: "LND",
    description: "Landholding rights documentation, residential plot verifications, property transfer oversight, and urban zoning.",
    buildingRoom: "Building B, 2nd Floor, Room 204",
    contactPhone: "+251 11 551 8892",
    isActive: true,
    createdAt: "2026-01-15T08:00:00Z",
    officerCount: 3,
    serviceCount: 3,
  },
  {
    id: "dept-3",
    name: "Trade, Industry & Enterprise Development",
    code: "TRD",
    description: "Business registrations, commercial licenses, micro-enterprise support, and commercial practice verifications.",
    buildingRoom: "Building A, 1st Floor, Room 115",
    contactPhone: "+251 11 551 4421",
    isActive: true,
    createdAt: "2026-01-16T08:00:00Z",
    officerCount: 3,
    serviceCount: 3,
  },
  {
    id: "dept-4",
    name: "Revenues & Tax Assessment",
    code: "REV",
    description: "Local tax assessment, business revenue verification, trade levy collections, and municipal tariff processing.",
    buildingRoom: "Building B, Ground Floor, Room 108",
    contactPhone: "+251 11 551 7733",
    isActive: true,
    createdAt: "2026-01-16T08:00:00Z",
    officerCount: 3,
    serviceCount: 2,
  },
  {
    id: "dept-5",
    name: "Social Affairs & Labor Welfare",
    code: "SOC",
    description: "Social safety net enrollment, vulnerable community support, disability assistance, and pension documentation.",
    buildingRoom: "Building C, 1st Floor, Room 105",
    contactPhone: "+251 11 551 6612",
    isActive: true,
    createdAt: "2026-01-17T08:00:00Z",
    officerCount: 2,
    serviceCount: 3,
  },
  {
    id: "dept-6",
    name: "Public Health & Environmental Sanitation",
    code: "HLT",
    description: "Community health verifications, sanitation inspections, food handler certificates, and hygiene permits.",
    buildingRoom: "Building C, Ground Floor, Room 101",
    contactPhone: "+251 11 551 9901",
    isActive: true,
    createdAt: "2026-01-17T08:00:00Z",
    officerCount: 2,
    serviceCount: 2,
  },
  {
    id: "dept-7",
    name: "Code Enforcement & Municipal Audit",
    code: "AUD",
    description: "Building regulation enforcement, municipal code compliance, public land protection, and community grievance resolution.",
    buildingRoom: "Building A, 2nd Floor, Room 210",
    contactPhone: "+251 11 551 3345",
    isActive: true,
    createdAt: "2026-01-18T08:00:00Z",
    officerCount: 2,
    serviceCount: 2,
  },
];

export const DEFAULT_PROVISIONED_ACCOUNTS = [
  {
    fullName: "W/ro Tigist Mulugeta",
    email: "tigist.kbl@woreda.gov.et",
    password: "Password@123",
    role: "Department Officer",
    departmentId: "dept-1",
    isProvisioned: true,
    isActive: true,
    createdAt: "2026-11-01T08:00:00Z",
  },
  {
    fullName: "Ato Yared Assefa",
    email: "yared.lnd@woreda.gov.et",
    password: "Password@123",
    role: "Department Officer",
    departmentId: "dept-2",
    isProvisioned: true,
    isActive: true,
    createdAt: "2026-11-01T08:00:00Z",
  },
  {
    fullName: "Ato Solomon Haile",
    email: "solomon.trd@woreda.gov.et",
    password: "Password@123",
    role: "Department Officer",
    departmentId: "dept-3",
    isProvisioned: true,
    isActive: true,
    createdAt: "2026-11-01T08:00:00Z",
  },
  {
    fullName: "W/ro Hana Bekele",
    email: "hana.tax@woreda.gov.et",
    password: "Password@123",
    role: "Department Officer",
    departmentId: "dept-4",
    isProvisioned: true,
    isActive: true,
    createdAt: "2026-11-01T08:00:00Z",
  },
  {
    fullName: "Ato Mesfin Girma",
    email: "mesfin.soc@woreda.gov.et",
    password: "Password@123",
    role: "Department Officer",
    departmentId: "dept-5",
    isProvisioned: true,
    isActive: true,
    createdAt: "2026-11-01T08:00:00Z",
  },
  {
    fullName: "W/ro Selamawit Desta",
    email: "selam.health@woreda.gov.et",
    password: "Password@123",
    role: "Department Officer",
    departmentId: "dept-6",
    isProvisioned: true,
    isActive: true,
    createdAt: "2026-11-01T08:00:00Z",
  },
  {
    fullName: "Ato Berhanu Kebede",
    email: "berhanu.audit@woreda.gov.et",
    password: "Password@123",
    role: "Department Officer",
    departmentId: "dept-7",
    isProvisioned: true,
    isActive: true,
    createdAt: "2026-11-01T08:00:00Z",
  },
];

export const useStore = create(
  persist(
    (set, get) => ({
      // Current Authenticated User (Resolved from JWT in Browser Cookie)
      currentUser: getUserFromJwtCookie([], [], []),
      setCurrentUser: (user, customToken = null) => {
        if (user) {
          const token = customToken || user.token || createJwtToken(user);
          setJwtCookie(token);
        } else {
          // Revokes a token issued by auth-service (real admin login). Browser-made tokens are
          // rejected by the server with 401, which is ignored. The request reads the cookie
          // before it is cleared below.
          http.post("/auth/logout").catch(() => {});
          clearJwtCookie();
        }
        set({ currentUser: user });
        get().addAuditLog({
          userName: user?.fullName || "Anonymous",
          userRole: user?.role || "GUEST",
          action: user ? "USER_LOGIN" : "USER_LOGOUT",
          entity: "Auth",
          details: user
            ? `User authenticated via JWT in Browser Cookie (${user.role})`
            : "User signed out and removed JWT Cookie",
        });
      },

      // Departments State
      departments: DEFAULT_DEPARTMENTS,
      addDepartment: (dept) => {
        const newDept = {
          ...dept,
          id: `dept-${Date.now()}`,
          createdAt: new Date().toISOString(),
          isActive: true,
          officerCount: 0,
          serviceCount: 0,
        };
        set((state) => ({ departments: [newDept, ...state.departments] }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "CREATE_DEPARTMENT",
          entity: newDept.name,
          details: `Created new department: ${newDept.name} (${newDept.code})`,
        });
        return newDept;
      },
      updateDepartment: (id, updates) => {
        set((state) => ({
          departments: state.departments.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "UPDATE_DEPARTMENT",
          entity: `Dept-${id}`,
          details: `Updated department configurations`,
        });
      },
      toggleDepartmentStatus: (id) => {
        set((state) => ({
          departments: state.departments.map((d) =>
            d.id === id ? { ...d, isActive: !d.isActive } : d
          ),
        }));
      },
      deleteDepartment: (id) => {
        set((state) => ({
          departments: state.departments.filter((d) => d.id !== id),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "DELETE_DEPARTMENT",
          entity: `Dept-${id}`,
          details: `Deleted department record`,
        });
      },

      // Services State: the public service catalog lives in department-service (GET/POST/PUT/
      // PATCH/DELETE /api/v1/services). The store only keeps the last list fetched from it.
      // Writes need an ADMIN token issued by auth-service; errors are thrown to the caller.
      services: [],
      servicesLoaded: false,
      loadServices: async () => {
        const { data } = await serviceApi.list();
        const services = Array.isArray(data) ? data : [];
        set({ services, servicesLoaded: true });
        return services;
      },
      addService: async (service) => {
        const { data } = await serviceApi.create(service);
        await get().loadServices();
        return data;
      },
      updateService: async (id, updates) => {
        const { data } = await serviceApi.update(id, updates);
        await get().loadServices();
        return data;
      },
      toggleServiceStatus: async (id) => {
        await serviceApi.toggleStatus(id);
        await get().loadServices();
      },
      deleteService: async (id) => {
        await serviceApi.remove(id);
        await get().loadServices();
      },

      // Users Management
      users: [],
      addUser: (user) => {
        const newUser = {
          ...user,
          id: user.id || `usr-${Date.now()}`,
          isActive: user.isActive !== undefined ? user.isActive : true,
          createdAt: user.createdAt || new Date().toISOString(),
        };
        set((state) => ({ users: [...state.users, newUser] }));
        return newUser;
      },
      toggleUserStatus: (id) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, isActive: !u.isActive } : u
          ),
        }));
      },

      // Provisioned Accounts Management (Admin Account Provisioning)
      provisionedAccounts: DEFAULT_PROVISIONED_ACCOUNTS,
      addProvisionedAccount: (acc) => {
        const cleanEmail = (acc.email || "").trim().toLowerCase();
        const role = acc.role === "Central Administrator" ? "ADMIN" : "OFFICER";
        const cleanPassword = (acc.password || "").trim() || "Password@123";
        const newAccount = {
          fullName: (acc.fullName || "").trim(),
          email: (acc.email || "").trim(),
          password: cleanPassword,
          role: acc.role || "Department Officer",
          departmentId: acc.departmentId || "dept-1",
          isProvisioned: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
            const list = rawBackup ? JSON.parse(rawBackup) : [];
            const filtered = list.filter((a) => (a.email || "").trim().toLowerCase() !== cleanEmail);
            window.localStorage.setItem("woreda_provisioned_accounts", JSON.stringify([newAccount, ...filtered]));
          } catch (e) {
            // ignore
          }
        }

        set((state) => {
          const currentList = state.provisionedAccounts || [];
          const filteredAccs = currentList.filter(
            (a) => (a.email || "").trim().toLowerCase() !== cleanEmail
          );
          const updatedAccounts = [newAccount, ...filteredAccs];

          const currentDepts = state.departments || [];
          const matchedDept =
            currentDepts.find((d) => d.id === newAccount.departmentId) || currentDepts[0];
          const userIndex = (state.users || []).findIndex(
            (u) => (u.email || "").trim().toLowerCase() === cleanEmail
          );
          let updatedUsers = [...(state.users || [])];

          if (userIndex >= 0) {
            updatedUsers[userIndex] = {
              ...updatedUsers[userIndex],
              fullName: newAccount.fullName,
              email: newAccount.email,
              password: cleanPassword,
              role,
              departmentId: role === "OFFICER" ? (newAccount.departmentId || "dept-1") : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || "Kebele Administration & Vital Events")
                  : "Woreda Central Administration",
              isActive: true,
              isProvisioned: true,
            };
          } else {
            updatedUsers.push({
              id: `usr-prov-${Date.now()}`,
              fullName: newAccount.fullName,
              email: newAccount.email,
              password: cleanPassword,
              phone: "+251911000000",
              nationalId: `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
              role,
              departmentId: role === "OFFICER" ? (newAccount.departmentId || "dept-1") : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || "Kebele Administration & Vital Events")
                  : "Woreda Central Administration",
              address: "Kebele 03, Woreda Center",
              isActive: true,
              isProvisioned: true,
              createdAt: new Date().toISOString(),
            });
          }

          return {
            provisionedAccounts: updatedAccounts,
            users: updatedUsers,
          };
        });

        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "PROVISION_ACCOUNT",
          entity: newAccount.email,
          details: `Provisioned account for ${newAccount.fullName} as ${newAccount.role}`,
        });
      },
      updateProvisionedAccount: (originalEmail, updatedAcc) => {
        const cleanOriginal = (originalEmail || "").trim().toLowerCase();
        const role = updatedAcc.role === "Central Administrator" ? "ADMIN" : "OFFICER";
        const cleanPassword = (updatedAcc.password || "").trim() || "Password@123";

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
            const list = rawBackup ? JSON.parse(rawBackup) : [];
            const filtered = list.filter((a) => (a.email || "").trim().toLowerCase() !== cleanOriginal);
            const savedAcc = {
              ...updatedAcc,
              password: cleanPassword,
              isProvisioned: true,
            };
            window.localStorage.setItem("woreda_provisioned_accounts", JSON.stringify([savedAcc, ...filtered]));
          } catch (e) {
            // ignore
          }
        }

        set((state) => {
          const currentList = state.provisionedAccounts || [];
          const updatedAccounts = currentList.map((a) =>
            (a.email || "").trim().toLowerCase() === cleanOriginal
              ? {
                  ...updatedAcc,
                  fullName: (updatedAcc.fullName || "").trim(),
                  email: (updatedAcc.email || "").trim(),
                  password: cleanPassword,
                  departmentId: updatedAcc.departmentId || "dept-1",
                  isProvisioned: true,
                  updatedAt: new Date().toISOString(),
                }
              : a
          );
          const currentDepts = state.departments || [];
          const matchedDept =
            currentDepts.find((d) => d.id === updatedAcc.departmentId) || currentDepts[0];
          
          const userIdx = (state.users || []).findIndex(
            (u) => (u.email || "").trim().toLowerCase() === cleanOriginal
          );
          let updatedUsers = [...(state.users || [])];

          if (userIdx >= 0) {
            updatedUsers[userIdx] = {
              ...updatedUsers[userIdx],
              fullName: (updatedAcc.fullName || "").trim(),
              email: (updatedAcc.email || "").trim(),
              password: cleanPassword,
              role,
              departmentId: role === "OFFICER" ? (updatedAcc.departmentId || "dept-1") : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || "Kebele Administration & Vital Events")
                  : "Woreda Central Administration",
              isProvisioned: true,
            };
          } else {
            updatedUsers.push({
              id: `usr-prov-${Date.now()}`,
              fullName: (updatedAcc.fullName || "").trim(),
              email: (updatedAcc.email || "").trim(),
              password: cleanPassword,
              phone: "+251911000000",
              nationalId: `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
              role,
              departmentId: role === "OFFICER" ? (updatedAcc.departmentId || "dept-1") : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || "Kebele Administration & Vital Events")
                  : "Woreda Central Administration",
              address: "Kebele 03, Woreda Center",
              isActive: true,
              isProvisioned: true,
              createdAt: new Date().toISOString(),
            });
          }

          return {
            provisionedAccounts: updatedAccounts,
            users: updatedUsers,
          };
        });

        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "UPDATE_PROVISIONED_ACCOUNT",
          entity: updatedAcc.email,
          details: `Updated provisioned account for ${updatedAcc.fullName}`,
        });
      },
      deleteProvisionedAccount: (emailToDelete) => {
        const cleanEmail = (emailToDelete || "").trim().toLowerCase();

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
            const list = rawBackup ? JSON.parse(rawBackup) : [];
            const filtered = list.filter((a) => (a.email || "").trim().toLowerCase() !== cleanEmail);
            window.localStorage.setItem("woreda_provisioned_accounts", JSON.stringify(filtered));
          } catch (e) {
            // ignore
          }
        }

        set((state) => ({
          provisionedAccounts: (state.provisionedAccounts || []).filter(
            (a) => (a.email || "").trim().toLowerCase() !== cleanEmail
          ),
          users: (state.users || []).filter(
            (u) => (u.email || "").trim().toLowerCase() !== cleanEmail
          ),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "DELETE_PROVISIONED_ACCOUNT",
          entity: emailToDelete,
          details: `Deleted provisioned account ${emailToDelete}`,
        });
      },

      // Schedule Configurations
      scheduleConfigs: DEFAULT_SCHEDULE_CONFIGS,
      updateScheduleConfigs: (newConfig) => {
        set((state) => ({
          scheduleConfigs: { ...state.scheduleConfigs, ...newConfig },
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "UPDATE_SCHEDULE",
          entity: "Global Schedule",
          details: "Modified operating hours or daily booking parameters",
        });
      },

      // Municipal Service Schedules
      schedules: [],
      addSchedule: (sch) => {
        set((state) => ({ schedules: [sch, ...(state.schedules || [])] }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "CREATE_SCHEDULE",
          entity: sch.id,
          details: `Created schedule for ${sch.service} (${sch.department})`,
        });
      },
      updateSchedule: (id, updates) => {
        set((state) => ({
          schedules: (state.schedules || []).map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "UPDATE_SCHEDULE",
          entity: id,
          details: `Updated schedule ${id}`,
        });
      },
      deleteSchedule: (id) => {
        set((state) => ({
          schedules: (state.schedules || []).filter((s) => s.id !== id),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "DELETE_SCHEDULE",
          entity: id,
          details: `Deleted schedule ${id}`,
        });
      },
      toggleScheduleStatus: (id) => {
        const sch = (get().schedules || []).find((s) => s.id === id);
        const newStatus = sch?.status === "Active" ? "Inactive" : "Active";
        set((state) => ({
          schedules: (state.schedules || []).map((s) =>
            s.id === id ? { ...s, status: newStatus } : s
          ),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "UPDATE_SCHEDULE_STATUS",
          entity: id,
          details: `Changed status of schedule ${id} to ${newStatus}`,
        });
      },

      // Appointments State
      appointments: [],
      bookAppointment: (bookingData) => {
        const refNumber = generateReferenceNumber(bookingData.date);

        const newAppointment = {
          id: `apt-${Date.now()}`,
          referenceNumber: refNumber,
          citizenId: get().currentUser?.id || `usr-temp-${Date.now()}`,
          citizenName: bookingData.citizenName,
          citizenPhone: bookingData.citizenPhone,
          citizenEmail: bookingData.citizenEmail,
          departmentId: bookingData.departmentId,
          departmentName: bookingData.departmentName,
          serviceId: bookingData.serviceId,
          serviceName: bookingData.serviceName,
          date: bookingData.date,
          timeSlot: bookingData.timeSlot,
          status: "PENDING",
          tokenNumber: null,
          citizenNotes: bookingData.citizenNotes || "",
          officerNotes: null,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          appointments: [newAppointment, ...state.appointments],
        }));

        // Trigger in-app notification
        get().addNotification({
          userId: newAppointment.citizenId,
          title: "Appointment Submitted",
          message: `Your appointment request for ${newAppointment.serviceName} has been submitted (Ref: ${newAppointment.referenceNumber}).`,
          type: "INFO",
        });

        // Trigger audit log
        get().addAuditLog({
          userName: bookingData.citizenName,
          userRole: "CITIZEN",
          action: "CREATE_BOOKING",
          entity: refNumber,
          details: `Booked ${newAppointment.serviceName} for ${newAppointment.date} at ${newAppointment.timeSlot}`,
        });

        return newAppointment;
      },

      updateAppointmentStatus: (id, status, notes = "", officerReason = "") => {
        const apt = get().appointments.find((a) => a.id === id);
        if (!apt) return;

        let tokenNumber = apt.tokenNumber;
        let checkedInAt = apt.checkedInAt;
        let completedAt = apt.completedAt;

        // When checking in, generate queue token
        if (status === "CHECKED_IN" && !tokenNumber) {
          const dept = get().departments.find((d) => d.id === apt.departmentId);
          const deptQueueLength = get().queue.filter((q) => q.departmentId === apt.departmentId).length;
          tokenNumber = generateTokenNumber(dept?.code, deptQueueLength);
          checkedInAt = new Date().toISOString();

          // Add to queue
          get().addToQueue({
            appointmentId: apt.id,
            tokenNumber,
            citizenName: apt.citizenName,
            serviceName: apt.serviceName,
            departmentId: apt.departmentId,
            counterNumber: 1,
            officerName: get().currentUser?.fullName || "Desk Officer",
            status: "WAITING",
            checkedInTime: currentClockTime(),
            calledTime: null,
            estimatedMinutesRemaining: 15,
          });
        }

        if (status === "COMPLETED") {
          completedAt = new Date().toISOString();
        }

        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status,
                  tokenNumber,
                  checkedInAt,
                  completedAt,
                  officerNotes: notes || a.officerNotes,
                  rejectionReason: officerReason || a.rejectionReason,
                }
              : a
          ),
        }));

        // Notifications
        get().addNotification({
          userId: apt.citizenId,
          title: `Appointment ${status.replace("_", " ")}`,
          message: `Your appointment ${apt.referenceNumber} status changed to ${status}. ${officerReason ? `Reason: ${officerReason}` : ""}`,
          type: getStatusNotificationType(status),
        });

        // Audit log
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Officer",
          userRole: get().currentUser?.role || "OFFICER",
          action: `STATUS_${status}`,
          entity: apt.referenceNumber,
          details: `Changed status to ${status}. ${notes || officerReason || ""}`,
        });
      },

      rescheduleAppointment: (id, newDate, newTimeSlot, reason = "") => {
        const apt = get().appointments.find((a) => a.id === id);
        if (!apt) return;

        set((state) => ({
          appointments: state.appointments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  date: newDate,
                  timeSlot: newTimeSlot,
                  status: "APPROVED",
                  officerNotes: reason ? `Rescheduled: ${reason}` : a.officerNotes,
                }
              : a
          ),
        }));

        get().addNotification({
          userId: apt.citizenId,
          title: "Appointment Rescheduled",
          message: `Your appointment ${apt.referenceNumber} has been rescheduled to ${newDate} at ${newTimeSlot}.`,
          type: "WARNING",
        });
      },

      // Queue Management
      queue: [],
      addToQueue: (queueItem) => {
        const newItem = {
          ...queueItem,
          id: `q-${Date.now()}`,
        };
        set((state) => ({ queue: [...state.queue, newItem] }));
      },
      updateQueueStatus: (id, status) => {
        set((state) => ({
          queue: state.queue.map((q) =>
            q.id === id
              ? {
                  ...q,
                  status,
                  calledTime: status === "SERVING" ? currentClockTime() : q.calledTime,
                }
              : q
          ),
        }));

        const item = get().queue.find((q) => q.id === id);
        if (item && status === "COMPLETED") {
          get().updateAppointmentStatus(item.appointmentId, "COMPLETED");
        } else if (item && status === "NO_SHOW") {
          get().updateAppointmentStatus(item.appointmentId, "NO_SHOW");
        }
      },
      callNextCitizen: (departmentId, counterNumber = 1) => {
        const waitingItem = get().queue.find(
          (q) => q.departmentId === departmentId && q.status === "WAITING"
        );
        if (waitingItem) {
          get().updateQueueStatus(waitingItem.id, "SERVING");
          get().updateAppointmentStatus(waitingItem.appointmentId, "IN_PROGRESS");
          return waitingItem;
        }
        return null;
      },

      // Notifications Center
      notifications: [],
      addNotification: (notif) => {
        const newNotif = {
          ...notif,
          id: `notif-${Date.now()}`,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ notifications: [newNotif, ...state.notifications] }));
      },
      markNotificationAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        }));
      },
      markAllNotificationsAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        }));
      },

      addAuditLog: () => {},

      // Dynamic Available Slots Calculation
      getAvailableSlots: (serviceId, date) =>
        calculateAvailableSlots({
          appointments: get().appointments,
          timeSlots: DEFAULT_TIME_SLOTS,
          serviceId,
          date,
          maxPerSlot: get().scheduleConfigs.maxParallelSlots || 2,
        }),
    }),
    {
      name: "woreda-booking-storage",
      partialize: (state) => ({
        // DO NOT persist currentUser to localStorage! Authentication is strictly JWT in browser cookie.
        users: state.users,
        provisionedAccounts: state.provisionedAccounts,
        departments: state.departments,
        appointments: state.appointments,
        queue: state.queue,
        notifications: state.notifications,
        scheduleConfigs: state.scheduleConfigs,
        schedules: state.schedules,
      }),
      merge: (persistedState, currentState) => {
        const { currentUser: _omitted, ...safePersisted } = persistedState || {};
        
        // Ensure departments are populated
        const currentDepartments =
          safePersisted.departments && safePersisted.departments.length > 0
            ? safePersisted.departments
            : DEFAULT_DEPARTMENTS;

        // Ensure provisioned accounts are populated, merging defaults with any admin edits
        const persistedProv = safePersisted.provisionedAccounts || [];
        const provMap = new Map();

        // Seed default municipal officers
        DEFAULT_PROVISIONED_ACCOUNTS.forEach((a) => {
          provMap.set((a.email || "").trim().toLowerCase(), { ...a });
        });

        // Overlay user-created and persisted provisioned accounts with robust password preservation
        persistedProv.forEach((a) => {
          const emailKey = (a.email || "").trim().toLowerCase();
          if (!emailKey) return;
          const defaultAcc = DEFAULT_PROVISIONED_ACCOUNTS.find(
            (d) => (d.email || "").trim().toLowerCase() === emailKey
          );
          const resolvedPassword =
            (a.password || "").trim() || defaultAcc?.password || "Password@123";

          provMap.set(emailKey, {
            ...defaultAcc,
            ...a,
            fullName: (a.fullName || defaultAcc?.fullName || "").trim(),
            email: (a.email || defaultAcc?.email || "").trim(),
            password: resolvedPassword,
            role: a.role || defaultAcc?.role || "Department Officer",
            departmentId: a.departmentId || defaultAcc?.departmentId || "dept-1",
            isProvisioned: true,
            isActive: a.isActive !== false,
          });
        });

        // Also merge un-purgeable secondary backup storage if available in browser
        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
            if (rawBackup) {
              const parsedBackup = JSON.parse(rawBackup);
              if (Array.isArray(parsedBackup)) {
                parsedBackup.forEach((a) => {
                  const emailKey = (a.email || "").trim().toLowerCase();
                  if (!emailKey) return;
                  const defaultAcc = DEFAULT_PROVISIONED_ACCOUNTS.find(
                    (d) => (d.email || "").trim().toLowerCase() === emailKey
                  );
                  const existing = provMap.get(emailKey) || {};
                  const resolvedPassword =
                    (a.password || "").trim() ||
                    existing.password ||
                    defaultAcc?.password ||
                    "Password@123";

                  provMap.set(emailKey, {
                    ...defaultAcc,
                    ...existing,
                    ...a,
                    fullName: (a.fullName || existing.fullName || defaultAcc?.fullName || "").trim(),
                    email: (a.email || existing.email || defaultAcc?.email || "").trim(),
                    password: resolvedPassword,
                    role: a.role || existing.role || defaultAcc?.role || "Department Officer",
                    departmentId: a.departmentId || existing.departmentId || defaultAcc?.departmentId || "dept-1",
                    isProvisioned: true,
                    isActive: a.isActive !== false,
                  });
                });
              }
            }
          } catch (e) {
            // ignore
          }
        }

        const cleanedProvisioned = Array.from(provMap.values());

        // Strip legacy mock schedules so Schedule Management starts clean
        const LEGACY_MOCK_SCH_IDS = new Set([
          "SCH-001",
          "SCH-002",
          "SCH-003",
          "SCH-004",
          "SCH-005",
          "SCH-006",
          "SCH-007",
          "SCH-008",
          "SCH-009",
          "SCH-010",
        ]);
        const cleanedSchedules = (safePersisted.schedules || []).filter(
          (s) => !LEGACY_MOCK_SCH_IDS.has(s.id)
        );

        // Strip legacy mock appointments
        const LEGACY_MOCK_APT_IDS = new Set([
          "apt-1",
          "apt-2",
          "apt-3",
          "apt-4",
          "apt-5",
          "apt-6",
          "apt-7",
          "apt-8",
          "apt-9",
        ]);
        const cleanedAppointments = (safePersisted.appointments || []).filter(
          (a) => !LEGACY_MOCK_APT_IDS.has(a.id)
        );

        // Strip legacy mock queue
        const LEGACY_MOCK_QUEUE_IDS = new Set(["q-1", "q-2"]);
        const cleanedQueue = (safePersisted.queue || []).filter(
          (q) => !LEGACY_MOCK_QUEUE_IDS.has(q.id)
        );

        // Strip legacy mock users, keeping provisioned users intact
        const LEGACY_MOCK_USER_IDS = new Set([
          "usr-officer-1",
          "usr-officer-2",
          "usr-officer-3",
          "usr-citizen-1",
          "usr-citizen-2",
          "usr-citizen-3",
        ]);
        const cleanedUsers = (safePersisted.users || []).filter(
          (u) => !LEGACY_MOCK_USER_IDS.has(u.id) || u.isProvisioned
        );

        // Synchronize provisioned accounts into users so both stores stay aligned
        const usersByEmail = new Map(
          cleanedUsers.map((u) => [(u.email || "").trim().toLowerCase(), u])
        );
        cleanedProvisioned.forEach((prov) => {
          const provEmail = (prov.email || "").trim().toLowerCase();
          if (!provEmail) return;
          const isOfficer = prov.role === "Department Officer" || prov.role === "OFFICER";
          const role = isOfficer ? "OFFICER" : "ADMIN";
          const dept = currentDepartments.find((d) => d.id === prov.departmentId) || currentDepartments[0];
          const existing = usersByEmail.get(provEmail);

          if (existing) {
            existing.password = prov.password || existing.password || "Password@123";
            existing.role = role;
            existing.departmentId = isOfficer ? (prov.departmentId || "dept-1") : null;
            existing.departmentName = isOfficer
              ? (dept?.name || existing.departmentName || "Kebele Administration & Vital Events")
              : "Woreda Central Administration";
            existing.isActive = prov.isActive !== false;
            existing.isProvisioned = true;
          } else {
            const newUser = {
              id: `usr-prov-${provEmail.replace(/[^a-z0-9]/g, "")}`,
              fullName: prov.fullName,
              email: prov.email,
              password: prov.password || "Password@123",
              phone: prov.phone || "+251911000000",
              nationalId: prov.nationalId || `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
              role,
              departmentId: isOfficer ? (prov.departmentId || "dept-1") : null,
              departmentName: isOfficer
                ? (dept?.name || "Kebele Administration & Vital Events")
                : "Woreda Central Administration",
              address: "Kebele 03, Woreda Center",
              isActive: prov.isActive !== false,
              isProvisioned: true,
              createdAt: prov.createdAt || new Date().toISOString(),
            };
            cleanedUsers.push(newUser);
            usersByEmail.set(provEmail, newUser);
          }
        });

        // Authenticated user is resolved exclusively from the JWT in browser cookies
        const cookieUser = getUserFromJwtCookie(
          cleanedUsers,
          currentDepartments,
          cleanedProvisioned
        );
        return {
          ...currentState,
          ...safePersisted,
          departments: currentDepartments,
          services: currentState.services, // loaded from the API, never from storage
          users: cleanedUsers,
          appointments: cleanedAppointments,
          queue: cleanedQueue,
          provisionedAccounts: cleanedProvisioned,
          schedules: cleanedSchedules,
          currentUser: cookieUser,
        };
      },
    }
  )
);


// Keep open tabs in sync: when another tab saves the store (for example an Admin adding a
// service), reload it here. Without this, a tab opened earlier keeps its old copy in memory
// and overwrites the newer data the next time it saves.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === useStore.persist.getOptions().name) {
      useStore.persist.rehydrate();
    }
  });
}
