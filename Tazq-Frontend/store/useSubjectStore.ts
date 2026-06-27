import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubjectProgress } from '../utils/curriculum';

/**
 * Konu ilerleme deposu — aralıklı tekrar için "her konu en son ne zaman çalışıldı".
 * Günlük plan motoru bunu okur (sıradaki konuyu seçer) ve görev üretince günceller.
 * Offline-first (yerel persist). Bulut-senkron ileride prefs transport'una eklenebilir.
 */
interface SubjectState {
  progress: Record<string, SubjectProgress>;
  markStudied: (subjectId: string, dateKey: string) => void;
  reset: () => void;
}

export const useSubjectStore = create<SubjectState>()(
  persist(
    (set) => ({
      progress: {},
      markStudied: (subjectId, dateKey) =>
        set((s) => ({ progress: { ...s.progress, [subjectId]: { lastStudied: dateKey } } })),
      reset: () => set({ progress: {} }),
    }),
    {
      name: 'tazq-subject-progress',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
