import { Printer, Clock, FileText, Building, AlertCircle } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate, formatETB } from "@/utils";

export default function AppointmentSlip({ appointment, service }) {
  if (!appointment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden max-w-2xl mx-auto my-6">
      {/* Top Header with National Emblem style */}
      <div className="bg-[#0b2545] text-white p-6 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">
                FDRE — Woreda Public Administration
              </p>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Official Appointment Confirmation Slip
              </h2>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-300 block">Status</span>
            <StatusBadge status={appointment.status} className="mt-1" />
          </div>
        </div>

        {/* Reference Highlight */}
        <div className="mt-5 p-3 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
              Booking Reference Number
            </span>
            <p className="font-mono text-xl font-extrabold tracking-wider text-amber-300">
              {appointment.referenceNumber}
            </p>
          </div>
          {appointment.tokenNumber && (
            <div className="text-right">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
                Queue Token
              </span>
              <p className="font-mono text-xl font-extrabold text-white">
                {appointment.tokenNumber}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Slip Body Content */}
      <div className="p-6 space-y-6 text-sm">
        {/* Key Appointment Details */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-6 border-b border-slate-200">
          <div>
            <span className="text-xs text-slate-500 block">Citizen Full Name</span>
            <span className="font-semibold text-slate-900">{appointment.citizenName}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Phone Number</span>
            <span className="font-mono text-slate-900">{appointment.citizenPhone}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">National / Kebele ID</span>
            <span className="font-mono text-slate-900">{appointment.citizenNationalId || "N/A"}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Service Requested</span>
            <span className="font-semibold text-slate-900">{appointment.serviceName}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Department</span>
            <span className="text-slate-900">{appointment.departmentName || "Public Administration"}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Service Fee</span>
            <span className="font-semibold text-slate-900">
              {appointment.serviceFee ? formatETB(appointment.serviceFee) : "Free"}
            </span>
          </div>
        </div>

        {/* Date & Time Highlights */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-amber-900 font-semibold uppercase tracking-wide">
                Appointment Schedule
              </p>
              <p className="text-base font-bold text-slate-950">
                {formatDate(appointment.date)} at {appointment.timeSlot}
              </p>
            </div>
          </div>
          {appointment.deskNumber && (
            <div className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-slate-900">
              Assigned: Desk #{appointment.deskNumber}
            </div>
          )}
        </div>

        {/* Required Documents Notice */}
        {service?.requiredDocs && service.requiredDocs.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Mandatory Documents to Bring</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
              {service.requiredDocs.map((doc, idx) => (
                <li key={idx}>{doc}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Officer Status / Note Notice */}
        {(appointment.rejectionReason || appointment.officerNotes) && (
          <div
            className={`rounded-xl p-3.5 border text-xs ${
              appointment.status === "REJECTED"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="font-bold mb-0.5">
              {appointment.status === "REJECTED" ? "Officer Rejection Reason:" : "Desk Officer Note:"}
            </div>
            <p>{appointment.rejectionReason || appointment.officerNotes}</p>
          </div>
        )}

        {/* Citizen Instructions */}
        <div className="text-xs text-slate-500 space-y-1.5 bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-300">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Important Service Day Instructions</span>
          </div>
          <p>• Please arrive 15 minutes before your scheduled appointment time.</p>
          <p>• Present this slip (printed or on your phone screen) along with your original Kebele ID.</p>
          <p>• If you miss your time slot, your booking will be marked as No-Show and rescheduled.</p>
        </div>
      </div>

      {/* Slip Footer Actions */}
      <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between no-print">
        <p className="text-[11px] text-slate-500 font-mono">
          Ref: {appointment.referenceNumber} • Issued by Woreda Public Portal
        </p>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Slip</span>
        </button>
      </div>
    </div>
  );
}
