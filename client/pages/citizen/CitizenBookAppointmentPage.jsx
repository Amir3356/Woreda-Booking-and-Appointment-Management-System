"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import AppointmentSlip from "@/components/shared/AppointmentSlip";
import {
  Calendar,
  Clock,
  Building2,
  FileText,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Ban,
  X,
  User,
  Phone,
  FileCheck2,
  Sparkles,
  Printer,
  ChevronRight,
} from "lucide-react";

// Initial schedule benchmark slots available for citizen booking
const INITIAL_BOOKING_SLOTS = [
  {
    id: "slot-1",
    date: "2026-11-03",
    dateDisplay: "Nov 3, 2026",
    time: "09:00 AM",
    departmentId: "dept-1",
    department: "Kebele Administration & Vital Events",
    serviceId: "srv-1",
    service: "Kebele Digital ID Registration & Issuance",
    availabilityText: "18 Slots Available",
    actionValue: "Available",
  },
  {
    id: "slot-2",
    date: "2026-11-03",
    dateDisplay: "Nov 3, 2026",
    time: "10:30 AM",
    departmentId: "dept-1",
    department: "Kebele Administration & Vital Events",
    serviceId: "srv-2",
    service: "Residence Certificate (Melkeya)",
    availabilityText: "Full (0 Slots Left)",
    actionValue: "Full",
  },
  {
    id: "slot-3",
    date: "2026-11-03",
    dateDisplay: "Nov 3, 2026",
    time: "11:30 AM",
    departmentId: "dept-2",
    department: "Land Administration & Urban Development",
    serviceId: "srv-5",
    service: "Landholding Rights Verification & Mapping",
    availabilityText: "12 Slots Available",
    actionValue: "Available",
  },
  {
    id: "slot-4",
    date: "2026-11-03",
    dateDisplay: "Nov 3, 2026",
    time: "14:00 PM",
    departmentId: "dept-2",
    department: "Land Administration & Urban Development",
    serviceId: "srv-6",
    service: "Building Permit Pre-Check & Site Inspection",
    availabilityText: "Desk Closed (Holiday)",
    actionValue: "Unavailable",
  },
  {
    id: "slot-5",
    date: "2026-11-04",
    dateDisplay: "Nov 4, 2026",
    time: "08:30 AM",
    departmentId: "dept-3",
    department: "Trade, Industry & Enterprise Development",
    serviceId: "srv-7",
    service: "Annual Trade License Renewal",
    availabilityText: "22 Slots Available",
    actionValue: "Available",
  },
  {
    id: "slot-6",
    date: "2026-11-04",
    dateDisplay: "Nov 4, 2026",
    time: "10:00 AM",
    departmentId: "dept-3",
    department: "Trade, Industry & Enterprise Development",
    serviceId: "srv-8",
    service: "Micro & Small Enterprise (MSE) Registration",
    availabilityText: "Full (0 Slots Left)",
    actionValue: "Full",
  },
  {
    id: "slot-7",
    date: "2026-11-04",
    dateDisplay: "Nov 4, 2026",
    time: "11:30 AM",
    departmentId: "dept-4",
    department: "Revenue & Tax Administration",
    serviceId: "srv-9",
    service: "Woreda Tax Clearance Certificate",
    availabilityText: "15 Slots Available",
    actionValue: "Available",
  },
  {
    id: "slot-8",
    date: "2026-11-04",
    dateDisplay: "Nov 4, 2026",
    time: "14:30 PM",
    departmentId: "dept-4",
    department: "Revenue & Tax Administration",
    serviceId: "srv-10",
    service: "Business Turnover Tax Assessment",
    availabilityText: "Unavailable (Counter Under Maintenance)",
    actionValue: "Unavailable",
  },
  {
    id: "slot-9",
    date: "2026-11-05",
    dateDisplay: "Nov 5, 2026",
    time: "09:00 AM",
    departmentId: "dept-1",
    department: "Kebele Administration & Vital Events",
    serviceId: "srv-3",
    service: "Vital Event: Birth Certificate Registration",
    availabilityText: "25 Slots Available",
    actionValue: "Available",
  },
  {
    id: "slot-10",
    date: "2026-11-05",
    dateDisplay: "Nov 5, 2026",
    time: "11:00 AM",
    departmentId: "dept-5",
    department: "Social Affairs & Community Development",
    serviceId: "srv-11",
    service: "Elderly & Vulnerable Citizen Direct Assistance",
    availabilityText: "10 Slots Available",
    actionValue: "Available",
  },
  {
    id: "slot-11",
    date: "2026-11-05",
    dateDisplay: "Nov 5, 2026",
    time: "14:00 PM",
    departmentId: "dept-5",
    department: "Social Affairs & Community Development",
    serviceId: "srv-12",
    service: "Community Mediation & Civil Dispute Record",
    availabilityText: "Full (0 Slots Left)",
    actionValue: "Full",
  },
];

export default function CitizenBookAppointmentPage() {
  const { currentUser, bookAppointment, departments } = useStore();

  const [slots, setSlots] = useState(INITIAL_BOOKING_SLOTS);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");

  // Booking Modal State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [citizenName, setCitizenName] = useState(currentUser?.fullName || "Abebe Bikila");
  const [citizenPhone, setCitizenPhone] = useState(currentUser?.phone || "+251911223344");
  const [citizenNotes, setCitizenNotes] = useState("");
  const [bookingSuccessApt, setBookingSuccessApt] = useState(null);

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
      {/* Centered Page Header */}
      <div
        className="relative flex items-center justify-center w-full min-h-[48px]"
        style={{ position: "relative", minHeight: "48px", textAlign: "center" }}
      >
        <div className="w-full text-center" style={{ textAlign: "center" }}>
          <h2 className="text-xl font-bold text-slate-900" style={{ textAlign: "center" }}>
            Book Appointment
          </h2>
          <p className="text-xs text-slate-500 mt-1" style={{ textAlign: "center" }}>
            Browse available municipal service slots and book your in-person office schedule.
          </p>
        </div>
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Confirm Appointment Booking</h3>
                  <p className="text-[11px] text-slate-500">
                    Municipal Appointment Desk Reservation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="mt-4 space-y-4">
              {/* Selected Slot Brief */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Service:</span>
                  <span className="font-bold text-slate-900">{selectedSlot.service}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-medium text-slate-700">{selectedSlot.department}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Scheduled Date & Time:</span>
                  <span className="font-bold text-blue-700">
                    {selectedSlot.dateDisplay} at {selectedSlot.time}
                  </span>
                </div>
              </div>

              {/* Citizen Details Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Citizen Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={citizenName}
                      onChange={(e) => setCitizenName(e.target.value)}
                      placeholder="e.g. Abebe Bikila"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={citizenPhone}
                      onChange={(e) => setCitizenPhone(e.target.value)}
                      placeholder="+251 9..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purpose / Notes for Desk Officer (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={citizenNotes}
                    onChange={(e) => setCitizenNotes(e.target.value)}
                    placeholder="Briefly state your purpose or documents prepared..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition-colors cursor-pointer flex items-center gap-1.5"
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

