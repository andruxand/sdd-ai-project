/**
 * apps/web/src/app/theme.ts
 *
 * MUI theme configuration — single source of truth for design decisions.
 * Never override per-component. Use theme.components for global overrides.
 */
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // blue-600
      light: '#60a5fa', // blue-400
      dark: '#1d4ed8', // blue-700
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed', // violet-600
    },
    error: {
      main: '#dc2626', // red-600
      dark: '#7f1d1d', // red-900 — a11y text on light red bg (contrast ≥ 4.5:1)
    },
    warning: {
      main: '#f59e0b', // amber-500
      dark: '#78350f', // amber-900 — a11y text on light amber bg (contrast ≥ 4.5:1)
    },
    success: {
      main: '#16a34a', // green-600
      dark: '#14532d', // green-900 — a11y text on light green bg (contrast ≥ 4.5:1)
    },
    background: {
      default: '#f8fafc', // slate-50
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a', // slate-900
      secondary: '#475569', // slate-600
    },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '1.875rem', fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: '1.5rem', fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    caption: { fontSize: '0.75rem' },
  },
  spacing: 8, // 1 unit = 8px
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        variant: 'contained',
      },
      styleOverrides: {
        root: {
          textTransform: 'none', // remove ALL_CAPS default
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // MUI adds a gradient in dark mode — disable it
        },
      },
    },
  },
});

export default theme;
