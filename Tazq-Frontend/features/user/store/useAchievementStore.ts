import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swallow } from '@/shared/utils/swallow';
import { playSoundEffect } from '@/shared/utils/soundEffects';

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
   * Kazanma tarihleri (id → epoch ms). YEREL — buluta gönderilmez: tarih "hoş ama kritik değil"
   * bir detaydır, kaynağı `unlocked` listesidir (o senkronlanır). Sessiz baseline ile kilitlenenlerde
   * gerçek tarih bilinmez → giriş olmaz (detayda "✓ Açıldı", tarihsiz gösterilir; dürüst).
   */
  unlockedAt: Record<string, number>;
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
  /**
   * GEÇİCİ KUTLAMA — kutlama katmanını açar ama HİÇBİR ŞEY KALICI YAPMAZ.
   *
   * `trigger` id başına tek seferliktir (`unlocked` listesine yazar) ve doğrusu budur:
   * bir başarım iki kez kazanılmaz. Ama TEKRARLANAN anlar da var — "bugünün hedefini
   * tamamladın" her gün olmalı. Bunu `trigger` ile yapmanın tek yolu id'ye tarih
   * eklemekti (`daily_2026_07_27`); o da `unlocked` dizisini her gün bir eleman
   * şişirir, buluta senkronlar ve profildeki başarım ızgarasını çöple doldururdu.
   *
   * Ayrım kalıcılıkta: `trigger` = kazanılan rozet, `celebrate` = yaşanan an.
   * Tekrarın engellenmesi çağıran tarafın işi (bkz. index.tsx günlük kutlama kapısı).
   */
  celebrate: (achievement: Achievement) => void;
  baseline: (earnedIds: string[]) => void;
  applyCloud: (data: { unlocked?: string[]; baselined?: boolean }) => void;
  clearPending: () => void;
  setHasHydrated: (v: boolean) => void;
}

// Başarım durumu nadiren değişir → her değişimde buluta best-effort push.
// require ile lazy: import döngüsü oluşmasın.
function pushCloud() {
  try {
    require('@/features/modes/store/usePrefsStore').usePrefsStore.getState().syncToCloud();
  } catch (e) { swallow('useAchievementStore.pushCloud', e); }
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlocked: [],
      unlockedAt: {},
      baselined: false,
      pending: null,
      queue: [],
      _hasHydrated: false,

      hasUnlocked: (id) => get().unlocked.includes(id),

      celebrate: (achievement) => {
        // `unlocked`a YAZMAZ, buluta push ETMEZ — yalnız katmanı açar.
        // Gösterimdeki bir kutlama varsa sıraya girer: ikisi üst üste binmesin.
        const { pending, queue } = get();
        if (pending) set({ queue: [...queue, achievement] });
        else set({ pending: achievement });
      },

      trigger: (achievement) => {
        const { unlocked, pending } = get();
        if (unlocked.includes(achievement.id)) return; // idempotent — bir kez
        try { require('@/shared/utils/analytics').track('achievement_unlocked', { id: achievement.id }); } catch (e) { swallow('achievementStore.trackUnlockAnalytics', e); }
        const nextUnlocked = [...unlocked, achievement.id];
        const nextAt = { ...get().unlockedAt, [achievement.id]: Date.now() };
        if (pending) {
          // Zaten gösterimde bir kutlama var → sıraya al
          set({ unlocked: nextUnlocked, unlockedAt: nextAt, queue: [...get().queue, achievement] });
        } else {
          set({ unlocked: nextUnlocked, unlockedAt: nextAt, pending: achievement });
        }
        pushCloud();

        // Play level up SFX
        try {
          const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
          if (usePrefsStore.getState().soundEffects) {
            playSoundEffect(require('../../../assets/sounds/levelup.mp3'), {
              context: 'achievementStore.levelUpSound',
              releaseAfterMs: 3000,
            });
          }
        } catch (e) {
          swallow('achievementStore.readSoundPref', e);
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
      partialize: (s) => ({ unlocked: s.unlocked, unlockedAt: s.unlockedAt, baselined: s.baselined }),
      onRehydrateStorage: () => () => {
        // Hidrasyon bitti (başarılı ya da değil) — kapıyı aç.
        useAchievementStore.getState().setHasHydrated(true);
      },
    }
  )
);
