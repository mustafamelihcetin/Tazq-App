/**
 * Plan Migration v2
 *
 * Eski mimaride plan seçildiğinde tüm haftalık/aylık görevler aylar/yıllar ileriye
 * tarihlenerek toplu oluşturuluyordu. Yeni mimaride bu görevler günlük üretiliyor.
 *
 * Bu tek seferlik migrasyon, SADECE plan-kaynaklı (prefs'teki plan id listelerinde
 * kayıtlı) ve yarından sonrasına tarihli, tamamlanmamış görevleri temizler.
 * Kullanıcının manuel görevlerine ve bugün/yarınki + tamamlanmış görevlere dokunmaz.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';

const MIGRATION_KEY = 'plan_migration_v2_done';

type PlanMode = 'exam' | 'exam2' | 'exam3' | 'ramazan' | 'tez' | 'mulakat' | 'mulakat2' | 'mulakat3' | 'spor' | 'spor2' | 'spor3';

export async function runPlanMigrationOnce(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_KEY);
    if (done) return;

    const prefs = usePrefsStore.getState();
    const taskStore = useTaskStore.getState();

    // Yarının sonu — bundan sonrasına tarihli plan görevleri gelecek dökümüdür
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 1);
    cutoff.setHours(23, 59, 59, 999);

    const slots: { mode: PlanMode; taskIds: number[]; habitIds: string[] }[] = [
      { mode: 'exam', taskIds: prefs.examPlanTaskIds, habitIds: prefs.examPlanHabitIds },
      { mode: 'exam2', taskIds: prefs.exam2PlanTaskIds, habitIds: prefs.exam2PlanHabitIds },
      { mode: 'exam3', taskIds: prefs.exam3PlanTaskIds, habitIds: prefs.exam3PlanHabitIds },
      { mode: 'tez', taskIds: prefs.tezPlanTaskIds, habitIds: prefs.tezPlanHabitIds },
      { mode: 'mulakat', taskIds: prefs.mulakatPlanTaskIds, habitIds: prefs.mulakatPlanHabitIds },
      { mode: 'mulakat2', taskIds: prefs.mulakat2PlanTaskIds, habitIds: prefs.mulakat2PlanHabitIds },
      { mode: 'mulakat3', taskIds: prefs.mulakat3PlanTaskIds, habitIds: prefs.mulakat3PlanHabitIds },
      { mode: 'spor', taskIds: prefs.sporPlanTaskIds, habitIds: prefs.sporPlanHabitIds },
      { mode: 'spor2', taskIds: prefs.spor2PlanTaskIds, habitIds: prefs.spor2PlanHabitIds },
      { mode: 'spor3', taskIds: prefs.spor3PlanTaskIds, habitIds: prefs.spor3PlanHabitIds },
      { mode: 'ramazan', taskIds: prefs.ramazanPlanTaskIds, habitIds: prefs.ramazanPlanHabitIds },
    ];

    for (const slot of slots) {
      if (!slot.taskIds.length) continue;
      const removed: number[] = [];

      for (const id of slot.taskIds) {
        const task = taskStore.tasks.find(t => t.id === id);
        if (!task || task.isCompleted || !task.dueDate) continue;
        const due = new Date(task.dueDate).getTime();
        if (due > cutoff.getTime()) {
          removed.push(id);
          taskStore.removeTask(id);
          TaskService.deleteTask(id).catch(() => {});
        }
      }

      if (removed.length) {
        const remaining = slot.taskIds.filter(id => !removed.includes(id));
        prefs.setPlanIds(slot.mode, slot.habitIds, remaining);
      }
    }

    await AsyncStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    // Migrasyon başarısızsa sessizce geç — bir sonraki açılışta tekrar denenir
  }
}
