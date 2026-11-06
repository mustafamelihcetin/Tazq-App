import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { isNetworkError } from '@/shared/utils/errors';
import { withSomedayResolved, withArchived } from '@/features/tasks/utils/taskTags';
import { cancelTaskNotification } from '@/shared/utils/notifications';
import { swallow } from '@/shared/utils/swallow';
import { cancelCommit, scheduleCommit } from '@/shared/utils/deferredCommit';
import { useToastStore } from '@/shared/store/useToastStore';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
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
  markCompleteLocally(task);
  return sendCompletion(taskId, new Date().toISOString());
}

/** İyimser tamamlama ve plan ilerleyiş kaydı; sunucuya gitmez. */
function markCompleteLocally(task: Task): void {
  useTaskStore.getState().toggleTaskCompletion(task.id);
  // Mod planına ait görevlerin tamamlanması ayrıca kaydediliyor (plan ilerleyişi).
  try {
    const { getModeInfoForTask } = require('@/features/modes/utils/modeHelpers');
    const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
    const { useCompletionStore } = require('@/shared/store/useCompletionStore');
    const prefsState = usePrefsStore.getState();
    if (getModeInfoForTask(task, prefsState, null)) {
      const planMode = task.tags?.find(tag =>
        ['exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3', 'spor', 'spor2', 'spor3', 'ramazan', 'tasarruf', 'birakma'].includes(tag),
      );
      useCompletionStore.getState().record(task.id, task.title, new Date().toISOString(), planMode);
    }
  } catch (e) {
    // Kayıt tutulamazsa tamamlama YİNE geçerli — bu ikincil bir iz.
    swallow('taskActions.recordCompletion', e);
  }
}

async function sendCompletion(taskId: number, completedAt: string): Promise<CompleteResult> {
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

/** İyimser tamamlamayı ve plan kaydını geri sarar (sunucu henüz bir şey duymadı). */
export function revertLocalCompletion(taskId: number): void {
  const store = useTaskStore.getState();
  if (store.tasks.find(t => t.id === taskId)?.isCompleted) store.toggleTaskCompletion(taskId);
  try {
    require('@/shared/store/useCompletionStore').useCompletionStore.getState().removeEvent(taskId);
  } catch (e) { swallow('taskActions.revertCompletion', e); }
}

/**
 * GERİ ALINABİLİR TAMAMLAMA (2026-11-06). Görev hemen biter, sunucuya geri alma süresi dolunca gider.
 * Neden ertelemeli: sunucu tekrarlı görevin sonrakini tamamlanınca yaratıyor; geri alma ona hiç uğramazsa yinelenen görev oluşmaz
 * (Tasks.org aynı sorunu `undoRepeat` ile sonradan onarıyor). Dönen işlev süre geçtiyse false döner, etkisizdir.
 */
export function completeTaskUndoable(taskId: number): (() => boolean) | null {
  const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
  if (!task || task.isCompleted) return null;
  markCompleteLocally(task);
  const completedAt = new Date().toISOString();
  const key = `task:${taskId}`;
  scheduleCommit(key, () => sendCompletion(taskId, completedAt));
  return () => {
    if (!cancelCommit(key)) return false;
    revertLocalCompletion(taskId);
    return true;
  };
}

const DONE_COPY = {
  tr: { done: 'Bitti', next: 'sonraki', undo: 'Geri al', locale: 'tr-TR' },
  en: { done: 'Done', next: 'next', undo: 'Undo', locale: 'en-US' },
};
/** Tasks.org'daki gibi: uzun başlık bildirimi taşırmasın. */
const DONE_TITLE_MAX = 30;

const nextOccurrence = (task: Pick<Task, 'recurrence' | 'dueDate'>): Date | null => {
  if (!task.dueDate || task.dueDate.startsWith('0001')) return null;
  const d = new Date(task.dueDate.length === 10 ? `${task.dueDate}T12:00:00` : task.dueDate);
  if (Number.isNaN(d.getTime())) return null;
  if (task.recurrence === 'Daily') d.setDate(d.getDate() + 1);
  else if (task.recurrence === 'Weekly') d.setDate(d.getDate() + 7);
  else if (task.recurrence === 'Monthly') d.setMonth(d.getMonth() + 1);
  else return null;
  return d;
};

/** "Bitti · Rapor"; tekrarlı görevde "Kira · sonraki 6 Ara": işin bitmediği, ileriye taşındığı görünsün. */
export function doneToastText(task: Pick<Task, 'title' | 'recurrence' | 'dueDate'>, lang: 'tr' | 'en'): string {
  const c = DONE_COPY[lang];
  const title = task.title.length > DONE_TITLE_MAX ? `${task.title.slice(0, DONE_TITLE_MAX - 1).trimEnd()}…` : task.title;
  const next = nextOccurrence(task);
  if (next) return `${title} · ${c.next} ${next.toLocaleDateString(c.locale, { day: 'numeric', month: 'short' })}`;
  return `${c.done} · ${title}`;
}

/** Tamamla ve "Geri al" sun. `points`: bu tamamlamanın verdiği gün kutlaması puanı, geri alınınca düşer. */
export function completeWithUndoToast(taskId: number, lang: 'tr' | 'en', points = 0): void {
  const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
  const undo = completeTaskUndoable(taskId);
  if (!task || !undo) return;
  useToastStore.getState().show(doneToastText(task, lang), 'success', {
    label: DONE_COPY[lang].undo,
    onAction: () => {
      if (undo() && points) useFocusStore.getState().addFocusPoints(-points);
    },
  }, 'bottom');
}

export const undoLabel = (lang: 'tr' | 'en') => DONE_COPY[lang].undo;

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
 * Görevi SUNUCUDAN VE YEREL DEPODAN siler (iyimser + çevrimdışı güvenli).
 *
 * ── NEDEN TEK YOL ──────────────────────────────────────────────────────────────
 * Silme beş ayrı yerde kopyalanmıştı (arşiv ekranı, toplu silme, tamamlananları
 * temizleme, eski-tamamlanmışları otomatik süpürme, tek dokunuşla silme...) ve
 * neredeyse hiçbiri GERÇEK bir sunucu reddini (ağ hatası değil — ör. görev başka
 * bir cihazda zaten silinmiş, 403, 500) ele almıyordu: görev yerelden kaldırılıyor
 * ama sunucuda KALIYOR ve bir sonraki tam getirmede (başka cihaz, yeniden kurulum,
 * çekip-yenileme) sessizce geri geliyordu — kullanıcı "sildim ama geri geldi" diye
 * şaşırıyordu. Tam da bu dosyanın başındaki uyarının anlattığı ayrışma.
 *
 * `completeTask`/`patchTask` ile aynı ilke ama farklı araç: onlarda değişen ALAN
 * eski değerine dönüyor (nesne dizide duruyor). Silmede nesnenin kendisi dizide
 * yok artık — geri koyacak "eski değer" yok. Bunun yerine sunucudan TAZE listeyi
 * çekip mağazayı onunla değiştiriyoruz: görev gerçekten hâlâ sunucudaysa geri
 * döner, gerçekten silinmişse (ör. başka cihaz) yerel durum zaten doğruydu.
 */
export type DeleteResult = 'ok' | 'queued' | 'failed' | 'skipped';

export async function deleteTaskAction(taskId: number): Promise<DeleteResult> {
  const store = useTaskStore.getState();
  if (!store.tasks.some(t => t.id === taskId)) return 'skipped';

  store.removeTask(taskId);

  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
    return 'queued';
  }

  try {
    await TaskService.deleteTask(taskId);
    return 'ok';
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
      return 'queued';
    }
    // Gerçek ret → sunucudan TAZE listeyi çek; kullanıcı silinmemiş bir şeyi
    // silinmiş sanmasın.
    try {
      const freshTasks = await TaskService.getTasks();
      useTaskStore.getState().setTasks(freshTasks);
    } catch (e) { swallow('taskActions.deleteTask.refetchAfterRejection', e, { capture: true }); }
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

  const beforeTags = task.tags;
  const beforeArchived = task.isArchived;
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
      return;
    }
    // Gerçek ret → yalnız değiştirdiğimiz iki alanı geri koy (patchTask ile aynı ilke):
    // kullanıcı arşivlemediği/geri almadığı bir şeyi yapılmış sanmasın.
    useTaskStore.getState().updateTask(taskId, { tags: beforeTags, isArchived: beforeArchived });
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
