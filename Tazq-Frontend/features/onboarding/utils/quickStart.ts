import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { TaskService, type CreateTaskPayload } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';
import { isNetworkError } from '@/shared/utils/errors';

/**
 * İLK GÖREVLERİN TEK YAZMA YOLU — "Aklındakileri yaz" ekranı (bkz. captureFlow.applyCapture).
 *
 * Eskiden burada tanıtımın "neyle uğraşıyorsun" sorusunun iki hızlı başlatıcısı da vardı
 * (Bırakma planı, karşılama görevi). Soru 2026-10-31'de kalktı: işini girişten sonraki yazma
 * ekranının mod önerisi yapıyor. Geriye yalnız misafir ve çevrimdışında da kaybolmayan görev
 * yazımı kaldı.
 */

/*
  ÇEVRİMDIŞI KUYRUĞA DÜŞME KOŞULU: yalnız `!isOnline` DEĞİL, `isNetworkError(e)` de.
  Misafir modunda her istek sunucuya hiç çıkmadan "ağ hatası" biçiminde reddediliyor
  (bkz. shared/services/api.ts → guestModeError; `isNetworkError` bunu `response`
  alanı olmadığı için doğru tanır). Bu kontrol atlanırsa — BirakmaCard/TasarrufCard'taki
  yerel yardımcıların yaptığı gibi — çevrimiçi ama misafir bir kullanıcıda görev ne
  sunucuya yazılır ne yerel listeye eklenir: sessizce kaybolur.
*/
export async function createSeedTask(payload: CreateTaskPayload): Promise<number | null> {
  const queueOffline = () => {
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
    useTaskStore.getState().addTask({ ...payload, id: tempId } as any);
    return tempId;
  };
  if (!useNetworkStore.getState().isOnline) return queueOffline();
  try {
    const created = await TaskService.createTask(payload);
    if (created?.id) { useTaskStore.getState().addTask(created); return created.id; }
  } catch (e) {
    if (isNetworkError(e)) return queueOffline();
    swallow('onboarding.quickStart.createTask', e, { capture: true });
  }
  return null;
}
