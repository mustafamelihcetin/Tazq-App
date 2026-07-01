import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

export function initSentry(): void {
  // Skip if no DSN configured (local dev without Sentry account)
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    debug: false,

    // 20% of production transactions — adjust once baseline volume is known
    tracesSampleRate: __DEV__ ? 0 : 0.2,

    // Attach build metadata to every event
    release: `${Constants.expoConfig?.name ?? 'tazq'}@${Constants.expoConfig?.version ?? '1.0.0'}`,
    environment: __DEV__ ? 'development' : 'production',

    // Breadcrumbs: keep the last 50 significant events per session
    maxBreadcrumbs: 50,

    // Development'ta devre dışı — production build'de aktif
    enabled: !__DEV__,

    // Ignore non-actionable noise
    ignoreErrors: [
      'Network request failed',
      'Load failed',
      'AbortError',
      'ResizeObserver loop limit exceeded',
    ],

    beforeSend(event) {
      // Strip any personally identifiable information from extra data
      if (event.extra) {
        delete (event.extra as Record<string, unknown>).token;
        delete (event.extra as Record<string, unknown>).email;
      }
      return event;
    },
  });
}

/**
 * Capture a handled error with optional context tags.
 * Use for expected-but-important failures (e.g. offline sync errors).
 */
export function captureError(error: unknown, tags?: Record<string, string>): void {
  if (!DSN) return;
  Sentry.withScope((scope) => {
    if (tags) {
      Object.entries(tags).forEach(([k, v]) => scope.setTag(k, v));
    }
    Sentry.captureException(error);
  });
}

/**
 * Add a breadcrumb for a significant user action (navigation, form submit, etc.)
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (!DSN) return;
  Sentry.addBreadcrumb({ message, category, level: 'info', data });
}

export { Sentry };
