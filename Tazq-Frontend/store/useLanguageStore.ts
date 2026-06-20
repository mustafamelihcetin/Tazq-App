import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n, { Language, translations, TranslationKeys } from '../constants/i18n';

interface LanguageState {
  language: Language;
  t: TranslationKeys;
  setLanguage: (lang: Language) => void;
  sync: () => void;
}

const getDeviceLanguage = (): Language => {
  try {
    const code = getLocales()[0]?.languageCode ?? 'en';
    return code === 'tr' ? 'tr' : 'en';
  } catch {
    return 'en';
  }
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: getDeviceLanguage(),
      t: translations[getDeviceLanguage()],
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
