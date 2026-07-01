import { useHabitStore } from '@/features/habits';

beforeEach(() => useHabitStore.setState({ habits: [] }));

describe('useHabitStore — çift-isim koruması & planMode', () => {
  it('adds a habit', () => {
    useHabitStore.getState().addHabit('Su iç', '💧', '#10B981');
    expect(useHabitStore.getState().habits).toHaveLength(1);
  });

  it('rejects duplicate name (case-insensitive)', () => {
    const { addHabit } = useHabitStore.getState();
    addHabit('Spor', '💪', '#6366F1');
    addHabit('spor', '💪', '#6366F1'); // aynı isim, farklı harf
    addHabit('SPOR ', '💪', '#6366F1'); // boşluk + büyük harf
    expect(useHabitStore.getState().habits).toHaveLength(1);
  });

  it('stores planMode when provided', () => {
    useHabitStore.getState().addHabit('Deneme', '📝', '#3B82F6', 'habit_exam_1_x', 'exam');
    expect(useHabitStore.getState().habits[0].planMode).toBe('exam');
  });

  it('manual habit has no planMode', () => {
    useHabitStore.getState().addHabit('Yürüyüş', '🚶', '#F59E0B');
    expect(useHabitStore.getState().habits[0].planMode).toBeUndefined();
  });

  it('removeHabit removes by id', () => {
    useHabitStore.getState().addHabit('X', '✅', '#10B981', 'h1');
    useHabitStore.getState().removeHabit('h1');
    expect(useHabitStore.getState().habits).toHaveLength(0);
  });

  it('supports toggleSkipDate and computed streak with skipped days', () => {
    const { addHabit, toggleSkipDate, toggleDate, getStreak } = useHabitStore.getState();
    addHabit('Yazılım', '💻', '#10B981', 'h2');
    
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoKey = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`;

    // Mark today as completed, yesterday as skipped, two days ago as completed
    toggleDate('h2', todayKey);
    toggleSkipDate('h2', yesterdayKey);
    toggleDate('h2', twoDaysAgoKey);

    const habit = useHabitStore.getState().habits[0];
    expect(habit.completedDates).toContain(todayKey);
    expect(habit.completedDates).toContain(twoDaysAgoKey);
    expect(habit.skippedDates).toContain(yesterdayKey);

    // Streak should be 2 because the skipped day yesterday acts as a freeze (forgiven/neutral)
    expect(getStreak(habit)).toBe(2);
  });
});
