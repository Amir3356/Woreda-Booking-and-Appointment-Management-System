// Admin > Schedule Management > Calendar Exceptions: public holidays, government and department
// non-working days, blocked dates and exceptional working days, each with a reason and a scope
// (all departments, one department or selected departments). Exceptions override the weekly
// operating hours; the backend applies them to every booking.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, Edit2, Plus, Trash2, X } from "lucide-react";
import { useStore } from "@/context";
import { scheduleApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { useEscapeKey } from "@/hooks";
import { describeError, localIsoDate } from "@/utils";
import {
  CLOSING_TYPES, CalendarLegend, CalendarToolbar, ConfirmDialog, DepartmentFilter, EXCEPTION_TYPES, ScheduleCalendar, ViewToggle,
  daysBetween, monthRange, orderedRange, rangeLabel, useCalendarData,
} from "@/features/schedule";

const SCOPE_OPTIONS = [
  ["ALL", "All departments", "Every department of the Woreda"],
  ["DEPARTMENT", "Individual department", "One department only"],
  ["DEPARTMENTS", "Selected departments", "Pick several departments"],
];

const emptyForm = (start = localIsoDate(), end = start) => ({
  type: "PUBLIC_HOLIDAY",
  title: "",
  description: "",
  startDate: start,
  endDate: end,
  scope: "ALL",
  departmentIds: [],
  openingTime: "08:30",
  closingTime: "12:30",
  dailyCapacity: 20,
});

function ExceptionForm({ initial, editing, departments, paused, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  useEscapeKey(!paused, onCancel);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isWorking = form.type === "WORKING_DAY";

  const toggleDept = (id) =>
    set({ departmentIds: form.departmentIds.includes(id) ? form.departmentIds.filter((d) => d !== id) : [...form.departmentIds, id] });

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = "Give the exception a name or reason.";
    if (!form.startDate) errs.startDate = "Choose a start date.";
    if (form.endDate && form.endDate < form.startDate) errs.endDate = "End date cannot precede start date.";
    if (form.scope === "DEPARTMENT" && form.departmentIds.length !== 1) errs.departmentIds = "Choose a department.";
    if (form.scope === "DEPARTMENTS" && form.departmentIds.length === 0) errs.departmentIds = "Choose at least one department.";
    if (isWorking) {
      if (!form.openingTime || !form.closingTime) errs.hours = "Set the opening and closing time.";
      else if (form.closingTime <= form.openingTime) errs.hours = "Closing time must be after opening time.";
      if (!Number.isInteger(Number(form.dailyCapacity)) || Number(form.dailyCapacity) < 1) errs.dailyCapacity = "Set a daily capacity of at least 1.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      scope: form.scope,
      departmentIds: form.scope === "ALL" ? [] : form.departmentIds,
      openingTime: isWorking ? form.openingTime : null,
      closingTime: isWorking ? form.closingTime : null,
      dailyCapacity: isWorking ? Number(form.dailyCapacity) : null,
    });
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-panel modal-panel--wide" role="dialog" aria-modal="true" aria-labelledby="exc-form-title" style={{ maxWidth: 680 }}>
        <form className="sm-dialog" onSubmit={submit} noValidate>
          <div className="sm-dialog-head">
            <div>
              <h3 id="exc-form-title" className="sm-dialog-title">{editing ? "Edit calendar exception" : "Add calendar exception"}</h3>
              <p className="sm-hint">Exceptions override the weekly operating hours on the dates they cover.</p>
            </div>
            <button type="button" className="modal-close" onClick={onCancel} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="sm-field">
            <span className="sm-label">Kind of exception</span>
            <div className="sm-choices" role="group" aria-label="Kind of exception">
              {Object.entries(EXCEPTION_TYPES).map(([type, meta]) => (
                <button key={type} type="button" className={`sm-choice ${meta.tone}`} aria-pressed={form.type === type} onClick={() => set({ type })}>
                  <b>{meta.label}</b>
                  <span>{meta.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="sm-field">
            <span className="sm-label">Name / reason <span className="modal-required">*</span></span>
            <input
              className="sm-input"
              maxLength={120}
              value={form.title}
              placeholder={isWorking ? "e.g. Saturday service campaign" : "e.g. Ethiopian Christmas (Genna)"}
              onChange={(e) => set({ title: e.target.value })}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && <span className="sm-error">{errors.title}</span>}
          </label>

          <label className="sm-field">
            <span className="sm-label">Description (optional)</span>
            <textarea
              className="sm-textarea"
              maxLength={1000}
              value={form.description}
              placeholder="Details for staff, e.g. which services are affected"
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>

          <div className="sm-row">
            <label className="sm-field">
              <span className="sm-label">Start date <span className="modal-required">*</span></span>
              <input
                type="date"
                className="sm-input"
                value={form.startDate}
                onChange={(e) => set({ startDate: e.target.value, endDate: form.endDate && form.endDate < e.target.value ? e.target.value : form.endDate })}
              />
              {errors.startDate && <span className="sm-error">{errors.startDate}</span>}
            </label>
            <label className="sm-field">
              <span className="sm-label">End date</span>
              <input type="date" className="sm-input" min={form.startDate} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              {errors.endDate ? (
                <span className="sm-error">{errors.endDate}</span>
              ) : (
                <span className="sm-hint">
                  {form.startDate ? `${daysBetween(form.startDate, form.endDate || form.startDate)} day(s)` : ""}
                </span>
              )}
            </label>
          </div>

          <div className="sm-field">
            <span className="sm-label">Applies to</span>
            <div className="sm-choices" role="group" aria-label="Scope">
              {SCOPE_OPTIONS.map(([scope, label, hint]) => (
                <button
                  key={scope}
                  type="button"
                  className="sm-choice"
                  aria-pressed={form.scope === scope}
                  onClick={() => set({ scope, departmentIds: scope === "DEPARTMENT" ? form.departmentIds.slice(0, 1) : form.departmentIds })}
                >
                  <b>{label}</b>
                  <span>{hint}</span>
                </button>
              ))}
            </div>
            {form.scope === "DEPARTMENT" && (
              <select className="sm-select" value={form.departmentIds[0] || ""} onChange={(e) => set({ departmentIds: e.target.value ? [e.target.value] : [] })}>
                <option value="">Choose a department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            {form.scope === "DEPARTMENTS" && (
              <div className="sm-chips" role="group" aria-label="Departments">
                {departments.map((d) => {
                  const on = form.departmentIds.includes(d.id);
                  return (
                    <button key={d.id} type="button" className="sm-chip" aria-pressed={on} onClick={() => toggleDept(d.id)}>
                      {on && <Check aria-hidden="true" />}
                      {d.name}
                    </button>
                  );
                })}
              </div>
            )}
            {errors.departmentIds && <span className="sm-error">{errors.departmentIds}</span>}
          </div>

          {isWorking && (
            <div className="sm-field" style={{ padding: "0.85rem", borderRadius: 12, background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
              <span className="sm-label">Hours and capacity for this working day <span className="modal-required">*</span></span>
              <div className="sm-row">
                <label className="sm-field">
                  <span className="sm-hint">Opening time</span>
                  <input type="time" className="sm-input" value={form.openingTime} onChange={(e) => set({ openingTime: e.target.value })} />
                </label>
                <label className="sm-field">
                  <span className="sm-hint">Closing time</span>
                  <input type="time" className="sm-input" value={form.closingTime} onChange={(e) => set({ closingTime: e.target.value })} />
                </label>
                <label className="sm-field">
                  <span className="sm-hint">Daily capacity per department</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    className="sm-input"
                    value={form.dailyCapacity}
                    onChange={(e) => set({ dailyCapacity: e.target.value })}
                  />
                </label>
              </div>
              {errors.hours && <span className="sm-error">{errors.hours}</span>}
              {errors.dailyCapacity && <span className="sm-error">{errors.dailyCapacity}</span>}
            </div>
          )}

          <div className="sm-dialog-actions">
            <button type="button" className="modal-btn" onClick={onCancel}>Cancel</button>
            <button type="submit" className="modal-btn modal-btn--primary">{editing ? "Review changes" : "Review & add"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ExceptionsPage() {
  const departments = useStore((s) => s.departments) || [];
  const loadDepartments = useStore((s) => s.loadDepartments);
  const today = localIsoDate();

  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [view, setView] = useState("list");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [anchor, setAnchor] = useState(today);
  const [selection, setSelection] = useState(null);
  const [clickAnchor, setClickAnchor] = useState(null);
  const [form, setForm] = useState(null); // { initial, editing }
  const [confirm, setConfirm] = useState(null); // { kind: "save" | "delete", payload, target }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await scheduleApi.exceptions({
        from: from || undefined,
        to: to || undefined,
        departmentId: deptFilter === "ALL" ? undefined : deptFilter,
      });
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(describeError(err, "load calendar exceptions"), { duration: 5000 });
    } finally {
      setLoadingList(false);
    }
  }, [from, to, deptFilter]);

  useEffect(() => {
    loadDepartments().catch(() => {});
  }, [loadDepartments]);
  useEffect(() => {
    load();
    const offs = [subscribe("catalog.changed", load), subscribe("reconnected", load)];
    return () => offs.forEach((off) => off());
  }, [load]);

  const month = monthRange(anchor);
  const calendar = useCalendarData({ from: view === "calendar" ? month.from : null, to: view === "calendar" ? month.to : null, departmentId: deptFilter });

  const counts = useMemo(() => {
    const c = { ALL: list.length };
    for (const e of list) c[e.type] = (c[e.type] || 0) + 1;
    return c;
  }, [list]);
  const shown = list.filter((e) => typeFilter === "ALL" || e.type === typeFilter);

  const openCreate = (start, end) => {
    const initial = emptyForm(start, end);
    if (deptFilter !== "ALL") Object.assign(initial, { scope: "DEPARTMENT", departmentIds: [deptFilter] });
    setForm({ initial, editing: null });
  };
  const openEdit = (e) =>
    setForm({
      editing: e,
      initial: {
        ...emptyForm(e.startDate, e.endDate),
        ...e,
        description: e.description || "",
        openingTime: e.openingTime || "08:30",
        closingTime: e.closingTime || "12:30",
        dailyCapacity: e.dailyCapacity || 20,
      },
    });

  const impactFor = (p) =>
    p.endDate < today ? null : { from: p.startDate < today ? today : p.startDate, to: p.endDate, departmentIds: p.scope === "ALL" ? [] : p.departmentIds };

  const run = async () => {
    setBusy(true);
    const { kind, payload, target } = confirm;
    try {
      if (kind === "delete") {
        await scheduleApi.removeException(target.id);
        toast.success(`Exception "${target.title}" deleted.`, { duration: 5000 });
      } else if (target) {
        await scheduleApi.updateException(target.id, payload);
        toast.success(`Exception "${payload.title}" updated.`, { duration: 5000 });
      } else {
        await scheduleApi.createException(payload);
        toast.success(`Exception "${payload.title}" added for ${rangeLabel(payload.startDate, payload.endDate)}.`, { duration: 5000 });
      }
      setConfirm(null);
      setForm(null);
      setSelection(null);
      load();
      calendar.reload();
    } catch (err) {
      toast.error(describeError(err, kind === "delete" ? "delete the exception" : "save the exception"), { duration: 6000 });
      setConfirm(null); // back to the form (still open) to correct it
    } finally {
      setBusy(false);
    }
  };

  const scopeText = (e) => (e.scope === "ALL" ? "All departments" : e.departments.join(", ") || "—");

  return (
    <div className="sm-page">
      <header className="sm-header">
        <div>
          <p className="sm-eyebrow">Schedule Management</p>
          <h1 className="sm-title">Calendar Exceptions</h1>
          <p className="sm-subtitle">
            Public holidays, non-working days, blocked dates and exceptional working days for the whole Woreda or for specific
            departments. They override the weekly operating hours; blocked dates override everything else.
          </p>
        </div>
        <button type="button" className="sm-btn sm-btn--primary" onClick={() => openCreate(today, today)}>
          <Plus aria-hidden="true" /> Add exception
        </button>
      </header>

      <div className="sm-toolbar">
        <div className="sm-toolbar-group">
          <div className="sm-seg" role="group" aria-label="Exception type">
            {[["ALL", "All"], ...Object.entries(EXCEPTION_TYPES).map(([k, m]) => [k, m.short])].map(([k, label]) => (
              <button key={k} type="button" aria-pressed={typeFilter === k} onClick={() => setTypeFilter(k)}>
                {label} <span style={{ opacity: 0.6 }}>{counts[k] || 0}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sm-toolbar-group">
          <DepartmentFilter departments={departments} value={deptFilter} onChange={setDeptFilter} />
          <ViewToggle value={view} onChange={setView} options={[["list", "List"], ["calendar", "Calendar"]]} />
        </div>
      </div>

      {view === "list" ? (
        <section className="sm-card" aria-label="Exceptions">
          <div className="sm-card-header">
            <div className="sm-toolbar-group">
              <label className="sm-toolbar-group" style={{ gap: "0.4rem" }}>
                <span className="sm-label">From</span>
                <input type="date" className="sm-input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="sm-toolbar-group" style={{ gap: "0.4rem" }}>
                <span className="sm-label">To</span>
                <input type="date" className="sm-input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </label>
              {(from !== today || to) && (
                <button type="button" className="sm-btn sm-btn--ghost" onClick={() => { setFrom(today); setTo(""); }}>
                  Upcoming only
                </button>
              )}
              <button type="button" className="sm-btn sm-btn--ghost" onClick={() => { setFrom(""); setTo(""); }}>
                Show all
              </button>
            </div>
            <span className="sm-hint">{shown.length} exception{shown.length === 1 ? "" : "s"}</span>
          </div>
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name / reason</th>
                  <th>Dates</th>
                  <th>Applies to</th>
                  <th>Hours & capacity</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loadingList && shown.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="sm-empty">
                        <strong>No calendar exceptions{from ? " from this date" : ""}</strong>
                        Add public holidays, non-working days, blocked dates or exceptional working days.
                      </div>
                    </td>
                  </tr>
                )}
                {shown.map((e) => {
                  const meta = EXCEPTION_TYPES[e.type];
                  const n = daysBetween(e.startDate, e.endDate);
                  return (
                    <tr key={e.id} style={{ opacity: e.endDate < today ? 0.6 : 1 }}>
                      <td><span className={`sm-pill ${meta.tone}`}>{meta.label}</span></td>
                      <td>
                        <b style={{ color: "#0f172a" }}>{e.title}</b>
                        {e.description && <div className="sm-hint" style={{ maxWidth: 320 }}>{e.description}</div>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {rangeLabel(e.startDate, e.endDate)}
                        <div className="sm-hint">{n} day{n === 1 ? "" : "s"}{e.endDate < today ? " · past" : ""}</div>
                      </td>
                      <td style={{ maxWidth: 260 }}>{scopeText(e)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {e.type === "WORKING_DAY" ? (
                          <>
                            {e.openingTime}–{e.closingTime}
                            <div className="sm-hint">{e.dailyCapacity} per department</div>
                          </>
                        ) : (
                          <span className="sm-hint">Closed</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                          <button type="button" className="sm-icon-btn" title="Edit" aria-label={`Edit ${e.title}`} onClick={() => openEdit(e)}>
                            <Edit2 aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="sm-icon-btn sm-icon-btn--danger"
                            title="Delete"
                            aria-label={`Delete ${e.title}`}
                            onClick={() => setConfirm({ kind: "delete", target: e })}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <>
          <CalendarToolbar anchor={anchor} view="month" onAnchor={setAnchor}>
            <button
              type="button"
              className="sm-btn sm-btn--primary"
              disabled={!selection}
              onClick={() => selection && openCreate(selection.start, selection.end)}
            >
              <CalendarPlus aria-hidden="true" />
              {selection ? `Add for ${rangeLabel(selection.start, selection.end)}` : "Select dates to add"}
            </button>
          </CalendarToolbar>
          <section className="sm-card" aria-label="Exceptions calendar">
            <div className="sm-card-header">
              <CalendarLegend showMixed={deptFilter === "ALL"} />
              <span className="sm-hint">Click a day, Shift-click to select a range</span>
            </div>
            <ScheduleCalendar
              view="month"
              data={calendar.data}
              month={month.month}
              departmentId={deptFilter}
              selection={selection}
              onSelect={(date, ev) => {
                if (ev.shiftKey && clickAnchor) setSelection(orderedRange(clickAnchor, date));
                else {
                  setSelection({ start: date, end: date });
                  setClickAnchor(date);
                }
              }}
            />
          </section>
        </>
      )}

      {form && (
        <ExceptionForm
          key={form.editing?.id || "new"}
          initial={form.initial}
          editing={form.editing}
          departments={departments}
          paused={Boolean(confirm)}
          onCancel={() => setForm(null)}
          onSubmit={(payload) => setConfirm({ kind: "save", payload, target: form.editing })}
        />
      )}

      {confirm?.kind === "save" && (
        <ConfirmDialog
          title={confirm.target ? "Save changes to this exception?" : "Add this exception?"}
          confirmLabel={confirm.target ? "Save changes" : "Add exception"}
          tone={CLOSING_TYPES.includes(confirm.payload.type) ? "danger" : "primary"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={run}
          impact={CLOSING_TYPES.includes(confirm.payload.type) ? impactFor(confirm.payload) : null}
          message={
            <>
              <strong>{EXCEPTION_TYPES[confirm.payload.type].label}</strong> “{confirm.payload.title}” on{" "}
              <strong>{rangeLabel(confirm.payload.startDate, confirm.payload.endDate)}</strong> for{" "}
              <strong>
                {confirm.payload.scope === "ALL"
                  ? "all departments"
                  : confirm.payload.departmentIds.map((id) => departments.find((d) => d.id === id)?.name || id).join(", ")}
              </strong>
              .{" "}
              {confirm.payload.type === "WORKING_DAY"
                ? `Citizens can book ${confirm.payload.openingTime}–${confirm.payload.closingTime}, up to ${confirm.payload.dailyCapacity} appointments per department per day.`
                : "Citizens will not be able to book on these dates."}
            </>
          }
        />
      )}

      {confirm?.kind === "delete" && (
        <ConfirmDialog
          title="Delete this exception?"
          confirmLabel="Delete exception"
          tone="danger"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={run}
          impact={confirm.target.type === "WORKING_DAY" ? impactFor(confirm.target) : null}
          message={
            <>
              “{confirm.target.title}” ({rangeLabel(confirm.target.startDate, confirm.target.endDate)}) will be removed and the
              normal operating hours will apply again on these dates.
              {confirm.target.type === "WORKING_DAY" && " These dates may become non-working days again."}
            </>
          }
        />
      )}
    </div>
  );
}
