import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { isNetworkError } from '@/shared/utils/errors';
import { withSomedayResolved, withArchived } from '@/features/tasks/utils/taskTags';
import { cancelTaskNotification } from '@/shared/utils/notifications';
import type { Task } from '@/features/tasks/store/useTaskStore';

/**
 * GÖREV EYLEMLERİ — tamamlama ve tarih/saat değiştirme, TEK yerde.
 *
 * ── NEDEN ─────────────────────────────────────────────────────────────────────
 * "Görevi tamamla" akışı ana ekranda ve Görevler ekranında ayrı ayrı yazılmıştı ve
 * her ikisi de aynı üç şeyi yapmak zorunda: iyimser güncelleme, mod tamamlama kaydı,
 * çevrimdışıysa kuyruğa alma. Üçüncü bir ekran (Bugün) aynı şeye ihtiyaç duyunca
 * kopyalamak yerine buraya alındı — kopyalar zamanla ayrışır ve ayrışan kopya
 * SESSİZ veri kaybı demektir (ör. biri kuyruğa almayı unutursa çevrimdışı yapılan
 * tamamlama kaybolur).
 *
 * Kutlama, ses ve konfeti burada YOK: onlar ekranın kararı (Sade modda kutlama
 * gösterilmiyor, bkz. celebrate.ts). Burada yalnız VERİ var.
 */

/** Tamamlamanın SONUCU — çağıran kullanıcıya haber vermek isteyebilir. */
export type CompleteResult = 'ok' | 'queued' | 'skipped' | 'failed';

/**
 * Görevi tamamlar (iyimser) ve sunucuya yazar.
 *
 * Çevrimdışıysa kuyruğa alınır ve iyimser tamamlama KORUNUR. Gerçek bir sunucu
 * hatasında (ağ değil) geri alınır — yoksa kullanıcı bitmiş sandığı bir işi bir
 * sonraki açılışta yeniden karşısında bulur.
 *
 * SONUÇ DÖNÜYOR çünkü geri alma SESSİZ olmamalı: toplu tamamlamada beş görevden
 * biri sunucuda başarısız olursa, o satır kendiliğinden geri işaretsizleşiyor ve
 * kullanıcı nedenini bilmiyordu. Dönüş değerini yok sayan çağıranlar etkilenmez.
 */
export async function completeTask(taskId: number): Promise<CompleteResult> {
  const store = useTaskStore.getState();
  const task = store.tasks.find(t => t.id === taskId);
  if (!task || task.isCompleted) return 'skipped';

  store.toggleTaskCompletion(taskId);

  // Mod planına ait görevlerin tamamlanması ayrıca kaydediliyor (plan ilerleyişi).
  try {
    const { getModeInfoForTask } = require('@/features/modes/utils/modeHelpers');
    const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
    const { useCompletionStore } = require('@/features/user/store/useCompletionStore');
    const prefsState = usePrefsStore.getState();
    if (getModeInfoForTask(task, prefsState, null)) {
      const planMode = task.tags?.find(tag =>
        ['exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3', 'spor', 'spor2', 'spor3', 'ramazan', 'tasarruf', 'birakma'].includes(tag),
      );
      useCompletionStore.getState().record(task.id, task.title, new Date().toISOString(), planMode);
    }
  } catch (e) {
    // Kayıt tutulamazsa tamamlama YİNE geçerli — bu ikincil bir iz.
  }

  const completedAt = new Date().toISOString();
  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: true, completedAt });
    return 'queued';
  }

  try {
    await TaskService.updateTask(taskId, { isCompleted: true });
    return 'ok';
  } catch (e: unknown) {
    if (isNetworkError(e)) {
      // Ağ hatası → kuyruğa al, iyimser tamamlamayı KORU.
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: true, completedAt });
      return 'queued';
    }
    // Gerçek sunucu hatası → geri al.
    useTaskStore.getState().toggleTaskCompletion(taskId);
    return 'failed';
  }
}

/**
 * Görevin alanlarını değiştirir — iyimser, çevrimdışı güvenli, sunucu reddederse GERİ ALIR.
 *
 * ── NEDEN TEK YOL ──────────────────────────────────────────────────────────────
 * Tarih değiştirmenin birden fazla yolu vardı ve ikisi ciddi biçimde ayrışmıştı:
 *
 *  · TAZQZen tüm görevin BAYAT bir kopyasını gönderiyordu (hesaplandığı andaki nesne).
 *    Sunucu güncellemede bütün alanları yazıyor (bkz. TaskService.UpdateTaskAsync), yani
 *    o arada yapılan bir değişiklik eski kopyayla eziliyordu.
 *  · Çevrimdışı kuyruğa hiç girmiyordu: taşıma yerelde görünüyor, sonraki eşitlemede
 *    sunucunun eski hâli geri geliyordu.
 *
 * Burada gönderilen yük, değişiklik anında mağazadaki TAZE görevden kuruluyor. Sunucu
 * gerçekten reddederse (ağ hatası değil) değişen alanlar eski değerlerine döner:
 * kullanıcı yapılmamış bir şeyi yapılmış sanmasın.
 *
 * "Belki Bir Gün" kuralı da burada: göreve bir TARİH verildiğinde etiket düşer
 * (bkz. withSomedayResolved). Böylece her tarih değiştirme yolu kuralı kendiliğinden uyar.
 */
export type PatchResult = 'ok' | 'queued' | 'failed' | 'skipped';

export async function patchTask(taskId: number, patch: Partial<Task>): Promise<PatchResult> {
  const store = useTaskStore.getState();
  const before = store.tasks.find(t => t.id === taskId);
  if (!before) return 'skipped';

  const effective: Partial<Task> = { ...patch };
  if (patch.dueDate !== undefined || patch.tags !== undefined) {
    const nextDue = patch.dueDate !== undefined ? patch.dueDate : before.dueDate;
    effective.tags = withSomedayResolved(patch.tags ?? before.tags, nextDue);
  }

  store.updateTask(taskId, effective);

  /*
    İKİ YÜK, İKİ AYRI RİSK:

     · ŞİMDİ gönderilen istek TAM ve TAZE: `before` şu an mağazadan okundu, yani
       bayat değil. Tam gönderilmesinin sebebi `TaskService.updateTask`in birleştirmeyi
       bir try/catch içinde yapması — görev mağazada bulunamazsa kısmi yük olduğu gibi
       gider ve sunucu tüm alanları yazdığı için gerisini SİLER.
     · KUYRUĞA giren yük yalnız DEĞİŞEN alanlar: eşitleme dakikalar sonra olabilir ve
       o arada görev yeniden düzenlenmiş olabilir. Tam kopya o değişikliğin üstüne
       yazardı; kısmi yük eşitleme anındaki güncel görevle birleşir.
  */
  const enqueue = () =>
    useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload: effective });

  if (!useNetworkStore.getState().isOnline) {
    enqueue();
    return 'queued';
  }

  try {
    await TaskService.updateTask(taskId, { ...before, ...effective });
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      enqueue();
      return 'queued';
    }
    // Gerçek ret → yalnız DEĞİŞTİRDİĞİMİZ alanları geri koy.
    const rollback = Object.fromEntries(
      (Object.keys(effective) as (keyof Task)[]).map((key) => [key, before[key]]),
    ) as Partial<Task>;
    useTaskStore.getState().updateTask(taskId, rollback);
    return 'failed';
  }
}

/**
 * Görevin tarihini/saatini değiştirir (iyimser + çevrimdışı güvenli).
 *
 * "Yarına al" ve "bu saate yerleştir" aynı işlemdir: ikisi de görevin ne zaman
 * yapılacağını söyler. Ortak `patchTask` yolundan geçiyor — sunucu reddi artık
 * sessizce yutulmuyor, rafa alınmış göreve tarih verilince etiketi de düşüyor.
 *
 * `dueTime: null` saati KALDIRIR (görev güne ait kalır, saatten çıkar).
 */
export function setTaskDue(
  taskId: number,
  patch: { dueDate?: string; dueTime?: string | null },
): void {
  void patchTask(taskId, patch as Partial<Task>);
}

/**
 * Görevi ARŞİVE alır (silmez).
 *
 * Günü kapatırken "düşür" denen şey budur: iş listeden çıkar ama kaybolmaz. Hızlı
 * verilen bir kararın geri dönüşü olmalı — silme, gününü toparlayan birinin
 * ödeyeceği bir bedel değildir.
 */
export function archiveTask(taskId: number): void {
  setArchived(taskId, true);
}

/** Arşivden geri alır — görev olduğu gibi (tarihi, etiketleri, tekrarı) döner. */
export function restoreTask(taskId: number): void {
  setArchived(taskId, false);
}

/**
 * Arşivin TEK yazım yolu. Hiçbir şey silinmez: yalnız etiket eklenir/çıkarılır.
 * Arşivlenen görevin hatırlatıcısı iptal edilir (görünmeyen işin bildirimi çalmasın);
 * geri alınınca, tarihi hâlâ ilerideyse `_layout` uzlaştırması onu yeniden kurar.
 */
function setArchived(taskId: number, on: boolean): void {
  const store = useTaskStore.getState();
  const task = store.tasks.find(t => t.id === taskId);
  if (!task) return;

  const tags = withArchived(task.tags, on);
  store.updateTask(taskId, { tags, isArchived: on });
  if (on) void cancelTaskNotification(taskId);
  const payload = { ...task, tags, isArchived: on };

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload });
    return;
  }

  TaskService.updateTask(taskId, { tags, isArchived: on }).catch((err: unknown) => {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload });
    }
  });
}

/** Bugünün ve yarının yerel tarihi — saat dilimi kaymasına karşı ELLE kuruluyor. */
export function localDateISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(12, 0, 0, 0); // öğlen: yaz saati geçişlerinde gün kaymaz
  return d.toISOString();
}

/** Bir görevin saatini, verilen saate (0-23) kurar. Tarihi değiştirmez. */
export function timeAtHour(hour: number, base?: string | null): string {
  const d = base ? new Date(base) : new Date();
  if (isNaN(d.getTime())) return timeAtHour(hour, null);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
