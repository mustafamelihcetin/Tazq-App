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
import { useSporStore, getLocalDateString } from '@/shared/store/useSporStore';
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

/** Görev listesindeki açık (tamamlanmamış) weight_entry görevini bulur. */
function findOpenWeightTask(): number | null {
  const t = useTaskStore.getState().tasks.find(x => !x.isCompleted && isWeightEntryTask(x));
  return t?.id ?? null;
}

/**
 * Açık bir haftalık kilo görevi yoksa oluşturur (offline-first).
 * Plan kurulumunda ve tartım sonrası "bir sonraki" görev için kullanılır.
 */
export async function ensureWeeklyWeightTask(dueDate: Date, language: 'tr' | 'en' = 'tr'): Promise<void> {
  if (findOpenWeightTask() != null) return; // zaten açık görev var
  const sporPlanTaskIds = usePrefsStore.getState().sporPlanTaskIds;
  const sporPlanHabitIds = usePrefsStore.getState().sporPlanHabitIds;
  const title = language === 'tr' ? 'Güncel kilonu gir' : 'Log current weight';
  const payload = {
    title,
    description: language === 'tr' ? 'Haftalık tartım — basıp kilonu gir' : 'Weekly weigh-in — tap to log your weight',
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
 * Haftalık tartımı kaydeder: kilo geçmişine ekler, açık görevi tamamlar ve
 * bir sonraki haftalık görevi (+7 gün) planlar. Her yerden çağrılabilir.
 * @returns true = kaydedildi, false = 7 gün dolmadığı için reddedildi.
 */
export async function recordWeeklyWeight(kg: number, language: 'tr' | 'en' = 'tr'): Promise<boolean> {
  const log = useSporStore.getState().weightLog;
  if (!canLogWeight(log)) return false;

  useSporStore.getState().addWeightEntry(kg);

  // Açık weight_entry görevini tamamla (offline-first).
  const openId = findOpenWeightTask();
  if (openId != null) {
    useTaskStore.getState().toggleTaskCompletion(openId);
    if (!useNetworkStore.getState().isOnline) {
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: openId, isCompleted: true, completedAt: new Date().toISOString() });
    } else {
      TaskService.updateTask(openId, { isCompleted: true }).catch(err => {
        if (!err?.response) useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: openId, isCompleted: true, completedAt: new Date().toISOString() });
      });
    }
  }

  // Bir sonraki tartım: +7 gün (sabah 08:00).
  const next = new Date();
  next.setDate(next.getDate() + 7);
  next.setHours(8, 0, 0, 0);
  await ensureWeeklyWeightTask(next, language);
  return true;
}

export { getLocalDateString };
