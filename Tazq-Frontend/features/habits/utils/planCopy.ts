import { scheduleOf, targetOf, type PlanFields, type HabitSlot, type HabitAutoSource } from '@/features/habits/utils/habitSchedule';

/** Alışkanlık planı metinleri (iki dil) — form, liste ve gün sonu aynı sözlükten konuşur. */
export const PLAN_COPY = {
  tr: {
    frequency: 'SIKLIK', amount: 'GÜNLÜK MİKTAR', time: 'ZAMAN', auto: 'OTOMATİK',
    daily: 'Her gün', weekly: 'Haftada', days: 'Belirli günler',
    timesPerWeek: (n: number) => `Haftada ${n} gün`, perDay: 'Günde', unitPh: 'birim (bardak, sayfa…)',
    weekdays: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    slots: { any: 'Her an', morning: 'Sabah', midday: 'Öğle', evening: 'Akşam' } as Record<HabitSlot | 'any', string>,
    autos: { none: 'Yok', focus: 'Odak bitince', breath: 'Nefes bitince' } as Record<HabitAutoSource | 'none', string>,
    autoHint: 'Seans bitince alışkanlık kendiliğinden işaretlenir.',
    sumDaily: 'Her gün', sumWeekly: (n: number) => `Haftada ${n}`, sumAuto: { focus: 'odaktan otomatik', breath: 'nefesten otomatik' } as Record<HabitAutoSource, string>,
    minus: 'Azalt', plus: 'Artır',
  },
  en: {
    frequency: 'FREQUENCY', amount: 'DAILY AMOUNT', time: 'TIME', auto: 'AUTOMATIC',
    daily: 'Every day', weekly: 'Per week', days: 'Specific days',
    timesPerWeek: (n: number) => `${n} days a week`, perDay: 'Per day', unitPh: 'unit (glasses, pages…)',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    slots: { any: 'Any time', morning: 'Morning', midday: 'Midday', evening: 'Evening' } as Record<HabitSlot | 'any', string>,
    autos: { none: 'Off', focus: 'After focus', breath: 'After breathing' } as Record<HabitAutoSource | 'none', string>,
    autoHint: 'The habit is checked off automatically when a session ends.',
    sumDaily: 'Every day', sumWeekly: (n: number) => `${n}× a week`, sumAuto: { focus: 'auto from focus', breath: 'auto from breathing' } as Record<HabitAutoSource, string>,
    minus: 'Decrease', plus: 'Increase',
  },
};

export type PlanLang = keyof typeof PLAN_COPY;

/** "Haftada 3 · Akşam · 8 bardak · odaktan otomatik" */
export function planSummary(p: PlanFields, lang: PlanLang): string {
  const c = PLAN_COPY[lang];
  const s = scheduleOf(p);
  const parts = [
    s.kind === 'daily' ? c.sumDaily : s.kind === 'weekly' ? c.sumWeekly(s.times) : s.days.slice().sort().map(d => c.weekdays[d]).join(' '),
  ];
  if (p.slot) parts.push(c.slots[p.slot]);
  if (targetOf(p) > 1) parts.push(`${targetOf(p)}${p.unit ? ` ${p.unit}` : '×'}`);
  if (p.autoFrom) parts.push(c.sumAuto[p.autoFrom]);
  return parts.join(' · ');
}
