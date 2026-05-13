'use client'

import * as React from 'react'
import {
  GridCellKind,
  type CustomCell,
  type CustomRenderer,
  type ProvideEditorComponent
} from '@glideapps/glide-data-grid'

import type { GridCustomEditorComponent } from './types'

export interface BaseportalCustomCellData {
  readonly kind: 'baseportal-custom-cell'
  readonly editorKey: string
  readonly display: string
  readonly value: unknown
  readonly editorContext?: unknown
}

export type BaseportalCustomCell = CustomCell<BaseportalCustomCellData>

/** Per-`GridTable`-instance map of overlay editor components, keyed by `editorKey`. */
export const GridEditorsContext = React.createContext<
  Record<string, GridCustomEditorComponent>
>({})

const Editor: ProvideEditorComponent<BaseportalCustomCell> = (props) => {
  const editors = React.useContext(GridEditorsContext)
  const cell = props.value
  // Track the latest value so an editor that does `onChange(v); onClose()`
  // synchronously still commits `v` (the re-render from onChange hasn't run yet).
  const draftRef = React.useRef(cell)
  draftRef.current = cell

  const Component = editors[cell.data.editorKey]
  if (!Component) return null

  return (
    <div style={{ display: 'flex', minWidth: 220, boxSizing: 'border-box' }}>
      <Component
        value={cell.data.value}
        context={cell.data.editorContext}
        onChange={(value) => {
          const next: BaseportalCustomCell = {
            ...cell,
            data: { ...cell.data, value }
          }
          draftRef.current = next
          props.onChange(next)
        }}
        onClose={() => props.onFinishedEditing(draftRef.current)}
      />
    </div>
  )
}

/**
 * The single custom renderer the package registers. It draws `display` as text
 * and, on overlay, mounts the app-supplied React editor for `editorKey` (looked
 * up from {@link GridEditorsContext}). Lets the collections module reuse its
 * existing rich edit components (currency, date picker, relation/client/admin
 * find menus, long-text editor, …) without the package knowing about any of them.
 */
export const baseportalCustomCellRenderer: CustomRenderer<BaseportalCustomCell> = {
  kind: GridCellKind.Custom,
  isMatch: (c): c is BaseportalCustomCell =>
    (c.data as { kind?: string } | undefined)?.kind === 'baseportal-custom-cell',
  draw: (args, cell) => {
    const { ctx, theme, rect } = args
    ctx.save()
    ctx.fillStyle = theme.textDark
    ctx.textBaseline = 'middle'
    ctx.fillText(
      cell.data.display ?? '',
      rect.x + (theme.cellHorizontalPadding ?? 8),
      rect.y + rect.height / 2
    )
    ctx.restore()
    return true
  },
  provideEditor: () => ({ editor: Editor, disablePadding: true }),
  onPaste: (value, data) => ({ ...data, value })
}
