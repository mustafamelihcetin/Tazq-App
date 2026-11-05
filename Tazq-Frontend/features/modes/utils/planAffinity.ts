/*
  GÖREVLERİ KİŞİYE GÖRE ÖĞRENME (2026-11-05, kullanıcı: "en önemlisi bu"). LLM yok, ağ yok, saf hesap: Thompson örneklemesi (Chapelle & Li, 2011).
  Her görevin bir "yapılma" ve bir "istenmeme" sayısı var; her gün bu sayılardan bir tahmin çekilir, en yükseği gelir. Az denenen görevin
  belirsizliği büyük olduğu için ara ara yine çıkar: plan tek tipe kilitlenmez. Görevin kendi verisi azsa aynı alanın (beslenme, kardiyo) ortalaması
  başlangıç sayılır, böylece beslenme görevlerini yapan biri hiç görmediği beslenme görevini de önde görür.
  Tohum görev + gün: aynı gün aynı sonuç, ekran her açılışta değişmez. Hiç sinyal yoksa motor eski sırasıyla çalışır.
*/
export interface AffinityEntry {
  /** Yapılma sayısı. */
  d: number;
  /** İstenmeme ağırlığı. */
  n: number;
  /** En son gösterildiği gün. */
  s?: number;
}
export type PlanAffinity = Record<string, AffinityEntry>;
export interface AffinityItem { tr: string; en: string; area?: string }
export interface PickOptions { affinity: PlanAffinity; day: number; name: string; weakAreaIds?: string[] | null }

/** "Başka görev" net bir hayır; "bugün olmaz" yarım; hiç dokunmadan geçmek zayıf işaret: o gün vakti olmamış olabilir. */
export const NEGATIVE = { swap: 1, notToday: 0.5, ignored: 0.25 } as const;

const PRIOR = 2;
const WEAK_BONUS = 0.1;
// Uzun pencere öğrenmeyi boğuyordu: 14 günde beslenme seven kullanıcının beslenme payı %46'da kalıyordu (simülasyon, __tests__/planAffinity).
const REPEAT_WINDOW = 3;
const UINT32 = 4294967296;

export function affinityKey(tr: string): string {
  let h = 5381;
  for (let i = 0; i < tr.length; i++) h = ((h * 33) ^ tr.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export const hasSignal = (a?: PlanAffinity | null): boolean => !!a && Object.values(a).some(e => e.d > 0 || e.n > 0);

const entry = (a: PlanAffinity, key: string): AffinityEntry => a[key] ?? { d: 0, n: 0 };

export const withDone = (a: PlanAffinity, key: string, delta: number): PlanAffinity => {
  const e = entry(a, key);
  return { ...a, [key]: { ...e, d: Math.max(0, e.d + delta) } };
};

export const withNegative = (a: PlanAffinity, key: string, weight: number): PlanAffinity => {
  const e = entry(a, key);
  return { ...a, [key]: { ...e, n: e.n + weight } };
};

export const withShown = (a: PlanAffinity, keys: string[], day: number): PlanAffinity => {
  const out = { ...a };
  for (const k of keys) out[k] = { ...entry(a, k), s: day };
  return out;
};

/** Cihazlar arası birleşme: sayılar yalnız artar, yüksek olan kazanır. */
export function mergeAffinity(a: PlanAffinity, b: PlanAffinity | null | undefined): PlanAffinity {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    const e = entry(a, k);
    const s = Math.max(e.s ?? -1, v?.s ?? -1);
    out[k] = { d: Math.max(e.d, v?.d ?? 0), n: Math.max(e.n, v?.n ?? 0), ...(s >= 0 ? { s } : null) };
  }
  return out;
}

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / UINT32;
}

/** Yaklaşık standart normal: dört düzgün sayının toplamı. */
function normalOf(seed: string): number {
  const sum = seeded(`${seed}|1`) + seeded(`${seed}|2`) + seeded(`${seed}|3`) + seeded(`${seed}|4`);
  return (sum - 2) * Math.sqrt(3);
}

/**
 * Görevleri bugünkü tahmine göre sıralar. Son günlerde gösterilenler sona gider: en sevilen görev bile her gün gelmez.
 * Tekrar penceresi havuza göre daralır, küçük havuz tıkanmaz.
 */
export function pickByAffinity<T extends AffinityItem>(pool: T[], count: number, o: PickOptions): T[] {
  const seen = new Set<string>();
  const items = pool.filter(p => (seen.has(p.tr) ? false : (seen.add(p.tr), true)));
  const keyOf = (p: T) => affinityKey(p.tr.replace('{name}', o.name));
  const areaTotals = new Map<string, { d: number; n: number }>();
  for (const p of items) {
    if (!p.area) continue;
    const e = entry(o.affinity, keyOf(p));
    const t = areaTotals.get(p.area) ?? { d: 0, n: 0 };
    areaTotals.set(p.area, { d: t.d + e.d, n: t.n + e.n });
  }
  const weak = new Set(o.weakAreaIds ?? []);
  const scored = items.map(p => {
    const key = keyOf(p);
    const e = entry(o.affinity, key);
    const area = p.area ? areaTotals.get(p.area) : undefined;
    const rate = area ? (1 + area.d) / (2 + area.d + area.n) : 0.5;
    const alpha = PRIOR * rate + e.d;
    const beta = PRIOR * (1 - rate) + e.n;
    const n = alpha + beta;
    const score = alpha / n + normalOf(`${key}|${o.day}`) * Math.sqrt((alpha * beta) / (n * n * (n + 1))) + (p.area && weak.has(p.area) ? WEAK_BONUS : 0);
    return { p, key, score, shown: e.s };
  }).sort((a, b) => b.score - a.score);
  const window = Math.max(0, Math.min(REPEAT_WINDOW, Math.floor(items.length / Math.max(1, count)) - 1));
  const recent = (s?: number) => s != null && o.day - s >= 1 && o.day - s <= window;
  return [...scored.filter(x => !recent(x.shown)), ...scored.filter(x => recent(x.shown))].slice(0, count).map(x => x.p);
}
