import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  completedDates: string[]; // 'YYYY-MM-DD'
  skippedDates?: string[];   // 'YYYY-MM-DD'
  createdAt: string;
  /**
   * Bu alışkanlık hangi dönemsel moda ait (exam/yks/kpss/tez/mulakat/spor/ramazan)?
   * Mod kapatılınca güvenilir temizlik için kullanılır. Manuel alışkanlıklarda undefined.
   */
  planMode?: string;
  nameTr?: string;
  nameEn?: string;
  /**
   * Faz 0 sağlık entegrasyonu temeli: bu alışkanlık bir sağlık metriğine karşılık geliyorsa
   * etiketlenir (ör. uyku habit'i → 'sleep'). Şu an sadece etiket; ileride Apple Health /
   * Health Connect ile "onaylı asistan" akışı bu etikete bakar. Manuel/diğerlerinde undefined.
   */
  healthMetric?: 'sleep';
}

interface HabitState {
  habits: Habit[];
  weeklyGoal: string;
  addHabit: (name: string, emoji: string, color: string, id?: string, planMode?: string, nameTr?: string, nameEn?: string) => void;
  removeHabit: (id: string) => void;
  toggleDate: (habitId: string, date: string) => void;
  toggleSkipDate: (habitId: string, date: string) => void;
  setWeeklyGoal: (goal: string) => void;
  getStreak: (habit: Habit) => number;
  setHabits: (habits: Habit[]) => void;
}

export function fmtDateKey(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  return `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, '0')}-${String(adjusted.getDate()).padStart(2, '0')}`;
}

function computeStreak(completedDates: string[] | undefined, skippedDates: string[] | undefined): number {
  if (!completedDates?.length) return 0;
  const completedSet = new Set(completedDates);
  const skippedSet = new Set(skippedDates ?? []);
  let streak = 0;
  let d = new Date();
  
  // If today is missed/skipped, check yesterday. If yesterday is also missed/skipped, streak is broken.
  const isTodayActive = completedSet.has(fmtDateKey(d)) || skippedSet.has(fmtDateKey(d));
  if (!isTodayActive) {
    d.setDate(d.getDate() - 1);
    const isYesterdayActive = completedSet.has(fmtDateKey(d)) || skippedSet.has(fmtDateKey(d));
    if (!isYesterdayActive) {
      return 0; // 2 consecutive days missed/skipped -> broken
    }
  }
  
  while (true) {
    if (streak > 3650) break; // safety
    const key = fmtDateKey(d);
    
    if (completedSet.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (skippedSet.has(key)) {
      d.setDate(d.getDate() - 1);
    } else {
      // Missing day (gap). Check if the day before that was completed to forgive this gap.
      const prevD = new Date(d);
      prevD.setDate(prevD.getDate() - 1);
      const prevKey = fmtDateKey(prevD);
      
      if (completedSet.has(prevKey) || skippedSet.has(prevKey)) {
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
    (set, get) => ({
      habits: [],
      weeklyGoal: '',
      setHabits: (habits) => set({ habits }),
      addHabit: (name, emoji, color, id, planMode, nameTr, nameEn) =>
        set((s) => {
          // Çift-isim koruması (büyük/küçük harf duyarsız) — aynı alışkanlık iki kez eklenmez.
          const key = name.trim().toLocaleLowerCase('tr');
          if (s.habits.some(h => h.name.trim().toLocaleLowerCase('tr') === key)) {
            return s;
          }
          // Faz 0: uyku alışkanlığını tek noktada isim/emojiden türet (mod verisini tek tek etiketlemek yerine).
          const isSleep = /uyku|sleep/i.test(`${name} ${nameTr ?? ''} ${nameEn ?? ''}`) || emoji === '😴';
          return {
            habits: [
              ...s.habits,
              {
                id: id ?? `habit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                name,
                emoji,
                color,
                completedDates: [],
                skippedDates: [],
                createdAt: new Date().toISOString(),
                ...(planMode ? { planMode } : {}),
                ...(nameTr ? { nameTr } : {}),
                ...(nameEn ? { nameEn } : {}),
                ...(isSleep ? { healthMetric: 'sleep' as const } : {}),
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
            const skipped = h.skippedDates ?? [];
            const has = dates.includes(date);
            return {
              ...h,
              completedDates: has
                ? dates.filter((d) => d !== date)
                : [...dates, date],
              skippedDates: skipped.filter((d) => d !== date),
            };
          }),
        })),
      toggleSkipDate: (habitId, date) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h;
            const dates = h.completedDates ?? [];
            const skipped = h.skippedDates ?? [];
            const has = skipped.includes(date);
            return {
              ...h,
              skippedDates: has
                ? skipped.filter((d) => d !== date)
                : [...skipped, date],
              completedDates: dates.filter((d) => d !== date),
            };
          }),
        })),
      setWeeklyGoal: (weeklyGoal) => set({ weeklyGoal }),
      getStreak: (habit) => computeStreak(habit.completedDates, habit.skippedDates),
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
            skippedDates: Array.isArray(h.skippedDates) ? h.skippedDates : [],
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
