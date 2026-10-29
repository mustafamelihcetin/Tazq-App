import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StagedEntry } from '@/features/modes/utils/stagedRollout';

/** Sırada bekleyen görev — açıldığı gün, o günün diliyle oluşturulur. */
export interface StagedTask {
  titleTr: string;
  titleEn: string;
  descTr?: string;
  descEn?: string;
  priority: string;
  /** Çevrilmemiş etiketler — açılırken o anki dile çevrilir. */
  tags: string[];
}

export interface StagedHabit {
  nameTr: string;
  nameEn: string;
  emoji: string;
  color: string;
  modeType: string;
}

export type StagedPlanEntry = StagedEntry<StagedTask, StagedHabit>;

interface Queue { items: StagedPlanEntry[]; lastUnlockDay: string | null }

interface StagedPlanState {
  /** Plan yuvasına göre (exam, exam2, tez, spor…) bekleyen öğeler — bkz. stagedRollout. */
  queues: Record<string, Queue>;
  setQueue: (slot: string, items: StagedPlanEntry[]) => void;
  /** `index`teki öğe başarıyla oluşturuldu: sıradan düş, bugünü işaretle. */
  commitAt: (slot: string, index: number, today: string) => void;
  clear: (slot: string) => void;
  reset: () => void;
}

/*
  AYRI DEPO: tercih deposu zaten dosya boyutu tavanında ve buluta eşitleniyor; bekleyen
  sıra cihaza özgü bir durum. Yeni cihazda sıra yoksa açılım durur, plan bozulmaz
  (mevcut öğeler zaten oluşturulmuş ve eşitlenmiş).
*/
export const useStagedPlanStore = create<StagedPlanState>()(
  persist(
    (set) => ({
      queues: {},
      setQueue: (slot, items) => set((s) => ({ queues: { ...s.queues, [slot]: { items, lastUnlockDay: null } } })),
      commitAt: (slot, index, today) => set((s) => {
        const q = s.queues[slot];
        if (!q) return s;
        return { queues: { ...s.queues, [slot]: { items: q.items.filter((_, i) => i !== index), lastUnlockDay: today } } };
      }),
      clear: (slot) => set((s) => {
        const { [slot]: _gone, ...rest } = s.queues;
        return { queues: rest };
      }),
      reset: () => set({ queues: {} }),
    }),
    { name: 'tazq-staged-plan', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
