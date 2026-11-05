import { dayKeyOf, dayNum } from '@/features/studyplan/utils/scheduler';
import { QUIT_MILESTONES } from '@/shared/store/useQuitStore';
import { toDateKey } from '@/shared/utils/dateKey';

/*
  TAKİP HESAPLARI (2026-11-05, kullanıcı: "kolaya kaçma, hepsini kendi mantığına göre"). Saf: ekran bilmez, test edilir.
  Her planın sorusu ayrı: para ne kadar kaldı ve bu hızla ne zaman biter; kaç gündür temiz ve sıradaki eşik ne; kilo hangi hızla gidiyor; bu hafta kaç gün çalışıldı.
  Tahmin yalnız gerçek kayıttan: en az iki kayıt ve bir hafta yoksa "bu hızla" denmez.
*/
const MIN_PACE_DAYS = 7;
const DAYS_PER_MONTH = 30.44;
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// ── Para ──────────────────────────────────────────────────────────
export interface SavingsInput { type: string; start: number; target: number; log: { date: string; amount: number }[]; dateKey: string | null; today: string; monthlyExpense?: number }
export interface SavingsView {
  isDebt: boolean;
  current: number;
  /** Yolun tamamı ve geçilen kısmı. */
  goal: number;
  done: number;
  pct: number;
  /** Kumbara doluluğu: elindeki paranın hedefe oranı. Başlangıç birikimi de sayılır, kullanıcı boş kumbara görmez. */
  fillPct: number;
  remaining: number;
  reached: boolean;
  /** Kalan süre ayrıldıysa her ay gereken; hedefe ulaşıldıysa ya da süre yoksa null. */
  needPerMonth: number | null;
  /** Bu hızla bitiş tarihi; yeterli kayıt yoksa ya da ters gidiyorsa null. */
  projected: string | null;
  /** Tahmin hedef tarihe yetişiyor mu. */
  onTime: boolean | null;
  /** Acil fon: birikimin karşıladığı ay. */
  coveredMonths: number | null;
}

export function savingsView(i: SavingsInput): SavingsView {
  const isDebt = i.type === 'borc';
  const sorted = [...i.log].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted.length ? sorted[sorted.length - 1].amount : i.start;
  const goal = Math.abs(i.target - i.start);
  const done = Math.max(0, isDebt ? i.start - current : current - i.start);
  const pct = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  const remaining = Math.max(0, isDebt ? current - i.target : i.target - current);
  const reached = goal > 0 && remaining <= 0;
  const today = dayNum(i.today);
  const left = i.dateKey ? dayNum(i.dateKey) - today : null;
  const needPerMonth = reached || left == null || left <= 0 ? null : Math.ceil(remaining / Math.max(1, left / DAYS_PER_MONTH));
  let projected: string | null = null;
  if (!reached && sorted.length >= 2) {
    const first = sorted[0];
    const span = dayNum(sorted[sorted.length - 1].date) - dayNum(first.date);
    const moved = isDebt ? first.amount - current : current - first.amount;
    if (span >= MIN_PACE_DAYS && moved > 0) projected = dayKeyOf(today + Math.ceil(remaining / (moved / span)));
  }
  return {
    isDebt, current, goal, done, pct, remaining, reached, needPerMonth, projected,
    fillPct: i.target > 0 ? Math.min(100, Math.round((current / i.target) * 100)) : 0,
    onTime: projected && i.dateKey ? projected <= i.dateKey : null,
    coveredMonths: i.monthlyExpense && i.monthlyExpense > 0 ? round(current / i.monthlyExpense) : null,
  };
}

// ── Bırakma ───────────────────────────────────────────────────────
export interface QuitView { prev: number; next: number | null; toNext: number; stagePct: number; best: number; lapses: number; lastLapse: string | null; beatBest: boolean }

export function quitView(days: number, item: { bestStreak: number; relapses: string[] }): QuitView {
  const next = QUIT_MILESTONES.find(m => m > days) ?? null;
  const prev = [...QUIT_MILESTONES].reverse().find(m => m <= days) ?? 0;
  const stagePct = next ? Math.round(((days - prev) / (next - prev)) * 100) : 100;
  return {
    prev, next, toNext: next ? next - days : 0, stagePct,
    best: Math.max(item.bestStreak, days),
    lapses: item.relapses.length,
    lastLapse: item.relapses.length ? item.relapses[item.relapses.length - 1] : null,
    beatBest: item.relapses.length > 0 && days > item.bestStreak,
  };
}

// ── Kilo ──────────────────────────────────────────────────────────
export interface KiloPace { perWeek: number | null; towardTarget: boolean; projected: string | null; points: { date: string; weight: number }[] }

export function kiloPace(log: { date: string; weight: number }[], target: number, today: string): KiloPace {
  const points = [...log].sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) return { perWeek: null, towardTarget: false, projected: null, points };
  const first = points[0];
  const last = points[points.length - 1];
  const span = dayNum(last.date) - dayNum(first.date);
  if (span < MIN_PACE_DAYS) return { perWeek: null, towardTarget: false, projected: null, points };
  const perDay = (last.weight - first.weight) / span;
  const toward = perDay !== 0 && Math.sign(perDay) === Math.sign(target - last.weight);
  return {
    perWeek: round(perDay * 7), towardTarget: toward, points,
    projected: toward ? dayKeyOf(dayNum(today) + Math.ceil((target - last.weight) / perDay)) : null,
  };
}

// ── Çalışma ritmi ─────────────────────────────────────────────────
/** Plan işinin yapıldığı günler: rutin günleri + görevin bittiği yerel gün. Sunucunun boş tarihi ("0001-…") sayılmaz. */
export function activeKeys(habitDates: string[], completedAts: (string | null | undefined)[]): Set<string> {
  const out = new Set(habitDates);
  for (const at of completedAts) {
    if (!at || at.startsWith('0001')) continue;
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) out.add(toDateKey(d));
  }
  return out;
}

export interface WeekRow { start: string; days: { key: string; active: boolean; future: boolean }[]; count: number; current: boolean }

/** Pazartesi başlayan haftalar, eskiden yeniye. Son satır bu hafta. */
export function weekGrid(active: Set<string>, weeks: number, today: string): WeekRow[] {
  const t = dayNum(today);
  const weekday = (((t + 3) % 7) + 7) % 7; // gün numarası 0 = 1970-01-01 perşembe; 0 = pazartesi
  const monday = t - weekday;
  return Array.from({ length: weeks }, (_, w) => {
    const startNum = monday - (weeks - 1 - w) * 7;
    const days = Array.from({ length: 7 }, (__, d) => {
      const n = startNum + d;
      const key = dayKeyOf(n);
      return { key, active: n <= t && active.has(key), future: n > t };
    });
    return { start: dayKeyOf(startNum), days, count: days.filter(d => d.active).length, current: w === weeks - 1 };
  });
}

/** Bugüne ya da düne kadar süren gün serisi: bugün daha yapılmadıysa seri bozulmuş sayılmaz. */
export function dayStreak(active: Set<string>, today: string): number {
  let n = dayNum(today);
  if (!active.has(dayKeyOf(n))) n -= 1;
  let run = 0;
  while (active.has(dayKeyOf(n))) { run++; n--; }
  return run;
}

/** Üst üste hedefi tutan hafta. Biten haftalar sayılır; bu hafta hedefi tuttuysa eklenir, tutmadıysa seriyi bozmaz. */
export function weeksOnTarget(rows: WeekRow[], target: number): number {
  let run = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.count >= target) run++;
    else if (!r.current) break;
  }
  return run;
}

// ── Ramazan ───────────────────────────────────────────────────────
export type RamadanCellState = 'done' | 'missed' | 'today' | 'todayDone' | 'future';
export interface RamadanCell { key: string; day: number; state: RamadanCellState; kadir: boolean }
const KADIR_DAY = 26;

export function ramadanCells(start: string, end: string, active: Set<string>, today: string): RamadanCell[] {
  const s = dayNum(start);
  const count = dayNum(end) - s + 1;
  const t = dayNum(today);
  return Array.from({ length: count }, (_, i) => {
    const n = s + i;
    const key = dayKeyOf(n);
    const did = active.has(key);
    const state: RamadanCellState = n > t ? 'future' : n === t ? (did ? 'todayDone' : 'today') : did ? 'done' : 'missed';
    return { key, day: i + 1, state, kadir: i + 1 === KADIR_DAY };
  });
}
