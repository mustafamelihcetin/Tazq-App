/**
 * Alışkanlık detayı: zincir (güncel/en uzun), takvim hücresi, haftanın gün deseni, ay ızgarası.
 * 2026-10-26 Pazartesi; "bugün" 2026-10-30 Cuma.
 */
import { streakStats, cellState, weekdayPattern, monthGrid } from '@/features/habits/utils/habitStats';
import type { HabitLike } from '@/features/habits/utils/habitSchedule';

const TODAY = '2026-10-30';
const h = (p: HabitLike): HabitLike => ({ createdAt: '2026-10-01T09:00:00Z', completedDates: [], skippedDates: [], ...p });
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-10-${String(from + i).padStart(2, '0')}`);

describe('zincir', () => {
  it('tek kaçırma affedilir, iki ardışık kaçırma koparır; en uzun korunur', () => {
    // 1-10 yapıldı (10), 11 kaçtı (affedilir), 12-14 yapıldı → 13; 15-16 kaçtı → koptu; 17-29 yapıldı → 13
    const x = h({ completedDates: [...days(1, 10), ...days(12, 14), ...days(17, 29)] });
    expect(streakStats(x, TODAY)).toEqual({ current: 13, longest: 13, unit: 'day' });
  });

  it('mola ve plan dışı gün zinciri bozmaz; bugün yapılmadıysa ceza yok', () => {
    expect(streakStats(h({ completedDates: days(20, 27), skippedDates: ['2026-10-28', '2026-10-29'] }), TODAY).current).toBe(8);
    const mwf = h({ schedule: { kind: 'days', days: [0, 2, 4] }, completedDates: ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28'] });
    expect(streakStats(mwf, TODAY).current).toBe(5);
  });

  it('haftada N: hedefi tutan ardışık HAFTALAR; içinde bulunulan hafta cezalandırılmaz', () => {
    const x = h({ schedule: { kind: 'weekly', times: 2 }, completedDates: ['2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22'] });
    expect(streakStats(x, TODAY)).toEqual({ current: 2, longest: 2, unit: 'week' });
  });
});

describe('takvim', () => {
  it('hücre durumları', () => {
    const x = h({ createdAt: '2026-10-05T09:00:00Z', completedDates: ['2026-10-26'], skippedDates: ['2026-10-27'] });
    expect(['2026-10-01', '2026-10-26', '2026-10-27', '2026-10-28', TODAY, '2026-10-31'].map(k => cellState(x, k, TODAY)))
      .toEqual(['before', 'done', 'rest', 'missed', 'today', 'future']);
  });

  it('ay ızgarası Pazartesi başlar, ay dışı boş', () => {
    const g = monthGrid(2026, 9); // Ekim 2026: 1'i Perşembe
    expect(g[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
  });
});

describe('gün deseni', () => {
  it('her gün için yapılma oranı', () => {
    // Son iki hafta: yalnız pazartesi ve salılar yapıldı
    const x = h({ createdAt: '2026-10-16T09:00:00Z', completedDates: ['2026-10-19', '2026-10-20', '2026-10-26', '2026-10-27'] });
    const p = weekdayPattern(x, TODAY, 2);
    expect(p[0]).toBe(1);
    expect(p[1]).toBe(1);
    expect(p[2]).toBe(0);
  });
});
