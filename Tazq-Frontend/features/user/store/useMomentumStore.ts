import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DayScore { date: string; score: number }

interface MomentumState {
  history: DayScore[];
  momentumShieldActive: boolean;
  shieldCharges: number;
  focusMinutesForNextCharge: number;
  tasksCompletedForNextCharge: number;
  engineHeat: number;
  isOverheated: boolean;
  lastHeatUpdateTime: number;
  lastCompletedTaskTitle: string | null;
  showRocketFeedback: boolean;
  isPerfectSync: boolean;
  consecutiveFastCompletions: number;
  isBatchConfirming: boolean;
  recordScore: (score: number) => void;
  getLastNDays: (n: number) => DayScore[];
  toggleMomentumShield: () => void;
  addFocusMinutes: (mins: number) => void;
  addCompletedTask: () => boolean | void;
  decayEngineHeat: () => void;
  getDecayedHeat: () => { heat: number; isOverheated: boolean };
  triggerRocketFeedback: (title: string, isPerfect?: boolean) => void;
  dismissRocketFeedback: () => void;
  undoCompletedTask: () => void;
}

function getLocalDateString(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const todayISO = () => getLocalDateString();

const cutoffISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return getLocalDateString(d);
};

export const useMomentumStore = create<MomentumState>()(
  persist(
    (set, get) => ({
      history: [],
      momentumShieldActive: false,
      shieldCharges: 2,
      focusMinutesForNextCharge: 0,
      tasksCompletedForNextCharge: 0,
      engineHeat: 0,
      isOverheated: false,
      lastHeatUpdateTime: Date.now(),
      lastCompletedTaskTitle: null,
      showRocketFeedback: false,
      isPerfectSync: false,
      consecutiveFastCompletions: 0,
      isBatchConfirming: false,

      recordScore: (score) => {
        const today = todayISO();
        const prev = get().history;
        const idx = prev.findIndex(h => h.date === today);
        const isNewDay = idx < 0;

        let activeShield = get().momentumShieldActive;
        let charges = get().shieldCharges;

        // If it's a new day and shield is active, consume 1 charge
        if (isNewDay && activeShield) {
          if (charges > 0) {
            charges -= 1;
          }
          if (charges <= 0) {
            activeShield = false;
          }
        }

        let finalScore = score;
        if (activeShield) {
          const lastActive = prev.find(h => h.score >= 0);
          finalScore = lastActive ? Math.max(75, lastActive.score) : 75;
        }

        const updated = idx >= 0
          ? prev.map((h, i) => i === idx ? { date: today, score: finalScore } : h)
          : [...prev, { date: today, score: finalScore }];
        const cutoff = cutoffISO(14);

        set({ 
          history: updated.filter(h => h.date >= cutoff),
          momentumShieldActive: activeShield,
          shieldCharges: charges
        });
      },

      toggleMomentumShield: () => {
        const active = get().momentumShieldActive;
        const charges = get().shieldCharges;
        if (!active && charges <= 0) return; // Prevent activation if no charges left
        set({ momentumShieldActive: !active });
      },

      addFocusMinutes: (mins) => {
        let isLite = false;
        try {
          const { usePrefsStore } = require('../../../modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch {}

        if (isLite) return;

        let { shieldCharges, focusMinutesForNextCharge } = get();
        if (shieldCharges >= 3) return;

        focusMinutesForNextCharge += mins;
        while (focusMinutesForNextCharge >= 60 && shieldCharges < 3) {
          focusMinutesForNextCharge -= 60;
          shieldCharges += 1;
        }

        if (shieldCharges >= 3) {
          focusMinutesForNextCharge = 0;
        }

        set({ shieldCharges, focusMinutesForNextCharge });
      },

      addCompletedTask: () => {
        let isLite = false;
        try {
          const { usePrefsStore } = require('../../../modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch {}

        if (isLite) {
          set({
            engineHeat: 0,
            isOverheated: false,
            lastHeatUpdateTime: Date.now(),
            consecutiveFastCompletions: 0,
            isBatchConfirming: false
          });
          return true;
        }

        let { 
          shieldCharges, 
          tasksCompletedForNextCharge, 
          engineHeat, 
          isOverheated, 
          lastHeatUpdateTime,
          consecutiveFastCompletions,
          isBatchConfirming
        } = get();
        
        // 1. Increment shield energy progress
        if (shieldCharges < 3) {
          tasksCompletedForNextCharge += 1;
          while (tasksCompletedForNextCharge >= 5 && shieldCharges < 3) {
            tasksCompletedForNextCharge -= 5;
            shieldCharges += 1;
          }
          if (shieldCharges >= 3) {
            tasksCompletedForNextCharge = 0;
          }
        }

        // 2. Heat calculations with elapsed cooling decay
        const now = Date.now();
        const elapsedSecs = Math.max(0, (now - lastHeatUpdateTime) / 1000);
        let currentHeat = Math.max(0, engineHeat - elapsedSecs * 1.0);

        // Smart consecutive checkoff logic: completions within 15 seconds of each other
        let nextConsecutiveCount = elapsedSecs < 15 ? consecutiveFastCompletions + 1 : 0;
        let nextBatchConfirming = nextConsecutiveCount >= 2;

        let nextOverheated = isOverheated;
        if (currentHeat < 40) {
          nextOverheated = false;
        }

        let isPerfect = false;
        let heatToAdd = 25;

        if (nextBatchConfirming) {
          heatToAdd = 0;
          isPerfect = false;
        } else {
          if (currentHeat === 0) {
            isPerfect = true;
            heatToAdd = 25;
          } else {
            heatToAdd = 45;
          }
        }

        currentHeat = Math.min(100, currentHeat + heatToAdd);

        if (currentHeat > 85 && !nextBatchConfirming) {
          nextOverheated = true;
          // OVERHEAT PENALTY: Lose all unbanked shield progress
          tasksCompletedForNextCharge = 0;
        }

        set({
          shieldCharges,
          tasksCompletedForNextCharge,
          engineHeat: currentHeat,
          isOverheated: nextOverheated,
          lastHeatUpdateTime: now,
          consecutiveFastCompletions: nextConsecutiveCount,
          isBatchConfirming: nextBatchConfirming
        });

        if (__DEV__) {
          console.log('[MomentumStore] Task Completed:', {
            shieldCharges,
            tasksCompletedForNextCharge,
            engineHeat: currentHeat,
            isOverheated: nextOverheated,
            consecutiveFastCompletions: nextConsecutiveCount,
            isBatchConfirming: nextBatchConfirming,
            isPerfect,
            elapsedSecs
          });
        }

        return isPerfect;
      },

      undoCompletedTask: () => {
        let isLite = false;
        try {
          const { usePrefsStore } = require('../../../modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch {}

        if (isLite) return;

        let { shieldCharges, tasksCompletedForNextCharge, engineHeat, isOverheated, lastHeatUpdateTime } = get();
        
        // Revert shield progress locally (simplistic)
        if (shieldCharges < 3) {
          tasksCompletedForNextCharge -= 1;
          if (tasksCompletedForNextCharge < 0) {
            tasksCompletedForNextCharge = 0;
          }
        }

        const now = Date.now();
        const elapsedSecs = Math.max(0, (now - lastHeatUpdateTime) / 1000);
        let currentHeat = Math.max(0, engineHeat - elapsedSecs * 1.0);
        
        // Revert a flat 35 heat for undo
        currentHeat = Math.max(0, currentHeat - 35);

        let nextOverheated = isOverheated;
        if (currentHeat < 40) {
          nextOverheated = false;
        }

        set({
          tasksCompletedForNextCharge,
          engineHeat: currentHeat,
          isOverheated: nextOverheated,
          lastHeatUpdateTime: now,
          consecutiveFastCompletions: 0,
          isBatchConfirming: false
        });
      },

      decayEngineHeat: () => {
        let isLite = false;
        try {
          const { usePrefsStore } = require('../../../modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch {}

        if (isLite) {
          if (get().engineHeat > 0 || get().isOverheated) {
            set({ engineHeat: 0, isOverheated: false, consecutiveFastCompletions: 0, isBatchConfirming: false });
          }
          return;
        }

        const { engineHeat, isOverheated, lastHeatUpdateTime, consecutiveFastCompletions, isBatchConfirming } = get();
        const now = Date.now();
        const elapsedSecs = Math.max(0, (now - lastHeatUpdateTime) / 1000);
        if (elapsedSecs < 1) return;

        const currentHeat = Math.max(0, engineHeat - elapsedSecs * 1.0);
        let nextOverheated = isOverheated;
        if (currentHeat < 40) {
          nextOverheated = false;
        }

        let nextConsecutiveCount = consecutiveFastCompletions;
        let nextBatchConfirming = isBatchConfirming;
        if (elapsedSecs >= 15) {
          nextConsecutiveCount = 0;
          nextBatchConfirming = false;
        }

        set({
          engineHeat: currentHeat,
          isOverheated: nextOverheated,
          lastHeatUpdateTime: now,
          consecutiveFastCompletions: nextConsecutiveCount,
          isBatchConfirming: nextBatchConfirming
        });
      },

      getDecayedHeat: () => {
        let isLite = false;
        try {
          const { usePrefsStore } = require('../../../modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch {}

        if (isLite) return { heat: 0, isOverheated: false };

        const { engineHeat, isOverheated, lastHeatUpdateTime } = get();
        const now = Date.now();
        const elapsedSecs = Math.max(0, (now - lastHeatUpdateTime) / 1000);
        const currentHeat = Math.max(0, engineHeat - elapsedSecs * 1.0);
        let nextOverheated = isOverheated;
        if (currentHeat < 40) {
          nextOverheated = false;
        }

        return { heat: Math.round(currentHeat), isOverheated: nextOverheated };
      },

      triggerRocketFeedback: (title, isPerfect = false) => {
        set({ lastCompletedTaskTitle: title, showRocketFeedback: true, isPerfectSync: isPerfect });
      },

      dismissRocketFeedback: () => {
        set({ showRocketFeedback: false, isPerfectSync: false });
      },

      getLastNDays: (n) => {
        const hist = get().history;
        return Array.from({ length: n }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (n - 1 - i));
          const date = getLocalDateString(d);
          const found = hist.find(h => h.date === date);
          return { date, score: found?.score ?? -1 };
        });
      },
    }),
    {
      name: 'tazq-momentum-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        history: state.history,
        momentumShieldActive: state.momentumShieldActive,
        shieldCharges: state.shieldCharges,
        engineHeat: state.engineHeat,
        isOverheated: state.isOverheated,
        lastHeatUpdateTime: state.lastHeatUpdateTime,
      }),
    }
  )
);
