// Paging rules of the Go service (no I/O).

/** strconv.Atoi semantics: anything but an optionally signed integer is 0. */
export const atoi = (s) => (/^[+-]?\d+$/.test(String(s ?? "")) ? Number.parseInt(s, 10) : 0);

/** Page/limit defaults from the Go service: page >= 1, limit 1..200 else 20. */
export function normalizePage(page, limit) {
  return { page: page < 1 ? 1 : page, limit: limit < 1 || limit > 200 ? 20 : limit };
}

export function pagination(total, page, limit) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { totalItems: total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}
