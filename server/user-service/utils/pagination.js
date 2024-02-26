// Offset-cursor paging as the Go service computed it.

/** pageSize outside 1..100 -> 5, negative or non-numeric cursor -> 0. */
export function pageParams(cursorRaw, pageSizeRaw) {
  const atoi = (s) => (/^[+-]?\d+$/.test(String(s ?? "")) ? Number.parseInt(s, 10) : 0);
  let pageSize = atoi(pageSizeRaw);
  if (pageSize <= 0 || pageSize > 100) pageSize = 5;
  return { cursor: Math.max(atoi(cursorRaw), 0), pageSize };
}

export const cursorMeta = (cursor, pageSize, total) => ({
  current: cursor, pageSize, totalCount: total, hasPrev: cursor > 0, hasNext: cursor + pageSize < total,
});
