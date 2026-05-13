'use client'

import * as React from 'react'
import {
  CompactSelection,
  DataEditor,
  GridCellKind,
  type DataEditorProps,
  type DataEditorRef,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridSelection,
  type Item,
  type Rectangle,
  type Theme as GlideTheme
} from '@glideapps/glide-data-grid'
// These names are the *renderers* (exported under the cell-type names).
import {
  TagsCell as TagsCellRenderer,
  UserProfileCell as UserProfileCellRenderer
} from '@glideapps/glide-data-grid-cells'

// Glide (and the extra cells) ship their own stylesheets; we own them here so
// consumers don't have to. These imports stay external in the tsup build and
// are resolved by the consuming app's bundler.
import '@glideapps/glide-data-grid/dist/index.css'
import '@glideapps/glide-data-grid-cells/dist/index.css'

import {
  baseportalCustomCellRenderer,
  GridEditorsContext
} from './cells/customCell'
import { descriptorToCell, editedCellValue } from './cells/descriptorToCell'
import type { GridCustomEditorComponent } from './cells/types'
import { DEFAULT_COLUMN_WIDTH, type GridColumnDef, type GridTableProps } from './types'

const COMPACT_ROW_HEIGHT = 33
const COMPACT_HEADER_HEIGHT = 34
const ADD_COLUMN_WIDTH = 44
/** Id of the synthetic trailing "+" column (when `onAddColumn` is set). */
const ADD_COLUMN_ID = '__grid_add_column__'

const EMPTY_CELL: GridCell = {
  kind: GridCellKind.Text,
  data: '',
  displayData: '',
  allowOverlay: false
}

// Only the renderers we actually use — keeps react-select / toast-ui (pulled in
// by the other extra cells) out of the bundle.
const CUSTOM_RENDERERS: DataEditorProps['customRenderers'] = [
  TagsCellRenderer,
  UserProfileCellRenderer,
  baseportalCustomCellRenderer
]

const EMPTY_EDITORS: Record<string, GridCustomEditorComponent> = {}

const EMPTY_SELECTION: GridSelection = {
  columns: CompactSelection.empty(),
  rows: CompactSelection.empty()
}

/**
 * Glide renders its cell-editing overlay into a `<div id="portal">` at the end
 * of `<body>`. Rather than make every consumer add it to their layout, create
 * it on demand the first time a grid mounts.
 */
function ensurePortalElement(): void {
  if (typeof document === 'undefined' || document.getElementById('portal'))
    return
  const portal = document.createElement('div')
  portal.id = 'portal'
  portal.style.position = 'fixed'
  portal.style.left = '0'
  portal.style.top = '0'
  portal.style.zIndex = '9999'
  document.body.appendChild(portal)
}

/** Imperative handle for {@link GridTable}. */
export interface GridTableRef {
  /**
   * Appends a row via the trailing-row flow (calls `onAppendRow`, scrolls to the
   * new row). When `openEditor` is true, opens the editor on the new row's first
   * column — matching today's collections "add row, focus first cell" behaviour.
   */
  appendRow: (openEditor?: boolean) => void
  /** Scrolls the given row into view. */
  scrollToRow: (rowIndex: number) => void
  /** Indices of the currently selected rows (empty when row selection is off). */
  getSelectedRowIndices: () => number[]
  /** Clears the row selection. */
  clearSelection: () => void
}

/**
 * Canvas-based data grid.
 *
 * - Virtualized render over a known `rowCount`; rich cell kinds via
 *   {@link descriptorToCell} (incl. chips/avatars from `@glideapps/glide-data-grid-cells`).
 * - Resizable & reorderable columns; column visibility via `GridColumnDef.hidden`.
 * - Themable via a glide `theme` (use `glideThemeFromMui`).
 * - `onVisibleRowsChange` reports the visible range for prefetching.
 * - Optional inline editing (`onCellEdit` + per-column `editable`), trailing
 *   "+ New row" (`onAppendRow`), trailing "+" column (`onAddColumn`), header
 *   menu (`onHeaderMenu`), and checkbox row selection (`enableRowSelection`).
 * - Imperative `appendRow` / `scrollToRow` / selection helpers via a forwarded
 *   ref ({@link GridTableRef}).
 */
export const GridTable = React.forwardRef<GridTableRef, GridTableProps>(
  function GridTable(
    {
      columns,
      rowCount,
      getCell,
      theme,
      height = '100%',
      width = '100%',
      rowHeight = COMPACT_ROW_HEIGHT,
      headerHeight = COMPACT_HEADER_HEIGHT,
      onColumnWidthsChange,
      onVisibleRowsChange,
      onCellEdit,
      onCellActivated,
      onAppendRow,
      onColumnReorder,
      onHeaderMenu,
      onAddColumn,
      enableRowSelection,
      onSelectionChange,
      editors
    },
    ref
  ) {
    const editorRef = React.useRef<DataEditorRef>(null)

    React.useEffect(() => {
      ensurePortalElement()
    }, [])

    // --- columns: visible subset + optional synthetic trailing "+" column ---
    const renderedColumnDefs = React.useMemo<GridColumnDef[]>(() => {
      const visible = columns.filter((c) => !c.hidden)
      if (!onAddColumn) return visible
      return [
        ...visible,
        { id: ADD_COLUMN_ID, title: '＋', width: ADD_COLUMN_WIDTH }
      ]
    }, [columns, onAddColumn])

    const isAddColumn = (colIndex: number) =>
      renderedColumnDefs[colIndex]?.id === ADD_COLUMN_ID

    // Width overrides from user drags, keyed by column id.
    const [widthOverrides, setWidthOverrides] = React.useState<
      Record<string, number>
    >({})

    React.useEffect(() => {
      setWidthOverrides((prev) => {
        const ids = new Set(columns.map((c) => c.id))
        let changed = false
        const next: Record<string, number> = {}
        for (const [id, w] of Object.entries(prev)) {
          if (ids.has(id)) next[id] = w
          else changed = true
        }
        return changed ? next : prev
      })
    }, [columns])

    const gridColumns = React.useMemo<GridColumn[]>(
      () =>
        renderedColumnDefs.map((column) => ({
          id: column.id,
          title: column.title,
          width:
            column.id === ADD_COLUMN_ID
              ? ADD_COLUMN_WIDTH
              : (widthOverrides[column.id] ??
                column.width ??
                DEFAULT_COLUMN_WIDTH),
          hasMenu: false
        })),
      [renderedColumnDefs, widthOverrides]
    )

    // --- selection ---
    const [selection, setSelection] = React.useState<GridSelection>(
      EMPTY_SELECTION
    )

    const handleGridSelectionChange = React.useCallback(
      (next: GridSelection) => {
        setSelection(next)
        onSelectionChange?.(next.rows.length)
      },
      [onSelectionChange]
    )

    React.useImperativeHandle(
      ref,
      () => ({
        appendRow: (openEditor = false) => {
          void editorRef.current?.appendRow(0, openEditor)
        },
        scrollToRow: (rowIndex: number) => {
          editorRef.current?.scrollTo(0, rowIndex)
        },
        getSelectedRowIndices: () => selection.rows.toArray(),
        clearSelection: () => setSelection(EMPTY_SELECTION)
      }),
      [selection]
    )

    // --- cells ---
    const editingEnabled = !!onCellEdit

    const getCellContent = React.useCallback(
      ([colIndex, rowIndex]: Item): GridCell => {
        const column = renderedColumnDefs[colIndex]
        if (
          !column ||
          column.id === ADD_COLUMN_ID ||
          rowIndex < 0 ||
          rowIndex >= rowCount
        ) {
          return EMPTY_CELL
        }
        try {
          const descriptor = getCell(column.id, rowIndex)
          let editable = editingEnabled && !!column.editable
          if (editable && descriptor.kind === 'custom') {
            editable = !!editors && !!editors[descriptor.editorKey]
          }
          return descriptorToCell(descriptor, editable)
        } catch {
          return EMPTY_CELL
        }
      },
      [renderedColumnDefs, rowCount, getCell, editingEnabled, editors]
    )

    const handleCellActivated = React.useCallback(
      ([colIndex, rowIndex]: Item) => {
        const column = renderedColumnDefs[colIndex]
        if (!column || column.id === ADD_COLUMN_ID) return
        onCellActivated?.({ columnId: column.id, rowIndex })
      },
      [renderedColumnDefs, onCellActivated]
    )

    const handleCellEdited = React.useCallback(
      ([colIndex, rowIndex]: Item, newValue: EditableGridCell) => {
        const column = renderedColumnDefs[colIndex]
        if (!column || column.id === ADD_COLUMN_ID) return
        onCellEdit?.({
          columnId: column.id,
          rowIndex,
          value: editedCellValue(newValue)
        })
      },
      [renderedColumnDefs, onCellEdit]
    )

    // --- columns: resize / reorder ---
    const handleColumnResize = React.useCallback(
      (_column: GridColumn, newSize: number, colIndex: number) => {
        if (isAddColumn(colIndex)) return
        const id = renderedColumnDefs[colIndex]?.id
        if (!id) return
        // Compute the new map outside of `setWidthOverrides`'s updater fn:
        // calling `onColumnWidthsChange` (which may setState in a parent) from
        // inside an updater triggers React's "Cannot update a component while
        // rendering a different component" warning, since updaters run during
        // the state-batching/render phase.
        const next = { ...widthOverrides, [id]: newSize }
        setWidthOverrides(next)
        onColumnWidthsChange?.(next)
      },
      [widthOverrides, renderedColumnDefs, onColumnWidthsChange]
    )

    const handleColumnMoved = React.useCallback(
      (renderedFrom: number, renderedTo: number) => {
        const fromCol = renderedColumnDefs[renderedFrom]
        const toCol = renderedColumnDefs[renderedTo]
        if (
          !fromCol ||
          !toCol ||
          fromCol.id === ADD_COLUMN_ID ||
          toCol.id === ADD_COLUMN_ID
        ) {
          return
        }
        const from = columns.findIndex((c) => c.id === fromCol.id)
        const to = columns.findIndex((c) => c.id === toCol.id)
        if (from < 0 || to < 0 || from === to) return
        onColumnReorder?.(from, to)
      },
      [renderedColumnDefs, columns, onColumnReorder]
    )

    // --- header / add-column / append-row ---
    const toBounds = (r: Rectangle) => ({
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height
    })

    const handleHeaderClicked = React.useCallback(
      (colIndex: number, args: { bounds: Rectangle }) => {
        const column = renderedColumnDefs[colIndex]
        if (!column) return
        if (column.id === ADD_COLUMN_ID) onAddColumn?.(toBounds(args.bounds))
        else onHeaderMenu?.(column.id, toBounds(args.bounds))
      },
      [renderedColumnDefs, onAddColumn, onHeaderMenu]
    )

    const handleRowAppended = React.useCallback(() => {
      const newIndex = onAppendRow?.()
      return Promise.resolve<'bottom' | number>(
        typeof newIndex === 'number' ? newIndex : 'bottom'
      )
    }, [onAppendRow])

    const handleVisibleRegionChanged = React.useCallback(
      (range: Rectangle) => {
        onVisibleRowsChange?.({
          startRow: range.y,
          endRow: range.y + range.height
        })
      },
      [onVisibleRowsChange]
    )

    const headerClickEnabled = !!onHeaderMenu || !!onAddColumn

    return (
      <GridEditorsContext.Provider value={editors ?? EMPTY_EDITORS}>
        <div style={{ height, width }}>
          <DataEditor
            ref={editorRef}
            columns={gridColumns}
            rows={rowCount}
            getCellContent={getCellContent}
            customRenderers={CUSTOM_RENDERERS}
            // `checkbox-visible` keeps the marker column visible at rest;
            // plain `'checkbox'` fades them in only on row hover, which made
            // multi-row selection awkward in busy grids.
            rowMarkers={enableRowSelection ? 'checkbox-visible' : undefined}
            // `rowSelectionMode="multi"` makes each checkbox click *toggle*
            // that row independently; glide's default "auto" requires Cmd/Shift
            // to extend the selection — that's what made each new click feel
            // like it replaced the previous one. `rowSelectionBlending="mixed"`
            // keeps the row selection alive when the user clicks a cell to
            // navigate (otherwise a stray cell click clears the selection
            // chosen for the bulk action).
            rowSelect={enableRowSelection ? 'multi' : 'none'}
            rowSelectionMode={enableRowSelection ? 'multi' : undefined}
            rowSelectionBlending={enableRowSelection ? 'mixed' : undefined}
            gridSelection={enableRowSelection ? selection : undefined}
            onGridSelectionChange={
              enableRowSelection ? handleGridSelectionChange : undefined
            }
            onColumnResize={handleColumnResize}
            onColumnMoved={onColumnReorder ? handleColumnMoved : undefined}
            onHeaderClicked={
              headerClickEnabled ? handleHeaderClicked : undefined
            }
            onVisibleRegionChanged={
              onVisibleRowsChange ? handleVisibleRegionChanged : undefined
            }
            onCellEdited={editingEnabled ? handleCellEdited : undefined}
            onCellActivated={
              onCellActivated ? handleCellActivated : undefined
            }
            onRowAppended={onAppendRow ? handleRowAppended : undefined}
            trailingRowOptions={
              onAppendRow
                ? { sticky: false, tint: true, hint: '+ New row' }
                : undefined
            }
            rowHeight={rowHeight}
            headerHeight={headerHeight}
            theme={theme as Partial<GlideTheme> | undefined}
            smoothScrollX
            smoothScrollY
            width="100%"
            height="100%"
          />
        </div>
      </GridEditorsContext.Provider>
    )
  }
)
