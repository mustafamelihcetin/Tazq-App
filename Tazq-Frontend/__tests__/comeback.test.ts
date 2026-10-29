/**
 * Madde 11 — Momentum koruma: uygulama 2 gün açılmazsa baskısız bir geri çağrı.
 * Her açılışta 48 saat sonrasına yeniden kurulur (açan kullanıcı hiç görmez).
 * Gece rahatsız etmez: 22:00–09:00 arasına düşerse sabah 10:00'a kayar.
 */
import { comebackTime } from '@/shared/utils/comeback';

describe('kurtarma bildirimi zamanı', () => {
  it('48 saat sonra', () => {
    const now = new Date(2026, 9, 30, 14, 0);
    expect(comebackTime(now)).toEqual(new Date(2026, 10, 1, 14, 0));
  });

  it('gece yarısına düşerse sabah 10:00', () => {
    const now = new Date(2026, 9, 30, 23, 30);
    expect(comebackTime(now)).toEqual(new Date(2026, 10, 2, 10, 0));
  });

  it('sabah erken saate düşerse aynı günün 10:00\'ı', () => {
    const now = new Date(2026, 9, 30, 7, 0);
    expect(comebackTime(now)).toEqual(new Date(2026, 10, 1, 10, 0));
  });
});
