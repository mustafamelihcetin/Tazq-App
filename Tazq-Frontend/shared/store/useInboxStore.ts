import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * GELEN KUTUSU — yalnız "görüldü" bilgisi (kalemlerin kendisi durumdan hesaplanır; bkz. inboxItems.ts).
 * Cihaza özgü: rozet bu cihazda neyin görüldüğünü sayar. Liste en son 200 kimlikle sınırlı (sınırsız büyümesin).
 */
interface InboxState {
  seen: string[];
  markSeen: (ids: string[]) => void;
  /**
   * KALDIRILANLAR (2026-11-01, kullanıcı: "bildirimleri silemiyorum, temizlenebilir ve akıllı olmalı").
   * Kimlikler olayın kendisini taşır (ödeme+vade, destek+yanıt anı, gün), yani kaldırılan uyarı yalnız O olay için
   * gider; yeni vade / yeni yanıt / ertesi gün yeniden gelir. Son 300 kimlik.
   */
  dismissed: string[];
  dismiss: (ids: string[]) => void;
  undismiss: (ids: string[]) => void;
  /** Yalnız admin önizlemesi: kutu her türden ÖRNEK kalemle dolar (bkz. AdminPreviewCard). */
  demo: boolean;
  setDemo: (on: boolean) => void;
}

export const useInboxStore = create<InboxState>()(
  persist(
    (set, get) => ({
      seen: [],
      dismissed: [],
      dismiss: (ids) => set({ dismissed: Array.from(new Set([...get().dismissed, ...ids])).slice(-300) }),
      undismiss: (ids) => set({ dismissed: get().dismissed.filter(id => !ids.includes(id)) }),
      demo: false,
      setDemo: (demo) => set({ demo }),
      markSeen: (ids) => {
        const next = Array.from(new Set([...get().seen, ...ids]));
        set({ seen: next.slice(-200) });
      },
    }),
    { name: 'tazq-inbox', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
