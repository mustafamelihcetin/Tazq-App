import { scheduleOf, isPlannedDay, keyOf, type HabitLike } from '@/features/habits/utils/habitSchedule';
import type { WeekSeg } from '@/features/week/WeekPanel';

/**
 * ALIŞKANLIKLARIN HAFTASI — Haftalık Merkez'in alışkanlık kartı (2026-10-30). Kullanıcı ızgara için:
 * "kalabalık, anlamlı değil". Hücre ızgarası VERİYİ gösteriyordu, ANLAMI değil. Burada anlam
 * hesaplanır: hedefe göre neredeyim, hangisi aksıyor, ne yaparsam toparlanır.
 *
 *  · hedef (goal): her gün → 7 · belirli günler → o gün sayısı · haftada N → N
 *  · beklenen (expected): BUGÜNE kadar planlı günler (bugün henüz yapılmadıysa sayılmaz);
 *    haftada N'de geride sayılmak için kalan günler hedefi yetiştiremez olmalı.
 *  · geride (behind) = beklenen − yapılan (0 altına inmez).
 */
export interface HabitWeek { done: number; goal: number; expected: number; behind: number; lastDone: string | null }

export function habitWeek(h: HabitLike, weekKeys: string[], todayKey: string): HabitWeek {
  const s = scheduleOf(h);
  const done = new Set(h.completedDates ?? []);
  const skipped = new Set(h.skippedDates ?? []);
  const born = h.createdAt ? keyOf(new Date(h.createdAt)) : '0000-00-00';
  const inWeek = weekKeys.filter(k => done.has(k));
  const goal = s.kind === 'weekly' ? s.times : s.kind === 'days' ? s.days.length : 7;
  let expected = 0;
  if (s.kind === 'weekly') {
    const daysLeft = weekKeys.filter(k => k >= todayKey && !done.has(k)).length;
    expected = Math.max(0, s.times - daysLeft); // kalan günler yetmiyorsa aradaki fark "beklenen"
  } else {
    for (const k of weekKeys) {
      if (k > todayKey || k < born || skipped.has(k) || !isPlannedDay(h, k)) continue;
      if (k === todayKey && !done.has(k)) continue;
      expected++;
    }
  }
  return { done: inWeek.length, goal, expected, behind: Math.max(0, expected - inWeek.length), lastDone: inWeek.sort().pop() ?? null };
}

type Lang = 'tr' | 'en';

/** Türkçe ayrılma eki, ünlü uyumu ve sertleşmeyle: Perşembe'den, Salı'dan, Pazar'dan, 3 Kasım'dan. */
export function ablativeTr(word: string): string {
  const vowels = word.toLocaleLowerCase('tr').match(/[aıoueiöü]/g);
  const last = vowels?.[vowels.length - 1] ?? 'e';
  const back = 'aıou'.includes(last);
  const hard = /[çfhkpsşt]$/i.test(word);
  return `${word}'${hard ? 't' : 'd'}${back ? 'a' : 'e'}n`;
}
const COPY = {
  tr: {
    none: 'Bu hafta için alışkanlık yok.',
    allMet: (n: number): WeekSeg[] => ['Haftanın hedefi tamam: ', { em: `${n} alışkanlık` }, ' hedefine ulaştı.'],
    onTrack: (best: string, d: number, g: number): WeekSeg[] => ['Alışkanlıklar yolunda — ', { em: best }, ` bu hafta ${d}/${g}.`],
    notStarted: (n: string): WeekSeg[] => [{ em: n }, ' bu hafta henüz başlamadı; bugün bir kez yeter.'],
    slipping: (n: string, day: string): WeekSeg[] => [{ em: n }, ` ${day} beri aksıyor; bugün yaparsan toparlanır.`],
    since: (day: string) => ablativeTr(day),
  },
  en: {
    none: 'No habits for this week.',
    allMet: (n: number): WeekSeg[] => ['Week goal reached: ', { em: `${n} habit${n === 1 ? '' : 's'}` }, ' hit their target.'],
    onTrack: (best: string, d: number, g: number): WeekSeg[] => ['Habits on track — ', { em: best }, ` at ${d}/${g} this week.`],
    notStarted: (n: string): WeekSeg[] => [{ em: n }, " hasn't started this week; once today is enough."],
    slipping: (n: string, day: string): WeekSeg[] => [{ em: n }, ` has slipped since ${day}; doing it today gets you back.`],
    since: (day: string) => day,
  },
};

/** Kartın cümlesi: en çok geride kalan alışkanlık ve toparlanma yolu; yoksa yolunda/tamam. */
export function habitWeekStory<T extends HabitLike & { name: string; color?: string }>(habits: T[], weekKeys: string[], todayKey: string, lang: Lang, dayName: (key: string) => string, colorOf?: (h: T) => string): WeekSeg[] {
  const c = COPY[lang];
  if (habits.length === 0) return [c.none];
  const rows = habits.map(h => ({ h, w: habitWeek(h, weekKeys, todayKey) }));
  const worst = rows.filter(r => r.w.behind > 0).sort((a, b) => b.w.behind - a.w.behind || a.w.done - b.w.done)[0];
  // Vurgu hapı alışkanlığın ekrandaki renginde (mod rengi ya da kullanıcının seçimi — bkz. habitColor).
  const tint = (segs: WeekSeg[], h: T) => { const color = colorOf?.(h); return color ? segs.map(s => (typeof s === 'string' ? s : { ...s, color })) : segs; };
  if (worst) {
    return tint(worst.w.lastDone ? c.slipping(worst.h.name, c.since(dayName(worst.w.lastDone))) : c.notStarted(worst.h.name), worst.h);
  }
  const met = rows.filter(r => r.w.done >= r.w.goal).length;
  if (met === rows.length) return c.allMet(met);
  const best = rows.slice().sort((a, b) => b.w.done / b.w.goal - a.w.done / a.w.goal)[0];
  return tint(c.onTrack(best.h.name, best.w.done, best.w.goal), best.h);
}
