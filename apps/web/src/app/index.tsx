/**
 * apps/web/src/app/index.tsx
 *
 * App shell — global providers, router, and theme.
 * This is the composition root. No business logic here.
 */
import { Box, Typography, Container } from '@mui/material';

import { HealthStatus } from '../features/health/index.js';

import { Providers } from './providers.js';

/**
 * Main App component.
 * Wraps everything in Providers (React Query + MUI theme).
 */
export function App() {
  return (
    <Providers>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            alignItems: 'center',
          }}
        >
          <Typography variant="h1" component="h1">
            Health Check Demo
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Service health status updates every 30 seconds.
          </Typography>
          <HealthStatus />
        </Box>
      </Container>
    </Providers>
  );
}

export default App;
