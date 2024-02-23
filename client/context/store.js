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
      departments: [],
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

      // Services State
      services: [],
      addService: (service) => {
        const newService = {
          ...service,
          id: `srv-${Date.now()}`,
          isActive: true,
        };
        set((state) => ({ services: [newService, ...state.services] }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "CREATE_SERVICE",
          entity: newService.name,
          details: `Added new public service: ${newService.name}`,
        });
        return newService;
      },
      updateService: (id, updates) => {
        set((state) => ({
          services: state.services.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "UPDATE_SERVICE",
          entity: updates.name || `Srv-${id}`,
          details: `Updated service record`,
        });
      },
      toggleServiceStatus: (id) => {
        set((state) => ({
          services: state.services.map((s) =>
            s.id === id ? { ...s, isActive: !s.isActive } : s
          ),
        }));
      },
      deleteService: (id) => {
        set((state) => ({
          services: state.services.filter((s) => s.id !== id),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "DELETE_SERVICE",
          entity: `Srv-${id}`,
          details: `Deleted service record`,
        });
      },
      clearAllServices: () => {
        set({ services: [] });
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "CLEAR_SERVICES",
          entity: "Services Catalog",
          details: "Purged all services from catalog",
        });
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
      provisionedAccounts: [],
      addProvisionedAccount: (acc) => {
        const cleanEmail = acc.email.trim().toLowerCase();
        const role = acc.role === "Central Administrator" ? "ADMIN" : "OFFICER";
        const newAccount = {
          fullName: acc.fullName.trim(),
          email: acc.email.trim(),
          password: acc.password,
          role: acc.role || "Department Officer",
          departmentId: acc.departmentId || "dept-1",
        };

        set((state) => {
          const filteredAccs = state.provisionedAccounts.filter(
            (a) => a.email.toLowerCase() !== cleanEmail
          );
          const updatedAccounts = [newAccount, ...filteredAccs];

          const matchedDept =
            state.departments.find((d) => d.id === newAccount.departmentId) || state.departments[0];
          const userIndex = state.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
          let updatedUsers = [...state.users];

          if (userIndex >= 0) {
            updatedUsers[userIndex] = {
              ...updatedUsers[userIndex],
              fullName: newAccount.fullName,
              password: newAccount.password,
              role,
              departmentId: role === "OFFICER" ? (newAccount.departmentId || "dept-1") : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || "Kebele Administration & Vital Events")
                  : "Woreda Central Administration",
              isActive: true,
            };
          } else {
            updatedUsers.push({
              id: `usr-prov-${Date.now()}`,
              fullName: newAccount.fullName,
              email: newAccount.email,
              password: newAccount.password,
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
        const cleanOriginal = originalEmail.trim().toLowerCase();
        const role = updatedAcc.role === "Central Administrator" ? "ADMIN" : "OFFICER";

        set((state) => {
          const updatedAccounts = state.provisionedAccounts.map((a) =>
            a.email.toLowerCase() === cleanOriginal
              ? {
                  ...updatedAcc,
                  fullName: updatedAcc.fullName.trim(),
                  email: updatedAcc.email.trim(),
                  departmentId: updatedAcc.departmentId || "dept-1",
                }
              : a
          );
          const matchedDept =
            state.departments.find((d) => d.id === updatedAcc.departmentId) || state.departments[0];
          
          const userIdx = state.users.findIndex((u) => u.email.toLowerCase() === cleanOriginal);
          let updatedUsers = [...state.users];

          if (userIdx >= 0) {
            updatedUsers[userIdx] = {
              ...updatedUsers[userIdx],
              fullName: updatedAcc.fullName.trim(),
              email: updatedAcc.email.trim(),
              password: updatedAcc.password,
              role,
              departmentId: role === "OFFICER" ? (updatedAcc.departmentId || "dept-1") : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || "Kebele Administration & Vital Events")
                  : "Woreda Central Administration",
            };
          } else {
            updatedUsers.push({
              id: `usr-prov-${Date.now()}`,
              fullName: updatedAcc.fullName.trim(),
              email: updatedAcc.email.trim(),
              password: updatedAcc.password,
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
        const cleanEmail = emailToDelete.trim().toLowerCase();
        set((state) => ({
          provisionedAccounts: state.provisionedAccounts.filter(
            (a) => a.email.toLowerCase() !== cleanEmail
          ),
          users: state.users.filter((u) => u.email.toLowerCase() !== cleanEmail),
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

      // Audit Logs
      auditLogs: [],
      addAuditLog: (log) => {
        const newLog = {
          ...log,
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          ipAddress: "192.168.1.100",
        };
        set((state) => ({ auditLogs: [newLog, ...state.auditLogs] }));
      },

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
        services: state.services,
        servicesPurgedV2: state.servicesPurgedV2 ?? true,
        appointments: state.appointments,
        queue: state.queue,
        notifications: state.notifications,
        auditLogs: state.auditLogs,
        scheduleConfigs: state.scheduleConfigs,
        schedules: state.schedules,
      }),
      merge: (persistedState, currentState) => {
        const { currentUser: _omitted, ...safePersisted } = persistedState || {};
        // Strip legacy mock provisioned accounts so Account Provision view starts clean
        const LEGACY_MOCK_EMAILS = new Set([
          "tigist.kbl@woreda.gov.et",
          "yared.lnd@woreda.gov.et",
          "solomon.trd@woreda.gov.et",
          "hana.tax@woreda.gov.et",
          "mesfin.soc@woreda.gov.et",
          "selam.health@woreda.gov.et",
          "berhanu.audit@woreda.gov.et",
          "amirsiraj1995@gmail.com",
        ]);
        const cleanedProvisioned = (safePersisted.provisionedAccounts || []).filter(
          (acc) => !LEGACY_MOCK_EMAILS.has(acc.email?.toLowerCase())
        );

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

        // Strip legacy mock users
        const LEGACY_MOCK_USER_IDS = new Set([
          "usr-officer-1",
          "usr-officer-2",
          "usr-officer-3",
          "usr-citizen-1",
          "usr-citizen-2",
          "usr-citizen-3",
        ]);
        const cleanedUsers = (safePersisted.users || []).filter(
          (u) => !LEGACY_MOCK_USER_IDS.has(u.id)
        );

        const currentDepartments = safePersisted.departments || [];

        // Strip legacy mock services and purge mock/real data on upgrade
        const LEGACY_MOCK_SERVICE_IDS = new Set([
          "srv-1",
          "srv-2",
          "srv-3",
          "srv-4",
          "srv-5",
          "srv-6",
          "srv-7",
          "srv-8",
          "srv-9",
          "srv-10",
        ]);

        let currentServices = [];
        if (safePersisted.servicesPurgedV2) {
          currentServices = (safePersisted.services || []).filter(
            (s) => !LEGACY_MOCK_SERVICE_IDS.has(s.id)
          );
        } else {
          // One-time purge of all mock and real services in local storage
          currentServices = [];
        }

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
          services: currentServices,
          servicesPurgedV2: true,
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

