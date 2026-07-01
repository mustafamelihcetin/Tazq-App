import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OfflineOp =
  | { type: 'toggle-task'; id: number; isCompleted: boolean; completedAt: string | null }
  | { type: 'delete-task'; id: number }
  | { type: 'reorder-tasks'; ids: number[] }
  | { type: 'update-task'; id: number; payload: Record<string, any> }
  | { type: 'create-task'; tempId: number; payload: Record<string, any> };

interface OfflineQueueState {
  ops: OfflineOp[];
  enqueue: (op: OfflineOp) => void;
  dequeue: (count: number) => void;
  clear: () => void;
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      ops: [],
      enqueue: (op) => set({ ops: [...get().ops, op] }),
      dequeue: (count) => set({ ops: get().ops.slice(count) }),
      clear: () => set({ ops: [] }),
    }),
    {
      name: 'tazq-offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
