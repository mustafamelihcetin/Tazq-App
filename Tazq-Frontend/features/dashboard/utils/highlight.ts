/**
 * GÜNÜN YILDIZ GÖREVİ (madde 11) — kalabalık bir listede "önce bu" diyen tek iş.
 *
 * Seçim sırası: kullanıcının BUGÜN yıldızladığı görev (hâlâ bekliyorsa) → aktif modun
 * yüksek öncelikli işi → listenin ilki. Seçim güne bağlı: ertesi sabah yeniden önerilir,
 * dünün yıldızı bugünü yönetmez.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HighlightChoice { day: string; id: number }

export function pickHighlight<T extends { id: number; priority?: string }>(
  pending: T[],
  choice: HighlightChoice | null,
  today: string,
  isPlanTask: (t: T) => boolean,
): T | null {
  if (pending.length === 0) return null;
  if (choice && choice.day === today) {
    const chosen = pending.find(t => t.id === choice.id);
    if (chosen) return chosen;
  }
  return pending.find(t => t.priority === 'High' && isPlanTask(t)) ?? pending[0];
}

export const HIGHLIGHT_COPY = {
  tr: { label: 'Günün yıldızı', change: 'değiştir', pickTitle: 'Bugünün yıldızı hangisi?', pickBody: 'Önce bunu bitir; gerisi beklesin.', cancel: 'Vazgeç' },
  en: { label: "Today's star", change: 'change', pickTitle: "Which is today's star?", pickBody: 'Finish this first; the rest can wait.', cancel: 'Cancel' },
};

interface HighlightState { choice: HighlightChoice | null; choose: (id: number, day: string) => void }

/** Cihaza özgü günlük seçim — buluta gitmez (yarın zaten geçersiz). */
export const useHighlightStore = create<HighlightState>()(
  persist(
    (set) => ({ choice: null, choose: (id, day) => set({ choice: { id, day } }) }),
    { name: 'tazq-highlight', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
