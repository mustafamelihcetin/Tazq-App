import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusService } from '@/shared/services/api';
import { httpStatusOf } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';
import type { FocusSessionRow } from './weeklyReport';
import { weekRange } from './weeklyReport';
import { parseDateKey } from '@/shared/utils/dateKey';

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
  /**
   * Veri ESKİ uçtan geldi: yalnız içinde bulunulan hafta doludur, geçmiş haftalar boş
   * görünür. Sunucu güncellenene kadarki geçiş durumu (bkz. refresh).
   */
  usingLegacyFallback: boolean;
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
      usingLegacyFallback: false,

      refresh: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          const rows = await FocusService.getSessions(WINDOW_DAYS);
          set({
            sessions: rows.map((r) => ({ startedAt: r.startedAt, minutes: r.minutes })),
            lastSyncedAt: Date.now(),
            neverLoaded: false,
            usingLegacyFallback: false,
          });
        } catch (e: unknown) {
          // 401 oturum yenileme akışının işi; çevrimdışı zaten beklenen durum.
          if (httpStatusOf(e) !== 401) swallow('focusHistory.refresh', e);
          /*
            ── ESKİ SUNUCU YEDEĞİ ────────────────────────────────────────────────
            Seans geçmişi ucu yeni; sunucu güncellenmeden önce 404 döner. Yedek
            olmasaydı odak dakikaları ana ekranda, Kokpit'te ve Geri Bakış'ta SIFIR
            görünürdü — çalışan bir özelliği bozmak, eklemekten kötüdür.

            Eski uç yalnız İÇİNDE BULUNULAN haftayı ve gün kırılımını UTC'ye göre verir;
            o yüzden bu satırlar haftanın günlerine öğlen damgasıyla dağıtılır ve durum
            `usingLegacyFallback` ile işaretlenir (geçmiş haftalar boş görünecek).
          */
          if (httpStatusOf(e) === 404) {
            try {
              const stats = await FocusService.getStats();
              const days = weekRange(new Date()).days;
              const rows = (stats.weeklyFocus ?? []).slice(0, 7)
                .map((d, i) => ({ minutes: d?.minutes ?? 0, day: days[i] }))
                .filter((d) => d.minutes > 0 && !!d.day)
                .map((d) => {
                  const at = parseDateKey(d.day);
                  at.setHours(12, 0, 0, 0);
                  return { startedAt: at.toISOString(), minutes: d.minutes };
                });
              set({ sessions: rows, lastSyncedAt: Date.now(), neverLoaded: false, usingLegacyFallback: true });
            } catch (inner) { swallow('focusHistory.legacyFallback', inner); }
          }
        } finally {
          set({ loading: false });
        }
      },

      clear: () => set({ sessions: [], lastSyncedAt: null, neverLoaded: true, usingLegacyFallback: false }),
    }),
    {
      name: 'tazq-focus-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        lastSyncedAt: state.lastSyncedAt,
        neverLoaded: state.neverLoaded,
        usingLegacyFallback: state.usingLegacyFallback,
      }),
    },
  ),
);
