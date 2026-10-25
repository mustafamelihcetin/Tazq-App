import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { mergeHabits, parseCloudHabits } from '@/features/habits/utils/habitsMerge';
import { swallow } from '@/shared/utils/swallow';

/*
  ALIŞKANLIK EŞİTLEMESİ — durum ve kapılar (2026-10-25).

  Alışkanlıklar yalnız cihazdaydı: çıkışta ya da telefon değişince seriler kayboluyordu.
  Artık sunucuda kullanıcı anahtarıyla şifreli bir kopya var (bkz. Tazq-Backend HabitSyncService).

  ── TEK KURAL: BİRLEŞTİRME BİTMEDEN GÖNDERİM YOK ─────────────────────────────────
  Yeni cihazda yerel liste BOŞ. Giriş anında bulut çekilmeden gönderim yapılsaydı boş liste
  buluttaki yılların geçmişini silerdi. `hydratedFor` yalnız birleştirme BAŞARIYLA bitince
  o kullanıcının kimliğini alır; gönderim yalnız o zaman açılır. Çıkışta (bkz. useAuthStore
  clearLocalUserData) yerel liste silinmeden ÖNCE sıfırlanır — silinen liste gönderilemez.
*/

let hydratedFor: number | null = null;
let inflightHydration: Promise<boolean> | null = null;

type Api = {
  get: () => Promise<{ data: string | null; updatedAt?: string | null }>;
  put: (data: string) => Promise<unknown>;
};

const api = (): Api => require('@/shared/services/api').HabitSyncService;

/** Giriş sonrası: bulutu çek, yereli birleştir, sonuç buluttan farklıysa geri yaz. */
export function hydrateHabits(userId: number): Promise<boolean> {
  if (hydratedFor === userId) return Promise.resolve(true);
  if (inflightHydration) return inflightHydration;
  inflightHydration = (async () => {
    try {
      const res = await api().get();
      const cloud = parseCloudHabits(res?.data) ?? [];
      const local = useHabitStore.getState().habits;
      const merged = mergeHabits(local, cloud);
      if (merged !== local) useHabitStore.getState().setHabits(merged);
      hydratedFor = userId;
      if (JSON.stringify(merged) !== JSON.stringify(cloud)) await api().put(JSON.stringify(merged));
      return true;
    } catch (e) {
      // Çevrimdışı / eski sunucu (404): gönderim kapalı kalır, yerel veri olduğu gibi durur.
      swallow('habitsSync.hydrate', e);
      return false;
    } finally {
      inflightHydration = null;
    }
  })();
  return inflightHydration;
}

/** Yereli buluta yazar — yalnız bu kullanıcı için birleştirme bitmişse. */
export async function pushHabits(userId: number | null | undefined): Promise<boolean> {
  if (userId == null || hydratedFor !== userId) return false;
  try {
    await api().put(JSON.stringify(useHabitStore.getState().habits));
    return true;
  } catch (e) {
    swallow('habitsSync.push', e);
    return false;
  }
}

/** Çıkışta, yerel liste silinmeden ÖNCE: kapıyı kapat. */
export function resetHabitsSync(): void {
  hydratedFor = null;
  inflightHydration = null;
}

export const isHabitsSyncReady = (userId: number | null | undefined) => userId != null && hydratedFor === userId;

/**
 * Çıkış ÖNCESİ son gönderim — son 2,5 sn'lik değişiklik gecikmeli gönderimde bekliyor olabilir.
 * En çok `timeoutMs` beklenir: ağ yoksa çıkış kilitlenmesin.
 */
export async function flushHabitsSync(userId: number | null | undefined, timeoutMs = 3000): Promise<void> {
  if (!isHabitsSyncReady(userId)) return;
  await Promise.race([pushHabits(userId), new Promise((r) => setTimeout(r, timeoutMs))]);
}
