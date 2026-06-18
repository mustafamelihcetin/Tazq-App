import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  completedDates: string[]; // 'YYYY-MM-DD'
  createdAt: string;
}

interface HabitState {
  habits: Habit[];
  weeklyGoal: string;
  addHabit: (name: string, emoji: string, color: string) => void;
  removeHabit: (id: string) => void;
  toggleDate: (habitId: string, date: string) => void;
  setWeeklyGoal: (goal: string) => void;
  getStreak: (habit: Habit) => number;
}

export function fmtDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStreak(completedDates: string[]): number {
  if (!completedDates.length) return 0;
  const set = new Set(completedDates);
  let streak = 0;
  const d = new Date();
  // If today not done, start streak count from yesterday
  if (!set.has(fmtDateKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(fmtDateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
    if (streak > 3650) break; // safety
  }
  return streak;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set) => ({
      habits: [],
      weeklyGoal: '',
      addHabit: (name, emoji, color) =>
        set((s) => ({
          habits: [
            ...s.habits,
            {
              id: `habit_${Date.now()}`,
              name,
              emoji,
              color,
              completedDates: [],
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      removeHabit: (id) =>
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
      toggleDate: (habitId, date) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h;
            const has = h.completedDates.includes(date);
            return {
              ...h,
              completedDates: has
                ? h.completedDates.filter((d) => d !== date)
                : [...h.completedDates, date],
            };
          }),
        })),
      setWeeklyGoal: (weeklyGoal) => set({ weeklyGoal }),
      getStreak: (habit) => computeStreak(habit.completedDates),
    }),
    {
      name: 'tazq-habits',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
