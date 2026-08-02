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

/*
  AYNI ANDA TEK AKIŞ — modül düzeyinde, çünkü koruma render'dan uzun yaşamalı.

  Efekt `isOnline` her true olduğunda yeniden koşuyor ve mobil ağlar dalgalanır. Kuyruk
  işlenirken (bir `createTask` cevabı beklenirken) ağ bir kez kesilip gelirse efekt tekrar
  tetikleniyor ve İKİNCİ bir döngü, henüz kuyruktan düşmemiş AYNI anlık görüntüyle
  başlıyordu. İki ayrı hasar üretiyordu:

    • Aynı görev sunucuda İKİ KEZ oluşuyor (create op iki kez gönderiliyor).
    • Her iki döngü de `dequeue(1)` çağırdığı için kuyruktan İKİ işlem düşüyor ama yalnız
      biri işlenmiş oluyor → sıradaki işlem hiç gönderilmeden siliniyor. Sessiz veri kaybı;
      kullanıcı çevrimdışıyken yaptığı bir değişikliğin kaybolduğunu ancak sonra fark eder.

  `useRef` yetmezdi: aynı bileşen yeniden kurulursa ref sıfırlanır. Bayrak modül düzeyinde
  ve `finally` ile bırakılıyor — hata yolunda kilitli kalmaz.
*/
let syncInFlight = false;

export function useOfflineSync() {
  const isOnline = useNetworkStore(s => s.isOnline);

  useEffect(() => {
    if (!isOnline) return;

    const processQueue = async () => {
      if (syncInFlight) return;
      const queueState = useOfflineQueue.getState();
      const ops = queueState.ops;
      if (ops.length === 0) return;
      syncInFlight = true;
      try {

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
            /*
              SIRALAMA DA KİMLİK EŞLEMESİNDEN GEÇMELİ.

              Yukarıdaki eşleme yalnız `op.id` alanına bakıyordu; sıralama işlemi ise
              kimlikleri `ids` DİZİSİNDE taşıyor. Çevrimdışıyken görev oluşturup sıralayan
              kullanıcıda dizi hâlâ geçici (negatif) kimliği içeriyor ve sunucuya o
              gidiyordu: istek 400 dönüyor, "zehirli op" sayılıp atılıyor ve kullanıcının
              yaptığı sıralama sessizce kayboluyordu.

              Çözülemeyen negatif kimlikler diziden düşürülüyor — eksik de olsa geçerli bir
              sıralama, tümden reddedilen bir istekten iyidir.
            */
            const mappedIds = op.ids.map(id => idMap.get(id) ?? id).filter(id => id > 0);
            if (mappedIds.length > 0) await TaskService.reorderTasks(mappedIds);
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
            swallow(`offlineSync.pausedAtItem${i}`, err, { capture: true });
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

      } finally {
        // Beklenmedik bir hata olsa bile bayrak DAİMA bırakılır. Aksi halde kuyruk
        // kalıcı olarak kilitlenir ve kullanıcı bir daha hiç senkron olamazdı —
        // korumanın kendisi, önlediği hatadan büyük bir hataya dönüşürdü.
        syncInFlight = false;
      }
    };

    processQueue();
  }, [isOnline]);
}
