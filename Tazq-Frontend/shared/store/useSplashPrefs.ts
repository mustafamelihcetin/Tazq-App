import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AÇILIŞ EKRANI YÖNETİMİ — yalnız süper admin arayüzünden değişir (bkz. SplashAdminCard; 2026-10-31,
 * kullanıcı: "sadece adminlere splash'i tetikleme, görme, yönetme seçenekleri; userlar asla görmeyecek").
 * Değerler BU CİHAZDA geçerli: varsayılanlar (rastgele sürüm, açık) herkes için aynı davranışı verir,
 * kullanıcı arayüzde hiçbir şey görmez.
 *   edition: 'random' | sürüm kimliği (bkz. AnimatedSplash → EDITIONS)
 *   enabled: false → açılış animasyonu atlanır (yalnız hazır olana kadar zemin)
 *   previewNonce: arttıkça açılış hemen yeniden oynatılır (kök düzen dinler; kalıcı değil)
 */
interface SplashPrefs {
  edition: string;
  enabled: boolean;
  previewNonce: number;
  setEdition: (id: string) => void;
  setEnabled: (v: boolean) => void;
  preview: () => void;
}

export const useSplashPrefs = create<SplashPrefs>()(
  persist(
    set => ({
      edition: 'random',
      enabled: true,
      previewNonce: 0,
      setEdition: edition => set({ edition }),
      setEnabled: enabled => set({ enabled }),
      preview: () => set(s => ({ previewNonce: s.previewNonce + 1 })),
    }),
    {
      name: 'tazq-splash-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => ({ edition: s.edition, enabled: s.enabled }),
    },
  ),
);
