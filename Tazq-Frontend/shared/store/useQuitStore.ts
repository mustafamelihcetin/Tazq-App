import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * useQuitStore — Bırakma modu (ÇOKLU). Kullanıcı aynı anda birden çok şey
 * bırakabilir (sigara + şeker gibi); her biri KENDİ serisiyle takip edilir.
 * Nüks olunca o öğenin serisi bugünden yeniden başlar, en uzun seri korunur.
 */
export type QuitType = '' | 'sigara' | 'sosyal' | 'seker' | 'alkol' | 'kumar' | 'ozel';

export interface QuitItem {
  id: string;
  type: QuitType;
  name: string;          // görünen ad
  start: string;         // 'YYYY-MM-DD' — mevcut temiz serinin başlangıcı
  relapses: string[];    // nüks tarihleri
  bestStreak: number;    // en uzun temiz seri (gün)
}

export interface QuitCloud { at: number; items: QuitItem[] }
const CLOUD_RELAPSES = 30;

interface QuitState {
  items: QuitItem[];
  /** Son değişiklik anı: cihazlar arası hangisi yeni. 0: hiç değişmedi. */
  at: number;
  /** Çıkışta cihazı temizler; "kullanıcı sildi" sayılmaz, girişte yedek geri gelir. */
  clearLocal: () => void;
  cloudSnapshot: () => QuitCloud | null;
  applyCloud: (c: QuitCloud | null | undefined) => void;
  addItem: (type: QuitType, name: string) => void;
  removeItem: (id: string) => void;
  recordRelapse: (id: string) => void;
  reset: () => void;
}

export function quitLocalDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** start'tan bugüne temiz gün sayısı (başlangıç günü dahil = 1). */
export function getCleanDays(start: string | null): number {
  if (!start) return 0;
  const s = new Date(start + 'T00:00:00').getTime();
  return Math.max(0, Math.floor((Date.now() - s) / 86400000)) + 1;
}

export const QUIT_MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365];

export const useQuitStore = create<QuitState>()(
  persist(
    (set, get) => ({
      items: [],
      at: 0,
      addItem: (type, name) => set((s) => {
        // Aynı tür+ad ikinci kez eklenmesin (özel hariç ad bazlı).
        if (s.items.some(i => i.type === type && i.name.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) return s;
        const item: QuitItem = { id: `quit_${type}_${Date.now()}`, type, name, start: quitLocalDate(), relapses: [], bestStreak: 0 };
        return { at: Date.now(), items: [...s.items, item] };
      }),
      removeItem: (id) => set((s) => ({ at: Date.now(), items: s.items.filter(i => i.id !== id) })),
      recordRelapse: (id) => set((s) => ({
        at: Date.now(),
        items: s.items.map(i => {
          if (i.id !== id) return i;
          const current = getCleanDays(i.start);
          return { ...i, relapses: [...i.relapses, quitLocalDate()], bestStreak: Math.max(i.bestStreak, current), start: quitLocalDate() };
        }),
      })),
      reset: () => set({ at: Date.now(), items: [] }),
      clearLocal: () => set({ at: 0, items: [] }),
      cloudSnapshot: () => {
        const s = get();
        if (!s.items.length && !s.at) return null;
        return { at: s.at ?? 0, items: s.items.map(i => ({ ...i, relapses: i.relapses.slice(-CLOUD_RELAPSES) })) };
      },
      applyCloud: (c) => {
        if (!c || !Array.isArray(c.items)) return;
        const s = get();
        const untouched = !s.at && !s.items.length;
        if ((c.at ?? 0) <= (s.at ?? 0) && !untouched) return;
        set({ at: c.at ?? 0, items: c.items });
      },
    }),
    { name: 'quit-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);
