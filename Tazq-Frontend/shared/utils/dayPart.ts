/**
 * GÜNÜN VAKİTLERİ — tek tanım (2026-11-01). Haftanın gökyüzü (en çok hangi vakit) ve panelin
 * ton çizgisi (B4) aynı sınırları kullanır: sabah 05–12 · öğle 12–17 · akşam 17–22 · gece 22–05.
 */
export type DayPart = 'morning' | 'noon' | 'evening' | 'night';

export function partOf(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'noon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}
