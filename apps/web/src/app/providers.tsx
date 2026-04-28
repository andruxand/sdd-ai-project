/**
 * apps/web/src/app/providers.tsx
 *
 * Global providers — wraps the entire app with React Query and MUI theme.
 * Keep this file thin — only providers, no business logic.
 */
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';

import theme from './theme.js';

// ✅ React Query client with project-wide defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute before refetch
      gcTime: 5 * 60_000, // 5 minutes before garbage collected
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors — they won't succeed
        if (error instanceof Error && 'status' in error) {
          const status = (error as { status?: number }).status;
          if (status && status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0, // never auto-retry mutations
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline /> {/* normalizes browser styles */}
        {children}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
