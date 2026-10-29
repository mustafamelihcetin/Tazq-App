/**
 * ALIŞKANLIK SINIRI (madde 6) — aynı anda en çok 7 aktif alışkanlık, modlarınkiler dahil.
 *
 * Neden 7: çalışan bellek aynı anda yaklaşık 7±2 öğeyi izleyebilir (Miller); alışkanlık
 * araştırmaları da az sayıda alışkanlığa odaklananların tutarlılığının daha yüksek
 * olduğunu söyler. Liste uzadıkça her biri "bugün yapmasam da olur" olur. Sınır bir
 * yasak değil bir odak kuralı: fazlası SİLİNMEZ, "dinlendirilir" (duraklatılır) —
 * geçmişi ve serisi korunur, tek dokunuşla geri gelir.
 */
import type { Habit } from '@/features/habits/store/useHabitStore';

export const HABIT_LIMIT = 7;

/** Dinlenmeyen (aktif) alışkanlıklar. `pausedAt: null` = dinlendirmeden çıkarılmış → aktif. */
export const activeHabits = <T extends Pick<Habit, 'pausedAt'>>(habits: T[]): T[] => habits.filter(h => !h.pausedAt);

/** Sınıra kadar kaç alışkanlık daha eklenebilir (0 = dolu; sınır üstündeyse de 0). */
export const roomLeft = (habits: Pick<Habit, 'pausedAt'>[]): number => Math.max(0, HABIT_LIMIT - activeHabits(habits).length);

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Dinlendirmeye en uygun `count` alışkanlık: son 14 günde EN AZ yapılanlar (eşitlikte en yeni eklenen). */
export function restSuggestions<T extends Pick<Habit, 'id' | 'pausedAt' | 'completedDates' | 'createdAt'>>(habits: T[], count: number, today: Date = new Date()): T[] {
  const window = new Set(Array.from({ length: 14 }, (_, i) => keyOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i))));
  const score = (h: T) => (h.completedDates ?? []).filter(d => window.has(d)).length;
  return activeHabits(habits)
    .map((h, i) => ({ h, s: score(h), i }))
    .sort((a, b) => a.s - b.s || (b.h.createdAt ?? '').localeCompare(a.h.createdAt ?? '') || a.i - b.i)
    .slice(0, Math.max(0, count))
    .map(x => x.h);
}

/** [from, to) aralığındaki günler ('YYYY-MM-DD'). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (d < end) { out.push(keyOf(d)); d.setDate(d.getDate() + 1); }
  return out;
}
