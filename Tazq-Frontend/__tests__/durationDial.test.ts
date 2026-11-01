import { clampDial, minutesFromPoint, DIAL_MAX } from '@/features/focus/components/DurationDial';

/*
  SÜRE KADRANI (2026-11-01): süre halkadan, dakika dakika seçilir; tur atlayıp 120'den 1'e düşmez.
*/
describe('süre kadranı', () => {
  const S = 200; // merkez (100,100)
  it('açı → dakika: tepe 0, sağ 30, alt 60, sol 90', () => {
    expect(minutesFromPoint(100, 0, S)).toBe(0);
    expect(minutesFromPoint(200, 100, S)).toBe(30);
    expect(minutesFromPoint(100, 200, S)).toBe(60);
    expect(minutesFromPoint(0, 100, S)).toBe(90);
  });

  it('1 dakikalık adım seçilebilir (3 dk)', () => {
    const a = (3 / DIAL_MAX) * Math.PI * 2;
    expect(clampDial(5, minutesFromPoint(100 + 90 * Math.sin(a), 100 - 90 * Math.cos(a), S))).toBe(3);
  });

  it('tepe noktasından taşmaz: 118 → 2 sıçraması 120, 3 → 117 sıçraması 1', () => {
    expect(clampDial(118, 2)).toBe(DIAL_MAX);
    expect(clampDial(3, 117)).toBe(1);
    expect(clampDial(10, 0)).toBe(1);
  });
});
