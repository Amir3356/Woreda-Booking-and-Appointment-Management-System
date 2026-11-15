// Live countdown to an appointment, shown on each row of the citizen's tables
// (Appointment > My Appointments and My Queue). It ticks once a second on its own,
// so the surrounding table does not re-render.
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { countdownState, serverNow } from "@/utils/countdown";

/** The current time on the server's clock, updated every second. */
function useNow() {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    let timer;
    const tick = () => {
      setNow(serverNow());
      // Align to the next full second so every countdown on the page changes together.
      timer = setTimeout(tick, 1000 - (Date.now() % 1000));
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

/**
 * What the citizen should do, by phase and stage: "pending" (awaiting the department's approval),
 * "approved" or "checkedIn" (verified at the desk).
 */
function guidance(phase, stage) {
  const checkedIn = stage === "checkedIn";
  if (stage === "pending") {
    return phase === "now" || phase === "late"
      ? "Not approved yet: please wait for the department's decision"
      : "until your requested time · awaiting approval";
  }
  switch (phase) {
    case "days":
    case "later":
      return "until your appointment";
    case "soon":
      return checkedIn ? "Almost your turn: stay near the counter" : "Get ready: head to the office";
    case "imminent":
      return checkedIn ? "You will be called shortly" : "Check in at the desk now";
    case "now":
      return checkedIn ? "Your time has arrived: wait to be called" : "Your appointment time is now: check in at the desk";
    default:
      return checkedIn ? "Waiting to be called" : "Your appointment time has passed: check in at the desk as soon as possible";
  }
}

/** Spoken form for screen readers, e.g. "1 hour 23 minutes until your appointment". */
function spoken(state, text) {
  if (state.phase === "now" || state.phase === "late") return text;
  const parts = [];
  if (state.days) parts.push(`${state.days} day${state.days === 1 ? "" : "s"}`);
  if (state.hours) parts.push(`${state.hours} hour${state.hours === 1 ? "" : "s"}`);
  if (state.minutes || (!state.days && !state.hours)) parts.push(`${state.minutes} minute${state.minutes === 1 ? "" : "s"}`);
  return `${parts.join(" ")} until your appointment${/awaiting approval/.test(text) ? ", awaiting approval" : ""}`;
}

/** stage: "pending" | "approved" | "checkedIn" */
export function CountdownChip({ startMs, stage = "approved" }) {
  const now = useNow();
  if (startMs == null) return null;
  const state = countdownState(startMs - now);
  const text = guidance(state.phase, stage);
  return (
    <span
      className={`countdown-chip countdown-chip--${state.phase}${stage === "pending" ? " countdown-chip--pending" : ""}`}
      role="timer"
      aria-label={spoken(state, text)}
      title={text}
    >
      <Timer className="countdown-chip-icon" aria-hidden="true" />
      <span className="countdown-chip-clock">{state.clock}</span>
    </span>
  );
}
