import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useTaskStore, type Task } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { TaskService } from '@/shared/services/api';
import { completeTaskOfflineFirst } from '@/features/modes/utils/weightCheckin';
import { ActivityHealth } from '@/shared/services/activityHealth';
import { classifyMovementTask, isMovementGoalMet, type MovementKind } from '@/shared/utils/activityMatch';
import { fmtDateKey } from '@/features/habits/store/useHabitStore';
import { swallow } from '@/shared/utils/swallow';

/**
 * HAREKET GÖREVLERİ SENKRONU — yürüyüş/koşu/antrenman görevlerini sağlık verisiyle kapatır.
 *
 * Kullanıcı koştuktan sonra bir de uygulamaya girip kutuyu işaretlemek zorunda kalıyordu;
 * telefon zaten koştuğunu biliyor. Uyku senkronuyla aynı "onaylı asistan" sözleşmesi:
 * kullanıcı açıkça bağlamadıkça hiçbir şey olmaz, otomatik işaretlenen her şey geri
 * alınabilir ve hedef tutmadıysa BAŞARISIZ DAMGASI VURULMAZ (sessiz kalır).
 *
 * ── SESSİZLİK, UYKUDAN FARKLI OLARAK ────────────────────────────────────────────
 * Uyku senkronu hedef tutmayınca "Dün gece 5s · hedef 7s" diye nazik bir bilgi gösteriyor.
 * Burada o YOK. Sebebi: uyku günde bir kez olan tek bir olay, hareket ise gün boyu
 * birikiyor. "Bugün 4200 adım · hedef 8000" bildirimi öğlen doğru, akşam yanlış olurdu ve
 * kullanıcı gün içinde birkaç kez aynı eksikle karşılaşırdı. Yapılmamış bir işi hatırlatmak
 * ile suçlamak arasındaki çizgi burada çok ince; sessiz kalmayı seçtik.
 *
 * ── YALNIZCA PLAN GÖREVLERİ ─────────────────────────────────────────────────────
 * `daily` etiketi olmayan görevlere DOKUNULMAZ. Kullanıcının kendi yazdığı "koşuya çık"
 * görevini otomatik kapatmak fazla ileri giderdi: o görevin ne anlama geldiğini yalnız
 * kendisi bilir (belki maratonun 30. km'si, belki mahalle turu). Dönemsel mod görevleri
 * ise bizim ürettiğimiz, eşiği bilinen görevler — yalnız onlar hakkında konuşabiliriz.
 */

/** Aynı anda iki tur çalışmasın; ayrıca gün içinde tekrar denemeler için kısa aralık. */
const RETRY_THROTTLE_MS = 30 * 60 * 1000;

/**
 * Görevin iki dildeki başlığını birleştirir.
 *
 * Plan görevleri `description` alanında `{"tr": "...", "en": "..."}` taşıyor. Yalnız
 * görünen başlığa bakmak, kullanıcı dili değiştirdiğinde eşleşmeyi bozardı: görev TR
 * oluşturulup kullanıcı İngilizce'ye geçtiğinde başlık TR kalıyor. İkisini birden
 * vermek her iki durumu da çözüyor.
 */
export function movementTextOf(task: Pick<Task, 'title' | 'description'>): string {
  let extra = '';
  try {
    const d = JSON.parse(task.description || '{}');
    if (d && typeof d === 'object') extra = `${d.tr ?? ''} ${d.en ?? ''}`;
  } catch { /* düz metin açıklama — başlık zaten var */ }
  return `${task.title ?? ''} ${extra}`.trim();
}

/** Bugüne ait, açık, plan kaynaklı hareket görevlerini bulur. */
export function findOpenMovementTasks(tasks: Task[], todayKey: string): Array<{ id: number; kind: MovementKind }> {
  const out: Array<{ id: number; kind: MovementKind }> = [];
  for (const t of tasks) {
    if (t.isCompleted) continue;
    if (!(t.tags ?? []).includes('daily')) continue; // yalnız plan görevleri
    if (!t.dueDate || fmtDateKey(new Date(t.dueDate)) !== todayKey) continue;
    const kind = classifyMovementTask(movementTextOf(t));
    if (kind) out.push({ id: t.id, kind });
  }
  return out;
}

/** Otomatik tamamlamayı geri alır — offline-first, `completeTaskOfflineFirst`in aynası. */
function undoCompleteOfflineFirst(taskId: number): void {
  const cur = useTaskStore.getState().tasks.find((t) => t.id === taskId);
  if (!cur || !cur.isCompleted) return;
  useTaskStore.getState().toggleTaskCompletion(taskId);
  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: false, completedAt: null });
  } else {
    // Sunucu bir yanıt DÖNDÜYSE (4xx/5xx) kuyruğa alma: istek ulaştı, tekrarı çakışma
    // yaratır. Yalnızca yanıtsız hata (ağ kesildi) yeniden denenmeli.
    TaskService.updateTask(taskId, { isCompleted: false }).catch((err: unknown) => {
      const hasResponse = !!(err as { response?: unknown } | null)?.response;
      if (!hasResponse) {
        useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: false, completedAt: null });
      }
    });
  }
}

export function useActivityHealthSync() {
  const tasks = useTaskStore((s) => s.tasks);
  const runningRef = useRef(false);
  const lastAttemptRef = useRef(0);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    if (!ActivityHealth.isSupported()) return;

    const prefs = usePrefsStore.getState();
    // Bağlanma YALNIZ kullanıcı tarafından, açıkça (Ayarlar → Hareket verisi).
    if (prefs.activityHealthOptIn !== 'yes') return;

    const todayKey = fmtDateKey();
    if (prefs.activityLastCheckDate === todayKey) return; // bugün iş bitti

    const open = findOpenMovementTasks(useTaskStore.getState().tasks, todayKey);
    if (open.length === 0) return; // kapatılacak görev yok → veri bile okuma

    const nowMs = Date.now();
    if (nowMs - lastAttemptRef.current < RETRY_THROTTLE_MS) return;
    lastAttemptRef.current = nowMs;

    runningRef.current = true;
    try {
      const activity = await ActivityHealth.getTodayActivity();
      // `null` = okunamadı (izin yok/hata). Sıfır aktivite DEĞİL — günü tüketmeden çık,
      // kullanıcı izni sonradan verirse aynı gün içinde tekrar denenebilsin.
      if (!activity) return;

      const lang = useLanguageStore.getState().language === 'en' ? 'en' : 'tr';
      const completed: number[] = [];
      for (const item of open) {
        if (!isMovementGoalMet(item.kind, activity)) continue;
        completeTaskOfflineFirst(item.id);
        completed.push(item.id);
      }

      if (completed.length === 0) return;

      /**
       * TEK TOAST, çoğul olsa bile. Üç görev birden kapandığında üç ayrı bildirim
       * üst üste binerdi; geri alma da tek tek olurdu. Bildirim ne olduğunu söylüyor,
       * geri alma hepsini birden çeviriyor — kullanıcı zaten "bunu ben yapmadım"
       * derken hepsini kastediyor olur.
       */
      const n = completed.length;
      const msg =
        lang === 'tr'
          ? n === 1
            ? '🏃 Hareket görevin işaretlendi'
            : `🏃 ${n} hareket görevin işaretlendi`
          : n === 1
            ? '🏃 Your movement task is done'
            : `🏃 ${n} movement tasks are done`;

      useToastStore.getState().show(msg, 'success', {
        label: lang === 'tr' ? 'Geri al' : 'Undo',
        onAction: () => completed.forEach(undoCompleteOfflineFirst),
      });

      usePrefsStore.getState().setActivityLastCheckDate(todayKey);
    } catch (e) {
      swallow('activityHealthSync.run', e);
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    run();
    // Öne çıkışta tekrar dene: kullanıcı koşup döndüğünde veri artık orada.
    const sub = AppState.addEventListener('change', (s: string) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, [run, tasks.length]);
}
