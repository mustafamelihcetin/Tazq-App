import type { TaskNature } from '@/features/focus/focusWorthy';
import type { WaterGoal } from '@/features/modes/utils/waterGoal';
import { dayKeyOf, dayNum } from '@/features/studyplan/utils/scheduler';

/*
  GÜNÜN ROTASI (2026-11-05, kullanıcı: "6 hedefte 20 iş motive etmez; zordan kaçma, en kaliteli çözüm"). Saf: ekran bilmez, test edilir.
  Listeyi kısaltmak yetmez. Üç soru: bu kişi bir günde gerçekten kaç şey yapıyor (kapasite), bugün hangileri (adil seçim, her seçimin nedeni var), hangi sırayla (önce kısa kazanım).
  Dışarıda kalan iş silinmez, hedef "dinleniyor" der; dokunulmadıkça öne çıkar, hiçbir hedef unutulmaz. Kapasite gerçek davranıştan gelir: rota bitirildikçe büyür, zorlanınca küçülür, suçlamaz.
*/
export type StopReason = 'streak' | 'soon' | 'neglected' | 'overdue' | 'priority' | 'next';

export interface RouteItem {
  key: string;
  kind: 'task' | 'habit';
  refId: number | string;
  slot: string;
  type: string;
  goal: string;
  title: string;
  minutes: number;
  done: boolean;
  overdue?: boolean;
  streak?: number;
  /** Öğrenilmiş istek: 0 (hiç) .. 1 (çok). Bilinmiyorsa 0.5. */
  liking?: number;
  high?: boolean;
  blockId?: string;
  /** Yalnız 'deep' işte odak önerilir; 'allDay' yolu kesmez, sona düşer. */
  nature?: TaskNature;
  water?: WaterGoal | null;
}

export interface RouteGoal { slot: string; type: string; goal: string; daysLeft: number | null; lastActive: string | null; items: RouteItem[]; /** Kullanıcının bu hafta seçtiği öncelik. */ priority?: boolean }
export interface DayLog { day: string; planned: number; done: number }
export interface ComposedRoute { keys: string[]; resting: string[]; reasons: Record<string, StopReason> }

const START_CAPACITY = 4;
const MIN_CAPACITY = 3;
const MAX_CAPACITY = 8;
const HISTORY_DAYS = 14;
const STREAK_GUARD = 3;
const NEVER_ACTIVE_DAYS = 2;
const FASTING_CAPACITY = 4;
const EID_CAPACITY = 2;
const DEFAULT_TASK_MIN = 15;
const DEFAULT_HABIT_MIN = 5;
/** Tarihi çok yakın sınavı geçmez (urgency 1), onun altındaki her şeyi geçer: tarih gerçektir, öncelik tercihtir. */
const PRIORITY_WEIGHT = 0.5;

/** "… · 35 dk" başlıktan süre; yoksa makul varsayım. Yalnız tahmin, ekranda "yaklaşık" yazar. */
export function minutesOf(kind: 'task' | 'habit', title: string): number {
  const m = /(\d+)\+?[\s-]*(?:dk|dakika|min)/i.exec(title);
  if (m) return parseInt(m[1], 10);
  return kind === 'habit' ? DEFAULT_HABIT_MIN : DEFAULT_TASK_MIN;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/**
 * Bugün kaç adım. Son günlerde gerçekte yapılanın ortası; son üç rotanın hepsi bittiyse bir fazla (büyüme), sınır içinde.
 * Az veri varsa küçük başlar: ilk gün 20 iş değil, bitirilebilir bir yol.
 */
export function routeCapacity(history: DayLog[], today: string, o: { lightDay?: boolean; fasting?: boolean; eid?: boolean } = {}): number {
  const t = dayNum(today);
  const past = history.filter(h => h.planned > 0 && dayNum(h.day) < t && dayNum(h.day) >= t - HISTORY_DAYS).sort((a, b) => a.day.localeCompare(b.day));
  let cap = START_CAPACITY;
  if (past.length >= 3) {
    cap = Math.max(MIN_CAPACITY, median(past.map(h => h.done)));
    if (past.slice(-3).every(h => h.done >= h.planned)) cap += 1;
  }
  cap = Math.min(MAX_CAPACITY, cap);
  if (o.lightDay) cap = Math.max(MIN_CAPACITY - 1, cap - 1);
  if (o.fasting) cap = Math.min(FASTING_CAPACITY, cap);
  if (o.eid) cap = Math.min(EID_CAPACITY, cap);
  return cap;
}

function urgency(daysLeft: number | null): number {
  if (daysLeft == null) return 0.25;
  if (daysLeft <= 7) return 1;
  if (daysLeft <= 30) return 0.7;
  if (daysLeft <= 90) return 0.45;
  return 0.25;
}

const daysSince = (goal: RouteGoal, today: string) => (goal.lastActive ? dayNum(today) - dayNum(goal.lastActive) : NEVER_ACTIVE_DAYS);

function scoreOf(goal: RouteGoal, item: RouteItem, today: string): { score: number; reason: StopReason } {
  const atRisk = item.kind === 'habit' && (item.streak ?? 0) >= STREAK_GUARD;
  const since = daysSince(goal, today);
  const parts: [StopReason, number][] = [
    ['soon', urgency(goal.daysLeft)],
    ['streak', atRisk ? 0.75 : 0],
    ['neglected', Math.min(0.9, since * 0.15)],
    ['overdue', item.overdue ? 0.3 : 0],
    ['priority', goal.priority ? PRIORITY_WEIGHT : 0],
  ];
  const score = parts.reduce((a, [, v]) => a + v, 0) + ((item.liking ?? 0.5) - 0.5) * 0.4 + (item.high ? 0.1 : 0);
  // Neden: en güçlü gerekçe. Sınav yakın değilse "yakın" demeyiz.
  const reason: StopReason = atRisk ? 'streak' : goal.priority ? 'priority' : since >= 3 ? 'neglected' : item.overdue ? 'overdue' : (goal.daysLeft != null && goal.daysLeft <= 30) ? 'soon' : 'next';
  return { score, reason };
}

const perGoalLimit = (g: RouteGoal) => (g.priority || (g.daysLeft != null && g.daysLeft <= 14) ? 3 : 2);

/** Önce her hedefe birer adım (en gerekliden), yer kalırsa en güçlü adaylar. Yapılmış işler de rotanın parçası: gün içinde bitirilen boşa gitmez. */
export function composeRoute(goals: RouteGoal[], capacity: number, today: string): ComposedRoute {
  const reasons: Record<string, StopReason> = {};
  const scored = goals.map(g => ({
    g,
    list: g.items.filter(i => !i.done).map(i => { const s = scoreOf(g, i, today); reasons[i.key] = s.reason; return { item: i, score: s.score }; }).sort((a, b) => b.score - a.score || a.item.key.localeCompare(b.item.key)),
  }));
  const doneKeys = goals.flatMap(g => g.items.filter(i => i.done).map(i => i.key));
  const room = Math.max(0, capacity - doneKeys.length);
  const picked: string[] = [];
  const taken = new Map<string, number>();
  const byNeed = scored.filter(x => x.list.length).sort((a, b) => b.list[0].score - a.list[0].score || a.g.slot.localeCompare(b.g.slot));
  for (const x of byNeed) {
    if (picked.length >= room) break;
    picked.push(x.list[0].item.key);
    taken.set(x.g.slot, 1);
  }
  const rest = scored.flatMap(x => x.list.slice(1).map(c => ({ ...c, g: x.g }))).sort((a, b) => b.score - a.score || a.item.key.localeCompare(b.item.key));
  for (const c of rest) {
    if (picked.length >= room) break;
    const n = taken.get(c.g.slot) ?? 0;
    if (n === 0 || n >= perGoalLimit(c.g)) continue;
    picked.push(c.item.key);
    taken.set(c.g.slot, n + 1);
  }
  const keys = [...doneKeys, ...picked];
  const inRoute = new Set(keys);
  return { keys, reasons, resting: goals.filter(g => g.items.length > 0 && !g.items.some(i => inRoute.has(i.key))).map(g => g.slot) };
}

/** Sıra: önce kısa kazanım (başlamak en zoru), sonra en gerekli. Oruçta günün vaktine göre (windowRank verilir). */
export function orderStops(items: RouteItem[], picked: string[], rank?: (i: RouteItem) => number): RouteItem[] {
  const pos = new Map(picked.map((k, i) => [k, i]));
  const open = items.filter(i => !i.done && i.nature !== 'allDay').sort((a, b) => (rank ? rank(a) - rank(b) : 0) || (pos.get(a.key) ?? 0) - (pos.get(b.key) ?? 0));
  if (!rank && open.length > 1) {
    const q = open.reduce((m, i, idx) => (i.minutes < open[m].minutes ? idx : m), 0);
    open.unshift(open.splice(q, 1)[0]);
  }
  return [...items.filter(i => i.done), ...open, ...items.filter(i => !i.done && i.nature === 'allDay')];
}

export function weekRoutes(history: DayLog[], today: string): number {
  const t = dayNum(today);
  return history.filter(h => dayNum(h.day) > t - 7 && dayNum(h.day) <= t && h.planned > 0 && h.done >= h.planned).length;
}

export const withLog = (history: DayLog[], today: string, planned: number, done: number): DayLog[] =>
  [...history.filter(h => h.day !== today && dayNum(h.day) >= dayNum(today) - 30), { day: today, planned, done }].sort((a, b) => a.day.localeCompare(b.day));

// ── Ertele ────────────────────────────────────────────────────────
export type PostponeKey = 'tomorrow' | 'twoDays' | 'weekend' | 'nextWeek';
export interface PostponeOption { key: PostponeKey; date: string }

/** Anlamlı seçenekler: aynı güne denk gelen tekrar edilmez, hedef tarihini aşan sunulmaz (sınavdan sonraya ertelemek yok). */
export function postponeOptions(today: string, goalDate: string | null): PostponeOption[] {
  const t = dayNum(today);
  const wd = (((t + 3) % 7) + 7) % 7; // 0 = pazartesi
  const toSat = ((5 - wd + 7) % 7) || 7;
  const toMon = ((7 - wd) % 7) || 7;
  const raw: PostponeOption[] = [
    { key: 'tomorrow', date: dayKeyOf(t + 1) },
    { key: 'twoDays', date: dayKeyOf(t + 2) },
    { key: 'weekend', date: dayKeyOf(t + toSat) },
    { key: 'nextWeek', date: dayKeyOf(t + toMon) },
  ];
  const seen = new Set<string>();
  return raw.filter(o => (seen.has(o.date) || (goalDate && o.date > goalDate) ? false : (seen.add(o.date), true)));
}

/** Ertelenen günlük iş artık "günün üretimi" değil: o gün yenisini engellemesin, gün geçince silinmesin. */
export function postponedTags(tags: string[] | null | undefined): string[] {
  return [...new Set([...(tags ?? []).filter(t => t !== 'daily'), 'postponed'])];
}
