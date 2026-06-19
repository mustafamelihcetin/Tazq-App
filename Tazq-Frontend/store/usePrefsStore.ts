import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SeasonalPrefs {
  ramazan: boolean;
  examMode: boolean;
}

interface PrefsState {
  seasonal: SeasonalPrefs;
  setSeasonalPref: (key: keyof SeasonalPrefs, value: boolean) => void;
  weeklyNotification: boolean;
  setWeeklyNotification: (value: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      seasonal: { ramazan: false, examMode: false },
      setSeasonalPref: (key, value) =>
        set((s) => ({ seasonal: { ...s.seasonal, [key]: value } })),
      weeklyNotification: true,
      setWeeklyNotification: (value) => set({ weeklyNotification: value }),
    }),
    {
      name: 'tazq-prefs-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
