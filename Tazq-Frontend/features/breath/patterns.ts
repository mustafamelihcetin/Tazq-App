/**
 * NEFES SEANSI RİTİM MOTORU (madde 14) — saf, worklet uyumlu.
 *
 * Nefes eskiden odak sayacının üstünde bir AYARDI ("NEFES AL" yazısı çalışırken
 * yanıp sönüyordu). Çalışırken nefes saymak dikkati böler; kullanıcı kararıyla
 * (2026-10-30) ayrı bir seans oldu. Dört amaç, her biri yayımlanmış bir tekniğe dayanır:
 *
 *  · SAKİNLEŞ — döngüsel iç çekiş: burundan iki aşamalı alış, ağızdan uzun veriş.
 *    Balban ve ark. 2023 (Cell Reports Medicine, Stanford): günde 5 dk, ruh hâlini
 *    farkındalık meditasyonundan daha çok iyileştirdi ve solunum hızını düşürdü.
 *  · ODAKLAN — kutu nefesi 4-4-4-4: eşit dört faz; ritmi saymak dağılan dikkati
 *    toplar. Baskı altındaki ekiplerin (pilot, ilk müdahale) kullandığı düzen.
 *  · UYU — 4-7-8 (Weil): uzun tutuş ve daha uzun veriş, parasempatik frene basar.
 *    Kısa başlanır; tekniğin önerisi ilk günlerde 4 döngüyü geçmemek.
 *  · DENGE — rezonans nefesi ~5.5 nefes/dk: kalp ritmi değişkenliğinin en yüksek
 *    olduğu hız (Lehrer & Gevirtz 2014).
 *
 * Tek saat: seans `t` saniyesiyle ilerler; faz, yazı, titreşim ve küre hep
 * `phaseAt(t)`tan okunur — ayrı zamanlayıcılar birbirinden kaymaz.
 */

export type BreathId = 'sigh' | 'box' | 'sleep' | 'resonance';
/** in: alış · top: ikinci kısa alış · hold: dolu bekle · out: veriş · rest: boş bekle */
export type PhaseKind = 'in' | 'top' | 'hold' | 'out' | 'rest';

export interface BreathPhase { kind: PhaseKind; sec: number; /** fazın sonunda akciğer doluluğu 0..1 */ to: number }

export interface BreathPattern {
  id: BreathId;
  phases: BreathPhase[];
  /** Önerilen süre (dk) — seçici bununla açılır. */
  minutes: 1 | 3 | 5;
  /** Kürenin yaprak sayısı: kutuda 4 (kare), diğerlerinde ritme uygun. */
  petals: number;
}

export const BREATH_PATTERNS: BreathPattern[] = [
  { id: 'sigh', minutes: 5, petals: 6, phases: [{ kind: 'in', sec: 2, to: 0.78 }, { kind: 'top', sec: 1, to: 1 }, { kind: 'out', sec: 6, to: 0 }] },
  { id: 'box', minutes: 3, petals: 4, phases: [{ kind: 'in', sec: 4, to: 1 }, { kind: 'hold', sec: 4, to: 1 }, { kind: 'out', sec: 4, to: 0 }, { kind: 'rest', sec: 4, to: 0 }] },
  { id: 'sleep', minutes: 1, petals: 8, phases: [{ kind: 'in', sec: 4, to: 1 }, { kind: 'hold', sec: 7, to: 1 }, { kind: 'out', sec: 8, to: 0 }] },
  { id: 'resonance', minutes: 5, petals: 6, phases: [{ kind: 'in', sec: 5.5, to: 1 }, { kind: 'out', sec: 5.5, to: 0 }] },
];

export const patternOf = (id: string | null | undefined): BreathPattern =>
  BREATH_PATTERNS.find(p => p.id === id) ?? BREATH_PATTERNS[0];

export function cycleSec(p: BreathPattern): number {
  'worklet';
  let s = 0;
  for (let i = 0; i < p.phases.length; i++) s += p.phases[i].sec;
  return s;
}

/** Seçilen dakikaya en yakın TAM döngü sayısı (en az 1) — seans hep verişin sonunda biter. */
export function cyclesFor(p: BreathPattern, minutes: number): number {
  return Math.max(1, Math.round((minutes * 60) / cycleSec(p)));
}

export const totalSec = (p: BreathPattern, minutes: number) => cyclesFor(p, minutes) * cycleSec(p);

export interface PhaseState {
  cycle: number;
  index: number;
  kind: PhaseKind;
  /** fazın kalan tam saniyesi (sayaç için, yukarı yuvarlanmış) */
  left: number;
  /** 0..1 akciğer doluluğu — yumuşatılmış, küre bunu çizer */
  level: number;
  done: boolean;
}

/** Yumuşak giriş-çıkış: nefes doğrusal değil, başta ve sonda yavaşlar. */
function ease(x: number): number {
  'worklet';
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function phaseAt(p: BreathPattern, t: number, cycles: number): PhaseState {
  'worklet';
  const cyc = cycleSec(p);
  const end = cyc * cycles;
  if (t >= end) return { cycle: cycles - 1, index: p.phases.length - 1, kind: p.phases[p.phases.length - 1].kind, left: 0, level: p.phases[p.phases.length - 1].to, done: true };
  const tt = Math.max(0, t);
  const cycle = Math.floor(tt / cyc);
  let local = tt - cycle * cyc;
  let from = p.phases[p.phases.length - 1].to;
  for (let i = 0; i < p.phases.length; i++) {
    const ph = p.phases[i];
    if (local < ph.sec) {
      const k = ease(local / ph.sec);
      return { cycle, index: i, kind: ph.kind, left: Math.ceil(ph.sec - local - 1e-6), level: from + (ph.to - from) * k, done: false };
    }
    local -= ph.sec;
    from = ph.to;
  }
  return { cycle, index: 0, kind: p.phases[0].kind, left: Math.ceil(p.phases[0].sec), level: from, done: false };
}
