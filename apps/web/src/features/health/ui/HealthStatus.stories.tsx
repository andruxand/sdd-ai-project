/**
 * apps/web/src/features/health/ui/HealthStatus.stories.tsx
 *
 * Stories for HealthStatusView — the pure presentational component.
 *
 * ## Why HealthStatusView, not HealthStatus (connected)?
 *
 * HealthStatus calls useHealthCheck() which has retry: 2 and staleTime: 0
 * hardcoded as per-query options. Per-query options in useQuery() ALWAYS
 * override QueryClient.defaultOptions — there is no external way to suppress
 * retries or refetches from a story without touching the hook source.
 *
 * HealthStatusView accepts isLoading / isError / data as plain props.
 * Stories pass props directly — zero QueryClient, zero MSW, zero async,
 * zero race conditions, zero network calls.
 *
 * HealthStatus (connected) is covered by integration / e2e tests where
 * a running (or MSW-backed) backend is available.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { HealthStatusView } from './HealthStatus.js';

const meta: Meta<typeof HealthStatusView> = {
  title: 'Features/Health/HealthStatus',
  component: HealthStatusView,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Health status badge. Visual indicators: green (ok), yellow (degraded), ' +
          'red (error), spinner (loading). ' +
          'Stories target the pure `HealthStatusView` — no network, no async.',
      },
    },
  },
  argTypes: {
    isLoading: {
      control: 'boolean',
      description: 'True while first request is in-flight',
    },
    isError: {
      control: 'boolean',
      description: 'True when last request failed',
    },
    data: { control: 'object', description: 'API response when successful' },
  },
};

export default meta;
type Story = StoryObj<typeof HealthStatusView>;

const NOW = new Date().toISOString();

/** Green badge — service fully operational. */
export const OK: Story = {
  args: {
    isLoading: false,
    isError: false,
    data: { status: 'ok', version: '1.2.3', timestamp: NOW },
  },
};

/** Yellow badge — service partially operational. */
export const Degraded: Story = {
  args: {
    isLoading: false,
    isError: false,
    data: { status: 'degraded', version: '1.2.3', timestamp: NOW },
  },
};

/** Red badge — service unavailable. Immediate, zero async. */
export const ErrorState: Story = {
  args: { isLoading: false, isError: true, data: undefined },
};

/** Spinner — initial mount before first response. */
export const Loading: Story = {
  args: { isLoading: true, isError: false, data: undefined },
};
