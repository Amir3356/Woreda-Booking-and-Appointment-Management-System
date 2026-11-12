// Shared hook for cursor-based server-side pagination tables with stale-request protection,
// empty-tail cursor recovery after deletes, and WebSocket live reload subscriptions.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { subscribe } from "@/api/realtime";
import { describeError } from "@/utils";

const DEFAULT_EVENTS = ["catalog.changed", "reconnected"];

const emptyCursorMeta = (pageSize) => ({
  current: 0,
  pageSize,
  totalCount: 0,
  hasPrev: false,
  hasNext: false,
  nextCursor: null,
  prevCursor: null,
});

export function useCursorList(
  fetcher,
  { pageSize = 5, actionLabel = "load items", events = DEFAULT_EVENTS } = {},
) {
  const [cursor, setCursor] = useState(0);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(() => emptyCursorMeta(pageSize));
  const [loading, setLoading] = useState(true);
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const res = await fetcher({ cursor, pageSize });
      if (seq !== seqRef.current) return;
      if (res && Array.isArray(res.data)) {
        setItems(res.data);
        if (res.meta?.cursor) {
          setMeta(res.meta.cursor);
          if (cursor > 0 && res.meta.cursor.totalCount <= cursor) {
            setCursor(Math.max(0, cursor - pageSize));
          }
        }
      }
    } catch (err) {
      if (seq !== seqRef.current) return;
      toast.error(describeError(err, actionLabel), { duration: 6000 });
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher, cursor, pageSize, actionLabel]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!events?.length) return undefined;
    const offs = events.map((ev) => subscribe(ev, load));
    return () => offs.forEach((off) => off());
  }, [load, events]);

  return {
    cursor,
    setCursor,
    items,
    meta,
    loading,
    reload: load,
    pagination: { meta, loading, onCursorChange: setCursor },
  };
}

