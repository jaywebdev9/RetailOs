/**
 * Optional Sentry bootstrap.
 * Set SENTRY_DSN in env to enable. Safe no-op when unset.
 *
 * Install when enabling: npm i @sentry/node -w @retail-os/api
 */
import { logger } from '../common/logger';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry disabled (no SENTRY_DSN)');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    logger.info('Sentry initialized');
  } catch {
    logger.warn(
      'SENTRY_DSN set but @sentry/node is not installed — run: npm i @sentry/node -w @retail-os/api',
    );
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    if (context) Sentry.setContext('extra', context);
    Sentry.captureException(error);
  } catch {
    // not available
  }
}
