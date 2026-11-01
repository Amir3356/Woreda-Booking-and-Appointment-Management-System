"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatusBadge from "@/components/shared/StatusBadge";
import AppointmentSlip from "@/components/shared/AppointmentSlip";
import { useStore } from "@/lib/store";
import { formatDate, formatETB } from "@/lib/utils";
import {
  Search,
  Calendar,
  Clock,
  Building,
  User,
  AlertCircle,
  CheckCircle,
  FileText,
  XCircle,
  RefreshCw,
  Printer,
  ChevronRight,
} from "lucide-react";

function TrackContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") || "";

  const { appointments, services, rescheduleAppointment, updateAppointmentStatus } = useStore();

  const [query, setQuery] = useState(initialRef);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState(null);
  const [showSlipModal, setShowSlipModal] = useState(false);

  // Reschedule dialog state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00 AM");

  const performSearch = (searchTerm) => {
    const cleanTerm = (searchTerm || "").trim().toLowerCase();
    if (!cleanTerm) return;

    setSearched(true);
    const found = appointments.find(
      (a) =>
        a.referenceNumber.toLowerCase() === cleanTerm ||
        a.citizenPhone.replace(/\s+/g, "").includes(cleanTerm.replace(/\s+/g, ""))
    );
    setResult(found || null);
  };

  useEffect(() => {
    if (initialRef) {
      performSearch(initialRef);
    }
  }, [initialRef]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleCancel = () => {
    if (!result) return;
    if (confirm("Are you sure you want to cancel this appointment?")) {
      updateAppointmentStatus(result.id, "CANCELLED", "Citizen requested online cancellation.");
      setResult({ ...result, status: "CANCELLED" });
    }
  };

  const handleRescheduleSubmit = () => {
    if (!newDate) return;
    rescheduleAppointment(result.id, newDate, newTime, "Rescheduled by citizen online");
    setResult({ ...result, date: newDate, timeSlot: newTime, status: "APPROVED" });
    setRescheduleModalOpen(false);
  };

  const service = result ? services.find((s) => s.id === result.serviceId) : null;

  // Stages for the status timeline
  const stages = [
    { key: "PENDING", label: "Request Submitted" },
    { key: "APPROVED", label: "Confirmed by Desk" },
    { key: "CHECKED_IN", label: "Checked In at Woreda" },
    { key: "IN_PROGRESS", label: "Counter Processing" },
    { key: "COMPLETED", label: "Service Delivered" },
  ];

  const getStageIndex = (status) => {
    if (status === "CANCELLED" || status === "REJECTED" || status === "NO_SHOW") return -1;
    return stages.findIndex((s) => s.key === status);
  };

  const currentStageIndex = result ? getStageIndex(result.status) : -1;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-[11px] uppercase tracking-widest font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Citizen Self-Service Tracking
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            Track Your Appointment Status
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Enter your booking reference code or registered phone number to view live status.
          </p>
        </div>

        {/* Search Bar Box */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. WRD-20261101-001 or +251 911 889900"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white font-bold text-xs sm:text-sm transition-colors shadow-sm"
            >
              Track Appointment
            </button>
          </form>

          {/* Quick Demo Reference Suggestions */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Sample Records:</span>
            {appointments.slice(0, 3).map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setQuery(a.referenceNumber);
                  performSearch(a.referenceNumber);
                }}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] transition-colors"
              >
                {a.referenceNumber}
              </button>
            ))}
          </div>
        </div>

        {/* Search Results */}
        {searched && (
          <div>
            {!result ? (
              <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">No Booking Record Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Please verify your reference number format (e.g., <code className="font-mono">WRD-YYYYMMDD-XXX</code>) or try searching by your registered phone number.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Result Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  {/* Status & Ref Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Reference Number</span>
                      <h2 className="text-xl font-mono font-black text-[#0b2545]">
                        {result.referenceNumber}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Booked on {new Date(result.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={result.status} className="text-xs px-3 py-1.5" />
                      {result.tokenNumber && (
                        <div className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center">
                          <span className="text-[9px] uppercase font-bold block">Token</span>
                          <span className="font-mono font-bold text-sm">{result.tokenNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Visual Status Timeline (if active status) */}
                  {currentStageIndex >= 0 && (
                    <div className="py-6 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                        Progress Stage
                      </h4>
                      <div className="grid grid-cols-5 gap-2 text-center">
                        {stages.map((stage, idx) => {
                          const isCompleted = idx <= currentStageIndex;
                          const isCurrent = idx === currentStageIndex;
                          return (
                            <div key={stage.key} className="flex flex-col items-center">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-colors ${
                                  isCompleted
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                              </div>
                              <span
                                className={`text-[10px] leading-tight ${
                                  isCurrent ? "font-bold text-slate-900" : "text-slate-400"
                                }`}
                              >
                                {stage.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Appointment Details Grid */}
                  <div className="py-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-3">
                      <div>
                        <span className="text-slate-400 block font-medium">Department</span>
                        <p className="font-bold text-slate-800 text-sm">{result.departmentName}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Public Service</span>
                        <p className="font-bold text-slate-800 text-sm">{result.serviceName}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Citizen Name</span>
                        <p className="font-medium text-slate-800">{result.citizenName}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-slate-400 block font-medium">Appointment Date & Time</span>
                        <p className="font-bold text-slate-800 text-sm">
                          {formatDate(result.date)} at <span className="text-blue-700">{result.timeSlot}</span>
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Contact Phone</span>
                        <p className="font-medium text-slate-800">{result.citizenPhone}</p>
                      </div>
                      {result.officerNotes && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                          <span className="text-[10px] uppercase font-bold text-amber-800 block">Desk Officer Note</span>
                          <p className="text-xs text-amber-900">{result.officerNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <button
                      onClick={() => setShowSlipModal(!showSlipModal)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-semibold"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-300" />
                      <span>{showSlipModal ? "Hide Slip" : "View & Print Official Slip"}</span>
                    </button>

                    {result.status !== "COMPLETED" && result.status !== "CANCELLED" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRescheduleModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reschedule</span>
                        </button>

                        <button
                          onClick={handleCancel}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel Booking</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional Printable Slip Embed */}
                {showSlipModal && (
                  <div className="mt-6">
                    <AppointmentSlip appointment={result} service={service} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reschedule Modal */}
        {rescheduleModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <h3 className="font-bold text-base text-slate-900 mb-2">Reschedule Appointment</h3>
              <p className="text-xs text-slate-500 mb-4">
                Select a new available date and time slot for booking #{result?.referenceNumber}.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Time Slot</label>
                  <select
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs bg-white"
                  >
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="14:00 PM">14:00 PM</option>
                    <option value="15:30 PM">15:30 PM</option>
                  </select>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    onClick={() => setRescheduleModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRescheduleSubmit}
                    className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
                  >
                    Confirm Reschedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function TrackAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading Tracking Desk...</p>
          </div>
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
