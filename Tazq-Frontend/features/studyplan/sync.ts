import { ramadanStudyRelief } from '@/features/modes/utils/ramadanPreview';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { isPausedOn } from '@/features/modes/utils/planPause';
import { retirePlanTask } from '@/features/modes/utils/planTaskOps';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { calendarDayOf } from '@/shared/utils/dateKey';
import { swallow } from '@/shared/utils/swallow';
import { useStudyPlanStore } from './store/useStudyPlanStore';
import { orphanTodayTaskIds, staleStudyTaskIds } from './utils/planBridge';
import { planHasContent, planKeyFor, SlotInput, StudyBlock } from './utils/planCore';

/*
  PLANIN UYGULAMAYA BAĞLANDIĞI TEK YER (2026-11-05). Slotlar ve görevler buradan okunur; çekirdek (planCore) saf kalır.
*/
let bridgePaused = false;

/** Gece çalışanın dünü bitmesin: görevlerle aynı 3 saatlik pay (bkz. usePlanAdaptations.getLocalDateString). */
export function studyToday(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(d.getHours() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function studySlots(today: string = studyToday()): SlotInput[] {
  const p = usePrefsStore.getState();
  const s = p.seasonal;
  const specs = p.planSpecs;
  const rows = [
    { slot: 'exam' as const, on: s.examMode, name: s.examName, date: s.examDate, tasks: p.examPlanTaskIds, habits: p.examPlanHabitIds },
    { slot: 'exam2' as const, on: true, name: s.exam2Name, date: s.exam2Date, tasks: p.exam2PlanTaskIds, habits: p.exam2PlanHabitIds },
    { slot: 'exam3' as const, on: true, name: s.exam3Name, date: s.exam3Date, tasks: p.exam3PlanTaskIds, habits: p.exam3PlanHabitIds },
  ];
  return rows
    .filter(r => r.on && !!r.name && !!r.date && r.tasks.length + r.habits.length > 0)
    .map(r => ({ slot: r.slot, name: r.name as string, date: calendarDayOf(r.date) ?? (r.date as string).slice(0, 10), paused: isPausedOn(specs[r.slot]?.pausedUntil, today), dailyMinutes: specs[r.slot]?.dailyMinutes ?? null, weakTopicIds: specs[r.slot]?.weakTopicIds }));
}

/** Açılışta ve üretimden önce: işaretleri al, günleri kapat, 7 günü sabitle, dünün kalanını kaldır. */
export function runStudySync(today: string = studyToday(), opts?: { replan?: boolean; replanToday?: boolean }): void {
  const tasks = useTaskStore.getState().tasks;
  const store = useStudyPlanStore.getState();
  store.reconcile(tasks, today);
  const beforeIds = new Set((useStudyPlanStore.getState().committed[today] ?? []).map(b => b.id));
  store.sync(studySlots(today), today, { ...opts, relief: ramadanStudyRelief() });
  const afterIds = new Set((useStudyPlanStore.getState().committed[today] ?? []).map(b => b.id));
  const dropped = [...beforeIds].filter(id => !afterIds.has(id));
  bridgePaused = true;
  try {
    for (const id of staleStudyTaskIds(tasks, today)) retirePlanTask(id, 'exam');
    // Gün yeniden bölündü (yeni sınav): planda kalmayan bloğun bitmemiş görevi de kalkar.
    for (const t of useTaskStore.getState().tasks) if (!t.isCompleted && (t.tags ?? []).some(x => dropped.includes(x))) retirePlanTask(t.id, 'exam');
    // Plan değişirken uçuşta olan eski görevler de (hızlı art arda ayar değişikliği).
    for (const id of orphanTodayTaskIds(useTaskStore.getState().tasks, useStudyPlanStore.getState().committed[today] ?? [], today)) retirePlanTask(id, 'exam');
  } finally {
    bridgePaused = false;
  }
}

/** Bu slotun bugünkü blokları. null: planlayıcı bu sınavı yönetmiyor (konu yok), görevler eski motordan gelir. */
export function studyBlocksForSlot(slot: string, examName: string, today: string = studyToday()): StudyBlock[] | null {
  const state = useStudyPlanStore.getState();
  const plan = state.plans[planKeyFor(examName)];
  if (!plan || plan.slot !== slot || !planHasContent(plan)) return null;
  return (state.committed[today] ?? []).filter(b => b.planKey === plan.key);
}

export const isStudyManaged = (examName: string): boolean => {
  const plan = useStudyPlanStore.getState().plans[planKeyFor(examName)];
  return !!plan && planHasContent(plan);
};

/** Plan değişti: bugünün artık planda olmayan görevleri kalkar. Yenileri üretim yolu açar. */
export function retireOrphanStudyTasks(today: string = studyToday()): void {
  const blocks = useStudyPlanStore.getState().committed[today] ?? [];
  // Silme sürerken köprü susar: kalan eski görevler "başka cihazın görevi" sanılıp plana geri alınmasın.
  bridgePaused = true;
  try {
    for (const id of orphanTodayTaskIds(useTaskStore.getState().tasks, blocks, today)) retirePlanTask(id, 'exam');
  } finally {
    bridgePaused = false;
  }
}

/** Plan ekranından işaretleme: görev de aynı yoldan tamamlanır (yerel, çevrimdışı kuyruk, sunucu), plan ve Bugün listesi ayrışmaz. */
export async function setStudyBlockDone(blockId: string, done: boolean, today: string = studyToday()): Promise<void> {
  const study = useStudyPlanStore.getState();
  study.toggleBlock(today, blockId, done);
  const tasks = useTaskStore.getState();
  const task = tasks.tasks.find(t => (t.tags ?? []).includes(blockId));
  if (!task || !!task.isCompleted === done) return;
  tasks.toggleTaskCompletion(task.id);
  const planMode = (task.tags ?? []).find(t => t === 'exam' || t === 'exam2' || t === 'exam3');
  if (done) useCompletionStore.getState().record(task.id, task.title, new Date().toISOString(), planMode);
  const enqueue = () => useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: task.id, isCompleted: done, completedAt: done ? new Date().toISOString() : null } as never);
  if (!useNetworkStore.getState().isOnline) { enqueue(); return; }
  try {
    await TaskService.updateTask(task.id, { isCompleted: done });
  } catch (e) {
    swallow('studyPlan.toggleTask', e);
    enqueue();
  }
}

/** Açık bloklardan görevi olmayan var mı: plan değişirken üretilen görev eskimiş ve kaldırılmış olabilir. */
export function studyTaskMissing(today: string = studyToday()): boolean {
  const tags = new Set(useTaskStore.getState().tasks.flatMap(t => t.tags ?? []));
  const open = (useStudyPlanStore.getState().committed[today] ?? []).filter(b => !b.done && !b.skipped);
  const byPlan = new Set(open.map(b => b.planKey));
  return [...byPlan].some(key => !open.some(b => b.planKey === key && tags.has(b.id)));
}

let bridgeOn = false;
/** Görev nereden tamamlanırsa tamamlansın plan öğrenir (Bugün listesi, Odak, widget). Tek abonelik. */
export function startStudyPlanBridge(): void {
  if (bridgeOn) return;
  bridgeOn = true;
  let last = useTaskStore.getState().tasks;
  useTaskStore.subscribe(s => {
    if (s.tasks === last) return;
    last = s.tasks;
    if (bridgePaused) return;
    useStudyPlanStore.getState().reconcile(s.tasks, studyToday());
  });
}
