import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button.js';

const meta: Meta<typeof Button> = {
  component: Button,
  title: 'Atoms/Button',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { label: 'Primary button', variant: 'primary' },
};
export const Secondary: Story = {
  args: { label: 'Secondary button', variant: 'secondary' },
};
export const Ghost: Story = {
  args: { label: 'Ghost button', variant: 'ghost' },
};
export const Danger: Story = {
  args: { label: 'Danger button', variant: 'danger' },
};
export const Disabled: Story = {
  args: { label: 'Disabled button', disabled: true },
};
export const Loading: Story = { args: { label: 'Save', loading: true } };
export const Small: Story = { args: { label: 'Small', size: 'sm' } };
export const Large: Story = { args: { label: 'Large', size: 'lg' } };
