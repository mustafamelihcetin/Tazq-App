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
    (set, get) => ({
      language: 'tr',
      // We still keep 't' in the state for easy access, 
      // but we will ensure it stays synced with the language.
      t: translations.tr,
      setLanguage: (lang) => set({ 
        language: lang, 
        t: translations[lang] 
      }),
    }),
    {
      name: 'tazq-language-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // On rehydrate, ensure 't' is updated to the latest translations
      // even if the stored 't' was old.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.t = translations[state.language];
        }
      },
    }
  )
);
