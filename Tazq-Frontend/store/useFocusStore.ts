import { create } from 'zustand';

interface FocusState {
  isActive: boolean;
  seconds: number;
  totalSeconds: number;
  currentTask: string;
  setIsActive: (active: boolean) => void;
  setSeconds: (seconds: number | ((s: number) => number)) => void;
  setCurrentTask: (task: string) => void;
  setDuration: (minutes: number) => void;
  tick: () => void;
  reset: () => void;
}

export const useFocusStore = create<FocusState>((set, get) => ({
  isActive: false,
  seconds: 1500,
  totalSeconds: 1500,
  currentTask: '',

  setIsActive: (isActive) => set({ isActive }),
  setSeconds: (seconds) =>
    set((state) => ({
      seconds: typeof seconds === 'function' ? seconds(state.seconds) : seconds,
    })),
  setCurrentTask: (currentTask) => set({ currentTask }),

  setDuration: (minutes) => {
    const secs = minutes * 60;
    set({ totalSeconds: secs, seconds: secs, isActive: false });
  },

  tick: () => {
    const { isActive, seconds } = get();
    if (isActive && seconds > 0) {
      set({ seconds: seconds - 1 });
    } else if (seconds === 0) {
      set({ isActive: false });
    }
  },

  reset: () => {
    const { totalSeconds } = get();
    set({ isActive: false, seconds: totalSeconds });
  },
}));
