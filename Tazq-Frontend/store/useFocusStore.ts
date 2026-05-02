import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FocusState {
  isActive: boolean;
  seconds: number;
  totalSeconds: number;
  currentTask: string;
  lastActiveAt: number | null;
  // Daily focus tracking
  dailyFocusMinutes: number;
  dailyFocusDate: string;
  dailyGoalMinutes: number;
  bestStreak: number;
  streakFreezeAvailable: boolean;
  streakFreezeUsedWeek: string;
  // Pomodoro
  pomodoroMode: boolean;
  pomodoroRound: number;
  pomodoroPhase: 'work' | 'break';
  // Actions
  setIsActive: (active: boolean) => void;
  setSeconds: (seconds: number | ((s: number) => number)) => void;
  setCurrentTask: (task: string) => void;
  setDuration: (minutes: number) => void;
  tick: () => void;
  reset: () => void;
  rehydrateTimer: () => void;
  addFocusMinutes: (mins: number) => void;
  setDailyGoal: (mins: number) => void;
  updateBestStreak: (current: number) => void;
  togglePomodoroMode: () => void;
  nextPomodoroPhase: () => void;
  useStreakFreeze: () => void;
}

const getISODate = () => new Date().toISOString().split('T')[0];

const getISOWeek = () => {
  const d = new Date();
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      isActive: false,
      seconds: 1500,
      totalSeconds: 1500,
      currentTask: '',
      lastActiveAt: null,
      dailyFocusMinutes: 0,
      dailyFocusDate: '',
      dailyGoalMinutes: 60,
      bestStreak: 0,
      streakFreezeAvailable: true,
      streakFreezeUsedWeek: '',
      pomodoroMode: false,
      pomodoroRound: 1,
      pomodoroPhase: 'work',

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

      addFocusMinutes: (mins) => {
        const { dailyFocusDate, dailyFocusMinutes } = get();
        const today = getISODate();
        if (dailyFocusDate !== today) {
          set({ dailyFocusMinutes: mins, dailyFocusDate: today });
        } else {
          set({ dailyFocusMinutes: dailyFocusMinutes + mins });
        }
      },

      setDailyGoal: (mins) => set({ dailyGoalMinutes: mins }),

      updateBestStreak: (current) => {
        const { bestStreak } = get();
        if (current > bestStreak) {
          set({ bestStreak: current });
        }
      },

      togglePomodoroMode: () => {
        const { pomodoroMode } = get();
        set({ pomodoroMode: !pomodoroMode, pomodoroRound: 1, pomodoroPhase: 'work' });
      },

      nextPomodoroPhase: () => {
        const { pomodoroPhase, pomodoroRound } = get();
        if (pomodoroPhase === 'work') {
          if (pomodoroRound === 4) {
            // Long break after round 4
            set({ pomodoroPhase: 'break', pomodoroRound: 1 });
          } else {
            set({ pomodoroPhase: 'break' });
          }
        } else {
          // break -> work, advance round (unless we just reset from round 4)
          const nextRound = pomodoroRound < 4 ? pomodoroRound + 1 : 1;
          set({ pomodoroPhase: 'work', pomodoroRound: nextRound });
        }
      },

      useStreakFreeze: () => {
        set({ streakFreezeAvailable: false, streakFreezeUsedWeek: getISOWeek() });
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
        dailyFocusMinutes: state.dailyFocusMinutes,
        dailyFocusDate: state.dailyFocusDate,
        dailyGoalMinutes: state.dailyGoalMinutes,
        bestStreak: state.bestStreak,
        streakFreezeAvailable: state.streakFreezeAvailable,
        streakFreezeUsedWeek: state.streakFreezeUsedWeek,
        pomodoroMode: state.pomodoroMode,
        pomodoroRound: state.pomodoroRound,
        pomodoroPhase: state.pomodoroPhase,
      }),
    }
  )
);
