/**
 * Madde 6 — aynı anda en çok 7 aktif alışkanlık (modlarınkiler dahil). Hiçbir şey
 * silinmez: fazlası geri alınabilir biçimde "dinlendirilir" (duraklatılır).
 */
import { HABIT_LIMIT, activeHabits, roomLeft, restSuggestions } from '@/features/habits/utils/habitLimit';
import { useHabitStore } from '@/features/habits/store/useHabitStore';

const h = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, emoji: '', color: '#000', completedDates: [] as string[], createdAt: '2026-01-01', pausedAt: null as string | null, ...extra });

describe('sınır', () => {
  it('7; dinlenenler sayılmaz', () => {
    expect(HABIT_LIMIT).toBe(7);
    const list = [...Array.from({ length: 7 }, (_, i) => h(`a${i}`)), h('p', { pausedAt: '2026-10-01' })];
    expect(activeHabits(list)).toHaveLength(7);
    expect(roomLeft(list)).toBe(0);
  });

  it('pausedAt: null aktif sayılır (dinlendirmeden çıkarılmış)', () => {
    expect(activeHabits([h('x', { pausedAt: null })])).toHaveLength(1);
  });
});

describe('dinlendirme önerisi', () => {
  it('son 14 günde en az yapılan önce; dinlenenler önerilmez', () => {
    const today = new Date(2026, 9, 30);
    const list = [
      h('sık', { completedDates: ['2026-10-29', '2026-10-28', '2026-10-27'] }),
      h('hiç'),
      h('bir', { completedDates: ['2026-10-20'] }),
      h('dinlenen', { pausedAt: '2026-10-01' }),
    ];
    expect(restSuggestions(list, 2, today).map(x => x.id)).toEqual(['hiç', 'bir']);
  });
});

describe('depo: dinlendir / geri al', () => {
  beforeEach(() => useHabitStore.setState({ habits: [h('a', { completedDates: ['2026-10-20'] })] as never }));

  it('dinlendirilen alışkanlık geri alınınca aradaki günler MOLA olur — seri bozulmaz', () => {
    useHabitStore.getState().pauseHabit('a', '2026-10-21');
    expect(useHabitStore.getState().habits[0].pausedAt).toBe('2026-10-21');
    useHabitStore.getState().resumeHabit('a', '2026-10-24');
    const a = useHabitStore.getState().habits[0];
    expect(a.pausedAt).toBeNull(); // null, silinmiş değil: buluttaki eski değer geri gelmesin
    expect(a.skippedDates).toEqual(['2026-10-21', '2026-10-22', '2026-10-23']);
  });
});
