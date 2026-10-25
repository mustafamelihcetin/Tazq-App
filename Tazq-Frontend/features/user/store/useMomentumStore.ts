import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swallow } from '@/shared/utils/swallow';

interface DayScore { date: string; score: number }

interface MomentumState {
  history: DayScore[];
  momentumShieldActive: boolean;
  shieldCharges: number;
  focusMinutesForNextCharge: number;
  tasksCompletedForNextCharge: number;
  recordScore: (score: number) => void;
  getLastNDays: (n: number) => DayScore[];
  toggleMomentumShield: () => void;
  addFocusMinutes: (mins: number) => void;
  /** Görev tamamlandı → kalkan ilerlemesi. Kalkan TAM bu tamamlamada kazanıldıysa bildirir. */
  addCompletedTask: () => { shieldEarned: boolean; charges: number };
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
          const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch (e) { swallow('useMomentumStore.addFocusMinutes', e); }

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

      /*
        ── "MOTOR ISISI" KALDIRILDI (2026-10-25) ─────────────────────────────────
        Art arda tamamlanan görevler ısıyı 85'in üstüne çıkarınca o tamamlama MOMENTUMA
        SAYILMIYOR ve biriken kalkan ilerlemesi sıfırlanıyordu; her tamamlamada da jargonlu
        bir "roket" baloncuğu çıkıyordu. Üretken olanı cezalandırıyordu: sabah üç küçük işi
        bitirip art arda işaretleyen puan kaybediyordu. Momentum zaten bir ORAN (bkz.
        shared/utils/momentum.ts) — hızla şişirilemez; ceza gereksiz ve adaletsizdi.
        Kalan tek ödül anlamlı olanı: 5 görevde bir kalkan (dinlenme gününde seriyi korur).
      */
      addCompletedTask: () => {
        let isLite = false;
        try {
          const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch (e) { swallow('useMomentumStore.addCompletedTask', e); }

        let { shieldCharges, tasksCompletedForNextCharge } = get();
        // Sade mod oyunlaştırmayı gizler; kalkan ilerlemesi de işlemez (eski davranış).
        if (isLite || shieldCharges >= 3) return { shieldEarned: false, charges: shieldCharges };

        const before = shieldCharges;
        tasksCompletedForNextCharge += 1;
        while (tasksCompletedForNextCharge >= 5 && shieldCharges < 3) {
          tasksCompletedForNextCharge -= 5;
          shieldCharges += 1;
        }
        if (shieldCharges >= 3) tasksCompletedForNextCharge = 0;

        set({ shieldCharges, tasksCompletedForNextCharge });
        return { shieldEarned: shieldCharges > before, charges: shieldCharges };
      },

      undoCompletedTask: () => {
        let isLite = false;
        try {
          const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch (e) { swallow('useMomentumStore.undoCompletedTask', e); }

        if (isLite) return;

        const { shieldCharges, tasksCompletedForNextCharge } = get();
        // Kalkan ilerlemesini geri al (kazanılmış kalkan geri alınmaz — basit tutuldu).
        if (shieldCharges < 3) set({ tasksCompletedForNextCharge: Math.max(0, tasksCompletedForNextCharge - 1) });
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
      }),
    }
  )
);
