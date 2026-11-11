// Confirmation before any schedule change. With `impact` it first asks the server how many
// booked appointments fall in the affected period: they are never cancelled or deleted by a
// schedule change, and the administrator sees them before confirming.
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { scheduleApi } from "@/api";
import { useEscapeKey } from "@/hooks";
import { rangeLabel } from "./calendarModel";

const STATUS_NAMES = { PENDING: "pending", APPROVED: "approved", CHECKED_IN: "checked in", IN_PROGRESS: "in progress" };

function ImpactNotice({ impact }) {
  const [state, setState] = useState({ loading: true, data: null, error: false });
  const key = impact ? `${impact.from}|${impact.to}|${(impact.departmentIds || []).join(",")}` : "";
  useEffect(() => {
    if (!impact) return undefined;
    let cancelled = false;
    setState({ loading: true, data: null, error: false });
    scheduleApi
      .impact({ from: impact.from, to: impact.to, departmentIds: impact.departmentIds?.length ? impact.departmentIds.join(",") : undefined })
      .then(({ data }) => !cancelled && setState({ loading: false, data, error: false }))
      .catch(() => !cancelled && setState({ loading: false, data: null, error: true }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state.loading) {
    return (
      <div className="sm-notice sm-notice--info">
        <Info aria-hidden="true" />
        <span>Checking booked appointments in {rangeLabel(impact.from, impact.to)}…</span>
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="sm-notice">
        <AlertTriangle aria-hidden="true" />
        <span>Could not check booked appointments for this period. Existing appointments are never deleted by schedule changes.</span>
      </div>
    );
  }
  const { total, byStatus, departments } = state.data;
  if (total === 0) {
    return (
      <div className="sm-notice sm-notice--ok">
        <CheckCircle2 aria-hidden="true" />
        <span>No booked appointments fall in this period.</span>
      </div>
    );
  }
  const parts = Object.entries(byStatus).map(([s, n]) => `${n} ${STATUS_NAMES[s] || s.toLowerCase()}`);
  return (
    <div className="sm-notice" role="alert">
      <AlertTriangle aria-hidden="true" />
      <span>
        <strong>
          {total} booked appointment{total === 1 ? "" : "s"}
        </strong>{" "}
        ({parts.join(", ")}) fall in this period
        {departments.length > 1 ? ` across ${departments.length} departments` : departments[0] ? ` in ${departments[0].department}` : ""}.
        They will <strong>not</strong> be cancelled or deleted. Department officers should contact these citizens or reschedule them.
      </span>
    </div>
  );
}

/**
 * props: title, message (node), confirmLabel, tone "danger" | "primary" | "success",
 *        impact { from, to, departmentIds[] } | null, busy, onConfirm, onCancel, children (extra fields)
 */
export default function ConfirmDialog({
  title, message, confirmLabel = "Confirm", tone = "primary", impact = null, busy = false, onConfirm, onCancel, children,
}) {
  useEscapeKey(true, () => !busy && onCancel());
  const btn = tone === "danger" ? "modal-btn--danger" : tone === "success" ? "modal-btn--success" : "modal-btn--primary";
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="modal-panel modal-panel--compact" role="alertdialog" aria-modal="true" aria-labelledby="sm-confirm-title" style={{ maxWidth: 500 }}>
        <div className="sm-dialog">
          <div className="sm-dialog-head">
            <h3 id="sm-confirm-title" className="sm-dialog-title">{title}</h3>
            <button type="button" className="modal-close" onClick={onCancel} aria-label="Close" disabled={busy}>
              <X aria-hidden="true" />
            </button>
          </div>
          {message && <div className="sm-hint" style={{ fontSize: "0.875rem", color: "#334155" }}>{message}</div>}
          {children}
          {impact && <ImpactNotice impact={impact} />}
          <div className="sm-dialog-actions">
            <button type="button" className="modal-btn" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="button" className={`modal-btn ${btn}`} onClick={onConfirm} disabled={busy} autoFocus>
              {busy ? "Saving…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
