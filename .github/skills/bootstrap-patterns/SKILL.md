````skill
---
name: bootstrap-patterns
description: React Bootstrap v2 + Bootstrap 5 — component API over raw classNames, SCSS variable overrides, Grid (Container/Row/Col), Form patterns, variant props, dark mode, and Storybook integration. Apply when ui_library = 'bootstrap'.
type: conditional
condition: ui_library == 'bootstrap'
agents: [frontend-implementer, tester-frontend]
---

## Prerequisite: verify ui_library

Read `ui_library` from `openspec/config.yaml` before styling anything.
This skill applies **only** when `ui_library: 'bootstrap'`. If the value is different, stop and use the correct skill.

---

## 1. Stack

```bash
# installed by bootstrap
bootstrap react-bootstrap
````

React Bootstrap v2 targets Bootstrap 5. It replaces jQuery-dependent Bootstrap JS with React components — the CSS is still Bootstrap 5.

---

## 2. CSS setup — SCSS pipeline (not raw CSS import)

Never `import 'bootstrap/dist/css/bootstrap.min.css'`. Use SCSS variable overrides.

```bash
npm install -D sass
```

```scss
// src/styles/_variables.scss
// Override Bootstrap SCSS variables BEFORE the import
$primary: #2563eb;
$secondary: #7c3aed;
$success: #16a34a;
$danger: #dc2626;
$warning: #f59e0b;
$info: #0ea5e9;

$font-family-sans-serif: 'Inter', system-ui, sans-serif;
$font-size-base: 1rem;
$border-radius: 0.5rem; // 8px
$border-radius-lg: 0.75rem; // 12px

$spacer: 1rem; // base for spacing scale ($spacer * n)
$grid-gutter-width: 1.5rem;
$container-padding-x: 1.5rem;
```

```scss
// src/styles/main.scss
@import 'variables'; // ← your overrides FIRST
@import 'bootstrap/scss/bootstrap'; // ← then Bootstrap
```

```typescript
// src/main.tsx or src/index.tsx
import './styles/main.scss'; // ← import SCSS, not CSS
```

---

## 3. Component API — always React Bootstrap, never raw classNames

| Need    | ✅ Use                               | ❌ Don't use                                        |
| ------- | ------------------------------------ | --------------------------------------------------- |
| Button  | `<Button variant="primary">`         | `<button className="btn btn-primary">`              |
| Card    | `<Card><Card.Body>`                  | `<div className="card"><div className="card-body">` |
| Modal   | `<Modal show={open} onHide={close}>` | Bootstrap JS `new Modal(...)`                       |
| Alert   | `<Alert variant="success">`          | `<div className="alert alert-success">`             |
| Badge   | `<Badge bg="primary">`               | `<span className="badge bg-primary">`               |
| Spinner | `<Spinner animation="border">`       | `<div className="spinner-border">`                  |

```typescript
// ✅ correct
import { Button, Card, Badge, Spinner, Alert } from 'react-bootstrap';

<Button variant="primary" size="lg" disabled={isLoading}>
  {isLoading ? <Spinner animation="border" size="sm" className="me-2" /> : null}
  Submit Order
</Button>

// ❌ wrong
<button className="btn btn-primary btn-lg">Submit Order</button>
```

---

## 4. Grid — `Container` / `Row` / `Col`

Bootstrap's 12-column grid system.

```typescript
import { Container, Row, Col } from 'react-bootstrap';

// ✅ page layout
<Container>
  <Row className="g-3"> {/* g-3 = gutter size 3 */}
    <Col xs={12} md={8}>
      <OrderDetails order={order} />
    </Col>
    <Col xs={12} md={4}>
      <OrderSummary order={order} />
    </Col>
  </Row>
</Container>

// Breakpoint shorthands: xs (0), sm (576px), md (768px), lg (992px), xl (1200px), xxl (1400px)
// Col auto layout: <Col> (equal width), <Col xs="auto"> (shrink to content)
```

---

## 5. Forms — `Form` component tree

```typescript
import { Form, Button, Row, Col } from 'react-bootstrap';
import { useController, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  customerName: z.string().min(1, 'Required'),
  quantity: z.number().int().positive().max(100),
});

type Values = z.infer<typeof schema>;

export function CreateOrderForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Values>({ resolver: zodResolver(schema) });

  return (
    <Form onSubmit={handleSubmit(onSuccess)} noValidate>
      <Row className="g-3">
        <Col xs={12} md={6}>
          <Form.Group controlId="customerName">
            <Form.Label>Customer name</Form.Label>
            <Form.Control
              type="text"
              isInvalid={!!errors.customerName}
              {...register('customerName')}
            />
            <Form.Control.Feedback type="invalid">
              {errors.customerName?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </Col>
        <Col xs={12} md={6}>
          <Form.Group controlId="quantity">
            <Form.Label>Quantity</Form.Label>
            <Form.Control
              type="number"
              isInvalid={!!errors.quantity}
              {...register('quantity', { valueAsNumber: true })}
            />
            <Form.Control.Feedback type="invalid">
              {errors.quantity?.message}
            </Form.Control.Feedback>
          </Form.Group>
        </Col>
      </Row>
      <div className="mt-3">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? (
            <Spinner animation="border" size="sm" className="me-2" />
          ) : null}
          Create Order
        </Button>
      </div>
    </Form>
  );
}
```

Rules:

- Always use `<Form.Group controlId="...">` — it wires `htmlFor` on the label.
- Always use `isInvalid` / `isValid` props on `Form.Control` — don't add error classes manually.
- Use `noValidate` on `<Form>` to disable browser built-in validation.

---

## 6. Modals

```typescript
import { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

interface DeleteModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteOrderModal({ show, onHide, onConfirm }: DeleteModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onHide();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Delete order?</Modal.Title>
      </Modal.Header>
      <Modal.Body>This action cannot be undone.</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Delete'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
```

---

## 7. Dark mode

Bootstrap 5.3+ supports dark mode via `data-bs-theme="dark"` on any element.

```typescript
// Toggle dark mode at document root
type ColorMode = 'light' | 'dark';

export function useDarkMode() {
  const [mode, setMode] = useState<ColorMode>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', mode);
  }, [mode]);

  return {
    mode,
    toggle: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
  };
}
```

In SCSS, you can define dark-mode overrides:

```scss
// In _variables.scss — dark overrides via data attribute
[data-bs-theme='dark'] {
  --bs-body-bg: #0f172a;
  --bs-body-color: #f8fafc;
}
```

---

## 8. Utility classes — allowed, within limits

Bootstrap utility classes (spacing, display, text) are acceptable on React Bootstrap components via `className`. However:

- Never use `className="btn btn-primary"` to duplicate what a React Bootstrap component already does.
- Use `className` only for Bootstrap utilities: `mt-3`, `ms-2`, `text-muted`, `d-flex`, `gap-2`, `w-100`, `text-truncate`.
- Do NOT use Tailwind utilities alongside Bootstrap classes.

```typescript
// ✅ utility classes for spacing/display
<Button variant="primary" className="w-100 mt-3">

// ❌ duplicating component role via className
<button className="btn btn-primary w-100 mt-3">
```

---

## 9. Storybook integration

```typescript
// .storybook/preview.ts
import '../src/styles/main.scss'; // ← SCSS, not CSS

export const parameters = {
  backgrounds: {
    default: 'light',
    values: [
      { name: 'light', value: '#ffffff' },
      { name: 'dark', value: '#0f172a' },
    ],
  },
};
```

For dark mode toggling in stories:

```typescript
import type { Decorator } from '@storybook/react';

export const withBootstrapTheme: Decorator = (Story, context) => {
  const { theme } = context.globals;
  document.documentElement.setAttribute(
    'data-bs-theme',
    theme === 'dark' ? 'dark' : 'light',
  );
  return <Story />;
};
```

---

## 10. Mandatory guardrails

| Rule                                                                 | Rationale                                      |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| SCSS variable overrides in `_variables.scss` before Bootstrap import | Only correct way to customize Bootstrap        |
| React Bootstrap components over raw `className="btn ..."`            | React lifecycle, event propagation, TypeScript |
| `<Form.Group controlId>` for every form field                        | Accessible `htmlFor` association               |
| `isInvalid` / `isValid` props on `Form.Control`                      | No manual error class management               |
| `data-bs-theme` for dark mode — not Tailwind `dark:` modifier        | Bootstrap native API                           |
| No Tailwind utilities alongside Bootstrap                            | One approach per project                       |
| No inline `style={{}}` for layout — use Grid + utilities             | Responsive, themeable                          |

```

```
