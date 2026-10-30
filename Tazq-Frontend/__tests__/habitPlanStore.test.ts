/**
 * Alışkanlık deposu × plan: miktar dokunuşu, otomatik işaretleme, plana duyarlı seri, sayaç birleştirme.
 */
import { useHabitStore, fmtDateKey, type Habit } from '@/features/habits/store/useHabitStore';
import { mergeHabits } from '@/features/habits/utils/habitsMerge';

const base = (p: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Su', emoji: '💧', color: '#000', completedDates: [], skippedDates: [], createdAt: '2026-09-01T00:00:00.000Z', ...p,
});
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return fmtDateKey(d); };

beforeEach(() => useHabitStore.setState({ habits: [] }));

describe('miktarlı dokunuş', () => {
  it('3 dokunuşta gün yapıldı; dördüncü dokunuş geri alır', () => {
    useHabitStore.setState({ habits: [base({ target: 3 })] });
    const today = fmtDateKey();
    const tap = () => useHabitStore.getState().tapHabit('h1', today);
    tap(); tap();
    expect(useHabitStore.getState().habits[0].completedDates).toEqual([]);
    tap();
    expect(useHabitStore.getState().habits[0].completedDates).toEqual([today]);
    tap();
    const h = useHabitStore.getState().habits[0];
    expect(h.completedDates).toEqual([]);
    expect(h.counts ?? {}).toEqual({});
  });

  it('miktarsız alışkanlıkta dokunuş yapıldı/geri al', () => {
    useHabitStore.setState({ habits: [base()] });
    const today = fmtDateKey();
    useHabitStore.getState().tapHabit('h1', today);
    expect(useHabitStore.getState().habits[0].completedDates).toEqual([today]);
  });
});

describe('otomatik işaretleme', () => {
  it('yalnız bağlı, bugün planlı ve henüz yapılmamış alışkanlıkları işaretler', () => {
    const today = fmtDateKey();
    useHabitStore.setState({ habits: [
      base({ id: 'a', name: 'Ders', autoFrom: 'focus' }),
      base({ id: 'b', name: 'Nefes', autoFrom: 'breath' }),
      base({ id: 'c', name: 'Okuma', autoFrom: 'focus', completedDates: [today] }),
      base({ id: 'd', name: 'Su', autoFrom: 'focus', target: 8 }),
      base({ id: 'e', name: 'Dinlenen', autoFrom: 'focus', pausedAt: today }),
    ] });
    expect(useHabitStore.getState().markAuto('focus', today)).toEqual(['Ders', 'Su']);
    const byId = Object.fromEntries(useHabitStore.getState().habits.map(h => [h.id, h]));
    expect(byId.a.completedDates).toEqual([today]);
    expect(byId.b.completedDates).toEqual([]);
    expect(byId.d.counts?.[today]).toBe(8);
    expect(byId.e.completedDates).toEqual([]);
  });
});

describe('plana duyarlı seri', () => {
  it('belirli günlerde planlanmayan günler seriyi bozmaz', () => {
    // Yalnız bugünün ve 7/14 gün öncesinin hafta günü planlı: haftada bir.
    const wd = (new Date().getDay() + 6) % 7;
    const h = base({ schedule: { kind: 'days', days: [wd] }, completedDates: [daysAgo(0), daysAgo(7), daysAgo(14)] });
    expect(useHabitStore.getState().getStreak(h)).toBe(3);
  });

  it('her gün alışkanlığında iki ardışık kaçırma seriyi koparır', () => {
    const h = base({ completedDates: [daysAgo(3), daysAgo(4)] });
    expect(useHabitStore.getState().getStreak(h)).toBe(0);
  });
});

describe('eşitleme', () => {
  it('miktar sayaçları gün başına büyük olanı korur', () => {
    const merged = mergeHabits([base({ counts: { '2026-10-30': 3, '2026-10-29': 1 } })], [base({ counts: { '2026-10-30': 5 } })]);
    expect(merged[0].counts).toEqual({ '2026-10-30': 5, '2026-10-29': 1 });
  });
});
