````skill
---
name: form-validation-patterns
description: Implement forms with React Hook Form and Zod — validation, error display, async submission, and accessibility.
---

## Stack (mandatory per frontend-implementer agent)

- **React Hook Form** — form state, submission, field registration.
- **Zod** — schema definition and validation (client-side mirrors backend schema).
- **`@hookform/resolvers/zod`** — connects RHF to Zod.

```bash
npm install react-hook-form zod @hookform/resolvers
````

## Basic form pattern

```typescript
// apps/web/src/features/orders/ui/CreateOrderForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 1. Define schema — mirror backend validation rules
const CreateOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .positive('Quantity must be at least 1')
    .max(100, 'Quantity cannot exceed 100'),
});

type CreateOrderFormValues = z.infer<typeof CreateOrderSchema>;

export function CreateOrderForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<CreateOrderFormValues>({
    resolver: zodResolver(CreateOrderSchema),
    defaultValues: { quantity: 1 },
  });

  // 2. Mutation
  const createOrder = useCreateOrder();

  const onSubmit = async (data: CreateOrderFormValues) => {
    try {
      await createOrder.mutateAsync(data);
      reset();
      onSuccess();
    } catch (err) {
      // Map API validation errors back to form fields
      if (err instanceof ApiError && err.status === 400 && err.fields) {
        Object.entries(err.fields).forEach(([field, message]) => {
          setError(field as keyof CreateOrderFormValues, { message: String(message) });
        });
      } else {
        // Global form error
        setError('root', { message: 'Failed to create order. Please try again.' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Create order">
      {/* Global error */}
      {errors.root && (
        <div role="alert" aria-live="assertive" className="form-error-banner">
          {errors.root.message}
        </div>
      )}

      <div>
        <label htmlFor="quantity">Quantity *</label>
        <input
          id="quantity"
          type="number"
          aria-invalid={!!errors.quantity}
          aria-describedby={errors.quantity ? 'quantity-error' : undefined}
          {...register('quantity', { valueAsNumber: true })}
        />
        {errors.quantity && (
          <p id="quantity-error" role="alert">
            {errors.quantity.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          aria-invalid={!!errors.notes}
          aria-describedby={errors.notes ? 'notes-error' : undefined}
          {...register('notes')}
        />
        {errors.notes && (
          <p id="notes-error" role="alert">
            {errors.notes.message}
          </p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Order'}
      </button>
    </form>
  );
}
```

## Controlled inputs with Controller (for custom components)

Use `Controller` when the input is not a native HTML element (UI library
components, date pickers, rich selects):

```typescript
import { Controller } from 'react-hook-form';

// For a custom Select component (MUI, Radix, etc.)
<Controller
  name="status"
  control={control}
  render={({ field, fieldState }) => (
    <Select
      {...field}
      label="Status"
      error={!!fieldState.error}
      helperText={fieldState.error?.message}
    >
      <MenuItem value="PENDING">Pending</MenuItem>
      <MenuItem value="CONFIRMED">Confirmed</MenuItem>
    </Select>
  )}
/>
```

## Multi-step / wizard forms

Use `useForm` with `mode: 'onChange'` and trigger validation per step:

```typescript
const { trigger, getValues } = useForm({ resolver: zodResolver(FullSchema) });

// Step 1: validate only step-1 fields before advancing
const canAdvance = await trigger(['firstName', 'lastName', 'email']);
if (!canAdvance) return; // stay on step 1

goToStep(2);
```

Or split into sub-schemas and merge with `.merge()`:

```typescript
const Step1Schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
const Step2Schema = z.object({ address: z.string().min(1) });
const FullSchema = Step1Schema.merge(Step2Schema);
```

## Async validation (server-side checks)

```typescript
const schema = z.object({
  email: z
    .string()
    .email()
    .refine(
      async (email) => {
        const res = await fetch(
          `/api/users/check-email?email=${encodeURIComponent(email)}`,
        );
        const { available } = await res.json();
        return available;
      },
      { message: 'This email is already registered' },
    ),
});

// Use mode: 'onBlur' to avoid firing async validation on every keystroke
const form = useForm({ resolver: zodResolver(schema), mode: 'onBlur' });
```

## Field arrays (dynamic lists)

```typescript
import { useFieldArray } from 'react-hook-form';

const ItemsSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1, 'Add at least one item'),
});

function ItemsForm() {
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`items.${index}.productId`)} />
          <input {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
          {errors.items?.[index]?.quantity && (
            <p role="alert">{errors.items[index].quantity.message}</p>
          )}
          <button type="button" onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ productId: '', quantity: 1 })}>
        Add item
      </button>
      {errors.items?.root && <p role="alert">{errors.items.root.message}</p>}
    </>
  );
}
```

## Error display conventions

- Field errors: `<p role="alert" id="{fieldId}-error">` linked via `aria-describedby`.
- Global/submit errors: `<div role="alert" aria-live="assertive">`.
- Never use `alert()` or `console.error` for form validation messages.
- Show field errors only after the field is touched or after first submit attempt.

## Accessibility rules

- Every input has a `<label>` with matching `htmlFor` / `id`.
- Error elements have `role="alert"` so screen readers announce them.
- `aria-invalid={!!error}` on the input when there is an error.
- `aria-describedby` points to the error element id when visible.
- `aria-busy={isSubmitting}` on the submit button.
- `noValidate` on `<form>` — disables native browser validation (use Zod instead).

## Testing forms

```typescript
// apps/web/src/features/orders/ui/CreateOrderForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateOrderForm } from './CreateOrderForm';

test('shows validation error when quantity is zero', async () => {
  render(<CreateOrderForm onSuccess={vi.fn()} />);

  await userEvent.clear(screen.getByLabelText(/quantity/i));
  await userEvent.type(screen.getByLabelText(/quantity/i), '0');
  await userEvent.click(screen.getByRole('button', { name: /create order/i }));

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Quantity must be at least 1');
  });
});

test('disables submit button while submitting', async () => {
  // mock mutation to return a pending promise
  ...
  expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
});
```

## Anti-patterns

- ❌ Managing form state with `useState` — React Hook Form handles this more efficiently.
- ❌ `type: 'manual'` errors everywhere instead of using `zodResolver` — loses schema-driven validation.
- ❌ `console.error(errors)` in `onSubmit` — errors should be displayed in the UI.
- ❌ Not using `aria-describedby` for error messages — screen readers won't announce them.
- ❌ Showing all errors on render — show only on touch/blur or after submission attempt.
- ❌ Duplicating Zod schema between frontend and backend — share via `packages/contracts/` or keep closely in sync.
- ❌ `e.preventDefault()` manually in submit handler — `handleSubmit` already handles this.

## Checklist

- [ ] `zodResolver` connected — no custom validation logic in form handler.
- [ ] Schema mirrors backend validation rules (same constraints).
- [ ] Every input has `<label>` + `htmlFor` / `id` pair.
- [ ] Field errors use `role="alert"` + `aria-describedby` on input.
- [ ] Global submit errors use `role="alert"` + `aria-live="assertive"`.
- [ ] `aria-invalid`, `aria-busy` set correctly on inputs and submit button.
- [ ] `noValidate` on `<form>` element.
- [ ] API 400 validation errors mapped back to form fields via `setError`.
- [ ] `isSubmitting` disables and labels the submit button.
- [ ] Component tests cover: valid submit, field validation errors, API error mapping.

```

```
