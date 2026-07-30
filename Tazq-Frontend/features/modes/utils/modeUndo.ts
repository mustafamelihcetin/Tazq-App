import { useHabitStore, type Habit } from '@/features/habits';
import { useTaskStore, type Task } from '@/features/tasks';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useToastStore } from '@/shared/store/useToastStore';
import { TaskService } from '@/shared/services/api';
import { MODE_TASK_TAGS } from '@/features/modes/utils/planTaskOps';
import { haptic } from '@/shared/utils/haptics';
import { swallow } from '@/shared/utils/swallow';

/**
 * MOD KAPATMA — GERİ ALINABİLİR.
 *
 * SORUN: modu kapatmak alışkanlıkları ve görevleri siliyordu ve GERİ DÖNÜŞÜ YOKTU.
 * Onay diyaloğu vardı ama yanlışlıkla onaylayan kullanıcı haftalarca biriktirdiği
 * kurulumu (sınav adı, tarih, günlük süre, alışkanlık geçmişi) kaybediyordu.
 * "Emin misin?" sormak, hatayı ÖNLEMEZ — yalnızca sorumluluğu kullanıcıya yıkar.
 * Doğru desen: eylemi hemen yap, geri almayı kolaylaştır.
 *
 * NASIL ÇALIŞIR
 *  1. Kapatmadan ÖNCE anlık görüntü alınır: moda ait alışkanlıklar (tamamlanma
 *     geçmişiyle birlikte), görevler ve `seasonal` yapılandırma.
 *  2. Kapatma normal şekilde yapılır.
 *  3. Toast'ta "Geri al" çıkar. Basılırsa alışkanlıklar AYNI id ve AYNI
 *     `completedDates` ile geri konur — yani seri/istatistik kaybolmaz.
 *
 * DÜRÜST SINIR: görevler sunucudan silindiği için geri alındığında YENİ id ile
 * yeniden oluşturulur. İçerik, tarih ve tamamlanma durumu korunur; id değişir.
 * Kullanıcı açısından fark edilmez, ama bilinçli bir ödün olduğu için burada yazılı.
 *
 * `seasonal` geri alınırken YALNIZCA kapatma sırasında DEĞİŞEN anahtarlar yazılır.
 * Tüm nesneyi geri yazmak, o birkaç saniyede kullanıcının yaptığı başka bir
 * değişikliği ezerdi.
 */

export interface ModeSnapshot {
  mode: string;
  seasonal: Record<string, any>;
  habits: Habit[];
  tasks: Task[];
  habitIds: string[];
  taskIds: number[];
}

/** Kapatmadan ÖNCE çağrılır — moda ait her şeyin fotoğrafını çeker. */
export function snapshotMode(mode: string): ModeSnapshot {
  const prefs = usePrefsStore.getState();
  const tags = new Set(MODE_TASK_TAGS[mode] ?? []);
  const habitIds: string[] = (prefs as any)[`${mode}PlanHabitIds`] ?? [];
  const taskIds: number[] = (prefs as any)[`${mode}PlanTaskIds`] ?? [];

  return {
    mode,
    seasonal: { ...prefs.seasonal },
    // Alışkanlıklar: hem id listesinden hem `planMode` etiketinden — biri kaçırırsa diğeri yakalar.
    habits: useHabitStore.getState().habits.filter(
      h => habitIds.includes(h.id) || h.planMode === mode
    ).map(h => ({ ...h })),
    // Görevler: etikete göre (id listesi bayat olabilir — zaten bu yüzden
    // etiket tabanlı süpürme eklemiştik).
    tasks: useTaskStore.getState().tasks.filter(
      t => (t.tags ?? []).some(tag => tags.has(tag))
    ).map(t => ({ ...t })),
    habitIds: [...habitIds],
    taskIds: [...taskIds],
  };
}

/** Anlık görüntüyü geri yükler. */
export async function restoreMode(snap: ModeSnapshot): Promise<void> {
  // 1) seasonal — yalnız DEĞİŞEN anahtarlar
  const now = usePrefsStore.getState().seasonal as Record<string, any>;
  const setSeasonalPref = usePrefsStore.getState().setSeasonalPref;
  for (const key of Object.keys(snap.seasonal)) {
    if (now[key] !== snap.seasonal[key]) setSeasonalPref(key as any, snap.seasonal[key]);
  }

  // 2) Alışkanlıklar — AYNI id, AYNI completedDates (seri korunur)
  if (snap.habits.length > 0) {
    const existing = new Set(useHabitStore.getState().habits.map(h => h.id));
    const missing = snap.habits.filter(h => !existing.has(h.id));
    if (missing.length > 0) {
      useHabitStore.setState(s => ({ habits: [...s.habits, ...missing] }));
    }
  }

  // 3) Görevler — yeniden oluşturulur (yeni id), içerik/tarih/durum korunur
  const newTaskIds: number[] = [];
  const online = useNetworkStore.getState().isOnline;
  for (const t of snap.tasks) {
    const payload = {
      title: t.title, description: t.description, dueDate: t.dueDate ?? null,
      isCompleted: t.isCompleted, priority: t.priority, tags: t.tags ?? [],
      subtasks: t.subtasks, recurrence: t.recurrence,
    };
    if (!online) {
      const tempId = -Date.now() - newTaskIds.length;
      useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
      useTaskStore.getState().addTask({ ...payload, id: tempId } as any);
      newTaskIds.push(tempId);
      continue;
    }
    try {
      const created = await TaskService.createTask(payload as any);
      if (created?.id) { useTaskStore.getState().addTask(created); newTaskIds.push(created.id); }
    } catch (e) {
      swallow('modeUndo.restoreTask', e);
    }
  }

  // 4) Plan id listeleri
  usePrefsStore.getState().setPlanIds(
    snap.mode as any,
    snap.habits.map(h => h.id),
    newTaskIds,
  );
}

/**
 * Modu kapatır ve "Geri al" aksiyonlu bir toast gösterir.
 *
 * `close` fonksiyonu kartın kendi kapatma mantığıdır (bileşene özel: bildirim
 * iptali, yerel state sıfırlama vb.) — buraya taşınmaz, olduğu yerde kalır.
 */
export function closeModeWithUndo(
  mode: string,
  close: () => void,
  message: string,
  undoLabel: string,
): void {
  const snap = snapshotMode(mode);
  close();
  haptic.destructive();
  useToastStore.getState().show(message, 'info', {
    label: undoLabel,
    onAction: () => {
      restoreMode(snap)
        .then(() => haptic.success())
        .catch(e => swallow('modeUndo.restore', e, { capture: true }));
    },
  });
}
