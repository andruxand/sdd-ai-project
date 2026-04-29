/**
 * apps/web/src/features/health/ui/HealthStatus.tsx
 *
 * Exports two components:
 *
 * - HealthStatusView  Pure presentational component. Accepts isLoading,
 *                     isError, and data as props. No side effects.
 *                     Use this in Storybook stories.
 *
 * - HealthStatus      Thin connected wrapper. Calls useHealthCheck() and
 *                     delegates rendering to HealthStatusView.
 *                     Use this in the application.
 */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { Box, Typography, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

import { useHealthCheck } from '../api/use-health-check.js';
import type {
  HealthResponse,
  HealthStatus as HealthStatusType,
} from '../types.js';

/**
 * Styled container for health status badge.
 * Uses theme palette for colors.
 */
const StatusBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'statusType',
})<{ statusType: 'ok' | 'degraded' | 'error' }>(({ theme, statusType }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: 600,
  ...(statusType === 'ok' && {
    backgroundColor: `${theme.palette.success.main}1a`, // 10% opacity
    color: theme.palette.success.dark, // dark variant for WCAG AA contrast on light bg
  }),
  ...(statusType === 'degraded' && {
    backgroundColor: `${theme.palette.warning.main}1a`,
    color: theme.palette.warning.dark, // dark variant for WCAG AA contrast on light bg
  }),
  ...(statusType === 'error' && {
    backgroundColor: `${theme.palette.error.main}1a`,
    color: theme.palette.error.dark, // dark variant for WCAG AA contrast on light bg
  }),
}));

/**
 * Maps health status from API to visual state.
 */
function getStatusType(
  isLoading: boolean,
  isError: boolean,
  data?: { status: HealthStatusType },
): 'ok' | 'degraded' | 'error' {
  if (isLoading) return 'ok'; // loading state shows neutral
  if (isError) return 'error'; // network error or non-200
  if (!data) return 'error'; // no data (should not happen if not isError)

  // Map API status to visual state
  if (data.status === 'ok') return 'ok';
  if (data.status === 'degraded') return 'degraded';
  return 'error'; // fallback
}

/**
 * Gets the icon for each status type.
 */
function getStatusIcon(statusType: 'ok' | 'degraded' | 'error') {
  if (statusType === 'ok') return <CheckCircleIcon fontSize="small" />;
  if (statusType === 'degraded') return <WarningIcon fontSize="small" />;
  return <ErrorIcon fontSize="small" />;
}

/**
 * Gets the label for each status type.
 */
function getStatusLabel(
  statusType: 'ok' | 'degraded' | 'error',
  isLoading: boolean,
): string {
  if (isLoading) return 'Checking...';
  if (statusType === 'ok') return 'Service Operational';
  if (statusType === 'degraded') return 'Service Degraded';
  return 'Service Unavailable';
}

/**
 * Props for the pure presentational component.
 * Mirrors exactly what useHealthCheck() returns so HealthStatus can
 * spread its result directly.
 */
export interface HealthStatusViewProps {
  /** True while the first request is in-flight. */
  isLoading: boolean;
  /** True when the last request failed (network error or non-200). */
  isError: boolean;
  /** Response data when the request succeeded. */
  data?: HealthResponse;
}

/**
 * HealthStatusView — pure presentational component.
 *
 * Renders the health badge based on explicit props with no side effects.
 * Stories and unit tests should target this component.
 *
 * States:
 * - isLoading=true             → spinner + "Checking..."
 * - isError=true               → red badge + "Service Unavailable"
 * - data.status="ok"           → green badge + "Service Operational"
 * - data.status="degraded"     → yellow badge + "Service Degraded"
 */
export function HealthStatusView({
  isLoading,
  isError,
  data,
}: HealthStatusViewProps) {
  const statusType = getStatusType(isLoading, isError, data);
  const statusIcon = getStatusIcon(statusType);
  const statusLabel = getStatusLabel(statusType, isLoading);

  return (
    <StatusBadge
      statusType={statusType}
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
    >
      {isLoading ? (
        <CircularProgress
          size={16}
          color="inherit"
          aria-label="Checking service status"
        />
      ) : (
        statusIcon
      )}
      <Typography
        component="span"
        sx={{ fontSize: 'inherit', fontWeight: 'inherit' }}
      >
        {statusLabel}
      </Typography>
      {data?.version && (
        <Typography
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 400,
            opacity: 0.8,
            marginLeft: 0.5,
          }}
        >
          v{data.version}
        </Typography>
      )}
    </StatusBadge>
  );
}

/**
 * HealthStatus — connected component.
 *
 * Thin wrapper that calls useHealthCheck() and delegates all rendering
 * to HealthStatusView. Use this in the application, not in stories.
 */
export function HealthStatus() {
  const { data, isLoading, isError } = useHealthCheck();
  return (
    <HealthStatusView data={data} isLoading={isLoading} isError={isError} />
  );
}
