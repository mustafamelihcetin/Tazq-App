import { scheduleOf, isPlannedDay, addDays, keyOf, weekdayOf, weekStartOf, type HabitLike } from '@/features/habits/utils/habitSchedule';

/**
 * ALIŞKANLIK DETAYI HESAPLARI (2026-10-30) — "alışkanlık takibi" algısının çekirdeği: zincir (seri),
 * geçmiş (takvim), desen (haftanın günleri). Kurallar habitSchedule ile aynı:
 *  · plan dışı gün ve MOLA zinciri bozmaz,
 *  · TEK kaçırma affedilir ("iki kez kaçırma"), art arda iki planlı kaçırma zinciri koparır,
 *  · bugün henüz yapılmadıysa ceza yok (gün bitmedi),
 *  · "haftada N" zinciri HAFTA birimindedir (hedefi tutan ardışık haftalar).
 */

export type CellState = 'done' | 'rest' | 'missed' | 'today' | 'off' | 'future' | 'before';

const bornKey = (h: HabitLike) => (h.createdAt ? keyOf(new Date(h.createdAt)) : null);

/** Takvim hücresinin durumu. */
export function cellState(h: HabitLike, key: string, today: string): CellState {
  const born = bornKey(h);
  if (key > today) return 'future';
  if ((h.completedDates ?? []).includes(key)) return 'done';
  if (born && key < born) return 'before';
  if ((h.skippedDates ?? []).includes(key)) return 'rest';
  if (scheduleOf(h).kind === 'weekly' || !isPlannedDay(h, key)) return 'off';
  return key === today ? 'today' : 'missed';
}

/** Güncel ve en uzun zincir (her gün / belirli günler: gün; haftada N: hafta). */
export function streakStats(h: HabitLike, today: string): { current: number; longest: number; unit: 'day' | 'week' } {
  const s = scheduleOf(h);
  const done = new Set(h.completedDates ?? []);
  const rest = new Set(h.skippedDates ?? []);
  const born = bornKey(h) ?? [...done].sort()[0] ?? today;

  if (s.kind === 'weekly') {
    let run = 0, longest = 0, current = 0;
    for (let w = weekStartOf(born); w <= today; w = addDays(w, 7)) {
      let n = 0;
      for (let i = 0; i < 7; i++) if (done.has(addDays(w, i))) n++;
      const thisWeek = w === weekStartOf(today);
      if (n >= s.times) run++;
      else if (!thisWeek) run = 0; // içinde bulunulan hafta bitmedi: ceza yok
      longest = Math.max(longest, run);
      current = run;
    }
    return { current, longest, unit: 'week' };
  }

  let run = 0, longest = 0, misses = 0;
  for (let k = born; k <= today; k = addDays(k, 1)) {
    if (done.has(k)) { run++; misses = 0; longest = Math.max(longest, run); continue; }
    if (rest.has(k) || !isPlannedDay(h, k) || k === today) continue;
    misses++;
    if (misses >= 2) run = 0; // art arda iki planlı kaçırma → zincir koptu (tek kaçırma affedilir)
  }
  return { current: run, longest, unit: 'day' };
}

/** Son `weeks` haftada haftanın her günü için yapılma oranı (planlı gün yoksa null). 0 = Pazartesi. */
export function weekdayPattern(h: HabitLike, today: string, weeks = 12): (number | null)[] {
  const done = new Set(h.completedDates ?? []);
  const rest = new Set(h.skippedDates ?? []);
  const born = bornKey(h);
  const planned = Array(7).fill(0), got = Array(7).fill(0);
  const weekly = scheduleOf(h).kind === 'weekly';
  for (let i = 1; i <= weeks * 7; i++) {
    const k = addDays(today, -i);
    if (born && k < born) break;
    const wd = weekdayOf(k);
    if (done.has(k)) { planned[wd]++; got[wd]++; continue; }
    if (weekly || rest.has(k) || !isPlannedDay(h, k)) continue;
    planned[wd]++;
  }
  return planned.map((p, i) => (p > 0 ? got[i] / p : null));
}

/** Ay takvimi: Pazartesi başlı haftalar, ay dışı günler null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = keyOf(new Date(year, month, 1));
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(weekdayOf(first)).fill(null);
  for (let d = 1; d <= days; d++) cells.push(keyOf(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
