// Paging helpers (no I/O). Page/limit/cursor values are validated in src/validations.

export function pagination(total, page, limit) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { totalItems: total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

export const cursorMeta = (cursor, pageSize, total) => ({
  current: cursor, pageSize, totalCount: total, hasPrev: cursor > 0, hasNext: cursor + pageSize < total,
});

/** SQL ILIKE pattern for "contains s" with %, _ and \ taken literally. */
export const containsPattern = (s) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;
