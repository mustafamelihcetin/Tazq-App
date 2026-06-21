import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number;
}

export type TargetEvent = '' | '5K' | '10K' | 'Yarı' | 'Tam';

interface SporState {
  currentWeight: string;
  targetWeight: string;
  weeklyKm: string;
  targetEvent: TargetEvent;
  trainingDays: 3 | 4 | 5 | null;
  weightLog: WeightEntry[];
  setCurrentWeight: (v: string) => void;
  setTargetWeight: (v: string) => void;
  setWeeklyKm: (v: string) => void;
  setTargetEvent: (v: TargetEvent) => void;
  setTrainingDays: (v: 3 | 4 | 5 | null) => void;
  addWeightEntry: (weight: number) => void;
  removeWeightEntry: (date: string) => void;
  resetInputs: () => void;
}

export const useSporStore = create<SporState>()(
  persist(
    (set) => ({
      currentWeight: '',
      targetWeight: '',
      weeklyKm: '',
      targetEvent: '',
      trainingDays: null,
      weightLog: [],
      setCurrentWeight: (v) => set({ currentWeight: v }),
      setTargetWeight: (v) => set({ targetWeight: v }),
      setWeeklyKm: (v) => set({ weeklyKm: v }),
      setTargetEvent: (v) => set({ targetEvent: v }),
      setTrainingDays: (v) => set({ trainingDays: v }),
      addWeightEntry: (weight) => set((s) => {
        const today = new Date().toISOString().split('T')[0];
        const filtered = s.weightLog.filter(e => e.date !== today);
        return { weightLog: [...filtered, { date: today, weight }].sort((a, b) => b.date.localeCompare(a.date)) };
      }),
      removeWeightEntry: (date) => set((s) => ({ weightLog: s.weightLog.filter(e => e.date !== date) })),
      resetInputs: () => set({ currentWeight: '', targetWeight: '', weeklyKm: '', targetEvent: '', trainingDays: null }),
    }),
    { name: 'spor-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);

export function getThisWeekEntry(log: WeightEntry[]): WeightEntry | null {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return log.find(e => new Date(e.date) >= monday) ?? null;
}
