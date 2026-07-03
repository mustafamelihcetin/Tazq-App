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
  recordScore: (score: number) => void;
  getLastNDays: (n: number) => DayScore[];
  toggleMomentumShield: () => void;
  addFocusMinutes: (mins: number) => void;
  addCompletedTask: () => void;
  decayEngineHeat: () => void;
  getDecayedHeat: () => { heat: number; isOverheated: boolean };
  triggerRocketFeedback: (title: string) => void;
  dismissRocketFeedback: () => void;
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
            lastHeatUpdateTime: Date.now()
          });
          return;
        }

        let { shieldCharges, tasksCompletedForNextCharge, engineHeat, isOverheated, lastHeatUpdateTime } = get();
        
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
        let currentHeat = Math.max(0, engineHeat - elapsedSecs * 1.5);
        currentHeat = Math.min(100, currentHeat + 35);

        let nextOverheated = isOverheated;
        if (currentHeat > 80) {
          nextOverheated = true;
        } else if (currentHeat < 30) {
          nextOverheated = false;
        }

        set({
          shieldCharges,
          tasksCompletedForNextCharge,
          engineHeat: currentHeat,
          isOverheated: nextOverheated,
          lastHeatUpdateTime: now
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
            set({ engineHeat: 0, isOverheated: false });
          }
          return;
        }

        const { engineHeat, isOverheated, lastHeatUpdateTime } = get();
        const now = Date.now();
        const elapsedSecs = Math.max(0, (now - lastHeatUpdateTime) / 1000);
        if (elapsedSecs < 1) return;

        const currentHeat = Math.max(0, engineHeat - elapsedSecs * 1.5);
        let nextOverheated = isOverheated;
        if (currentHeat < 30) {
          nextOverheated = false;
        }

        set({
          engineHeat: currentHeat,
          isOverheated: nextOverheated,
          lastHeatUpdateTime: now
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
        const currentHeat = Math.max(0, engineHeat - elapsedSecs * 1.5);
        let nextOverheated = isOverheated;
        if (currentHeat < 30) {
          nextOverheated = false;
        }

        return { heat: Math.round(currentHeat), isOverheated: nextOverheated };
      },

      triggerRocketFeedback: (title) => {
        set({ lastCompletedTaskTitle: title, showRocketFeedback: true });
      },

      dismissRocketFeedback: () => {
        set({ showRocketFeedback: false });
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
    }
  )
);
