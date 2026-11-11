// Shared data table for the dashboard pages, built on TanStack Table (v9, headless).
// Pages describe their columns; this component renders them in the dashboard table style and adds
// click-to-sort headers and client-side pagination.
//
// Column definitions (TanStack ColumnDef):
//   { id, header, accessorKey | accessorFn, cell, enableSorting, sortFn, meta: { className, headerClassName } }
//   - accessorKey/accessorFn give the value used for sorting; `cell` renders the content.
//   - Columns without an accessor (e.g. actions) are not sortable.
import {
  useTable,
  tableFeatures,
  rowSortingFeature,
  rowPaginationFeature,
  createSortedRowModel,
  createPaginatedRowModel,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  flexRender,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
});

/** Page numbers to show: first, last, and the pages around the current one, with gaps as null. */
function pageWindow(current, count) {
  const pages = new Set([0, count - 1, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 0 && p < count).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/**
 * @param {object} props
 * @param {Array} props.data            Rows to show.
 * @param {Array} props.columns         TanStack column definitions (see above).
 * @param {(row) => string} [props.getRowId]
 * @param {import("react").ReactNode} [props.emptyState]  Shown when there are no rows.
 * @param {Array} [props.initialSorting] e.g. [{ id: "name", desc: false }]
 * @param {number|null} [props.pageSize] Rows per page (default 10); null shows every row (server-paged lists).
 * @param {string} [props.itemLabel]    Plural noun for the footer, e.g. "departments".
 * @param {(row) => string} [props.rowClassName]
 * @param {string} [props.minWidth]     Minimum table width before it scrolls sideways, e.g. "960px".
 */
export default function DataTable({
  data,
  columns,
  getRowId,
  emptyState = null,
  initialSorting = [],
  pageSize = 10,
  itemLabel = "rows",
  rowClassName,
  minWidth,
}) {
  const paginated = pageSize !== null;
  const table = useTable({
    features,
    columns,
    data,
    getRowId,
    initialState: {
      sorting: initialSorting,
      pagination: { pageIndex: 0, pageSize: paginated ? pageSize : Number.MAX_SAFE_INTEGER },
    },
  });

  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const rows = table.getRowModel().rows;
  const total = table.getPrePaginatedRowModel().rows.length;
  const pageCount = table.getPageCount();
  const { pageIndex, pageSize: size } = table.state.pagination;
  const from = total === 0 ? 0 : pageIndex * size + 1;
  const to = Math.min(total, (pageIndex + 1) * size);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs data-table" style={minWidth ? { minWidth } : undefined}>
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
            <tr>
              {headers.map((header) => {
                const { column } = header;
                const meta = column.columnDef.meta ?? {};
                const label = flexRender(column.columnDef.header, header.getContext());
                const canSort = column.getCanSort();
                const sorted = column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={`px-5 py-3.5 whitespace-nowrap ${meta.headerClassName ?? ""}`}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={column.getToggleSortingHandler()}
                        className={`data-table-sort${sorted ? " is-sorted" : ""}`}
                        title={`Sort by ${typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}`}
                      >
                        <span>{label}</span>
                        {sorted === "asc" ? (
                          <ArrowUp aria-hidden="true" />
                        ) : sorted === "desc" ? (
                          <ArrowDown aria-hidden="true" />
                        ) : (
                          <ArrowUpDown aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length || 1} className="px-5 py-16 text-center">
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={`hover:bg-slate-50/80 transition-colors ${rowClassName?.(row.original) ?? ""}`}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className={`px-5 py-3.5 ${cell.column.columnDef.meta?.className ?? ""}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginated && pageCount > 1 && (
        <nav className="data-table-footer" aria-label="Table pages">
          <p className="data-table-range">
            Showing <strong>{from}–{to}</strong> of <strong>{total}</strong> {itemLabel}
          </p>
          <div className="data-table-pages">
            <button
              type="button"
              className="data-table-page"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            {pageWindow(pageIndex, pageCount).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="data-table-gap" aria-hidden="true">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`data-table-page${p === pageIndex ? " is-current" : ""}`}
                  onClick={() => table.setPageIndex(p)}
                  aria-current={p === pageIndex ? "page" : undefined}
                  aria-label={`Page ${p + 1}`}
                >
                  {p + 1}
                </button>
              )
            )}
            <button
              type="button"
              className="data-table-page"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
