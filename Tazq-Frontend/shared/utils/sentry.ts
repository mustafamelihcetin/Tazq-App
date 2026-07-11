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

/**
 * Attach the signed-in user to every subsequent event (id + role only — no PII).
 * Call on login / session hydration so errors become attributable during triage.
 */
export function setSentryUser(user: { id?: number | string; role?: string } | null): void {
  if (!DSN) return;
  if (!user || user.id == null) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: String(user.id), ...(user.role ? { role: user.role } : {}) });
}

/** Clear user context on logout. */
export function clearSentryUser(): void {
  if (!DSN) return;
  Sentry.setUser(null);
}

/**
 * Report a failed API call. Breadcrumb for every failure (trail), and a captured
 * exception for real server faults (5xx) so they surface as issues with endpoint,
 * method, status and the server-side traceId for cross-correlation.
 */
export function reportApiError(info: {
  method?: string;
  url?: string;
  status?: number;
  traceId?: string;
  message?: string;
}): void {
  if (!DSN) return;
  const { method = 'GET', url = '', status, traceId, message } = info;
  addBreadcrumb(`${method.toUpperCase()} ${url} → ${status ?? 'network'}`, 'api', { status, traceId });
  // Only escalate unexpected server-side faults to issues; expected 4xx stay as breadcrumbs.
  if (status != null && status >= 500) {
    Sentry.withScope((scope) => {
      scope.setTag('api.endpoint', url);
      scope.setTag('api.method', method.toUpperCase());
      scope.setTag('api.status', String(status));
      if (traceId) scope.setTag('server.traceId', traceId);
      scope.setLevel('error');
      Sentry.captureException(new Error(`API ${status} ${method.toUpperCase()} ${url}${message ? ` — ${message}` : ''}`));
    });
  }
}

export { Sentry };
