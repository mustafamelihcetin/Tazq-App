/**
 * Hafif, sıfır-maliyet ürün telemetrisi.
 *
 * Harici analytics servisi YOK (bütçe/maliyet yok). Olaylar mevcut Sentry
 * breadcrumb altyapısına yazılır (ücretsiz katman) + geliştirmede console'a.
 * Aktivasyon/retention'ı ölçmek ve hata bağlamı zenginleştirmek içindir.
 *
 * GİZLİLİK: Asla görev metni, e-posta, token gibi PII gönderme. Yalnız sayısal
 * ölçümler ve enum'lar (mod adı, faz, gün sayısı vb.).
 */

import { addBreadcrumb } from './sentry';

export type AnalyticsEvent =
  // Aktivasyon
  | 'onboarding_step'
  | 'onboarding_completed'
  | 'first_task_completed'
  | 'first_win'
  // Modlar / plan
  | 'mode_activated'
  | 'mode_deactivated'
  | 'daily_plan_shown'
  | 'plan_task_completed'
  // Odak
  | 'focus_started'
  | 'focus_completed'
  // Gamification
  | 'achievement_unlocked'
  | 'streak_milestone'
  // Rapor / koç
  | 'report_opened'
  | 'mode_summary_opened'
  | 'coach_tip_shown'
  // UI
  | 'ui_mode_changed'
  | 'ui_rage_click'
  | 'ux_rating_submitted';

type Props = Record<string, string | number | boolean | null | undefined>;

// PII sızıntısını önlemek için izin verilen anahtarlar dışında uzun string'leri ele.
function sanitize(props?: Props): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    // Uzun serbest metinleri (olası PII) kırp — telemetri sayısal/enum olmalı.
    if (typeof v === 'string' && v.length > 40) {
      out[k] = `${v.slice(0, 40)}…`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Bir ürün olayını kaydet (ücretsiz; breadcrumb + dev console). */
export function track(event: AnalyticsEvent, props?: Props): void {
  const data = sanitize(props);
  try {
    addBreadcrumb(event, 'analytics', data);
  } catch {}
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[analytics] ${event}`, data ?? '');
  }
}
