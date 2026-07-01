import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DayScore { date: string; score: number }

interface MomentumState {
  history: DayScore[];
  recordScore: (score: number) => void;
  getLastNDays: (n: number) => DayScore[];
}

function getLocalDateString(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const todayISO = () => getLocalDateString();

const cutoffISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getLocalDateString(d);
};

export const useMomentumStore = create<MomentumState>()(
  persist(
    (set, get) => ({
      history: [],

      recordScore: (score) => {
        const today = todayISO();
        const prev = get().history;
        const idx = prev.findIndex(h => h.date === today);
        const updated = idx >= 0
          ? prev.map((h, i) => i === idx ? { date: today, score } : h)
          : [...prev, { date: today, score }];
        const cutoff = cutoffISO(14);
        set({ history: updated.filter(h => h.date >= cutoff) });
      },

      getLastNDays: (n) => {
        const hist = get().history;
        return Array.from({ length: n }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (n - 1 - i));
          const date = getLocalDateString(d);
          const found = hist.find(h => h.date === date);
          return { date, score: found?.score ?? -1 };
        });
      },
    }),
    {
      name: 'tazq-momentum-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
