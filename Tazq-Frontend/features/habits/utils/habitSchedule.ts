/**
 * ALIŞKANLIK PLANI — sıklık, miktar, zaman dilimi, otomatik kaynak (2026-10-30).
 *
 * Kullanıcı: "alışkanlıkları gün gün işaretlemek zor iş olabilir, motive etmeyebilir, angarya
 * gibi gelebilir". Ölçülen durum: her alışkanlık zorunlu "her gün + yaptım/yapmadım"; kaçırılan
 * her gün başarısızlık gibi duruyordu, kayıtlıların yalnız %10'u alışkanlık kullanıyordu.
 *
 * Kararlar (davranış bilimi):
 *  · ESNEK SIKLIK — "haftada 3" ya da "Pzt-Çar-Cum". Planlanmayan gün başarısızlık değildir.
 *  · MİKTAR — "8 bardak su": her dokunuş bir adım; hedefe ulaşınca gün YAPILDI sayılır.
 *  · ZAMAN DİLİMİ — sabah/öğle/akşam: ana sayfada o an ilgili olan öne gelir (uygulama niyeti).
 *  · OTOMATİK — odak/nefes seansı bitince bağlı alışkanlık kendiliğinden dolar.
 *  · TUTARLILIK + "İKİ KEZ KAÇIRMA" — kırılgan seri yerine son 30 günün tutarlılığı; tek kaçırma
 *    affedilir ("yarın yaparsan sürer"), iki ardışık kaçırma zinciri koparır (Lally 2010: tek
 *    kaçırma alışkanlık oluşumunu ölçülebilir biçimde bozmaz).
 *  · KİLOMETRE TAŞI — TOPLAM tekrar 7 / 21 / 66 (66 ≈ otomatikleşme medyanı). Toplam asla düşmez:
 *    kaybedilebilir bir sayı yerine biriken bir sayı.
 *
 * "Yapıldı"nın tek kaynağı yine `completedDates` — seri, rapor, eşitleme, analiz değişmeden çalışır.
 * Yeni alanların hepsi isteğe bağlı: eski alışkanlık = her gün, miktar 1, dilim yok.
 */

export type HabitSchedule = { kind: 'daily' } | { kind: 'weekly'; times: number } | { kind: 'days'; days: number[] }; // days: 0 = Pazartesi
export type HabitSlot = 'morning' | 'midday' | 'evening';
export type HabitAutoSource = 'focus' | 'breath';

export interface PlanFields {
  schedule?: HabitSchedule;
  /** Günlük miktar hedefi (>1 → miktarlı alışkanlık). */
  target?: number;
  unit?: string;
  /** 'YYYY-MM-DD' → o günkü adım sayısı (yalnız miktarlı). */
  counts?: Record<string, number>;
  slot?: HabitSlot;
  autoFrom?: HabitAutoSource;
}

export interface HabitLike extends PlanFields {
  completedDates?: string[];
  skippedDates?: string[];
  createdAt?: string;
  pausedAt?: string | null;
}

export const MILESTONES = [7, 21, 66] as const;

const at = (key: string) => new Date(`${key}T12:00:00`);
export const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (key: string, n: number) => { const d = at(key); d.setDate(d.getDate() + n); return keyOf(d); };
/** 0 = Pazartesi … 6 = Pazar */
export const weekdayOf = (key: string) => (at(key).getDay() + 6) % 7;
/** Haftanın pazartesisi. */
export const weekStartOf = (key: string) => addDays(key, -weekdayOf(key));

export const scheduleOf = (h: PlanFields): HabitSchedule => h.schedule ?? { kind: 'daily' };
export const targetOf = (h: PlanFields) => Math.max(1, Math.round(h.target ?? 1));
export const isQuantity = (h: PlanFields) => targetOf(h) > 1;

const doneSet = (h: HabitLike) => new Set(h.completedDates ?? []);
const skipSet = (h: HabitLike) => new Set(h.skippedDates ?? []);

/** O gün planlı mı (haftalık sıklıkta her gün aday). */
export function isPlannedDay(h: HabitLike, key: string): boolean {
  const s = scheduleOf(h);
  return s.kind === 'days' ? s.days.includes(weekdayOf(key)) : true;
}

export function countOn(h: HabitLike, key: string): number {
  if (!isQuantity(h)) return doneSet(h).has(key) ? 1 : 0;
  const c = h.counts?.[key] ?? 0;
  return doneSet(h).has(key) ? Math.max(c, targetOf(h)) : c;
}

/** Bu hafta (pazartesiden bugüne) kaç kez yapıldı. */
export function doneThisWeek(h: HabitLike, today: string): number {
  const done = doneSet(h);
  let n = 0;
  for (let k = weekStartOf(today); k <= today; k = addDays(k, 1)) if (done.has(k)) n++;
  return n;
}

/**
 * BUGÜN listede mi? Dinlenen hayır. Gün planı: o gün planlıysa. Haftada N: hedef dolmadıysa
 * (bugün yapıldıysa da görünür ki geri alınabilsin).
 */
export function isDueToday(h: HabitLike, today: string): boolean {
  if (h.pausedAt) return false;
  const s = scheduleOf(h);
  if (s.kind === 'weekly') return doneSet(h).has(today) || doneThisWeek(h, today) < s.times;
  return isPlannedDay(h, today);
}

/** Haftalık ilerleme (yalnız esnek sıklıkta anlamlı): "2/3 bu hafta". */
export function weekProgress(h: HabitLike, today: string): { done: number; goal: number } | null {
  const s = scheduleOf(h);
  if (s.kind === 'weekly') return { done: doneThisWeek(h, today), goal: s.times };
  if (s.kind === 'days') {
    const done = doneSet(h);
    let d = 0;
    for (let k = weekStartOf(today), i = 0; i < 7; k = addDays(k, 1), i++) if (s.days.includes(i) && done.has(k)) d++;
    return { done: d, goal: s.days.length };
  }
  return null;
}

/**
 * Son `window` günün TUTARLILIĞI (0..100). Payda yalnız planlı ve mazeretsiz günler:
 *  · bugün henüz yapılmadıysa sayılmaz (gün bitmedi),
 *  · mola günleri ve oluşturulmadan önceki günler sayılmaz,
 *  · haftada N: geçmiş her hafta N beklenir; içinde bulunulan hafta yalnız yapılanı sayar.
 * Hiç beklenen gün yoksa null (yeni alışkanlık — "henüz erken").
 */
export function consistency(h: HabitLike, today: string, window = 30): number | null {
  const s = scheduleOf(h);
  const done = doneSet(h);
  const skipped = skipSet(h);
  const born = h.createdAt ? keyOf(new Date(h.createdAt)) : addDays(today, -(window - 1));
  const from = [addDays(today, -(window - 1)), born].sort()[1];
  if (s.kind === 'weekly') {
    let expected = 0, got = 0;
    for (let w = weekStartOf(from); w <= today; w = addDays(w, 7)) {
      let n = 0, free = 0;
      for (let i = 0; i < 7; i++) {
        const k = addDays(w, i);
        if (k < from || k > today) continue;
        if (done.has(k)) n++; else if (!skipped.has(k)) free++;
      }
      const current = w === weekStartOf(today);
      const goal = current ? Math.min(s.times, n) : Math.min(s.times, n + free);
      expected += goal; got += Math.min(n, goal);
    }
    return expected > 0 ? Math.round((got / expected) * 100) : null;
  }
  let expected = 0, got = 0;
  for (let k = from; k <= today; k = addDays(k, 1)) {
    if (!isPlannedDay(h, k) || skipped.has(k)) continue;
    if (k === today && !done.has(k)) continue;
    expected++;
    if (done.has(k)) got++;
  }
  return expected > 0 ? Math.round((got / expected) * 100) : null;
}

/**
 * "İKİ KEZ KAÇIRMA" durumu — son iki planlı günün (bugün hariç; haftalıkta son iki hafta) kaydı.
 *  'ok'     — son planlı gün yapıldı/mola ya da henüz geçmiş yok
 *  'missed' — son planlı gün kaçtı: bugün yaparsan zincir sürer (nazik uyarı)
 *  'broken' — art arda iki planlı gün kaçtı
 */
export function missState(h: HabitLike, today: string): 'ok' | 'missed' | 'broken' {
  const s = scheduleOf(h);
  const done = doneSet(h);
  const skipped = skipSet(h);
  const born = h.createdAt ? keyOf(new Date(h.createdAt)) : '0000-00-00';
  if (s.kind === 'weekly') {
    const miss = (w: string) => {
      if (addDays(w, 6) < born) return false;
      let n = 0, rest = 0;
      for (let i = 0; i < 7; i++) { const k = addDays(w, i); if (done.has(k)) n++; else if (skipped.has(k)) rest++; }
      return n < Math.min(s.times, 7 - rest);
    };
    const last = addDays(weekStartOf(today), -7);
    if (!miss(last)) return 'ok';
    return miss(addDays(last, -7)) ? 'broken' : 'missed';
  }
  const prior: string[] = [];
  for (let k = addDays(today, -1), i = 0; prior.length < 2 && i < 60 && k >= born; k = addDays(k, -1), i++) {
    if (isPlannedDay(h, k) && !skipped.has(k)) prior.push(k);
  }
  if (prior.length === 0 || done.has(prior[0])) return 'ok';
  return prior[1] && !done.has(prior[1]) ? 'broken' : 'missed';
}

/** Toplam tekrar (asla düşmez) ve sıradaki kilometre taşı. */
export function milestone(h: HabitLike): { total: number; next: number | null; reached: number | null } {
  const total = (h.completedDates ?? []).length;
  const reached = [...MILESTONES].reverse().find(m => total >= m) ?? null;
  const next = MILESTONES.find(m => total < m) ?? null;
  return { total, next, reached };
}

/** Şu anki zaman dilimi (yerel saat). */
export function currentSlot(now: Date = new Date()): HabitSlot {
  const h = now.getHours();
  return h < 12 ? 'morning' : h < 17 ? 'midday' : 'evening';
}

const SLOT_ORDER: Record<HabitSlot, number> = { morning: 0, midday: 1, evening: 2 };

/**
 * Bugünün sırası: bekleyenler önce; bekleyenler içinde ŞU ANKİ dilim, sonra sıradakiler, sonra
 * geçmiş dilimler; dilimsizler en sona. Yapılanlar/molalar en sonda (yerleri değişmesin diye
 * kendi aralarında eski sırayı korur).
 */
export function orderForNow<T extends HabitLike>(habits: T[], today: string, now: Date = new Date()): T[] {
  const cur = SLOT_ORDER[currentSlot(now)];
  const rank = (h: T) => {
    const settled = (h.completedDates ?? []).includes(today) || (h.skippedDates ?? []).includes(today);
    if (settled) return 100;
    if (!h.slot) return 10;
    const d = SLOT_ORDER[h.slot] - cur;
    return d >= 0 ? d : 5 - d; // geçmiş dilim: ama hâlâ yapılabilir
  };
  return habits.map((h, i) => ({ h, i, r: rank(h) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.h);
}

/**
 * Miktarlı alışkanlıkta bir dokunuş: hedefe kadar +1; hedefteyken dokunuş sıfırlar (geri alma).
 * Dönen `done`: yeni durumda gün yapıldı mı.
 */
export function bump(h: HabitLike, key: string): { counts: Record<string, number>; done: boolean } {
  const target = targetOf(h);
  const now = countOn(h, key);
  const next = now >= target ? 0 : now + 1;
  const counts = { ...(h.counts ?? {}) };
  if (next === 0) delete counts[key]; else counts[key] = next;
  return { counts, done: next >= target };
}

/** Gün sonunda bekleyen (planlı, yapılmamış, mola değil) alışkanlıklar. */
export function pendingOn<T extends HabitLike>(habits: T[], key: string): T[] {
  return habits.filter(h => isDueToday(h, key) && !(h.completedDates ?? []).includes(key) && !(h.skippedDates ?? []).includes(key));
}
