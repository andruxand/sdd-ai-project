import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button.js';

const meta: Meta<typeof Button> = { component: Button, title: 'Shared/Button' };
export default meta;
type Story = StoryObj<typeof Button>;
export const Primary: Story = { args: { label: 'Primary button' } };
