/**
 * shared/monitoring/rum.ts
 *
 * Datadog Real User Monitoring (RUM) initialization.
 * Only runs in production and staging environments — NOT in development or CI.
 *
 * Privacy controls:
 * - defaultPrivacyLevel: 'mask-user-input' prevents capturing passwords, card numbers
 * - allowedTracingUrls: restricted to own API Gateway only
 * - sessionReplaySampleRate: 20% in production, 0 in staging
 */
import { datadogRum } from '@datadog/browser-rum';

const ALLOWED_STAGES = ['production', 'staging'] as const;

const stage = import.meta.env.VITE_STAGE as string | undefined;

/**
 * Initialize Datadog RUM.
 * Call once at app entry point (main.tsx), before React renders.
 */
export function initRum(): void {
  if (!stage || !(ALLOWED_STAGES as readonly string[]).includes(stage)) {
    // Skip init in development, test, CI environments
    return;
  }

  const applicationId = import.meta.env.VITE_DATADOG_APP_ID;
  const clientToken = import.meta.env.VITE_DATADOG_CLIENT_TOKEN;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!applicationId || !clientToken) {
    console.warn(
      '[RUM] Missing VITE_DATADOG_APP_ID or VITE_DATADOG_CLIENT_TOKEN — RUM not initialized',
    );
    return;
  }

  datadogRum.init({
    applicationId,
    clientToken,
    site: 'datadoghq.com',
    service: import.meta.env.VITE_SERVICE_NAME ?? 'web',
    env: stage,
    version: import.meta.env.VITE_APP_VERSION ?? '0.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: stage === 'production' ? 20 : 0,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    allowedTracingUrls: apiBaseUrl ? [apiBaseUrl] : [],
  });

  if (stage === 'production') {
    datadogRum.startSessionReplayRecording();
  }
}
