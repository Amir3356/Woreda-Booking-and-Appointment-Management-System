import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { useEscapeKey } from "@/hooks";
import { subscribe } from "@/api/realtime";
import { scheduleApi } from "@/api";
import {
  APPOINTMENT_STATUS_CONFIG,
  bookableRange,
  closedMessage,
  displayDate,
  displayTime,
  localIsoDate,
  addDays,
  nextWorkingDate,
  scheduleOn,
  schedulesForService,
  exceptionOnDate,
  isDayClosedByException,
} from "@/utils";
import { CountdownChip, DataTable } from "@/components/ui";
import { appointmentStartMs } from "@/utils/countdown";
import {
  Calendar,
  Clock,
  FileText,
  Search,
  Filter,
  RotateCcw,
  CheckCircle,
  Check,
  X,
  AlertCircle,
  Users,
  Info,
  Building2,
} from "lucide-react";

// Calendar exceptions (Admin > Schedule Management > Calendar Exceptions) close dates for booking.
// Every notice about such a closed date stays on screen for 6 seconds.
const EXCEPTION_TOAST_MS = 6000;

/**
 * The exception that closes date for service, or null when the date is open. Same precedence as
 * the server (utils/calendar.js resolveDay): a Blocked date is always closed, an exceptional
 * working day re-opens a holiday or non-working day.
 */
function blockingException(list, service, date) {
  if (!date || !isDayClosedByException(date, service, list || [])) return null;
  const onDay = (list || []).filter((e) => exceptionOnDate(e, service, date) && e.type !== "WORKING_DAY");
  return onDay.find((e) => e.type === "BLOCKED") || onDay[0] || null;
}

/** "Ethiopian Christmas (Public holiday)" style name of an exception. */
function exceptionName(e) {
  if (e.title && e.description) return `${e.title} (${e.description})`;
  return e.title || e.description || "Calendar exception";
}

/** Identifies one notice: this date closed by this exception. */
const closureKey = (date, e) => `${date}|${e.id || `${e.startDate}-${e.endDate}-${e.type}`}`;

/** The toast text for a date closed by an exception. */
function closedDateMessage(date, e) {
  return `Booking is unavailable on ${displayDate(date)}: ${exceptionName(e)}. The office is closed ${exceptionRange(e)}. Please choose another date.`;
}

/** "on Wed, Jan 7, 2027" or "from … to …". */
function exceptionRange(e) {
  return e.endDate && e.endDate !== e.startDate
    ? `from ${displayDate(e.startDate)} to ${displayDate(e.endDate)}`
    : `on ${displayDate(e.startDate)}`;
}

function isoToDmy(iso) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function dmyToIso(dmy) {
  if (!dmy || typeof dmy !== "string") return null;
  const parts = dmy.split("/");
  if (parts.length !== 3) return null;
  const [dayStr, monthStr, yearStr] = parts;
  if (dayStr.length !== 2 || monthStr.length !== 2 || yearStr.length !== 4) return null;
  const d = Number(dayStr);
  const m = Number(monthStr);
  const y = Number(yearStr);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return `${yearStr}-${monthStr}-${dayStr}`;
}

function parseTimeToMinutes(val) {
  if (!val) return 0;
  if (typeof val === "string" && val.includes("T")) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(String(val).trim());
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const meridiem = (m[3] || "").toUpperCase();
  if (meridiem === "PM" && h < 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function CitizenDateDmyInput({
  id = "citizen-appointment-date",
  required = false,
  min,
  max,
  disabled = false,
  value,
  onChange,
  ariaLabel = "Appointment date",
}) {
  const [text, setText] = useState(() => isoToDmy(value));
  const pickerRef = useRef(null);

  useEffect(() => {
    setText(isoToDmy(value));
  }, [value]);

  const handleNativeChange = (e) => {
    const iso = e.target.value;
    if (iso) {
      setText(isoToDmy(iso));
      onChange(iso);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    let cleaned = val.replace(/[^\d/]/g, "").slice(0, 10);

    // Auto-insert slash after 2 and 5 digits when typing forward
    if (cleaned.length === 2 && !cleaned.includes("/") && val.length > text.length) {
      cleaned = `${cleaned}/`;
    } else if (
      cleaned.length === 5 &&
      (cleaned.match(/\//g) || []).length === 1 &&
      val.length > text.length
    ) {
      cleaned = `${cleaned}/`;
    }

    setText(cleaned);

    const iso = dmyToIso(cleaned);
    if (iso) {
      onChange(iso);
    }
  };

  const handleBlur = () => {
    const iso = dmyToIso(text);
    if (iso) {
      onChange(iso);
      setText(isoToDmy(iso));
    } else if (value) {
      setText(isoToDmy(value));
    } else {
      setText("");
    }
  };

  const openPicker = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (disabled) return;
    try {
      if (pickerRef.current?.showPicker) {
        pickerRef.current.showPicker();
      } else {
        pickerRef.current?.focus();
      }
    } catch {
      pickerRef.current?.focus();
    }
  };

  return (
    <div className="relative flex items-center">
      <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
      <input
        id={id}
        type="text"
        required={required}
        disabled={disabled}
        value={text}
        placeholder="DD/MM/YYYY"
        onChange={handleTextChange}
        onBlur={handleBlur}
        aria-label={ariaLabel}
        maxLength={10}
        className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b2545]/20 focus:border-[#0b2545] cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed tabular-nums tracking-wide"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        title="Open calendar picker"
        aria-label="Open calendar picker"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer disabled:pointer-events-none disabled:text-slate-300"
      >
        <Calendar className="w-4 h-4" aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        min={min}
        max={max}
        disabled={disabled}
        value={value || ""}
        onChange={handleNativeChange}
        tabIndex={-1}
        aria-hidden="true"
        className="native-date-picker-hidden"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function CitizenBookAppointmentPage() {
  // Bumped on every catalog/schedule change so open availability is fetched again.
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  // Today's active bookings count per service: { [serviceId]: number }
  const [todayBookedCounts, setTodayBookedCounts] = useState({});

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
    exceptions = [],
    loadServices,
    loadDepartments,
    loadBookableSchedules,
    loadActiveExceptions,
    loadAppointments,
  } = useStore();

  // Services and bookable schedules come from the server catalog and schedule management.
  // The citizen's booked appointments and catalog are refreshed on open and on WebSocket announcements.
  useEffect(() => {
    const refresh = () => {
      loadServices().catch(() => {});
      loadDepartments?.().catch(() => {});
      loadBookableSchedules().catch(() => {});
      loadActiveExceptions?.().catch(() => {});
      loadAppointments().catch(() => {});
      scheduleApi
        .dailyServiceStatus({ date: localIsoDate() })
        .then(({ data }) => setTodayBookedCounts(data || {}))
        .catch(() => {});
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
  }, [loadServices, loadDepartments, loadBookableSchedules, loadActiveExceptions, loadAppointments]);

  /** Bookings still possible on a day: free places in its times, capped by the daily capacity. */
  const _placesLeft = (data) => {
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
      showSuccess("Appointment has been cancelled.");
      await loadAppointments().catch(() => {});
    } else {
      setCancelError(
        `Could not cancel the appointment: ${
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
  const showSuccess = (msg) => toast.success(msg, { duration: 5000 });

  // Modal department & service dropdowns: active departments and services from Admin Management.
  // Citizens select Department -> Public Service to inspect that service's availability.
  const allServices = services || [];
  const isBookable = (s) => s.isActive !== false;
  const activeServices = allServices.filter(isBookable);
  const activeDepartments = (departments || []).filter((d) => d.isActive !== false);

  const [selectedPublicServiceDept, setSelectedPublicServiceDept] = useState("ALL");
  const displayedPublicServices = useMemo(() => {
    if (selectedPublicServiceDept === "ALL") return activeServices;
    return activeServices.filter((s) => s.departmentId === selectedPublicServiceDept);
  }, [activeServices, selectedPublicServiceDept]);

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

  // Resolves the service's Daily Appointment Capacity configured by the Admin in Schedule Management > Working Hours
  const getServiceDailyCapacity = (service) => {
    if (!service) return 20;
    const applicable = schedulesForService(service, schedules || []);
    for (const sch of applicable) {
      const caps = Array.isArray(sch.serviceCapacities) ? sch.serviceCapacities : [];
      const own = caps.find((c) => c.serviceId === service.id);
      if (own && own.dailyCapacity !== null && own.dailyCapacity !== undefined && Number(own.dailyCapacity) >= 0) {
        return Number(own.dailyCapacity);
      }
      if (sch.dailyCapacity !== null && sch.dailyCapacity !== undefined && Number(sch.dailyCapacity) >= 0) {
        return Number(sch.dailyCapacity);
      }
    }
    for (const sch of schedules || []) {
      const caps = Array.isArray(sch.serviceCapacities) ? sch.serviceCapacities : [];
      const own = caps.find((c) => c.serviceId === service.id);
      if (own && own.dailyCapacity !== null && own.dailyCapacity !== undefined && Number(own.dailyCapacity) >= 0) {
        return Number(own.dailyCapacity);
      }
      if (sch.dailyCapacity !== null && sch.dailyCapacity !== undefined && Number(sch.dailyCapacity) >= 0) {
        return Number(sch.dailyCapacity);
      }
    }
    return service.dailyQuota ?? 20;
  };

  const todayIso = localIsoDate();
  const selectedService = allServices.find((s) => s.id === selectedSlot?.serviceId) || null;

  // Toast (6 s) whenever the date in the booking form is closed by a calendar exception: when the
  // citizen picks such a date, or when the administrator closes it while the form is open (the
  // exception list updates live). Shown once per date and exception.
  const notifiedClosureRef = useRef("");
  useEffect(() => {
    if (!selectedSlot?.date || !selectedService) {
      notifiedClosureRef.current = "";
      return;
    }
    const blocked = blockingException(exceptions, selectedService, selectedSlot.date);
    if (!blocked) {
      notifiedClosureRef.current = ""; // picking the closed date again later notifies again
      return;
    }
    const key = closureKey(selectedSlot.date, blocked);
    if (notifiedClosureRef.current === key) return;
    notifiedClosureRef.current = key;
    toast.error(closedDateMessage(selectedSlot.date, blocked), { duration: EXCEPTION_TOAST_MS });
  }, [exceptions, selectedSlot?.date, selectedService]);
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
          const next = nextWorkingDate(
            srv,
            useStore.getState().schedules || [],
            useStore.getState().exceptions || [],
            addDays(date, 1)
          );
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

  const formatQueuePosition = (pos) => {
    if (pos === 1) return "1st";
    if (pos === 2) return "2nd";
    if (pos === 3) return "3rd";
    const mod10 = pos % 10;
    const mod100 = pos % 100;
    if (mod10 === 1 && mod100 !== 11) return `${pos}st`;
    if (mod10 === 2 && mod100 !== 12) return `${pos}nd`;
    if (mod10 === 3 && mod100 !== 13) return `${pos}rd`;
    return `${pos}th`;
  };

  /**
   * Calculates how many citizens are already scheduled to be served before the target appointment time
   * for this serving desk / public service queue group on the selected date. Priority rule: Appointment Time -> Check-in Time (FIFO).
   * Citizens with earlier scheduled appointments for the same service desk are served first.
   */
  const getPeopleAheadCount = (targetTime) => {
    if (!targetTime || !availability.data) return 0;
    const targetMin = parseTimeToMinutes(targetTime);
    if (targetMin <= 0) return 0;

    // Service-specific slot counts (confirmed appointments for this serving desk before target time)
    const servCounts = availability.data.serviceSlotCounts;
    const deptCounts = availability.data.departmentSlotCounts;
    const slotCounts =
      servCounts && typeof servCounts === "object" && Object.keys(servCounts).length > 0
        ? servCounts
        : deptCounts;

    if (slotCounts && typeof slotCounts === "object" && Object.keys(slotCounts).length > 0) {
      let count = 0;
      for (const [timeKey, num] of Object.entries(slotCounts)) {
        if (parseTimeToMinutes(timeKey) < targetMin) {
          count += Number(num) || 0;
        }
      }
      return count;
    }

    // Fallback to slots list
    const slots = availability.data.slots || [];
    return slots
      .filter((sl) => parseTimeToMinutes(sl.timeSlot) < targetMin)
      .reduce((sum, sl) => sum + (Number(sl.bookedCount) || 0), 0);
  };

  const selectedPeopleAhead = selectedSlot?.time ? getPeopleAheadCount(selectedSlot.time) : 0;
  const sameServiceBookedCount = availability.data?.bookedForDay ?? 0;
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

    // A date closed by a calendar exception is announced by the effect above.
    setSelectedSlot((prev) => ({
      ...prev,
      date: dateVal,
      dateDisplay,
      time: "",
    }));
  };

  // Filter appointments strictly for the signed-in citizen (Appointment sidebar)
  const citizenAppointments = (appointments || []).filter((apt) => {
    if (!currentUser) return false;
    if (currentUser.id && apt.citizenId && apt.citizenId !== currentUser.id) {
      return false;
    }
    const aptPhone = (apt.citizenPhone || apt.phone || "").replace(/\D/g, "");
    const userPhone = (currentUser.phone || "").replace(/\D/g, "");
    if (aptPhone && userPhone && aptPhone !== userPhone && !aptPhone.endsWith(userPhone) && !userPhone.endsWith(aptPhone)) {
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
    const requestedAt = (apt.createdAt || "").toLowerCase();

    return (
      service.includes(q) ||
      dept.includes(q) ||
      date.includes(q) ||
      dateDisp.includes(q) ||
      time.includes(q) ||
      notes.includes(q) ||
      status.includes(q) ||
      ref.includes(q) ||
      reason.includes(q) ||
      requestedAt.includes(q)
    );
  });

  const handleOpenBooking = (slot, bookable = activeServices) => {
    // A slot whose service was since deactivated opens with no service chosen.
    const srv = bookable.find((s) => s.id === slot.serviceId);
    const deptId = slot.departmentId || srv?.departmentId || (activeDepartments[0]?.id || "");
    const dept = departments.find((d) => d.id === deptId);
    setSelectedSlot({
      ...slot,
      departmentId: deptId,
      department: dept?.name || "Municipal Department",
      time: "",
      ...serviceSelection(slot.serviceId, bookable),
    });
    setBookingError("");
    setCitizenNotes("");
  };

  // Directly opens the booking modal for a chosen public service card in the dashboard
  const openingBookingRef = useRef(false);
  const handleSelectServiceForBooking = async (service) => {
    if (openingBookingRef.current) return; // a second tap while the check below is running
    openingBookingRef.current = true;
    try {
      await selectServiceForBooking(service);
    } finally {
      openingBookingRef.current = false;
    }
  };

  const selectServiceForBooking = async (service) => {
    const latestSchedules = schedules || [];
    const applicableSchedules = schedulesForService(service, latestSchedules);

    // If working hours / calendar schedule is empty or not configured by the admin yet
    if (!latestSchedules.length || !applicableSchedules.length) {
      toast.error(
        `Working hours and calendar schedule have not been configured by the administration yet. Appointments for "${service.name}" are currently unavailable.`,
        { duration: 5000 }
      );
      return;
    }

    const dailyCap = getServiceDailyCapacity(service);
    const bookedToday = todayBookedCounts[service.id] ?? 0;
    if (dailyCap === 0) {
      toast.error(
        `Appointments for "${service.name}" are currently unavailable (Daily Appointment Capacity is set to 0 by administration).`,
        { duration: 5000 }
      );
      return;
    }
    if (bookedToday >= dailyCap) {
      toast.error(
        `Appointments for "${service.name}" are currently full today (${bookedToday}/${dailyCap} appointments booked). Please choose another date or service.`,
        { duration: 5000 }
      );
      return;
    }

    // Latest calendar exceptions from the server (the administrator may have just added one);
    // the list loaded with the page is the fallback when the server cannot be reached.
    let activeExcList = useStore.getState().exceptions || exceptions || [];
    try {
      const { data } = await scheduleApi.activeExceptions();
      if (Array.isArray(data)) {
        activeExcList = data;
        useStore.setState({ exceptions: data });
      }
    } catch {
      // keep the cached list; the server checks the date again when booking
    }

    // Today is a calendar exception for this service: only the notice, the booking form stays closed.
    const closedToday = blockingException(activeExcList, service, todayIso);
    if (closedToday) {
      const until = closedToday.endDate || closedToday.startDate;
      toast.error(
        `Booking is unavailable today (${displayDate(todayIso)}): ${exceptionName(closedToday)}. The office is closed ${exceptionRange(closedToday)}.${until > todayIso ? ` Please book again after ${displayDate(until)}.` : ""}`,
        { duration: EXCEPTION_TOAST_MS }
      );
      return;
    }

    const dept = departments.find((d) => d.id === service.departmentId);
    const date = nextWorkingDate(service, latestSchedules, activeExcList) || "";
    if (!date) {
      toast.error(
        `Working hours and calendar schedule have not been configured by the administration yet. Appointments for "${service.name}" are currently unavailable.`,
        { duration: 5000 }
      );
      return;
    }

    handleOpenBooking(
      {
        id: `slot-${Date.now()}`,
        date,
        dateDisplay: date ? displayDate(date) : "",
        time: "",
        serviceId: service.id,
        departmentId: service.departmentId || dept?.id || "",
        department: dept?.name || "Municipal Department",
        availabilityText: "Available",
        actionValue: "Available",
      },
      activeServices
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

    // Check the date against the latest calendar exceptions from the server, not only the list
    // loaded with the page: the administrator may have closed the date since.
    let exceptionList = useStore.getState().exceptions || exceptions || [];
    try {
      const { data } = await scheduleApi.activeExceptions();
      if (Array.isArray(data)) exceptionList = data;
    } catch {
      // Offline or server error: keep the cached list; the server checks again when booking.
    }
    const blocked = blockingException(exceptionList, selectedService, selectedSlot.date);
    if (blocked) notifiedClosureRef.current = closureKey(selectedSlot.date, blocked);
    useStore.setState({ exceptions: exceptionList });
    if (blocked) {
      const msg = closedDateMessage(selectedSlot.date, blocked);
      setBookingError(msg);
      toast.error(msg, { duration: EXCEPTION_TOAST_MS });
      setAvailabilityVersion((v) => v + 1);
      setSubmitting(false);
      return;
    }

    try {
      await bookAppointment({
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
      showSuccess("Appointment booked successfully!");
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
      } else if (err?.status === 422 && err.details?.some((d) => d.field === "date")) {
        // The server refused the date: closed by a calendar exception or outside the working days.
        msg = `Booking is unavailable on ${displayDate(selectedSlot.date)}. ${err.details.find((d) => d.field === "date").issue}`;
        setBookingError(msg);
        toast.error(msg, { duration: EXCEPTION_TOAST_MS });
        useStore.getState().loadActiveExceptions?.().catch(() => {});
        setAvailabilityVersion((v) => v + 1);
        return;
      } else if (err?.status === 422 && err.details?.length) {
        msg = err.details.map((d) => d.issue).join(" ");
      } else if (err?.status === 404) {
        msg = "This service is no longer available. Please choose another one.";
      }
      setBookingError(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  // Appointments table columns: services, Appoitment Date, Appoitment Time, Requested at, Mesage, Status, Action
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
        // Live countdown while the appointment is still ahead: pending approval, approved or checked in.
        const counting = ["PENDING", "APPROVED", "CHECKED_IN"].includes(apt.status) && (apt.date || "").split("T")[0] >= todayIso;
        return (
          <div>
            <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600 inline shrink-0" />
              <span>{timeVal ? displayTime(timeVal) : "—"}</span>
            </div>
            {counting && (
              <CountdownChip
                startMs={appointmentStartMs((apt.date || "").split("T")[0], timeVal)}
                stage={apt.status === "PENDING" ? "pending" : apt.status === "APPROVED" ? "approved" : "checkedIn"}
              />
            )}
          </div>
        );
      },
    },
    {
      id: "requestedAt",
      accessorFn: (apt) => apt.createdAt || "",
      header: () => (
        <span title="Requested at">
          Requested at
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Requested at
          </span>
        </span>
      ),
      sortFn: "datetime",
      cell: ({ row }) => {
        const createdAt = row.original.createdAt;
        if (!createdAt) return <span className="text-xs text-slate-400">—</span>;
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) return <span className="text-xs text-slate-700">{createdAt}</span>;
        const dateStr = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const timeStr = d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        return (
          <div className="whitespace-nowrap">
            <div className="font-semibold text-slate-800 text-xs">{dateStr}</div>
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{timeStr}</span>
            </div>
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
        const isCompleted = apt.status === "COMPLETED" || apt.status === "SERVED" || Boolean(apt.completedAt);
        if (isCompleted) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 shadow-2xs">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Served</span>
            </span>
          );
        }
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
      {/* Centered Page Header */}
      <div className="w-full text-center">
        <h2 className="text-xl font-bold text-slate-900">
          Book Appointment
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Browse available municipal service slots and reserve your in-person office schedule.
        </p>
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

      {/* Dynamic Available Public Services Section (Retrieved from Database) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                <FileText className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Available Public Services
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {activeServices.length} {activeServices.length === 1 ? "Service" : "Services"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 text-center">
              Select any public service configured by the administration to schedule an appointment.
            </p>
          </div>

          {/* Department Filter Pills */}
          {activeDepartments.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap pb-1 sm:pb-0 max-w-full">
              <button
                type="button"
                onClick={() => setSelectedPublicServiceDept("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                  selectedPublicServiceDept === "ALL"
                    ? "bg-[#0b2545] text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                All Departments
              </button>
              {activeDepartments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedPublicServiceDept(d.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                    selectedPublicServiceDept === d.id
                      ? "bg-[#0b2545] text-white shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Services Cards Grid */}
        {displayedPublicServices.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No public services available</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {selectedPublicServiceDept !== "ALL"
                ? "No active services found for the selected department."
                : "Public services are being updated by the administration."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedPublicServices.map((service) => {
              const dept = departments.find((d) => d.id === service.departmentId);
              const dailyCapacity = getServiceDailyCapacity(service);
              const bookedToday = todayBookedCounts[service.id] ?? 0;
              const hasSchedule = schedulesForService(service, schedules || []).length > 0;
              const isUnscheduled = !hasSchedule;
              const isZeroCapacity = dailyCapacity === 0;
              const isFull = !isZeroCapacity && bookedToday >= dailyCapacity;
              return (
                <div
                  key={service.id}
                  className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                        <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          Daily Appointment Capacity: <strong className="font-bold text-slate-900">{dailyCapacity}</strong>
                        </span>
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1">
                      {service.name}
                    </h4>

                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{dept?.name || "General Administration"}</span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                      {service.description || "Public administrative appointment and registration service."}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold ${
                        isUnscheduled
                          ? "text-amber-600"
                          : isZeroCapacity
                            ? "text-amber-600"
                            : isFull
                              ? "text-rose-600"
                              : "text-emerald-700"
                      }`}
                    >
                      {isUnscheduled ? "Not Configured" : isZeroCapacity ? "Unavailable" : isFull ? "Full" : "Free"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectServiceForBooking(service)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0b2545] hover:bg-[#133b5c] text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                    >
                      <Calendar className="w-3 h-3 text-amber-300" />
                      <span>Book Slot</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booked Appointments Section Header */}
      <div className="w-full text-center pt-2">
        <h3 className="text-sm font-bold text-slate-900">My Appointments</h3>
        <p className="text-xs text-slate-500 mt-0.5">View and track your scheduled office visits</p>
      </div>

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
              {activeServices.map((s) => (
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

      {/* Appointments Table with Header Text: services, Appoitment Date, Appoitment Time, Requested at, Mesage, Status, Action */}
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
                  Select an available public service above to schedule your in-person office visit.
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
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#0b2545]/10 text-[#0b2545] border border-[#0b2545]/15 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id="booking-modal-title" className="font-extrabold text-slate-900 text-base tracking-tight">
                      Book Appointment: {selectedService?.name || selectedSlot.service || "Municipal Service"}
                    </h3>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                      {selectedSlot.availabilityText || "Slots Available"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="modal-close"
                aria-label="Close"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="mt-5 space-y-5">
              {/* Service & Appointment Slot Selection */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/90 space-y-4 shadow-2xs">
                {/* Appointment Date and Time in clean responsive 2-column grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="citizen-appointment-date" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Appointment Date <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <CitizenDateDmyInput
                      id="citizen-appointment-date"
                      required
                      min={dateRange?.min || todayIso}
                      max={dateRange?.max || undefined}
                      disabled={!selectedService || !dateRange}
                      value={selectedSlot.date || ""}
                      onChange={handleDateChange}
                      ariaLabel="Appointment date (Date/Month/Year)"
                    />
                  </div>

                  <div>
                    <label htmlFor="citizen-appointment-time" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Appointment Time <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="time"
                        required
                        value={slotToClock(selectedSlot.time)}
                        onChange={(e) => setSelectedSlot((prev) => ({ ...prev, time: clockToSlot(e.target.value) }))}
                        disabled={timeInputDisabled}
                        id="citizen-appointment-time"
                        aria-label="Appointment time"
                        aria-invalid={Boolean(timeNotice)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b2545]/20 focus:border-[#0b2545] cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Available / Booked Slot Selection Pills */}
                {daySlots.length > 0 && !timeInputDisabled && (
                  <div className="space-y-1.5">
                    <div className="relative flex items-center justify-center">
                      <span className="text-xs font-bold text-slate-700 text-center">
                        Available Time Slots
                      </span>
                      <span className="absolute right-0 text-[11px] font-semibold text-slate-500">
                        {availability.data?.slotIntervalMinutes || scheduleForDate?.slotIntervalMinutes || 30} mins per slot
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-slate-200/90 rounded-xl bg-white shadow-2xs">
                      {daySlots
                        .filter((sl) => !sl.lunchBreak)
                        .map((sl) => {
                          const isBooked = sl.status === "Full" || (Number(sl.bookedCount) || 0) >= (availability.data?.maxParallelSlots || 1);
                          const isPast = !isBooked && (Boolean(sl.isPast) || sl.status === "Unavailable");
                          const isAvail = sl.status === "Available" && !isBooked && !isPast;
                          const isSelected = selectedSlot.time === sl.timeSlot;
                          const aheadForSlot = getPeopleAheadCount(sl.timeSlot);
                          return (
                            <button
                              key={sl.timeSlot}
                              type="button"
                              disabled={!isAvail}
                              onClick={() => setSelectedSlot((prev) => ({ ...prev, time: sl.timeSlot }))}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                                !isAvail
                                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/70 opacity-60"
                                  : isSelected
                                  ? "bg-[#0b2545] text-white shadow-xs border border-[#0b2545]"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 hover:border-slate-300 cursor-pointer"
                              }`}
                              title={
                                isBooked
                                  ? `${displayTime(sl.timeSlot)} (Already booked for this service)`
                                  : isPast
                                  ? `${displayTime(sl.timeSlot)} (Time has passed today)`
                                  : `${displayTime(sl.timeSlot)} (${
                                      aheadForSlot === 0
                                        ? "0 ahead · 1st to be served"
                                        : `${aheadForSlot} ${aheadForSlot === 1 ? "person" : "people"} scheduled ahead (Queue Position: ${aheadForSlot + 1})`
                                    })`
                              }
                            >
                              <span>{displayTime(sl.timeSlot)}</span>
                              {isBooked ? (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  (Booked)
                                </span>
                              ) : isPast ? (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  (Passed)
                                </span>
                              ) : (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    isSelected
                                      ? "bg-white/20 text-white"
                                      : aheadForSlot === 0
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-slate-200/80 text-slate-700"
                                  }`}
                                >
                                  {aheadForSlot === 0 ? "1st" : formatQueuePosition(aheadForSlot + 1)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Queue Preview Card: Displays live queue serving order & same service bookings */}
                {selectedSlot.date && selectedSlot.time && !timeNotice && !timeInputDisabled && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xs mt-3">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                            selectedPeopleAhead === 0
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-[#0b2545]/10 text-[#0b2545] border border-[#0b2545]/15"
                          }`}
                        >
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-900 tracking-tight">
                          Queue Serving Order & Flow
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 text-center">
                        Live estimated order based on scheduled appointment time
                      </p>
                      <div className="mt-2.5">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border shadow-2xs inline-flex items-center gap-1.5 ${
                            selectedPeopleAhead === 0
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-slate-100 text-slate-800 border-slate-200"
                          }`}
                        >
                          {selectedPeopleAhead === 0 ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Estimated Order: 1st in Queue</span>
                            </>
                          ) : (
                            <>
                              <Users className="w-3.5 h-3.5 text-slate-600" />
                              <span>Estimated Order: #{selectedPeopleAhead + 1} in Queue (Position {selectedPeopleAhead + 1})</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* 2 Key Metrics Grid: Service Bookings & Scheduled Ahead */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-slate-100">
                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Same-Day Service Bookings
                        </span>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <strong className="text-[#0b2545] font-black text-lg">{sameServiceBookedCount}</strong>
                          <span className="text-xs text-slate-700">
                            {sameServiceBookedCount === 1 ? "other citizen booked" : "other citizens booked"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          For {displayDate(selectedSlot.date)}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70">
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          Queue Preceding Your Slot
                        </span>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          {selectedPeopleAhead === 0 ? (
                            <span className="text-emerald-800 font-bold text-xs flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              0 people ahead · You will be served 1st!
                            </span>
                          ) : (
                            <>
                              <strong className="text-[#0b2545] font-black text-lg">{selectedPeopleAhead}</strong>
                              <span className="text-xs text-slate-700">
                                {selectedPeopleAhead === 1 ? "person ahead" : "people ahead"}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Scheduled before {displayTime(selectedSlot.time)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-start gap-2 text-[11px] leading-relaxed">
                      <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <p className="text-slate-600">
                        Citizens are served in order of scheduled appointment time.{" "}
                        {selectedPeopleAhead > 0 ? (
                          <span className="text-slate-900 font-semibold">
                            Choosing an earlier available slot will move your desk serving order forward.
                          </span>
                        ) : (
                          <span className="text-emerald-800 font-semibold">
                            You selected the earliest available slot — you will be first in line when desk service begins.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {timeNotice && (
                  <div role="alert" className="flex items-start gap-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>{timeNotice}</span>
                  </div>
                )}


                {dateNotice && (
                  <div role="alert" className="flex items-start gap-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>{dateNotice}</span>
                  </div>
                )}
                {selectedService && dateRange && bookableDates.serviceId === selectedSlot?.serviceId && bookableDates.dates.length === 0 && (
                  <p className="text-xs text-slate-500">No dates are open for booking in the next 60 days.</p>
                )}
              </div>

              {/* Message to the office (optional) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label htmlFor="citizen-notes" className="block text-xs font-bold text-slate-700">
                  Additional Notes (Optional)
                </label>
                <p className="text-[11px] text-slate-500">
                  Provide any context, special requirements, or reference documents for the desk officer.
                </p>
                <textarea
                  id="citizen-notes"
                  rows={3}
                  value={citizenNotes}
                  onChange={(e) => setCitizenNotes(e.target.value)}
                  placeholder="Write your message or any notes regarding your visit..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545]/20 focus:border-[#0b2545] focus:outline-none bg-white shadow-2xs text-slate-800 placeholder:text-slate-400 resize-none transition-all"
                />
              </div>

              {bookingError && (
                <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="flex-1">{bookingError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                {selectedSlot.date && selectedSlot.time && canConfirm ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold shadow-2xs">
                    <Users className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>
                      Service Bookings: <strong className="text-slate-900 font-extrabold">{sameServiceBookedCount}</strong> · Ahead in Queue:{" "}
                      <strong className="text-slate-900 font-extrabold">
                        {selectedPeopleAhead} {selectedPeopleAhead === 1 ? "person" : "people"}
                      </strong>{" "}
                      · Estimated Serving Order:{" "}
                      <strong className="text-[#0b2545] font-extrabold">
                        {selectedPeopleAhead === 0 ? "1st" : `#${selectedPeopleAhead + 1}`}
                      </strong>
                    </span>
                  </div>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2.5 ml-auto">
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
                    className="modal-btn modal-btn--primary"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-1" />
                        <span>Confirming…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        <span>Confirm Booking</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

