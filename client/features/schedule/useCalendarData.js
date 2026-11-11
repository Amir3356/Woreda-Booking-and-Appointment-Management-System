import { useCallback, useEffect, useRef, useState } from "react";
import { scheduleApi } from "@/api";
import { subscribe } from "@/api/realtime";

/**
 * Loads GET /schedules/calendar for [from, to] (one department or all) and loads it again when
 * the server announces a schedule or appointment change, so capacities and statuses stay live.
 */
export function useCalendarData({ from, to, departmentId }) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!from || !to) return;
    const id = ++request.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await scheduleApi.calendar({ from, to, departmentId: departmentId && departmentId !== "ALL" ? departmentId : undefined });
      if (id === request.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === request.current) setState((s) => ({ ...s, loading: false, error }));
    }
  }, [from, to, departmentId]);

  useEffect(() => {
    load();
    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    };
    const offs = [subscribe("catalog.changed", soon), subscribe("appointments.changed", soon), subscribe("reconnected", soon)];
    return () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    };
  }, [load]);

  return { ...state, reload: load };
}
