import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorSchemeName } from 'react-native';
import { DEFAULT_ACCENT, type AccentId } from '@/shared/constants/Colors';

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  /** Vurgu rengi (bkz. Colors.ts → AccentPalettes) — kullanıcının seçimi; varsayılan marka mavisi. */
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light', // ilk yüklemede açık tema (kullanıcı kararı 2026-10-26); kayıtlı tercih korunur
      setTheme: (theme) => set({ theme }),
      accent: DEFAULT_ACCENT,
      setAccent: (accent) => set({ accent }),
    }),
    {
      name: 'tazq-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
