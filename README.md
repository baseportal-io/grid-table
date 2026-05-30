# @baseportal/grid-table

[![npm version](https://img.shields.io/npm/v/@baseportal/grid-table.svg)](https://www.npmjs.com/package/@baseportal/grid-table)
[![license](https://img.shields.io/npm/l/@baseportal/grid-table.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@baseportal/grid-table)](https://bundlephobia.com/package/@baseportal/grid-table)

> Fast canvas-rendered data grid for React, built on
> [`@glideapps/glide-data-grid`](https://github.com/glideapps/glide-data-grid)
> with a higher-level API, a windowed data layer, draft rows, and app-supplied
> overlay editors.

`@baseportal/grid-table` was extracted from [Baseportal](https://baseportal.io)'s
collections module, where it replaces MUI X DataGrid Pro and powers tables with
**millions of rows**. The runtime stays the proven glide canvas; this package
adds an ergonomic component, an opinionated cell-descriptor model, a paginated
or infinite data layer, and a Material-UI theme bridge — so you can render an
Airtable-style table in a few dozen lines instead of wiring glide from scratch.

```tsx
<GridTable
  columns={columns}
  rowCount={rowCount}
  getCell={getCell}
  onCellEdit={commitEdit}
  onVisibleRowsChange={onVisibleRowsChange}
  editors={{ currency: CurrencyEditor, date: DateEditor }}
/>
```

---

## Why

`glide-data-grid` is unmatched for raw rendering throughput — it's the engine
behind a number of production spreadsheets — but it's also a low-level canvas
component. Building a real product on top of it means writing your own:

- cell-kind abstraction over glide's `GridCell` union,
- windowed pager (`rowIndex` → page fetch, LRU eviction, prefetch on scroll),
- optimistic-edit machinery,
- draft-row affordance for "+ Add row",
- overlay editors registry,
- theme bridge for your design system.

This package ships all of that, generically. It does **not** know about
collections, fields, REST endpoints, or `services/api` — the consuming app
supplies a `GridDataSource` and (optionally) custom editor components, and the
package handles everything else.

---

## Features

- **Canvas rendering** via `glide-data-grid` — smooth at hundreds of thousands
  of rows, tested up to several millions.
- **Two scrolling modes** — `paginated` (one page at a time, classic numbered
  pager) or `infinite` (random-access page cache with LRU eviction).
- **Windowed data layer** — `useGridData` hook turns a page-based data source
  into a row-indexed view; prefetches as the user scrolls.
- **Cell descriptors** — `text`, `number`, `boolean`, `currency`, `date`,
  `singleSelect`, `tags`, `user`, `badge`, `uri`, `image`, `loading`, and a
  `custom` kind that delegates rendering text + overlay editing to the app.
- **Inline editing** for text / number / boolean / uri with optimistic update
  + persist callback + rollback on throw.
- **Draft rows** — trailing "+ New row" affordance, draft lives client-side
  until the first edit triggers `onPersistEdit({ isDraft: true })`.
- **Column reorder / resize / hide / "+" header** — wired up out of the box.
- **Row selection** — checkbox column with range-based "select all".
- **App-supplied overlay editors** — register a React component under an
  `editorKey`; the package opens it as glide's overlay editor with the cell's
  value + read-only context.
- **MUI theme bridge** — `glideThemeFromMui()` derives glide's theme tokens
  (including dark mode) from your Material-UI theme; the package itself does
  not depend on `@mui/material`.
- **Imperative ref** — `appendRow`, `scrollToRow`, `getSelectedRowIndices`,
  `clearSelection`.
- **Tree-shaken** — ESM + CJS bundles via `tsup`, `'use client'` banner so
  Next.js App Router consumers don't have to wrap it.

---

## Install

```bash
pnpm add @baseportal/grid-table @glideapps/glide-data-grid @glideapps/glide-data-grid-cells
# or
npm install @baseportal/grid-table @glideapps/glide-data-grid @glideapps/glide-data-grid-cells
# or
yarn add @baseportal/grid-table @glideapps/glide-data-grid @glideapps/glide-data-grid-cells
```

Peer dependencies: `react >= 18`, `react-dom >= 18`. Tested against React 18
and 19.

> **Note** — glide-data-grid 6.x declares its React peer as `^16 || 17 || 18`.
> It works fine with React 19 in practice; if pnpm complains, relax the peer
> check in your root config:
>
> ```jsonc
> // package.json
> {
>   "pnpm": {
>     "peerDependencyRules": {
>       "allowedVersions": {
>         "@glideapps/glide-data-grid>react": "19",
>         "@glideapps/glide-data-grid>react-dom": "19"
>       }
>     }
>   }
> }
> ```

### Next.js

The package is client-only (it imports glide's stylesheet and renders to
canvas). It already ships with a `'use client'` banner, so you can import it
from server or client components without an extra wrapper.

If you're using `next/font` and want the grid to inherit your font, pass it
through the theme:

```tsx
<GridTable theme={{ fontFamily: 'var(--font-inter)' }} />
```

---

## Quick start

```tsx
'use client'

import {
  GridTable,
  useGridData,
  type GridColumnDef,
  type GridDataSource
} from '@baseportal/grid-table'

interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

const columns: GridColumnDef[] = [
  { id: 'name', title: 'Name', width: 220, editable: true },
  { id: 'email', title: 'Email', width: 280, editable: true },
  { id: 'createdAt', title: 'Created', width: 180 }
]

const source: GridDataSource<User> = {
  async fetchPage({ page, pageSize, signal }) {
    const res = await fetch(`/api/users?page=${page}&perPage=${pageSize}`, {
      signal
    })
    const json = await res.json()
    return { rows: json.data, total: json.total }
  }
}

export function UsersTable() {
  const { rowCount, getRow, onVisibleRowsChange, commitEdit } =
    useGridData<User>({
      source,
      pageSize: 50,
      mode: 'infinite',
      onPersistEdit: async ({ row }) => {
        await fetch(`/api/users/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify(row)
        })
      }
    })

  return (
    <div style={{ height: 600 }}>
      <GridTable
        columns={columns}
        rowCount={rowCount}
        getCell={(columnId, rowIndex) => {
          const row = getRow(rowIndex)
          if (!row) return { kind: 'loading' }
          const value = row[columnId as keyof User]
          return { kind: 'text', value: value == null ? null : String(value) }
        }}
        onVisibleRowsChange={onVisibleRowsChange}
        onCellEdit={commitEdit}
      />
    </div>
  )
}
```

That's a fully working windowed, editable table. The grid will keep `rowCount`
empty until the first page returns; cells request rows by index and `getRow`
returns `undefined` for not-yet-loaded indices, which renders the built-in
loading cell while the page fetches in the background.

---

## Concepts

### Columns

A column is a stable id + a display title + presentation flags:

```ts
interface GridColumnDef {
  id: string // stable identifier (also used by `getCell`)
  title: string // header label
  width?: number // initial pixel width (default 150)
  isPrimary?: boolean // marks the primary-key column
  editable?: boolean // allow inline editing on this column's cells
  hidden?: boolean // skipped from rendering (keeps array positions for widths)
}
```

Pass the array to `<GridTable columns={...}>`. Persist width changes via
`onColumnWidthsChange` (you get a `{ id: width }` map); reorder via
`onColumnReorder(fromIndex, toIndex)`; hide via `hidden: true` on the next
render.

### Cell descriptors

Your `getCell(columnId, rowIndex)` returns a **descriptor** — a small union
that describes *what* the cell shows, not *how* glide renders it. The package
maps descriptors to glide's native cells (and to `@glideapps/glide-data-grid-cells`
for chips/avatars) and applies sensible defaults.

```ts
type GridCellDescriptor =
  | { kind: 'loading' }
  | { kind: 'text'; value: string | null | undefined }
  | { kind: 'number'; value: number | null | undefined; display?: string }
  | { kind: 'boolean'; value: boolean | null | undefined }
  | { kind: 'currency'; display: string; raw?: number | null }
  | { kind: 'singleSelect'; value: string | null | undefined }
  | { kind: 'tags'; values: string[] }
  | { kind: 'date'; display: string }
  | { kind: 'user'; name: string; imageUrl?: string | null }
  | { kind: 'badge'; label: string; tone?: GridTone }
  | { kind: 'uri'; value: string; display?: string }
  | { kind: 'image'; urls: string[] }
  | {
      kind: 'custom'
      editorKey: string
      display: string
      value: unknown
      copyData?: string
      editorContext?: unknown
    }
```

This is the single integration surface: as long as you can map your data to
descriptors, the grid renders it. The descriptor model also keeps the package
ignorant of your business model — there is no "field type" enum inside; the
collections adapter, for example, lives entirely in the consuming app.

### Data source + `useGridData`

The package never makes a network call. You supply a `GridDataSource`:

```ts
interface GridDataSource<TRow> {
  fetchPage(params: {
    page: number // 1-based
    pageSize: number
    signal?: AbortSignal // aborted on filter/sort change or unmount
  }): Promise<{ rows: TRow[]; total: number }>
}
```

…and the `useGridData` hook turns that into a row-indexed view:

```ts
const {
  rowCount,
  getRow,
  onVisibleRowsChange,
  isInitialLoading,
  error,
  refresh,
  patchRow,
  commitEdit,
  appendDraftRow,
  isDraftRow,
  // paginated mode:
  page,
  setPage,
  pageCount,
  total
} = useGridData({
  source,
  pageSize: 50,
  mode: 'infinite' | 'paginated',
  resetKey, // anything; changing it drops the cache + refetches
  maxCachedPages: 20, // infinite: LRU cap on cached pages
  overscanRows, // infinite: extra rows fetched beyond the visible region
  mergeEdit, // (row, columnId, value) => newRow — default = shallow spread
  onPersistEdit, // ({ row, previousRow, columnId, value, isDraft }) => server row | void
  makeDraftRow // () => TRow — required to enable appendDraftRow
})
```

- **`infinite` mode** keeps a random-access cache of pages with LRU eviction.
  Scrolling to row 500 000 fetches exactly that page (not all the pages before
  it).
- **`paginated` mode** holds one page at a time — wire `page` / `setPage` /
  `pageCount` to your pager UI.
- **`resetKey`** is your "drop everything and refetch" trigger. Derive it from
  the active sort + filters: `JSON.stringify({ sort, filters })` is fine, or
  use a stable serializer.

`onVisibleRowsChange` from `<GridTable>` must be wired to the hook's
`onVisibleRowsChange` for prefetch to work.

### Inline editing

Columns marked `editable: true` open glide's inline editor for the kinds
glide handles natively (`text`, `number`, `boolean`, `uri`). For everything
else, see [Overlay editors](#overlay-editors).

When the user commits, `<GridTable onCellEdit>` fires with `{ rowIndex,
columnId, value }`. Forward it to `commitEdit` from `useGridData`:

```tsx
<GridTable onCellEdit={commitEdit} />
```

`commitEdit` applies an optimistic update (via `mergeEdit`, default = shallow
spread + set key), then calls your `onPersistEdit`. The contract:

| Return                          | Effect                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `undefined` / `void`            | Keep the optimistic row.                                  |
| A `TRow` (or `Partial<TRow>`)\* | Merge it into the cached row (reconcile with server data) |
| `throw`                         | Roll back this column to its previous value.              |

\* The hook merges partial returns rather than replacing the whole row, so two
rapid edits in different columns don't clobber each other.

### Side-band cache writes (`patchRow`)

Sometimes an editor learns about row metadata that isn't the cell's value.
The canonical case is an attachment editor: the cell's value is an array of
file ids (PATCH-ed via `commitEdit`), but the editor also fetched a
**signed URL** for each upload — that URL belongs on the row as a companion
field (e.g. `${fieldName}Urls`) so re-opening the editor renders thumbnails
without re-fetching.

`patchRow(rowIndex, partial)` writes the partial straight onto the cached
row. No persist, no `onPersistEdit` round-trip, no refetch — just a local
merge that fires a re-render of the affected cells.

```tsx
function AttachmentEditor({ context, onChange }: GridCustomEditorProps) {
  const { patchRow } = useEditorContext() // app-supplied context
  const { fieldName, rowIndex } = context as { fieldName: string; rowIndex: number }

  const handleUpload = async (files: FileList) => {
    const uploaded = await uploadAll(files) // [{ id, url, mimeType, ... }, ...]
    onChange(uploaded.map((u) => u.id))                       // value → commit
    patchRow(rowIndex, { [`${fieldName}Urls`]: uploaded })    // metadata → cache
  }
  // …
}
```

When to reach for it vs. returning a partial from `onPersistEdit`:

- **`patchRow`** — declarative, immediate, independent of any commit. Use
  when the metadata is learned in the editor and should land on the row
  whether or not a `commitEdit` follows.
- **`onPersistEdit` return-partial** — bundled with the persist's
  reconciliation. Use when the server's response carries the metadata
  (real id after a draft create, normalized timestamps, etc.).

### Draft rows ("+ New row")

To enable a trailing "+ New row" affordance:

1. Supply `makeDraftRow: () => TRow` to `useGridData`.
2. Pass `onAppendRow` on `<GridTable>` (typically delegating to
   `appendDraftRow()` from the hook).
3. In `onPersistEdit`, branch on `isDraft`:
   - `true` → create the row server-side. Return the server row (with its real
     id, timestamps, etc.) so the hook can swap the draft id for the real one.
   - `false` → patch the field as usual.

Draft rows live client-side at the bottom of the grid until the first edit
persists them. `isDraftRow(rowIndex)` tells them apart; `refresh()` clears
them.

### Overlay editors

Built-in editing covers primitives. For everything else — date pickers,
currency masks, autocomplete selects, attachment uploaders, rich text — you
emit a `custom` descriptor and register a React component:

```tsx
import { useEditorContext } from './editor-context' // your own

function CurrencyEditor({ value, context, onChange, onClose }) {
  // value: the current cell value (whatever shape you use)
  // context: the descriptor's `editorContext` (read-only — field metadata, etc.)
  // onChange: write a new value; commits when the overlay closes
  // onClose: close the overlay (committing the last onChange'd value)
  return (
    <input
      autoFocus
      type="number"
      value={value as number ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      onBlur={onClose}
    />
  )
}

const editors = { currency: CurrencyEditor }

// In getCell:
function getCell(columnId, rowIndex): GridCellDescriptor {
  const row = getRow(rowIndex)
  if (!row) return { kind: 'loading' }
  if (columnId === 'price') {
    return {
      kind: 'custom',
      editorKey: 'currency',
      display: row.price != null ? formatBRL(row.price) : '',
      value: row.price,
      editorContext: { currency: 'BRL' }
    }
  }
  // ...
}

;<GridTable columns={columns} editors={editors} ... />
```

A custom cell becomes editable when **both** the column is `editable: true`
**and** an editor is registered under its `editorKey`.

> **Heads up — glide's "click outside" close** — glide closes its overlay
> editor when you click outside its bounds. If your editor opens a sub-popover
> (date picker, autocomplete dropdown, file dialog), make sure it renders
> inside the overlay or use `onCellActivated` to drive a completely external
> modal/drawer instead. See [Drawer-style editors](#drawer-style-editors)
> below.

### Drawer-style editors

For long-text or JSON editors where a drawer makes more sense than an
overlay, mark the column `editable: false` and listen for `onCellActivated`:

```tsx
<GridTable
  onCellActivated={({ columnId, rowIndex }) => {
    setDrawerCell({ columnId, rowIndex })
  }}
/>
```

Then render your drawer / modal at the parent level, outside glide's overlay
tree.

### Theme

The package depends only on glide. To match your design system, pass a
glide theme override:

```tsx
import { GridTable, glideThemeFromMui } from '@baseportal/grid-table'
import { useTheme } from '@mui/material/styles'

function MyTable() {
  const muiTheme = useTheme()
  const gridTheme = useMemo(() => glideThemeFromMui(muiTheme), [muiTheme])
  return <GridTable theme={gridTheme} ... />
}
```

`glideThemeFromMui` accepts any object structurally compatible with
`MuiThemeLike` (the slice it reads) — so you don't need `@mui/material` to
use it; any palette with `primary` / `text` / `background` / `grey` /
`warning` / `divider` works.

Not using MUI? Pass the
[glide theme](https://github.com/glideapps/glide-data-grid/blob/main/packages/core/src/common/styles.ts)
fields directly:

```tsx
<GridTable
  theme={{
    accentColor: '#3b82f6',
    bgHeader: '#f3f4f6',
    textHeader: '#374151',
    borderColor: '#e5e7eb'
  }}
/>
```

---

## API reference

The package re-exports its full type surface from the root. Highlights:

### `<GridTable>` props

| Prop                  | Type                                                              | Description                                                                                       |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `columns`             | `GridColumnDef[]`                                                 | Column definitions.                                                                               |
| `rowCount`            | `number`                                                          | Total row count (server + drafts).                                                                |
| `getCell`             | `(columnId, rowIndex) => GridCellDescriptor`                      | Per-cell descriptor lookup.                                                                       |
| `theme`               | `Partial<GlideTheme>`                                             | Glide theme overrides. See [`glideThemeFromMui`](#theme).                                         |
| `height` / `width`    | `number \| string`                                                | Container size. Defaults to `100%` — wrap in a sized parent.                                      |
| `rowHeight`           | `number`                                                          | Row height (default `33`).                                                                        |
| `headerHeight`        | `number`                                                          | Header height (default `34`).                                                                     |
| `onColumnWidthsChange`| `(widths: Record<string, number>) => void`                        | Fires on resize with the full id→width map.                                                       |
| `onVisibleRowsChange` | `({ startRow, endRow }) => void`                                  | Wire to `useGridData.onVisibleRowsChange` so upcoming pages prefetch.                             |
| `onCellEdit`          | `({ rowIndex, columnId, value }) => void`                         | Inline-edit commit; wire to `useGridData.commitEdit`.                                             |
| `onCellActivated`     | `({ columnId, rowIndex }) => void`                                | Double-click / Enter on a non-editable cell — open external drawer/modal.                         |
| `onAppendRow`         | `() => number \| void`                                            | Enables the trailing "+ New row".                                                                 |
| `onColumnReorder`     | `(fromIndex, toIndex) => void`                                    | Enables drag-to-reorder columns.                                                                  |
| `onHeaderMenu`        | `(columnId, bounds) => void`                                      | Click a header — anchor your menu at `bounds`.                                                    |
| `onAddColumn`         | `(bounds) => void`                                                | Enables the trailing "+" column header.                                                           |
| `enableRowSelection`  | `boolean`                                                         | Adds a leading checkbox column.                                                                   |
| `onSelectionChange`   | `(selectedRowCount) => void`                                      | Fires whenever the selection changes.                                                             |
| `editors`             | `Record<string, GridCustomEditorComponent>`                       | Registry for `custom`-kind cells.                                                                 |

### `GridTableRef`

Imperative handle via `useRef<GridTableRef>`:

- `appendRow(openEditor?: boolean)` — append + scroll/focus a row (also injects
  the `<div id="portal">` glide needs for its overlay editor).
- `scrollToRow(rowIndex)` — bring a row into view.
- `getSelectedRowIndices()` — current selection as an array of indices.
- `clearSelection()` — drop the selection.

### `useGridData(options)`

| Option           | Required | Description                                                              |
| ---------------- | -------- | ------------------------------------------------------------------------ |
| `source`         | ✓        | `GridDataSource<TRow>`.                                                  |
| `pageSize`       | ✓        | Rows per fetch (and paginated page size).                                |
| `mode`           | ✓        | `'paginated'` or `'infinite'`.                                           |
| `resetKey`       |          | Changing this drops cache + refetches.                                   |
| `maxCachedPages` |          | `infinite` only — LRU cap (default 20).                                  |
| `overscanRows`   |          | `infinite` only — extra rows beyond visible region.                      |
| `mergeEdit`      |          | `(row, columnId, value) => newRow` — defaults to shallow-spread + set.   |
| `onPersistEdit`  |          | Persists an edit. Return a row/partial to reconcile; throw to roll back. |
| `makeDraftRow`   |          | `() => TRow` — required to enable `appendDraftRow`.                      |

Returns `{ rowCount, getRow, onVisibleRowsChange, isInitialLoading, error,
refresh, patchRow, commitEdit, appendDraftRow, isDraftRow, page, setPage,
pageCount, total }`.

### `glideThemeFromMui(muiTheme)`

Returns a `Partial<GlideTheme>` derived from any object compatible with
`MuiThemeLike` (which is a structural subset of a Material-UI theme). Header
background = `palette.grey[100]`; respects `palette.mode === 'dark'`.

### Other exports

- `descriptorToCell(descriptor, columnId, isEditable) → GridCell` — the
  internal mapping function, exposed in case you need to render a glide cell
  outside `<GridTable>`.
- `editedCellValue(cell) → unknown` — extracts the value back out of a glide
  cell after editing.
- Types: `GridCellDescriptor`, `GridTone`, `GetCell`, `GridEditValue`,
  `GridCellEdit`, `GridCustomEditorProps`, `GridCustomEditorComponent`,
  `GridDataSource`, `GridPageParams`, `GridPageResult`, `GridMode`,
  `GridTableProps`, `GridColumnDef`, `GridBounds`, `UseGridDataOptions`,
  `UseGridDataResult`, `MergeEdit`, `PersistEditContext`, `GlideTheme`,
  `MuiThemeLike`, plus `DEFAULT_COLUMN_WIDTH`.

---

## Recipes

### Persist column widths and ordering

```tsx
const [columns, setColumns] = useState(initialColumns)

const handleResize = (widths: Record<string, number>) => {
  setColumns((prev) =>
    prev.map((c) => (widths[c.id] != null ? { ...c, width: widths[c.id] } : c))
  )
  localStorage.setItem('grid-widths', JSON.stringify(widths))
}

const handleReorder = (fromIndex: number, toIndex: number) => {
  setColumns((prev) => {
    const next = [...prev]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return next
  })
}

<GridTable
  columns={columns}
  onColumnWidthsChange={handleResize}
  onColumnReorder={handleReorder}
  ...
/>
```

### Reset cache when sort / filters change

```tsx
const resetKey = useMemo(
  () => JSON.stringify({ sort, filters }),
  [sort, filters]
)

useGridData({ source, pageSize, mode, resetKey })
```

The hook drops cached pages, draft rows, and the visible range whenever
`resetKey` changes — there's no extra `invalidate()` to call.

### Row selection + bulk action

```tsx
const gridRef = useRef<GridTableRef>(null)
const [selectedCount, setSelectedCount] = useState(0)

const handleBulkDelete = async () => {
  const indices = gridRef.current?.getSelectedRowIndices() ?? []
  const rows = indices.map(getRow).filter(Boolean)
  await deleteMany(rows.map((r) => r!.id))
  gridRef.current?.clearSelection()
  refresh()
}

<GridTable
  ref={gridRef}
  enableRowSelection
  onSelectionChange={setSelectedCount}
  ...
/>
```

### Plug a non-MUI design system

```tsx
import { GridTable } from '@baseportal/grid-table'

const theme = {
  accentColor: '#0ea5e9',
  bgHeader: '#fafafa',
  textHeader: '#475569',
  bgCell: '#ffffff',
  borderColor: '#e2e8f0',
  fontFamily: 'Inter, system-ui, sans-serif'
}

<GridTable theme={theme} ... />
```

---

## Notes & caveats

- The package imports glide's stylesheet itself
  (`@glideapps/glide-data-grid/dist/index.css`); consumers don't need to.
- It auto-creates the `<div id="portal">` glide needs for its overlay editor,
  so your app layout doesn't have to.
- Inline editing is currently limited to the kinds glide can edit natively
  (`text`, `number`, `boolean`, `uri`). Everything else uses the `custom`
  descriptor + an overlay editor — by design: those editors are app-specific.
- `glide-data-grid` 6.x declares its React peer as `^16 || 17 || 18` but works
  with 19. Use `pnpm.peerDependencyRules.allowedVersions` (snippet above) if
  pnpm complains.
- The package itself is **client-only**. The `'use client'` banner is built in;
  if you also use it from a server component, Next.js will move it to the
  client boundary for you.

---

## Development

```bash
git clone https://github.com/baseportal-io/grid-table.git
cd grid-table
pnpm install
pnpm dev           # tsup --watch — rebuilds dist/ on every change
pnpm typecheck     # tsc --noEmit
pnpm build         # production bundle
```

The build emits ESM + CJS + `.d.ts` under `dist/`, with a `'use client'`
banner so Next.js consumers don't need a wrapper.

### Linking into a consumer app

```jsonc
// consumer/package.json
{
  "dependencies": {
    "@baseportal/grid-table": "link:../path/to/grid-table"
  }
}
```

In Next.js, add the package to `transpilePackages` so its `dist/` rebuilds
trigger a recompile, and alias `react` / `react-dom` to the consumer's copies
to avoid the dual-React pitfall:

```js
// next.config.mjs
export default {
  transpilePackages: ['@baseportal/grid-table'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom')
    }
    return config
  }
}
```

---

## Contributing

Issues and pull requests are welcome at
[github.com/baseportal-io/grid-table](https://github.com/baseportal-io/grid-table/issues).
Please open an issue first for non-trivial changes so we can discuss scope.

When filing a bug, include:

- the grid mode (`paginated` / `infinite`),
- pageSize and approximate row count,
- React + Next.js (or other framework) versions,
- a minimal reproduction (CodeSandbox / StackBlitz / a small repo).

### Releasing

Versioning follows [semver](https://semver.org). The `0.x` line is the
pre-1.0 stabilization period — APIs may still change in minor bumps; breaking
changes will be called out in the changelog. Once the API is considered
stable we'll cut `1.0.0`.

---

## License

[MIT](./LICENSE) © Baseportal

Built on top of [`@glideapps/glide-data-grid`](https://github.com/glideapps/glide-data-grid)
(MIT) — please credit them too.
