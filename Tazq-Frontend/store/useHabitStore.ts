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
  /**
   * Bu alışkanlık hangi dönemsel moda ait (exam/yks/kpss/tez/mulakat/spor/ramazan)?
   * Mod kapatılınca güvenilir temizlik için kullanılır. Manuel alışkanlıklarda undefined.
   */
  planMode?: string;
}

interface HabitState {
  habits: Habit[];
  weeklyGoal: string;
  addHabit: (name: string, emoji: string, color: string, id?: string, planMode?: string) => void;
  removeHabit: (id: string) => void;
  toggleDate: (habitId: string, date: string) => void;
  setWeeklyGoal: (goal: string) => void;
  getStreak: (habit: Habit) => number;
}

export function fmtDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStreak(completedDates: string[] | undefined): number {
  if (!completedDates?.length) return 0;
  const set = new Set(completedDates);
  let streak = 0;
  let d = new Date();
  
  // If today is missed, check yesterday. If yesterday is also missed, streak is broken.
  if (!set.has(fmtDateKey(d))) {
    d.setDate(d.getDate() - 1);
    if (!set.has(fmtDateKey(d))) {
      return 0; // 2 consecutive days missed (today & yesterday) -> broken
    }
  }
  
  while (true) {
    if (streak > 3650) break; // safety
    
    if (set.has(fmtDateKey(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      // Missing day (gap). Check if the day before that was completed to forgive this gap.
      const prevD = new Date(d);
      prevD.setDate(prevD.getDate() - 1);
      
      if (set.has(fmtDateKey(prevD))) {
        // Gap forgiven (grace period)
        d.setDate(d.getDate() - 1);
      } else {
        // Two consecutive missed days
        break;
      }
    }
  }
  return streak;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set) => ({
      habits: [],
      weeklyGoal: '',
      addHabit: (name, emoji, color, id, planMode) =>
        set((s) => {
          // Çift-isim koruması (büyük/küçük harf duyarsız) — aynı alışkanlık iki kez eklenmez.
          const key = name.trim().toLocaleLowerCase('tr');
          if (s.habits.some(h => h.name.trim().toLocaleLowerCase('tr') === key)) {
            return s;
          }
          return {
            habits: [
              ...s.habits,
              {
                id: id ?? `habit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                name,
                emoji,
                color,
                completedDates: [],
                createdAt: new Date().toISOString(),
                ...(planMode ? { planMode } : {}),
              },
            ],
          };
        }),
      removeHabit: (id) =>
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
      toggleDate: (habitId, date) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h;
            const dates = h.completedDates ?? [];
            const has = dates.includes(date);
            return {
              ...h,
              completedDates: has
                ? dates.filter((d) => d !== date)
                : [...dates, date],
            };
          }),
        })),
      setWeeklyGoal: (weeklyGoal) => set({ weeklyGoal }),
      getStreak: (habit) => computeStreak(habit.completedDates),
    }),
    {
      name: 'tazq-habits',
      storage: createJSONStorage(() => AsyncStorage),
      // Ensure persisted habits always have completedDates (guards against old data)
      merge: (persisted: any, current) => {
        const raw: any[] = ((persisted as any)?.habits ?? [])
          .filter((h: any) => !!h && !!h.id)
          .map((h: any) => ({
            ...h,
            completedDates: Array.isArray(h.completedDates) ? h.completedDates : [],
            color: h.color ?? '#6366F1',
            emoji: h.emoji ?? '📌',
            name: h.name ?? '',
          }));
        const seen = new Set<string>();
        const habits = raw.filter((h) => {
          if (seen.has(h.id)) return false;
          seen.add(h.id);
          return true;
        });
        return { ...current, ...(persisted as any), habits };
      },
    }
  )
);
