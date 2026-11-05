import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { isStudyTask } from '@/features/studyplan/utils/planBridge';
import { affinityKey, mergeAffinity, NEGATIVE, withDone, withNegative, withShown, type PlanAffinity } from '@/features/modes/utils/planAffinity';
import { emptyRhythm, isLightDay, mergeRhythm, withDoneAt, withShownDay, type Rhythm } from '@/features/modes/utils/planLearner';
import { PLAN_SLOTS } from '@/features/modes/utils/planSlots';

/*
  ÖĞRENİLEN TERCİHLER, HEDEF BAŞINA (2026-11-05). Karar saf hesapta (planAffinity); burası saklar ve görevlerden sinyal toplar.
  Görev metni dışında bir şey saklanmaz, o da özet olarak (sayı anahtarı): dışa aktarım ve bulut yedeği bu veriyi de taşır.
*/
interface AffinityCloud { bySlot?: Record<string, PlanAffinity>; rhythm?: Record<string, Rhythm> }

interface AffinityState {
  bySlot: Record<string, PlanAffinity>;
  rhythm: Record<string, Rhythm>;
  update: (slot: string, fn: (a: PlanAffinity) => PlanAffinity) => void;
  updateRhythm: (slot: string, fn: (r: Rhythm) => Rhythm) => void;
  resetSlot: (slot: string) => void;
  cloudSnapshot: () => AffinityCloud;
  applyCloud: (cloud: AffinityCloud | null | undefined) => void;
  reset: () => void;
}

export const usePlanAffinityStore = create<AffinityState>()(
  persist(
    (set, get) => ({
      bySlot: {},
      rhythm: {},
      update: (slot, fn) => set(s => ({ bySlot: { ...s.bySlot, [slot]: fn(s.bySlot[slot] ?? {}) } })),
      updateRhythm: (slot, fn) => set(s => ({ rhythm: { ...s.rhythm, [slot]: fn(s.rhythm[slot] ?? emptyRhythm()) } })),
      resetSlot: (slot) => set(s => ({ bySlot: { ...s.bySlot, [slot]: {} }, rhythm: { ...s.rhythm, [slot]: emptyRhythm() } })),
      cloudSnapshot: () => ({ bySlot: get().bySlot, rhythm: get().rhythm }),
      applyCloud: (cloud) => {
        if (!cloud) return;
        const next = { ...get().bySlot };
        for (const [slot, a] of Object.entries(cloud.bySlot ?? {})) next[slot] = mergeAffinity(next[slot] ?? {}, a);
        const rhythm = { ...get().rhythm };
        for (const [slot, r] of Object.entries(cloud.rhythm ?? {})) rhythm[slot] = mergeRhythm(rhythm[slot], r);
        set({ bySlot: next, rhythm });
      },
      reset: () => set({ bySlot: {}, rhythm: {} }),
    }),
    { name: 'tazq-plan-affinity', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

type TaskLike = { title?: string; description?: string | null; tags?: string[] | null };

const SLOT_IDS = new Set<string>(PLAN_SLOTS.map(r => r.slot));
const slotOf = (t: TaskLike) => t.tags?.find(tag => SLOT_IDS.has(tag));
const isDaily = (t: TaskLike) => !!t.tags?.includes('daily') && !isStudyTask(t as never);

function keyOf(t: TaskLike): string {
  try {
    const tr = JSON.parse(t.description ?? '{}')?.tr;
    if (typeof tr === 'string' && tr) return affinityKey(tr);
  } catch { /* açıklama düz metinse başlık kullanılır */ }
  return affinityKey(t.title ?? '');
}

function noteNegative(task: TaskLike | undefined, weight: number): void {
  if (!task || !isDaily(task)) return;
  const slot = slotOf(task);
  if (slot) usePlanAffinityStore.getState().update(slot, a => withNegative(a, keyOf(task), weight));
}

export const noteSwapped = (task?: TaskLike) => noteNegative(task, NEGATIVE.swap);
export const noteSkippedToday = (task?: TaskLike) => noteNegative(task, NEGATIVE.notToday);
export const noteIgnored = (task?: TaskLike) => noteNegative(task, NEGATIVE.ignored);

export function noteShown(slot: string, tasks: { titleTr?: string }[] | unknown[], day: number): void {
  const keys = (tasks as { titleTr?: string }[]).map(t => t.titleTr).filter((x): x is string => !!x).map(affinityKey);
  if (!keys.length) return;
  usePlanAffinityStore.getState().update(slot, a => withShown(a, keys, day));
  usePlanAffinityStore.getState().updateRhythm(slot, r => withShownDay(r, new Date().getDay(), keys.length, day));
}

/** Bitirme ve geri alma, görev nereden işaretlenirse işaretlensin buradan sayılır. Başka cihazda bitmiş, ilk kez gelen görev sayılmaz. */
export function diffCompletions(prev: Map<number, boolean>, tasks: ({ id: number; isCompleted?: boolean } & TaskLike)[]): { slot: string; key: string; delta: number }[] {
  const out: { slot: string; key: string; delta: number }[] = [];
  for (const t of tasks) {
    const before = prev.get(t.id);
    if (before === undefined || before === !!t.isCompleted || !isDaily(t)) continue;
    const slot = slotOf(t);
    if (slot) out.push({ slot, key: keyOf(t), delta: t.isCompleted ? 1 : -1 });
  }
  return out;
}

let bridgeOn = false;

export function startPlanAffinityBridge(): void {
  if (bridgeOn) return;
  bridgeOn = true;
  const snapshot = (tasks: { id: number; isCompleted?: boolean }[]) => new Map(tasks.map(t => [t.id, !!t.isCompleted]));
  let last = useTaskStore.getState().tasks;
  let prev = snapshot(last);
  useTaskStore.subscribe(s => {
    if (s.tasks === last) return;
    last = s.tasks;
    const now = new Date();
    for (const c of diffCompletions(prev, s.tasks)) {
      usePlanAffinityStore.getState().update(c.slot, a => withDone(a, c.key, c.delta));
      usePlanAffinityStore.getState().updateRhythm(c.slot, r => withDoneAt(r, now.getDay(), now.getHours(), c.delta, Math.floor(now.getTime() / 86400000)));
    }
    prev = snapshot(s.tasks);
  });
}

/** Bugün bu hedef için hafif gün mü. Görev üretimi ve ekran aynı cevabı okur. */
export const lightDayFor = (slot: string, today: Date = new Date()) => isLightDay(usePlanAffinityStore.getState().rhythm[slot], today.getDay());
