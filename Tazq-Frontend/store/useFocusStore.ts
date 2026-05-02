import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FocusState {
  isActive: boolean;
  seconds: number;
  totalSeconds: number;
  currentTask: string;
  lastActiveAt: number | null;
  setIsActive: (active: boolean) => void;
  setSeconds: (seconds: number | ((s: number) => number)) => void;
  setCurrentTask: (task: string) => void;
  setDuration: (minutes: number) => void;
  tick: () => void;
  reset: () => void;
  rehydrateTimer: () => void;
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      isActive: false,
      seconds: 1500,
      totalSeconds: 1500,
      currentTask: '',
      lastActiveAt: null,

      setIsActive: (isActive) =>
        set({ isActive, lastActiveAt: isActive ? Date.now() : null }),

      setSeconds: (seconds) =>
        set((state) => ({
          seconds: typeof seconds === 'function' ? seconds(state.seconds) : seconds,
        })),

      setCurrentTask: (currentTask) => set({ currentTask }),

      setDuration: (minutes) => {
        const secs = minutes * 60;
        set({ totalSeconds: secs, seconds: secs, isActive: false, lastActiveAt: null });
      },

      tick: () => {
        const { isActive, seconds } = get();
        if (isActive && seconds > 0) {
          set({ seconds: seconds - 1 });
        } else if (seconds === 0) {
          set({ isActive: false, lastActiveAt: null });
        }
      },

      reset: () => {
        const { totalSeconds } = get();
        set({ isActive: false, seconds: totalSeconds, lastActiveAt: null });
      },

      // Call on app foreground to adjust timer for elapsed time while app was closed
      rehydrateTimer: () => {
        const { isActive, lastActiveAt, seconds } = get();
        if (!isActive || !lastActiveAt) return;
        const elapsed = Math.floor((Date.now() - lastActiveAt) / 1000);
        const remaining = Math.max(0, seconds - elapsed);
        if (remaining === 0) {
          set({ isActive: false, seconds: 0, lastActiveAt: null });
        } else {
          set({ seconds: remaining, lastActiveAt: Date.now() });
        }
      },
    }),
    {
      name: 'tazq-focus-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isActive: state.isActive,
        seconds: state.seconds,
        totalSeconds: state.totalSeconds,
        currentTask: state.currentTask,
        lastActiveAt: state.lastActiveAt,
      }),
    }
  )
);
