import {
  weekRange, summarizeWeek, compareWeeks, weekStory, weekLabel, shortDayLabels,
  habitDenominator, taskDayKey, sessionDayKey,
} from '@/features/report/weeklyReport';

/**
 * HAFTALIK ÖZET — sayının TANIMI.
 *
 * ── ÖLÇÜLEN SORUNLAR ────────────────────────────────────────────────────────
 *  1. Görevler VADE gününe göre sayılıyordu: dün vadeli işi bugün bitirince bugüne
 *     yazılmıyordu, tarihsiz görevler ise hiç sayılmıyordu.
 *  2. Günler UTC'ye göre kırılıyordu: gece 00:30'daki odak bir önceki güne düşüyordu.
 *  3. Alışkanlık oranının paydası her zaman "alışkanlık × 7" idi: salı günü her şeyi
 *     yapan kullanıcı %29 görüyordu.
 *  4. Kokpit ile rapor aynı haftayı AYRI hesaplıyordu.
 *  5. Gün adları sunucudan İngilizce geliyordu ("Mo, Tu, We").
 */

// Pazartesi 15 Eylül 2026 → Pazar 21 Eylül 2026 (yerel)
const MONDAY = new Date(2026, 8, 14, 10, 0, 0);
const range = weekRange(MONDAY);
const prevRange = weekRange(MONDAY, -1);
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();

describe('hafta sınırı ve gün anahtarı YEREL', () => {
  it('hafta pazartesi başlar, pazar biter', () => {
    expect(range.days).toEqual([
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
    ]);
    expect(prevRange.startKey).toBe('2026-09-07');
  });

  it('hafta içi herhangi bir günden aynı hafta bulunur', () => {
    expect(weekRange(new Date(2026, 8, 20, 23, 30)).startKey).toBe(range.startKey);
  });

  it('gece yarısından sonraki seans O GÜNE yazılır — UTC kayması yok', () => {
    // 00:30 yerel: UTC'de bir önceki gün olabilir; kullanıcının takviminde bugündür.
    expect(sessionDayKey(local(2026, 8, 16, 0, 30))).toBe('2026-09-16');
  });
});

describe('görev = TAMAMLANDIĞI gün', () => {
  it('dün vadeli, bugün biten iş BUGÜNE yazılır', () => {
    expect(taskDayKey({ isCompleted: true, completedAt: local(2026, 8, 16), dueDate: '2026-09-15T00:00:00Z' }))
      .toBe('2026-09-16');
  });

  it('tarihsiz görev de sayılır', () => {
    expect(taskDayKey({ isCompleted: true, completedAt: local(2026, 8, 16), dueDate: null })).toBe('2026-09-16');
  });

  it('eski kayıtta (completedAt yok) vade günü yedek olur', () => {
    expect(taskDayKey({ isCompleted: true, dueDate: '2026-09-15T00:00:00Z' })).toBe('2026-09-15');
  });

  it('tamamlanmamış görev hiç sayılmaz', () => {
    expect(taskDayKey({ isCompleted: false, dueDate: '2026-09-15T00:00:00Z' })).toBeNull();
  });
});

describe('haftanın özeti', () => {
  const sessions = [
    { startedAt: local(2026, 8, 14, 9), minutes: 25 },
    { startedAt: local(2026, 8, 16, 21), minutes: 50 },
    { startedAt: local(2026, 8, 16, 23, 40), minutes: 10 },
    { startedAt: local(2026, 8, 7, 9), minutes: 999 }, // geçen hafta — bu haftaya girmez
  ];
  const tasks = [
    { isCompleted: true, completedAt: local(2026, 8, 14), dueDate: null },
    { isCompleted: true, completedAt: local(2026, 8, 16), dueDate: '2026-09-10T00:00:00Z' },
    { isCompleted: false, completedAt: null, dueDate: '2026-09-16T00:00:00Z' },
  ];
  const habits = [
    { id: 'h1', completedDates: ['2026-09-14', '2026-09-15'], createdAt: local(2026, 8, 1) },
    { id: 'h2', completedDates: ['2026-09-14'], createdAt: local(2026, 8, 1) },
  ];
  const now = new Date(2026, 8, 16, 12, 0); // hafta ortası: çarşamba

  const sum = summarizeWeek({ sessions, tasks, habits, range, now });

  it('odak dakikaları doğru güne düşer, başka hafta karışmaz', () => {
    expect(sum.focusPerDay).toEqual([25, 0, 60, 0, 0, 0, 0]);
    expect(sum.totalFocusMin).toBe(85);
    expect(sum.activeDays).toBe(2);
    expect(sum.bestDayIndex).toBe(2); // çarşamba
  });

  it('görevler tamamlandıkları güne yazılır', () => {
    expect(sum.tasksPerDay).toEqual([1, 0, 1, 0, 0, 0, 0]);
    expect(sum.totalTasks).toBe(2);
  });

  it('alışkanlık oranının paydası YAŞANMIŞ günler — hafta ortasında %100 mümkün', () => {
    // 2 alışkanlık × 3 gün (Pzt-Çar) = 6 beklenen, 3 yapılmış → %50
    expect(sum.habitPct).toBe(50);
    const perfect = summarizeWeek({
      sessions: [], tasks: [],
      habits: [{ id: 'h1', completedDates: ['2026-09-14', '2026-09-15', '2026-09-16'], createdAt: local(2026, 8, 1) }],
      range, now,
    });
    expect(perfect.habitPct).toBe(100);
  });

  it('alışkanlık kurulmadan önceki günler beklenmez', () => {
    const days = range.days;
    // Çarşamba kurulmuş alışkanlık: yalnız çarşamba beklenir (bugün çarşamba)
    expect(habitDenominator([{ id: 'h', createdAt: local(2026, 8, 16) }], days, '2026-09-16')).toBe(1);
    expect(habitDenominator([{ id: 'h', createdAt: local(2026, 8, 1) }], days, '2026-09-16')).toBe(3);
  });
});

describe('geçen haftayla kıyas', () => {
  const cur = summarizeWeek({ sessions: [{ startedAt: local(2026, 8, 14, 9), minutes: 90 }], tasks: [], habits: [], range, now: new Date(2026, 8, 20) });
  const prev = summarizeWeek({ sessions: [{ startedAt: local(2026, 8, 7, 9), minutes: 50 }], tasks: [], habits: [], range: prevRange, now: new Date(2026, 8, 20) });

  it('fark hesaplanır', () => {
    expect(compareWeeks(cur, prev)).toMatchObject({ focusMin: 40, comparable: true });
  });

  it('geçen hafta BOŞSA kıyas yapılmaz — yanıltıcı "sonsuz artış" olmaz', () => {
    const empty = summarizeWeek({ sessions: [], tasks: [], habits: [], range: prevRange, now: new Date(2026, 8, 20) });
    expect(compareWeeks(cur, empty).comparable).toBe(false);
    expect(compareWeeks(cur, null).comparable).toBe(false);
  });
});

describe('haftanın hikâyesi ve etiketler', () => {
  const cur = summarizeWeek({
    sessions: [{ startedAt: local(2026, 8, 16, 9), minutes: 90 }],
    tasks: [{ isCompleted: true, completedAt: local(2026, 8, 16), dueDate: null }],
    habits: [], range, now: new Date(2026, 8, 20),
  });

  it('cümle kurar: kaç gün, en iyi gün, kaç iş, kıyas', () => {
    const prev = summarizeWeek({ sessions: [{ startedAt: local(2026, 8, 7, 9), minutes: 50 }], tasks: [], habits: [], range: prevRange, now: new Date(2026, 8, 20) });
    const story = weekStory(cur, compareWeeks(cur, prev), 'tr');
    expect(story).toContain('1 gün odaklandın');
    expect(story).toContain('Çarşamba');
    expect(story).toContain('1 iş bitirdin');
    expect(story).toContain('40 dakika daha fazla');
  });

  it('boş haftada suçlayıcı değil, davet eden bir cümle', () => {
    const empty = summarizeWeek({ sessions: [], tasks: [], habits: [], range, now: new Date(2026, 8, 20) });
    expect(weekStory(empty, compareWeeks(empty, null), 'tr')).toContain('Tek bir seans');
  });

  it('hangi haftaya bakıldığı yazılır', () => {
    expect(weekLabel(range, 'tr')).toBe('14 – 20 Eyl');
    expect(weekLabel(weekRange(new Date(2026, 8, 30)), 'tr')).toBe('28 Eyl – 4 Eki');
  });

  it('gün adları arayüzün dilinde ve BİRBİRİNDEN AYRI', () => {
    // İki harf Türkçede yetmiyordu: Pazartesi/Pazar "Pa", Cuma/Cumartesi "Cu" olurdu.
    const tr = shortDayLabels('tr');
    expect(tr).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
    expect(new Set(tr).size).toBe(7);
    expect(shortDayLabels('en')[0]).toBe('Mon');
  });
});
