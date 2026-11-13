// Global application state (zustand, persisted to localStorage).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  calculateAvailableSlots,
  currentClockTime,
  setJwtCookie,
  clearJwtCookie,
  createJwtToken,
  getUserFromJwtCookie,
} from "@/services";
import { serviceApi, departmentApi, scheduleApi, appointmentApi, queueApi } from "@/api";
import { http, tokenStorage } from "@/api/httpClient";
import { normalizeEthiopianPhone } from "@/utils";

const DEFAULT_TIME_SLOTS = [
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

const DEFAULT_SCHEDULE_CONFIGS = {
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  officeHours: { start: "08:30", end: "17:30" },
  lunchBreak: { start: "12:30", end: "13:30" },
  slotIntervalMinutes: 30,
  maxParallelSlots: 1,
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

// Sequence number of the latest loadAppointments call (see there).
let appointmentLoadSeq = 0;

export const useStore = create(
  persist(
    (set, get) => ({
      // Current Authenticated User (Resolved from JWT in Browser Cookie)
      currentUser: getUserFromJwtCookie([], [], []),
      setCurrentUser: (user, customToken = null) => {
        if (user) {
          const token = customToken || user.token || createJwtToken(user);
          setJwtCookie(token);
          tokenStorage.set(token);
        } else {
          // Revokes a token issued by auth-service (real admin login). Browser-made tokens are
          // rejected by the server with 401, which is ignored. The request reads the token
          // before it is cleared below.
          http.post("/auth/logout").catch(() => {});
          clearJwtCookie();
          tokenStorage.clear();
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

      // Departments State: departments live in department-service (/api/v1/departments).
      departments: [],
      loadDepartments: async () => {
        const { data } = await departmentApi.list();
        const departments = Array.isArray(data) ? data : [];
        set({ departments });
        return departments;
      },
      addDepartment: async (dept) => {
        const { data } = await departmentApi.create(dept);
        await get().loadDepartments();
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "CREATE_DEPARTMENT",
          entity: data?.name || dept.name,
          details: `Created new department: ${data?.name || dept.name} (${data?.code || dept.code})`,
        });
        return data;
      },
      updateDepartment: async (id, updates) => {
        const { data } = await departmentApi.update(id, updates);
        await get().loadDepartments();
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "UPDATE_DEPARTMENT",
          entity: `Dept-${id}`,
          details: `Updated department configurations`,
        });
        return data;
      },
      toggleDepartmentStatus: async (id) => {
        await departmentApi.toggleStatus(id);
        await get().loadDepartments();
      },
      deleteDepartment: async (id) => {
        await departmentApi.remove(id);
        await get().loadDepartments();
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

      // Users Management (Synchronized with provisioned accounts)
      users: [],

      // Registered Citizens Management (Populated during citizen sign-up)
      registeredCitizens: [],
      addRegisteredCitizen: (citizen) => {
        const newCitizen = {
          id: citizen.id || `cit-${Date.now()}`,
          fullName: citizen.fullName?.trim() || "Citizen",
          phone: citizen.phone?.trim() || "",
          locations: citizen.locations || citizen.location || "Addis Ababa",
          woreda: citizen.woreda || "Woreda 03",
          kebele: citizen.kebele || "Kebele 03",
          nationalId: citizen.nationalId || `ET-CIT-${Math.floor(1000 + Math.random() * 9000)}`,
          status: "VERIFIED",
          createdAt: new Date().toISOString(),
        };

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const raw = window.localStorage.getItem("woreda_registered_citizens");
            const existing = raw ? JSON.parse(raw) : [];
            const filtered = existing.filter((c) => c.phone !== newCitizen.phone && c.id !== newCitizen.id);
            window.localStorage.setItem("woreda_registered_citizens", JSON.stringify([newCitizen, ...filtered]));
          } catch {
            // ignore
          }
        }

        set((state) => {
          const current = state.registeredCitizens || [];
          const filtered = current.filter((c) => c.phone !== newCitizen.phone && c.id !== newCitizen.id);
          return { registeredCitizens: [newCitizen, ...filtered] };
        });

        get().addAuditLog({
          userName: newCitizen.fullName,
          userRole: "CITIZEN",
          action: "CITIZEN_REGISTRATION",
          entity: newCitizen.phone,
          details: `New citizen registered: ${newCitizen.fullName} (${newCitizen.woreda}, ${newCitizen.kebele})`,
        });
      },

      // Provisioned Accounts Management (Admin Account Provisioning)
      provisionedAccounts: [],
      addProvisionedAccount: (acc) => {
        const cleanEmail = (acc.email || "").trim().toLowerCase();
        const cleanPhone = (acc.phone || "").trim();
        const role = (acc.role === "Central Administrator" || acc.role === "Admin") ? "ADMIN" : "OFFICER";
        const cleanPassword = (acc.password || "").trim() || "Password@123";
        const newAccount = {
          id: acc.id || `staff-${Date.now()}`,
          fullName: (acc.fullName || "").trim(),
          phone: cleanPhone || (acc.phone || ""),
          email: (acc.email || "").trim(),
          password: cleanPassword,
          passwordHash: acc.passwordHash || null,
          role: acc.role || "Department Officer",
          departmentId: acc.departmentId || null,
          isProvisioned: true,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        const matchesAcc = (a) => {
          const aEmail = (a.email || "").trim().toLowerCase();
          const aPhone = a.phone ? normalizeEthiopianPhone(a.phone) : "";
          const targetPhone = cleanPhone ? normalizeEthiopianPhone(cleanPhone) : "";
          if (targetPhone && aPhone && aPhone === targetPhone) return true;
          if (cleanEmail && aEmail && aEmail === cleanEmail) return true;
          return false;
        };

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
            const list = rawBackup ? JSON.parse(rawBackup) : [];
            const filtered = list.filter((a) => !matchesAcc(a));
            window.localStorage.setItem("woreda_provisioned_accounts", JSON.stringify([newAccount, ...filtered]));
          } catch {
            // ignore
          }
        }

        set((state) => {
          const currentList = state.provisionedAccounts || [];
          const filteredAccs = currentList.filter((a) => !matchesAcc(a));
          const updatedAccounts = [newAccount, ...filteredAccs];

          const currentDepts = state.departments || [];
          const matchedDept =
            currentDepts.find((d) => d.id === newAccount.departmentId || d.name === newAccount.role) || currentDepts[0];
          const userIndex = (state.users || []).findIndex((u) => matchesAcc(u));
          let updatedUsers = [...(state.users || [])];

          if (userIndex >= 0) {
            updatedUsers[userIndex] = {
              ...updatedUsers[userIndex],
              fullName: newAccount.fullName,
              phone: newAccount.phone || updatedUsers[userIndex].phone || "+251911000000",
              email: newAccount.email,
              password: cleanPassword,
              role,
              departmentId: role === "OFFICER" ? (newAccount.departmentId || matchedDept?.id || null) : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || newAccount.role || "Unassigned Department")
                  : "Woreda Central Administration",
              isActive: true,
              isProvisioned: true,
            };
          } else {
            updatedUsers.push({
              id: newAccount.id || `usr-prov-${Date.now()}`,
              fullName: newAccount.fullName,
              phone: newAccount.phone || "+251911000000",
              email: newAccount.email,
              password: cleanPassword,
              nationalId: `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
              role,
              departmentId: role === "OFFICER" ? (newAccount.departmentId || matchedDept?.id || null) : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || newAccount.role || "Unassigned Department")
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
          entity: newAccount.phone || newAccount.email,
          details: `Provisioned account for ${newAccount.fullName} as ${newAccount.role}`,
        });
      },
      updateProvisionedAccount: (originalKey, updatedAcc) => {
        const cleanKey = (originalKey || "").trim().toLowerCase();
        const cleanPhone = (updatedAcc.phone || "").trim();
        const role = (updatedAcc.role === "Central Administrator" || updatedAcc.role === "Admin") ? "ADMIN" : "OFFICER";
        const cleanPassword = (updatedAcc.password || "").trim() || "Password@123";

        const matchesKey = (a) => {
          const aEmail = (a.email || "").trim().toLowerCase();
          const aPhone = a.phone ? normalizeEthiopianPhone(a.phone) : "";
          const targetKey = cleanKey ? normalizeEthiopianPhone(cleanKey) : "";
          if (targetKey && aPhone && aPhone === targetKey) return true;
          if (cleanKey && aEmail && aEmail === cleanKey) return true;
          return false;
        };

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
            const list = rawBackup ? JSON.parse(rawBackup) : [];
            const filtered = list.filter((a) => !matchesKey(a));
            const savedAcc = {
              ...updatedAcc,
              phone: cleanPhone || updatedAcc.phone || "",
              password: cleanPassword,
              isProvisioned: true,
            };
            window.localStorage.setItem("woreda_provisioned_accounts", JSON.stringify([savedAcc, ...filtered]));
          } catch {
            // ignore
          }
        }

        set((state) => {
          const currentList = state.provisionedAccounts || [];
          const updatedAccounts = currentList.map((a) =>
            matchesKey(a)
              ? {
                  ...updatedAcc,
                  fullName: (updatedAcc.fullName || "").trim(),
                  phone: cleanPhone || (updatedAcc.phone || a.phone || "").trim(),
                  email: (updatedAcc.email || "").trim(),
                  password: cleanPassword,
                  passwordHash: updatedAcc.passwordHash || null,
                  departmentId: updatedAcc.departmentId || null,
                  isProvisioned: true,
                  updatedAt: new Date().toISOString(),
                }
              : a
          );
          const currentDepts = state.departments || [];
          const matchedDept =
            currentDepts.find((d) => d.id === updatedAcc.departmentId || d.name === updatedAcc.role) || currentDepts[0];
          
          const userIdx = (state.users || []).findIndex((u) => matchesKey(u));
          let updatedUsers = [...(state.users || [])];

          if (userIdx >= 0) {
            updatedUsers[userIdx] = {
              ...updatedUsers[userIdx],
              fullName: (updatedAcc.fullName || "").trim(),
              phone: cleanPhone || (updatedAcc.phone || updatedUsers[userIdx].phone || "").trim(),
              email: (updatedAcc.email || "").trim(),
              password: cleanPassword,
              role,
              departmentId: role === "OFFICER" ? (updatedAcc.departmentId || matchedDept?.id || null) : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || updatedAcc.role || "Unassigned Department")
                  : "Woreda Central Administration",
              isProvisioned: true,
            };
          } else {
            updatedUsers.push({
              id: updatedAcc.id || `usr-prov-${Date.now()}`,
              fullName: (updatedAcc.fullName || "").trim(),
              phone: cleanPhone || "+251911000000",
              email: (updatedAcc.email || "").trim(),
              password: cleanPassword,
              nationalId: `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
              role,
              departmentId: role === "OFFICER" ? (updatedAcc.departmentId || matchedDept?.id || null) : null,
              departmentName:
                role === "OFFICER"
                  ? (matchedDept?.name || updatedAcc.role || "Unassigned Department")
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
          entity: updatedAcc.phone || updatedAcc.email,
          details: `Updated provisioned account for ${updatedAcc.fullName}`,
        });
      },
      deleteProvisionedAccount: (keyToDelete) => {
        const cleanKey = (keyToDelete || "").trim().toLowerCase();
        const matchesKey = (a) => {
          const aEmail = (a.email || "").trim().toLowerCase();
          const aPhone = a.phone ? normalizeEthiopianPhone(a.phone) : "";
          const targetKey = cleanKey ? normalizeEthiopianPhone(cleanKey) : "";
          if (targetKey && aPhone && aPhone === targetKey) return true;
          if (cleanKey && aEmail && aEmail === cleanKey) return true;
          return false;
        };

        if (typeof window !== "undefined" && window.localStorage) {
          try {
            const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
            const list = rawBackup ? JSON.parse(rawBackup) : [];
            const filtered = list.filter((a) => !matchesKey(a));
            window.localStorage.setItem("woreda_provisioned_accounts", JSON.stringify(filtered));
          } catch {
            // ignore
          }
        }

        set((state) => ({
          provisionedAccounts: (state.provisionedAccounts || []).filter((a) => !matchesKey(a)),
          users: (state.users || []).filter((u) => !matchesKey(u)),
        }));
        get().addAuditLog({
          userName: get().currentUser?.fullName || "Admin",
          userRole: "ADMIN",
          action: "DELETE_PROVISIONED_ACCOUNT",
          entity: keyToDelete,
          details: `Deleted provisioned account ${keyToDelete}`,
        });
      },

      // Schedule Configurations
      scheduleConfigs: DEFAULT_SCHEDULE_CONFIGS,

      // Municipal Service Schedules: they live in booking-service (/api/v1/schedules). Admin >
      // Schedule Management reads all of them; the citizen booking page reads the bookable ones
      // (ACTIVE, not yet ended) from the public /schedules/active.
      schedules: [],
      loadSchedules: async () => {
        const { data } = await scheduleApi.list();
        const schedules = Array.isArray(data) ? data : [];
        set({ schedules });
        return schedules;
      },
      loadBookableSchedules: async () => {
        const { data } = await scheduleApi.active();
        const schedules = Array.isArray(data) ? data : [];
        set({ schedules });
        return schedules;
      },
      addSchedule: async (sch) => {
        const { data } = await scheduleApi.create(sch);
        await get().loadSchedules();
        return data;
      },
      updateSchedule: async (id, updates) => {
        const { data } = await scheduleApi.update(id, updates);
        await get().loadSchedules();
        return data;
      },
      deleteSchedule: async (id) => {
        await scheduleApi.remove(id);
        await get().loadSchedules();
      },
      toggleScheduleStatus: async (id) => {
        const { data } = await scheduleApi.toggleStatus(id);
        await get().loadSchedules();
        return data;
      },

      // Appointments State: appointments live in appointment-service (MongoDB). Each role reads
      // its own view: a citizen their bookings (GET /appointments/my), an officer only the
      // appointments of the department the Admin assigned in Account Provision (GET /appointments,
      // scoped on the server by the officer's token), the administrator all of them.
      appointments: [],
      serverSessionInvalid: false,
      loadAppointments: async () => {
        // Several reloads can overlap (a burst of bookings); only the newest one may write the
        // list, otherwise an older, shorter answer arriving last would hide new appointments.
        const seq = ++appointmentLoadSeq;
        const role = get().currentUser?.role;
        let list = [];
        try {
          if (role === "CITIZEN") {
            const { data } = await appointmentApi.myHistory();
            list = Array.isArray(data) ? data : [];
          } else if (role === "OFFICER" || role === "ADMIN") {
            const { data } = await appointmentApi.list({ limit: 200 });
            list = Array.isArray(data) ? data : [];
          }
        } catch (err) {
          // 401/403: the session is not a server account (made in this browser before accounts
          // moved to the server) or it expired. Pages tell the user to sign in again.
          if (err?.status === 401 || err?.status === 403) set({ serverSessionInvalid: true, appointments: [] });
          throw err;
        }
        if (get().serverSessionInvalid) set({ serverSessionInvalid: false });
        // Desk steps after check-in (call, serve, complete) are still kept in this browser:
        // keep them over the server's CHECKED_IN state.
        const local = new Map(get().appointments.map((a) => [a.id, a]));
        const merged = list.map((a) => {
          const mine = local.get(a.id);
          const deskStage = ["IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(mine?.status);
          return deskStage && ["CHECKED_IN", "APPROVED", "PENDING", "IN_PROGRESS"].includes(a.status)
            ? { ...a, status: mine.status, completedAt: mine.completedAt || a.completedAt }
            : a;
        });
        if (seq !== appointmentLoadSeq) return get().appointments;
        set({ appointments: merged });
        return merged;
      },

      /** POST /appointments as the signed-in citizen; resolves to the stored appointment. */
      bookAppointment: async (bookingData) => {
        const { data } = await appointmentApi.book({
          citizenName: bookingData.citizenName,
          citizenPhone: bookingData.citizenPhone,
          departmentId: bookingData.departmentId,
          serviceId: bookingData.serviceId,
          date: bookingData.date,
          timeSlot: bookingData.timeSlot,
          citizenNotes: bookingData.citizenNotes || "",
        });
        await get().loadAppointments().catch(() => {});

        get().addNotification({
          userId: data.citizenId,
          title: "Appointment Submitted",
          message: `Your appointment request for ${data.serviceName} has been submitted (Ref: ${data.referenceNumber}).`,
          type: "INFO",
        });
        return data;
      },

      /**
       * Status changes go to the server: APPROVED / REJECTED (department officer review),
       * CANCELLED (citizen) and CHECKED_IN (reception desk). The later desk steps
       * (IN_PROGRESS, COMPLETED, NO_SHOW) are still recorded in this browser.
       */
      // The last failed status change, for pages that show it ({ id, status, message }).
      appointmentError: null,
      clearAppointmentError: () => set({ appointmentError: null }),

      /** Resolves to true when the change was saved; on failure sets appointmentError instead. */
      updateAppointmentStatus: async (id, status, notes = "", officerReason = "") => {
        try {
          await get().changeAppointmentStatus(id, status, notes, officerReason);
          set({ appointmentError: null });
          return true;
        } catch (err) {
          const message =
            err?.status === 409 && /approved appointment can no longer be cancelled/i.test(err.message || "")
              ? "A department officer has already approved this appointment, so it can no longer be cancelled."
              : err?.status === 409
              ? "This appointment was already decided or changed. The list has been refreshed."
              : err?.status === 403
                ? "This appointment belongs to another department."
                : err?.status === 401
                  ? "Your session has expired. Please sign in again."
                  : err?.status === 422 && err.details?.length
                    ? err.details.map((d) => d.issue).join(" ")
                    : "Could not save the change: the server is unreachable.";
          set({ appointmentError: { id, status, message } });
          await get().loadAppointments().catch(() => {});
          return false;
        }
      },

      changeAppointmentStatus: async (id, status, notes = "", officerReason = "") => {
        const apt = get().appointments.find((a) => a.id === id);
        if (!apt) return;

        if (status === "APPROVED" || status === "REJECTED") {
          const rejectionReason = status === "REJECTED" ? officerReason || notes || "Not specified" : "";
          await appointmentApi.updateStatus(id, {
            status,
            officerNotes: notes || "",
            rejectionReason,
          });
          set((state) => ({
            appointments: state.appointments.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status,
                    officerNotes: notes || a.officerNotes,
                    rejectionReason: status === "REJECTED" ? rejectionReason : a.rejectionReason,
                  }
                : a
            ),
          }));
        } else if (status === "CANCELLED") {
          await appointmentApi.cancel(id);
        } else if (status === "CHECKED_IN") {
          const { data } = await queueApi.verifyCheckIn({ appointmentId: id, verifiedDocuments: [], notes: notes || "" });
          get().addToQueue({
            appointmentId: apt.id,
            tokenNumber: data?.tokenNumber || apt.tokenNumber,
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
        } else if (status === "COMPLETED" || status === "NO_SHOW") {
          await queueApi.finalize(id, status).catch(() => {});
          set((state) => ({
            appointments: state.appointments.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status,
                    completedAt: status === "COMPLETED" ? new Date().toISOString() : a.completedAt,
                    officerNotes: notes || a.officerNotes,
                  }
                : a
            ),
          }));
        } else {
          set((state) => ({
            appointments: state.appointments.map((a) =>
              a.id === id
                ? {
                    ...a,
                    status,
                    completedAt: status === "COMPLETED" ? new Date().toISOString() : a.completedAt,
                    officerNotes: notes || a.officerNotes,
                  }
                : a
            ),
          }));
          return;
        }
        await get().loadAppointments().catch(() => {});
      },

      rescheduleAppointment: async (id, newDate, newTimeSlot, reason = "") => {
        await appointmentApi.reschedule(id, { newDate, newTimeSlot, reason });
        await get().loadAppointments().catch(() => {});
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
      callNextCitizen: (departmentId) => {
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
          maxPerSlot: 1,
        }),
    }),
    {
      name: "woreda-booking-storage",
      partialize: (state) => {
        const safeCurrentUser = state.currentUser
          ? (({ password: _p, passwordHash: _ph, ...rest }) => rest)(state.currentUser)
          : null;
        return {
          currentUser: safeCurrentUser,
          users: state.users,
          provisionedAccounts: state.provisionedAccounts,
          registeredCitizens: state.registeredCitizens,
          queue: state.queue,
          notifications: state.notifications,
          scheduleConfigs: state.scheduleConfigs,
        };
      },
      merge: (persistedState, currentState) => {
        const { currentUser: persistedUser, ...safePersisted } = persistedState || {};
        
        // Departments come from the API; an old browser copy (which may hold departments the
        // server never had) is ignored.
        delete safePersisted.departments;
        const currentDepartments = currentState.departments || [];

        // Strip legacy pre-seeded mock officer accounts so Account Provision starts clean
        const LEGACY_MOCK_OFFICER_EMAILS = new Set([
          "tigist.kbl@woreda.gov.et",
          "yared.lnd@woreda.gov.et",
          "solomon.trd@woreda.gov.et",
          "hana.tax@woreda.gov.et",
          "mesfin.soc@woreda.gov.et",
          "selam.health@woreda.gov.et",
          "berhanu.audit@woreda.gov.et",
        ]);

        // Ensure provisioned accounts are populated, merging defaults with any admin edits
        const persistedProv = safePersisted.provisionedAccounts || [];
        const provMap = new Map();

        // Overlay user-created and persisted provisioned accounts with robust password preservation
        persistedProv.forEach((a) => {
          const emailKey = (a.email || "").trim().toLowerCase();
          if (!emailKey) return;
          // Filter out legacy pre-seeded mock officer accounts
          if (LEGACY_MOCK_OFFICER_EMAILS.has(emailKey) && (!a.createdAt || a.createdAt === "2026-11-01T08:00:00Z")) {
            return;
          }
          const resolvedPassword = (a.password || "").trim() || "Password@123";

          provMap.set(emailKey, {
            ...a,
            fullName: (a.fullName || "").trim(),
            email: (a.email || "").trim(),
            password: resolvedPassword,
            role: a.role || "Department Officer",
            departmentId: a.departmentId || null,
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
                // Purge legacy mock accounts from backup storage
                const sanitizedBackup = parsedBackup.filter((a) => {
                  const emailKey = (a.email || "").trim().toLowerCase();
                  return !(LEGACY_MOCK_OFFICER_EMAILS.has(emailKey) && (!a.createdAt || a.createdAt === "2026-11-01T08:00:00Z"));
                });
                window.localStorage.setItem("woreda_provisioned_accounts", JSON.stringify(sanitizedBackup));

                sanitizedBackup.forEach((a) => {
                  const emailKey = (a.email || "").trim().toLowerCase();
                  if (!emailKey) return;
                  const existing = provMap.get(emailKey) || {};
                  const resolvedPassword =
                    (a.password || "").trim() ||
                    existing.password ||
                    "Password@123";

                  provMap.set(emailKey, {
                    ...existing,
                    ...a,
                    fullName: (a.fullName || existing.fullName || "").trim(),
                    phone: (a.phone || existing.phone || "").trim(),
                    email: (a.email || existing.email || "").trim(),
                    password: resolvedPassword,
                    role: a.role || existing.role || "Department Officer",
                    departmentId: a.departmentId || existing.departmentId || null,
                    isProvisioned: true,
                    isActive: a.isActive !== false,
                  });
                });
              }
            }
          } catch {
            // ignore
          }
        }

        const cleanedProvisioned = Array.from(provMap.values());

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
          (u) =>
            (!LEGACY_MOCK_USER_IDS.has(u.id) || u.isProvisioned) &&
            !LEGACY_MOCK_OFFICER_EMAILS.has((u.email || "").trim().toLowerCase())
        );

        // Synchronize provisioned accounts into users so both stores stay aligned
        const usersByEmail = new Map(
          cleanedUsers.map((u) => [(u.email || "").trim().toLowerCase(), u])
        );
        cleanedProvisioned.forEach((prov) => {
          const provEmail = (prov.email || "").trim().toLowerCase();
          const provPhone = prov.phone ? normalizeEthiopianPhone(prov.phone) : "";
          if (!provEmail && !provPhone) return;
          const isOfficer = prov.role !== "Central Administrator" && prov.role !== "Admin" && prov.role !== "ADMIN";
          const role = isOfficer ? "OFFICER" : "ADMIN";
          const dept = currentDepartments.find((d) => d.id === prov.departmentId || d.name === prov.role) || currentDepartments[0];
          const existing = (provEmail && usersByEmail.get(provEmail)) || (provPhone ? cleanedUsers.find((u) => u.phone && normalizeEthiopianPhone(u.phone) === provPhone) : null);

          if (existing) {
            existing.password = prov.password || existing.password || "Password@123";
            existing.role = role;
            existing.departmentId = isOfficer ? (prov.departmentId || null) : null;
            existing.departmentName = isOfficer
              ? (dept?.name || existing.departmentName || "Unassigned Department")
              : "Woreda Central Administration";
            existing.isActive = prov.isActive !== false;
            existing.isProvisioned = true;
          } else {
            const userIdentifier = provEmail || (provPhone ? `${provPhone.replace(/\D/g, "")}@woreda.gov.et` : `usr-${Date.now()}`);
            const newUser = {
              id: prov.id || `usr-prov-${userIdentifier.replace(/[^a-z0-9]/g, "")}`,
              fullName: prov.fullName,
              email: prov.email || userIdentifier,
              password: prov.password || "Password@123",
              phone: prov.phone || "+251911000000",
              nationalId: prov.nationalId || `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
              role,
              departmentId: isOfficer ? (prov.departmentId || null) : null,
              departmentName: isOfficer
                ? (dept?.name || "Unassigned Department")
                : "Woreda Central Administration",
              address: "Kebele 03, Woreda Center",
              isActive: prov.isActive !== false,
              isProvisioned: true,
              createdAt: prov.createdAt || new Date().toISOString(),
            };
            cleanedUsers.push(newUser);
            if (provEmail) usersByEmail.set(provEmail, newUser);
          }
        });

        // Resolve authenticated user from JWT storage and persisted state (never auto-expires on idle)
        const cookieUser = getUserFromJwtCookie(
          cleanedUsers,
          currentDepartments,
          cleanedProvisioned
        );
        let restoredUser = null;
        if (persistedUser === null && cookieUser === null) {
          restoredUser = null;
        } else if (currentState.currentUser?.id) {
          restoredUser =
            cookieUser && cookieUser.id === currentState.currentUser.id
              ? { ...cookieUser, ...currentState.currentUser }
              : currentState.currentUser;
        } else {
          restoredUser =
            cookieUser && persistedUser && persistedUser.id === cookieUser.id
              ? { ...cookieUser, ...persistedUser }
              : persistedUser || cookieUser || null;
        }
        return {
          ...currentState,
          ...safePersisted,
          departments: currentDepartments,
          services: currentState.services, // loaded from the API, never from storage
          users: cleanedUsers,
          appointments: currentState.appointments, // loaded from the API, never from storage
          queue: cleanedQueue,
          provisionedAccounts: cleanedProvisioned,
          registeredCitizens: safePersisted.registeredCitizens || currentState.registeredCitizens || [],
          schedules: currentState.schedules, // loaded from the API, never from storage
          currentUser: restoredUser,
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
