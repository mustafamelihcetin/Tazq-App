import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DayScore { date: string; score: number }

interface MomentumState {
  history: DayScore[];
  momentumShieldActive: boolean;
  recordScore: (score: number) => void;
  getLastNDays: (n: number) => DayScore[];
  toggleMomentumShield: () => void;
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
      momentumShieldActive: false,

      recordScore: (score) => {
        const { momentumShieldActive } = get();
        const today = todayISO();
        const prev = get().history;
        const idx = prev.findIndex(h => h.date === today);
        
        let finalScore = score;
        if (momentumShieldActive) {
          const lastActive = prev.find(h => h.score >= 0);
          finalScore = lastActive ? Math.max(75, lastActive.score) : 75;
        }

        const updated = idx >= 0
          ? prev.map((h, i) => i === idx ? { date: today, score: finalScore } : h)
          : [...prev, { date: today, score: finalScore }];
        const cutoff = cutoffISO(14);
        set({ history: updated.filter(h => h.date >= cutoff) });
      },

      toggleMomentumShield: () => {
        set({ momentumShieldActive: !get().momentumShieldActive });
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
