import { GridCellKind, type GridCell } from '@glideapps/glide-data-grid'

import type { GridCellDescriptor } from './types'

/** Deterministic pastel for a tag/label so the same value always gets the same chip colour. */
function hashHue(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

const chipColor = (value: string) => `hsl(${hashHue(value)}, 60%, 85%)`
const avatarTint = (value: string) => `hsl(${hashHue(value)}, 55%, 50%)`

/** A read-only text cell that still allows the overlay (so long values are viewable). */
function textCell(text: string, editable: boolean): GridCell {
  return {
    kind: GridCellKind.Text,
    data: text,
    displayData: text,
    allowOverlay: true,
    readonly: !editable
  }
}

/**
 * Maps an app-level {@link GridCellDescriptor} to a glide `GridCell`.
 *
 * `editable` toggles inline editing for the kinds glide can edit out of the box
 * (`text`, `number`, `boolean`). `currency`/`date` stay read-only even when the
 * column is editable — their editors are app-supplied overlay editors added in
 * a later phase; same for `singleSelect`/`tags`/`user`/etc.
 */
export function descriptorToCell(
  descriptor: GridCellDescriptor,
  editable = false
): GridCell {
  switch (descriptor.kind) {
    case 'loading':
      return { kind: GridCellKind.Loading, allowOverlay: false }

    case 'text':
      return textCell(
        descriptor.value == null ? '' : String(descriptor.value),
        editable
      )

    case 'number': {
      const value =
        typeof descriptor.value === 'number' && Number.isFinite(descriptor.value)
          ? descriptor.value
          : undefined
      return {
        kind: GridCellKind.Number,
        data: value,
        displayData:
          descriptor.display ?? (value == null ? '' : String(value)),
        allowOverlay: true,
        readonly: !editable
      }
    }

    case 'boolean':
      return {
        kind: GridCellKind.Boolean,
        data: descriptor.value == null ? undefined : descriptor.value,
        allowOverlay: false,
        readonly: !editable
      }

    case 'currency':
      return textCell(descriptor.display, false)

    case 'date':
      return textCell(descriptor.display, false)

    case 'singleSelect': {
      const value = descriptor.value
      if (!value) return textCell('', false)
      return {
        kind: GridCellKind.Custom,
        allowOverlay: true,
        copyData: value,
        data: {
          kind: 'tags-cell',
          possibleTags: [{ tag: value, color: chipColor(value) }],
          tags: [value]
        }
      } as GridCell
    }

    case 'tags': {
      const values = descriptor.values ?? []
      return {
        kind: GridCellKind.Custom,
        allowOverlay: true,
        copyData: values.join(', '),
        data: {
          kind: 'tags-cell',
          possibleTags: values.map((tag) => ({ tag, color: chipColor(tag) })),
          tags: values
        }
      } as GridCell
    }

    case 'user': {
      const name = descriptor.name ?? ''
      return {
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: name,
        data: {
          kind: 'user-profile-cell',
          image: descriptor.imageUrl ?? '',
          initial: (name.trim()[0] ?? '?').toUpperCase(),
          tint: avatarTint(name || '?'),
          name
        }
      } as GridCell
    }

    case 'badge':
      return {
        kind: GridCellKind.Bubble,
        data: descriptor.label ? [descriptor.label] : [],
        allowOverlay: true
      }

    case 'uri':
      return {
        kind: GridCellKind.Uri,
        data: descriptor.value ?? '',
        displayData: descriptor.display ?? descriptor.value ?? '',
        allowOverlay: true,
        readonly: !editable,
        hoverEffect: true
      }

    case 'image':
      return {
        kind: GridCellKind.Image,
        data: descriptor.urls ?? [],
        displayData: descriptor.urls ?? [],
        allowOverlay: true
      }

    case 'custom':
      return {
        kind: GridCellKind.Custom,
        allowOverlay: editable,
        copyData: descriptor.copyData ?? descriptor.display,
        data: {
          kind: 'baseportal-custom-cell',
          editorKey: descriptor.editorKey,
          display: descriptor.display,
          value: descriptor.value,
          editorContext: descriptor.editorContext
        }
      } as GridCell

    default: {
      // Exhaustiveness guard — a new descriptor kind without a branch fails here.
      const _never: never = descriptor
      return textCell(String(_never), false)
    }
  }
}

/**
 * Extracts the value out of an edited glide cell — the primitive `data` for
 * Text / Number / Boolean / Uri, or `data.value` for our `baseportal-custom-cell`.
 */
export function editedCellValue(cell: GridCell): unknown {
  switch (cell.kind) {
    case GridCellKind.Text:
    case GridCellKind.Number:
    case GridCellKind.Boolean:
    case GridCellKind.Uri:
      return cell.data
    case GridCellKind.Custom: {
      const data = cell.data as { kind?: string; value?: unknown }
      return data?.kind === 'baseportal-custom-cell' ? data.value : undefined
    }
    default:
      return undefined
  }
}
