/**
 * Public types for `@baseportal/grid-table`.
 *
 * See the README for the phased build — this file grows with each phase.
 */
import type { Theme as GlideTheme } from '@glideapps/glide-data-grid'

import type {
  GetCell,
  GridCellEdit,
  GridCustomEditorComponent
} from './cells/types'

export interface GridColumnDef {
  /** Stable identifier — in the collections module this is the field `name`. */
  id: string
  /** Header label shown to the user. */
  title: string
  /** Initial pixel width. Defaults to {@link DEFAULT_COLUMN_WIDTH}. */
  width?: number
  /** Marks the collection's primary-key column (renders a key icon later). */
  isPrimary?: boolean
  /**
   * Allows inline editing of this column's cells. Only has effect when
   * `onCellEdit` is passed to {@link GridTable}, and currently only for cell
   * kinds glide can edit natively (`text`, `number`, `boolean`, `uri`).
   */
  editable?: boolean
  /** Hidden columns are skipped entirely (kept in the array so widths persist). */
  hidden?: boolean
}

/** A screen-space rectangle (e.g. a header cell's bounds, for anchoring a menu). */
export interface GridBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface GridTableProps {
  columns: GridColumnDef[]
  /**
   * Total number of rows. Always known: the records API paginates and returns
   * a total even when the UI scrolls infinitely.
   */
  rowCount: number
  /** Returns the cell descriptor for a column id / zero-based row index. */
  getCell: GetCell
  /**
   * Glide theme overrides. Use {@link glideThemeFromMui} to derive these from
   * the app's Material-UI theme.
   */
  theme?: Partial<GlideTheme>
  /** Container height. Defaults to `'100%'` — wrap in a sized box. */
  height?: number | string
  /** Container width. Defaults to `'100%'`. */
  width?: number | string
  /** Row height in px. Defaults to a compact 33. */
  rowHeight?: number
  /** Header height in px. Defaults to a compact 34. */
  headerHeight?: number
  /** Called with the full id→width map whenever the user resizes a column. */
  onColumnWidthsChange?: (widths: Record<string, number>) => void
  /**
   * Fires when the visible row range changes (scroll/resize). Wire this to
   * {@link useGridData}'s `onVisibleRowsChange` so upcoming pages prefetch.
   * `endRow` is exclusive-ish (last visible row + 1).
   */
  onVisibleRowsChange?: (range: { startRow: number; endRow: number }) => void
  /**
   * Enables inline editing. Fires when the user commits an edit on an editable
   * column. Wire to {@link useGridData}'s `commitEdit`.
   */
  onCellEdit?: (edit: GridCellEdit) => void
  /**
   * Fires when the user activates a cell (double-click or Enter). Use this when
   * the cell shouldn't open glide's inline overlay (column `editable: false`)
   * but you still want a click-to-edit gesture — e.g. to pop open a drawer
   * managed outside the grid.
   */
  onCellActivated?: (event: { columnId: string; rowIndex: number }) => void
  /**
   * Enables the trailing "+ New row" affordance. Should append a row (e.g.
   * {@link useGridData}'s `appendDraftRow`); return the new row's index to have
   * the grid scroll/focus it.
   */
  onAppendRow?: () => number | void
  /**
   * Enables column drag-to-reorder. `fromIndex` / `toIndex` are positions in the
   * `columns` array you passed (hidden columns included). Reorder your array and
   * pass it back; persist as needed.
   */
  onColumnReorder?: (fromIndex: number, toIndex: number) => void
  /**
   * Fires when a column header is clicked, with the header's screen bounds (for
   * anchoring a menu — rename / hide / delete / sort).
   */
  onHeaderMenu?: (columnId: string, bounds: GridBounds) => void
  /**
   * Enables a trailing "+" column in the header. Fires (with that header's
   * screen bounds) when it's clicked — open your "add column" menu there.
   */
  onAddColumn?: (bounds: GridBounds) => void
  /** Shows a leading checkbox column for multi-row selection. */
  enableRowSelection?: boolean
  /** Called with the number of selected rows whenever the selection changes. */
  onSelectionChange?: (selectedRowCount: number) => void
  /**
   * Overlay editor components keyed by the `editorKey` of `{ kind: 'custom' }`
   * descriptors. Lets the app plug in its own React edit UIs (currency, date,
   * relation/client/admin pickers, long text, …). A custom cell is editable
   * only when its column is `editable` *and* an editor is registered here.
   */
  editors?: Record<string, GridCustomEditorComponent>
}

export const DEFAULT_COLUMN_WIDTH = 150
