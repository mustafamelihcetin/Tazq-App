/**
 * planTaskOps — mod bileşenlerinin paylaştığı plan-görev yardımcıları.
 * modlar.tsx'ten çıkarıldı ki her mod bileşeni (Tez, Mülakat, Spor, Sınav...)
 * aynı offline-first silme + tarih formatlama mantığını tek kaynaktan kullansın.
 */
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { TaskService } from '@/shared/services/api';

/**
 * Bir plan görevini emekliye ayırır: tamamlanmışsa completion journal'a işler,
 * yerelden siler ve offline-first olarak sunucudan siler (çevrimdışı/hatada kuyruğa).
 */
export function retirePlanTask(taskId: number, planMode?: string): void {
  const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
  if (task?.isCompleted) {
    useCompletionStore.getState().record(task.id, task.title, task.completedAt ?? undefined, planMode);
  }
  useTaskStore.getState().removeTask(taskId);
  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
  } else {
    TaskService.deleteTask(taskId).catch((err: any) => {
      if (!err?.response) useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
    });
  }
}

/**
 * MOD BAŞINA GÖREV ETİKETLERİ — tek kaynak.
 *
 * Daha önce yalnızca `usePlanAdaptations.ts` içinde tanımlıydı ve orada UYGULAMA
 * AÇILIŞINDA çalışan "orphan sweep" tarafından kullanılıyordu. Mod KAPATILDIĞI ANDA
 * ise kartlar yalnız ID tabanlı temizlik yapıyordu (`planTaskIds.forEach(retire)`).
 * Bir görev o listeden düşmüşse (offline tempId→realId kayması, başarısız silme,
 * prefs sıfırlanması) ekranda kalıyor ve ancak bir sonraki açılışta siliniyordu.
 * Kullanıcı için görüntü şu: "modu kapattım ama görevi hâlâ duruyor".
 *
 * NOT: 'weight_entry' bilinçli DIŞARIDA (kilo geçmişi korunur); 'daily' modlar arası
 * ortak olduğundan tek başına kullanılmaz — slot etiketleri (exam/spor/…) günlük
 * görevleri zaten kapsar.
 */
export const MODE_TASK_TAGS: Record<string, string[]> = {
  exam: ['exam', 'exam2', 'exam3', 'yks', 'kpss', 'sinav_eve', 'sinav_week', 'sinav_sprint_start', 'sinav_60'],
  tez: ['tez', 'tez_weekly', 'tez_final_2weeks', 'tez_sprint_30', 'tez_60'],
  mulakat: ['mulakat', 'mulakat2', 'mulakat3', 'mulakat_day', 'mulakat_eve', 'mulakat_3days', 'mulakat_week', 'mulakat_2weeks'],
  spor: ['spor', 'spor2', 'spor3', 'kilo', 'maraton', 'guc', 'genel', 'kilo_adapt', 'kilo_measure', 'maraton_taper', 'maraton_race_week', 'maraton_warn', 'maraton_missed', 'maraton_progress', 'guc_deload', 'guc_progress'],
  ramazan: ['ramazan', 'ramazan_kadir'],
  tasarruf: ['tasarruf', 'budget_entry'],
  birakma: ['birakma'],
};

/**
 * Bir modun TÜM görevlerini etikete göre emekliye ayırır — id listesine bakmadan.
 *
 * Mod kapatılırken ÇAĞRILMALI. ID tabanlı temizlik "bildiğimiz" görevleri siler;
 * bu ise "moda ait olan her şeyi" siler. Tamamlanmış görevler de dahildir —
 * `retirePlanTask` onları önce completion journal'a işler, yani istatistik kaybolmaz,
 * sadece aktif listeden kalkar.
 */
export function retireModeTasksByTag(mode: keyof typeof MODE_TASK_TAGS | string): void {
  const tags = MODE_TASK_TAGS[mode];
  if (!tags) return;
  const tagSet = new Set(tags);
  useTaskStore.getState().tasks
    .filter(t => (t.tags ?? []).some(tag => tagSet.has(tag)))
    .forEach(t => retirePlanTask(t.id, mode));
}

/**
 * Bir plan görevini bugüne erteler/aktarır (rollover): hem yerelde hem de
 * offline-first olarak sunucuda tarihini bugünün tarihi yapar.
 */
export function rolloverPlanTask(taskId: number, todayStr: string): void {
  const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
  if (!task) return;

  const updatedPayload = { ...task, dueDate: todayStr };
  
  // Local store güncellemesi
  useTaskStore.getState().updateTask(taskId, { dueDate: todayStr });

  // Server güncellemesi (offline-first)
  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload: updatedPayload });
  } else {
    TaskService.updateTask(taskId, updatedPayload as any).catch((err: any) => {
      if (!err?.response) {
        useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload: updatedPayload });
      }
    });
  }
}


/** Plan tarihini yerelleştirilmiş kısa biçimde formatlar (TR: gg.aa.yyyy, EN: dd MMM yyyy). */
export function formatPlanDate(iso: string | null | undefined, tr: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  return tr
    ? d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Tarih geçmiş mi (gün sonu bazlı, 3 saatlik gece toleransı dahil). */
export function isDatePast(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const adjustedNow = new Date();
  adjustedNow.setHours(adjustedNow.getHours() - 3);
  const targetStr = iso.split('T')[0];
  const adjustedNowStr = `${adjustedNow.getFullYear()}-${String(adjustedNow.getMonth() + 1).padStart(2, '0')}-${String(adjustedNow.getDate()).padStart(2, '0')}`;
  return targetStr < adjustedNowStr;
}

/** Bugünden hedef tarihe kalan gün (3 saatlik gece toleransı dahil, geçmiş/boşsa 0). */
export function daysLeftOf(iso: string | null | undefined): number {
  if (!iso || isDatePast(iso)) return 0;
  const adjustedNow = new Date();
  adjustedNow.setHours(adjustedNow.getHours() - 3);
  adjustedNow.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(iso);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffMs = targetDate.getTime() - adjustedNow.getTime();
  return Math.max(0, Math.ceil(diffMs / 86400000));
}
