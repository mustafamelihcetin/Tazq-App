import { create } from 'zustand';

interface FocusState {
  isActive: boolean;
  seconds: number;
  currentTask: string;
  setIsActive: (active: boolean) => void;
  setSeconds: (seconds: number | ((s: number) => number)) => void;
  setCurrentTask: (task: string) => void;
}

export const useFocusStore = create<FocusState>((set) => ({
  isActive: false,
  seconds: 2700, // 45 dk
  currentTask: 'Design System Porting',
  
  setIsActive: (isActive) => set({ isActive }),
  setSeconds: (seconds) => set((state) => ({ 
    seconds: typeof seconds === 'function' ? seconds(state.seconds) : seconds 
  })),
  setCurrentTask: (currentTask) => set({ currentTask }),
}));
