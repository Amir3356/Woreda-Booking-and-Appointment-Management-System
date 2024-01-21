"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Clock, Calendar, CheckCircle2, AlertCircle, Plus, Trash2 } from "lucide-react";

export default function AdminSchedulePage() {
  const { scheduleConfigs, updateScheduleConfigs } = useStore();

  const [workingDays, setWorkingDays] = useState(scheduleConfigs.workingDays || []);
  const [startTime, setStartTime] = useState(scheduleConfigs.officeHours?.start || "08:30");
  const [endTime, setEndTime] = useState(scheduleConfigs.officeHours?.end || "17:30");
  const [lunchStart, setLunchStart] = useState(scheduleConfigs.lunchBreak?.start || "12:30");
  const [lunchEnd, setLunchEnd] = useState(scheduleConfigs.lunchBreak?.end || "13:30");
  const [slotInterval, setSlotInterval] = useState(scheduleConfigs.slotIntervalMinutes || 30);
  const [maxParallelSlots, setMaxParallelSlots] = useState(scheduleConfigs.maxParallelSlots || 3);
  const [advanceDays, setAdvanceDays] = useState(scheduleConfigs.advanceBookingDays || 14);

  const [holidays, setHolidays] = useState(scheduleConfigs.publicHolidays || []);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  const [saved, setSaved] = useState(false);

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const toggleDay = (day) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName) return;
    setHolidays([...holidays, { date: newHolidayDate, name: newHolidayName }]);
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const handleRemoveHoliday = (idx) => {
    setHolidays(holidays.filter((_, i) => i !== idx));
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateScheduleConfigs({
      workingDays,
      officeHours: { start: startTime, end: endTime },
      lunchBreak: { start: lunchStart, end: lunchEnd },
      slotIntervalMinutes: parseInt(slotInterval),
      maxParallelSlots: parseInt(maxParallelSlots),
      advanceBookingDays: parseInt(advanceDays),
      publicHolidays: holidays,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Schedule Management</h2>
        <p className="text-xs text-slate-500">
          Define official municipal operating days, desk opening hours, time slot intervals, and public holiday blackout dates.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Schedule parameters successfully updated across all Woreda departments!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Working Days */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-700" />
            Official Working Days
          </h3>
          <p className="text-xs text-slate-500">
            Selected days will be available for citizen appointment bookings. Unselected days are automatically blocked.
          </p>

          <div className="flex flex-wrap gap-2">
            {daysOfWeek.map((day) => {
              const active = workingDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    active
                      ? "bg-[#0b2545] text-white border-[#0b2545] shadow-xs"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Operating Hours & Intervals */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Office Operating Hours & Slot Limits
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Morning Opening Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Evening Closing Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Lunch Break Begins (Closed)</label>
              <input
                type="time"
                value={lunchStart}
                onChange={(e) => setLunchStart(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Lunch Break Ends (Reopens)</label>
              <input
                type="time"
                value={lunchEnd}
                onChange={(e) => setLunchEnd(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Slot Interval (Minutes)</label>
              <select
                value={slotInterval}
                onChange={(e) => setSlotInterval(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="15">15 Minutes</option>
                <option value="20">20 Minutes</option>
                <option value="30">30 Minutes (Recommended)</option>
                <option value="45">45 Minutes</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Max Parallel Bookings per Slot
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxParallelSlots}
                onChange={(e) => setMaxParallelSlots(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Public Holidays & Office Closures */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Public Holidays & Office Closures
          </h3>
          <p className="text-xs text-slate-500">
            Dates listed here will be blocked on the citizen booking calendar.
          </p>

          <div className="space-y-2">
            {holidays.map((h, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{h.name}</span>
                  <span className="text-slate-500 ml-2">({h.date})</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveHoliday(idx)}
                  className="text-rose-500 hover:text-rose-700 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-xs"
            />
            <input
              type="text"
              placeholder="Holiday or event title..."
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-xs"
            />
            <button
              type="button"
              onClick={handleAddHoliday}
              className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg shrink-0"
            >
              Add Holiday
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow"
          >
            Save All Schedule Configurations
          </button>
        </div>
      </form>
    </div>
  );
}

