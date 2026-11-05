import { advance, angleOf, isStop, snapMinutes, minutesFromPoint, DIAL_MAX, DIAL_MIN } from '@/features/focus/components/DurationDial';

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
    expect(minutesFromPoint(100 + 90 * Math.sin(a), 100 - 90 * Math.cos(a), S)).toBe(3);
  });
});

describe('göreli çevirme (kullanıcı: "süre mekaniği tam kalitede değil")', () => {
  const rad = (min: number) => (min / DIAL_MAX) * Math.PI * 2;
  it('değer parmağın kat ettiği açı kadar değişir: nereden tutulursa tutulsun sıçramaz', () => {
    expect(advance(25, rad(80), rad(85))).toBeCloseTo(30);
    expect(advance(25, rad(80), rad(75))).toBeCloseTo(20);
  });
  it('tepeden geçmek sıçrama değildir', () => {
    expect(advance(50, rad(118), rad(2))).toBeCloseTo(54);
    expect(advance(50, rad(2), rad(118))).toBeCloseTo(46);
  });
  it('hızlı çevirme 1\'e düşürmez, uçlarda durur', () => {
    expect(advance(25, rad(10), rad(60))).toBeCloseTo(75); // bir karede büyük sıçrama da ileri sayılır
    expect(advance(119, rad(10), rad(20))).toBe(DIAL_MAX);
    expect(advance(2, rad(20), rad(10))).toBe(DIAL_MIN);
  });
  it('uçta bekleyen parmak geri dönünce değer hemen geri gelir', () => {
    expect(advance(DIAL_MAX, rad(40), rad(38))).toBeCloseTo(118);
  });
  it('angleOf tepeden saat yönünde', () => {
    expect(angleOf(200, 100, 200)).toBeCloseTo(Math.PI / 2);
  });
});

describe('adım', () => {
  it('yavaşta 1 dakika: 3 seçilebilir', () => { expect(snapMinutes(3.2, false)).toBe(3); expect(snapMinutes(27.4, false)).toBe(27); });
  it('hızlıda 5 dakika', () => { expect(snapMinutes(27.4, true)).toBe(25); expect(snapMinutes(118, true)).toBe(120); expect(snapMinutes(1.2, true)).toBe(1); });
  it('mıknatıs yaygın süreleri tutar ama komşusu seçilebilir', () => {
    expect(snapMinutes(25.6, false)).toBe(25);
    expect(snapMinutes(24.3, false)).toBe(25);
    expect(snapMinutes(26, false)).toBe(26);
    expect(isStop(25)).toBe(true);
    expect(isStop(26)).toBe(false);
  });
});
