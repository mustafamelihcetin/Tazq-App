import { calendarDayOf, parseDateKey, toDateKey } from '@/shared/utils/dateKey';

/**
 * HEDEFE GİDEN YOLUN NE KADARI GEÇTİ (0..1) — durum kartındaki halka (2026-10-31).
 *
 * Geri sayım "kaç gün kaldı" der ama yolun neresinde olduğunu söylemez: 42 gün, 50 günlük
 * bir planda başlangıç, 300 günlük birinde son düzlüktür. Ölçü: planın kurulduğu gün
 * (planSpecs[slot].startDate) → bugün, toplam yol (geçen + kalan) içinde. Başlangıç
 * bilinmiyorsa null: halka çizilmez, uydurulmaz.
 */
export function roadProgress(startIso: string | null | undefined, daysLeft: number, now: Date = new Date()): number | null {
  const startKey = calendarDayOf(startIso ?? null);
  if (!startKey) return null;
  const today = parseDateKey(toDateKey(now)).getTime();
  const elapsed = Math.round((today - parseDateKey(startKey).getTime()) / 86400000);
  if (elapsed < 0) return null;
  const total = elapsed + Math.max(0, daysLeft);
  if (total <= 0) return null;
  return Math.min(1, elapsed / total);
}
