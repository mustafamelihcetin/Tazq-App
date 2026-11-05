import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { swallow } from '@/shared/utils/swallow';

/** Görevi her yerden aynı yolla işaretler: yerel, çevrimdışı kuyruk, sunucu. Plan ekranları ve Bugün listesi ayrışmaz. */
export async function setTaskDoneSynced(taskId: number, done: boolean, planMode?: string): Promise<void> {
  const store = useTaskStore.getState();
  const task = store.tasks.find(t => t.id === taskId);
  if (!task || !!task.isCompleted === done) return;
  store.toggleTaskCompletion(taskId);
  if (done) useCompletionStore.getState().record(taskId, task.title, new Date().toISOString(), planMode);
  const enqueue = () => useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: done, completedAt: done ? new Date().toISOString() : null } as never);
  if (!useNetworkStore.getState().isOnline) { enqueue(); return; }
  try {
    await TaskService.updateTask(taskId, { isCompleted: done });
  } catch (e) {
    swallow('tasks.setDoneSynced', e);
    enqueue();
  }
}
