import { postponedTags } from '@/features/modes/utils/dayRoute';
import { noteIgnored, noteSkippedToday, noteSwapped, usePlanAffinityStore } from '@/features/modes/store/usePlanAffinityStore';
import { hasSignal, pickByAffinity } from '@/features/modes/utils/planAffinity';
import { useHabitStore } from '@/features/habits';
import { usePrefsStore, type PlanMode, type PlanSpec } from '@/features/modes/store/usePrefsStore';
import { detectSporTypeLocal, daysUntil } from '@/features/modes/utils/planAdaptations';
import { retirePlanTask } from '@/features/modes/utils/planTaskOps';
import { buildDailyTasks, dailyPool, type DailyPlanSpec, type PlanKind } from '@/features/modes/utils/dailyPlanEngine';
import { activePlans, type ActivePlan } from '@/features/modes/utils/planSlots';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { swallow } from '@/shared/utils/swallow';
import { toDateKey } from '@/shared/utils/dateKey';
import { CategoryColors } from '@/shared/constants/Colors';
import type { RoutineSuggestion } from '@/features/modes/data/planLibrary';

/*
  PLANI YÖNETME (2026-11-05, kullanıcı: "yönetim açısından zayıf"). Planım'daki eylemler buradan geçer: başka görev, bana uymuyor, bugün olmaz,
  kendi işim, rutin ekle/kaldır/ara ver, önümüzdeki günler. Görevler Bugün listesindekilerle aynı kayıttır; ayrı bir liste yok.
*/
const LONG_HORIZON = 3650;

export function specForSlot(plan: ActivePlan, spec: PlanSpec | undefined): DailyPlanSpec {
  const kind: PlanKind = plan.type === 'spor'
    ? ((t => (t === 'yaris' ? 'genel' : t))(detectSporTypeLocal(plan.name)) as PlanKind)
    : plan.type;
  return {
    kind, slot: plan.slot, name: plan.name,
    daysLeft: plan.date ? daysUntil(plan.date) : LONG_HORIZON,
    dailyMinutes: spec?.dailyMinutes, templateId: spec?.templateId,
    weakAreaIds: spec?.weakTopicIds, hiddenItems: spec?.hiddenItems,
    affinity: usePlanAffinityStore.getState().bySlot[plan.slot],
  };
}

const planOf = (slot: string) => {
  const p = usePrefsStore.getState();
  return { p, plan: activePlans(p as never).find(x => x.slot === slot) };
};

function trackTask(slot: string, id: number): void {
  const p = usePrefsStore.getState() as unknown as Record<string, unknown>;
  const habits = (p[`${slot}PlanHabitIds`] as string[]) ?? [];
  const tasks = (p[`${slot}PlanTaskIds`] as number[]) ?? [];
  usePrefsStore.getState().setPlanIds(slot as PlanMode, habits, [...new Set([...tasks, id])]);
}

async function createTask(slot: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const t = await TaskService.createTask(payload as never);
    if (t?.id) { useTaskStore.getState().addTask(t); trackTask(slot, t.id); }
  } catch (e) {
    swallow('planManage.createTask', e);
    if (!useNetworkStore.getState().isOnline) {
      const tempId = -Date.now();
      useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload } as never);
      useTaskStore.getState().addTask({ ...payload, id: tempId } as never);
      trackTask(slot, tempId);
    }
  }
}

const dueToday = () => { const d = new Date(); d.setHours(9, 0, 0, 0); return d.toISOString(); };

/** Bugünün görevinin yerine, bugün listede olmayan bir görev. Kalmadıysa false: ekran söyler. */
export async function swapPlanTask(slot: string, taskId: number): Promise<boolean> {
  const { p, plan } = planOf(slot);
  if (!plan) return false;
  const lang = useLanguageStore.getState().language === 'en' ? 'en' : 'tr';
  const spec = specForSlot(plan, p.planSpecs[plan.slot]);
  const tasks = useTaskStore.getState().tasks;
  const current = tasks.find(t => t.id === taskId);
  const taken = new Set(tasks.filter(t => (t.tags ?? []).includes(slot)).map(t => t.title));
  const name = plan.name || '';
  const fill = (s: string) => s.replace('{name}', name);
  const offset = Math.floor(Date.now() / 86400000);
  const pool = dailyPool(spec);
  const start = ((offset * 7) % Math.max(1, pool.length));
  const ordered = hasSignal(spec.affinity) ? pickByAffinity(pool, pool.length, { affinity: spec.affinity!, day: offset, name, weakAreaIds: spec.weakAreaIds }) : [...pool.slice(start), ...pool.slice(0, start)];
  const next = ordered.find(x => !taken.has(fill(x.tr)) && !taken.has(fill(x.en)));
  if (!next) return false;
  noteSwapped(current);
  const titleTr = fill(next.tr);
  const titleEn = fill(next.en);
  retirePlanTask(taskId, slot);
  await createTask(slot, { title: lang === 'tr' ? titleTr : titleEn, description: JSON.stringify({ tr: titleTr, en: titleEn }), priority: current?.priority ?? 'Medium', dueDate: current?.dueDate ?? dueToday(), isCompleted: false, tags: current?.tags ?? [slot, 'daily'], titleTr, titleEn });
  return true;
}

/** "Bana uymuyor": bir daha gelmez, Ayarlar'dan geri alınır. Görevin yerine yenisi gelir. */
export async function hidePlanTask(slot: string, taskId: number): Promise<boolean> {
  const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
  const prefs = usePrefsStore.getState();
  const spec = prefs.planSpecs[slot as PlanMode];
  if (task) {
    let key = task.title;
    try { const j = JSON.parse(task.description ?? '{}'); if (j.tr) key = j.tr; } catch (e) { swallow('planManage.parseTitle', e); }
    prefs.setPlanSpec(slot as PlanMode, { ...spec, hiddenItems: [...new Set([...(spec?.hiddenItems ?? []), key])] });
  }
  return swapPlanTask(slot, taskId);
}

export function unhidePlanItem(slot: string, key: string): void {
  const prefs = usePrefsStore.getState();
  const spec = prefs.planSpecs[slot as PlanMode];
  prefs.setPlanSpec(slot as PlanMode, { ...spec, hiddenItems: (spec?.hiddenItems ?? []).filter(k => k !== key) });
}

/** "Bugün olmaz": görev kalkar, plan bugün yerine yenisini açmaz; yarın devam eder. Ceza yok. */
export function skipPlanTaskToday(slot: string, taskId: number): void {
  noteSkippedToday(useTaskStore.getState().tasks.find(t => t.id === taskId));
  retirePlanTask(taskId, slot);
  const today = toDateKey(new Date());
  const prefs = usePrefsStore.getState();
  prefs.setPlanSpec(slot as PlanMode, { ...prefs.planSpecs[slot as PlanMode], restDay: today });
}

function patchTask(id: number, patch: { dueDate?: string; tags?: string[] }): void {
  const task = useTaskStore.getState().tasks.find(t => t.id === id);
  if (!task) return;
  const payload = { ...task, ...patch };
  useTaskStore.getState().updateTask(id, patch);
  if (!useNetworkStore.getState().isOnline) { useOfflineQueue.getState().enqueue({ type: 'update-task', id, payload }); return; }
  TaskService.updateTask(id, payload as never).catch((e: { response?: unknown }) => {
    if (!e?.response) useOfflineQueue.getState().enqueue({ type: 'update-task', id, payload });
    else swallow('planManage.patchTask', e);
  });
}

/** Görevi seçilen güne taşır. Dönüş: geri alma için eski hali. İnternetsiz de çalışır. */
export function postponePlanTask(id: number, dateKey: string): { dueDate?: string | null; tags?: string[] | null } | null {
  const task = useTaskStore.getState().tasks.find(t => t.id === id);
  if (!task) return null;
  noteIgnored(task);
  const before = { dueDate: task.dueDate, tags: task.tags };
  patchTask(id, { dueDate: dateKey, tags: postponedTags(task.tags) });
  return before;
}

export function undoPostpone(id: number, before: { dueDate?: string | null; tags?: string[] | null }): void {
  patchTask(id, { dueDate: before.dueDate ?? undefined, tags: before.tags ?? [] });
}

/** Ertelenen işi bugüne geri alır; ertelendi etiketi durur, gün geçince silinmez. */
export function bringPostponedToday(id: number): void {
  patchTask(id, { dueDate: toDateKey(new Date()) });
}

export async function addOwnTask(slot: string, title: string): Promise<void> {
  const text = title.trim();
  if (!text) return;
  await createTask(slot, { title: text, description: '', priority: 'Medium', dueDate: dueToday(), isCompleted: false, tags: [slot] });
}

/** Önümüzdeki günler: motorun kendisiyle hesaplanır; uzak gün tahmindir, kullanıcı değiştirirse değişir. */
export function upcomingTasks(spec: DailyPlanSpec, lang: 'tr' | 'en', days: number): { date: Date; titles: string[] }[] {
  const out: { date: Date; titles: string[] }[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(); d.setDate(d.getDate() + i); d.setHours(12, 0, 0, 0);
    const left = spec.daysLeft - i;
    if (left < 0) break;
    out.push({ date: d, titles: buildDailyTasks({ ...spec, daysLeft: left }, [], lang, d).map(t => t.title) });
  }
  return out;
}

const ROUTINE_COLOR = CategoryColors.blue;

export function addRoutine(slot: string, s: RoutineSuggestion): void {
  const id = `habit_${slot.replace(/\d+$/, '')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  useHabitStore.getState().addHabit(s.tr, s.emoji, ROUTINE_COLOR, id, slot, s.tr, s.en);
  const p = usePrefsStore.getState() as unknown as Record<string, unknown>;
  const habits = (p[`${slot}PlanHabitIds`] as string[]) ?? [];
  const tasks = (p[`${slot}PlanTaskIds`] as number[]) ?? [];
  usePrefsStore.getState().setPlanIds(slot as PlanMode, [...habits, id], tasks);
}

export function removeRoutine(slot: string, habitId: string): void {
  useHabitStore.getState().removeHabit(habitId);
  const p = usePrefsStore.getState() as unknown as Record<string, unknown>;
  const habits = (p[`${slot}PlanHabitIds`] as string[]) ?? [];
  const tasks = (p[`${slot}PlanTaskIds`] as number[]) ?? [];
  usePrefsStore.getState().setPlanIds(slot as PlanMode, habits.filter(h => h !== habitId), tasks);
}
