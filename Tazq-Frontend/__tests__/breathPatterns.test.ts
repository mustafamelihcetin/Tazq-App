/**
 * Madde 14 — nefes seansı ritim motoru. Faz, sayaç ve küre tek saatten okunur;
 * seans her zaman bir verişin sonunda biter.
 */
import { BREATH_PATTERNS, patternOf, cycleSec, cyclesFor, totalSec, phaseAt } from '@/features/breath/patterns';

describe('nefes ritimleri', () => {
  it('yayımlanmış tekniklerin süreleri', () => {
    expect(cycleSec(patternOf('sigh'))).toBe(9);       // 2 + 1 al, 6 ver
    expect(cycleSec(patternOf('box'))).toBe(16);       // 4-4-4-4
    expect(cycleSec(patternOf('sleep'))).toBe(19);     // 4-7-8
    expect(60 / cycleSec(patternOf('resonance'))).toBeCloseTo(5.45, 1); // ~5.5 nefes/dk
  });

  it('her ritim boş akciğerle biter (bir sonraki döngü kesintisiz başlar)', () => {
    for (const p of BREATH_PATTERNS) expect(p.phases[p.phases.length - 1].to).toBe(0);
  });

  it('süre tam döngüye yuvarlanır, en az bir döngü', () => {
    expect(cyclesFor(patternOf('sigh'), 5)).toBe(33);  // 300 / 9
    expect(cyclesFor(patternOf('sleep'), 1)).toBe(3);  // 60 / 19
    expect(totalSec(patternOf('box'), 1)).toBe(64);
    expect(cyclesFor(patternOf('sleep'), 0)).toBe(1);
  });

  it('faz ve kalan saniye doğru okunur', () => {
    const box = patternOf('box');
    expect(phaseAt(box, 0, 4)).toMatchObject({ kind: 'in', left: 4, cycle: 0 });
    expect(phaseAt(box, 5.2, 4)).toMatchObject({ kind: 'hold', left: 3 });
    expect(phaseAt(box, 16.5, 4)).toMatchObject({ kind: 'in', cycle: 1 });
    const sigh = patternOf('sigh');
    expect(phaseAt(sigh, 2.5, 2).kind).toBe('top');
  });

  it('küre doluluğu fazlar arasında sıçramaz', () => {
    const p = patternOf('sigh');
    let prev = phaseAt(p, 0, 3).level;
    for (let t = 0.05; t < totalSec(p, 0.5); t += 0.05) {
      const lv = phaseAt(p, t, 3).level;
      expect(Math.abs(lv - prev)).toBeLessThan(0.08);
      prev = lv;
    }
  });

  it('süre dolunca seans biter', () => {
    const p = patternOf('resonance');
    expect(phaseAt(p, 11 * 2, 2).done).toBe(true);
    expect(phaseAt(p, 21.9, 2).done).toBe(false);
  });
});
