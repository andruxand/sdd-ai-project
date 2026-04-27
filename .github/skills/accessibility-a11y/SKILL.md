# Skill: accessibility-a11y

> Source: W3C WCAG 2.1 Quick Reference (w3.org/WAI/WCAG21/quickref), axe-core, Storybook a11y addon docs
> Type: **active** — loaded by `frontend-implementer` and `tester-frontend` agents

## Purpose

Provide WCAG 2.1 Level AA implementation and testing knowledge for React/Next.js components. Covers the success criteria most relevant to developers, automated testing with axe-core, ARIA patterns, keyboard navigation, focus management, and Storybook accessibility.

---

## WCAG 2.1 AA — Developer-relevant success criteria

### Principle 1 – Perceivable

| SC                                   | Level | Rule for React developers                                                                                                                  |
| ------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **1.1.1** Non-text Content           | A     | Every `<img>` needs `alt`. Decorative images: `alt=""`. Icon buttons: `aria-label`.                                                        |
| **1.3.1** Info and Relationships     | A     | Use semantic HTML (`<nav>`, `<main>`, `<header>`, `<section>`, `<article>`, `<aside>`). Convey structure via HTML, not CSS alone.          |
| **1.3.5** Identify Input Purpose     | AA    | Add `autoComplete` to user information inputs (`name`, `email`, `tel`, `current-password`).                                                |
| **1.4.1** Use of Color               | A     | Never use color as the only means of conveying information (e.g., red border alone is insufficient — add an icon or text).                 |
| **1.4.3** Contrast (Minimum)         | AA    | Text and images of text: **4.5:1** contrast ratio. Large text (≥18pt or ≥14pt bold): 3:1.                                                  |
| **1.4.4** Resize Text                | AA    | Text must be resizable to 200% without loss of content or functionality. Avoid `px` for font sizes in body text; use `rem`.                |
| **1.4.10** Reflow                    | AA    | Content must not require horizontal scrolling at 320px wide (400% zoom on 1280px). Use responsive layouts.                                 |
| **1.4.11** Non-text Contrast         | AA    | UI components (inputs, buttons, icons) against adjacent color: **3:1**.                                                                    |
| **1.4.13** Content on Hover or Focus | AA    | Tooltip/popover content on hover/focus must be: persistent (doesn't vanish on move), dismissible (Esc), and hoverable (can mouse over it). |

### Principle 2 – Operable

| SC                         | Level | Rule for React developers                                                                                               |
| -------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| **2.1.1** Keyboard         | A     | All functionality must be operable via keyboard only. Test with Tab, Shift+Tab, Enter, Space, Escape, Arrow keys.       |
| **2.1.2** No Keyboard Trap | A     | Modal/drawer: allow Esc to close, return focus to trigger. Dropdown: Esc to close.                                      |
| **2.4.1** Bypass Blocks    | A     | Provide a "Skip to main content" link as first focusable element on page.                                               |
| **2.4.3** Focus Order      | A     | Focusable elements receive focus in a logical reading order. Avoid `tabIndex > 0`.                                      |
| **2.4.7** Focus Visible    | AA    | Never `outline: none` without a custom focus indicator.                                                                 |
| **2.5.3** Label in Name    | A     | The accessible name of a button/link must contain its visible text. `aria-label` should include the visible label text. |

### Principle 3 – Understandable

| SC                               | Level | Rule for React developers                                                                        |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| **3.2.1** On Focus               | A     | Focus does not trigger context changes (navigation, form submission).                            |
| **3.3.1** Error Identification   | A     | Form errors must identify the field in error with a text description.                            |
| **3.3.2** Labels or Instructions | A     | Every form input must have a visible `<label>` (or `aria-label`/`aria-labelledby`).              |
| **3.3.3** Error Suggestion       | AA    | If validation knows how to fix the error, tell the user (e.g., "Must be a valid email address"). |

### Principle 4 – Robust

| SC                          | Level | Rule for React developers                                                                                                               |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **4.1.2** Name, Role, Value | A     | Custom interactive components must have: accessible name, role, and state. Use native HTML when possible.                               |
| **4.1.3** Status Messages   | AA    | Dynamic content updates (toasts, loading states, form success) must use `role="status"` or `aria-live` so screen readers announce them. |

---

## ARIA roles and landmarks

```tsx
// Page structure landmarks — use semantic HTML, not div+role
<header>    {/* role="banner" */}
<nav>       {/* role="navigation" */}
<main>      {/* role="main" */}
<aside>     {/* role="complementary" */}
<footer>    {/* role="contentinfo" */}

// Dynamic content announcements
<div role="status" aria-live="polite">   {/* Non-urgent: cart updates, success messages */}
<div role="alert" aria-live="assertive"> {/* Urgent: errors, warnings */}

// Loading state
<div role="status" aria-live="polite" aria-label="Loading results">
  <Spinner />
</div>

// Icon button (no visible text)
<button aria-label="Close dialog">
  <CloseIcon aria-hidden="true" />
</button>

// Toggle button
<button
  aria-pressed={isOpen}
  onClick={toggle}
>
  Menu
</button>
```

---

## Focus management

```tsx
import { useRef, useEffect } from 'react';

// Modal: trap focus inside, restore on close
function Modal({ isOpen, onClose, children }) {
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Move focus to first focusable element inside modal
      firstFocusRef.current?.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    // Return focus to the element that opened the modal
    triggerRef.current?.focus();
  };

  // ...
}

// Route change: move focus to h1 or main landmark
function Page() {
  const h1Ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h1Ref.current?.focus();
  }, []);
  return (
    <h1 ref={h1Ref} tabIndex={-1}>
      Page title
    </h1>
  );
}
```

---

## Reduced motion

```tsx
// Respect user's motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// In CSS
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

---

## Automated testing with axe-core

### Vitest + @axe-core/react

```tsx
// tests setup: vitest.setup.ts
import { configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 3000 });
```

```tsx
// Component test
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { expect } from 'vitest';

expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Install:**

```bash
npm install --save-dev jest-axe @types/jest-axe
```

### Storybook a11y addon

```tsx
// .storybook/main.ts
export default {
  addons: ['@storybook/addon-a11y'],
};

// Story-level a11y override
export const WithError: Story = {
  args: { hasError: true },
  parameters: {
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
  },
};
```

**Install:**

```bash
npm install --save-dev @storybook/addon-a11y
```

---

## Keyboard navigation patterns

| Component       | Required keyboard behavior                                           |
| --------------- | -------------------------------------------------------------------- |
| Button          | Enter or Space triggers action                                       |
| Link            | Enter navigates                                                      |
| Checkbox        | Space toggles                                                        |
| Radio group     | Arrow keys cycle options, Tab moves out                              |
| Dropdown/Select | Enter/Space opens, Arrow keys navigate, Escape closes, Home/End jump |
| Dialog/Modal    | Tab/Shift+Tab cycle within, Escape closes, focus returns to trigger  |
| Tabs            | Arrow keys cycle tabs, Tab moves into panel content                  |
| Combobox        | Arrow keys navigate list, Enter selects, Escape closes               |

---

## Form accessibility checklist

```tsx
// ✅ Correct: visible label, error announcement
<div>
  <label htmlFor="email">Email address</label>
  <input
    id="email"
    type="email"
    autoComplete="email"
    aria-describedby={hasError ? 'email-error' : undefined}
    aria-invalid={hasError}
  />
  {hasError && (
    <span id="email-error" role="alert">
      Must be a valid email address
    </span>
  )}
</div>

// ❌ Incorrect: placeholder-only "label"
<input type="email" placeholder="Email address" />
```

---

## DO / DON'T

| ✅ DO                                      | ❌ DON'T                                    |
| ------------------------------------------ | ------------------------------------------- |
| Use semantic HTML elements                 | Use `<div onClick>` instead of `<button>`   |
| Test with keyboard only                    | Only test with mouse                        |
| Run axe in component tests                 | Skip a11y in automated tests                |
| Use `aria-live` for dynamic content        | Update DOM without notifying screen readers |
| Return focus to trigger after modal closes | Leave focus stranded after closing overlays |
| Use 4.5:1 contrast ratio for text          | Choose colors based on aesthetics alone     |
| Add `alt` to all informational images      | Omit `alt` or use `alt="image"`             |
| Use `role="alert"` for errors              | Show errors only visually                   |
