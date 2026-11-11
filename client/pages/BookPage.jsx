import { useState, useEffect, Suspense } from "react";
import { toast } from "sonner";
import { useSearchParams } from "@/hooks";
import Navbar from "@/layout/Navbar";
import Footer from "@/layout/Footer";
import AppointmentSlip from "@/features/appointments/AppointmentSlip";
import { useStore } from "@/context";
import { formatETB, formatDate } from "@/utils";
import {
  Building2,
  FileText,
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  FileCheck2,
  MapPin,
} from "lucide-react";
import Link from "@/components/ui/Link";

function BookingContent() {
  const searchParams = useSearchParams();
  const initialDeptId = searchParams.get("deptId") || "";
  const initialServiceId = searchParams.get("serviceId") || "";

  const {
    departments,
    services,
    currentUser,
    bookAppointment,
    getAvailableSlots,
  } = useStore();

  const [step, setStep] = useState(1);
  const [selectedDeptId, setSelectedDeptId] = useState(initialDeptId);
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");

  const [citizenName, setCitizenName] = useState(currentUser?.fullName || "");
  const [citizenPhone, setCitizenPhone] = useState(currentUser?.phone || "+251 9");
  const [citizenAddress, setCitizenAddress] = useState(currentUser?.address || "Kebele 03");
  const [citizenNotes, setCitizenNotes] = useState("");
  const [agreementChecked, setAgreementChecked] = useState(false);

  const [submittedAppointment, setSubmittedAppointment] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialDeptId) setSelectedDeptId(initialDeptId);
    if (initialServiceId) setSelectedServiceId(initialServiceId);
  }, [initialDeptId, initialServiceId]);

  const selectedDepartment = departments.find((d) => d.id === selectedDeptId);
  const departmentServices = services.filter((s) => s.departmentId === selectedDeptId && s.isActive);
  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Available slots for the selected date
  const availableSlots = selectedServiceId && selectedDate
    ? getAvailableSlots(selectedServiceId, selectedDate)
    : [];

  // Minimum booking date: set after mount to prevent prerender clock mismatch
  const [minDateStr, setMinDateStr] = useState("2026-11-02");

  useEffect(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    setMinDateStr(t.toISOString().split("T")[0]);
  }, []);

  const handleNextStep = () => {
    setErrorMsg("");
    if (step === 1) {
      if (!selectedDeptId) {
        const msg = "Please select a government department to continue.";
        setErrorMsg(msg);
        toast.error(msg, { duration: 5000 });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedServiceId) {
        const msg = "Please choose a public service.";
        setErrorMsg(msg);
        toast.error(msg, { duration: 5000 });
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Requirements acknowledged
      setStep(4);
    } else if (step === 4) {
      if (!selectedDate) {
        const msg = "Please choose your desired appointment date.";
        setErrorMsg(msg);
        toast.error(msg, { duration: 5000 });
        return;
      }
      setStep(5);
    } else if (step === 5) {
      if (!selectedTimeSlot) {
        const msg = "Please select an available desk time slot.";
        setErrorMsg(msg);
        toast.error(msg, { duration: 5000 });
        return;
      }
      setStep(6);
    } else if (step === 6) {
      if (!citizenName.trim() || !citizenPhone.trim()) {
        const msg = "Full name and verified phone number are mandatory.";
        setErrorMsg(msg);
        toast.error(msg, { duration: 5000 });
        return;
      }
      setStep(7);
    } else if (step === 7) {
      if (!agreementChecked) {
        const msg = "Please confirm that all supplied information and requirements are accurate.";
        setErrorMsg(msg);
        toast.error(msg, { duration: 5000 });
        return;
      }
      handleSubmitBooking();
    }
  };

  const handleSubmitBooking = () => {
    const newApt = bookAppointment({
      citizenName,
      citizenPhone,
      citizenNotes,
      departmentId: selectedDepartment.id,
      departmentName: selectedDepartment.name,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
    });

    setSubmittedAppointment(newApt);
    toast.success("Appointment successfully scheduled!", { duration: 5000 });
    setStep(8); // Confirmation slip step
  };

  const stepLabels = [
    "Department",
    "Service",
    "Requirements",
    "Date",
    "Time Slot",
    "Citizen Info",
    "Review",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* Page Heading */}
        <div className="text-center mb-8">
          <span className="text-[11px] uppercase tracking-widest font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            FDRE Woreda Municipal Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            Schedule an Official Appointment
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Complete the steps below to reserve your desk slot and obtain an authenticated appointment slip.
          </p>
        </div>

        {/* Step Progress Indicators (Steps 1 to 7) */}
        {step <= 7 && (
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 w-full -z-0" />
              {stepLabels.map((label, index) => {
                const stepNum = index + 1;
                const isCompleted = step > stepNum;
                const isCurrent = step === stepNum;
                return (
                  <div key={label} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCompleted
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                          ? "bg-[#0b2545] text-amber-300 ring-4 ring-blue-100"
                          : "bg-white text-slate-400 border border-slate-300"
                      }`}
                    >
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : stepNum}
                    </div>
                    <span
                      className={`text-[10px] mt-1.5 hidden sm:block font-medium ${
                        isCurrent ? "text-slate-900 font-bold" : "text-slate-400"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step Cards Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {/* STEP 1: SELECT DEPARTMENT */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">
                  Step 1: Select Woreda Government Department
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Choose the department offering the public service you require.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {departments.map((dept) => {
                  const isSelected = selectedDeptId === dept.id;
                  return (
                    <div
                      key={dept.id}
                      onClick={() => {
                        setSelectedDeptId(dept.id);
                        setSelectedServiceId("");
                      }}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-700 bg-blue-50/50 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {dept.code}
                        </span>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-blue-700" />
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mb-1">{dept.name}</h3>
                      <p className="text-xs text-slate-500 line-clamp-2">{dept.description}</p>
                      <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{dept.buildingRoom}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: SELECT SERVICE */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">
                  Step 2: Select Government Service
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Department: <span className="font-semibold text-slate-800">{selectedDepartment?.name}</span>
              </p>

              {departmentServices.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No active services found for this department currently.
                </div>
              ) : (
                <div className="space-y-3">
                  {departmentServices.map((service) => {
                    const isSelected = selectedServiceId === service.id;
                    return (
                      <div
                        key={service.id}
                        onClick={() => setSelectedServiceId(service.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-blue-700 bg-blue-50/50 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{service.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                              {service.code}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{service.description}</p>
                          <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                            <span>Duration: {service.durationMinutes} mins</span>
                            <span>•</span>
                            <span>Fee: <strong className="text-emerald-700">{formatETB(service.feeETB)}</strong></span>
                          </div>
                        </div>

                        <div className="ml-4 shrink-0">
                          {isSelected ? (
                            <CheckCircle className="w-5 h-5 text-blue-700" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-slate-300" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: SERVICE REQUIREMENTS & DOCUMENTS */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Step 3: Review Required Documents & Instructions
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Please review the paperwork you must bring on the day of your appointment.
              </p>

              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 mb-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{selectedService?.name}</h3>
                    <p className="text-xs text-slate-500">{selectedDepartment?.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Statutory Fee</span>
                    <span className="font-bold text-emerald-700 text-sm">{formatETB(selectedService?.feeETB)}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Mandatory Original Documents
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700 pl-2">
                    {selectedService?.requiredDocuments?.map((doc, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
                  <p><strong>Estimated Processing Time:</strong> {selectedService?.processingDays || "Same day"}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-800">
                <p className="font-semibold">Important Citizen Advisory:</p>
                <p className="mt-1">
                  If any required document is missing or invalid on the day of your appointment, the officer cannot process your request and you will have to reschedule.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SELECT DATE */}
          {step === 4 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">
                  Step 4: Select Appointment Date
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Office working days are Monday through Friday (08:30 – 17:30). Weekends and official public holidays are blocked.
              </p>

              <div className="max-w-md mx-auto space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                    Choose Date:
                  </label>
                  <input
                    type="date"
                    min={minDateStr}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedTimeSlot(""); // Reset slot when date changes
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white shadow-xs"
                  />
                </div>

                {selectedDate && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-500 block mb-1">Selected Date:</span>
                    <p className="font-bold text-slate-900 text-sm">{formatDate(selectedDate)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: SELECT TIME SLOT */}
          {step === 5 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">
                  Step 5: Select Available Time Slot
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Date: <span className="font-semibold text-slate-800">{formatDate(selectedDate)}</span>
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableSlots.map((slot) => {
                  const isSelected = selectedTimeSlot === slot.time;
                  return (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => setSelectedTimeSlot(slot.time)}
                      className={`p-3 rounded-xl text-center border-2 transition-all ${
                        !slot.available
                          ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                          : isSelected
                          ? "border-blue-700 bg-blue-50 text-blue-900 font-bold shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                      }`}
                    >
                      <p className="text-xs font-bold">{slot.time}</p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {slot.available ? `${slot.remainingCapacity} slots left` : "Fully Booked"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: CITIZEN INFORMATION */}
          {step === 6 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">
                  Step 6: Enter Citizen Information
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Provide your accurate contact information so we can verify your booking and send notification alerts.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Legal Name (as on ID) *
                  </label>
                  <input
                    type="text"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    placeholder="e.g. Bekele Tadesse Wolde"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number (SMS Notifications) *
                  </label>
                  <input
                    type="tel"
                    value={citizenPhone}
                    onChange={(e) => setCitizenPhone(e.target.value)}
                    placeholder="+251 9XX XXX XXX"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Residential Kebele / House No.
                  </label>
                  <input
                    type="text"
                    value={citizenAddress}
                    onChange={(e) => setCitizenAddress(e.target.value)}
                    placeholder="e.g. Kebele 03, House 244"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Additional Notes or Specific Inquiries
                  </label>
                  <textarea
                    rows={3}
                    value={citizenNotes}
                    onChange={(e) => setCitizenNotes(e.target.value)}
                    placeholder="Any specific note regarding your case or urgency..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: REVIEW & CONFIRM */}
          {step === 7 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Step 7: Review Appointment Details & Submit
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-6">
                Please verify all entered parameters prior to final generation of your booking reference.
              </p>

              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 mb-6 text-xs">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-slate-400 block font-medium">Department</span>
                    <p className="font-bold text-slate-800">{selectedDepartment?.name}</p>
                    <p className="text-slate-500 text-[11px]">{selectedDepartment?.buildingRoom}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Government Service</span>
                    <p className="font-bold text-slate-800">{selectedService?.name}</p>
                    <p className="text-emerald-700 font-semibold text-[11px]">Fee: {formatETB(selectedService?.feeETB)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-slate-400 block font-medium">Appointment Date</span>
                    <p className="font-bold text-slate-800">{formatDate(selectedDate)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Time Slot</span>
                    <p className="font-bold text-blue-700">{selectedTimeSlot}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block font-medium">Applicant Name</span>
                    <p className="font-bold text-slate-800">{citizenName}</p>
                    <p className="text-slate-500 text-[11px]">{citizenAddress}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Contact Phone</span>
                    <p className="font-bold text-slate-800">{citizenPhone}</p>
                  </div>
                </div>
              </div>

              {/* Citizen Declaration Checkbox */}
              <label className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreementChecked}
                  onChange={(e) => setAgreementChecked(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-amber-900 leading-relaxed">
                  I solemnly declare that the information provided is correct, and I will bring all required original documents to the Woreda office 15 minutes before my scheduled time slot.
                </span>
              </label>
            </div>
          )}

          {/* STEP 8: CONFIRMATION & SLIP VIEW */}
          {step === 8 && submittedAppointment && (
            <div>
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Appointment Successfully Booked!
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Your reference number is generated below. You can print this slip or save it to present at the desk.
                </p>
              </div>

              {/* Official Printable Appointment Slip */}
              <AppointmentSlip
                appointment={submittedAppointment}
                service={selectedService}
              />

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/citizen/book"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0b2545] text-white text-xs font-semibold shadow hover:bg-[#133b5c]"
                >
                  <CalendarIcon className="w-4 h-4 text-amber-300" />
                  <span>View in Citizen Portal</span>
                </Link>

                <Link
                  href={`/track?ref=${submittedAppointment.referenceNumber}`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800"
                >
                  <span>Track Status Realtime</span>
                </Link>

                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedDeptId("");
                    setSelectedServiceId("");
                    setSelectedDate("");
                    setSelectedTimeSlot("");
                    setSubmittedAppointment(null);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  Book Another Appointment
                </button>
              </div>
            </div>
          )}

          {/* Navigation Buttons (Back / Next) */}
          {step <= 7 && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg("");
                    setStep(step - 1);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow-sm transition-all"
              >
                <span>{step === 7 ? "Confirm & Book" : "Continue"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function BookAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading Booking System...</p>
          </div>
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}
