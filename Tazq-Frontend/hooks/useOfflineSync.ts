import { useEffect } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { useOfflineQueue } from '../store/useOfflineQueue';
import { useTaskStore } from '../store/useTaskStore';
import { TaskService } from '../services/api';
import { useLanguageStore } from '../store/useLanguageStore';
import { useToastStore } from '../store/useToastStore';

export function useOfflineSync() {
  const isOnline = useNetworkStore(s => s.isOnline);
  
  useEffect(() => {
    if (!isOnline) return;

    const processQueue = async () => {
      const queueState = useOfflineQueue.getState();
      const ops = queueState.ops;
      if (ops.length === 0) return;

      console.log(`[Offline Sync] Starting sync of ${ops.length} items`);
      let processed = 0;
      const idMap = new Map<number, number>(); // Map tempId -> realId

      for (let i = 0; i < ops.length; i++) {
        let op = ops[i];
        try {
          // If a previous operation remapped an ID, update this operation
          if ('id' in op && idMap.has(op.id)) {
            op = { ...op, id: idMap.get(op.id)! } as any;
          }

          if (op.type === 'create-task') {
            const created = await TaskService.createTask((op as any).payload as any);
            idMap.set((op as any).tempId, created.id);
            // Replace tempId with realId in local store
            const tasks = useTaskStore.getState().tasks;
            const updatedTasks = tasks.map(t => t.id === (op as any).tempId ? { ...t, ...created } : t);
            useTaskStore.getState().setTasks(updatedTasks);
          } else if (op.type === 'update-task') {
            await TaskService.updateTask(op.id, op.payload as any);
          } else if (op.type === 'toggle-task') {
            await TaskService.updateTask(op.id, { isCompleted: op.isCompleted } as any);
          } else if (op.type === 'delete-task') {
            await TaskService.deleteTask(op.id);
          }
          // Note: reorder-tasks is not fully implemented in API yet, skipping for now
          
          processed++;
          // Dequeue one by one so if it crashes, remaining ops are saved
          useOfflineQueue.getState().dequeue(1);
        } catch (err: any) {
          // If it's a 404 (Not Found), it means we're trying to update/delete a task that doesn't exist.
          // Safely discard it from the queue.
          if (err.response && err.response.status === 404) {
            console.log(`[Offline Sync] Discarding operation due to 404:`, op);
            useOfflineQueue.getState().dequeue(1);
            processed++;
          } else {
            console.error(`[Offline Sync] Sync failed at item ${i}`, err);
            break; // Stop processing, wait for next online event
          }
        }
      }

      if (processed > 0) {
        console.log(`[Offline Sync] Successfully processed ${processed} operations. Fetching latest tasks...`);
        try {
          const freshTasks = await TaskService.getTasks();
          useTaskStore.getState().setTasks(freshTasks);
        } catch {}

        if (useOfflineQueue.getState().ops.length === 0) {
          const language = useLanguageStore.getState().language;
          useToastStore.getState().show(
            language === 'tr' ? 'Değişiklikler senkronize edildi' : 'Changes synced',
            'success'
          );
        }
      }
    };

    processQueue();
  }, [isOnline]);
}
