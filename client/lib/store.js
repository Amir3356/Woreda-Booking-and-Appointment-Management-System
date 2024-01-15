"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  INITIAL_DEPARTMENTS,
  INITIAL_SERVICES,
  INITIAL_USERS,
  INITIAL_APPOINTMENTS,
  INITIAL_QUEUE,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SCHEDULE_CONFIGS,
  TIME_SLOTS,
} from "./mock-data";

export const useStore = create(
  persist(
    (set, get) => ({
      // Current Authenticated User (Defaults to Admin)
      currentUser: INITIAL_USERS.find((u) => u.id === "usr-admin") || INITIAL_USERS[0],
      setCurrentUser: (user) => {
        set({ currentUser: user });
        get().addAuditLog({
          userName: user?.fullName || "Anonymous",
          userRole: user?.role || "GUEST",
          action: "USER_LOGIN",
          entity: "Auth",
          details: `User switched session to ${user?.fullName} (${user?.role})`,
        });
      },

      // Departments State
      departments: INITIAL_DEPARTMENTS,
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
      services: INITIAL_SERVICES,
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
      },
      toggleServiceStatus: (id) => {
        set((state) => ({
          services: state.services.map((s) =>
            s.id === id ? { ...s, isActive: !s.isActive } : s
          ),
        }));
      },

      // Users Management
      users: INITIAL_USERS,
      addUser: (user) => {
        const newUser = {
          ...user,
          id: `usr-${Date.now()}`,
          isActive: true,
          createdAt: new Date().toISOString(),
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

      // Schedule Configurations
      scheduleConfigs: INITIAL_SCHEDULE_CONFIGS,
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

      // Appointments State
      appointments: INITIAL_APPOINTMENTS,
      bookAppointment: (bookingData) => {
        const dateStr = bookingData.date.replace(/-/g, "");
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const refNumber = `WRD-${dateStr}-${randomNum}`;

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
          const deptCode = dept?.code || "KBL";
          const count = get().queue.filter((q) => q.departmentId === apt.departmentId).length + 1;
          tokenNumber = `${deptCode}-${count.toString().padStart(2, "0")}`;
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
            checkedInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
          type: status === "APPROVED" || status === "COMPLETED" ? "SUCCESS" : status === "REJECTED" ? "ALERT" : "INFO",
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
      queue: INITIAL_QUEUE,
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
                  calledTime: status === "SERVING" ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : q.calledTime,
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
      notifications: INITIAL_NOTIFICATIONS,
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
      auditLogs: INITIAL_AUDIT_LOGS,
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
      getAvailableSlots: (serviceId, date) => {
        if (!date) return [];
        const existingBookings = get().appointments.filter(
          (a) =>
            a.serviceId === serviceId &&
            a.date === date &&
            a.status !== "CANCELLED" &&
            a.status !== "REJECTED"
        );

        const bookedSlots = existingBookings.map((a) => a.timeSlot);
        const maxPerSlot = get().scheduleConfigs.maxParallelSlots || 2;

        return TIME_SLOTS.map((slot) => {
          const count = bookedSlots.filter((s) => s === slot).length;
          const isFull = count >= maxPerSlot;
          return {
            time: slot,
            available: !isFull,
            remainingCapacity: Math.max(0, maxPerSlot - count),
          };
        });
      },
    }),
    {
      name: "woreda-booking-storage",
      partialize: (state) => ({
        departments: state.departments,
        services: state.services,
        appointments: state.appointments,
        queue: state.queue,
        notifications: state.notifications,
        auditLogs: state.auditLogs,
        scheduleConfigs: state.scheduleConfigs,
      }),
    }
  )
);

