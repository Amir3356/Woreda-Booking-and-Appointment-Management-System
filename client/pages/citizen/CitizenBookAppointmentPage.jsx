import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { useEscapeKey } from "@/hooks";
import { subscribe, isLive } from "@/api/realtime";
import { scheduleApi } from "@/api";
import {
  APPOINTMENT_STATUS_CONFIG,
  bookableRange,
  closedMessage,
  displayDate,
  displayTime,
  formatWorkingDays,
  localIsoDate,
  addDays,
  nextWorkingDate,
  scheduleOn,
  schedulesForService,
  weekdayOfIso,
} from "@/utils";
import { DataTable } from "@/components/ui";
import {
  Calendar,
  Clock,
  Building2,
  FileText,
  Search,
  Filter,
  RotateCcw,
  CheckCircle,
  X,
  AlertCircle,
} from "lucide-react";

export default function CitizenBookAppointmentPage() {
  // Bumped on every catalog/schedule change so open availability is fetched again.
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  const {
    currentUser,
    appointments = [],
    bookAppointment,
    updateAppointmentStatus,
    serverSessionInvalid,
    setCurrentUser,
    departments = [],
    services = [],
    schedules = [],
    loadServices,
    loadDepartments,
    loadBookableSchedules,
    loadAppointments,
  } = useStore();

  // Services and bookable schedules come from the server catalog and schedule management.
  // The citizen's booked appointments and catalog are refreshed on open and on WebSocket announcements.
  useEffect(() => {
    const refresh = () => {
      loadServices().catch(() => {});
      loadDepartments?.().catch(() => {});
      loadBookableSchedules().catch(() => {});
      loadAppointments().catch(() => {});
      setAvailabilityVersion((v) => v + 1); // re-read slot availability as well
    };
    refresh();
    const offChange = subscribe("catalog.changed", refresh);
    const offApts = subscribe("appointments.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh); // changes made while disconnected
    return () => {
      offChange();
      offApts();
      offReconnect();
    };
  }, [loadServices, loadDepartments, loadBookableSchedules, loadAppointments]);

  /** Bookings still possible on a day: free places in its times, capped by the daily capacity. */
  const placesLeft = (data) => {
    const free = (data?.slots || [])
      .filter((sl) => sl.status === "Available")
      .reduce((sum, sl) => sum + (sl.remainingCapacity || 0), 0);
    let left = data?.dailyCapacity ? Math.max(0, Math.min(free, data.dailyCapacity - data.bookedForDay)) : free;
    // The department-wide daily capacity (Schedule Management) can be lower still.
    if (data?.departmentCapacity) left = Math.max(0, Math.min(left, data.departmentCapacity - (data.departmentBooked || 0)));
    return left;
  };

  // Status column: the citizen's own latest booking for the row's service. A department officer
  // approves or rejects it (Officer > Appointment Management); the citizen can cancel it while it
  // is still Pending.
  const DECISION_STATUSES = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    CHECKED_IN: "Checked In",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
    NO_SHOW: "No Show",
  };
  // Only while Pending: once a department officer approves the booking it can't be cancelled.
  const CANCELLABLE = ["PENDING"];
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState("");

  const handleCancelBooking = async (booking) => {
    setCancelError("");
    setCancellingId(booking.id);
    const ok = await updateAppointmentStatus(booking.id, "CANCELLED");
    setCancellingId(null);
    if (ok) {
      setAvailabilityVersion((v) => v + 1); // the freed time is bookable again
      showSuccess(`Appointment ${booking.referenceNumber || ""} has been cancelled.`);
      await loadAppointments().catch(() => {});
    } else {
      setCancelError(
        `Could not cancel ${booking.referenceNumber || ""}: ${
          useStore.getState().appointmentError?.message || "please try again."
        }`
      );
    }
  };

  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Booking Modal State
  const [selectedSlot, setSelectedSlot] = useState(null);
  useEscapeKey(Boolean(selectedSlot), () => setSelectedSlot(null));
  const [citizenNotes, setCitizenNotes] = useState("");
  const showSuccess = (msg) => toast.success(msg, { duration: 6000 });

  // Modal service dropdown: every active service from Admin > Services Management.
  // The department is taken from the chosen service, so citizens don't pick it separately.
  // The dropdown lists every service in that table; INACTIVE ones are shown but cannot be chosen.
  const allServices = services || [];
  const isBookable = (s) => s.isActive !== false;
  const activeServices = allServices.filter(isBookable);

  const serviceSelection = (serviceId, bookable = activeServices) => {
    const srv = bookable.find((s) => s.id === serviceId);
    if (!srv) {
      return { serviceId: "", service: "", departmentId: "", department: "" };
    }
    const dept = departments.find((d) => d.id === srv.departmentId);
    return {
      serviceId: srv.id,
      service: srv.name,
      departmentId: srv.departmentId,
      department: dept?.name || "Municipal Department",
    };
  };

  const todayIso = localIsoDate();
  const selectedService = allServices.find((s) => s.id === selectedSlot?.serviceId) || null;
  const serviceSchedules = schedulesForService(selectedService, schedules);
  const dateRange = bookableRange(selectedService, schedules, todayIso);
  const scheduleForDate =
    selectedService && selectedSlot?.date ? scheduleOn(selectedService, schedules, selectedSlot.date) : null;

  // Slots of the chosen service on the chosen date, from booking-service (schedule hours, working
  // days, daily capacity and existing bookings).
  const [availability, setAvailability] = useState({ loading: false, data: null, error: "" });
  useEffect(() => {
    const serviceId = selectedSlot?.serviceId;
    const date = selectedSlot?.date;
    if (!serviceId || !date) {
      setAvailability({ loading: false, data: null, error: "" });
      return;
    }
    let cancelled = false;
    setAvailability((prev) => ({ ...prev, loading: true, error: "" }));
    scheduleApi
      .availabilityWithRetry({ serviceId, date })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.closedReason === "DAY_OVER" && date === localIsoDate()) {
          // All of today's times have passed: go to the service's next working day instead.
          const srv = (useStore.getState().services || []).find((s) => s.id === serviceId);
          const next = nextWorkingDate(srv, useStore.getState().schedules || [], addDays(date, 1));
          if (next) {
            setSelectedSlot((prev) => (prev?.serviceId === serviceId && prev.date === date
              ? { ...prev, date: next, dateDisplay: displayDate(next), time: "" }
              : prev));
            return;
          }
        }
        setAvailability({ loading: false, data, error: "" });
        // Keep the chosen time if it is still free, otherwise take the first free slot.
        const free = (data?.slots || []).filter((sl) => sl.status === "Available");
        setSelectedSlot((prev) =>
          prev && !free.some((sl) => sl.timeSlot === prev.time)
            ? { ...prev, time: free[0]?.timeSlot || "" }
            : prev
        );
      })
      .catch(() => {
        if (!cancelled) {
          // No message: the time list simply stays empty until the next change re-checks it.
          setAvailability({ loading: false, data: null, error: "failed" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlot?.serviceId, selectedSlot?.date, availabilityVersion]);

  // Dates the citizen can actually book for the chosen service (next 60 days), as decided by the
  // server from Schedule Management: working hours, holidays and other exceptions and daily
  // capacities. Used to tell the citizen when no date at all is open in that period.
  const [bookableDates, setBookableDates] = useState({ serviceId: "", dates: [] });
  useEffect(() => {
    const serviceId = selectedSlot?.serviceId;
    if (!serviceId) {
      setBookableDates({ serviceId: "", dates: [] });
      return undefined;
    }
    let cancelled = false;
    const from = localIsoDate();
    scheduleApi
      .bookableDates({ serviceId, from, to: addDays(from, 59) })
      .then(({ data }) => {
        if (!cancelled) setBookableDates({ serviceId, dates: (data || []).filter((d) => d.available).map((d) => d.date) });
      })
      .catch(() => !cancelled && setBookableDates({ serviceId, dates: [] }));
    return () => {
      cancelled = true;
    };
  }, [selectedSlot?.serviceId, availabilityVersion]);

  // Times offered in the dropdown: the schedule's opening hours (lunch break and closed hours left out).
  const timeOptions = (availability.data?.slots || []).filter((sl) => sl.status !== "Unavailable");
  const chosenSlot = timeOptions.find((sl) => sl.timeSlot === selectedSlot?.time);
  const canConfirm = Boolean(selectedSlot?.serviceId && selectedSlot?.date && chosenSlot?.status === "Available");

  // The time field is a native time input (like Admin > Working Hours > Lunch Break). The server's
  // slot labels are "HH:MM AM/PM" with a 24-hour hour ("13:30 PM"); the input works in "HH:MM".
  const slotToClock = (label) => (label ? String(label).slice(0, 5) : "");
  const clockToSlot = (clock) => {
    if (!clock) return "";
    const [h] = clock.split(":").map(Number);
    return `${clock.slice(0, 5)} ${h >= 12 ? "PM" : "AM"}`;
  };
  const daySlots = availability.data?.slots || [];
  const bookableTimes = daySlots.filter((sl) => sl.status === "Available");
  const timeInputDisabled =
    availability.loading ||
    daySlots.length === 0 ||
    Boolean(availability.data?.closedReason && !["DAILY_CAPACITY_REACHED", "DEPARTMENT_CAPACITY_REACHED"].includes(availability.data.closedReason));
  // Why the typed time cannot be booked (empty when it can, or when the day itself is closed).
  const timeNotice = (() => {
    const time = selectedSlot?.time;
    if (!time || !availability.data || timeInputDisabled || chosenSlot?.status === "Available") return "";
    const opening = availability.data.openingTime;
    const closing = availability.data.closingTime;
    const slot = daySlots.find((sl) => sl.timeSlot === time);
    if (!slot) {
      const t = slotToClock(time);
      if (opening && closing && (t < opening || t >= closing)) {
        return `That time is outside the working hours (${displayTime(opening)} – ${displayTime(closing)}). Choose another time.`;
      }
      const interval = availability.data?.slotIntervalMinutes || scheduleForDate?.slotIntervalMinutes || 30;
      return `Appointments start every ${interval} minutes from ${displayTime(opening)}. Choose a time such as ${bookableTimes
        .slice(0, 2)
        .map((sl) => displayTime(sl.timeSlot))
        .join(" or ")}.`;
    }
    if (slot.lunchBreak) {
      return `That time is during the lunch break (${displayTime(scheduleForDate?.lunchStart || "")} – ${displayTime(scheduleForDate?.lunchEnd || "")}). Choose another time.`;
    }
    if (slot.status === "Full") return "That appointment time is already booked for this service. Choose another available time.";
    return "That time has already passed today. Choose a later time.";
  })();
  const dateNotice = !selectedService
    ? ""
    : serviceSchedules.length === 0 || !dateRange
      ? "This service has no published opening schedule yet, so it cannot be booked. Please check again later."
      : availability.data?.closedReason
        ? closedMessage(availability.data.closedReason, { date: selectedSlot?.date, schedule: scheduleForDate, note: availability.data.closedNote })
        : !availability.loading && availability.data && timeOptions.length > 0 && !timeOptions.some((sl) => sl.status === "Available")
          ? "Every time on that day is fully booked. Choose another date."
          : "";

  // If the chosen service is deactivated or deleted while the form is open, clear the choice
  // so the citizen picks one that can still be booked.
  useEffect(() => {
    if (selectedSlot?.serviceId && !activeServices.some((s) => s.id === selectedSlot.serviceId)) {
      setSelectedSlot((prev) => (prev ? { ...prev, ...serviceSelection("") } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const handleServiceChange = (serviceId) => {
    const srv = activeServices.find((s) => s.id === serviceId);
    setSelectedSlot((prev) => {
      // Same service chosen again: keep the date and time already picked.
      if (prev?.serviceId === serviceId) return prev;
      // Keep the date if the new service is open then; otherwise move to its next working day.
      const sch = prev?.date && srv ? scheduleOn(srv, schedules, prev.date) : null;
      const keep = Boolean(sch && prev.date >= todayIso && (sch.workingDays || []).includes(weekdayOfIso(prev.date)));
      const date = keep ? prev.date : nextWorkingDate(srv, schedules) || "";
      return {
        ...prev,
        ...serviceSelection(serviceId),
        date,
        dateDisplay: date ? displayDate(date) : "",
        time: "",
        availabilityText: "Available",
        actionValue: "Available",
      };
    });
  };

  const handleDateChange = (dateVal) => {
    if (!dateVal) {
      setSelectedSlot((prev) => ({ ...prev, date: "", dateDisplay: "" }));
      return;
    }
    const parts = dateVal.split("-").map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dateDisplay = isNaN(dateObj.getTime())
      ? dateVal
      : dateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
    setSelectedSlot((prev) => ({
      ...prev,
      date: dateVal,
      dateDisplay,
      time: "",
    }));
  };

  // Filter appointments for the signed-in citizen
  const citizenAppointments = (appointments || []).filter((apt) => {
    if (currentUser?.id && apt.citizenId && apt.citizenId !== currentUser.id) {
      return false;
    }
    return true;
  });

  // Filter appointments by search and dropdown filters
  const filteredAppointments = citizenAppointments.filter((apt) => {
    // 1. Service Filter
    if (serviceFilter !== "ALL") {
      const matchService =
        apt.serviceId === serviceFilter ||
        (apt.serviceName && services.find((s) => s.id === serviceFilter)?.name === apt.serviceName) ||
        (apt.service && services.find((s) => s.id === serviceFilter)?.name === apt.service);
      if (!matchService) return false;
    }

    // 2. Status Filter
    if (statusFilter !== "ALL") {
      const s = String(apt.status || "").toUpperCase();
      const f = String(statusFilter).toUpperCase();
      const match =
        s === f ||
        (f === "REJECT" && s === "REJECTED") ||
        (f === "REJECTED" && s === "REJECT") ||
        (f === "CANCEL" && s === "CANCELLED") ||
        (f === "CANCELLED" && s === "CANCEL");
      if (!match) return false;
    }

    // 3. Search Query Filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const service = (apt.serviceName || apt.service || "").toLowerCase();
    const dept = (apt.departmentName || apt.department || "").toLowerCase();
    const date = (apt.date || "").toLowerCase();
    const dateDisp = displayDate(apt.date).toLowerCase();
    const time = (apt.timeSlot || apt.time || "").toLowerCase();
    const notes = (apt.citizenNotes || apt.notes || apt.message || "").toLowerCase();
    const status = (DECISION_STATUSES[apt.status] || apt.status || "").toLowerCase();
    const ref = (apt.referenceNumber || "").toLowerCase();
    const reason = (apt.rejectionReason || "").toLowerCase();

    return (
      service.includes(q) ||
      dept.includes(q) ||
      date.includes(q) ||
      dateDisp.includes(q) ||
      time.includes(q) ||
      notes.includes(q) ||
      status.includes(q) ||
      ref.includes(q) ||
      reason.includes(q)
    );
  });

  const handleOpenBooking = (slot, bookable = activeServices) => {
    // A slot whose service was since deactivated opens with no service chosen.
    setSelectedSlot({ ...slot, time: "", ...serviceSelection(slot.serviceId, bookable) });
    setBookingError("");
    setCitizenNotes("");
  };

  // Always opens the modal; with no active services it shows an empty-state notice instead.
  // Fetches the catalog again so services the Admin added since this page loaded are included.
  const handleOpenNewBooking = async () => {
    try {
      await loadServices();
    } catch {
      // Server unreachable: fall back to the last list fetched.
    }
    const latestSchedules = await loadBookableSchedules().catch(() => useStore.getState().schedules || []);
    const bookable = (useStore.getState().services || []).filter(isBookable);
    // Start with the first service that has an opening schedule, on its next working day.
    const first =
      bookable.find((s) => nextWorkingDate(s, latestSchedules)) || bookable[0] || null;
    const date = first ? nextWorkingDate(first, latestSchedules) || "" : "";
    handleOpenBooking(
      {
        id: `slot-${Date.now()}`,
        date,
        dateDisplay: date ? displayDate(date) : "",
        time: "",
        serviceId: first?.id || "",
        availabilityText: "Available",
        actionValue: "Available",
      },
      bookable
    );
  };

  // Books through appointment-service, so the booking is stored in MongoDB and appears for the
  // officers of the department that provides the service.
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !canConfirm || submitting) return;
    setBookingError("");
    setSubmitting(true);
    try {
      const apt = await bookAppointment({
        // The server uses the full name and phone number of the citizen's account (from sign-up).
        departmentId: selectedSlot.departmentId,
        serviceId: selectedSlot.serviceId,
        date: selectedSlot.date,
        timeSlot: selectedSlot.time,
        citizenNotes: citizenNotes || "",
      });
      setSelectedSlot(null);
      setAvailabilityVersion((v) => v + 1); // the slot just taken
      await loadAppointments().catch(() => {});
      showSuccess(`Appointment booked successfully! Reference number: ${apt.referenceNumber}`);
    } catch (err) {
      let msg = "Could not book the appointment: the server is unreachable. Please try again.";
      if (err?.status === 401 || err?.status === 403) {
        msg = "Please sign out and sign in again with your citizen account to book.";
      } else if (err?.status === 409 && (err.code === "DAILY_CAPACITY_REACHED" || err.code === "DEPARTMENT_CAPACITY_REACHED")) {
        msg = "All appointments for that day are already booked (the daily capacity is reached). Please choose another date.";
        setAvailabilityVersion((v) => v + 1);
      } else if (err?.status === 409) {
        msg = err?.message || "This appointment time is already booked for this service. Please choose another available time.";
        setAvailabilityVersion((v) => v + 1);
      } else if (err?.status === 422 && err.details?.length) {
        msg = err.details.map((d) => d.issue).join(" ");
      } else if (err?.status === 404) {
        msg = "This service is no longer available. Please choose another one.";
      }
      setBookingError(msg);
      toast.error(msg, { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  // Appointments table columns: services, Appoitment Date, Appoitment Time, Mesage, Status, Action
  const appointmentColumns = [
    {
      id: "services",
      accessorFn: (apt) => apt.serviceName || apt.service || "",
      header: () => (
        <span title="services">
          Services
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            services
          </span>
        </span>
      ),
      sortFn: "text",
      cell: ({ row }) => {
        const apt = row.original;
        return (
          <div>
            <div className="font-semibold text-slate-900">{apt.serviceName || apt.service || "Municipal Service"}</div>
            {apt.departmentName && (
              <div className="text-[11px] text-slate-500 mt-0.5">{apt.departmentName}</div>
            )}
            {apt.referenceNumber && (
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {apt.referenceNumber}</div>
            )}
          </div>
        );
      },
    },
    {
      id: "appointmentDate",
      accessorFn: (apt) => apt.date || "",
      header: () => (
        <span title="Appoitment Date">
          Appointment Date
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Appoitment Date
          </span>
        </span>
      ),
      sortFn: "text",
      cell: ({ row }) => {
        const apt = row.original;
        return (
          <div className="font-bold text-slate-900">
            {apt.date ? displayDate(apt.date) : "—"}
          </div>
        );
      },
    },
    {
      id: "appointmentTime",
      accessorFn: (apt) => apt.timeSlot || apt.time || "",
      header: () => (
        <span title="Appoitment Time">
          Appointment Time
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Appoitment Time
          </span>
        </span>
      ),
      sortFn: "text",
      cell: ({ row }) => {
        const apt = row.original;
        const timeVal = apt.timeSlot || apt.time;
        return (
          <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600 inline shrink-0" />
            <span>{timeVal ? displayTime(timeVal) : "—"}</span>
          </div>
        );
      },
    },
    {
      id: "message",
      accessorFn: (apt) => apt.citizenNotes || apt.notes || apt.message || "",
      header: () => (
        <span title="Mesage">
          Message
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Mesage
          </span>
        </span>
      ),
      sortFn: "text",
      cell: ({ row }) => {
        const notes = row.original.citizenNotes || row.original.notes || row.original.message;
        return notes ? (
          <p
            className="max-w-[240px] whitespace-pre-line break-words line-clamp-2 text-xs text-slate-700 leading-snug"
            title={notes}
          >
            {notes}
          </p>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      },
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const apt = row.original;
        const cfg = APPOINTMENT_STATUS_CONFIG[apt.status] || {
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          dot: "bg-slate-400",
        };
        const statusLabel = DECISION_STATUSES[apt.status] || apt.status;
        return (
          <div className="space-y-1.5">
            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.bg}`}
                title={`${apt.referenceNumber || ""} · ${displayDate(apt.date)} ${displayTime(apt.timeSlot)}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                {statusLabel}
              </span>
            </div>
            {apt.status === "REJECTED" && (
              <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs text-left max-w-[280px]">
                <span className="font-bold text-[11px] block text-rose-900 mb-0.5">
                  Reason for Rejection:
                </span>
                <p className="text-[11px] leading-relaxed break-words whitespace-pre-line text-rose-700">
                  {apt.rejectionReason || "Documentation incomplete or slot quota exceeded."}
                </p>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "action",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => {
        const apt = row.original;
        const isCancellable = CANCELLABLE.includes(apt.status);
        if (!isCancellable) {
          return <span className="text-xs text-slate-400">—</span>;
        }
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelBooking(apt);
            }}
            disabled={cancellingId === apt.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait transition-colors"
            title={`Cancel appointment ${apt.referenceNumber || ""}`}
          >
            <X className="w-3 h-3" />
            <span>{cancellingId === apt.id ? "Cancelling…" : "Cancel"}</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Centered Page Header with Action Button at Right Edge */}
      <div
        className="relative flex items-center justify-center w-full min-h-[48px]"
        style={{ position: "relative", minHeight: "48px", width: "100%" }}
      >
        <div className="w-full text-center" style={{ textAlign: "center", width: "100%" }}>
          <h2 className="text-xl font-bold text-slate-900" style={{ textAlign: "center" }}>
            Book Appointment
          </h2>
          <p className="text-xs text-slate-500 mt-0.5" style={{ textAlign: "center" }}>
            Browse available municipal service slots and reserve your in-person office schedule.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenNewBooking}
          className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-all cursor-pointer shrink-0"
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          <Calendar className="w-4 h-4 text-amber-300" />
          <span>Book Appointment</span>
        </button>
      </div>

      {serverSessionInvalid && (
        <div role="alert" className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Your sign-in is no longer valid, so your bookings cannot be shown, booked or cancelled.
              Please sign out and sign in again. If your account was created before today&apos;s update,
              sign up again with your email.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentUser(null);
              window.location.assign("/login");
            }}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
          >
            Sign out
          </button>
        </div>
      )}

      {cancelError && (
        <div role="alert" className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{cancelError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCancelError("")}
            className="text-red-700 hover:text-red-900 cursor-pointer p-0.5"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}


      {/* Search Box & Dropdown Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input Box */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service, date, time, status, reference..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Services Filter */}
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="ALL">All Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancel</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Reject</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {(search || serviceFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setServiceFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer font-medium"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Appointments Table with Header Text: services, Appoitment Date, Appoitment Time, Mesage, Status, Action */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={filteredAppointments}
          columns={appointmentColumns}
          getRowId={(apt) => apt.id}
          itemLabel="appointments"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400 py-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Calendar className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">No appointments booked yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click &quot;Book Appointment&quot; above to schedule your in-person office visit.
                </p>
              </div>
            </div>
          }
        />
      </div>

      {/* Booking Confirmation Modal */}
      {selectedSlot && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelectedSlot(null)}>
          <div className="modal-panel modal-panel--form modal-panel--wide" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="booking-modal-title" className="font-extrabold text-slate-900 text-base">Book Municipal Appointment</h3>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      {selectedSlot.availabilityText || "Slots Available"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a service and slot, then confirm your visit details
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedSlot(null)} className="modal-close" aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="mt-6 space-y-6">
              {/* Service & Appointment Slot Selection */}
              <div className="bg-slate-50/90 p-5 rounded-2xl border border-slate-200 space-y-5">
                {/* Service Dropdown (services from Admin > Services Management) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Service *
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedSlot.serviceId}
                      onChange={(e) => handleServiceChange(e.target.value)}
                      onFocus={() => {
                        // Live updates keep this list current; without a live connection,
                        // fetch the latest catalog when the citizen opens the dropdown.
                        if (!isLive()) loadServices().catch(() => {});
                      }}
                      required
                      disabled={allServices.length === 0}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>
                        {allServices.length === 0
                          ? "No services available"
                          : "Select a service"}
                      </option>
                      {allServices.map((s) => (
                        <option key={s.id} value={s.id} disabled={!isBookable(s)}>
                          {isBookable(s) ? s.name : `${s.name} (currently unavailable)`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Appointment Date and Appointment Time, each with its own label */}
                <div className="pt-1">
                  <div className="space-y-4">
                    {/* Date Selection: only dates inside the service's schedule */}
                    <div>
                      <label htmlFor="citizen-appointment-date" className="block text-xs font-bold text-slate-700 mb-2">
                        Appointment Date *
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        required
                        min={dateRange?.min || todayIso}
                        max={dateRange?.max || undefined}
                        disabled={!selectedService || !dateRange}
                        value={selectedSlot.date || ""}
                        onChange={(e) => handleDateChange(e.target.value)}
                        id="citizen-appointment-date"
                        aria-label="Appointment date"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                      </div>
                    </div>

                    {/* Time: a native time input, the same control as Admin > Working Hours > Lunch Break */}
                    <div>
                      <label htmlFor="citizen-appointment-time" className="block text-xs font-bold text-slate-700 mb-2">
                        Appointment Time *
                      </label>
                      <div className="relative">
                      <input
                        type="time"
                        required
                        value={slotToClock(selectedSlot.time)}
                        onChange={(e) => setSelectedSlot((prev) => ({ ...prev, time: clockToSlot(e.target.value) }))}
                        disabled={timeInputDisabled}
                        id="citizen-appointment-time"
                        aria-label="Appointment time"
                        aria-invalid={Boolean(timeNotice)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                      </div>
                    </div>

                    {/* Available / Booked Slot Selection Pills */}
                    {daySlots.length > 0 && !timeInputDisabled && (
                      <div>
                        <span className="block text-[11px] font-bold text-slate-600 mb-1.5">
                          Time Slots for This Day:
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-white shadow-2xs">
                          {daySlots
                            .filter((sl) => !sl.lunchBreak)
                            .map((sl) => {
                              const isAvail = sl.status === "Available";
                              const isSelected = selectedSlot.time === sl.timeSlot;
                              return (
                                <button
                                  key={sl.timeSlot}
                                  type="button"
                                  disabled={!isAvail}
                                  onClick={() => setSelectedSlot((prev) => ({ ...prev, time: sl.timeSlot }))}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    !isAvail
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60"
                                      : isSelected
                                      ? "bg-emerald-600 text-white shadow-xs border border-emerald-600"
                                      : "bg-slate-50 hover:bg-emerald-50 text-slate-700 border border-slate-200 hover:border-emerald-300 cursor-pointer"
                                  }`}
                                  title={
                                    !isAvail
                                      ? `${displayTime(sl.timeSlot)} (Already booked)`
                                      : `${displayTime(sl.timeSlot)} (Available)`
                                  }
                                >
                                  {displayTime(sl.timeSlot)}
                                  {!isAvail && (
                                    <span className="ml-1 text-[10px] text-slate-400 font-normal">
                                      (Booked)
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {timeNotice && (
                    <p role="alert" className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span>{timeNotice}</span>
                    </p>
                  )}

                  {/* What the Admin's schedule allows for this service */}
                  {scheduleForDate && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Open {formatWorkingDays(scheduleForDate.workingDays)}, {displayTime(scheduleForDate.openingTime)} –{" "}
                      {displayTime(scheduleForDate.closingTime)}
                      {scheduleForDate.lunchStart && scheduleForDate.lunchEnd
                        ? ` · lunch break ${displayTime(scheduleForDate.lunchStart)} – ${displayTime(scheduleForDate.lunchEnd)} (no appointments)`
                        : ""}
                      {dateRange?.max ? ` · bookable until ${displayDate(dateRange.max)}` : ""}
                      {availability.data?.dailyCapacity ? (
                        <>
                          {" · "}
                          <span className={placesLeft(availability.data) > 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                            {placesLeft(availability.data) === 0
                              ? "Fully booked"
                              : `${placesLeft(availability.data)} ${placesLeft(availability.data) === 1 ? "appointment" : "appointments"} available on this day`}
                          </span>
                        </>
                      ) : null}
                    </p>
                  )}
                  {dateNotice && (
                    <p role="alert" className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span>{dateNotice}</span>
                    </p>
                  )}
                  {selectedService && dateRange && bookableDates.serviceId === selectedSlot?.serviceId && bookableDates.dates.length === 0 && (
                    <p className="text-[11px] text-slate-500 mt-2">No dates are open for booking in the next 60 days.</p>
                  )}
                </div>
              </div>

              {/* Message to the office (optional) */}
              <div className="space-y-4 pt-2 border-t border-slate-100">

                {/* Message (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Message (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={citizenNotes}
                    onChange={(e) => setCitizenNotes(e.target.value)}
                    placeholder="Write your message or any notes regarding your visit..."
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none bg-white shadow-2xs"
                  />
                </div>
              </div>

              {bookingError && (
                <p role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{bookingError}</span>
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="modal-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canConfirm || submitting}
                  className="modal-btn modal-btn--success"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{submitting ? "Booking…" : "Confirm Booking"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

