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
    loadBookableSchedules,
  } = useStore();

  // Services come from the server catalog managed in Admin > Services Management. The list is
  // fetched on open and again whenever the server announces a catalog change (WebSocket), so a
  // service the Admin adds shows up here without refreshing the page.
  useEffect(() => {
    const refresh = () => {
      loadServices().catch(() => {
        // Server unreachable: keep the last list; the dropdown shows its notice if empty.
      });
      // Opening schedules from Admin > Schedule Management (working days, hours, capacity, dates).
      loadBookableSchedules().catch(() => {});
      setAvailabilityVersion((v) => v + 1); // re-read slot availability as well
    };
    refresh();
    const offChange = subscribe("catalog.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh); // changes made while disconnected
    return () => {
      offChange();
      offReconnect();
    };
  }, [loadServices, loadBookableSchedules]);

  // Overview table starts clean and empty: all pre-populated real and mock slot data removed.
  const [slots] = useState([]);

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
  };
  // Only while Pending: once a department officer approves the booking it can't be cancelled.
  const CANCELLABLE = ["PENDING"];
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState("");

  const handleCancelBooking = async (booking) => {
    const when = `${displayDate(booking.date)} at ${displayTime(booking.timeSlot)}`;
    if (!window.confirm(`Cancel your ${booking.serviceName} appointment on ${when}?\n\nReference: ${booking.referenceNumber}`)) {
      return;
    }
    setCancelError("");
    setCancellingId(booking.id);
    const ok = await updateAppointmentStatus(booking.id, "CANCELLED");
    setCancellingId(null);
    if (ok) {
      setAvailabilityVersion((v) => v + 1); // the freed time is bookable again
      showSuccess(`Appointment ${booking.referenceNumber} has been cancelled.`);
    } else {
      setCancelError(
        `Could not cancel ${booking.referenceNumber}: ${
          useStore.getState().appointmentError?.message || "please try again."
        }`
      );
    }
  };
  const bookingStatusFor = (serviceId) =>
    (appointments || [])
      .filter(
        (a) =>
          a.serviceId === serviceId &&
          a.citizenId === currentUser?.id &&
          DECISION_STATUSES[a.status]
      )
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");

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
      return `Appointments start every 30 minutes from ${displayTime(opening)}. Choose a time such as ${bookableTimes
        .slice(0, 2)
        .map((sl) => displayTime(sl.timeSlot))
        .join(" or ")}.`;
    }
    if (slot.lunchBreak) {
      return `That time is during the lunch break (${displayTime(scheduleForDate?.lunchStart || "")} – ${displayTime(scheduleForDate?.lunchEnd || "")}). Choose another time.`;
    }
    if (slot.status === "Full") return "That time is fully booked. Choose another time.";
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

  // Filter slots
  const filteredSlots = slots.filter((slot) => {
    const matchesSearch =
      slot.service.toLowerCase().includes(search.toLowerCase()) ||
      slot.department.toLowerCase().includes(search.toLowerCase()) ||
      slot.time.toLowerCase().includes(search.toLowerCase()) ||
      slot.dateDisplay.toLowerCase().includes(search.toLowerCase());

    const matchesDept = deptFilter === "ALL" || slot.departmentId === deptFilter;
    const matchesAction = actionFilter === "ALL" || slot.actionValue === actionFilter;

    return matchesSearch && matchesDept && matchesAction;
  });

  // Calculate summaries
  const availableCount = slots.filter((s) => s.actionValue === "Available").length;
  const fullCount = slots.filter((s) => s.actionValue === "Full").length;
  const unavailableCount = slots.filter((s) => s.actionValue === "Unavailable").length;

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
      showSuccess(`Appointment booked successfully! Reference number: ${apt.referenceNumber}`);
    } catch (err) {
      let msg = "Could not book the appointment: the server is unreachable. Please try again.";
      if (err?.status === 401 || err?.status === 403) {
        msg = "Please sign out and sign in again with your citizen account to book.";
      } else if (err?.status === 409 && (err.code === "DAILY_CAPACITY_REACHED" || err.code === "DEPARTMENT_CAPACITY_REACHED")) {
        msg = "All appointments for that day are already booked (the daily capacity is reached). Please choose another date.";
        setAvailabilityVersion((v) => v + 1);
      } else if (err?.status === 409) {
        msg = "That time was just taken. Please choose another time.";
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

  // Slot table columns (TanStack Table via components/ui/DataTable).
  const slotColumns = [
    {
      id: "date",
      accessorFn: (slot) => `${slot.date || ""} ${slot.time || ""}`,
      header: "Appointment Date&Time",
      cell: ({ row }) => {
        const slot = row.original;
        return (
          <>
            <div className="font-bold text-slate-900">{slot.dateDisplay}</div>
            <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-blue-600 inline" />
              {slot.time}
            </div>
            {slot.workingDays && (
              <div className="text-[10px] text-slate-500 mt-0.5">Open {slot.workingDays}</div>
            )}
          </>
        );
      },
    },
    {
      id: "department",
      accessorFn: (slot) => slot.department || "",
      header: "Department",
      sortFn: "text",
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.original.department}</span>,
    },
    {
      id: "service",
      accessorFn: (slot) => slot.service || "",
      header: "Service",
      sortFn: "text",
      cell: ({ row }) => <div className="font-semibold text-slate-900">{row.original.service}</div>,
    },
    {
      id: "availability",
      accessorKey: "actionValue",
      header: "Availability",
      cell: ({ row }) => {
        const slot = row.original;
        if (slot.actionValue === "Available") {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Available
              {slot.availabilityText?.endsWith(" left") && (
                <span className="font-normal text-emerald-600">· {slot.availabilityText}</span>
              )}
            </span>
          );
        }
        if (slot.actionValue === "Full") {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Full
            </span>
          );
        }
        if (slot.actionValue === "Unavailable") {
          return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              Unavailable
            </span>
          );
        }
        return null;
      },
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) => {
        const booking = bookingStatusFor(row.original.serviceId);
        if (!booking) {
          return <span className="text-[11px] text-slate-400">Not booked</span>;
        }
        const cfg = APPOINTMENT_STATUS_CONFIG[booking.status];
        return (
          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.bg}`}
              title={`${booking.referenceNumber} · ${displayDate(booking.date)} ${displayTime(booking.timeSlot)}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
              {DECISION_STATUSES[booking.status]}
            </span>
            {booking.status === "REJECTED" && booking.rejectionReason && (
              <span
                className="text-[10px] text-rose-600 block mt-0.5 truncate max-w-[160px]"
                title={booking.rejectionReason}
              >
                Reason: {booking.rejectionReason}
              </span>
            )}
            {CANCELLABLE.includes(booking.status) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelBooking(booking);
                }}
                disabled={cancellingId === booking.id}
                className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                title={`Cancel appointment ${booking.referenceNumber}`}
              >
                <X className="w-3 h-3" />
                {cancellingId === booking.id ? "Cancelling…" : "Cancel"}
              </button>
            )}
          </div>
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

      {/* Summary Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Available
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{availableCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Full
          </span>
          <p className="text-2xl font-bold text-rose-700 mt-1">{fullCount}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Unavailable
          </span>
          <p className="text-2xl font-bold text-slate-600 mt-1">{unavailableCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service, department, date..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 shadow-xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Availability Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Availability</option>
              <option value="Available">Available</option>
              <option value="Full">Full</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Slots Table with Explicit User Column Headers */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={filteredSlots}
          columns={slotColumns}
          getRowId={(slot) => slot.id}
          itemLabel="services"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Calendar className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">No appointment slots available yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Services appear here once the Woreda administration publishes their opening schedule.
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
                {/* Public Service Dropdown (services from Admin > Services Management) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Public Service *
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
                          ? "No public services available"
                          : "Select a public service"}
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

