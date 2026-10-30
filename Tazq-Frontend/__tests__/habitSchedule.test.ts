/**
 * Alışkanlık planı: esnek sıklık, miktar, zaman dilimi, tutarlılık, "iki kez kaçırma", kilometre taşı.
 * 2026-10-26 = Pazartesi.
 */
import {
  isDueToday, weekProgress, consistency, missState, milestone, orderForNow, bump, countOn, pendingOn, weekdayOf, type HabitLike,
} from '@/features/habits/utils/habitSchedule';

const MON = '2026-10-26', TUE = '2026-10-27', WED = '2026-10-28', THU = '2026-10-29', FRI = '2026-10-30';
const h = (p: HabitLike): HabitLike => ({ createdAt: '2026-09-01T09:00:00Z', completedDates: [], skippedDates: [], ...p });

describe('plan günü', () => {
  it('Pazartesi = 0', () => expect(weekdayOf(MON)).toBe(0));

  it('belirli günler: planlanmayan gün listede değil', () => {
    const x = h({ schedule: { kind: 'days', days: [0, 2, 4] } });
    expect([MON, TUE, WED].map(d => isDueToday(x, d))).toEqual([true, false, true]);
  });

  it('haftada N: hedef dolunca listeden çıkar, bugün yapıldıysa görünür kalır', () => {
    const x = h({ schedule: { kind: 'weekly', times: 2 }, completedDates: [MON, TUE] });
    expect(isDueToday(x, WED)).toBe(false);
    expect(isDueToday(x, TUE)).toBe(true);
    expect(weekProgress(x, WED)).toEqual({ done: 2, goal: 2 });
  });

  it('dinlenen alışkanlık hiç görünmez', () => expect(isDueToday(h({ pausedAt: MON }), TUE)).toBe(false));
});

describe('tutarlılık', () => {
  it('her gün: bugün yapılmadıysa payda dışı, mola payda dışı', () => {
    const x = h({ createdAt: `${MON}T08:00:00Z`, completedDates: [MON, WED], skippedDates: [TUE] });
    expect(consistency(x, THU)).toBe(100); // Pzt+Çar yapıldı, Sal mola, Per henüz bitmedi
    expect(consistency(x, FRI)).toBe(67);  // Per kaçtı → 2/3
  });

  it('belirli günler yalnız planlı günleri sayar', () => {
    const x = h({ createdAt: `${MON}T08:00:00Z`, schedule: { kind: 'days', days: [0, 2, 4] }, completedDates: [MON, WED] });
    expect(consistency(x, THU)).toBe(100);
  });

  it('haftada N: içinde bulunulan hafta cezalandırılmaz', () => {
    const x = h({ createdAt: '2026-10-19T08:00:00Z', schedule: { kind: 'weekly', times: 3 }, completedDates: ['2026-10-20', '2026-10-22', MON] });
    // geçen hafta 2/3, bu hafta 1/1 (henüz bitmedi) → 3/4
    expect(consistency(x, TUE)).toBe(75);
  });

  it('yeni alışkanlıkta bekleyen gün yoksa null ("henüz erken")', () => {
    expect(consistency(h({ createdAt: `${FRI}T08:00:00Z` }), FRI)).toBeNull();
  });
});

describe('iki kez kaçırma', () => {
  it('dün yapıldıysa ok, dün kaçtıysa missed, iki gün kaçtıysa broken', () => {
    expect(missState(h({ completedDates: [THU] }), FRI)).toBe('ok');
    expect(missState(h({ completedDates: [WED] }), FRI)).toBe('missed');
    expect(missState(h({ completedDates: [TUE] }), FRI)).toBe('broken');
  });

  it('mola ve planlanmayan günler zinciri kırmaz', () => {
    expect(missState(h({ completedDates: [WED], skippedDates: [THU] }), FRI)).toBe('ok');
    expect(missState(h({ schedule: { kind: 'days', days: [0, 2] }, completedDates: [WED] }), FRI)).toBe('ok');
  });
});

describe('miktar', () => {
  it('her dokunuş +1, hedefte gün yapıldı, hedefteyken dokunuş sıfırlar', () => {
    let x = h({ target: 3 });
    for (let i = 1; i <= 3; i++) {
      const r = bump(x, MON);
      x = { ...x, counts: r.counts, completedDates: r.done ? [MON] : [] };
      expect(countOn(x, MON)).toBe(i);
    }
    expect(x.completedDates).toEqual([MON]);
    const r = bump(x, MON);
    expect(r).toEqual({ counts: {}, done: false });
  });
});

describe('kilometre taşı ve sıra', () => {
  it('toplam tekrar asla düşmez; sıradaki taş', () => {
    const dates = Array.from({ length: 8 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    expect(milestone(h({ completedDates: dates }))).toEqual({ total: 8, next: 21, reached: 7 });
  });

  it('şu anki dilim önce, yapılanlar sonda', () => {
    const list = [
      h({ slot: 'morning' }), h({ slot: 'evening' }), h({}), h({ slot: 'evening', completedDates: [FRI] }),
    ].map((x, i) => ({ ...x, id: i }));
    const evening = new Date(2026, 9, 30, 20, 0);
    expect(orderForNow(list, FRI, evening).map(x => x.id)).toEqual([1, 0, 2, 3]);
  });

  it('gün sonu bekleyenleri: planlı, yapılmamış, mola değil', () => {
    const list = [h({}), h({ completedDates: [FRI] }), h({ skippedDates: [FRI] }), h({ schedule: { kind: 'days', days: [0] } })];
    expect(pendingOn(list, FRI)).toHaveLength(1);
  });
});
