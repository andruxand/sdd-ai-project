````skill
---
name: mui-patterns
description: Material UI v5 — ThemeProvider/createTheme, sx prop and styled() API, palette/typography/spacing conventions, component overrides, and TypeScript integration. Apply when ui_library = 'mui'.
type: conditional
condition: ui_library == 'mui'
agents: [frontend-implementer, tester-frontend]
---

## Prerequisite: verify ui_library

Read `ui_library` from `openspec/config.yaml` before styling anything.
This skill applies **only** when `ui_library: 'mui'`. If the value is different, stop and use the correct skill.

---

## 1. Stack

```bash
# installed by bootstrap
@mui/material @mui/icons-material @emotion/react @emotion/styled
````

Required peer dependencies: React 17+ and `@emotion/react` + `@emotion/styled`.

---

## 2. Theme setup — single source of truth

All design decisions live in one `createTheme()` call. Never override per-component.

```typescript
// apps/web/src/app/theme.ts
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // primary-600
      light: '#60a5fa', // primary-400
      dark: '#1d4ed8', // primary-700
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed',
    },
    error: { main: '#dc2626' },
    warning: { main: '#f59e0b' },
    success: { main: '#16a34a' },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
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
  spacing: 8, // 1 unit = 8px. theme.spacing(2) = 16px
  shape: { borderRadius: 8 },
  breakpoints: {
    // MUI defaults (do not change unless explicitly required)
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
  components: {
    // Component-level overrides — see section 5
  },
});

export default theme;
```

```typescript
// apps/web/src/main.tsx
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from '@/app/theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline /> {/* normalizes browser styles — always include */}
    <App />
  </ThemeProvider>,
);
```

---

## 3. `sx` prop — one-off layout adjustments only

The `sx` prop is for **one-off** adjustments that don't repeat. If the same `sx` appears more than once → extract to `styled()` or theme overrides.

```typescript
// ✅ one-off spacing tweak
<Box sx={{ mt: 2, mb: 4 }}>

// ✅ theme-aware — pass a function to access the theme
<Box sx={{ backgroundColor: (t) => t.palette.background.paper, p: 3 }}>

// ❌ repeating sx across 3+ components — extract it
<Card sx={{ borderRadius: 2, boxShadow: 2, p: 3 }}>
// ✅ extract to styled
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  padding: theme.spacing(3),
}));
```

Shorthand properties in `sx`:

| `sx` shorthand | CSS property |

|----------------|-------------|

| `mt`, `mb`, `ml`, `mr`, `my`, `mx` | margin (theme.spacing units) |

| `pt`, `pb`, `pl`, `pr`, `py`, `px` | padding |

| `bgcolor` | backgroundColor |

| `borderColor` | borderColor |

| `fontSize`, `fontWeight` | font properties |

| `display`, `flexDirection`, `alignItems` | flex/grid |

---

## 4. `styled()` — reusable styled components

```typescript
import { styled } from '@mui/material/styles';
import { Box, type BoxProps } from '@mui/material';

interface StatusBadgeProps extends BoxProps {
  status: 'active' | 'inactive' | 'pending';
}

// ✅ styled() for repeated, variant-based styles
const StatusBadge = styled(Box, {
  // prevents 'status' from being forwarded to the DOM
  shouldForwardProp: (prop) => prop !== 'status',
})<StatusBadgeProps>(({ theme, status }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.5, 1.5),
  fontSize: theme.typography.caption.fontSize,
  fontWeight: 600,
  ...(status === 'active' && {
    backgroundColor: theme.palette.success.main + '1a',
    color: theme.palette.success.main,
  }),
  ...(status === 'inactive' && {
    backgroundColor: theme.palette.text.secondary + '1a',
    color: theme.palette.text.secondary,
  }),
  ...(status === 'pending' && {
    backgroundColor: theme.palette.warning.main + '1a',
    color: theme.palette.warning.main,
  }),
}));
```

---

## 5. Component overrides via `theme.components`

Prefer theme-level overrides over per-component `sx`.

```typescript
// in theme.ts → createTheme({ components: { ... } })
MuiButton: {
  defaultProps: {
    disableElevation: true,
    variant: 'contained',
  },
  styleOverrides: {
    root: ({ theme }) => ({
      textTransform: 'none',      // remove ALL_CAPS default
      fontWeight: 600,
      borderRadius: theme.shape.borderRadius,
    }),
    sizeLarge: {
      padding: '12px 24px',
    },
  },
},
MuiTextField: {
  defaultProps: {
    variant: 'outlined',
    size: 'small',
  },
},
MuiPaper: {
  styleOverrides: {
    root: {
      backgroundImage: 'none', // MUI adds a gradient in dark mode — disable it
    },
  },
},
```

---

## 6. Layout primitives — use MUI, not raw HTML

| Need | Use |

| ------------------------ | -------------------------------------------------------- |

| Generic container | `<Box>` |

| Flex column/row with gap | `<Stack spacing={2}>` or `<Stack direction="row">` |

| CSS Grid | `<Grid container spacing={2}><Grid item xs={12} md={6}>` |

| Body text | `<Typography variant="body1">` |

| Heading | `<Typography variant="h2" component="h1">` |

| Divider | `<Divider>` |

```typescript
// ✅ correct layout
<Stack spacing={3}>
  <Typography variant="h2" component="h1">
    Order #{order.id}
  </Typography>
  <Grid container spacing={2}>
    <Grid item xs={12} md={8}>
      <OrderDetails order={order} />
    </Grid>
    <Grid item xs={12} md={4}>
      <OrderSummary order={order} />
    </Grid>
  </Grid>
</Stack>

// ❌ raw div with inline styles
<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
```

---

## 7. TypeScript — module augmentation for custom palette

```typescript
// apps/web/src/app/theme.d.ts
import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    neutral: Palette['primary'];
    brand: Palette['primary'];
  }
  interface PaletteOptions {
    neutral?: PaletteOptions['primary'];
    brand?: PaletteOptions['primary'];
  }
  interface TypographyVariants {
    label: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    label?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    label: true;
  }
}
```

---

## 8. Dark mode with MUI

```typescript
// apps/web/src/app/theme.ts
import { createTheme, type PaletteMode } from '@mui/material/styles';

export function createAppTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode, // 'light' | 'dark'

      primary: { main: '#2563eb' },
      // MUI automatically adjusts surface colors for dark mode
    },
  });
}
```

```typescript
// app root — toggle via state
const [mode, setMode] = useState<PaletteMode>('light');
const theme = useMemo(() => createAppTheme(mode), [mode]);

<ThemeProvider theme={theme}>
  <CssBaseline />
  <App toggleMode={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))} />
</ThemeProvider>
```

---

## 9. Responsive helpers

```typescript
// useMediaQuery from MUI — theme-aware
import { useMediaQuery, useTheme } from '@mui/material';

const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down('md'));
const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));

// In sx prop — responsive values as object
<Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: { xs: 3, md: 5 } }}>

// In sx prop — responsive values as array (xs, sm, md, lg, xl)
<Box sx={{ fontSize: [14, 16, 18] }}>
```

---

## 10. Icons

```typescript
// ✅ from @mui/icons-material only — no other icon lib alongside MUI
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

<IconButton aria-label="Edit order">
  <EditIcon fontSize="small" />
</IconButton>
```

Icon size options: `'inherit'`, `'small'` (20px), `'medium'` (24px), `'large'` (36px).

---

## 11. Storybook integration

```typescript
// .storybook/preview.tsx
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from '../src/app/theme';
import type { Decorator } from '@storybook/react';

export const withMuiTheme: Decorator = (Story) => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Story />
  </ThemeProvider>
);

export const decorators = [withMuiTheme];
```

---

## 12. Mandatory guardrails

| Rule | Rationale |

| ----------------------------------------------------------------------- | ------------------------------- |

| Single `createTheme()` call in `app/theme.ts` | One source of truth |

| No inline `style={{}}` on MUI components | Bypasses theme, not responsive |

| No raw `<div>` when MUI primitive exists (`Box`, `Stack`, `Typography`) | Consistency |

| `shouldForwardProp` on custom props in `styled()` | Prevents unknown DOM attributes |

| No MUI mixed with Tailwind utilities or CSS Modules | One approach per project |

| `CssBaseline` always in app root | Normalizes browser defaults |

```

```
