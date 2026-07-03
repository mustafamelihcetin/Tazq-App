import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
const activeAudioPlayers = new Set<any>();

interface FocusState {
  isActive: boolean;
  seconds: number;
  totalSeconds: number;
  pausedSeconds: number | null;
  currentTask: string;
  lastActiveAt: number | null;
  expectedFinishAt: number | null;
  // Daily focus tracking
  dailyFocusMinutes: number;
  dailyFocusDate: string;
  dailyGoalMinutes: number;
  bestStreak: number;
  streakFreezeAvailable: boolean;
  streakFreezeUsedWeek: string;
  // Gamification & Shield updates
  focusPoints: number;
  streakShields: number;
  strictMode: boolean;
  localStreak: number;
  lastCheckedDate: string;
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
  checkStreakFreezeReset: () => void;
  setStrictMode: (strict: boolean) => void;
  addFocusPoints: (pts: number) => void;
  consumeStreakShield: () => boolean;
  incrementLocalStreak: () => void;
}

function getLocalDateString(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const getISODate = () => getLocalDateString();

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
      pausedSeconds: null,
      currentTask: '',
      lastActiveAt: null,
      expectedFinishAt: null,
      dailyFocusMinutes: 0,
      dailyFocusDate: '',
      dailyGoalMinutes: 60,
      bestStreak: 0,
      streakFreezeAvailable: true,
      streakFreezeUsedWeek: '',
      focusPoints: 0,
      streakShields: 1,
      strictMode: false,
      localStreak: 0,
      lastCheckedDate: '',
      pomodoroMode: false,
      pomodoroRound: 1,
      pomodoroPhase: 'work',

      setIsActive: (isActive) => {
        const { seconds } = get();
        set({ 
          isActive, 
          lastActiveAt: isActive ? Date.now() : null,
          expectedFinishAt: isActive ? (Date.now() + seconds * 1000) : null,
          pausedSeconds: isActive ? null : seconds
        });
      },

      setSeconds: (seconds) =>
        set((state) => {
          const nextSeconds = typeof seconds === 'function' ? seconds(state.seconds) : seconds;
          return {
            seconds: nextSeconds,
            expectedFinishAt: state.isActive ? (Date.now() + nextSeconds * 1000) : state.expectedFinishAt
          };
        }),

      setCurrentTask: (currentTask) => set({ currentTask }),

      setDuration: (minutes) => {
        const secs = minutes * 60;
        set({ 
          totalSeconds: secs, 
          seconds: secs, 
          isActive: false, 
          lastActiveAt: null, 
          expectedFinishAt: null,
          pausedSeconds: null
        });
      },

      tick: () => {
        const { isActive, seconds } = get();
        if (isActive && seconds > 0) {
          set({ seconds: seconds - 1 });
        } else if (seconds === 0) {
          set({ isActive: false, lastActiveAt: null, expectedFinishAt: null, pausedSeconds: null });
        }
      },

      reset: () => {
        const { totalSeconds } = get();
        set({ 
          isActive: false, 
          seconds: totalSeconds, 
          currentTask: '',
          lastActiveAt: null,
          expectedFinishAt: null,
          pausedSeconds: null,
          localStreak: 0,
          bestStreak: 0
        });
      },

      rehydrateTimer: () => {
        const { isActive, expectedFinishAt, lastActiveAt, seconds, pausedSeconds } = get();
        let totalSeconds = Math.max(60, get().totalSeconds || 1500);
        
        // Reset if the day changed!
        const { dailyFocusDate } = get();
        const today = getISODate();
        if (dailyFocusDate && dailyFocusDate !== today) {
          set({
            isActive: false,
            seconds: 1500,
            totalSeconds: 1500,
            currentTask: '',
            lastActiveAt: null,
            expectedFinishAt: null,
            pausedSeconds: null
          });
          return;
        }

        if (!isActive) {
          if (pausedSeconds !== null && pausedSeconds !== undefined) {
            const validPaused = Math.max(0, Math.min(totalSeconds, pausedSeconds));
            set({ seconds: validPaused, totalSeconds });
          } else {
            set({ seconds: totalSeconds, totalSeconds });
          }
          return;
        }
        
        let remaining = seconds;
        if (expectedFinishAt) {
          remaining = Math.max(0, Math.floor((expectedFinishAt - Date.now()) / 1000));
        } else if (lastActiveAt) {
          const elapsed = Math.floor((Date.now() - lastActiveAt) / 1000);
          remaining = Math.max(0, seconds - elapsed);
        } else {
          return;
        }

        // Clamp remaining seconds defensively
        remaining = Math.min(totalSeconds, remaining);

        if (remaining === 0) {
          set({ isActive: false, seconds: 0, lastActiveAt: null, expectedFinishAt: null, pausedSeconds: null, totalSeconds });
        } else {
          set({ seconds: remaining, lastActiveAt: null, totalSeconds });
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

        try {
          const { useMomentumStore } = require('../../user/store/useMomentumStore');
          useMomentumStore.getState().addFocusMinutes(mins);
        } catch (e) {
          console.warn("Could not register focus minutes in Momentum Store:", e);
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
        const { streakShields } = get();
        const nextShields = Math.max(0, streakShields - 1);
        set({
          streakShields: nextShields,
          streakFreezeAvailable: nextShields > 0,
          streakFreezeUsedWeek: getISOWeek()
        });
      },

      checkStreakFreezeReset: () => {
        const { streakFreezeUsedWeek, streakShields } = get();
        const currentWeek = getISOWeek();
        if (streakFreezeUsedWeek && streakFreezeUsedWeek !== currentWeek) {
          const nextShields = Math.min(3, streakShields + 1); // grant one shield on new week if used
          set({
            streakShields: nextShields,
            streakFreezeAvailable: nextShields > 0,
            streakFreezeUsedWeek: ''
          });
        }
      },

      setStrictMode: (strictMode) => set({ strictMode }),

      addFocusPoints: (pts) => {
        const { focusPoints, streakShields } = get();
        const nextPoints = focusPoints + pts;
        if (nextPoints >= 100) {
          const addedShields = Math.floor(nextPoints / 100);
          const remainingPoints = nextPoints % 100;
          const nextShields = Math.min(3, streakShields + addedShields);
          
          if (nextShields > streakShields) {
            try {
              const { usePrefsStore } = require('../../../modes/store/usePrefsStore');
              const { soundEffects } = usePrefsStore.getState();
              if (soundEffects) {
                const { createAudioPlayer } = require('expo-audio');
                const p = createAudioPlayer(require('../../../assets/sounds/levelup.mp3'));
                p.volume = 0.85;
                activeAudioPlayers.add(p);
                p.play();
                setTimeout(() => { 
                  try { 
                    p.release(); 
                    activeAudioPlayers.delete(p);
                  } catch {} 
                }, 3000);
              }
            } catch (e) {
              // Ignore sound errors
            }
          }

          set({
            focusPoints: remainingPoints,
            streakShields: nextShields,
            streakFreezeAvailable: nextShields > 0
          });
        } else {
          set({ focusPoints: nextPoints });
        }
      },

      consumeStreakShield: () => {
        const { streakShields } = get();
        if (streakShields > 0) {
          const nextShields = streakShields - 1;
          set({
            streakShields: nextShields,
            streakFreezeAvailable: nextShields > 0
          });
          return true;
        }
        return false;
      },

      incrementLocalStreak: () => {
        const { localStreak, bestStreak } = get();
        const next = localStreak + 1;
        set({
          localStreak: next,
          bestStreak: Math.max(bestStreak, next)
        });
      },
    }),
    {
      name: 'tazq-focus-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: (state) => {
        return (state, error) => {
          if (!error && state) {
            state.rehydrateTimer();
          }
        };
      },
      partialize: (state) => ({
        isActive: state.isActive,
        totalSeconds: state.totalSeconds,
        pausedSeconds: state.pausedSeconds,
        currentTask: state.currentTask,
        lastActiveAt: state.lastActiveAt,
        expectedFinishAt: state.expectedFinishAt,
        dailyFocusMinutes: state.dailyFocusMinutes,
        dailyFocusDate: state.dailyFocusDate,
        dailyGoalMinutes: state.dailyGoalMinutes,
        bestStreak: state.bestStreak,
        streakFreezeAvailable: state.streakFreezeAvailable,
        streakFreezeUsedWeek: state.streakFreezeUsedWeek,
        pomodoroMode: state.pomodoroMode,
        pomodoroRound: state.pomodoroRound,
        pomodoroPhase: state.pomodoroPhase,
        focusPoints: state.focusPoints,
        streakShields: state.streakShields,
        strictMode: state.strictMode,
        localStreak: state.localStreak,
        lastCheckedDate: state.lastCheckedDate,
      }),
    }
  )
);
