import { skyStars, skyStory, hourFrac, partOf } from '@/features/report/weekSky';

/**
 * HAFTANIN GÖKYÜZÜ v2 (2026-11-01, kullanıcı: "daha ön plana çıksın, daha anlamlı olsun").
 *
 * Eskiden yıldızlar gün sütununda RASTGELE yükseklikteydi: konum hiçbir şey anlatmıyordu. Artık:
 *  · her yıldız bir odak SEANSI,
 *  · yükseklik = günün SAATİ (sabah üstte, gece altta) → haftanın deseni görünür,
 *  · büyüklük = seansın SÜRESİ,
 *  · çizgi seansları ZAMAN SIRASIYLA bağlar → haftanın gerçek yolu.
 * Eski sunucuda saat bilinmez (günlük toplamdan üretilen seans): yükseklik uydurulmaz, ortada durur.
 */
const DAYS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
const at = (day: string, h: number, m = 0) => new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();

describe('saat ekseni', () => {
  it('05:00 en üst, 17:00 ortanın altı, 04:59 en alt', () => {
    expect(hourFrac(new Date('2026-10-26T05:00:00'))).toBeCloseTo(0);
    expect(hourFrac(new Date('2026-10-26T17:00:00'))).toBeCloseTo(0.5);
    expect(hourFrac(new Date('2026-10-26T04:59:00'))).toBeGreaterThan(0.99);
  });

  it('günün vakitleri', () => {
    expect([partOf(6), partOf(13), partOf(19), partOf(23), partOf(2)]).toEqual(['morning', 'noon', 'evening', 'night', 'night']);
  });
});

describe('skyStars', () => {
  const sessions = [
    { startedAt: at('2026-10-29', 20), minutes: 50 },
    { startedAt: at('2026-10-26', 9), minutes: 10 },
    { startedAt: at('2026-10-29', 8), minutes: 25 },
    { startedAt: at('2026-10-20', 9), minutes: 40 },   // hafta dışı
    { startedAt: at('2026-10-27', 10), minutes: 0 },   // süresiz
  ];

  it('hafta içi seanslar, zaman sırasıyla; gün sütunu ve saat yüksekliği', () => {
    const s = skyStars(sessions, DAYS, true);
    expect(s.map(x => [x.day, x.minutes])).toEqual([[0, 10], [3, 25], [3, 50]]);
    expect(s[0].y01).toBeCloseTo(hourFrac(new Date(at('2026-10-26', 9))));
    expect(s[2].y01).toBeGreaterThan(s[1].y01); // akşam seansı sabahınkinden aşağıda
  });

  it('uzun seans daha büyük yıldız', () => {
    const s = skyStars(sessions, DAYS, true);
    expect(s[2].size).toBeGreaterThan(s[1].size);
    expect(s[1].size).toBeGreaterThan(s[0].size);
  });

  it('aynı gün yıldızları sütunda yan yana açılır (üst üste binmez), sütundan taşmaz', () => {
    const s = skyStars(sessions, DAYS, true).filter(x => x.day === 3);
    expect(s[0].x01).not.toBe(s[1].x01);
    for (const x of s) { expect(x.x01).toBeGreaterThanOrEqual(3 / 7); expect(x.x01).toBeLessThanOrEqual(4 / 7); }
  });

  it('saat bilinmiyorsa (eski sunucu) yükseklik uydurulmaz', () => {
    expect(skyStars(sessions, DAYS, false).every(x => x.y01 === 0.5)).toBe(true);
  });
});

describe('skyStory', () => {
  it('en çok vakit ve en parlak gün', () => {
    const sessions = [
      { startedAt: at('2026-10-29', 20), minutes: 50 },
      { startedAt: at('2026-10-29', 21), minutes: 30 },
      { startedAt: at('2026-10-26', 9), minutes: 25 },
    ];
    expect(skyStory(sessions, DAYS, 'tr', true)).toBe('En çok akşam odaklandın · en parlak gün Perşembe');
    expect(skyStory(sessions, DAYS, 'en', true)).toBe('You focused most in the evening · brightest day Thursday');
  });

  it('saat bilinmiyorsa yalnız en parlak gün; seans yoksa null', () => {
    expect(skyStory([{ startedAt: at('2026-10-27', 12), minutes: 30 }], DAYS, 'tr', false)).toBe('En parlak gün Salı');
    expect(skyStory([], DAYS, 'tr', true)).toBeNull();
  });
});
