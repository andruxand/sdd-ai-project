````skill
---
name: chakra-patterns
description: Chakra UI v3 — createSystem/ChakraProvider, style props, responsive values, semantic tokens, defineRecipe/defineSlotRecipe for variants, dark mode via useColorMode, and Storybook integration. Apply when ui_library = 'chakra'.
type: conditional
condition: ui_library == 'chakra'
agents: [frontend-implementer, tester-frontend]
---

## Prerequisite: verify ui_library

Read `ui_library` from `openspec/config.yaml` before styling anything.
This skill applies **only** when `ui_library: 'chakra'`. If the value is different, stop and use the correct skill.

---

## 1. Stack

```bash
# installed by bootstrap (Chakra UI v3)
@chakra-ui/react @emotion/react @emotion/styled
````

> **Important:** Chakra UI v3 introduced a new System API (`createSystem`) that is **not backward-compatible** with Chakra v2. This skill covers v3 only.

---

## 2. Theme setup — `createSystem` + `defaultSystem`

```typescript
// apps/web/src/app/theme.ts
import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const customConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#eff6ff' },
          100: { value: '#dbeafe' },
          500: { value: '#3b82f6' },
          600: { value: '#2563eb' },
          700: { value: '#1d4ed8' },
          900: { value: '#1e3a8a' },
        },
      },
      fonts: {
        sans: { value: '"Inter", system-ui, sans-serif' },
        mono: { value: '"JetBrains Mono", monospace' },
      },
      radii: {
        sm: { value: '4px' },
        md: { value: '8px' },
        lg: { value: '12px' },
        full: { value: '9999px' },
      },
      spacing: {
        // Extend default spacing scale if needed
        '4.5': { value: '1.125rem' },
      },
    },
    semanticTokens: {
      colors: {
        // Semantic tokens automatically switch between light and dark
        'bg.surface': {
          value: {
            _light: '{colors.white}',
            _dark: '{colors.gray.900}',
          },
        },
        'bg.muted': {
          value: {
            _light: '{colors.gray.50}',
            _dark: '{colors.gray.800}',
          },
        },
        'text.primary': {
          value: {
            _light: '{colors.gray.900}',
            _dark: '{colors.gray.50}',
          },
        },
        'text.secondary': {
          value: {
            _light: '{colors.gray.600}',
            _dark: '{colors.gray.400}',
          },
        },
        'border.default': {
          value: {
            _light: '{colors.gray.200}',
            _dark: '{colors.gray.700}',
          },
        },
      },
    },
  },
});

// Merge with defaultConfig to inherit Chakra defaults
export const system = createSystem(defaultConfig, customConfig);
```

```typescript
// apps/web/src/main.tsx
import { ChakraProvider } from '@chakra-ui/react';
import { system } from '@/app/theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ChakraProvider value={system}>
    <App />
  </ChakraProvider>,
);
```

---

## 3. Style props — the primary API

Chakra exposes CSS properties as props directly on all Chakra components.

```typescript
// Common style props
<Box
  bg="bg.surface"          // semantic token
  color="text.primary"
  px={{ base: 4, md: 6 }} // responsive object syntax
  py={3}
  borderRadius="md"
  border="1px solid"
  borderColor="border.default"
  shadow="sm"
>

// ✅ semantic tokens auto-switch dark/light
<Box bg="bg.muted" color="text.secondary">

// ❌ hardcoded color — doesn't switch in dark mode
<Box bg="white" color="gray.900">
```

Key style prop categories:

| Category | Props |

|----------|-------|

| Spacing | `m`, `mt`, `mb`, `ml`, `mr`, `mx`, `my`, `p`, `pt`, `pb`, `px`, `py` |

| Sizing | `w`, `h`, `minW`, `maxW`, `minH`, `maxH` |

| Color | `bg`, `color`, `borderColor`, `fill`, `stroke` |

| Typography | `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `textAlign` |

| Flex | `display`, `flexDir`, `alignItems`, `justifyContent`, `gap`, `wrap` |

| Border | `border`, `borderRadius`, `borderWidth`, `borderStyle` |

| Shadow | `shadow`, `ring`, `ringColor` |

---

## 4. Responsive values

Two syntaxes — both valid, choose one and be consistent within a file:

```typescript
// Object syntax — explicit breakpoint names
<Box fontSize={{ base: 'sm', md: 'md', lg: 'lg' }}>

// Array syntax — maps to breakpoints in order: base, sm, md, lg, xl
<Box fontSize={['sm', 'md', 'md', 'lg']}>
```

Default breakpoints (from `defaultConfig`):

| Key | Min-width |

|-----|-----------|

| `base` | 0px |

| `sm` | 30em (480px) |

| `md` | 48em (768px) |

| `lg` | 62em (992px) |

| `xl` | 80em (1280px) |

| `2xl` | 96em (1536px) |

---

## 5. Layout primitives

```typescript
import { Box, Flex, Grid, GridItem, Stack, HStack, VStack, Center } from '@chakra-ui/react';

// Vertical stack with spacing
<VStack gap={4} align="stretch">
  <OrderCard order={o1} />
  <OrderCard order={o2} />
</VStack>

// Horizontal with wrapping
<HStack gap={3} wrap="wrap">
  <Badge>Tag 1</Badge>
  <Badge>Tag 2</Badge>
</HStack>

// CSS Grid
<Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={6}>
  <GridItem colSpan={{ base: 1, md: 2 }}>
    <OrderDetails />
  </GridItem>
  <GridItem>
    <OrderSummary />
  </GridItem>
</Grid>
```

---

## 6. Dark mode — `useColorMode`

```typescript
import { useColorMode, IconButton } from '@chakra-ui/react';

function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <IconButton
      aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
      onClick={toggleColorMode}
      variant="ghost"
    >
      {colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
    </IconButton>
  );
}
```

Rules:

- Never hardcode light/dark color values in component props — use semantic tokens.
- `colorMode` is `'light' | 'dark'` — type-safe.

- Initial color mode can be set in `createSystem` config: `config: { initialColorMode: 'light', useSystemColorMode: false }`.

---

## 7. `defineRecipe` — variant-based components (v3)

```typescript
// apps/web/src/app/theme.ts → extend customConfig.theme
import { defineRecipe } from '@chakra-ui/react';

const buttonRecipe = defineRecipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 'semibold',
    borderRadius: 'md',
    transition: 'all 0.2s',
    _disabled: { opacity: 0.5, pointerEvents: 'none' },
    _focusVisible: { outline: '2px solid', outlineColor: 'brand.500' },
  },
  variants: {
    variant: {
      solid: {
        bg: 'brand.600',
        color: 'white',
        _hover: { bg: 'brand.700' },
      },
      outline: {
        border: '1px solid',
        borderColor: 'brand.600',
        color: 'brand.600',
        _hover: { bg: 'brand.50' },
      },
      ghost: {
        color: 'brand.600',
        _hover: { bg: 'brand.50' },
      },
    },
    size: {
      sm: { px: 3, py: 1.5, fontSize: 'sm' },
      md: { px: 4, py: 2, fontSize: 'md' },
      lg: { px: 6, py: 3, fontSize: 'lg' },
    },
  },
  defaultVariants: {
    variant: 'solid',
    size: 'md',
  },
});
```

---

## 8. `as` prop — semantic HTML

```typescript
// ✅ use 'as' to render semantic elements while keeping style props
<Box as="section" aria-label="Order details">
<Box as="nav" role="navigation">
<Box as="main">
<Text as="h1" fontSize="2xl" fontWeight="bold">
<Text as="label" htmlFor="name-field">
```

---

## 9. Storybook integration

```typescript
// .storybook/preview.tsx
import { ChakraProvider } from '@chakra-ui/react';
import { system } from '../src/app/theme';
import type { Decorator } from '@storybook/react';

export const withChakra: Decorator = (Story) => (
  <ChakraProvider value={system}>
    <Story />
  </ChakraProvider>
);

export const decorators = [withChakra];
```

---

## 10. Mandatory guardrails

| Rule | Rationale |

| --------------------------------------------------------------- | ---------------------------------- |

| Single `createSystem()` in `app/theme.ts` | One source of truth |

| Semantic tokens for all colors that change in dark mode | Auto dark/light switching |

| No CSS Modules alongside Chakra style props | Two sources of truth |

| No Tailwind utilities alongside Chakra | One approach per project |

| `useColorMode()` for dark mode — never hardcode `#000` / `#fff` | Theme-switchable |

| `as` prop for semantic HTML | Accessibility + style props in one |

| No CSS custom properties that duplicate Chakra tokens | Tokens already handle this |

```

```
