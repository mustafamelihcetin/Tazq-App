import { formatMinutes } from '@/features/dashboard/utils/weeklyHub';
import type { WeekSeg } from '@/features/week/WeekPanel';

/**
 * HAFTALIK MERKEZİN CÜMLESİ — veriden kurulur, vurgu yalnız sayılarda (ana sayfadaki yaşayan
 * cümleyle aynı dil). 2026-10-31 denetimi:
 *  · Boş hafta cümlesi günü bilmiyordu: Cumartesi günü "Hafta yeni başlıyor" yazıyordu.
 *    Yalnız Pazartesi/Salı "yeni başlıyor"; sonrası "henüz kayıt yok".
 *  · SIFIR OLAN KISIM CÜMLEYE GİRMEZ: "⟨0 görev⟩ bitirdin; alışkanlıklarda ⟨%0⟩" mavi hapla
 *    vurgulanıyordu — bilgi taşımayan, moral bozan bir vurgu.
 *  · Süre ortak biçimde ("6 sa 15 dk"); eskiden "6sa15dk" boşluksuz yazılıyordu.
 */
export interface WeekNumbers {
  focusMin: number;
  tasks: number;
  habitPct: number;
  /** Bu hafta beklenen alışkanlık günü var mı (yoksa yüzde anlamsız). */
  hasHabits: boolean;
  /** Haftanın günü, Pazartesi = 0. */
  dayIndex: number;
}

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    fresh: 'Hafta yeni başlıyor — bir alışkanlık ya da kısa bir odakla aç.',
    none: 'Bu hafta henüz kayıt yok — bir alışkanlık ya da kısa bir odakla başla.',
    lead: 'Bu hafta ',
    focus: (v: string): WeekSeg[] => [{ em: v }, ' odaklandın'],
    tasks: (n: number): WeekSeg[] => [{ em: `${n} görev` }, ' bitirdin'],
    joinActions: ', ',
    habits: (pct: number, afterAction: boolean): WeekSeg[] => [afterAction ? '; alışkanlıklarda ' : 'alışkanlıklarda ', { em: `%${pct}` }],
  },
  en: {
    fresh: 'The week is just starting — open it with a habit or a short focus.',
    none: 'Nothing logged this week yet — start with a habit or a short focus.',
    lead: 'This week ',
    focus: (v: string): WeekSeg[] => ['you focused ', { em: v }],
    tasks: (n: number, afterFocus = false): WeekSeg[] => [afterFocus ? 'finished ' : 'you finished ', { em: `${n} task${n === 1 ? '' : 's'}` }],
    joinActions: ' and ',
    habits: (pct: number, afterAction: boolean): WeekSeg[] => [afterAction ? '; habits at ' : ', habits at ', { em: `${pct}%` }],
  },
};

export function buildWeekSentence(w: WeekNumbers, lang: Lang): WeekSeg[] {
  const c = COPY[lang];
  const showFocus = w.focusMin > 0;
  const showTasks = w.tasks > 0;
  const showHabits = w.hasHabits && w.habitPct > 0;
  if (!showFocus && !showTasks && !showHabits) return [w.dayIndex <= 1 ? c.fresh : c.none];

  const actions: WeekSeg[][] = [];
  if (showFocus) actions.push(c.focus(formatMinutes(w.focusMin, lang)));
  if (showTasks) actions.push(lang === 'en' ? COPY.en.tasks(w.tasks, showFocus) : COPY.tr.tasks(w.tasks));
  const out: WeekSeg[] = [c.lead];
  actions.forEach((a, i) => { if (i > 0) out.push(c.joinActions); out.push(...a); });
  if (showHabits) out.push(...c.habits(w.habitPct, actions.length > 0));
  out.push('.');
  // "This week , habits at 40%." → "This week, habits at 40%." (yalnız alışkanlık, İngilizce)
  if (lang === 'en' && actions.length === 0) out[0] = 'This week';
  return out;
}
