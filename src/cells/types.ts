/**
 * Cell descriptors — the app describes *what* a cell shows; the package maps
 * that to a glide `GridCell` (built-in, from `@glideapps/glide-data-grid-cells`,
 * or the package's `baseportal-custom-cell` which delegates editing to an
 * app-supplied React editor).
 *
 * This is the surface the collections adapter targets: one descriptor per record
 * field type.
 */
import type * as React from 'react'

export type GridTone = 'neutral' | 'info' | 'success' | 'warning' | 'error'

export type GridCellDescriptor =
  /** Row data not loaded yet — renders a skeleton/shimmer cell. */
  | { kind: 'loading' }
  /** Plain text. */
  | { kind: 'text'; value: string | null | undefined }
  /** Numeric value, right-aligned; `display` overrides the rendered string. */
  | { kind: 'number'; value: number | null | undefined; display?: string }
  /** Checkbox. */
  | { kind: 'boolean'; value: boolean | null | undefined }
  /** Pre-formatted money string supplied by the app (locale/currency aware). */
  | { kind: 'currency'; display: string; raw?: number | null }
  /** Single chip — e.g. a `select` field option. */
  | { kind: 'singleSelect'; value: string | null | undefined }
  /** Multiple coloured chips — `multiSelect`, `relation`, tags. */
  | { kind: 'tags'; values: string[] }
  /** Pre-formatted date/time string supplied by the app. */
  | { kind: 'date'; display: string }
  /** Avatar + name — `client` / `administrator` fields. */
  | { kind: 'user'; name: string; imageUrl?: string | null }
  /** Small neutral badge — `json` payloads, attachment counts, etc. */
  | { kind: 'badge'; label: string; tone?: GridTone }
  /** Hyperlink (email, URL fields). */
  | { kind: 'uri'; value: string; display?: string }
  /** Image thumbnails — `attachment` fields. */
  | { kind: 'image'; urls: string[] }
  /**
   * App-rendered/edited cell: draws `display`, and (when the column is editable
   * and `editorKey` is registered in `GridTable.editors`) opens that React
   * editor on overlay. `value` is whatever the editor reads/writes.
   */
  | {
      kind: 'custom'
      /** Looks up the editor in `GridTable.editors`. */
      editorKey: string
      /** Text drawn in the cell. */
      display: string
      /** Current value passed to the editor; written back via `onChange`. */
      value: unknown
      /** Clipboard string (defaults to `display`). */
      copyData?: string
      /**
       * Read-only context the editor needs (field name, validation rules, etc.).
       * Not persisted; just flows through to the editor as `context`.
       */
      editorContext?: unknown
    }

/** Returns the cell descriptor for a column id / zero-based row index. */
export type GetCell = (
  columnId: string,
  rowIndex: number
) => GridCellDescriptor

/** A value committed by an edit. Primitive for built-in editors, anything for custom ones. */
export type GridEditValue = unknown

/** An inline edit committed by the user. */
export interface GridCellEdit {
  columnId: string
  rowIndex: number
  value: GridEditValue
}

/** Props an app-supplied overlay editor (registered via `GridTable.editors`) receives. */
export interface GridCustomEditorProps {
  /** Current cell value. */
  value: unknown
  /** Read-only descriptor `editorContext` (field name, options, etc.). */
  context: unknown
  /** Write a new value (commits when the overlay closes). */
  onChange: (value: unknown) => void
  /** Close the overlay (committing the last `onChange`d value). */
  onClose: () => void
}

export type GridCustomEditorComponent = React.ComponentType<GridCustomEditorProps>
