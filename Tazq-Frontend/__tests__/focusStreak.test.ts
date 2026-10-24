import { recentFocus } from '@/features/focus/focusStreak';

const NOW = new Date(2026, 9, 24, 15, 0, 0); // 24 Ekim, 15:00 yerel
const at = (dayOffset: number, hour = 10) => {
  const d = new Date(NOW); d.setDate(d.getDate() - dayOffset); d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe('recentFocus', () => {
  it('son 7 günü eskiden yeniye, bugün en sonda verir', () => {
    const { days } = recentFocus([], 0, NOW);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ key: '2026-10-24', isToday: true });
    expect(days[0].key).toBe('2026-10-18');
  });

  it('aynı günün seanslarını toplar', () => {
    const { days } = recentFocus([{ startedAt: at(1), minutes: 25 }, { startedAt: at(1, 16), minutes: 15 }], 0, NOW);
    expect(days[5].minutes).toBe(40);
  });

  it('bugün yerel sayaç sunucudan ilerideyse onu kullanır', () => {
    const { days } = recentFocus([{ startedAt: at(0), minutes: 10 }], 35, NOW);
    expect(days[6].minutes).toBe(35);
  });

  it('seri: bugün dahil ardışık günler', () => {
    const s = [0, 1, 2].map(o => ({ startedAt: at(o), minutes: 20 }));
    expect(recentFocus(s, 0, NOW).streak).toBe(3);
  });

  it('seri: bugün henüz odak yoksa dünden sayılır — gün bitmeden kırılmaz', () => {
    const s = [1, 2].map(o => ({ startedAt: at(o), minutes: 20 }));
    expect(recentFocus(s, 0, NOW).streak).toBe(2);
  });

  it('seri: boşluk seriyi keser', () => {
    const s = [0, 2, 3].map(o => ({ startedAt: at(o), minutes: 20 }));
    expect(recentFocus(s, 0, NOW).streak).toBe(1);
  });

  it('bozuk tarih yok sayılır', () => {
    expect(recentFocus([{ startedAt: 'bozuk', minutes: 50 }], 0, NOW).days.every(d => d.minutes === 0)).toBe(true);
  });
});
