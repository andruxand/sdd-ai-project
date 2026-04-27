# UI Libraries Standard

> Last updated: April 2026 | Owner: Frontend Guild

This document defines **how to use** each UI library supported by the bootstrap. It is the authoritative reference for AI agents and human developers.

The active library is set at bootstrap time in `openspec/config.yaml → ui_library`. It cannot be changed mid-project without an explicit OpenSpec proposal.

---

## Supported libraries

| `ui_library` value | Library         | Version          | Skill                                 |
| ------------------ | --------------- | ---------------- | ------------------------------------- |
| `tailwind`         | Tailwind CSS    | v3               | `.github/skills/tailwind-patterns`    |
| `mui`              | Material UI     | v5               | `.github/skills/mui-patterns`         |
| `antd`             | Ant Design      | v5               | `.github/skills/antd-patterns`        |
| `chakra`           | Chakra UI       | v3               | `.github/skills/chakra-patterns`      |
| `bootstrap`        | React Bootstrap | v2 (Bootstrap 5) | `.github/skills/bootstrap-patterns`   |
| `none`             | CSS Modules     | —                | `.github/skills/css-modules-patterns` |

---

## Library selection guide

Use this only during bootstrap. Once selected, changing the library requires a full UI migration.

| Factor                  | `tailwind`            | `mui`           | `antd`              | `chakra`                 | `bootstrap`              | `none`    |
| ----------------------- | --------------------- | --------------- | ------------------- | ------------------------ | ------------------------ | --------- |
| **Design system**       | Custom (token-based)  | Material Design | Ant Design Language | System-agnostic          | Bootstrap 5              | Custom    |
| **Design-to-code fit**  | High (tokens + Figma) | Medium          | Medium              | High                     | Low                      | High      |
| **Component richness**  | Low (bring your own)  | High            | Very high           | Medium                   | High                     | None      |
| **Bundle size**         | Low (purged)          | Medium          | Large               | Medium                   | Medium                   | Minimal   |
| **Theming flexibility** | Very high             | High            | High                | High                     | Medium (SCSS)            | Very high |
| **Dark mode**           | Easy (`dark:` class)  | Native (`mode`) | Native (algorithm)  | Native (semantic tokens) | Native (`data-bs-theme`) | Manual    |
| **TypeScript**          | Excellent             | Excellent       | Excellent           | Excellent                | Good                     | Excellent |
| **Accessibility**       | Manual (author)       | Built-in        | Built-in            | Built-in                 | Built-in                 | Manual    |
| **Learning curve**      | Medium                | Medium          | Low                 | Low                      | Very low                 | Low       |
| **Team familiarity**    | Wide                  | Wide            | BI/data teams       | Product teams            | Legacy teams             | Any       |

---

## Rule: one approach per project

**Never mix styling approaches in the same component tree.**

| Combination                                  | Status       |
| -------------------------------------------- | ------------ |
| Tailwind + CSS Modules                       | ❌ Forbidden |
| Tailwind + MUI `sx` props                    | ❌ Forbidden |
| MUI `sx` + CSS Modules                       | ❌ Forbidden |
| Ant Design + Tailwind utilities              | ❌ Forbidden |
| Bootstrap + Tailwind                         | ❌ Forbidden |
| Chakra style props + Tailwind                | ❌ Forbidden |
| Any library + inline `style={{}}` for layout | ❌ Forbidden |

The agent checks `ui_library` in `openspec/config.yaml` at session start and applies the corresponding skill. If `ui_library` is not set, stop and ask the orchestrator to set it.

---

## Tailwind CSS v3

### Decision criteria

Choose Tailwind when:

- The project needs a fully custom design system
- The team controls all visual decisions from a design token level
- You want lowest possible CSS bundle size
- The team has strong Figma-to-token workflows

### Key constraints

- Tailwind **v3** (not v4 — v4 changed the config format significantly). Stick to `tailwind.config.js` with `content`, `theme.extend`, and `darkMode: 'class'`.
- All conditional class composition must use `cn()` (clsx + tailwind-merge). Never build `className` via string concatenation.
- Multi-variant components use `cva` (class-variance-authority).
- PurgeCSS / JIT: class names must be complete strings in source. Never build partial class names like `'text-' + color`.
- Dark mode: `darkMode: 'class'` → toggled by adding `dark` to `<html>`. Do not use `darkMode: 'media'`.

### Required utilities

```bash
npm install clsx tailwind-merge class-variance-authority
```

### Full reference

See `.github/skills/tailwind-patterns/SKILL.md`.

---

## Material UI v5

### Decision criteria

Choose MUI when:

- The project must conform to or approximate Material Design
- You need a rich component library out of the box (Date pickers, Autocomplete, DataGrid, etc.)
- The team is already familiar with the MUI ecosystem

### Key constraints

- MUI v5 uses **Emotion** as the CSS-in-JS engine. Never swap to styled-components.
- Single `createTheme()` call in `app/theme.ts`. No per-component style overrides outside the theme.
- `sx` prop for one-off adjustments only. Repeated `sx` objects → `styled()` or `theme.components`.
- `CssBaseline` always included in the app root.
- Use `shouldForwardProp` in `styled()` to avoid forwarding custom props to DOM elements.
- Breakpoints: `xs` (0), `sm` (600px), `md` (900px), `lg` (1200px), `xl` (1536px).

### Full reference

See `.github/skills/mui-patterns/SKILL.md`.

---

## Ant Design v5

### Decision criteria

Choose Ant Design when:

- Building admin dashboards, BI tools, or enterprise data-heavy interfaces
- The team needs a comprehensive component set (Table, Form, Tree, Calendar, Chart integration)
- Design Language System (DLS) needs to match Alibaba/Ant ecosystem conventions

### Key constraints

- Ant Design v5 uses a **CSS-in-JS token system** (no LESS/CSS variable customization from v4).
- All tokens live in `ConfigProvider theme={{ token: {…} }}` at the app root.
- Use `theme.algorithm` to switch between light, dark, and compact modes.
- Use `App.useApp()` for message/notification/modal — not the static `message.success()` import.
- `useToken()` to read tokens in components — never hardcode hex values.
- Every `<Table>` must have a `rowKey` prop.

### Full reference

See `.github/skills/antd-patterns/SKILL.md`.

---

## Chakra UI v3

### Decision criteria

Choose Chakra when:

- The team values rapid iteration with style props
- You need excellent dark mode support out of the box
- The project uses a system-agnostic design (not Material, Ant, or Bootstrap-specific)
- Strong accessibility defaults with low configuration overhead

### Key constraints

- Chakra **v3** uses `createSystem()` from `@chakra-ui/react`. This is **not backward compatible with v2**. The old `extendTheme()` API does not exist in v3.
- `<ChakraProvider value={system}>` takes a `system` object (not a theme object as in v2).
- Semantic tokens automatically handle light/dark switching. Always define semantic tokens for colors that need to switch.
- `useColorMode()` for manual toggle. `useColorModeValue()` **does not exist in v3** — use semantic tokens or conditional JSX from `colorMode`.
- `defineRecipe` / `defineSlotRecipe` replaces the old component variant API.

### Full reference

See `.github/skills/chakra-patterns/SKILL.md`.

---

## React Bootstrap v2

### Decision criteria

Choose Bootstrap when:

- The team already uses Bootstrap 5 in existing applications and needs continuity
- Rapid prototyping with familiar Bootstrap conventions
- The project does not require a heavily custom design system

### Key constraints

- React Bootstrap v2 targets **Bootstrap 5** (not v4). The jQuery dependency is eliminated.
- **Never import raw Bootstrap CSS.** Use the SCSS pipeline with `_variables.scss` → `@import "bootstrap/scss/bootstrap"`.
- All Bootstrap components must be used via the `react-bootstrap` API, never via raw Bootstrap classNames on HTML elements.
- Use `Form.Group controlId` on every form field — this wires `htmlFor` on the label.
- Dark mode: Bootstrap 5.3+ `data-bs-theme="dark"` on the document root.
- Tailwind utilities must not be mixed alongside Bootstrap.

### Full reference

See `.github/skills/bootstrap-patterns/SKILL.md`.

---

## CSS Modules (`none`)

### Decision criteria

Choose `none` when:

- No framework-specific design system is needed
- The team needs maximum control with minimal dependencies
- The project will build its own design system from scratch

### Key constraints

- One `.module.css` per component, co-located with the component file.
- Design tokens as CSS custom properties in `shared/tokens/tokens.css`.
- BEM-inspired naming inside modules: `.root`, `.label`, `.icon--active`.
- No inline `style={{}}` for reusable components.

### Full reference

See `.github/skills/css-modules-patterns/SKILL.md`.

---

## Changing `ui_library` mid-project

Changing the UI library after bootstrap is a **high-effort, high-risk** operation. It requires:

1. An OpenSpec proposal with `risk: high` and migration plan.
2. Full re-implementation of all components in `packages/shared/ui/` and `apps/web/src/`.
3. Removal of old library packages.
4. Full Storybook and Playwright regression coverage.

Do not attempt this incrementally (mixed library state is not allowed).

---

## Agent checklist: per session

Every `@frontend-implementer` session must:

1. Read `ui_library` from `openspec/config.yaml`.
2. Load the corresponding skill listed in the table above.
3. Refuse to mix styling approaches — raise a blocker if inconsistency is found.
4. Apply library-specific Storybook setup from the skill.
5. Confirm `apps/web/src/app/theme.ts` (or equivalent) exists and follows skill conventions before writing new components.
