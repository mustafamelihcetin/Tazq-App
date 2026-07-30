/**
 * Haftalık kilo tartımı — tek kaynak (single source of truth).
 *
 * Kurallar:
 *  - Tartım 7 GÜNDE BİR alınır (aynı gün/aynı hafta tekrar girilemez).
 *  - Görev listesinde her zaman EN FAZLA 1 açık `weight_entry` görevi olur.
 *  - Bu görev basılınca düz tamamlanmaz; kilo girilmeden onaylanmaz
 *    (tasks ekranı bu yüzden tartım modalını açar, sonra recordWeeklyWeight çağırır).
 *
 * Bu yardımcı; inline kart girişi (modlar), görev-tıklama (tasks) ve plan kurulumu
 * tarafından ortak kullanılır → davranış her yerde tutarlı.
 */
import { useSporStore, getLocalDateString } from '@/features/modes/store/useSporStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { TaskService } from '@/shared/services/api';

const WEEK_MS = 7 * 86400000;

export function isWeightEntryTask(t: { title?: string; tags?: string[] | null } | null | undefined): boolean {
  if (!t) return false;
  return !!t.tags?.includes('weight_entry') || t.title === 'Güncel kilonu gir' || t.title === 'Log current weight';
}

/** Son tartımın üstünden geçen tam gün sayısı (kayıt yoksa null). */
export function daysSinceLastWeight(log: { date: string }[]): number | null {
  if (!log || log.length === 0) return null;
  const last = log.reduce((a, b) => (a.date > b.date ? a : b));
  const lastTime = new Date(last.date + 'T00:00:00').getTime();
  return Math.floor((Date.now() - lastTime) / 86400000);
}

/** 7 gün dolduysa (veya hiç kayıt yoksa) yeni tartım girilebilir. */
export function canLogWeight(log: { date: string }[]): boolean {
  const d = daysSinceLastWeight(log);
  return d === null || d >= 7;
}

/** Bir sonraki tartıma kalan gün (girilebiliyorsa 0). */
export function daysUntilNextWeight(log: { date: string }[]): number {
  const d = daysSinceLastWeight(log);
  if (d === null) return 0;
  return Math.max(0, 7 - d);
}

/** Görev listesindeki TÜM açık (tamamlanmamış) weight_entry görevleri. */
export function findOpenWeightTasks(): number[] {
  return useTaskStore.getState().tasks.filter(x => !x.isCompleted && isWeightEntryTask(x)).map(x => x.id);
}

/** Görev listesindeki açık (tamamlanmamış) weight_entry görevini bulur. */
function findOpenWeightTask(): number | null {
  return findOpenWeightTasks()[0] ?? null;
}

/**
 * Bir görevi tamamlanmış işaretler (offline-first). Kilo görevleri normal toggle
 * yolundan geçmediği için (tasks ekranı onları modal'a yönlendiriyor) tek noktada
 * toplandı — hem modal hem toplu-tamamlama aynı davranışı kullansın.
 */
export function completeTaskOfflineFirst(taskId: number): void {
  const cur = useTaskStore.getState().tasks.find(t => t.id === taskId);
  if (!cur || cur.isCompleted) return;
  useTaskStore.getState().toggleTaskCompletion(taskId);
  const completedAt = new Date().toISOString();
  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: true, completedAt });
  } else {
    TaskService.updateTask(taskId, { isCompleted: true }).catch(err => {
      if (!err?.response) useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: true, completedAt });
    });
  }
}

/**
 * Açık bir haftalık kilo görevi yoksa oluşturur (offline-first).
 * Plan kurulumunda ve tartım sonrası "bir sonraki" görev için kullanılır.
 */
export async function ensureWeeklyWeightTask(dueDate: Date, language: 'tr' | 'en' = 'tr'): Promise<void> {
  if (findOpenWeightTask() != null) return; // zaten açık görev var
  const sporPlanTaskIds = usePrefsStore.getState().sporPlanTaskIds;
  const sporPlanHabitIds = usePrefsStore.getState().sporPlanHabitIds;
  const titleTr = 'Güncel kilonu gir';
  const titleEn = 'Log current weight';
  const payload = {
    title: language === 'tr' ? titleTr : titleEn,
    description: JSON.stringify({ tr: titleTr, en: titleEn }),
    priority: 'Medium' as const,
    dueDate: dueDate.toISOString(),
    isCompleted: false,
    tags: ['weight_entry', 'spor'],
  };
  if (!useNetworkStore.getState().isOnline) {
    const tempId = -Date.now();
    useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
    useTaskStore.getState().addTask({ ...payload, id: tempId } as any);
    usePrefsStore.getState().setPlanIds('spor', sporPlanHabitIds, [...sporPlanTaskIds, tempId]);
    return;
  }
  try {
    const newTask = await TaskService.createTask(payload);
    if (newTask?.id) {
      useTaskStore.getState().addTask(newTask);
      usePrefsStore.getState().setPlanIds('spor', sporPlanHabitIds, [...usePrefsStore.getState().sporPlanTaskIds, newTask.id]);
    }
  } catch { /* sessiz; bir sonraki açılışta motor garanti eder */ }
}

/**
 * Haftalık tartımı kaydeder: kilo geçmişine ekler, AÇIK OLAN TÜM tartım görevlerini
 * tamamlar ve bir sonraki haftalık görevi (+7 gün) planlar. Her yerden çağrılabilir.
 *
 * Neden "tüm açık görevler": tartım bir kez yapıldığında bekleyen her tartım
 * hatırlatıcısının amacı yerine gelmiştir. Eskiden yalnız listedeki İLK açık görev
 * kapatılıyordu; birden fazla açık tartım görevi varsa kullanıcının bastığı görev
 * açık kalıp 7 gün boyunca kapatılamaz hale geliyordu ("kilo kaydedildi ama görev
 * işaretlenmedi" hatası).
 *
 * @param taskId Kullanıcının bastığı görev (varsa) — önce o kapatılır.
 * @returns true = kaydedildi, false = 7 gün dolmadığı için reddedildi.
 */
export async function recordWeeklyWeight(kg: number, language: 'tr' | 'en' = 'tr', taskId?: number | null): Promise<boolean> {
  const log = useSporStore.getState().weightLog;
  if (!canLogWeight(log)) return false;

  useSporStore.getState().addWeightEntry(kg);

  // Açık weight_entry görevlerinin HEPSİNİ tamamla (offline-first); önce basılan görev.
  const openIds = findOpenWeightTasks();
  const ordered = taskId != null && openIds.includes(taskId)
    ? [taskId, ...openIds.filter(id => id !== taskId)]
    : openIds;
  ordered.forEach(completeTaskOfflineFirst);

  // Bir sonraki tartım: +7 gün (sabah 08:00).
  const next = new Date();
  next.setDate(next.getDate() + 7);
  next.setHours(8, 0, 0, 0);
  await ensureWeeklyWeightTask(next, language);
  return true;
}

/**
 * Tartım görevine basıldığında ne yapılmalı?
 *  - 'log'      → tartım vakti geldi, kilo giriş modalını aç.
 *  - 'complete' → kilo bu dönem ZATEN girilmiş; görev bir artık. Doğrudan tamamla.
 *
 * Eskiden ikinci durumda da modal açılıyordu ve modal "7 günde bir girilir" diyerek
 * reddediyordu → görev hiçbir yoldan kapatılamıyordu. Görevin amacı (kilo kaydı)
 * zaten yerine geldiği için artık doğrudan kapatılıyor.
 */
export function weightTaskAction(): 'log' | 'complete' {
  return canLogWeight(useSporStore.getState().weightLog) ? 'log' : 'complete';
}

export { getLocalDateString };
