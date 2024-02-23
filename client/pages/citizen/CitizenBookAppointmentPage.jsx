import { useState, useEffect } from "react";
import { useStore } from "@/context";
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
} from "lucide-react";

export default function CitizenBookAppointmentPage() {
  const { currentUser, bookAppointment, departments = [], services = [] } = useStore();

  const [slots, setSlots] = useState(() => {
    if (!services || services.length === 0) return [];
    return services.map((srv) => {
      const dept = departments.find((d) => d.id === srv.departmentId);
      return {
        id: `slot-${srv.id}`,
        date: "2026-11-03",
        dateDisplay: "Nov 3, 2026",
        time: "09:00 AM",
        departmentId: srv.departmentId,
        department: dept?.name || "Municipal Department",
        serviceId: srv.id,
        service: srv.name,
        availabilityText: "Available",
        actionValue: "Available",
      };
    });
  });

  useEffect(() => {
    if (services && services.length > 0) {
      setSlots((prev) => {
        if (prev.length > 0) return prev;
        return services.map((srv) => {
          const dept = departments.find((d) => d.id === srv.departmentId);
          return {
            id: `slot-${srv.id}`,
            date: "2026-11-03",
            dateDisplay: "Nov 3, 2026",
            time: "09:00 AM",
            departmentId: srv.departmentId,
            department: dept?.name || "Municipal Department",
            serviceId: srv.id,
            service: srv.name,
            availabilityText: "Available",
            actionValue: "Available",
          };
        });
      });
    } else {
      setSlots([]);
    }
  }, [services, departments]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");

  // Booking Modal State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [citizenName, setCitizenName] = useState(currentUser?.fullName || "Abebe Bikila");
  const [citizenPhone, setCitizenPhone] = useState(currentUser?.phone || "+251911223344");
  const [citizenNotes, setCitizenNotes] = useState("");
  const [bookingSuccessApt, setBookingSuccessApt] = useState(null);

  // Modal Dropdown Collections
  const modalDepartments = departments && departments.length > 0 ? departments : [];

  const availableServicesForDept =
    services && services.length > 0
      ? services.filter((s) => s.departmentId === selectedSlot?.departmentId)
      : [];

  const safeServices =
    availableServicesForDept.length > 0
      ? availableServicesForDept
      : selectedSlot?.serviceId
      ? [{ id: selectedSlot.serviceId, name: selectedSlot.service || "General Public Service" }]
      : [];

  const availableDates = [
    { date: "2026-11-03", dateDisplay: "Nov 3, 2026" },
    { date: "2026-11-04", dateDisplay: "Nov 4, 2026" },
    { date: "2026-11-05", dateDisplay: "Nov 5, 2026" },
    { date: "2026-11-06", dateDisplay: "Nov 6, 2026" },
    { date: "2026-11-09", dateDisplay: "Nov 9, 2026" },
  ];

  const availableTimeSlots = [
    "08:30 AM",
    "09:00 AM",
    "10:00 AM",
    "10:30 AM",
    "11:00 AM",
    "11:30 AM",
    "14:00 PM",
    "14:30 PM",
    "15:30 PM",
  ];

  const handleDepartmentChange = (deptId) => {
    const matchedDept = modalDepartments.find((d) => d.id === deptId);
    const deptName = matchedDept ? matchedDept.name : "Municipal Department";
    const servicesForNewDept = (services || []).filter((s) => s.departmentId === deptId);
    const firstService =
      servicesForNewDept[0] || {
        id: `srv-${deptId}`,
        name: `${deptName} Service`,
      };

    setSelectedSlot((prev) => ({
      ...prev,
      departmentId: deptId,
      department: deptName,
      serviceId: firstService.id,
      service: firstService.name,
      availabilityText: "Available",
      actionValue: "Available",
    }));
  };

  const handleServiceChange = (serviceId) => {
    const matchedService = (services || []).find((s) => s.id === serviceId);
    const serviceName = matchedService ? matchedService.name : "Public Service";

    setSelectedSlot((prev) => ({
      ...prev,
      serviceId,
      service: serviceName,
      availabilityText: "Available",
      actionValue: "Available",
    }));
  };

  const handleDateChange = (dateVal) => {
    const matchedDate = availableDates.find((d) => d.date === dateVal) || {
      date: dateVal,
      dateDisplay: dateVal,
    };
    setSelectedSlot((prev) => ({
      ...prev,
      date: matchedDate.date,
      dateDisplay: matchedDate.dateDisplay,
    }));
  };

  const handleTimeChange = (timeVal) => {
    setSelectedSlot((prev) => ({
      ...prev,
      time: timeVal,
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
  const totalCount = slots.length;
  const availableCount = slots.filter((s) => s.actionValue === "Available").length;
  const fullCount = slots.filter((s) => s.actionValue === "Full").length;
  const unavailableCount = slots.filter((s) => s.actionValue === "Unavailable").length;

  const handleOpenBooking = (slot) => {
    setSelectedSlot(slot);
    setCitizenName(currentUser?.fullName || "Abebe Bikila");
    setCitizenPhone(currentUser?.phone || "+251911223344");
    setCitizenNotes("");
  };

  const handleOpenNewBooking = () => {
    const firstAvailable = slots.find((s) => s.actionValue === "Available") || slots[0];
    if (firstAvailable) {
      handleOpenBooking(firstAvailable);
    } else if (departments.length > 0) {
      const firstDept = departments[0];
      const deptServices = (services || []).filter((s) => s.departmentId === firstDept.id);
      const firstService =
        deptServices[0] || services[0] || { id: "srv-gen", name: "General Public Service" };
      handleOpenBooking({
        id: `slot-${Date.now()}`,
        date: "2026-11-03",
        dateDisplay: "Nov 3, 2026",
        time: "09:00 AM",
        departmentId: firstDept.id,
        department: firstDept.name,
        serviceId: firstService.id,
        service: firstService.name,
        availabilityText: "Available",
        actionValue: "Available",
      });
    }
  };

  const handleConfirmBooking = (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    const refNumber = `WRD-${selectedSlot.date.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newApt = {
      id: `apt-${Date.now()}`,
      referenceNumber: refNumber,
      citizenId: currentUser?.id || "usr-citizen-temp",
      citizenName: citizenName || currentUser?.fullName || "Citizen Applicant",
      citizenPhone: citizenPhone || "+251911223344",
      citizenEmail: currentUser?.email || "citizen@woreda.gov.et",
      departmentId: selectedSlot.departmentId,
      departmentName: selectedSlot.department,
      serviceId: selectedSlot.serviceId,
      serviceName: selectedSlot.service,
      date: selectedSlot.date,
      timeSlot: selectedSlot.time,
      status: "PENDING",
      tokenNumber: null,
      citizenNotes: citizenNotes || "Standard desk visit request.",
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

    // Mark slot as booked or reduce count in local view
    setSlots((prev) =>
      prev.map((s) =>
        s.id === selectedSlot.id
          ? { ...s, actionValue: "Full" }
          : s
      )
    );

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
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Slots
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
        </div>

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
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    No booking slots found matching this filter.
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
                  <h3 className="font-extrabold text-slate-900 text-base">Book Municipal Appointment</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select department, service, slot, and confirm your visit details
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
              {/* Section 1: Service & Appointment Slot Selection */}
              <div className="bg-slate-50/90 p-5 rounded-2xl border border-slate-200 space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>1. Service & Appointment Slot</span>
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {selectedSlot.availabilityText || "Slots Available"}
                  </span>
                </div>

                {/* Department Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Municipal Department *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedSlot.departmentId}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs"
                    >
                      {modalDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Public Service Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Public Service *
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={selectedSlot.serviceId}
                      onChange={(e) => handleServiceChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs"
                    >
                      {safeServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date & Time Slot Grid with Ample Gaps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Appointment Date *
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={selectedSlot.date}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs"
                      >
                        {availableDates.map((d) => (
                          <option key={d.date} value={d.date}>
                            {d.dateDisplay}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Available Time Slot *
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={selectedSlot.time}
                        onChange={(e) => handleTimeChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 cursor-pointer shadow-2xs"
                      >
                        {availableTimeSlots.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
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
                    <span className="absolute left-3.5 flex items-center pointer-events-none">
                      <EthiopianFlag className="w-5 h-3.5 shadow-2xs rounded-xs" />
                    </span>
                    <input
                      type="tel"
                      required
                      value={citizenPhone}
                      onChange={(e) => setCitizenPhone(e.target.value)}
                      placeholder="+251 9XX XXX XXX"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none bg-white shadow-2xs"
                    />
                  </div>
                </div>

                {/* Purpose / Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Purpose / Notes for Desk Officer (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={citizenNotes}
                    onChange={(e) => setCitizenNotes(e.target.value)}
                    placeholder="Briefly state your purpose, reason for visit, or documents prepared for this visit..."
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
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
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

