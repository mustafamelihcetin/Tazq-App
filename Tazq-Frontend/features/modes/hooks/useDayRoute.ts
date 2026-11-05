import { taskNature } from '@/features/focus/focusWorthy';
import { waterGoalOfTask } from '@/features/modes/utils/waterGoal';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fmtDateKey, useHabitStore } from '@/features/habits';
import { usePlanAffinityStore, lightDayFor } from '@/features/modes/store/usePlanAffinityStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { composeRoute, minutesOf, orderStops, routeCapacity, weekRoutes, withLog, type DayLog, type RouteGoal, type RouteItem, type StopReason } from '@/features/modes/utils/dayRoute';
import { goalTitle } from '@/features/modes/utils/goalTitle';
import { belongsToSlot, foreignTaskIds } from '@/features/modes/utils/goalRows';
import { daysUntil } from '@/features/modes/utils/planAdaptations';
import { affinityKey } from '@/features/modes/utils/planAffinity';
import { isPausedOn } from '@/features/modes/utils/planPause';
import { activeKeys } from '@/features/modes/utils/planTrack';
import { activePlans, withoutGoalName } from '@/features/modes/utils/planSlots';
import { studyBlockWindow, windowOf, windowRank } from '@/features/modes/utils/ramadanBrain';
import { ramadanFrameNow, ramadanStatusNow } from '@/features/modes/utils/ramadanPreview';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { calendarDayOf } from '@/shared/utils/dateKey';

/*
  ROTANIN CANLI HALİ (2026-11-05). Seçim günde bir kez sabitlenir: ekran her iş bitince yeniden karışmaz, kullanıcı yolunu bilir. Rotadaki iş kaybolursa (silindi, ertelendi) yerine yenisi girer.
  Geçmiş cihazda tutulur; yeni cihazda kapasite küçük başlar ve kısa sürede kullanıcıyı yakalar.
*/
interface RouteState {
  day: string | null;
  keys: string[];
  reasons: Record<string, StopReason>;
  celebratedDay: string | null;
  history: DayLog[];
  setRoute: (day: string, keys: string[], reasons: Record<string, StopReason>) => void;
  addKey: (key: string, reason: StopReason) => void;
  log: (day: string, planned: number, done: number) => void;
  markCelebrated: (day: string) => void;
  reset: () => void;
}

export const useDayRouteStore = create<RouteState>()(
  persist(
    (set) => ({
      day: null,
      keys: [],
      reasons: {},
      celebratedDay: null,
      history: [],
      setRoute: (day, keys, reasons) => set({ day, keys, reasons }),
      addKey: (key, reason) => set(s => ({ keys: [...s.keys, key], reasons: { ...s.reasons, [key]: reason } })),
      log: (day, planned, done) => set(s => ({ history: withLog(s.history, day, planned, done) })),
      markCelebrated: (day) => set({ celebratedDay: day }),
      reset: () => set({ day: null, keys: [], reasons: {}, celebratedDay: null, history: [] }),
    }),
    { name: 'tazq-day-route', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

const DOING_MIN = 5;

export interface DayRoute {
  /** Plan sayısı: tek hedefte rota gereksiz, kart kendi başına yeter. */
  goalCount: number;
  stops: RouteItem[];
  current: RouteItem | null;
  reasons: Record<string, StopReason>;
  done: number;
  total: number;
  minutesLeft: number;
  minutesDone: number;
  goalsTouched: number;
  complete: boolean;
  resting: { slot: string; goal: string }[];
  /** Rota dışında kalan en güçlü aday: "bir adım daha". */
  spare: { key: string; reason: StopReason } | null;
  weekDone: number;
  yesterday: DayLog | null;
  capacity: number;
  planCount: Record<string, number>;
}

export function useDayRoute(lang: 'tr' | 'en'): DayRoute {
  const prefs = usePrefsStore();
  const tasks = useTaskStore(s => s.tasks);
  const habits = useHabitStore(s => s.habits);
  const affinity = usePlanAffinityStore(s => s.bySlot);
  const store = useDayRouteStore();
  const today = fmtDateKey();
  const raw = prefs as unknown as Record<string, unknown>;

  const goals = useMemo<RouteGoal[]>(() => activePlans(prefs as never).flatMap(p => {
    const spec = prefs.planSpecs[p.slot];
    if (isPausedOn(spec?.pausedUntil ?? null, today)) return [];
    if (p.type === 'ramazan' && !ramadanStatusNow().isActive) return [];
    const taskIds = (raw[`${p.slot}PlanTaskIds`] as number[]) ?? [];
    const habitIds = (raw[`${p.slot}PlanHabitIds`] as string[]) ?? [];
    const foreign = foreignTaskIds(p.slot, raw);
    const all = tasks.filter(t => !t.isArchived && belongsToSlot(t, p.slot, taskIds, foreign));
    const planHabits = habits.filter(h => habitIds.includes(h.id) && !h.pausedAt);
    const goal = goalTitle(p, lang, p.type, true);
    const taskItems: RouteItem[] = all.flatMap(t => {
      const due = calendarDayOf(t.dueDate);
      if (t.isCompleted ? due !== today : due != null && due > today) return [];
      let tr = t.title;
      try { tr = JSON.parse(t.description ?? '{}').tr ?? t.title; } catch { /* düz açıklama */ }
      const e = affinity[p.slot]?.[affinityKey(tr)];
      const studyTag = (t.tags ?? []).find(x => x.startsWith('sb_'));
      const nature = studyTag ? 'deep' as const : taskNature(t);
      const parsed = minutesOf('task', t.title);
      return [{
        key: `t:${t.id}`, kind: 'task' as const, refId: t.id, slot: p.slot, type: p.type, goal,
        title: withoutGoalName(t.title, p.name), minutes: nature === 'allDay' ? 0 : nature === 'doing' && !/\d+\+?[\s-]*(?:dk|dakika|min)/i.test(t.title) ? DOING_MIN : parsed, nature, water: waterGoalOfTask(t), done: !!t.isCompleted, overdue: !!due && due < today,
        liking: e ? (1 + e.d) / (2 + e.d + e.n) : 0.5, high: t.priority === 'High', blockId: studyTag,
      }];
    });
    const habitItems: RouteItem[] = planHabits.map(h => ({
      key: `h:${h.id}`, kind: 'habit' as const, refId: h.id, slot: p.slot, type: p.type, goal,
      title: (lang === 'tr' ? h.nameTr : h.nameEn) ?? h.name, minutes: minutesOf('habit', ''), done: (h.completedDates ?? []).includes(today),
      streak: useHabitStore.getState().getStreak?.(h) ?? 0,
    }));
    const active = activeKeys(planHabits.flatMap(h => h.completedDates ?? []), all.filter(t => t.isCompleted).map(t => t.completedAt));
    const lastActive = [...active].filter(k => k < today).sort().pop() ?? null;
    return [{ slot: p.slot, type: p.type, goal, daysLeft: p.date ? daysUntil(p.date) : null, lastActive, items: [...taskItems, ...habitItems] }];
  }), [prefs, tasks, habits, affinity, today, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const frame = ramadanFrameNow();
  const capacity = routeCapacity(store.history, today, { lightDay: goals.some(g => lightDayFor(g.slot)), fasting: frame.fasting, eid: frame.phase === 'eid' });
  const allItems = useMemo(() => goals.flatMap(g => g.items), [goals]);
  const byKey = useMemo(() => new Map(allItems.map(i => [i.key, i])), [allItems]);

  // Günde bir kez sabitlenir. Rotadan düşen iş varsa (silindi, ertelendi) eksik kalan yer doldurulur; biten işler yerinde durur.
  useEffect(() => {
    if (!goals.length) return;
    const st = useDayRouteStore.getState();
    const alive = st.day === today ? st.keys.filter(k => byKey.has(k)) : [];
    const finished = allItems.filter(i => i.done).map(i => i.key);
    const known = new Set([...alive, ...finished]);
    if (st.day === today && alive.length === st.keys.length && finished.every(k => alive.includes(k))) return;
    const keep = [...known];
    const target = Math.max(capacity, keep.length);
    const fresh = composeRoute(goals.map(g => ({ ...g, items: g.items.filter(i => !known.has(i.key) || i.done) })), target - alive.filter(k => !byKey.get(k)?.done).length, today);
    st.setRoute(today, [...new Set([...keep, ...fresh.keys])], { ...st.reasons, ...fresh.reasons });
  }, [goals, today, capacity, byKey, allItems]);

  const picked = store.day === today ? store.keys : [];
  const inRoute = useMemo(() => picked.flatMap(k => { const i = byKey.get(k); return i ? [i] : []; }), [picked, byKey]);
  const fasting = frame.fasting;
  const stops = useMemo(() => orderStops(inRoute, picked, fasting ? (i) => windowRank(i.blockId ? studyBlockWindow(i.blockId.split('_')[2] === 't' ? 'tekrar' : 'yeni') : windowOf(i.type, i.title)) : undefined), [inRoute, picked, fasting]);
  const done = stops.filter(s => s.done).length;
  const total = stops.length;

  useEffect(() => {
    if (total > 0) useDayRouteStore.getState().log(today, total, done);
  }, [today, total, done]);

  const inSet = new Set(picked);
  const spareList = useMemo(() => composeRoute(goals.map(g => ({ ...g, items: g.items.filter(i => !inSet.has(i.key) && !i.done) })), 1, today), [goals, picked, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const planCount: Record<string, number> = {};
  for (const s of stops) planCount[s.slot] = (planCount[s.slot] ?? 0) + 1;
  const yesterdayKey = store.history.filter(h => h.day < today).pop() ?? null;

  return {
    goalCount: goals.length,
    stops,
    current: stops.find(s => !s.done) ?? null,
    reasons: store.reasons,
    done,
    total,
    minutesLeft: stops.filter(s => !s.done).reduce((a, s) => a + s.minutes, 0),
    minutesDone: stops.filter(s => s.done).reduce((a, s) => a + s.minutes, 0),
    goalsTouched: new Set(stops.filter(s => s.done).map(s => s.slot)).size,
    complete: total > 0 && done >= total,
    resting: goals.filter(g => g.items.some(i => !i.done) && !planCount[g.slot]).map(g => ({ slot: g.slot, goal: g.goal })),
    spare: spareList.keys[0] ? { key: spareList.keys[0], reason: spareList.reasons[spareList.keys[0]] ?? 'next' } : null,
    weekDone: weekRoutes(store.history, today),
    yesterday: yesterdayKey,
    capacity,
    planCount,
  };
}
