import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusService } from '@/shared/services/api';
import { httpStatusOf } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';
import type { FocusSessionRow } from './weeklyReport';

/**
 * ODAK GEÇMİŞİ — cihazda SAKLANIR.
 *
 * ── ÖLÇÜLEN SORUN ───────────────────────────────────────────────────────────
 * Haftalık rapor verinin tamamını sunucudan çekiyordu; bağlantı yoksa ekran
 * "Rapor yüklenemedi" deyip boş kalıyordu. Oysa uygulamanın geri kalanı baştan sona
 * çevrimdışı çalışıyor ve kullanıcının geçmişi değişmez bir veri: bir kez indirildi mi
 * tekrar indirilmesi şart değil. Artık son indirilen geçmiş diskte tutuluyor; ekran
 * çevrimdışı da dolu açılıyor, bağlantı gelince sessizce tazeleniyor.
 *
 * Görevler ve alışkanlıklar zaten yerel store'larda; yani rapor için sunucuya bağımlı
 * tek veri bu.
 */

const WINDOW_DAYS = 63; // ~9 hafta: hafta seçiciyle geriye gitmeye yeter, yük küçük

interface FocusHistoryState {
  sessions: FocusSessionRow[];
  lastSyncedAt: number | null;
  loading: boolean;
  /** Hiç veri indirilememişse (ilk açılış + çevrimdışı) ekran bunu söyler. */
  neverLoaded: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const useFocusHistoryStore = create<FocusHistoryState>()(
  persist(
    (set, get) => ({
      sessions: [],
      lastSyncedAt: null,
      loading: false,
      neverLoaded: true,

      refresh: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          const rows = await FocusService.getSessions(WINDOW_DAYS);
          set({
            sessions: rows.map((r) => ({ startedAt: r.startedAt, minutes: r.minutes })),
            lastSyncedAt: Date.now(),
            neverLoaded: false,
          });
        } catch (e: unknown) {
          // 401 oturum yenileme akışının işi; çevrimdışı zaten beklenen durum.
          if (httpStatusOf(e) !== 401) swallow('focusHistory.refresh', e);
        } finally {
          set({ loading: false });
        }
      },

      clear: () => set({ sessions: [], lastSyncedAt: null, neverLoaded: true }),
    }),
    {
      name: 'tazq-focus-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        lastSyncedAt: state.lastSyncedAt,
        neverLoaded: state.neverLoaded,
      }),
    },
  ),
);
