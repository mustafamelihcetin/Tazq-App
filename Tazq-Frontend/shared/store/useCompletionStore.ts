import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CompletionEvent {
  id: string;
  taskId: number;
  taskName: string;
  completedAt: string;
  planMode?: string;
}

interface CompletionState {
  events: CompletionEvent[];
  record: (taskId: number, taskName: string, completedAt?: string, planMode?: string) => void;
  getEventsForDate: (dateKey: string) => CompletionEvent[];
  purgeOlderThan: (days: number) => void;
}

export const useCompletionStore = create<CompletionState>()(
  persist(
    (set, get) => ({
      events: [],

      record: (taskId, taskName, completedAt, planMode) => {
        const at = completedAt ?? new Date().toISOString();
        set(s => ({
          events: [
            ...s.events,
            { id: `${taskId}-${Date.now()}`, taskId, taskName, completedAt: at, planMode },
          ],
        }));
      },

      // Deduplicated by taskId — keeps the most recent entry per task per date
      getEventsForDate: (dateKey) => {
        const byDate = get().events.filter(e => e.completedAt.slice(0, 10) === dateKey);
        const seen = new Map<number, CompletionEvent>();
        byDate.forEach(e => {
          const existing = seen.get(e.taskId);
          if (!existing || new Date(e.completedAt) > new Date(existing.completedAt)) {
            seen.set(e.taskId, e);
          }
        });
        return Array.from(seen.values());
      },

      purgeOlderThan: (days) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        set(s => ({ events: s.events.filter(e => new Date(e.completedAt) >= cutoff) }));
      },
    }),
    {
      name: 'tazq-completion-journal',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
