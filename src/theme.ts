import type { Theme as GlideTheme } from '@glideapps/glide-data-grid'

/**
 * The slice of a Material-UI theme {@link glideThemeFromMui} reads. Declared
 * structurally on purpose — the package doesn't depend on `@mui/material`, so a
 * real MUI `Theme` (from whichever copy the app uses) satisfies this without
 * type-identity clashes.
 */
export interface MuiThemeLike {
  palette: {
    mode: 'light' | 'dark'
    primary: { main: string; contrastText: string }
    text: { primary: string; secondary: string; disabled: string }
    background: { paper: string }
    // Just the steps used below — keeps a real MUI `Color` interface assignable.
    grey: { 50: string; 100: string; 200: string; 300: string; 900: string }
    warning: { main: string }
    divider: string
  }
  typography: { fontFamily?: unknown }
}

/** Minimal `alpha()` so this module stays dependency-free. */
function withAlpha(color: string, opacity: number): string {
  if (color.startsWith('#')) {
    let hex = color.slice(1)
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    }
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
  const match = color.match(/rgba?\(([^)]+)\)/)
  if (match) {
    const [r, g, b] = match[1].split(',').map((s) => s.trim())
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }
  return color
}

/**
 * Builds a glide-data-grid {@link GlideTheme} from a Material-UI theme so the
 * canvas grid tracks the app's palette (including dark mode — MUI's tokens
 * already flip, we just read them).
 *
 * Header background is `grey[100]`, matching the look of the `MuiDataGrid` style
 * override the collections module uses today.
 */
export function glideThemeFromMui(mui: MuiThemeLike): Partial<GlideTheme> {
  const { palette, typography } = mui
  const grey = palette.grey
  const dark = palette.mode === 'dark'

  return {
    accentColor: palette.primary.main,
    accentFg: palette.primary.contrastText,
    accentLight: withAlpha(palette.primary.main, dark ? 0.24 : 0.12),

    textDark: palette.text.primary,
    textMedium: palette.text.secondary,
    textLight: palette.text.disabled,
    textBubble: palette.text.primary,

    bgIconHeader: palette.text.secondary,
    fgIconHeader: palette.background.paper,

    textHeader: palette.text.secondary,
    textHeaderSelected: palette.text.primary,
    textGroupHeader: palette.text.secondary,

    bgCell: palette.background.paper,
    bgCellMedium: dark ? grey[900] : grey[50],

    bgHeader: grey[100],
    bgHeaderHasFocus: grey[300],
    bgHeaderHovered: grey[200],

    bgBubble: grey[100],
    bgBubbleSelected: palette.background.paper,

    bgSearchResult: withAlpha(palette.warning.main, 0.3),

    borderColor: palette.divider,
    horizontalBorderColor: palette.divider,
    drilldownBorder: palette.divider,

    linkColor: palette.primary.main,

    cellHorizontalPadding: 10,
    cellVerticalPadding: 3,

    headerFontStyle: '600 13px',
    baseFontStyle: '13px',
    editorFontSize: '13px',
    lineHeight: 1.4,
    fontFamily:
      typeof typography.fontFamily === 'string'
        ? typography.fontFamily
        : 'system-ui, sans-serif'
  }
}

export type { GlideTheme }
