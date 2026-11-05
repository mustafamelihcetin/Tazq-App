import { ramadanGoalDate } from '@/features/modes/utils/ramadanPreview';
import { calendarDayOf } from '@/shared/utils/dateKey';
import type { PlanMode, SeasonalPrefs } from '@/features/modes/store/usePrefsStore';

/*
  HEDEF YUVALARI TEK TABLODA (2026-11-05, kullanıcı: "içgörü önizleme ile çalışma planı çakışıyor; tek yerde topla, tüm modlar için").
  Planım ekranı hangi hedeflerin açık olduğunu buradan okur. Saf: test edilir, ekran bilmez.
*/
export type PlanType = 'exam' | 'tez' | 'mulakat' | 'spor' | 'ramazan' | 'tasarruf' | 'birakma';

interface SlotRow {
  slot: PlanMode;
  type: PlanType;
  on: (s: SeasonalPrefs) => boolean;
  name: (s: SeasonalPrefs) => string;
  date?: keyof SeasonalPrefs;
}

const named = (key: keyof SeasonalPrefs) => (s: SeasonalPrefs) => String(s[key] ?? '');

export const PLAN_SLOTS: SlotRow[] = [
  { slot: 'exam', type: 'exam', on: s => s.examMode, name: named('examName'), date: 'examDate' },
  { slot: 'exam2', type: 'exam', on: s => !!s.exam2Name, name: named('exam2Name'), date: 'exam2Date' },
  { slot: 'exam3', type: 'exam', on: s => !!s.exam3Name, name: named('exam3Name'), date: 'exam3Date' },
  { slot: 'tez', type: 'tez', on: s => s.tezMode, name: named('tezName'), date: 'tezDate' },
  { slot: 'mulakat', type: 'mulakat', on: s => s.mulakatMode, name: named('mulakatName'), date: 'mulakatDate' },
  { slot: 'mulakat2', type: 'mulakat', on: s => !!s.mulakat2Name, name: named('mulakat2Name'), date: 'mulakat2Date' },
  { slot: 'mulakat3', type: 'mulakat', on: s => !!s.mulakat3Name, name: named('mulakat3Name'), date: 'mulakat3Date' },
  { slot: 'spor', type: 'spor', on: s => s.sporMode, name: named('sporGoal'), date: 'sporDate' },
  { slot: 'spor2', type: 'spor', on: s => !!s.spor2Goal, name: named('spor2Goal'), date: 'spor2Date' },
  { slot: 'spor3', type: 'spor', on: s => !!s.spor3Goal, name: named('spor3Goal'), date: 'spor3Date' },
  { slot: 'ramazan', type: 'ramazan', on: s => s.ramazan, name: () => '' },
  { slot: 'tasarruf', type: 'tasarruf', on: s => s.tasarrufMode, name: named('tasarrufName'), date: 'tasarrufDate' },
  { slot: 'birakma', type: 'birakma', on: s => s.birakmaMode, name: named('birakmaName') },
];

export interface ActivePlan { slot: PlanMode; type: PlanType; name: string; date: string | null; dateKey?: keyof SeasonalPrefs; }

type PrefsLike = { seasonal: SeasonalPrefs } & Record<string, unknown>;
const idsOf = (p: PrefsLike, slot: string, kind: 'Habit' | 'Task') => (p[`${slot}Plan${kind}Ids`] as (string | number)[] | undefined) ?? [];

export function planHasItems(p: PrefsLike, slot: string): boolean {
  return idsOf(p, slot, 'Habit').length + idsOf(p, slot, 'Task').length > 0;
}

/** Planı başlamış hedefler, en yakın tarih önde. Tarihsiz olanlar sonda. */
export function activePlans(p: PrefsLike): ActivePlan[] {
  return PLAN_SLOTS
    .filter(r => r.on(p.seasonal) && planHasItems(p, r.slot))
    .map((r): ActivePlan => ({ slot: r.slot, type: r.type, name: r.name(p.seasonal), date: r.type === 'ramazan' ? ramadanGoalDate() : r.date ? calendarDayOf(p.seasonal[r.date] as string | null) : null, dateKey: r.date }))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}

/** "DenemeProje — Veri Analizi: ..." ekranda hedef adı zaten yazıyor; satırda tekrar etmez. */
export function withoutGoalName(title: string, name: string): string {
  if (!name || !title.startsWith(name)) return title;
  const rest = title.slice(name.length).replace(/^\s*[—:·-]\s*/, '');
  return rest ? rest.charAt(0).toLocaleUpperCase('tr') + rest.slice(1) : title;
}
