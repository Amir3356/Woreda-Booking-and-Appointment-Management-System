import { useState } from "react";
import { useStore } from "@/context";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Search,
  CheckCircle2,
  Printer,
  Layers,
} from "lucide-react";
import { formatDate } from "@/utils";

export default function OfficerVerifyPage() {
  const { appointments, services, updateAppointmentStatus } = useStore();
  const [refQuery, setRefQuery] = useState("");
  const [foundApt, setFoundApt] = useState(null);
  const [checkedDocs, setCheckedDocs] = useState({});
  const [checkInDone, setCheckInDone] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    setCheckInDone(false);
    const found = appointments.find(
      (a) => a.referenceNumber.toLowerCase() === refQuery.trim().toLowerCase()
    );
    setFoundApt(found || null);
    if (found) {
      setCheckedDocs({});
    }
  };

  const service = foundApt ? services.find((s) => s.id === foundApt.serviceId) : null;

  const toggleDoc = (docIndex) => {
    setCheckedDocs({
      ...checkedDocs,
      [docIndex]: !checkedDocs[docIndex],
    });
  };

  const handleCheckInCitizen = () => {
    if (!foundApt) return;
    updateAppointmentStatus(foundApt.id, "CHECKED_IN", "Citizen verified at reception desk");

    // The store automatically creates the queue entry and assigns a token number!
    const updated = useStore.getState().appointments.find((a) => a.id === foundApt.id);
    setGeneratedToken(updated?.tokenNumber || "KBL-03");
    setFoundApt(updated);
    setCheckInDone(true);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Citizen Check-in & Verification</h2>
        <p className="text-xs text-slate-500">
          Verify citizen documents upon arrival, mark as checked in, and issue a digital queue token.
        </p>
      </div>

      {/* Search by Reference Number / QR input */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={refQuery}
              onChange={(e) => setRefQuery(e.target.value)}
              placeholder="Enter Reference # (e.g. WRD-20261101-001)"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white font-bold text-xs sm:text-sm transition-colors"
          >
            Verify Appointment
          </button>
        </form>
      </div>

      {/* Appointment Result & Checklist */}
      {foundApt && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Reference Number</span>
              <h3 className="font-mono text-xl font-black text-[#0b2545]">
                {foundApt.referenceNumber}
              </h3>
            </div>
            <StatusBadge status={foundApt.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Citizen Full Name</span>
              <p className="font-bold text-slate-900 text-sm">{foundApt.citizenName}</p>
              <p className="text-slate-500 mt-0.5">{foundApt.citizenPhone}</p>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Requested Service</span>
              <p className="font-bold text-slate-900 text-sm">{foundApt.serviceName}</p>
              <p className="text-blue-700 font-semibold mt-0.5">
                {formatDate(foundApt.date)} at {foundApt.timeSlot}
              </p>
            </div>
          </div>

          {/* Document Verification Checklist */}
          {service?.requiredDocuments && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Mandatory Documents Physical Verification
              </h4>
              <p className="text-[11px] text-slate-500 mb-3">
                Check off each physical document presented by the citizen before admitting into the lobby queue.
              </p>

              {service.requiredDocuments.map((doc, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={!!checkedDocs[idx]}
                    onChange={() => toggleDoc(idx)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className={checkedDocs[idx] ? "line-through text-slate-400" : "font-medium text-slate-800"}>
                    {doc}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Check-In / Token Issued State */}
          {checkInDone || foundApt.status === "CHECKED_IN" ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <span className="text-xs uppercase font-bold text-emerald-800 block">
                Citizen Checked-In Successfully
              </span>
              <p className="text-xs text-emerald-700 mt-0.5">
                Queue token issued and citizen added to the department waiting list.
              </p>

              <div className="my-4 inline-block p-4 rounded-2xl bg-white border border-emerald-300 shadow-xs">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Issued Queue Token
                </span>
                <span className="font-mono text-4xl font-black text-emerald-700">
                  {foundApt.tokenNumber || generatedToken}
                </span>
              </div>

              <div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Citizen Token Slip</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Confirm documents to generate queue token.
              </p>
              <button
                onClick={handleCheckInCitizen}
                className="px-6 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-colors flex items-center gap-2"
              >
                <Layers className="w-4 h-4 text-amber-300" />
                <span>Admit Citizen & Issue Token</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

