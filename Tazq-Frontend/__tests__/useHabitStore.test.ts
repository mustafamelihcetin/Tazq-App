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
});
