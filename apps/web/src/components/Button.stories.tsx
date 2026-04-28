/**
 * @deprecated This story covers the migration stub in apps/web/src/components/Button.tsx.
 *
 * The canonical Button lives in packages/shared/ui/atoms/Button/Button.tsx (not yet created).
 * Once that package is wired up, this story should be removed and replaced by the one
 * co-located with the real component.
 *
 * The stub intentionally exposes only a `label` prop — colour, variant, size, and all other
 * design-system controls will live on the real Button.
 */
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button.js';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Shared/Button (deprecated stub)',
  tags: ['deprecated'],
  parameters: {
    docs: {
      description: {
        component:
          '**⚠️ Deprecated migration stub.** This component only accepts a `label` prop. ' +
          'Colour, variant, size, and icon controls will be available on the canonical `Button` ' +
          'in `packages/shared/ui/atoms/Button/` once the design-system package is wired up.',
      },
    },
  },
  argTypes: {
    label: {
      description: 'Text displayed inside the button.',
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { label: 'Click me' } };
