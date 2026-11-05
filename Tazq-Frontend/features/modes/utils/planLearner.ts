import { affinityKey, type AffinityItem, type PlanAffinity } from './planAffinity';

/*
  KULLANICIYI TANIYAN KATMAN (2026-11-05, kullanıcı: "ML modeli gibi düşün, modlar kullanıcıyı her geçen gün tanımalı"). Cihazda, bulutta yedeklenen, ağır model gerektirmeyen çevrimiçi
  öğrenme: her gün yeni gözlemle güncellenir, eski gözlemler üstel olarak unutulur (günde %2); insanın düzeni değişince plan da değişir.
  Üç soru: hangi görevi yapıyor (planAffinity), hangi gün gücü düşük, günün hangi diliminde bitiriyor. Plan yalnız HAFİFLER, asla yük bindirmez (adaptiveTaskCount ilkesi).
  Az veriyle konuşmaz: eşik dolmadan kullanıcıya "seni tanıdım" denmez, plan da değişmez.
*/
export interface Rhythm {
  /** Haftanın günü başına ağırlıklı gösterilen ve yapılan iş. 0 = pazar. */
  shown: number[];
  done: number[];
  /** Sabah, öğle, akşam, gece: biten iş ağırlığı. */
  bands: number[];
  /** Son güncellenen gün numarası. */
  at: number;
}

export const emptyRhythm = (): Rhythm => ({ shown: [0, 0, 0, 0, 0, 0, 0], done: [0, 0, 0, 0, 0, 0, 0], bands: [0, 0, 0, 0], at: 0 });

const FORGET = 0.98;
const MIN_DAY_SAMPLES = 4;
const LOW_RATE = 0.35;
const LOW_VS_OVERALL = 0.6;
const MIN_BAND_SAMPLES = 5;
const BAND_SHARE = 0.5;
const MIN_AREA_SAMPLES = 3;

function aged(r: Rhythm, day: number): Rhythm {
  const f = r.at > 0 && day > r.at ? FORGET ** (day - r.at) : 1;
  if (f === 1) return { ...r, at: Math.max(r.at, day) };
  return { shown: r.shown.map(x => x * f), done: r.done.map(x => x * f), bands: r.bands.map(x => x * f), at: day };
}

export function withShownDay(r: Rhythm, weekday: number, count: number, day: number): Rhythm {
  const a = aged(r, day);
  return { ...a, shown: a.shown.map((x, i) => (i === weekday ? x + count : x)) };
}

export const bandOf = (hour: number): number => (hour >= 5 && hour < 12 ? 0 : hour < 5 ? 3 : hour < 17 ? 1 : hour < 22 ? 2 : 3);

/** delta -1: geri alındı. Sayılar eksiye düşmez. */
export function withDoneAt(r: Rhythm, weekday: number, hour: number, delta: number, day: number): Rhythm {
  const a = aged(r, day);
  const b = bandOf(hour);
  return {
    ...a,
    done: a.done.map((x, i) => (i === weekday ? Math.max(0, x + delta) : x)),
    bands: a.bands.map((x, i) => (i === b ? Math.max(0, x + delta) : x)),
  };
}

/** Bu gün bu kullanıcı için zayıf mı: hem düşük hem kendi ortalamasının belirgin altında. Herkes için düşük olan hafta, tek güne ceza değildir. */
export function isLightDay(r: Rhythm | undefined, weekday: number): boolean {
  if (!r || r.shown[weekday] < MIN_DAY_SAMPLES) return false;
  const rate = r.done[weekday] / r.shown[weekday];
  const shown = r.shown.reduce((a, b) => a + b, 0);
  const overall = shown > 0 ? r.done.reduce((a, b) => a + b, 0) / shown : 0;
  return rate < LOW_RATE && rate < overall * LOW_VS_OVERALL;
}

/** En çok bitirdiği dilim; belirgin değilse null. */
export function topBand(r: Rhythm | undefined): number | null {
  if (!r) return null;
  const total = r.bands.reduce((a, b) => a + b, 0);
  if (total < MIN_BAND_SAMPLES) return null;
  const best = r.bands.indexOf(Math.max(...r.bands));
  return r.bands[best] / total >= BAND_SHARE ? best : null;
}

/** Yaptığı ve kaçındığı alan. Yeterli işaret yoksa null. */
export function areaLeanings(pool: AffinityItem[], affinity: PlanAffinity | undefined, name: string): { favorite: string | null; avoided: string | null } {
  const totals = new Map<string, { d: number; n: number }>();
  const seen = new Set<string>();
  for (const p of pool) {
    if (!p.area || seen.has(p.tr)) continue;
    seen.add(p.tr);
    const e = affinity?.[affinityKey(p.tr.replace('{name}', name))];
    if (!e) continue;
    const t = totals.get(p.area) ?? { d: 0, n: 0 };
    totals.set(p.area, { d: t.d + e.d, n: t.n + e.n });
  }
  let favorite: string | null = null;
  let avoided: string | null = null;
  let bestD = 0;
  let bestN = 0;
  for (const [area, t] of totals) {
    if (t.d >= MIN_AREA_SAMPLES && t.d > t.n && t.d > bestD) { favorite = area; bestD = t.d; }
    if (t.n >= MIN_AREA_SAMPLES && t.n > t.d && t.n > bestN) { avoided = area; bestN = t.n; }
  }
  return { favorite, avoided };
}

export const hasRhythmInsight = (r: Rhythm | undefined) => !!r && (topBand(r) != null || [0, 1, 2, 3, 4, 5, 6].some(d => isLightDay(r, d)));

export function mergeRhythm(a: Rhythm | undefined, b: Rhythm | undefined): Rhythm {
  if (!a) return b ?? emptyRhythm();
  if (!b) return a;
  return b.at > a.at ? b : a;
}
