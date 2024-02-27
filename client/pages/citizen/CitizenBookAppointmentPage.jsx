import { useState, useEffect } from "react";
import { useStore } from "@/context";
import { subscribe, isLive } from "@/api/realtime";
import { scheduleApi } from "@/api";
import {
  bookableRange,
  closedMessage,
  displayDate,
  displayTime,
  formatWorkingDays,
  localIsoDate,
  nextWorkingDate,
  scheduleOn,
  schedulesForService,
  weekdayOfIso,
} from "@/utils";
import AppointmentSlip from "@/features/appointments/AppointmentSlip";
import { EthiopianFlag } from "@/components/ui";
import {
  Calendar,
  Clock,
  Building2,
  FileText,
  Search,
  Filter,
  CheckCircle,
  X,
  User,
  Phone,
  AlertCircle,
} from "lucide-react";

export default function CitizenBookAppointmentPage() {
  // Bumped on every catalog/schedule change so open availability is fetched again.
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  const {
    currentUser,
    bookAppointment,
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

  const [slots, setSlots] = useState([]);

  // Overview table: every active service that has an opening schedule, on its next working day,
  // with that day's availability from booking-service.
  useEffect(() => {
    let cancelled = false;
    const rows = (services || [])
      .filter((srv) => srv.isActive !== false)
      .map((srv) => {
        const date = nextWorkingDate(srv, schedules);
        const sch = date ? scheduleOn(srv, schedules, date) : null;
        if (!date || !sch) return null;
        const dept = departments.find((d) => d.id === srv.departmentId);
        return {
          id: `slot-${srv.id}-${date}`,
          date,
          dateDisplay: displayDate(date),
          time: `${displayTime(sch.openingTime)} – ${displayTime(sch.closingTime)}`,
          workingDays: formatWorkingDays(sch.workingDays),
          departmentId: srv.departmentId,
          department: dept?.name || sch.department || "Municipal Department",
          serviceId: srv.id,
          service: srv.name,
          availabilityText: "Checking…",
          actionValue: "Unavailable",
        };
      })
      .filter(Boolean);
    setSlots(rows);
    Promise.all(
      rows.map((row) =>
        scheduleApi
          .availability({ serviceId: row.serviceId, date: row.date })
          .then(({ data }) => {
            const open = (data?.slots || []).filter((sl) => sl.status === "Available").length;
            const full = !data?.closedReason && open === 0 ? "Full" : null;
            const actionValue = open > 0 ? "Available" : full || (data?.closedReason === "DAILY_CAPACITY_REACHED" ? "Full" : "Unavailable");
            return { ...row, actionValue, availabilityText: open > 0 ? `${open} slots open` : actionValue };
          })
          .catch(() => ({ ...row, availabilityText: "Unavailable" }))
      )
    ).then((checked) => {
      if (!cancelled) setSlots(checked);
    });
    return () => {
      cancelled = true;
    };
  }, [schedules, services, departments, availabilityVersion]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");

  // Booking Modal State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [citizenName, setCitizenName] = useState(currentUser?.fullName || "");
  const [citizenPhone, setCitizenPhone] = useState(currentUser?.phone || "");
  const [citizenNotes, setCitizenNotes] = useState("");
  const [bookingSuccessApt, setBookingSuccessApt] = useState(null);

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
      .availability({ serviceId, date })
      .then(({ data }) => {
        if (cancelled) return;
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
          setAvailability({ loading: false, data: null, error: "Could not check available times. Check your connection and try again." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlot?.serviceId, selectedSlot?.date, availabilityVersion]);

  // Times offered in the dropdown: the schedule's opening hours (lunch break and closed hours left out).
  const timeOptions = (availability.data?.slots || []).filter((sl) => sl.status !== "Unavailable");
  const chosenSlot = timeOptions.find((sl) => sl.timeSlot === selectedSlot?.time);
  const canConfirm = Boolean(selectedSlot?.serviceId && selectedSlot?.date && chosenSlot?.status === "Available");
  const dateNotice = !selectedService
    ? ""
    : serviceSchedules.length === 0 || !dateRange
      ? "This service has no published opening schedule yet, so it cannot be booked. Please check again later."
      : availability.data?.closedReason
        ? closedMessage(availability.data.closedReason, { date: selectedSlot?.date, schedule: scheduleForDate })
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
    setCitizenName(currentUser?.fullName || "");
    setCitizenPhone(currentUser?.phone || "");
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

  const handleConfirmBooking = (e) => {
    e.preventDefault();
    if (!selectedSlot || !canConfirm) return;

    const refNumber = `WRD-${selectedSlot.date.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newApt = {
      id: `apt-${Date.now()}`,
      referenceNumber: refNumber,
      citizenId: currentUser?.id || "usr-citizen-temp",
      citizenName: citizenName || currentUser?.fullName || "Citizen Applicant",
      citizenPhone: citizenPhone || currentUser?.phone || "",
      citizenEmail: currentUser?.email || "",
      departmentId: selectedSlot.departmentId,
      departmentName: selectedSlot.department,
      serviceId: selectedSlot.serviceId,
      serviceName: selectedSlot.service,
      date: selectedSlot.date,
      timeSlot: selectedSlot.time,
      status: "PENDING",
      tokenNumber: null,
      citizenNotes: citizenNotes || "",
      officerNotes: null,
      createdAt: new Date().toISOString(),
    };

    bookAppointment({
      citizenName: newApt.citizenName,
      citizenPhone: newApt.citizenPhone,
      citizenEmail: newApt.citizenEmail,
      departmentId: newApt.departmentId,
      departmentName: newApt.departmentName,
      serviceId: newApt.serviceId,
      serviceName: newApt.serviceName,
      date: newApt.date,
      timeSlot: newApt.timeSlot,
      citizenNotes: newApt.citizenNotes,
    });


    setSelectedSlot(null);
    setBookingSuccessApt(newApt);
  };

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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5 whitespace-nowrap">Appointment Date&Time</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Department</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Service</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSlots.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
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
                  </td>
                </tr>
              ) : (
                filteredSlots.map((slot) => {
                  const isAvailable = slot.actionValue === "Available";
                  const isFull = slot.actionValue === "Full";
                  const isUnavailable = slot.actionValue === "Unavailable";

                  return (
                    <tr
                      key={slot.id}
                      onClick={() => isAvailable && handleOpenBooking(slot)}
                      className={`transition-colors ${
                        isAvailable
                          ? "hover:bg-emerald-50/50 cursor-pointer"
                          : "hover:bg-slate-50/70"
                      }`}
                    >
                      {/* Column 1: Appointment Date&Time */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{slot.dateDisplay}</div>
                        <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-blue-600 inline" />
                          {slot.time}
                        </div>
                        {slot.workingDays && (
                          <div className="text-[10px] text-slate-500 mt-0.5">Open {slot.workingDays}</div>
                        )}
                      </td>

                      {/* Column 2: Department */}
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-800">{slot.department}</span>
                      </td>

                      {/* Column 3: Service */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{slot.service}</div>
                      </td>

                      {/* Column 4: Availability (Used only Available, Full, or Unavailable) */}
                      <td className="px-5 py-3.5">
                        {isAvailable && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Available
                            {slot.availabilityText?.endsWith("slots open") && (
                              <span className="font-normal text-emerald-600">· {slot.availabilityText}</span>
                            )}
                          </span>
                        )}
                        {isFull && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Full
                          </span>
                        )}
                        {isUnavailable && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Unavailable
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200/90 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-2xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-base">Book Municipal Appointment</h3>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      {selectedSlot.availabilityText || "Slots Available"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select a service and slot, then confirm your visit details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
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

                {/* Appointment Date&Time Selection */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Appointment Date&Time *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Date Selection: only dates inside the service's schedule */}
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
                        aria-label="Appointment date"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Time Selection: the schedule's slots on that date */}
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        required
                        value={chosenSlot ? selectedSlot.time : ""}
                        onChange={(e) => setSelectedSlot((prev) => ({ ...prev, time: e.target.value }))}
                        disabled={availability.loading || timeOptions.length === 0 || Boolean(availability.data?.closedReason && availability.data.closedReason !== "DAILY_CAPACITY_REACHED")}
                        aria-label="Appointment time"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>
                          {availability.loading
                            ? "Checking available times…"
                            : timeOptions.length === 0
                              ? "No times available"
                              : "Select a time"}
                        </option>
                        {timeOptions.map((sl) => (
                          <option key={sl.timeSlot} value={sl.timeSlot} disabled={sl.status !== "Available"}>
                            {displayTime(sl.timeSlot)}
                            {sl.status === "Full" ? " (full)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* What the Admin's schedule allows for this service */}
                  {scheduleForDate && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Open {formatWorkingDays(scheduleForDate.workingDays)}, {displayTime(scheduleForDate.openingTime)} –{" "}
                      {displayTime(scheduleForDate.closingTime)}
                      {dateRange?.max ? ` · bookable until ${displayDate(dateRange.max)}` : ""}
                    </p>
                  )}
                  {(dateNotice || availability.error) && (
                    <p role="alert" className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span>{availability.error || dateNotice}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Section 2: Citizen Applicant Details */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="pb-1">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>2. Citizen Applicant Details</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Official booking identification for gate check-in and queue ticket issuance
                  </p>
                </div>

                {/* Full Legal Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Citizen Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={citizenName}
                      onChange={(e) => setCitizenName(e.target.value)}
                      placeholder="e.g. Abebe Bikila"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none bg-white shadow-2xs"
                    />
                  </div>
                </div>

                {/* Phone Number with Ethiopian Flag */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Phone Number *
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center gap-2 pointer-events-none select-none">
                      <EthiopianFlag className="w-5 h-3.5 shadow-2xs rounded-xs shrink-0" />
                      <span className="w-px h-4 bg-slate-300" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={citizenPhone}
                      onChange={(e) => setCitizenPhone(e.target.value)}
                      placeholder="+251 9XX XXX XXX"
                      className="w-full pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none bg-white shadow-2xs"
                      style={{ paddingLeft: "3.75rem" }}
                    />
                  </div>
                </div>

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

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canConfirm}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm Booking</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Success Slip Modal */}
      {bookingSuccessApt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Appointment Booked!</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Your reservation has been recorded in the municipal queue.
              </p>
            </div>

            <AppointmentSlip appointment={bookingSuccessApt} />

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setBookingSuccessApt(null)}
                className="w-full py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

