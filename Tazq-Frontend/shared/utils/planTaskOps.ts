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
