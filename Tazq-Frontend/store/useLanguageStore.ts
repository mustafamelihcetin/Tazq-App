import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, translations } from '../constants/i18n';

interface LanguageState {
  language: Language;
  t: typeof translations.tr;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'tr', // Default to Turkish as requested
      t: translations.tr,
      setLanguage: (lang) => set({ 
        language: lang, 
        t: translations[lang] 
      }),
    }),
    {
      name: 'tazq-language-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
