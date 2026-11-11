import { useEffect, useRef } from "react";

/** Calls onEscape when the Escape key is pressed while active (e.g. to close an open dialog). */
export function useEscapeKey(active, onEscape) {
  const handler = useRef(onEscape);
  handler.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") handler.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
