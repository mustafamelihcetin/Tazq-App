import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number;
}

export type TargetEvent = '' | '5K' | '10K' | 'Yarı' | 'Tam';
export type Gender = '' | 'male' | 'female';

interface SporState {
  currentWeight: string;
  targetWeight: string;
  heightCm: string;
  ageYears: string;
  gender: Gender;
  weeklyKm: string;
  targetEvent: TargetEvent;
  trainingDays: 3 | 4 | 5 | null;
  weightLog: WeightEntry[];
  setCurrentWeight: (v: string) => void;
  setTargetWeight: (v: string) => void;
  setHeightCm: (v: string) => void;
  setAgeYears: (v: string) => void;
  setGender: (v: Gender) => void;
  setWeeklyKm: (v: string) => void;
  setTargetEvent: (v: TargetEvent) => void;
  setTrainingDays: (v: 3 | 4 | 5 | null) => void;
  addWeightEntry: (weight: number) => void;
  removeWeightEntry: (date: string) => void;
  resetInputs: () => void;
}

export function getLocalDateString(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const useSporStore = create<SporState>()(
  persist(
    (set) => ({
      currentWeight: '',
      targetWeight: '',
      heightCm: '',
      ageYears: '',
      gender: '' as Gender,
      weeklyKm: '',
      targetEvent: '',
      trainingDays: null,
      weightLog: [],
      setCurrentWeight: (v) => set({ currentWeight: v }),
      setTargetWeight: (v) => set({ targetWeight: v }),
      setHeightCm: (v) => set({ heightCm: v }),
      setAgeYears: (v) => set({ ageYears: v }),
      setGender: (v) => set({ gender: v }),
      setWeeklyKm: (v) => set({ weeklyKm: v }),
      setTargetEvent: (v) => set({ targetEvent: v }),
      setTrainingDays: (v) => set({ trainingDays: v }),
      addWeightEntry: (weight) => set((s) => {
        const today = getLocalDateString();
        const filtered = s.weightLog.filter(e => e.date !== today);
        return { weightLog: [...filtered, { date: today, weight }].sort((a, b) => b.date.localeCompare(a.date)) };
      }),
      removeWeightEntry: (date) => set((s) => ({ weightLog: s.weightLog.filter(e => e.date !== date) })),
      // Plan kaldırıldığında tüm spor verisi sıfırlanır — kayıtlı kilo geçmişi (weightLog)
      // dahil. Aksi halde plan yeniden açıldığında eski kilo girişleri görünür kalıyordu.
      resetInputs: () => set({
        currentWeight: '', targetWeight: '', heightCm: '', ageYears: '', gender: '' as Gender,
        weeklyKm: '', targetEvent: '', trainingDays: null, weightLog: [],
      }),
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
