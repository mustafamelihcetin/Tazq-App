import { modeHistory } from '@/features/modes/utils/modeHistory';

/*
  MODLARIN ÖZETİ = GERİYE BAKIŞ (2026-10-31).
  Yol haritası ileriye bakıyor (faz, kalan gün, sıradakiler). Özet geçmiş 4 haftayı
  sayar; bu haftayı geçen haftanın TAMAMIYLA değil AYNI GÜNÜNE kadarki kısmıyla kıyaslar
  (yarım hafta tam haftayla kıyaslanırsa her pazartesi "düşüş" görünür).
*/
const NOW = new Date(2026, 9, 29, 15, 0); // Perşembe 29 Eki 2026

describe('modeHistory', () => {
  it('alışkanlık işaretleri ve biten plan görevleri hafta hafta sayılır (eskiden yeniye)', () => {
    const h = modeHistory({
      habits: [{ id: 'h1', completedDates: ['2026-10-05', '2026-10-12', '2026-10-13', '2026-10-26', '2026-10-29'] }],
      tasks: [
        { id: 1, isCompleted: true, completedAt: '2026-10-20T09:00:00' },
        { id: 2, isCompleted: true, completedAt: '2026-10-27T09:00:00' },
        { id: 3, isCompleted: false, completedAt: null },
      ],
      habitIds: ['h1'], taskIds: [1, 2, 3], now: NOW,
    });
    // Haftalar: 05–11 Eki, 12–18, 19–25, 26 Eki–1 Kas
    expect(h.weeks).toEqual([1, 2, 1, 3]);
    expect(h.thisWeek).toBe(3);
  });

  it('plana ait olmayan alışkanlık ve görev sayılmaz', () => {
    const h = modeHistory({
      habits: [{ id: 'x', completedDates: ['2026-10-29'] }],
      tasks: [{ id: 9, isCompleted: true, completedAt: '2026-10-29T09:00:00' }],
      habitIds: ['h1'], taskIds: [1], now: NOW,
    });
    expect(h.weeks).toEqual([0, 0, 0, 0]);
  });

  it('geçen hafta yalnız AYNI GÜNE kadar kıyaslanır', () => {
    const h = modeHistory({
      habits: [{ id: 'h1', completedDates: ['2026-10-19', '2026-10-22', '2026-10-24', '2026-10-25'] }],
      tasks: [], habitIds: ['h1'], taskIds: [], now: NOW,
    });
    // Geçen hafta Pzt + Per = 2 (Cmt/Paz sayılmaz); tam hafta 4.
    expect(h.lastWeekSameDay).toBe(2);
    expect(h.weeks[2]).toBe(4);
  });

  it('bitmemiş ya da tarihi bozuk görev sayılmaz', () => {
    const h = modeHistory({
      habits: [],
      tasks: [
        { id: 1, isCompleted: true, completedAt: '0001-01-01T00:00:00' },
        { id: 2, isCompleted: false, completedAt: '2026-10-29T09:00:00' },
      ],
      habitIds: [], taskIds: [1, 2], now: NOW,
    });
    expect(h.thisWeek).toBe(0);
  });
});
