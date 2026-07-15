import { useEffect } from 'react';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { TaskService } from '@/shared/services/api';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { swallow } from '@/shared/utils/swallow';
import { httpStatusOf } from '@/shared/utils/errors';

export function useOfflineSync() {
  const isOnline = useNetworkStore(s => s.isOnline);
  
  useEffect(() => {
    if (!isOnline) return;

    const processQueue = async () => {
      const queueState = useOfflineQueue.getState();
      const ops = queueState.ops;
      if (ops.length === 0) return;

      if (__DEV__) console.log(`[Offline Sync] Starting sync of ${ops.length} items`);
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
            const tempId = (op as any).tempId;
            idMap.set(tempId, created.id);
            // Replace tempId with realId in local store
            const tasks = useTaskStore.getState().tasks;
            const updatedTasks = tasks.map(t => t.id === tempId ? { ...t, ...created } : t);
            useTaskStore.getState().setTasks(updatedTasks);
            // Plan görevleri: prefs'teki tempId'yi de gerçek id ile değiştir ki mod
            // kapatma/temizlik artık bırakmasın (offline-first artık-bug'ı kökten çözülür).
            try { usePrefsStore.getState().remapPlanTaskId(tempId, created.id); } catch (e) { swallow('offlineSync.remapPlanTaskId', e, { capture: true }); }
          } else if (op.type === 'update-task') {
            await TaskService.updateTask(op.id, op.payload as any);
          } else if (op.type === 'toggle-task') {
            await TaskService.updateTask(op.id, { isCompleted: op.isCompleted } as any);
          } else if (op.type === 'delete-task') {
            await TaskService.deleteTask(op.id);
          } else if (op.type === 'reorder-tasks') {
            await TaskService.reorderTasks(op.ids);
          }
          
          processed++;
          // Dequeue one by one so if it crashes, remaining ops are saved
          useOfflineQueue.getState().dequeue(1);
        } catch (err: unknown) {
          const status = httpStatusOf(err);
          // 4xx (istemci) hatası → bu op mevcut durumda ASLA geçmez: silinmiş görev (404),
          // başka kullanıcıya ait kayıt (401/403), geçersiz veri (400)... Kuyruğu sonsuza
          // dek kilitlememek için zehirli op'u at ve devam et. Yalnız 5xx/ağ hatasında dur.
          if (status && status >= 400 && status < 500) {
            if (__DEV__) console.log(`[Offline Sync] Discarding op (HTTP ${status}):`, op);
            useOfflineQueue.getState().dequeue(1);
            processed++;
          } else {
            console.error(`[Offline Sync] Sync paused at item ${i} (will retry later)`, err);
            break; // Geçici hata (sunucu/ağ) — dur, bir sonraki çevrimiçi olayında tekrar dene
          }
        }
      }

      if (processed > 0) {
        if (__DEV__) console.log(`[Offline Sync] Successfully processed ${processed} operations. Fetching latest tasks...`);
        try {
          const freshTasks = await TaskService.getTasks();
          useTaskStore.getState().setTasks(freshTasks);
        } catch (e) { swallow('offlineSync.refetchTasksAfterFlush', e, { capture: true }); }

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
