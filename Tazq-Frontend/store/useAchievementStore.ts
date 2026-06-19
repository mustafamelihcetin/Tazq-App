import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Achievement {
  id: string;
  emoji: string;
  titleTr: string;
  titleEn: string;
  subtitleTr: string;
  subtitleEn: string;
}

interface AchievementState {
  unlocked: string[];
  pending: Achievement | null;
  hasUnlocked: (id: string) => boolean;
  trigger: (achievement: Achievement) => void;
  clearPending: () => void;
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlocked: [],
      pending: null,

      hasUnlocked: (id) => get().unlocked.includes(id),

      trigger: (achievement) => {
        const { unlocked, hasUnlocked } = get();
        if (hasUnlocked(achievement.id)) return;
        set({ unlocked: [...unlocked, achievement.id], pending: achievement });
      },

      clearPending: () => set({ pending: null }),
    }),
    {
      name: 'tazq-achievements',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ unlocked: s.unlocked }),
    }
  )
);
