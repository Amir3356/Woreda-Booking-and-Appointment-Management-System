// Officer > Department Schedule: a read-only view of the officer's own department as configured
// by the administrator in Schedule Management (working hours, daily capacity, availability and
// calendar exceptions). Nothing here can be changed; the server also scopes it to the department.
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { scheduleApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { useStore } from "@/context";
import { addDays, describeError, formatWorkingDays, localIsoDate } from "@/utils";
import {
  CalendarLegend, CalendarToolbar, EXCEPTION_TYPES, ScheduleCalendar, monthRange, rangeLabel, useCalendarData, weekRange,
} from "@/features/schedule";

export default function OfficerSchedulePage() {
  const departmentName = useStore((s) => s.currentUser?.departmentName || "your department");
  const today = localIsoDate();
  const [anchor, setAnchor] = useState(today);
  const [view, setView] = useState("month");
  const [info, setInfo] = useState({ schedules: [], capacity: null, exceptions: [], error: null });

  const range = view === "week" ? weekRange(anchor) : monthRange(anchor);
  // The server limits an officer to their own department.
  const { data, error } = useCalendarData({ from: range.from, to: range.to, departmentId: "ALL" });

  useEffect(() => {
    const load = async () => {
      try {
        const [sch, caps, exc] = await Promise.all([
          scheduleApi.list(),
          scheduleApi.capacities(),
          scheduleApi.exceptions({ from: today, to: addDays(today, 180) }),
        ]);
        setInfo({
          schedules: (sch.data || []).filter((s) => s.status === "Active" && (!s.effectiveEndDate || s.effectiveEndDate >= today)),
          capacity: caps.data?.[0]?.dailyCapacity ?? null,
          exceptions: exc.data || [],
          error: null,
        });
      } catch (err) {
        setInfo((i) => ({ ...i, error: err }));
      }
    };
    load();
    const offs = [subscribe("catalog.changed", load), subscribe("reconnected", load)];
    return () => offs.forEach((off) => off());
  }, [today]);

  const failure = error || info.error;

  return (
    <div className="sm-page">
      <header className="sm-header">
        <div>
          <p className="sm-eyebrow">{departmentName}</p>
          <h1 className="sm-title">
            Department Schedule
            <span className="sm-readonly-tag">
              <Lock className="w-3 h-3" aria-hidden="true" /> Read-only
            </span>
          </h1>
          <p className="sm-subtitle">
            Working hours, daily capacity, availability and calendar exceptions for your department. Only the Woreda
            administrator can change them; contact the administrator if something needs updating.
          </p>
        </div>
      </header>

      {failure && (
        <div className="sm-notice">
          <Lock aria-hidden="true" />
          <span>{describeError(failure, "load your department's schedule")}</span>
        </div>
      )}

      <div className="sm-stats">
        <div className="sm-stat">
          <div className="sm-stat-label">Daily capacity</div>
          <div className="sm-stat-value">{info.capacity ?? "—"}</div>
          <div className="sm-stat-hint">{info.capacity ? "Appointments per day, all services" : "No department-wide limit"}</div>
        </div>
        <div className="sm-stat">
          <div className="sm-stat-label">Active schedules</div>
          <div className="sm-stat-value">{info.schedules.length}</div>
          <div className="sm-stat-hint">Current and upcoming</div>
        </div>
        <div className="sm-stat">
          <div className="sm-stat-label">Upcoming exceptions</div>
          <div className="sm-stat-value">{info.exceptions.length}</div>
          <div className="sm-stat-hint">Next 6 months</div>
        </div>
      </div>

      <CalendarToolbar anchor={anchor} view={view} onAnchor={setAnchor} onView={setView} />

      <div className="sm-split">
        <section className="sm-card" aria-label="Department calendar">
          <div className="sm-card-header">
            <CalendarLegend />
          </div>
          <ScheduleCalendar view={view} data={data} month={range.month} />
        </section>

        <aside className="sm-panel">
          <section className="sm-card" aria-label="Working hours">
            <div className="sm-card-header">
              <h2 className="sm-card-title">Working hours</h2>
            </div>
            <div className="sm-card-body sm-detail-list">
              {info.schedules.length === 0 && <p className="sm-hint">No working hours are configured for your department.</p>}
              {info.schedules.map((s) => (
                <div key={s.id} className="sm-detail-item">
                  <div>
                    <b>{s.service || "All services"}</b>
                    {formatWorkingDays(s.workingDays)} · {s.openingTime}–{s.closingTime}
                    <div className="sm-hint">
                      {s.dailyCapacity} per service per day
                      {s.effectiveStartDate > today ? ` · from ${rangeLabel(s.effectiveStartDate)}` : ""}
                      {s.effectiveEndDate ? ` · until ${rangeLabel(s.effectiveEndDate)}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="sm-card" aria-label="Upcoming exceptions">
            <div className="sm-card-header">
              <h2 className="sm-card-title">Upcoming exceptions</h2>
            </div>
            <div className="sm-card-body sm-detail-list">
              {info.exceptions.length === 0 && <p className="sm-hint">No holidays or exceptional days in the next 6 months.</p>}
              {info.exceptions.map((e) => (
                <div key={e.id} className="sm-detail-item">
                  <div>
                    {(e.title || e.description) && (
                      <b>{e.title && e.description ? `${e.title} — ${e.description}` : e.description || e.title}</b>
                    )}
                    {rangeLabel(e.startDate, e.endDate)}
                    {e.type === "WORKING_DAY" && (
                      <div className="sm-hint">
                        {e.openingTime}–{e.closingTime} · {e.dailyCapacity} appointments
                      </div>
                    )}
                  </div>
                  <span className={`sm-pill ${EXCEPTION_TYPES[e.type].tone}`}>{EXCEPTION_TYPES[e.type].short}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
