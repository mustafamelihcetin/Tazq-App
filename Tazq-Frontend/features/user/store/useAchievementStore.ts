import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Achievement {
  id: string;
  emoji: string;
  titleTr: string;
  titleEn: string;
  subtitleTr: string;
  subtitleEn: string;
}

interface AchievementState {
  unlocked: string[];
  /**
   * Sessiz baseline alındı mı? İlk gözlemde kullanıcının ZATEN hak ettiği eşikler
   * kutlanmadan işaretlenir (eski kullanıcı migrasyonu / yerel hafıza kaybı sonrası
   * "konfeti yağmuru" ve her açılışta tekrar kutlama olmasın). Bulut ile senkronlanır.
   */
  baselined: boolean;
  pending: Achievement | null;
  /** Aynı anda birden çok başarım açılırsa sıraya alınır; biri kapanınca sonraki gösterilir. */
  queue: Achievement[];
  /** Persist rehydrate tamamlandı mı? Değerlendirme bundan önce çalışmamalı (yarış koruması). */
  _hasHydrated: boolean;

  hasUnlocked: (id: string) => boolean;
  trigger: (achievement: Achievement) => void;
  baseline: (earnedIds: string[]) => void;
  applyCloud: (data: { unlocked?: string[]; baselined?: boolean }) => void;
  clearPending: () => void;
  setHasHydrated: (v: boolean) => void;
}

// Başarım durumu nadiren değişir → her değişimde buluta best-effort push.
// require ile lazy: import döngüsü oluşmasın.
function pushCloud() {
  try {
    require('./usePrefsStore').usePrefsStore.getState().syncToCloud();
  } catch {}
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlocked: [],
      baselined: false,
      pending: null,
      queue: [],
      _hasHydrated: false,

      hasUnlocked: (id) => get().unlocked.includes(id),

      trigger: (achievement) => {
        const { unlocked, pending } = get();
        if (unlocked.includes(achievement.id)) return; // idempotent — bir kez
        try { require('@/shared/utils/analytics').track('achievement_unlocked', { id: achievement.id }); } catch {}
        const nextUnlocked = [...unlocked, achievement.id];
        if (pending) {
          // Zaten gösterimde bir kutlama var → sıraya al
          set({ unlocked: nextUnlocked, queue: [...get().queue, achievement] });
        } else {
          set({ unlocked: nextUnlocked, pending: achievement });
        }
        pushCloud();

        // Play level up SFX
        try {
          const { usePrefsStore } = require('../../../modes/store/usePrefsStore');
          const { soundEffects } = usePrefsStore.getState();
          if (soundEffects) {
            const { createAudioPlayer } = require('expo-audio');
            const p = createAudioPlayer(require('../../../assets/sounds/level_up.mp3'));
            p.volume = 0.85;
            p.play();
            setTimeout(() => { try { p.remove(); } catch {} }, 3000);
          }
        } catch (e) {
          // Ignore sound playback errors
        }
      },

      // İlk gözlemde sessiz baseline: hak edilmiş eşikleri kutlamadan kilitle.
      // baselined=true ise no-op (yalnız ilk kez çalışır).
      baseline: (earnedIds) => {
        if (get().baselined) return;
        const merged = Array.from(new Set([...get().unlocked, ...earnedIds]));
        set({ unlocked: merged, baselined: true });
        pushCloud();
      },

      // Buluttan gelen durumu BİRLEŞTİR (union) — hiçbir kazanım kaybolmasın.
      applyCloud: (data) => {
        const cur = get();
        const merged = Array.from(new Set([...cur.unlocked, ...(data.unlocked ?? [])]));
        const changed =
          merged.length !== cur.unlocked.length || (!!data.baselined && !cur.baselined);
        if (!changed) return;
        set({ unlocked: merged, baselined: cur.baselined || !!data.baselined });
      },

      clearPending: () => {
        const { queue } = get();
        if (queue.length) set({ pending: queue[0], queue: queue.slice(1) });
        else set({ pending: null });
      },

      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'tazq-achievements',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ unlocked: s.unlocked, baselined: s.baselined }),
      onRehydrateStorage: () => () => {
        // Hidrasyon bitti (başarılı ya da değil) — kapıyı aç.
        useAchievementStore.getState().setHasHydrated(true);
      },
    }
  )
);
