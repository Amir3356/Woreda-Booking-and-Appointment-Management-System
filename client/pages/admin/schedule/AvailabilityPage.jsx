// Admin > Schedule Management > Appointment Availability: a month / week calendar of which dates
// citizens can book, per department, and the switch that disables or re-enables online booking
// for a date or a date range. The backend refuses bookings on disabled dates.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarCheck, CalendarRange, CheckCircle2, Info } from "lucide-react";
import { useStore } from "@/context";
import { scheduleApi } from "@/api";
import { describeError, localIsoDate } from "@/utils";
import {
  CalendarLegend, CalendarToolbar, ConfirmDialog, DepartmentFilter, ScheduleCalendar, entryLabel, entryTone, isOpen,
  monthRange, orderedRange, rangeLabel, daysBetween, useCalendarData, weekRange,
} from "@/features/schedule";

export default function AvailabilityPage() {
  const departments = useStore((s) => s.departments) || [];
  const loadDepartments = useStore((s) => s.loadDepartments);
  useEffect(() => {
    loadDepartments().catch(() => {});
  }, [loadDepartments]);

  const today = localIsoDate();
  const [anchor, setAnchor] = useState(today);
  const [view, setView] = useState("month");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [selection, setSelection] = useState({ start: today, end: today });
  const [clickAnchor, setClickAnchor] = useState(today);
  const [target, setTarget] = useState("ALL");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(null); // { enabled }
  const [busy, setBusy] = useState(false);

  const range = view === "week" ? weekRange(anchor) : monthRange(anchor);
  const { data, loading, error, reload } = useCalendarData({ from: range.from, to: range.to, departmentId: deptFilter });

  useEffect(() => setTarget(deptFilter), [deptFilter]);

  const onSelect = (date, ev, deptId) => {
    if (ev.shiftKey && clickAnchor) {
      setSelection(orderedRange(clickAnchor, date));
    } else {
      setSelection({ start: date, end: date });
      setClickAnchor(date);
    }
    if (deptId) setTarget(deptId);
  };

  const scopeEntries = (d) => (target === "ALL" ? d.entries : d.entries.filter((e) => e.departmentId === target));

  // Visible-period summary (today onward for bookable / unavailable).
  const stats = useMemo(() => {
    const s = { bookable: 0, unavailable: 0, exceptional: 0, booked: 0, disabled: 0 };
    for (const d of data?.days || []) {
      if (view === "month" && d.date.slice(0, 7) !== range.month) continue;
      const entries = deptFilter === "ALL" ? d.entries : d.entries.filter((e) => e.departmentId === deptFilter);
      s.booked += entries.reduce((n, e) => n + e.booked, 0);
      if (entries.some((e) => e.status === "EXCEPTIONAL")) s.exceptional += 1;
      if (d.past) continue;
      if (entries.some(isOpen)) s.bookable += 1;
      else s.unavailable += 1;
      if (entries.some((e) => e.bookingDisabled)) s.disabled += 1;
    }
    return s;
  }, [data, view, range.month, deptFilter]);

  // What the selection covers, for the days currently loaded.
  const selected = useMemo(() => {
    const days = (data?.days || []).filter((d) => d.date >= selection.start && d.date <= selection.end);
    const entries = days.flatMap(scopeEntries);
    return {
      days,
      disabled: entries.filter((e) => e.bookingDisabled).length,
      closedOther: entries.filter((e) => !e.bookingDisabled && e.status === "UNAVAILABLE").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selection, target]);

  const targetName = target === "ALL" ? "all departments" : departments.find((d) => d.id === target)?.name || "the department";
  const span = daysBetween(selection.start, selection.end);
  const selectionInPast = selection.end < today;
  const singleDay = selection.start === selection.end ? (data?.days || []).find((d) => d.date === selection.start) : null;

  const apply = async () => {
    const enabled = confirm.enabled;
    const departmentIds = target === "ALL" ? departments.map((d) => d.id) : [target];
    if (departmentIds.length === 0) return;
    setBusy(true);
    try {
      const { data: res } = await scheduleApi.setDateAvailability({
        departmentIds,
        startDate: selection.start,
        endDate: selection.end,
        enabled,
        reason: enabled ? null : reason || null,
      });
      toast.success(
        enabled
          ? `Online booking re-enabled for ${targetName} on ${rangeLabel(selection.start, selection.end)}${res.changed === 0 ? " (it was not disabled)" : ""}.`
          : `Online booking disabled for ${targetName} on ${rangeLabel(selection.start, selection.end)}.`,
        { duration: 5000 },
      );
      setConfirm(null);
      setReason("");
      reload();
    } catch (err) {
      toast.error(describeError(err, enabled ? "enable booking" : "disable booking"), { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sm-page">
      <header className="sm-header">
        <div>
          <p className="sm-eyebrow">Schedule Management</p>
          <h1 className="sm-title">Appointment Availability</h1>
          <p className="sm-subtitle">
            See which dates citizens can book for each department and switch online booking off or on for specific dates.
            Click a day to select it; Shift-click another day to select a range.
          </p>
        </div>
      </header>

      <div className="sm-stats">
        <div className="sm-stat">
          <div className="sm-stat-label">Bookable days left</div>
          <div className="sm-stat-value" style={{ color: "#059669" }}>{stats.bookable}</div>
          <div className="sm-stat-hint">{view === "month" ? "In this month, from today" : "In this week, from today"}</div>
        </div>
        <div className="sm-stat">
          <div className="sm-stat-label">Unavailable days</div>
          <div className="sm-stat-value">{stats.unavailable}</div>
          <div className="sm-stat-hint">{stats.disabled} with booking disabled</div>
        </div>
        <div className="sm-stat">
          <div className="sm-stat-label">Exceptional working days</div>
          <div className="sm-stat-value" style={{ color: "#7c3aed" }}>{stats.exceptional}</div>
          <div className="sm-stat-hint">Configured in Calendar Exceptions</div>
        </div>
        <div className="sm-stat">
          <div className="sm-stat-label">Booked appointments</div>
          <div className="sm-stat-value">{stats.booked}</div>
          <div className="sm-stat-hint">In the visible period</div>
        </div>
      </div>

      <CalendarToolbar anchor={anchor} view={view} onAnchor={setAnchor} onView={setView}>
        <DepartmentFilter departments={departments} value={deptFilter} onChange={setDeptFilter} />
      </CalendarToolbar>

      <div className="sm-split">
        <section className="sm-card" aria-label="Availability calendar">
          <div className="sm-card-header">
            <CalendarLegend showMixed={deptFilter === "ALL" && view === "month"} />
            {loading && <span className="sm-hint">Updating…</span>}
          </div>
          {error ? (
            <div className="sm-empty">
              <strong>Could not load the calendar</strong>
              {describeError(error, "load the calendar")}
              <div style={{ marginTop: "0.75rem" }}>
                <button type="button" className="sm-btn" onClick={reload}>Try again</button>
              </div>
            </div>
          ) : (
            <ScheduleCalendar view={view} data={data} month={range.month} departmentId={deptFilter} selection={selection} onSelect={onSelect} />
          )}
        </section>

        <aside className="sm-panel" aria-label="Selected dates">
          <section className="sm-card">
            <div className="sm-card-header">
              <div>
                <h2 className="sm-card-title">
                  <CalendarRange className="w-4 h-4" aria-hidden="true" style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                  Selected dates
                </h2>
                <p className="sm-card-sub">
                  {rangeLabel(selection.start, selection.end)} · {span} day{span === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="sm-card-body" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div className="sm-row">
                <label className="sm-field">
                  <span className="sm-label">From</span>
                  <input
                    type="date"
                    className="sm-input"
                    value={selection.start}
                    onChange={(e) => e.target.value && setSelection((s) => orderedRange(e.target.value, s.end))}
                  />
                </label>
                <label className="sm-field">
                  <span className="sm-label">To</span>
                  <input
                    type="date"
                    className="sm-input"
                    value={selection.end}
                    min={selection.start}
                    onChange={(e) => e.target.value && setSelection((s) => orderedRange(s.start, e.target.value))}
                  />
                </label>
              </div>
              <label className="sm-field">
                <span className="sm-label">Applies to</span>
                <select className="sm-select" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="ALL">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="sm-field">
                <span className="sm-label">Reason (shown to staff)</span>
                <input
                  type="text"
                  className="sm-input"
                  maxLength={200}
                  placeholder="e.g. Staff training, system maintenance"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>

              {selected.closedOther > 0 && (
                <div className="sm-notice sm-notice--info">
                  <Info aria-hidden="true" />
                  <span>
                    Some selected days are closed by a holiday, blocked date or the weekly operating hours. Re-enabling booking
                    does not open those — change them in Calendar Exceptions or Operating Hours.
                  </span>
                </div>
              )}
              {selectionInPast && <p className="sm-error">The selected dates are in the past.</p>}

              <div className="sm-row">
                <button
                  type="button"
                  className="sm-btn sm-btn--danger"
                  disabled={selectionInPast || departments.length === 0}
                  onClick={() => setConfirm({ enabled: false })}
                >
                  <Ban aria-hidden="true" /> Disable booking
                </button>
                <button
                  type="button"
                  className="sm-btn sm-btn--success"
                  disabled={selectionInPast || departments.length === 0}
                  onClick={() => setConfirm({ enabled: true })}
                >
                  <CalendarCheck aria-hidden="true" /> Enable booking
                </button>
              </div>
            </div>
          </section>

          {singleDay && (
            <section className="sm-card" aria-label="Day details">
              <div className="sm-card-header">
                <div>
                  <h2 className="sm-card-title">{rangeLabel(singleDay.date)}</h2>
                  <p className="sm-card-sub">Status by department</p>
                </div>
              </div>
              <div className="sm-card-body sm-detail-list">
                {singleDay.entries.map((e) => {
                  const name = data.departments.find((d) => d.id === e.departmentId)?.name || e.departmentId;
                  return (
                    <div key={e.departmentId} className="sm-detail-item">
                      <div>
                        <b>{name}</b>
                        {e.openingTime && e.status !== "UNAVAILABLE" ? `${e.openingTime}–${e.closingTime} · ` : ""}
                        {e.booked} booked{e.capacity ? ` of ${e.capacity}` : ""}
                        {e.note && <div className="sm-hint">{e.note}</div>}
                      </div>
                      <span className={`sm-pill ${entryTone(e)}`}>{entryLabel(e)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.enabled ? "Enable online booking?" : "Disable online booking?"}
          tone={confirm.enabled ? "success" : "danger"}
          confirmLabel={confirm.enabled ? "Enable booking" : "Disable booking"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={apply}
          impact={confirm.enabled ? null : {
            from: selection.start < today ? today : selection.start,
            to: selection.end,
            departmentIds: target === "ALL" ? [] : [target],
          }}
          message={
            confirm.enabled ? (
              <>
                Citizens will be able to book <strong>{targetName}</strong> again on{" "}
                <strong>{rangeLabel(selection.start, selection.end)}</strong>, where the operating hours and calendar exceptions allow it.
              </>
            ) : (
              <>
                Citizens will not be able to book <strong>{targetName}</strong> on{" "}
                <strong>{rangeLabel(selection.start, selection.end)}</strong>
                {reason ? <> (reason: {reason})</> : null}.
              </>
            )
          }
        >
          {!confirm.enabled && selected.disabled > 0 && (
            <p className="sm-hint">Some of these dates are already disabled; their reason will be updated.</p>
          )}
          {confirm.enabled && (
            <p className="sm-hint" style={{ display: "flex", gap: 6 }}>
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Existing appointments are not affected.
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
