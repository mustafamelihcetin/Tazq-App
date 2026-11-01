/**
 * "SEN YOKKEN" (B5, 2026-10-31) — 2 günden uzun aradan sonra açılışta, selamın yerinde tek satır:
 * "3 gün geçti · KPSS için 39 gün · 4 iş bekliyor".
 *
 * Geri dönüş anlamlı olsun ama SUÇLAMASIN: "gecikmiş" değil "bekliyor"; ünlem yok; yalnız ölçülen
 * sayılar. Ara TAKVİM günüyle sayılır (saat farkı değil): dün gece 23:00 → bugün 09:00 "1 gün" değil.
 */
export interface AwayInput {
  /** Bu cihazda bir önceki açılış (ISO) — yoksa ilk açılış. */
  lastOpen: string | null;
  now: Date;
  /** En yakın tarihli hedef (ör. sınav). */
  goal?: { label: string; days: number };
  /** Bugüne kurulmuş ya da günü geçmiş, bitmemiş iş sayısı. */
  waiting: number;
  lang: 'tr' | 'en';
}

const COPY = {
  tr: {
    gap: (n: number) => `${n} gün geçti`,
    goal: (label: string, n: number) => `${label} için ${n} gün`,
    goalToday: (label: string) => `${label} bugün`,
    waiting: (n: number) => `${n} iş bekliyor`,
  },
  en: {
    gap: (n: number) => `${n} days since your last visit`,
    goal: (label: string, n: number) => `${n} days to ${label}`,
    goalToday: (label: string) => `${label} is today`,
    waiting: (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'} waiting`,
  },
};

const MIN_DAYS = 2;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function awaySentence({ lastOpen, now, goal, waiting, lang }: AwayInput): string | null {
  if (!lastOpen) return null;
  const last = new Date(lastOpen);
  if (Number.isNaN(last.getTime())) return null;
  const gap = Math.round((dayStart(now) - dayStart(last)) / 86400000);
  if (gap < MIN_DAYS) return null;
  const c = COPY[lang];
  const parts = [c.gap(gap)];
  if (goal && goal.days >= 0) parts.push(goal.days === 0 ? c.goalToday(goal.label) : c.goal(goal.label, goal.days));
  if (waiting > 0) parts.push(c.waiting(waiting));
  return parts.join(' · ');
}

/** "Sen yokken" satırının hedef parçası için en yakın tarihli hedefin seçimde gereken alanları. */
export interface SeasonalGoalFields {
  examMode: boolean; examName: string; examDate: string | null;
  tezMode: boolean; tezName: string; tezDate: string | null;
  mulakatMode: boolean; mulakatName: string; mulakatDate: string | null;
  sporMode: boolean; sporGoal: string; sporDate: string | null;
  tasarrufMode: boolean; tasarrufName?: string; tasarrufDate: string | null;
}

const FALLBACK = {
  tr: { exam: 'Sınav', tez: 'Tez', mulakat: 'Mülakat', spor: 'Hedef', tasarruf: 'Birikim' },
  en: { exam: 'Exam', tez: 'Thesis', mulakat: 'Interview', spor: 'Goal', tasarruf: 'Savings' },
};

/**
 * En yakın tarihli (geçmemiş) hedef — tercihlerden HAFİF okuma. Ana sayfa mod özetini (ağır kanca)
 * yalnız bu satır için ikinci kez hesaplamasın diye (saniyelik render yalıtımı).
 */
export function nearestGoal(s: SeasonalGoalFields, lang: 'tr' | 'en', now: Date): AwayInput['goal'] {
  const f = FALLBACK[lang];
  const cands: Array<[boolean, string, string | null]> = [
    [s.examMode, s.examName || f.exam, s.examDate],
    [s.tezMode, s.tezName || f.tez, s.tezDate],
    [s.mulakatMode, s.mulakatName || f.mulakat, s.mulakatDate],
    [s.sporMode, s.sporGoal || f.spor, s.sporDate],
    [s.tasarrufMode, s.tasarrufName || f.tasarruf, s.tasarrufDate],
  ];
  let best: AwayInput['goal'];
  for (const [on, label, date] of cands) {
    if (!on || !date) continue;
    const d = new Date(`${date.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) continue;
    const days = Math.round((dayStart(d) - dayStart(now)) / 86400000);
    if (days >= 0 && (!best || days < best.days)) best = { label, days };
  }
  return best;
}
