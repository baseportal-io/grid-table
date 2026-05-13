'use client'

import * as React from 'react'

import type { GridEditValue } from '../cells/types'
import type { GridDataSource, GridMode } from './types'

/** Merges an edited value into a row. Default: shallow-spread + set the key. */
export type MergeEdit<TRow> = (
  row: TRow,
  columnId: string,
  value: GridEditValue
) => TRow

export interface PersistEditContext<TRow> {
  /** Optimistically-updated row. */
  row: TRow
  /** Row before the edit. */
  previousRow: TRow
  columnId: string
  value: GridEditValue
  /** True when editing a not-yet-persisted draft row (the consumer should create it). */
  isDraft: boolean
}

export interface UseGridDataOptions<TRow> {
  source: GridDataSource<TRow>
  /** Rows per fetch — also the paginated page size. */
  pageSize: number
  mode: GridMode
  /**
   * Changing this drops the cache (and any draft rows) and refetches from the
   * first page. Pass a key derived from the active sort + filters.
   */
  resetKey?: unknown
  /** infinite mode: max fetched pages kept before LRU eviction. Default 20. */
  maxCachedPages?: number
  /** infinite mode: extra rows fetched beyond the visible region. Default = pageSize. */
  overscanRows?: number
  /** How {@link UseGridDataResult.commitEdit} applies a value to a row. */
  mergeEdit?: MergeEdit<TRow>
  /**
   * Persists an edit. Return the server's version of the row to reconcile (e.g.
   * assign the real id after creating a draft); throw to roll back the optimistic
   * update. For a draft row, `isDraft` is true and the consumer should create.
   */
  onPersistEdit?: (
    ctx: PersistEditContext<TRow>
  ) => Promise<TRow | void> | TRow | void
  /** Builds a blank row for the trailing "+" row. Required to enable {@link UseGridDataResult.appendDraftRow}. */
  makeDraftRow?: () => TRow
}

export interface UseGridDataResult<TRow> {
  /** Total rows known so far (server rows + draft rows). */
  rowCount: number
  /** Row at `rowIndex`, or `undefined` if not loaded yet (a fetch is scheduled). */
  getRow: (rowIndex: number) => TRow | undefined
  /** Wire to {@link GridTableProps.onVisibleRowsChange} so upcoming pages prefetch. */
  onVisibleRowsChange: (range: { startRow: number; endRow: number }) => void
  /** True while the first page of the current view is loading. */
  isInitialLoading: boolean
  /** Last fetch/persist error, if any. */
  error: unknown
  /** Drop the cache and draft rows and refetch (also happens when `resetKey` changes). */
  refresh: () => void
  /** Apply an inline edit at `rowIndex` — optimistic update + `onPersistEdit`. */
  commitEdit: (edit: {
    rowIndex: number
    columnId: string
    value: GridEditValue
  }) => void
  /** Append a blank draft row; returns its row index (to scroll/focus), or `undefined`. */
  appendDraftRow: () => number | undefined
  /** Whether the row at `rowIndex` is a not-yet-persisted draft. */
  isDraftRow: (rowIndex: number) => boolean

  // paginated mode
  /** 1-based current page. */
  page: number
  setPage: (page: number) => void
  /** Total page count (0 until the total is known). */
  pageCount: number
  /** Total server row count across all pages (0 until known). */
  total: number
}

const defaultMergeEdit: MergeEdit<unknown> = (row, columnId, value) =>
  ({ ...(row as Record<string, unknown>), [columnId]: value }) as unknown

/**
 * Windowed data layer over a {@link GridDataSource}, with optimistic inline
 * editing and trailing draft rows. See the README for the mode semantics.
 */
export function useGridData<TRow>(
  options: UseGridDataOptions<TRow>
): UseGridDataResult<TRow> {
  const {
    source,
    pageSize,
    mode,
    resetKey,
    maxCachedPages = 20,
    overscanRows,
    mergeEdit = defaultMergeEdit as MergeEdit<TRow>,
    onPersistEdit,
    makeDraftRow
  } = options
  const overscan = overscanRows ?? pageSize

  const cacheRef = React.useRef(new Map<number, TRow[]>())
  const lruRef = React.useRef<number[]>([])
  const inflightRef = React.useRef(new Map<number, AbortController>())
  const sourceRef = React.useRef(source)
  const persistRef = React.useRef(onPersistEdit)
  const mergeRef = React.useRef(mergeEdit)
  React.useEffect(() => {
    sourceRef.current = source
    persistRef.current = onPersistEdit
    mergeRef.current = mergeEdit
  })

  const [total, setTotal] = React.useState(0)
  const [page, setPageState] = React.useState(1)
  const [draftRows, setDraftRows] = React.useState<TRow[]>([])
  const [version, setVersion] = React.useState(0)
  const [isInitialLoading, setIsInitialLoading] = React.useState(true)
  const [error, setError] = React.useState<unknown>(null)

  const bump = React.useCallback(() => setVersion((v) => v + 1), [])

  const touchLru = React.useCallback(
    (p: number) => {
      const lru = lruRef.current
      const existing = lru.indexOf(p)
      if (existing !== -1) lru.splice(existing, 1)
      lru.push(p)
      while (lru.length > maxCachedPages) {
        const evicted = lru.shift()
        if (evicted != null && evicted !== p) cacheRef.current.delete(evicted)
      }
    },
    [maxCachedPages]
  )

  const ensurePage = React.useCallback(
    (p: number) => {
      if (p < 1) return
      if (cacheRef.current.has(p) || inflightRef.current.has(p)) return
      const controller = new AbortController()
      inflightRef.current.set(p, controller)
      sourceRef.current
        .fetchPage({ page: p, pageSize, signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return
          cacheRef.current.set(p, result.rows)
          touchLru(p)
          setTotal(result.total)
          setError(null)
          setIsInitialLoading(false)
          bump()
        })
        .catch((e) => {
          if (controller.signal.aborted) return
          setError(e)
          setIsInitialLoading(false)
        })
        .finally(() => {
          inflightRef.current.delete(p)
        })
    },
    [pageSize, touchLru, bump]
  )

  const resetAndReload = React.useCallback(
    (nextPage: number) => {
      cacheRef.current.clear()
      lruRef.current = []
      inflightRef.current.forEach((c) => c.abort())
      inflightRef.current.clear()
      setTotal(0)
      setDraftRows([])
      setError(null)
      setIsInitialLoading(true)
      bump()
      ensurePage(nextPage)
    },
    [ensurePage, bump]
  )

  React.useEffect(() => {
    setPageState(1)
    resetAndReload(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, mode, pageSize])

  React.useEffect(() => {
    if (mode === 'paginated') ensurePage(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, mode])

  const pageOf = React.useCallback(
    (rowIndex: number) =>
      mode === 'paginated' ? page : Math.floor(rowIndex / pageSize) + 1,
    [mode, page, pageSize]
  )
  const localIndexOf = React.useCallback(
    (rowIndex: number) => (mode === 'paginated' ? rowIndex : rowIndex % pageSize),
    [mode, pageSize]
  )

  const serverRowCount =
    mode === 'paginated' ? (cacheRef.current.get(page)?.length ?? 0) : total
  const rowCount = serverRowCount + draftRows.length

  const isDraftRow = React.useCallback(
    (rowIndex: number) => rowIndex >= serverRowCount,
    [serverRowCount]
  )

  const getRow = React.useCallback(
    (rowIndex: number): TRow | undefined => {
      if (rowIndex < 0) return undefined
      if (rowIndex >= serverRowCount) return draftRows[rowIndex - serverRowCount]
      if (mode === 'paginated') return cacheRef.current.get(page)?.[rowIndex]
      const p = Math.floor(rowIndex / pageSize) + 1
      const rows = cacheRef.current.get(p)
      if (rows) {
        touchLru(p)
        return rows[rowIndex % pageSize]
      }
      ensurePage(p)
      return undefined
      // `version` keeps the identity fresh so glide re-reads cells after a fetch.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [mode, page, pageSize, ensurePage, touchLru, draftRows, serverRowCount, version]
  )

  const onVisibleRowsChange = React.useCallback(
    (range: { startRow: number; endRow: number }) => {
      if (mode !== 'infinite') return
      const first = Math.max(0, range.startRow - overscan)
      const last = range.endRow + overscan
      const firstPage = Math.floor(first / pageSize) + 1
      const lastPage = Math.floor(last / pageSize) + 1
      for (let p = firstPage; p <= lastPage; p++) ensurePage(p)
    },
    [mode, pageSize, overscan, ensurePage]
  )

  // --- editing ---

  const patchDraft = React.useCallback((idx: number, row: TRow) => {
    setDraftRows((prev) => prev.map((r, j) => (j === idx ? row : r)))
  }, [])

  const patchServerRow = React.useCallback(
    (p: number, localIdx: number, row: TRow) => {
      const rows = cacheRef.current.get(p)
      if (!rows) return
      const next = rows.slice()
      next[localIdx] = row
      cacheRef.current.set(p, next)
      bump()
    },
    [bump]
  )

  /**
   * Merge a partial update (server reconciliation, rollback of one field) into
   * the latest cached row instead of replacing it. Prevents async commits from
   * stamping over concurrent edits to other fields — a real risk on a draft
   * row where the user tab-edits two cells faster than the first persist
   * resolves.
   */
  const mergeDraftPartial = React.useCallback(
    (idx: number, partial: Record<string, unknown>) => {
      setDraftRows((prev) =>
        prev.map((r, j) =>
          j === idx
            ? ({ ...(r as Record<string, unknown>), ...partial } as TRow)
            : r
        )
      )
    },
    []
  )

  const mergeServerRowPartial = React.useCallback(
    (p: number, localIdx: number, partial: Record<string, unknown>) => {
      const rows = cacheRef.current.get(p)
      if (!rows) return
      const next = rows.slice()
      next[localIdx] = {
        ...(next[localIdx] as Record<string, unknown>),
        ...partial
      } as TRow
      cacheRef.current.set(p, next)
      bump()
    },
    [bump]
  )

  const commitEdit = React.useCallback(
    ({
      rowIndex,
      columnId,
      value
    }: {
      rowIndex: number
      columnId: string
      value: GridEditValue
    }) => {
      const draft = rowIndex >= serverRowCount
      const draftIdx = rowIndex - serverRowCount

      const previousRow = draft
        ? draftRows[draftIdx]
        : mode === 'paginated'
          ? cacheRef.current.get(page)?.[rowIndex]
          : cacheRef.current.get(Math.floor(rowIndex / pageSize) + 1)?.[
              rowIndex % pageSize
            ]
      if (previousRow === undefined) return

      const updatedRow = mergeRef.current(previousRow, columnId, value)
      const p = pageOf(rowIndex)
      const localIdx = localIndexOf(rowIndex)

      if (draft) patchDraft(draftIdx, updatedRow)
      else patchServerRow(p, localIdx, updatedRow)

      const persist = persistRef.current
      if (!persist) return
      Promise.resolve(
        persist({ row: updatedRow, previousRow, columnId, value, isDraft: draft })
      )
        .then((serverRow) => {
          if (serverRow == null) return
          // Merge — the persist's return is treated as a partial; only the
          // fields it actually carries overwrite the cache, so any concurrent
          // edits to other fields survive.
          const partial = serverRow as unknown as Record<string, unknown>
          if (draft) mergeDraftPartial(draftIdx, partial)
          else mergeServerRowPartial(p, localIdx, partial)
        })
        .catch((e) => {
          // Roll back ONLY the failed field, not the whole row — otherwise we
          // wipe out concurrent edits on other fields that succeeded.
          const prevValue = (previousRow as Record<string, unknown>)[columnId]
          const rollback = { [columnId]: prevValue }
          if (draft) mergeDraftPartial(draftIdx, rollback)
          else mergeServerRowPartial(p, localIdx, rollback)
          setError(e)
        })
    },
    [
      serverRowCount,
      draftRows,
      mode,
      page,
      pageSize,
      pageOf,
      localIndexOf,
      patchDraft,
      patchServerRow,
      mergeDraftPartial,
      mergeServerRowPartial
    ]
  )

  const appendDraftRow = React.useCallback((): number | undefined => {
    if (!makeDraftRow) return undefined
    const newIndex = serverRowCount + draftRows.length
    setDraftRows((prev) => [...prev, makeDraftRow()])
    return newIndex
  }, [makeDraftRow, serverRowCount, draftRows.length])

  const setPage = React.useCallback((p: number) => {
    setPageState(Math.max(1, p))
  }, [])

  const refresh = React.useCallback(() => {
    resetAndReload(mode === 'paginated' ? page : 1)
  }, [resetAndReload, mode, page])

  const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 0

  return {
    rowCount,
    getRow,
    onVisibleRowsChange,
    isInitialLoading,
    error,
    refresh,
    commitEdit,
    appendDraftRow,
    isDraftRow,
    page,
    setPage,
    pageCount,
    total
  }
}
