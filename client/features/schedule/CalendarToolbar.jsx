// Shared toolbar of the schedule calendars: department filter, Month / Week, previous / today / next.
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { localIsoDate } from "@/utils";
import { periodLabel, shiftAnchor } from "./calendarModel";

export function DepartmentFilter({ departments, value, onChange, allowAll = true, label = "Department" }) {
  return (
    <label className="sm-toolbar-group" style={{ gap: "0.4rem" }}>
      <Filter className="w-4 h-4 text-slate-400" aria-hidden="true" />
      <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {label}
      </span>
      <select className="sm-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowAll && <option value="ALL">All departments</option>}
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ViewToggle({ value, onChange, options = [["month", "Month"], ["week", "Week"]] }) {
  return (
    <div className="sm-seg" role="group" aria-label="Calendar view">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** props: anchor "YYYY-MM-DD", view, onAnchor(next), onView(next) (omit to hide the toggle), children (extra controls) */
export default function CalendarToolbar({ anchor, view, onAnchor, onView, children }) {
  return (
    <div className="sm-toolbar">
      <div className="sm-toolbar-group">
        <button type="button" className="sm-icon-btn" onClick={() => onAnchor(shiftAnchor(anchor, view, -1))} aria-label={`Previous ${view}`}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <span className="sm-period" aria-live="polite">{periodLabel(anchor, view)}</span>
        <button type="button" className="sm-icon-btn" onClick={() => onAnchor(shiftAnchor(anchor, view, 1))} aria-label={`Next ${view}`}>
          <ChevronRight aria-hidden="true" />
        </button>
        <button type="button" className="sm-btn sm-btn--ghost" onClick={() => onAnchor(localIsoDate())}>
          Today
        </button>
      </div>
      <div className="sm-toolbar-group">
        {children}
        {onView && <ViewToggle value={view} onChange={onView} />}
      </div>
    </div>
  );
}
