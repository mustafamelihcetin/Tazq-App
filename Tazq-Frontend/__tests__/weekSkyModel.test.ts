import { skyStars, skyStory, hourFrac, partOf, skyWeek, skyDelta, skyDuration, skyDayLine, skyTop, skyDayTasks } from '@/features/report/weekSky';

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

describe('gökyüzünün karşılığı', () => {
  const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
  const rows = [
    { startedAt: '2026-11-02T09:00:00', minutes: 25 },
    { startedAt: '2026-11-05T23:10:00', minutes: 25 },
    { startedAt: '2026-11-05T21:00:00', minutes: 50 },
    // geçen hafta: Pzt ve Per bugüne kadar sayılır, Cuma sayılmaz
    { startedAt: '2026-10-26T09:00:00', minutes: 30 },
    { startedAt: '2026-10-29T09:00:00', minutes: 30 },
    { startedAt: '2026-10-30T09:00:00', minutes: 100 },
  ];

  it('toplam ve gün dökümü gerçek seanslardan gelir', () => {
    const w = skyWeek(rows, week, '2026-11-05', true);
    expect(w.totalMinutes).toBe(100);
    expect(w.count).toBe(3);
    expect(w.days[3]).toMatchObject({ minutes: 75, count: 2, longest: 50 });
    expect(w.days[3].firstAt?.getHours()).toBe(21);
  });

  it('kıyas geçen haftanın AYNI noktasıyla: yarım hafta tam haftayla kıyaslanmaz', () => {
    expect(skyWeek(rows, week, '2026-11-05', true).delta).toBe(40);
  });

  it('geçen hafta veri yoksa ya da saat bilinmiyorsa kıyas uydurulmaz', () => {
    expect(skyWeek(rows.slice(0, 3), week, '2026-11-05', true).delta).toBeNull();
    expect(skyWeek(rows, week, '2026-11-05', false).delta).toBeNull();
    expect(skyDelta(null, 'tr')).toBeNull();
  });

  it('metinler okunur ve iki dilde', () => {
    expect(skyDuration(192, 'tr')).toBe('3 sa 12 dk');
    expect(skyDuration(45, 'en')).toBe('45 min');
    expect(skyDelta(40, 'tr')).toBe('Geçen haftanın bu noktasına göre +40 dk');
    expect(skyDelta(-90, 'en')).toBe('−1 h 30 min vs this point last week');
    expect(skyDelta(0, 'tr')).toBe('Geçen haftanın bu noktasıyla aynı');
    const w = skyWeek(rows, week, '2026-11-05', true);
    expect(skyDayLine(w.days[3], week[3], 'tr', true)).toBe('Perşembe · 2 seans · 1 sa 15 dk · en uzunu 50 dk · ilki 21:00');
    expect(skyDayLine(w.days[1], week[1], 'tr', true)).toBe('Salı · seans yok');
    expect(skyDayLine(w.days[0], week[0], 'en', false)).toBe('Monday · 1 session · 25 min');
  });
});

describe('neye odaklandın', () => {
  const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
  const rows = [
    { startedAt: '2026-11-05T10:00:00', minutes: 50, taskName: 'Tez', pausedSeconds: 0 },
    { startedAt: '2026-11-05T12:00:00', minutes: 25, taskName: 'Okuma', pausedSeconds: 120 },
    { startedAt: '2026-11-05T14:00:00', minutes: 10, taskName: null, pausedSeconds: null },
    { startedAt: '2026-11-06T10:00:00', minutes: 50, taskName: 'Tez' },
  ];

  it('haftanın en çok süre alan işi', () => {
    expect(skyTop(skyWeek(rows, week, undefined, true), 'tr')).toBe('En çok: Tez · 1 sa 40 dk');
  });

  it('hiç ad yoksa satır yok: uydurulmaz', () => {
    expect(skyTop(skyWeek([{ startedAt: '2026-11-05T10:00:00', minutes: 50 }], week, undefined, true), 'tr')).toBeNull();
  });

  it('gün dökümü işleri büyükten küçüğe, adsız süre Diğer', () => {
    const w = skyWeek(rows, week, undefined, true);
    expect(skyDayTasks(w.days[3], 'tr')).toBe('Tez 50 dk · Okuma 25 dk · Diğer 10 dk');
    expect(skyDayTasks(w.days[1], 'tr')).toBeNull();
  });

  it('en çok üç iş; gerisi Diğer', () => {
    const many = ['A', 'B', 'C', 'D'].map((n, i) => ({ startedAt: `2026-11-05T1${i}:00:00`, minutes: 40 - i, taskName: n }));
    expect(skyDayTasks(skyWeek(many, week, undefined, true).days[3], 'en')).toBe('A 40 min · B 39 min · C 38 min · Other 37 min');
  });

  it('yıldız kesintisiz bilgisini taşır; eski kayıtta bilinmiyor', () => {
    const stars = skyStars(rows, week, true);
    expect(stars.map((x) => x.clean)).toEqual([true, false, null, null]);
  });
});
