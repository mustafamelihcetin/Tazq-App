import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { Language, translations } from '../constants/i18n';

interface LanguageState {
  language: Language;
  t: typeof translations.tr;
  setLanguage: (lang: Language) => void;
  sync: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'tr',
      t: translations.tr,
      setLanguage: (lang) => {
        i18n.locale = lang;
        set({ 
          language: lang, 
          t: translations[lang] 
        });
      },
      sync: () => {
        const lang = get().language;
        i18n.locale = lang;
      }
    }),
    {
      name: 'tazq-language-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          i18n.locale = state.language;
          state.t = translations[state.language];
        }
      },
    }
  )
);
