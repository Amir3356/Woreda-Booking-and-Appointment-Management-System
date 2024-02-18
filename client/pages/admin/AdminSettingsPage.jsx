import { useState } from "react";
import { Settings, Save, CheckCircle2, Shield, BellRing, Database } from "lucide-react";

export default function AdminSettingsPage() {
  const [woredaName, setWoredaName] = useState("Woreda 03 Public Administration");
  const [cityRegion, setCityRegion] = useState("Addis Ababa City Administration");
  const [hotline, setHotline] = useState("9840");
  const [emergencyPhone, setEmergencyPhone] = useState("+251 11 551 0000");
  const [smsGatewayActive, setSmsGatewayActive] = useState(true);
  const [autoApproveBookings, setAutoApproveBookings] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900">System & Woreda Settings</h2>
        <p className="text-xs text-slate-500">
          Configure administrative headers, hotline contact details, and automated notification triggers.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>System configurations saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Office Identity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-700" />
            Woreda Municipal Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Woreda Title</label>
              <input
                type="text"
                value={woredaName}
                onChange={(e) => setWoredaName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Region / Subcity</label>
              <input
                type="text"
                value={cityRegion}
                onChange={(e) => setCityRegion(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Public Citizen Hotline</label>
              <input
                type="text"
                value={hotline}
                onChange={(e) => setHotline(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Central Reception Desk Phone</label>
              <input
                type="text"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Automation & Policy Toggles */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <BellRing className="w-4 h-4 text-purple-700" />
            Notification & Approval Policies
          </h3>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">SMS Notification Dispatch</p>
                <p className="text-[11px] text-slate-500">
                  Transmit automated SMS booking references and arrival reminders to citizen mobile phones.
                </p>
              </div>
              <input
                type="checkbox"
                checked={smsGatewayActive}
                onChange={(e) => setSmsGatewayActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Automatic Appointment Confirmation</p>
                <p className="text-[11px] text-slate-500">
                  Auto-confirm requests when capacity is available without requiring manual officer review.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoApproveBookings}
                onChange={(e) => setAutoApproveBookings(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

