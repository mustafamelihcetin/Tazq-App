import type { StudyRelief } from '@/features/modes/utils/ramadanBrain';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swallow } from '@/shared/utils/swallow';
import {
  addExtraBlock, confirmMissed, Course, dismissNotice, emptyCore, invalidate, mergeCloud, reconcileTasks, setBlockDone, skipBlock, SlotInput, StudyCloud, StudyCore, syncCore, toCloud, unitsOfPlan,
} from '../utils/planCore';
import { dayNum, emptyUnitState, ensureTopics, extendTopic, initTopic, markTopicDone, reopenTopic, StartLevel, UnitState } from '../utils/scheduler';
import { applyMock, MockRecord } from '../utils/mockScore';
import type { ScoreModel } from '../data/blueprints';

/*
  SINAV PLANI DEPOSU (2026-11-05). Karar veren kod planCore'da (saf, test edilir); burası saklar ve buluta bildirir. Ayarı değiştiren her
  eylem geleceği yeniden kurar; "bugün sabit" kuralı yalnız kullanıcı istediğinde (replanToday) esner.
*/
interface StudyPlanState extends StudyCore {
  sync: (slots: SlotInput[], today: string, opts?: { replan?: boolean; replanToday?: boolean; relief?: StudyRelief | null }) => void;
  reconcile: (tasks: { tags?: string[] | null; isCompleted?: boolean }[], today: string) => void;
  toggleBlock: (day: string, id: string, done: boolean) => void;
  skip: (day: string, id: string, skipped?: boolean) => void;
  addExtra: (today: string) => void;
  setWeek: (week: number[], today: string) => void;
  setClosed: (closed: string[], today: string) => void;
  setLevel: (key: string, subject: string, level: StartLevel, today: string) => void;
  setExcluded: (key: string, id: string, excluded: boolean, today: string) => void;
  setCourses: (key: string, courses: Course[], today: string) => void;
  topicDone: (key: string, unitId: string, topicId: string, rating: 'kolay' | 'orta' | 'zor', today: string) => void;
  topicMore: (key: string, unitId: string, topicId: string, today: string) => void;
  topicReset: (key: string, unitId: string, topicId: string, today: string) => void;
  markReviewed: (key: string) => void;
  addMock: (key: string, rec: MockRecord, score: ScoreModel, today: string) => void;
  removeMock: (key: string, id: string) => void;
  resetPlan: (key: string, today: string) => void;
  confirmMissedWork: (today: string) => void;
  clearNotice: () => void;
  cloudSnapshot: () => StudyCloud;
  applyCloud: (cloud: StudyCloud | null | undefined) => void;
  reset: () => void;
}

const pushCloud = () => {
  try { void require('@/features/modes/store/usePrefsStore').usePrefsStore.getState().syncToCloud(); } catch (e) { swallow('studyPlan.pushCloud', e); }
};

const coreOf = (s: StudyPlanState): StudyCore => ({ relief: s.relief, week: s.week, weekAt: s.weekAt, closed: s.closed, plans: s.plans, committed: s.committed, dayStats: s.dayStats, lastActive: s.lastActive, missed: s.missed, notice: s.notice });

export const useStudyPlanStore = create<StudyPlanState>()(
  persist(
    (set, get) => {
      /** Ayar değişti: bugünün kalanı dahil yeniden kurulur, yapılanlar durur. */
      const replan = (next: StudyCore, today: string) => {
        const slots = Object.values(next.plans).filter(p => p.slot).map((p): SlotInput => ({ slot: p.slot as string, name: p.name, date: p.examDate, paused: p.paused }));
        set(syncCore(invalidate(next, today, true), slots, today, Date.now()));
        pushCloud();
      };
      const updatePlan = (key: string, fn: (p: StudyCore['plans'][string]) => StudyCore['plans'][string], today: string) => {
        const core = coreOf(get());
        const p = core.plans[key];
        if (!p) return;
        replan({ ...core, plans: { ...core.plans, [key]: { ...fn(p), at: Date.now() } } }, today);
      };
      const updateUnit = (key: string, unitId: string, fn: (u: UnitState, day: number) => UnitState, today: string) => {
        updatePlan(key, p => {
          const unit = unitsOfPlan(p).find(u => u.id === unitId);
          if (!unit) return p;
          const day = dayNum(today);
          const base = ensureTopics(unit, p.states[unitId] ?? emptyUnitState(), t => p.levels[t.subject] ?? 'yok', Date.now(), day);
          return { ...p, states: { ...p.states, [unitId]: fn(base, day) } };
        }, today);
      };
      return {
        ...emptyCore(),
        sync: (slots, today, opts) => {
          const before = get();
          const next = syncCore(coreOf(before), slots, today, Date.now(), opts);
          set(next);
          if (Object.keys(next.dayStats).length !== Object.keys(before.dayStats).length) pushCloud();
        },
        reconcile: (tasks, today) => {
          const core = coreOf(get());
          const next = reconcileTasks(core, tasks, today);
          if (next !== core) set(next);
        },
        toggleBlock: (day, id, done) => set(setBlockDone(coreOf(get()), day, id, done)),
        skip: (day, id, skipped = true) => set(skipBlock(coreOf(get()), day, id, skipped)),
        addExtra: (today) => set(addExtraBlock(coreOf(get()), today)),
        setWeek: (week, today) => replan({ ...coreOf(get()), week, weekAt: Date.now() }, today),
        setClosed: (closed, today) => replan({ ...coreOf(get()), closed, weekAt: Date.now() }, today),
        setLevel: (key, subject, level, today) => updatePlan(key, p => {
          // Henüz başlanmamış konular yeni seviyeye taşınır; emek verilmiş konuya dokunulmaz.
          const states: Record<string, UnitState> = { ...p.states };
          const day = dayNum(today);
          for (const u of unitsOfPlan(p)) {
            const st = states[u.id];
            if (!st) continue;
            const topics = { ...st.topics };
            for (const t of u.topics) if (t.subject === subject && (!topics[t.id] || topics[t.id].lastTouch == null || topics[t.id].lastTouch === day - 30)) topics[t.id] = initTopic(t, level, Date.now(), day);
            states[u.id] = { ...st, topics };
          }
          return { ...p, states, levels: { ...p.levels, [subject]: level } };
        }, today),
        setExcluded: (key, id, excluded, today) => updatePlan(key, p => ({ ...p, excluded: excluded ? [...p.excluded.filter(x => x !== id), id] : p.excluded.filter(x => x !== id) }), today),
        setCourses: (key, courses, today) => updatePlan(key, p => ({ ...p, courses }), today),
        topicDone: (key, unitId, topicId, rating, today) => updateUnit(key, unitId, (u, d) => markTopicDone(u, topicId, rating, d, Date.now()), today),
        topicMore: (key, unitId, topicId, today) => updateUnit(key, unitId, u => extendTopic(u, topicId, Date.now()), today),
        topicReset: (key, unitId, topicId, today) => updateUnit(key, unitId, u => reopenTopic(u, topicId, Date.now()), today),
        markReviewed: (key) => set(s => (s.plans[key] ? { plans: { ...s.plans, [key]: { ...s.plans[key], reviewed: true } } } : {})),
        addMock: (key, rec, score, today) => updatePlan(key, p => {
          const unit = unitsOfPlan(p).find(u => u.id === rec.unitId);
          const day = dayNum(rec.day);
          const base = unit ? ensureTopics(unit, p.states[rec.unitId] ?? emptyUnitState(), t => p.levels[t.subject] ?? 'yok', Date.now(), day) : p.states[rec.unitId];
          return { ...p, mocks: [...p.mocks, rec], states: base ? { ...p.states, [rec.unitId]: applyMock(base, rec, score, day, Date.now()) } : p.states };
        }, today),
        removeMock: (key, id) => { set(s => (s.plans[key] ? { plans: { ...s.plans, [key]: { ...s.plans[key], mocks: s.plans[key].mocks.filter(m => m.id !== id), removedMocks: [...(s.plans[key].removedMocks ?? []), id], at: Date.now() } } } : {})); pushCloud(); },
        resetPlan: (key, today) => updatePlan(key, p => ({ ...p, states: {}, mocks: [], removedMocks: [...(p.removedMocks ?? []), ...p.mocks.map(m => m.id)], levels: {}, excluded: [], reviewed: false }), today),
        confirmMissedWork: (today) => { set(confirmMissed(coreOf(get()), today, Date.now())); pushCloud(); },
        clearNotice: () => set(dismissNotice(coreOf(get()))),
        cloudSnapshot: () => toCloud(coreOf(get())),
        applyCloud: (cloud) => set(mergeCloud(coreOf(get()), cloud)),
        reset: () => set(emptyCore()),
      };
    },
    {
      name: 'tazq-study-plan',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => coreOf(s as StudyPlanState),
    },
  ),
);
