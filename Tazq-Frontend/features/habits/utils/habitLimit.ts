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

/*
  AYRILDI (2026-11-05, kullanıcı: "3 alışkanlık eklesem moddan düzgün faydalanamam"). 7 sınırı artık KİŞİSEL alışkanlıklar
  için; mod rutinleri ayrı sayılır: mod başına en çok 2, toplam en çok 4. Kişisel alışkanlık modu engellemez, modlar da
  günü boğmaz: en kötü gün 7 + 4.
*/
export const HABIT_LIMIT = 7;
export const MODE_ROUTINE_PER_MODE = 2;
export const MODE_ROUTINE_TOTAL = 4;

type HabitRef = Pick<Habit, 'pausedAt'> & Partial<Pick<Habit, 'id' | 'planMode'>>;

/** Alışkanlığın modu (exam2 → exam; eski kayıtlarda kimlik öneki); kişiselse null. */
export function modeOf(h: Partial<Pick<Habit, 'id' | 'planMode'>>): string | null {
  const raw = h.planMode || h.id?.match(/^habit_(ramazan|yks|kpss|exam|tez|mulakat|spor|tasarruf|birakma)_/)?.[1];
  if (!raw) return null;
  const base = raw.replace(/\d+$/, '');
  return base === 'yks' || base === 'kpss' ? 'exam' : base;
}

/** Dinlenmeyen (aktif) alışkanlıklar. `pausedAt: null` = dinlendirmeden çıkarılmış → aktif. */
export const activeHabits = <T extends Pick<Habit, 'pausedAt'>>(habits: T[]): T[] => habits.filter(h => !h.pausedAt);

/** Sınıra kadar kaç alışkanlık daha eklenebilir (0 = dolu; sınır üstündeyse de 0). */
export const roomLeft = (habits: HabitRef[]): number => Math.max(0, HABIT_LIMIT - activeHabits(habits).filter(h => !modeOf(h)).length);

/** Bu mod kaç rutin daha açabilir (mod başına ve toplam sınırın küçüğü). */
export function modeRoomLeft(habits: HabitRef[], mode: string): number {
  const base = mode.replace(/\d+$/, '');
  const active = activeHabits(habits).map(modeOf).filter(Boolean);
  return Math.max(0, Math.min(MODE_ROUTINE_PER_MODE - active.filter(m => m === (base === 'yks' || base === 'kpss' ? 'exam' : base)).length, MODE_ROUTINE_TOTAL - active.length));
}

/** Sınır üstündeki mod rutinlerinden dinlendirilecekler: son iki haftada en az yapılanlar. */
export function routinesToRest<T extends Pick<Habit, 'id' | 'pausedAt' | 'completedDates' | 'createdAt'> & Partial<Pick<Habit, 'planMode'>>>(habits: T[], today: Date = new Date()): T[] {
  const routines = activeHabits(habits).filter(h => modeOf(h));
  const out = new Set<T>();
  for (const mode of new Set(routines.map(h => modeOf(h) as string))) {
    const own = routines.filter(h => modeOf(h) === mode);
    restSuggestions(own, own.length - MODE_ROUTINE_PER_MODE, today).forEach(h => out.add(h));
  }
  const left = routines.filter(h => !out.has(h));
  restSuggestions(left, left.length - MODE_ROUTINE_TOTAL, today).forEach(h => out.add(h));
  return [...out];
}

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
