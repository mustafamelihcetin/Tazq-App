/**
 * Uyku süresi hesabı — regresyon testleri.
 *
 * Kök neden (giderildi): örneklerin süreleri DÜZ TOPLANIYORDU. HealthKit/Health
 * Connect'te aynı gece birden fazla kaynak tarafından yazılır (iPhone Uyku Odağı +
 * Apple Watch evreleri, üçüncü parti uygulamalar) → 7 saatlik uyku "14 saat" görünüyordu.
 * Ayrıca 26 saatlik pencereye düşen TÜM oturumlar toplanıyordu (gece + şekerleme,
 * hatta iki ayrı gece).
 */
import { lastSleepSessionMinutes, formatSleepDuration } from '@/shared/services/sleepHealth';

const iso = (s: string) => new Date(s).toISOString();

describe('lastSleepSessionMinutes', () => {
  it('aynı geceyi yazan iki kaynağı çift saymaz (union)', () => {
    // iPhone: 23:00–06:00 asleep (7s) + Apple Watch: aynı aralık core/deep/REM olarak
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T06:00') },
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T02:30') },
      { start: iso('2026-07-26T02:30'), end: iso('2026-07-26T04:30') },
      { start: iso('2026-07-26T04:30'), end: iso('2026-07-26T06:00') },
    ]);
    expect(mins).toBe(7 * 60); // eskiden 14 * 60 idi
  });

  it('kısmen örtüşen kaynakları birleştirir', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T04:00') }, // 5s
      { start: iso('2026-07-26T03:00'), end: iso('2026-07-26T06:00') }, // 3s, 1s örtüşüyor
    ]);
    expect(mins).toBe(7 * 60); // 23:00–06:00, düz toplam 8s olurdu
  });

  it('iki ayrı geceyi toplamaz — yalnız EN SON oturumu alır', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-24T22:00'), end: iso('2026-07-25T06:00') }, // 8s (önceki gece)
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T06:00') }, // 7s (son uyku)
    ]);
    expect(mins).toBe(7 * 60); // eskiden 15s
  });

  it('gece uykusu + öğle şekerlemesini toplamaz', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T06:00') }, // 7s
      { start: iso('2026-07-26T14:00'), end: iso('2026-07-26T16:00') }, // 2s şekerleme
    ]);
    expect(mins).toBe(2 * 60); // en son oturum = şekerleme (toplam 9s DEĞİL)
  });

  it('gece içi kısa uyanmaları aynı oturum sayar ama uyanık süreyi eklemez', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T23:00'), end: iso('2026-07-26T02:00') }, // 3s
      { start: iso('2026-07-26T02:30'), end: iso('2026-07-26T06:00') }, // 30dk sonra 3.5s
    ]);
    expect(mins).toBe(6 * 60 + 30); // 6.5s uyku; aradaki 30dk uyanıklık sayılmaz
  });

  it('akla yatkın olmayan süreyi (>16s) reddeder', () => {
    const mins = lastSleepSessionMinutes([
      { start: iso('2026-07-25T06:00'), end: iso('2026-07-26T00:00') }, // 18s
    ]);
    expect(mins).toBeNull();
  });

  it('boş / geçersiz girdide null döner', () => {
    expect(lastSleepSessionMinutes([])).toBeNull();
    expect(lastSleepSessionMinutes([{ start: 'abc', end: 'def' }])).toBeNull();
    // Bitiş başlangıçtan önce → geçersiz
    expect(lastSleepSessionMinutes([{ start: iso('2026-07-26T06:00'), end: iso('2026-07-26T05:00') }])).toBeNull();
  });
});

describe('formatSleepDuration', () => {
  it('tr/en biçimlendirir', () => {
    expect(formatSleepDuration(430, 'tr')).toBe('7s 10dk');
    expect(formatSleepDuration(420, 'tr')).toBe('7 saat');
    expect(formatSleepDuration(430, 'en')).toBe('7h 10m');
  });
});
