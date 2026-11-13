// Admin > Schedule Management > Calendar Exceptions: public holidays, government and department
// non-working days, blocked dates and exceptional working days, each with a reason and a scope
// (all departments, one department or selected departments). Exceptions override the weekly
// working hours; the backend applies them to every booking.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar, CalendarX2, Edit2, Plus, Trash2, X } from "lucide-react";
import { scheduleApi } from "@/api";
import { DataTable } from "@/components/ui";
import { useCursorList, useEscapeKey } from "@/hooks";
import { describeError, displayDate, localIsoDate } from "@/utils";
import {
  ConfirmDialog, EXCEPTION_TYPES, daysBetween, rangeLabel,
} from "@/features/schedule";

const PAGE_SIZE = 5;

const HOLIDAY_TYPE_OPTIONS = [
  "Religious Holiday",
  "Public Holidays",
  "Election Day",
  "Other Special Exception",
];

function isoToDmy(iso) {
  if (!iso || typeof iso !== "string") return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function dmyToIso(dmy) {
  if (!dmy || typeof dmy !== "string") return null;
  const parts = dmy.split("/");
  if (parts.length !== 3) return null;
  const [dayStr, monthStr, yearStr] = parts;
  if (dayStr.length !== 2 || monthStr.length !== 2 || yearStr.length !== 4) return null;
  const d = Number(dayStr);
  const m = Number(monthStr);
  const y = Number(yearStr);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Single input matching the native date input appearance with calendar icon,
 * but with value explicitly ordered as Date / Month / Year (DD/MM/YYYY).
 */
function DateDmyInput({ value, onChange, min, ariaLabel, id }) {
  const [text, setText] = useState(() => isoToDmy(value));
  const pickerRef = useRef(null);

  useEffect(() => {
    setText(isoToDmy(value));
  }, [value]);

  const handleNativeChange = (e) => {
    const iso = e.target.value;
    if (iso) {
      setText(isoToDmy(iso));
      onChange(iso);
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    let cleaned = val.replace(/[^\d/]/g, "").slice(0, 10);

    // Auto-insert slash after 2 and 5 digits when typing forward
    if (cleaned.length === 2 && !cleaned.includes("/") && val.length > text.length) {
      cleaned = `${cleaned}/`;
    } else if (
      cleaned.length === 5 &&
      (cleaned.match(/\//g) || []).length === 1 &&
      val.length > text.length
    ) {
      cleaned = `${cleaned}/`;
    }

    setText(cleaned);

    const iso = dmyToIso(cleaned);
    if (iso) {
      onChange(iso);
    }
  };

  const handleBlur = () => {
    const iso = dmyToIso(text);
    if (iso) {
      onChange(iso);
      setText(isoToDmy(iso));
    } else if (value) {
      setText(isoToDmy(value));
    }
  };

  const openPicker = () => {
    try {
      if (pickerRef.current?.showPicker) {
        pickerRef.current.showPicker();
      } else {
        pickerRef.current?.focus();
      }
    } catch {
      pickerRef.current?.focus();
    }
  };

  return (
    <div className="sm-date-input-wrap">
      <input
        id={id}
        type="text"
        className="sm-input"
        value={text}
        placeholder="DD/MM/YYYY"
        onChange={handleTextChange}
        onBlur={handleBlur}
        onClick={openPicker}
        aria-label={ariaLabel}
        maxLength={10}
      />
      <button
        type="button"
        className="sm-date-cal-btn"
        onClick={openPicker}
        title="Open calendar picker"
        aria-label="Open calendar picker"
      >
        <Calendar className="w-4 h-4 text-slate-500 hover:text-slate-900" aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="native-date-picker-hidden"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
          opacity: 0,
          pointerEvents: "none",
        }}
        value={value || ""}
        min={min}
        onChange={handleNativeChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

const emptyForm = (start = localIsoDate(), end = start) => ({
  type: "PUBLIC_HOLIDAY",
  title: "",
  description: "",
  startDate: start,
  endDate: end,
  scope: "ALL",
  departmentIds: [],
});

function ExceptionForm({ initial, editing, busy, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  useEscapeKey(!busy, onCancel);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title) errs.title = "Choose a holiday type.";
    if (!form.startDate) errs.startDate = "Choose a start date.";
    if (form.endDate && form.endDate < form.startDate) errs.endDate = "End date cannot precede start date.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({
      type: form.type,
      title: form.title,
      description: form.description.trim() || null,
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      scope: "ALL",
      departmentIds: [],
    });
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-panel modal-panel--wide" role="dialog" aria-modal="true" aria-labelledby="exc-form-title" style={{ maxWidth: 680 }}>
        <form className="sm-dialog" onSubmit={submit} noValidate>
          <div className="sm-dialog-head" style={{ position: "relative", justifyContent: "center" }}>
            <div style={{ textAlign: "center", paddingInline: "2.5rem" }}>
              <h3 id="exc-form-title" className="sm-dialog-title">{editing ? "Edit calendar exception" : "Add calendar exception"}</h3>
              <p className="sm-hint">Exceptions override the weekly working hours on the dates they cover.</p>
            </div>
            <button
              type="button"
              className="modal-close"
              style={{ position: "absolute", top: 0, right: 0 }}
              onClick={onCancel}
              aria-label="Close"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <label className="sm-field">
            <span className="sm-label">Holiday Type <span className="modal-required">*</span></span>
            <select
              className="sm-select"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              aria-invalid={Boolean(errors.title)}
            >
              <option value="">Choose a holiday type…</option>
              {form.title && !HOLIDAY_TYPE_OPTIONS.includes(form.title) && (
                <option value={form.title}>{form.title}</option>
              )}
              {HOLIDAY_TYPE_OPTIONS.map((holidayType) => (
                <option key={holidayType} value={holidayType}>{holidayType}</option>
              ))}
            </select>
            {errors.title && <span className="sm-error">{errors.title}</span>}
          </label>

          <label className="sm-field">
            <span className="sm-label">Holiday Name</span>
            <input
              type="text"
              className="sm-input"
              maxLength={120}
              value={form.description}
              placeholder="e.g. Ethiopian Christmas (Genna)"
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>

          <div className="sm-row">
            <label className="sm-field">
              <span className="sm-label">Start date <span className="modal-required">*</span></span>
              <DateDmyInput
                id="exc-start-date"
                value={form.startDate}
                onChange={(next) =>
                  set({
                    startDate: next,
                    endDate: form.endDate && form.endDate < next ? next : form.endDate,
                  })
                }
                ariaLabel="Start date (Date/Month/Year)"
              />
              {errors.startDate && <span className="sm-error">{errors.startDate}</span>}
            </label>
            <label className="sm-field">
              <span className="sm-label">End date</span>
              <DateDmyInput
                id="exc-end-date"
                min={form.startDate}
                value={form.endDate || form.startDate}
                onChange={(next) => set({ endDate: next })}
                ariaLabel="End date (Date/Month/Year)"
              />
              {errors.endDate ? (
                <span className="sm-error">{errors.endDate}</span>
              ) : (
                <span className="sm-hint">
                  {form.startDate ? `${daysBetween(form.startDate, form.endDate || form.startDate)} day(s)` : ""}
                </span>
              )}
            </label>
          </div>

          <div className="sm-dialog-actions">
            <button type="button" className="modal-btn" disabled={busy} onClick={onCancel}>Cancel</button>
            <button type="submit" className="modal-btn modal-btn--primary" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save Changes" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ExceptionsPage() {
  const today = localIsoDate();

  const [form, setForm] = useState(null); // { initial, editing }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchExceptionsPage = useCallback(
    ({ cursor, pageSize }) => scheduleApi.exceptions({ cursor, pageSize }),
    [],
  );

  const {
    items: list,
    loading: loadingList,
    reload: load,
    pagination,
  } = useCursorList(fetchExceptionsPage, { pageSize: PAGE_SIZE, actionLabel: "load calendar exceptions" });

  const openCreate = (start, end) => setForm({ initial: emptyForm(start, end), editing: null });
  const openEdit = (e) =>
    setForm({
      editing: e,
      initial: {
        ...emptyForm(e.startDate, e.endDate),
        ...e,
        title: e.title || "",
        description: e.description || "",
      },
    });

  const impactFor = (p) =>
    p.endDate < today ? null : { from: p.startDate < today ? today : p.startDate, to: p.endDate, departmentIds: p.scope === "ALL" ? [] : p.departmentIds };

  const labelFor = (item) =>
    item.description || (item.title ? `Exception "${item.title}"` : EXCEPTION_TYPES[item.type].label);

  const saveException = async (payload) => {
    setBusy(true);
    const editing = form?.editing;
    try {
      if (editing) {
        await scheduleApi.updateException(editing.id, payload);
        toast.success(`${labelFor(payload)} updated.`, { duration: 6000 });
      } else {
        await scheduleApi.createException(payload);
        toast.success(`${labelFor(payload)} added for ${rangeLabel(payload.startDate, payload.endDate)}.`, { duration: 6000 });
      }
      setForm(null);
      load();
    } catch (err) {
      toast.error(describeError(err, "save the exception"), { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const deleteException = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await scheduleApi.removeException(deleteTarget.id);
      toast.success(`${labelFor(deleteTarget)} deleted.`, { duration: 6000 });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(describeError(err, "delete the exception"), { duration: 6000 });
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const exceptionColumns = [
    {
      id: "holidayName",
      accessorKey: "description",
      header: "Holiday Name",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900">{row.original.description || "—"}</span>
      ),
    },
    {
      id: "holidayType",
      accessorKey: "title",
      header: "Holiday Type",
      cell: ({ row }) => (
        <span className="font-medium text-slate-700">{row.original.title || "—"}</span>
      ),
    },
    {
      id: "startDate",
      accessorKey: "startDate",
      header: "Start Date",
      meta: { className: "text-slate-600 whitespace-nowrap" },
      cell: ({ row }) => displayDate(row.original.startDate),
    },
    {
      id: "endDate",
      accessorKey: "endDate",
      header: "End Date",
      meta: { className: "text-slate-600 whitespace-nowrap" },
      cell: ({ row }) => displayDate(row.original.endDate || row.original.startDate),
    },
    {
      id: "action",
      header: "Action",
      enableSorting: false,
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => {
        const e = row.original;
        const meta = EXCEPTION_TYPES[e.type];
        const label = e.description || e.title || meta.label;
        return (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => openEdit(e)}
              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all cursor-pointer"
              title="Edit"
              aria-label={`Edit ${label} (${rangeLabel(e.startDate, e.endDate)})`}
            >
              <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(e)}
              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
              title="Delete"
              aria-label={`Delete ${label} (${rangeLabel(e.startDate, e.endDate)})`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="sm-page">
      <header className="sm-header sm-header--centered">
        <p className="sm-subtitle">
          Manage public holidays, religious holidays, and election days that override regular working hours.
        </p>
        <button type="button" className="sm-btn sm-btn--primary" onClick={() => openCreate(today, today)}>
          <Plus aria-hidden="true" /> Add exception
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={list}
          columns={exceptionColumns}
          getRowId={(e) => e.id}
          initialSorting={[]}
          pageSize={null}
          serverPagination={pagination}
          itemLabel="exceptions"
          minWidth="1120px"
          rowClassName={(e) => (e.endDate < today ? "is-past" : "")}
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <CalendarX2 className="w-6 h-6 text-slate-400" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {loadingList ? "Loading calendar exceptions…" : "No calendar exceptions"}
                </p>
                {!loadingList && (
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Add public holidays, non-working days, blocked dates or exceptional working days.
                  </p>
                )}
              </div>
            </div>
          }
        />
      </div>

      {form && (
        <ExceptionForm
          key={form.editing?.id || "new"}
          initial={form.initial}
          editing={form.editing}
          busy={busy}
          onCancel={() => setForm(null)}
          onSubmit={saveException}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this exception?"
          confirmLabel="Delete exception"
          tone="danger"
          busy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteException}
          impact={deleteTarget.type === "WORKING_DAY" ? impactFor(deleteTarget) : null}
          message={
            <>
              {deleteTarget.title ? `“${deleteTarget.title}”` : EXCEPTION_TYPES[deleteTarget.type].label} (
              {rangeLabel(deleteTarget.startDate, deleteTarget.endDate)}) will be removed and the
              normal working hours will apply again on these dates.
              {deleteTarget.type === "WORKING_DAY" && " These dates may become non-working days again."}
            </>
          }
        />
      )}
    </div>
  );
}
