import { Task, useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';

export interface BalancerResult {
  isOverwhelmed: boolean;
  overdueTasks: Task[];
  suggestedToMove: Task[];
}

/**
 * Returns the local date string in YYYY-MM-DD format.
 * Fixes timezone shifts caused by using Date.toISOString() which defaults to UTC.
 */
export function getLocalDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function analyzeTaskLoad(tasks: Task[]): BalancerResult {
  const todayStr = getLocalDateString();

  const overdueTasks = tasks.filter((t) => {
    if (t.isCompleted || t.isArchived || !t.dueDate) return false;
    // Eğer dueDate bugünden küçükse (önceki günlerde kalmışsa)
    return t.dueDate < todayStr;
  });

  // Kriter: Dünden sarkan 3 veya daha fazla görev varsa kullanıcı bunalmıştır.
  const isOverwhelmed = overdueTasks.length >= 3;

  // Hangi görevler ertelenebilir?
  // Eskiden sadece High OLMAYANLARI seçiyorduk. Ama eğer kullanıcının tüm
  // gecikmiş görevleri High ise, Dengele butonu hiçbir şey yapmıyordu (0 görev).
  // Kullanıcı "Dengele" tuşuna basıyorsa hepsinden arınmak istiyordur.
  const suggestedToMove = [...overdueTasks];

  return {
    isOverwhelmed,
    overdueTasks,
    suggestedToMove,
  };
}

export async function rescheduleTasks(tasks: Task[], targetDateStr: string) {
  const updateStore = useTaskStore.getState().updateTask;

  for (const task of tasks) {
    // 1. Update local store immediately (Optimistic UI)
    updateStore(task.id, { dueDate: targetDateStr });

    // 2. Sync to server
    try {
      const fullTaskPayload = { ...task, dueDate: targetDateStr };
      await TaskService.updateTask(task.id, fullTaskPayload as any);
    } catch (error: any) {
      swallow('taskBalancer.rescheduleTasks', error, { capture: true });
    }
  }
}

export async function undoRescheduleTasks(originalTasks: Task[]) {
  const updateStore = useTaskStore.getState().updateTask;

  for (const task of originalTasks) {
    if (!task.dueDate) continue;
    // 1. Restore local store
    updateStore(task.id, { dueDate: task.dueDate });

    // 2. Sync to server
    try {
      const fullTaskPayload = { ...task, dueDate: task.dueDate };
      await TaskService.updateTask(task.id, fullTaskPayload as any);
    } catch (error) {
      swallow('taskBalancer.undoRescheduleTasks', error, { capture: true });
    }
  }
}

