/**
 * Data-source contract for `@baseportal/grid-table`.
 *
 * The package never talks to an API directly — the app supplies a
 * {@link GridDataSource} (in the collections module this wraps `RecordsResource`).
 * Page-based on purpose: it maps 1:1 onto the existing `paginate({ page, perPage })`
 * endpoint, and the windowed cache derives a page number from a row index.
 */

export interface GridPageParams {
  /** 1-based page number. */
  page: number
  /** Rows per page (fixed for the lifetime of a data view). */
  pageSize: number
  /** Aborted when the request is superseded (filter/sort change, unmount). */
  signal?: AbortSignal
}

export interface GridPageResult<TRow> {
  rows: TRow[]
  /** Total row count across all pages — the records API always returns this. */
  total: number
}

export interface GridDataSource<TRow> {
  fetchPage(params: GridPageParams): Promise<GridPageResult<TRow>>
}

/** Whether the grid pages through data or appends pages as the user scrolls. */
export type GridMode = 'paginated' | 'infinite'
