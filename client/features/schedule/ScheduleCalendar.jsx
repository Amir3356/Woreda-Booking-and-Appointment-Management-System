// Month and week calendars of department availability (data: GET /schedules/calendar).
// Month: one cell per day, for one department or summarised over all of them.
// Week: one row per department, one cell per day, with hours and booked / capacity.
import { Ban } from "lucide-react";
import { localIsoDate } from "@/utils";
import { WEEKDAYS, entryLabel, entryTone, inRange, summarizeDay } from "./calendarModel";

function Meter({ booked, capacity }) {
  if (!capacity) return null;
  const pct = Math.min(100, Math.round((booked / capacity) * 100));
  const cls = pct >= 100 ? " is-full" : pct >= 80 ? " is-warn" : "";
  return (
    <div className={`sm-meter${cls}`} role="img" aria-label={`${booked} of ${capacity} booked`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CalendarLegend({ showMixed = false }) {
  const items = [
    ["is-available", "Available"],
    ["is-exceptional", "Exceptional working day"],
    ["is-full", "Fully booked"],
    ["is-holiday", "Holiday, blocked or booking disabled"],
    ["is-unavailable", "Closed (no operating hours)"],
  ];
  if (showMixed) items.push(["is-mixed", "Differs by department"]);
  return (
    <div className="sm-legend" aria-label="Calendar legend">
      {items.map(([tone, label]) => (
        <span key={tone} className={`sm-legend-item ${tone}`}>
          <span className="sm-swatch" aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

/** Content of a month cell for the visible department(s). */
function DayContent({ entries }) {
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    const e = entries[0];
    const open = e.status !== "UNAVAILABLE";
    return (
      <div className="sm-day-meta">
        <span className="sm-day-note">{e.status === "UNAVAILABLE" && e.note ? e.note : entryLabel(e)}</span>
        {open && e.openingTime && (
          <span>
            {e.openingTime}–{e.closingTime}
          </span>
        )}
        {(open || e.booked > 0) && (
          <span>
            {e.booked} booked{e.capacity ? ` / ${e.capacity}` : ""}
          </span>
        )}
        {open && <Meter booked={e.booked} capacity={e.capacity} />}
      </div>
    );
  }
  const s = summarizeDay(entries);
  return (
    <div className="sm-day-meta">
      <span className="sm-day-note">{s.notes[0] || `${s.open} of ${s.total} open`}</span>
      {s.notes[0] && <span>{`${s.open} of ${s.total} open`}</span>}
      <span>
        {s.booked} booked{s.capacity ? ` / ${s.capacity}` : ""}
      </span>
      {s.open > 0 && <Meter booked={s.booked} capacity={s.capacity} />}
    </div>
  );
}

/**
 * props:
 *   view "month" | "week", data (calendar response), month "YYYY-MM" (outside days are dimmed),
 *   departmentId "ALL" | id, selection { start, end } | null,
 *   onSelect(date, event, departmentId) — omitted for a read-only calendar.
 */
export default function ScheduleCalendar({ view = "month", data, month, departmentId = "ALL", selection = null, onSelect }) {
  const today = localIsoDate();
  const readOnly = !onSelect;
  if (!data) return <div className="sm-empty">Loading calendar…</div>;
  if (data.departments.length === 0) {
    return (
      <div className="sm-empty">
        <strong>No departments yet</strong>
        Add departments in Department Management to configure their schedules.
      </div>
    );
  }
  const visible = (entries) => (departmentId === "ALL" ? entries : entries.filter((e) => e.departmentId === departmentId));

  if (view === "week") {
    const depts = data.departments.filter((d) => departmentId === "ALL" || d.id === departmentId);
    return (
      <div className="sm-cal-scroll">
        <div className="sm-week" role="grid" aria-label="Week calendar">
          <div className="sm-week-row is-head" role="row">
            <div role="columnheader">Department</div>
            {data.days.map((d) => (
              <div key={d.date} role="columnheader" className={d.date === today ? "is-today" : ""}>
                {d.weekday} {Number(d.date.slice(8))}
              </div>
            ))}
          </div>
          {depts.map((dept) => (
            <div key={dept.id} className="sm-week-row" role="row">
              <div className="sm-week-dept" role="rowheader">{dept.name}</div>
              {data.days.map((d) => {
                const e = d.entries.find((x) => x.departmentId === dept.id);
                const open = e && e.status !== "UNAVAILABLE";
                const selected = inRange(d.date, selection);
                const Tag = readOnly ? "div" : "button";
                return (
                  <Tag
                    key={d.date}
                    role="gridcell"
                    type={readOnly ? undefined : "button"}
                    className={`sm-week-cell ${entryTone(e)}${selected ? " is-selected" : ""}${readOnly ? " is-readonly" : ""}`}
                    onClick={readOnly ? undefined : (ev) => onSelect(d.date, ev, dept.id)}
                    aria-label={`${dept.name}, ${d.date}: ${entryLabel(e)}`}
                    title={e?.note || entryLabel(e)}
                  >
                    <strong>{entryLabel(e)}</strong>
                    {open && e.openingTime && <span>{e.openingTime}–{e.closingTime}</span>}
                    {e && (open || e.booked > 0) && (
                      <span>
                        {e.booked} booked{e.capacity ? ` / ${e.capacity}` : ""}
                        {e.capacity ? ` · ${e.remaining} left` : ""}
                      </span>
                    )}
                    {!open && e?.note && <span>{e.note}</span>}
                    {open && <Meter booked={e.booked} capacity={e.capacity} />}
                  </Tag>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sm-cal-scroll">
      <div className="sm-cal" role="grid" aria-label="Month calendar">
        <div className="sm-cal-head" role="row">
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader">{d}</div>
          ))}
        </div>
        <div className="sm-cal-grid">
          {data.days.map((d) => {
            const entries = visible(d.entries);
            const tone = entries.length === 1 ? entryTone(entries[0]) : summarizeDay(entries).tone;
            const disabled = entries.some((e) => e.bookingDisabled);
            const cls = [
              "sm-day",
              tone,
              month && d.date.slice(0, 7) !== month ? "is-outside" : "",
              d.past ? "is-past" : "",
              d.date === today ? "is-today" : "",
              inRange(d.date, selection) ? "is-selected" : "",
              readOnly ? "is-readonly" : "",
            ].filter(Boolean).join(" ");
            const Tag = readOnly ? "div" : "button";
            return (
              <Tag
                key={d.date}
                type={readOnly ? undefined : "button"}
                role="gridcell"
                className={cls}
                onClick={readOnly ? undefined : (ev) => onSelect(d.date, ev, departmentId === "ALL" ? null : departmentId)}
                aria-selected={inRange(d.date, selection) || undefined}
                aria-label={`${d.date}: ${entries.length === 1 ? entryLabel(entries[0]) : `${summarizeDay(entries).open} of ${entries.length} departments open`}`}
              >
                <div className="sm-day-top">
                  <span className="sm-day-num">{Number(d.date.slice(8))}</span>
                  {disabled && (
                    <span className="sm-day-flag" title="Online booking disabled">
                      <Ban aria-hidden="true" />
                    </span>
                  )}
                </div>
                <DayContent entries={entries} />
              </Tag>
            );
          })}
        </div>
      </div>
    </div>
  );
}
