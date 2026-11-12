// Citizen > My Queue: the citizen's live place in today's department queue (token, position,
// citizens ahead, token being served, estimated wait, counter when called). Data comes from
// GET /queue/me; it is read again whenever the server announces a queue change over the
// WebSocket (check-in, call next, completed / no-show), so it updates without polling.
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Clock, Hourglass, MapPin, Ticket, Users } from "lucide-react";
import { queueApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { displayDate, displayTime } from "@/utils";

function QueueCard({ entry }) {
  const serving = entry.status === "SERVING";
  const waiting = entry.status === "WAITING";
  const done = entry.status === "COMPLETED" || entry.status === "NO_SHOW";
  const tone = serving ? "is-available" : waiting ? "is-mixed" : "is-unavailable";

  return (
    <section className={`sm-card sm-queue-card ${tone}`} aria-label={`Queue token ${entry.tokenNumber}`}>
      <div className="sm-card-header">
        <div>
          <h2 className="sm-card-title">{entry.serviceName}</h2>
          <p className="sm-card-sub">
            {entry.departmentName} · Appointment {displayTime(entry.timeSlot)} · Ref {entry.referenceNumber}
          </p>
        </div>
        <span className={`sm-pill ${tone}`}>
          {serving ? "Your turn" : waiting ? "Waiting" : entry.status === "COMPLETED" ? "Completed" : "Missed (no-show)"}
        </span>
      </div>

      <div className="sm-card-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {serving && (
          <div className="sm-notice sm-notice--ok" role="alert" style={{ fontSize: "0.9375rem" }}>
            <BellRing aria-hidden="true" />
            <span>
              <strong>It's your turn!</strong> Please go to <strong>Counter {entry.counterNumber}</strong> now
              {entry.calledTime ? ` (called at ${entry.calledTime})` : ""}.
            </span>
          </div>
        )}

        <div className="sm-stats">
          <div className="sm-stat">
            <div className="sm-stat-label">
              <Ticket className="w-3 h-3 inline" aria-hidden="true" /> Your token
            </div>
            <div className="sm-stat-value" style={{ fontFamily: "var(--font-family-mono, monospace)", color: "#0b2545" }}>
              {entry.tokenNumber}
            </div>
            <div className="sm-stat-hint">Checked in at {entry.checkedInTime}</div>
          </div>

          {waiting && (
            <>
              <div className="sm-stat">
                <div className="sm-stat-label">Your position</div>
                <div className="sm-stat-value" style={{ color: "#1d4ed8" }}>#{entry.position}</div>
                <div className="sm-stat-hint">of {entry.waitingTotal} waiting</div>
              </div>
              <div className="sm-stat">
                <div className="sm-stat-label">
                  <Users className="w-3 h-3 inline" aria-hidden="true" /> Citizens ahead of you
                </div>
                <div className="sm-stat-value">{entry.citizensAhead}</div>
                <div className="sm-stat-hint">{entry.citizensAhead === 0 ? "You are next" : "Waiting before you"}</div>
              </div>
              <div className="sm-stat">
                <div className="sm-stat-label">
                  <Hourglass className="w-3 h-3 inline" aria-hidden="true" /> Estimated wait
                </div>
                <div className="sm-stat-value">{entry.estimatedWaitMinutes === 0 ? "Soon" : `~${entry.estimatedWaitMinutes} min`}</div>
                <div className="sm-stat-hint">Approximate</div>
              </div>
            </>
          )}

          {serving && (
            <div className="sm-stat">
              <div className="sm-stat-label">
                <MapPin className="w-3 h-3 inline" aria-hidden="true" /> Go to
              </div>
              <div className="sm-stat-value" style={{ color: "#059669" }}>Counter {entry.counterNumber}</div>
              <div className="sm-stat-hint">Now</div>
            </div>
          )}
        </div>

        {!done && (
          <p className="sm-hint">
            <Clock className="w-3 h-3 inline" aria-hidden="true" /> Now serving:{" "}
            <strong style={{ fontFamily: "var(--font-family-mono, monospace)" }}>{entry.nowServing || "—"}</strong>
            {waiting ? " · This page updates automatically when the queue moves." : ""}
          </p>
        )}
      </div>
    </section>
  );
}

export default function CitizenQueuePage() {
  const [state, setState] = useState({ loading: true, data: null, error: false });
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const { data } = await queueApi.mine();
      if (id === request.current) setState({ loading: false, data, error: false });
    } catch {
      if (id === request.current) setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  // Live: the server pushes "appointments.changed" on check-in, call next and completion.
  useEffect(() => {
    load();
    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    };
    const offs = [subscribe("appointments.changed", soon), subscribe("reconnected", soon)];
    return () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    };
  }, [load]);

  const queue = state.data?.queue || [];
  const active = queue.filter((q) => q.status === "WAITING" || q.status === "SERVING");
  const finished = queue.filter((q) => q.status === "COMPLETED" || q.status === "NO_SHOW");
  const notCheckedIn = state.data?.notCheckedIn || [];

  return (
    <div className="sm-page">
      <header className="sm-header justify-center text-center" style={{ display: "flex", justifyContent: "center", textAlign: "center", width: "100%" }}>
        <div className="w-full text-center" style={{ textAlign: "center", width: "100%" }}>
          <h1 className="sm-title" style={{ textAlign: "center" }}>My Queue</h1>
          <p className="sm-subtitle mx-auto" style={{ textAlign: "center", margin: "0.25rem auto 0 auto" }}>
            Your place in today's queue{state.data?.date ? ` (${displayDate(state.data.date)})` : ""}. After you check in at the
            reception desk you get a token number; this page then shows your position and how many citizens are ahead of you.
          </p>
        </div>
      </header>

      {state.loading && <div className="sm-empty">Loading your queue…</div>}
      {!state.loading && state.error && !state.data && (
        <div className="sm-notice">
          <Clock aria-hidden="true" />
          <span>Your queue position could not be loaded right now. It will appear as soon as the connection is back.</span>
        </div>
      )}

      {active.map((entry) => (
        <QueueCard key={entry.appointmentId} entry={entry} />
      ))}

      {notCheckedIn.map((a) => (
        <section key={a.appointmentId} className="sm-card" aria-label="Appointment not checked in">
          <div className="sm-card-header">
            <div>
              <h2 className="sm-card-title">{a.serviceName}</h2>
              <p className="sm-card-sub">
                {a.departmentName} · Appointment {displayTime(a.timeSlot)} · Ref {a.referenceNumber}
              </p>
            </div>
            <span className="sm-pill is-unavailable">{a.status === "PENDING" ? "Awaiting approval" : "Not checked in"}</span>
          </div>
          <div className="sm-card-body">
            <div className="sm-notice sm-notice--info">
              <MapPin aria-hidden="true" />
              <span>
                {a.status === "PENDING"
                  ? "Your appointment today is still waiting for approval by the department. Once approved, check in at the reception desk to get your queue number."
                  : "Check in at the reception desk to get your queue number. Your position will then appear here."}
              </span>
            </div>
          </div>
        </section>
      ))}

      {finished.map((entry) => (
        <QueueCard key={entry.appointmentId} entry={entry} />
      ))}

      {!state.loading && state.data && queue.length === 0 && notCheckedIn.length === 0 && (
        <div className="sm-card">
          <div className="sm-empty">
            <strong>You are not in a queue today</strong>
            When you have an appointment today and check in at the reception desk, your queue position will appear here.
          </div>
        </div>
      )}
    </div>
  );
}
