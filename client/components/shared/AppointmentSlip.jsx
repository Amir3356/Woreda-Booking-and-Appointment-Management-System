"use client";

import { Printer, Download, CheckCircle, Clock, MapPin, FileText, QrCode, Building, AlertCircle } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { formatDate, formatETB } from "@/lib/utils";

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
              <p className="font-mono text-2xl font-black text-emerald-300">
                {appointment.tokenNumber}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Slip Body */}
      <div className="p-6 space-y-6">
        {/* Date, Time & Location Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">Date & Time</p>
              <p className="text-xs font-bold text-slate-800">{formatDate(appointment.date)}</p>
              <p className="text-xs text-blue-700 font-semibold">{appointment.timeSlot}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Building className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">Department</p>
              <p className="text-xs font-bold text-slate-800">{appointment.departmentName}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase">Service Desk</p>
              <p className="text-xs font-bold text-slate-800">Room 102, Bldg A</p>
              <p className="text-[11px] text-slate-500">Counter Desk #1</p>
            </div>
          </div>
        </div>

        {/* Citizen & Service Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5 mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" />
              Citizen Information
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-semibold text-slate-800">{appointment.citizenName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone Number:</span>
                <span className="font-medium text-slate-800">{appointment.citizenPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-medium text-slate-800">{appointment.citizenEmail || "N/A"}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-1.5 mb-3 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Requested Public Service
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-semibold text-slate-800 text-right">{appointment.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Government Fee:</span>
                <span className="font-bold text-emerald-700">{formatETB(service?.feeETB || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Duration:</span>
                <span className="font-medium text-slate-800">{service?.durationMinutes || 30} minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Required Documents Checklist */}
        {service?.requiredDocuments && service.requiredDocuments.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Mandatory Documents to Bring on Appointment Day
            </h4>
            <ul className="text-xs text-amber-800 space-y-1 pl-4 list-disc">
              {service.requiredDocuments.map((doc, idx) => (
                <li key={idx}>{doc}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Verification Barcode / Token Visual */}
        <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-[11px] text-slate-500">
              Please present this confirmation slip or digital reference code at the security / entrance reception desk upon arrival.
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Arrival 15 minutes before your scheduled slot is advised.
            </p>
          </div>

          <div className="p-2 border border-slate-300 rounded-lg bg-slate-50 shrink-0 text-center">
            <QrCode className="w-14 h-14 text-slate-800 mx-auto" />
            <span className="text-[9px] text-slate-400 font-mono block mt-1">SCAN AT DESK</span>
          </div>
        </div>
      </div>

      {/* Slip Footer Action Bar (hidden when printing) */}
      <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between no-print">
        <p className="text-[11px] text-slate-500">
          Created: {new Date(appointment.createdAt).toLocaleDateString()}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print Slip
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

