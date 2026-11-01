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

/*
  "%40" Türkçede "yüzde kırk" diye okunur; ek okunuşun son ünlüsüne uyar: %40'ını, %54'ünü, %2'sini, %6'sını.
  (2026-11-01, kullanıcı: "alışkanlıklarda %40" bağlamdan kopuktu — artık "alışkanlıklarının %40'ını yaptın".)
*/
const UNITS = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
export function trPctAccusative(n: number): string {
  const word = n === 0 ? 'sıfır' : n % 10 ? UNITS[n % 10] : n % 100 ? TENS[(n / 10) % 10] : 'yüz';
  const last = [...word].reverse().find(ch => 'aıoueiöü'.includes(ch)) ?? 'ı';
  const v = 'aı'.includes(last) ? 'ı' : 'ei'.includes(last) ? 'i' : 'ou'.includes(last) ? 'u' : 'ü';
  const vowelEnd = 'aıoueiöü'.includes(word[word.length - 1]);
  return `%${n}'${vowelEnd ? 's' : ''}${v}n${v}`;
}

const COPY = {
  tr: {
    fresh: 'Hafta yeni başlıyor — bir alışkanlık ya da kısa bir odakla aç.',
    none: 'Bu hafta henüz kayıt yok — bir alışkanlık ya da kısa bir odakla başla.',
    lead: 'Bu hafta ',
    focus: (v: string): WeekSeg[] => [{ em: v }, ' odaklandın'],
    tasks: (n: number): WeekSeg[] => [{ em: `${n} görev` }, ' bitirdin'],
    habits: (pct: number): WeekSeg[] => ['alışkanlıklarının ', { em: trPctAccusative(pct) }, ' yaptın'],
    comma: ', ',
    and: ' ve ',
  },
  en: {
    fresh: 'The week is just starting — open it with a habit or a short focus.',
    none: 'Nothing logged this week yet — start with a habit or a short focus.',
    lead: 'This week ',
    focus: (v: string): WeekSeg[] => ['you focused ', { em: v }],
    tasks: (n: number, first: boolean): WeekSeg[] => [first ? 'you finished ' : 'finished ', { em: `${n} task${n === 1 ? '' : 's'}` }],
    habits: (pct: number, first: boolean): WeekSeg[] => [first ? 'you kept ' : 'kept ', { em: `${pct}%` }, ' of your habits'],
    comma: ', ',
    and: ' and ',
  },
};

export function buildWeekSentence(w: WeekNumbers, lang: Lang): WeekSeg[] {
  const c = COPY[lang];
  const showFocus = w.focusMin > 0;
  const showTasks = w.tasks > 0;
  const showHabits = w.hasHabits && w.habitPct > 0;
  if (!showFocus && !showTasks && !showHabits) return [w.dayIndex <= 1 ? c.fresh : c.none];

  // Tek cümle, tek özne: "… odaklandın, … bitirdin ve alışkanlıklarının %40'ını yaptın."
  const parts: WeekSeg[][] = [];
  if (showFocus) parts.push(c.focus(formatMinutes(w.focusMin, lang)));
  if (showTasks) parts.push(lang === 'en' ? COPY.en.tasks(w.tasks, parts.length === 0) : COPY.tr.tasks(w.tasks));
  if (showHabits) parts.push(lang === 'en' ? COPY.en.habits(w.habitPct, parts.length === 0) : COPY.tr.habits(w.habitPct));
  const out: WeekSeg[] = [c.lead];
  parts.forEach((p, i) => { if (i > 0) out.push(i === parts.length - 1 ? c.and : c.comma); out.push(...p); });
  out.push('.');
  return out;
}
