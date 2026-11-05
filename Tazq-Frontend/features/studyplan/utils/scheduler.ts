/*
  SINAV PLANLAYICI (2026-11-05, kullanıcı: "kusursuz bir mekanizma olmalı"). Saf fonksiyonlar: aynı girdi, aynı plan; internet ve LLM
  yok. Tasarım ve simülasyon sonuçları: docs/sinav-modu-tasarim.md.

  Beş kural: gerçekleşen esastır (üretim ilerleme sayılmaz) · kapasite tavandır (kaçan iş yığılmaz) · yakın günler sabittir ·
  her şey cihazda · vaat yok (yalnız "sığıyor/sıkışık/sığmıyor").

  Tek formül ("dakika başına en çok soru") simülasyonda reddedildi: tekrarı kayırıp yeni konuya geçemiyordu. Bu yüzden deneme,
  tekrar ve yeni konu ayrı bütçelerle yarışır.
*/

export type TopicKind = 'ezber' | 'beceri' | 'dil';
export type BlockType = 'yeni' | 'tekrar' | 'pratik' | 'deneme' | 'analiz' | 'hafif';

export interface PlanTopic {
  id: string;
  subject: string;
  /** Sınavdaki göreli ağırlık. Yalnız sıralama içindir, kullanıcıya gösterilmez. */
  q: number;
  /** Sıfırdan çalışma için kaba saat tahmini; kullanıcı "bitti" dedikçe gerçek öne geçer. */
  hours: number;
  kind: TopicKind;
}

export interface ExamUnit {
  id: string;
  topics: PlanTopic[];
  /** Tam deneme süresi (dk). */
  mockMin: number;
  /** Sınavın gün numarası (bkz. dayNum). */
  examDay: number;
}

export interface TopicState {
  /** Kapsam: 0 başlanmadı, 1 bitti. */
  cov: number;
  /** Unutma sabiti (gün): büyüdükçe daha yavaş unutulur. */
  S: number;
  lastTouch: number | null;
  /** Tekrar zincirinde kaçıncı adım. */
  step: number;
  /** Sıradaki tekrarın günü. */
  due: number | null;
  /** Kullanıcı "zorlanıyorum" dedi. */
  weak?: boolean;
  /** Kullanıcı konunun bittiğini onayladı: tekrar sorulmaz. */
  rated?: boolean;
  /** Son değişikliğin zamanı (bulut birleştirmesi: son yazan kazanır). */
  at: number;
}

export interface UnitState {
  topics: Record<string, TopicState>;
  /** Derse harcanan dakika: ders dengesi bundan hesaplanır. */
  subMin: Record<string, number>;
  lastMock: number | null;
  /** Son günlerde yeni konu bloğu alan konular. Üst üste sınırı için. */
  hist: Record<number, string[]>;
  /** Kopuştan dönüşte kalan hafif gün sayısı. */
  returnLeft: number;
  /** Deneme sonrası öne alınacak süreli/karma pratik konuları. */
  practice: string[];
  /** Denemede geride kalan dersler: ders → çarpan. */
  boost: Record<string, number>;
}

export interface Block {
  type: BlockType;
  unitId: string;
  topicId?: string;
  subject?: string;
  min: number;
}

export type CapFn = (day: number) => number;

const REVIEW_STEPS = [2, 7, 21, 45];
const BLOCK_MAX = 50;
const REVIEW_SHARE = 0.4;
const REVIEW_SHARE_RETURN = 0.8;
const RETURN_LOAD = 0.6;
const MOCK_MIN_COVERAGE = 0.35;
const FINAL_MIN_COVERAGE = 0.15;
const MAX_STREAK = 3;
const LAST_ROUND_MIN = 3;
const LAST_ROUND_MAX = 21;

/** 'YYYY-MM-DD' → gün numarası. Saat diliminden ve yaz saatinden bağımsızdır. */
export function dayNum(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function dayKeyOf(num: number): string {
  return new Date(num * 86400000).toISOString().slice(0, 10);
}

export const startS = (kind: TopicKind) => (kind === 'ezber' ? 4 : 9);

/** Başlangıç seviyesi kapsama çevrilir; önceden bilinen konu daha yavaş unutulur. */
export const LEVEL_COVERAGE = { yok: 0, biraz: 0.4, tekrar: 0.75 } as const;
export type StartLevel = keyof typeof LEVEL_COVERAGE;

export function initTopic(t: PlanTopic, level: StartLevel, at: number, day: number): TopicState {
  const cov = LEVEL_COVERAGE[level];
  return { cov, S: cov > 0 ? startS(t.kind) * 1.8 : startS(t.kind), lastTouch: cov > 0 ? day - 30 : null, step: 0, due: cov >= 0.75 ? day : null, at };
}

export function emptyUnitState(): UnitState {
  return { topics: {}, subMin: {}, lastMock: null, hist: {}, returnLeft: 0, practice: [], boost: {} };
}

/** Eksik konuları doldurur (sınava yeni konu eklenmiş ya da yeni kurulmuş olabilir). */
export function ensureTopics(unit: ExamUnit, st: UnitState, levelOf: (t: PlanTopic) => StartLevel, at: number, day: number): UnitState {
  let topics = st.topics;
  for (const t of unit.topics) {
    if (!topics[t.id]) {
      if (topics === st.topics) topics = { ...topics };
      topics[t.id] = initTopic(t, levelOf(t), at, day);
    }
  }
  return topics === st.topics ? st : { ...st, topics };
}

const totalMin = (t: PlanTopic) => t.hours * 60;
const remOf = (t: PlanTopic, s: TopicState) => Math.max(0, (1 - s.cov) * totalMin(t));
const reviewMin = (t: PlanTopic) => Math.round(Math.max(15, Math.min(30, totalMin(t) * 0.08)));
const isOpen = (t: PlanTopic, s: TopicState) => remOf(t, s) >= 1;
export const retention = (s: TopicState, day: number) => (s.lastTouch == null ? 0 : Math.exp(-Math.max(0, day - s.lastTouch) / s.S));

export function coverage(unit: ExamUnit, st: UnitState): number {
  const q = unit.topics.reduce((a, t) => a + t.q, 0);
  if (q <= 0) return 0;
  return unit.topics.reduce((a, t) => a + t.q * (st.topics[t.id]?.cov ?? 0), 0) / q;
}

/** Son tur: yeni konu bitip öğrenilenin korunduğu dönem. Sabit değil, tekrar edilecek konu sayısından hesaplanır. */
export function lastRoundDays(unit: ExamUnit, st: UnitState, day: number, cap: CapFn, adherence: number): number {
  let sum = 0;
  for (let i = 0; i < 14; i++) sum += cap(day + i);
  const avg = (sum / 14) * adherence;
  const revAll = unit.topics.reduce((a, t) => a + ((st.topics[t.id]?.cov ?? 0) > 0.3 ? reviewMin(t) : 0), 0);
  return Math.max(LAST_ROUND_MIN, Math.min(LAST_ROUND_MAX, Math.ceil(revAll / Math.max(10, avg))));
}

function capacityUntil(cap: CapFn, from: number, to: number, adherence: number): number {
  let c = 0;
  const end = Math.min(to, from + 800);
  for (let i = from; i < end; i++) c += cap(i) * adherence;
  return c;
}

/** Kalan süreye en çok değer getirenler sığar; kalanlar "şimdilik dışarıda" olur, yer açılırsa geri gelir. */
export function triage(unit: ExamUnit, st: UnitState, available: number): { keep: Set<string>; out: string[] } {
  const open = unit.topics
    .filter(t => st.topics[t.id] && isOpen(t, st.topics[t.id]))
    .map(t => {
      const s = st.topics[t.id];
      return { t, rem: remOf(t, s), val: (t.q * (s.weak ? 1.5 : 1)) / (remOf(t, s) / 60 + 0.5) };
    })
    .sort((a, b) => b.val - a.val || a.t.id.localeCompare(b.t.id));
  let used = 0;
  const keep = new Set<string>();
  const out: string[] = [];
  for (const o of open) {
    // Kısmen sığan değerli konu da alınır: 24 soruluk konunun yarısı, 6 soruluk konunun tamamından değerlidir.
    if (used < available || keep.size === 0) { used += o.rem * 1.25; keep.add(o.t.id); } else out.push(o.t.id);
  }
  return { keep, out };
}

export type FitStatus = 'fits' | 'tight' | 'over';
export interface FitReport { status: FitStatus; out: string[]; needMin: number; availableMin: number; }

/** "Sığıyor mu?" Kişinin gerçek uyumuyla hesaplanır; puan vaadi içermez. */
export function assessFit(unit: ExamUnit, st: UnitState, day: number, cap: CapFn, adherence: number): FitReport {
  const round = lastRoundDays(unit, st, day, cap, adherence);
  const availableMin = capacityUntil(cap, day, Math.max(day, unit.examDay - round), adherence) * 0.85;
  const needMin = unit.topics.reduce((a, t) => a + (st.topics[t.id] ? remOf(t, st.topics[t.id]) : totalMin(t)), 0) * 1.25;
  const { out } = triage(unit, st, availableMin);
  const status: FitStatus = out.length > 0 ? 'over' : needMin > availableMin * 0.8 ? 'tight' : 'fits';
  return { status, out, needMin: Math.round(needMin), availableMin: Math.round(availableMin) };
}

function fillReviews(unit: ExamUnit, st: UnitState, day: number, left: number, out: Block[]): number {
  const pool = unit.topics
    .filter(t => (st.topics[t.id]?.cov ?? 0) > 0.3 && !out.some(b => b.topicId === t.id))
    .sort((a, b) => retention(st.topics[a.id], day) / a.q - retention(st.topics[b.id], day) / b.q || a.id.localeCompare(b.id));
  for (const t of pool) {
    const m = reviewMin(t);
    if (m <= left) { out.push({ type: 'tekrar', unitId: unit.id, topicId: t.id, subject: t.subject, min: m }); left -= m; }
  }
  return left;
}

/** Bir sınavın bir günlük planı. Toplam süre `cap(day)` değerini asla aşmaz. */
export function planDay(unit: ExamUnit, st: UnitState, day: number, cap: CapFn, adherence = 0.75): Block[] {
  const left0 = cap(day);
  const daysLeft = unit.examDay - day;
  if (daysLeft <= 0 || left0 <= 0) return [];
  if (daysLeft === 1) return [{ type: 'hafif', unitId: unit.id, min: Math.min(left0, 30) }];

  const returning = st.returnLeft > 0;
  let left = returning ? Math.max(Math.min(left0, 20), Math.round(left0 * RETURN_LOAD)) : left0;
  const out: Block[] = [];
  const covered = coverage(unit, st);

  // 1 · Deneme: yeterli hazırlık varsa, haftanın en uzun gününde. Tam sınav hiç sığmıyorsa bölüm denemesi.
  const longest = Math.max(...[0, 1, 2, 3, 4, 5, 6].map(i => cap(day + i)));
  const mockLen = longest >= unit.mockMin ? unit.mockMin : Math.min(50, longest);
  const every = daysLeft <= 21 ? 3 : daysLeft <= 60 ? 7 : 14;
  const since = st.lastMock == null ? Infinity : day - st.lastMock;
  if (!returning && daysLeft >= 3 && covered >= MOCK_MIN_COVERAGE && since >= every && mockLen >= 25 && left >= mockLen && (left0 >= longest || since >= every + 6)) {
    out.push({ type: 'deneme', unitId: unit.id, min: mockLen });
    left -= mockLen;
    if (left >= 20) out.push({ type: 'analiz', unitId: unit.id, min: Math.min(left, mockLen >= 100 ? 45 : 25) });
    return out;
  }

  const round = lastRoundDays(unit, st, day, cap, adherence);
  const inLastRound = daysLeft <= round && covered >= FINAL_MIN_COVERAGE;

  // 2 · Denemeden gelen süreli/karma pratik.
  for (const id of st.practice) {
    const t = unit.topics.find(x => x.id === id);
    if (t && left >= 20) { const m = Math.min(25, left); out.push({ type: 'pratik', unitId: unit.id, topicId: t.id, subject: t.subject, min: m }); left -= m; }
  }

  // 3 · Zamanı gelen tekrarlar, bütçeli: kopuş sonrası birikmiş tekrar günü doldurmaz; en değerliler seçilir.
  let reviewBudget = inLastRound ? left : Math.floor(left * (returning ? REVIEW_SHARE_RETURN : REVIEW_SHARE));
  const due = unit.topics
    .filter(t => { const s = st.topics[t.id]; return !!s && s.due != null && s.due <= day && !out.some(b => b.topicId === t.id); })
    .sort((a, b) => retention(st.topics[a.id], day) / a.q - retention(st.topics[b.id], day) / b.q || a.id.localeCompare(b.id));
  for (const t of due) {
    const m = reviewMin(t);
    if (m <= reviewBudget) { out.push({ type: 'tekrar', unitId: unit.id, topicId: t.id, subject: t.subject, min: m }); reviewBudget -= m; left -= m; }
  }

  if (inLastRound) { fillReviews(unit, st, day, left, out); return mergeBlocks(out); }

  // 4 · Yeni konu: önce payının gerisinde kalan ders, sonra o dersin değerli konusu.
  const availableMin = capacityUntil(cap, day, Math.max(day, unit.examDay - round), adherence) * 0.85;
  const { keep } = triage(unit, st, availableMin);
  const plannedMin = (id: string) => out.filter(b => b.topicId === id && b.type === 'yeni').reduce((a, b) => a + b.min, 0);
  const todaySubs = new Set<string>();
  const streakBlocked = (id: string) => {
    for (let k = 1; k < MAX_STREAK; k++) if (!(st.hist[day - k] ?? []).includes(id)) return false;
    // MAX_STREAK-1 gün üst üste geldi: bugün de gelirse sınır dolar; bir önceki gün de varsa aşılır.
    return (st.hist[day - MAX_STREAK] ?? []).includes(id);
  };
  let guard = 0;
  while (left >= 10 && guard++ < 8) {
    const open = unit.topics.filter(t => st.topics[t.id] && remOf(t, st.topics[t.id]) - plannedMin(t.id) >= 1 && !out.some(b => b.topicId === t.id && b.type !== 'yeni'));
    if (!open.length) break;
    const inKeep = open.filter(t => keep.has(t.id));
    let candidates = inKeep.length ? inKeep : open;
    // Üst üste sınırı katıdır: başka açık konu varsa, öncelik dışı olsa bile ona geçilir.
    const unblocked = candidates.filter(t => !streakBlocked(t.id));
    if (unblocked.length) candidates = unblocked;
    else {
      const other = open.filter(t => !streakBlocked(t.id));
      if (other.length) candidates = other;
      else if (out.some(b => b.type === 'yeni')) break; // Yalnız sınırı dolan konu kaldı: gün tekrarla tamamlanır.
    }

    const share: Record<string, number> = {};
    for (const t of candidates) share[t.subject] = (share[t.subject] ?? 0) + t.q;
    const deficit = (sub: string) => (((st.subMin[sub] ?? 0) + 1) / (share[sub] * (st.boost[sub] ?? 1))) * (todaySubs.has(sub) ? 3 : 1);
    const score = (t: PlanTopic) => {
      const s = st.topics[t.id];
      const inProgress = s.cov > 0 && isOpen(t, s) ? 1.6 : 1;
      const again = plannedMin(t.id) > 0 ? 0.2 : 1;
      const yesterday = s.lastTouch === day - 1 ? 0.3 : s.lastTouch === day - 2 ? 0.6 : 1;
      return ((t.q * (s.weak ? 1.5 : 1)) / t.hours) * inProgress * again * yesterday / deficit(t.subject);
    };
    const t = [...candidates].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
    const m = Math.min(left, BLOCK_MAX, Math.ceil(remOf(t, st.topics[t.id]) - plannedMin(t.id)));
    if (m <= 0) break;
    out.push({ type: 'yeni', unitId: unit.id, topicId: t.id, subject: t.subject, min: m });
    todaySubs.add(t.subject);
    left -= m;
  }

  // 5 · Kalan süre boşa gitmez: tekrar öne çekilir.
  if (left >= 15) fillReviews(unit, st, day, left, out);
  return mergeBlocks(out);
}

/** Aynı konunun ardışık yeni blokları tek görevde toplanır. */
function mergeBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const same = b.type === 'yeni' ? out.find(x => x.type === 'yeni' && x.topicId === b.topicId) : null;
    if (same) same.min += b.min; else out.push({ ...b });
  }
  return out;
}

/** Tamamlanan bloğu duruma yazar. Yalnız gerçekten yapılan işler buradan geçer. */
export function applyBlock(unit: ExamUnit, st: UnitState, b: Block, day: number, at: number): UnitState {
  const next: UnitState = { ...st, topics: { ...st.topics }, subMin: { ...st.subMin }, hist: { ...st.hist } };
  if (b.type === 'deneme') {
    next.lastMock = day;
    for (const t of unit.topics) {
      const s = next.topics[t.id];
      if (s && s.cov > 0.3) next.topics[t.id] = { ...s, S: Math.min(180, s.S * 1.1), at };
    }
    return next;
  }
  if (!b.topicId) return next;
  const t = unit.topics.find(x => x.id === b.topicId);
  const s = next.topics[b.topicId];
  if (!t || !s) return next;
  if (b.type === 'yeni') {
    const cov = Math.min(1, s.cov + b.min / totalMin(t));
    next.subMin[t.subject] = (next.subMin[t.subject] ?? 0) + b.min;
    next.hist[day] = [...(next.hist[day] ?? []), t.id];
    for (const k of Object.keys(next.hist)) if (Number(k) < day - MAX_STREAK - 1) delete next.hist[Number(k)];
    next.topics[t.id] = { ...s, cov, lastTouch: day, at, ...(cov >= 0.999 && s.due == null ? { due: day + REVIEW_STEPS[0], step: 0 } : null) };
    return next;
  }
  if (b.type === 'pratik') next.practice = next.practice.filter(id => id !== t.id);
  const gap = s.lastTouch == null ? 0 : day - s.lastTouch;
  const grow = gap >= s.S * 0.4 ? 2.2 : gap >= s.S * 0.2 ? 1.5 : 1;
  const step = s.step + 1;
  next.topics[t.id] = { ...s, S: Math.min(180, s.S * grow), lastTouch: day, step, due: step < REVIEW_STEPS.length ? day + REVIEW_STEPS[step] : null, at };
  return next;
}

/** Kullanıcı "bitti" dedi: kalan süre kapanır ve tekrar zinciri başlar. Zorluk, ilk tekrarın ne kadar erken geleceğini belirler. */
export function markTopicDone(st: UnitState, topicId: string, rating: 'kolay' | 'orta' | 'zor', day: number, at: number): UnitState {
  const s = st.topics[topicId];
  if (!s) return st;
  const mult = rating === 'kolay' ? 1.3 : rating === 'zor' ? 0.75 : 1;
  const gap = rating === 'kolay' ? REVIEW_STEPS[1] : rating === 'zor' ? 1 : REVIEW_STEPS[0];
  return { ...st, topics: { ...st.topics, [topicId]: { ...s, cov: 1, S: Math.min(180, s.S * mult), lastTouch: day, step: rating === 'kolay' ? 1 : 0, due: day + gap, weak: rating === 'zor', rated: true, at } } };
}

/** "Biraz daha lazım": tahmini süre bitti ama konu bitmedi. Kapsam geri çekilir, tekrar zinciri beklemeye alınır. */
export function extendTopic(st: UnitState, topicId: string, at: number): UnitState {
  const s = st.topics[topicId];
  if (!s) return st;
  return { ...st, topics: { ...st.topics, [topicId]: { ...s, cov: Math.max(0, Math.min(s.cov, 1) - 0.2), due: null, step: 0, rated: false, at } } };
}

export function reopenTopic(st: UnitState, topicId: string, at: number): UnitState {
  const s = st.topics[topicId];
  if (!s) return st;
  return { ...st, topics: { ...st.topics, [topicId]: { ...s, cov: 0, due: null, step: 0, lastTouch: null, rated: false, at } } };
}

/**
 * Birden çok sınav aynı süreyi paylaşır. Pay, kalan işin kalan güne oranına (baskı) göre: simülasyonda yakın sınav için eşit
 * bölmeden belirgin iyi. Uzak sınav sıfırlanmaz: canlı her sınava alt sınır.
 */
export function splitShares(units: ExamUnit[], states: Record<string, UnitState>, day: number): Record<string, number> {
  const live = units.filter(u => u.examDay > day);
  const shares: Record<string, number> = {};
  for (const u of units) shares[u.id] = 0;
  if (!live.length) return shares;
  if (live.length === 1) { shares[live[0].id] = 1; return shares; }
  const pressure = live.map(u => {
    const st = states[u.id];
    const need = u.topics.reduce((a, t) => a + (st?.topics[t.id] ? remOf(t, st.topics[t.id]) : totalMin(t)), 0) * 1.25 + 300;
    return need / Math.max(1, u.examDay - day);
  });
  const total = pressure.reduce((a, b) => a + b, 0);
  const floor = Math.min(0.2, 0.6 / live.length);
  const raw = pressure.map(p => Math.max(floor, p / total));
  const sum = raw.reduce((a, b) => a + b, 0);
  live.forEach((u, i) => { shares[u.id] = raw[i] / sum; });
  return shares;
}

const shareCap = (cap: CapFn, share: number): CapFn => d => Math.floor(cap(d) * share);

/** Tüm sınavların bir günü. Toplam, günlük süreyi aşmaz (paylar aşağı yuvarlanır). */
export function planAll(units: ExamUnit[], states: Record<string, UnitState>, day: number, cap: CapFn, adherence = 0.75): Block[] {
  const shares = splitShares(units, states, day);
  const out: Block[] = [];
  for (const u of units) {
    if (shares[u.id] <= 0) continue;
    out.push(...planDay(u, states[u.id], day, shareCap(cap, shares[u.id]), adherence));
  }
  return out;
}

export interface Projection {
  days: Record<number, Block[]>;
  /** Son turun başladığı gün (sınav başına). */
  lastRoundStart: Record<string, number>;
  /** Tüm konuların bitmesi öngörülen gün; null: sınava kadar bitmiyor. */
  finishDay: Record<string, number | null>;
}

/**
 * Takvim için geleceği çizer: her blok yapılmış varsayılır (uyum yalnız sığma hesabında girer). `fixed` günler değişmez.
 * Saf: girdi durumu değişmez.
 */
export function project(units: ExamUnit[], states: Record<string, UnitState>, from: number, cap: CapFn, fixed: Record<number, Block[]> = {}, adherence = 0.75): Projection {
  let cur = { ...states };
  const end = Math.max(from, ...units.map(u => u.examDay));
  const days: Record<number, Block[]> = {};
  const lastRoundStart: Record<string, number> = {};
  const finishDay: Record<string, number | null> = {};
  for (const u of units) finishDay[u.id] = null;
  for (let d = from; d <= end && d < from + 800; d++) {
    const blocks = fixed[d] ?? planAll(units, cur, d, cap, adherence);
    days[d] = blocks;
    for (const u of units) {
      if (lastRoundStart[u.id] == null && u.examDay > d && d >= u.examDay - lastRoundDays(u, cur[u.id], d, shareCap(cap, splitShares(units, cur, d)[u.id] || 1), adherence)) lastRoundStart[u.id] = d;
    }
    const next = { ...cur };
    for (const b of blocks) {
      const u = units.find(x => x.id === b.unitId);
      if (u) next[u.id] = applyBlock(u, next[u.id], b, d, 0);
    }
    for (const u of units) if (next[u.id]?.returnLeft > 0 && blocks.some(b => b.unitId === u.id)) next[u.id] = { ...next[u.id], returnLeft: next[u.id].returnLeft - 1 };
    cur = next;
    for (const u of units) if (finishDay[u.id] == null && coverage(u, cur[u.id]) >= 0.999) finishDay[u.id] = d;
  }
  return { days, lastRoundStart, finishDay };
}
