import { useEffect, useRef } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { useOfflineQueue } from '../store/useOfflineQueue';
import { TaskService } from '../services/api';
import { useTaskStore } from '../store/useTaskStore';

export function useOfflineSync() {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { ops, dequeue, clear } = useOfflineQueue();
  const isFlushing = useRef(false);

  useEffect(() => {
    if (!isOnline || ops.length === 0 || isFlushing.current) return;

    const flush = async () => {
      isFlushing.current = true;
      let processed = 0;
      for (const op of ops) {
        try {
          if (op.type === 'toggle-task') {
            await TaskService.updateTask(op.id, { isCompleted: op.isCompleted } as any);
          } else if (op.type === 'delete-task') {
            await TaskService.deleteTask(op.id);
            // Only remove from local store if still present (may have already been removed)
          } else if (op.type === 'update-task') {
            await TaskService.updateTask(op.id, op.payload as any);
          } else if (op.type === 'reorder-tasks') {
            // Reorder is best-effort; no dedicated endpoint
          }
          processed++;
        } catch {
          // On failure, stop flushing — will retry next reconnect
          break;
        }
      }
      if (processed > 0) dequeue(processed);
      // After syncing, refresh task list
      if (processed > 0) {
        try {
          const data = await TaskService.getTasks();
          useTaskStore.getState().setTasks(data);
        } catch {}
      }
      isFlushing.current = false;
    };

    flush();
  }, [isOnline]);
}
