/**
 * Otomatik işaretleme ve kilometre taşı: odak eşiği, 7/21/66. tekrar kutlaması, kısa onay.
 */
import { useHabitStore, fmtDateKey, type Habit } from '@/features/habits/store/useHabitStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { autoMarkHabits, celebrateMilestone, focusQualifies, FOCUS_AUTO_MIN } from '@/features/habits/utils/autoMark';

const base = (p: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Okuma', emoji: '📖', color: '#000', completedDates: [], skippedDates: [], createdAt: '2026-09-01T00:00:00.000Z', ...p,
});
const prior = (n: number) => Array.from({ length: n }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);

beforeEach(() => {
  useLanguageStore.setState({ language: 'tr' });
  useHabitStore.setState({ habits: [] });
  useToastStore.setState({ visible: false, message: '' });
});

describe('odak eşiği', () => {
  it('tamamlanan seans ya da en az eşik dakika', () => {
    expect(focusQualifies(3, true)).toBe(true);
    expect(focusQualifies(FOCUS_AUTO_MIN, false)).toBe(true);
    expect(focusQualifies(FOCUS_AUTO_MIN - 1, false)).toBe(false);
  });
});

describe('kilometre taşı', () => {
  it('7. tekrar o gün tamamlandıysa kutlanır', () => {
    const today = fmtDateKey();
    useHabitStore.setState({ habits: [base({ completedDates: [...prior(6), today] })] });
    expect(celebrateMilestone('h1', today)).toBe(7);
    expect(useToastStore.getState().message).toContain('7. tekrar');
  });

  it('sıradan tekrar ya da o gün yapılmamışsa sessiz', () => {
    const today = fmtDateKey();
    useHabitStore.setState({ habits: [base({ completedDates: [...prior(7), today] })] });
    expect(celebrateMilestone('h1', today)).toBeNull();
    useHabitStore.setState({ habits: [base({ completedDates: prior(7) })] });
    expect(celebrateMilestone('h1', today)).toBeNull();
    expect(useToastStore.getState().visible).toBe(false);
  });
});

describe('otomatik işaretleme', () => {
  it('bağlı alışkanlığı işaretler ve kısa onay gösterir', () => {
    useHabitStore.setState({ habits: [base({ autoFrom: 'breath', name: 'Nefes' })] });
    expect(autoMarkHabits('breath')).toEqual(['Nefes']);
    expect(useToastStore.getState().message).toContain('Nefes');
  });

  it('bağlı alışkanlık yoksa hiçbir şey göstermez', () => {
    useHabitStore.setState({ habits: [base()] });
    expect(autoMarkHabits('focus')).toEqual([]);
    expect(useToastStore.getState().visible).toBe(false);
  });
});
