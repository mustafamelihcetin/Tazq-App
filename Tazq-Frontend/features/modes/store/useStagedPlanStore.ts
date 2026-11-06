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
  /** Öğe başarıyla oluşturuldu: sıradan düş, bugünü işaretle. Sıradaki yerine göre değil kimliğine göre: paralel çağrı başka öğeyi silmesin. */
  commitAt: (slot: string, entry: StagedPlanEntry, today: string) => void;
  /** Sonuna ekler; bugünün açılım kaydına dokunmaz (günde bir adım kuralı bozulmasın). */
  appendItems: (slot: string, items: StagedPlanEntry[]) => void;
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
      commitAt: (slot, entry, today) => set((s) => {
        const q = s.queues[slot];
        if (!q) return s;
        const wanted = JSON.stringify(entry);
        const index = q.items.findIndex(item => JSON.stringify(item) === wanted);
        const items = index < 0 ? q.items : q.items.filter((_, i) => i !== index);
        return { queues: { ...s.queues, [slot]: { items, lastUnlockDay: today } } };
      }),
      appendItems: (slot, items) => set((s) => {
        const q = s.queues[slot];
        return { queues: { ...s.queues, [slot]: { items: [...(q?.items ?? []), ...items], lastUnlockDay: q?.lastUnlockDay ?? null } } };
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
