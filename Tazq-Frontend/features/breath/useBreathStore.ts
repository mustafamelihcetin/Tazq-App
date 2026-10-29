import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BreathId } from '@/features/breath/patterns';

/**
 * Nefes seansı tercihleri ve geçmişi — cihazda. Seanslar ODAK DAKİKASINA SAYILMAZ
 * (mola ≠ odak kuralı); ayrı tutulur ki ileride haftalık geri bakış "x dk nefes"
 * diyebilsin.
 */
export interface BreathSession { at: string; id: BreathId; sec: number }

interface BreathState {
  sound: boolean;
  lastId: BreathId | null;
  sessions: BreathSession[];
  setSound: (on: boolean) => void;
  setLast: (id: BreathId) => void;
  record: (s: BreathSession) => void;
}

const KEEP = 200;

export const useBreathStore = create<BreathState>()(
  persist(
    (set, get) => ({
      sound: true,
      lastId: null,
      sessions: [],
      setSound: (sound) => set({ sound }),
      setLast: (lastId) => set({ lastId }),
      record: (s) => set({ sessions: [s, ...get().sessions].slice(0, KEEP) }),
    }),
    { name: 'tazq-breath', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
