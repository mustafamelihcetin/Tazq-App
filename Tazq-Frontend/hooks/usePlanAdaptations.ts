/**
 * usePlanAdaptations
 *
 * App açılışında + kilo girişi sonrası çalışır.
 * Her aktif plan için planAdaptations.ts'den üretilen görevleri
 * TaskService üzerinden oluşturur ve ilgili plan ID listesine ekler.
 *
 * Duplicate koruması: her adaptasyon tag'i hem mevcut görev listesinde
 * hem de AsyncStorage'da (son çalışma tarihi) kontrol edilir.
 */

import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrefsStore } from '../store/usePrefsStore';
import { useSporStore } from '../store/useSporStore';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { TaskService } from '../services/api';
import {
  analyzeKiloProgress,
  buildKiloAdaptationTasks,
  buildMaratonAdaptationTasks,
  buildSinavAdaptationTasks,
  buildTezAdaptationTasks,
  buildMulakatAdaptationTasks,
  buildGucAdaptationTasks,
  buildRamazanAdaptationTasks,
  detectSporTypeLocal,
  daysUntil,
  Language,
} from '../utils/planAdaptations';
import { RAMAZAN } from '../utils/turkishModes';
import { useCompletionStore } from '../store/useCompletionStore';
import { useOfflineQueue } from '../store/useOfflineQueue';
import { useNetworkStore } from '../store/useNetworkStore';
import { useHabitStore } from '../store/useHabitStore';
import { buildDailyTasks, DailyPlanSpec, PlanKind } from '../utils/dailyPlanEngine';
import { runPlanMigrationOnce } from '../utils/planMigration';

const LAST_RUN_KEY = 'plan_adaptations_last_run';

function getLocalDateString(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function shouldRunToday(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(LAST_RUN_KEY);
    if (!last) return true;
    const today = getLocalDateString();
    return last !== today;
  } catch {
    return true;
  }
}

async function markRanToday() {
  const today = getLocalDateString();
  await AsyncStorage.setItem(LAST_RUN_KEY, today);
}

export function usePlanAdaptations() {
  const {
    seasonal,
    sporPlanTaskIds, sporPlanHabitIds, setPlanIds,
    examPlanTaskIds, examPlanHabitIds,
    exam2PlanTaskIds, exam2PlanHabitIds,
    exam3PlanTaskIds, exam3PlanHabitIds,
    tezPlanTaskIds, tezPlanHabitIds,
    mulakatPlanTaskIds, mulakatPlanHabitIds,
    mulakat2PlanTaskIds, mulakat2PlanHabitIds,
    mulakat3PlanTaskIds, mulakat3PlanHabitIds,
    ramazanPlanTaskIds, ramazanPlanHabitIds,
    spor2PlanTaskIds, spor2PlanHabitIds,
    spor3PlanTaskIds, spor3PlanHabitIds,
    planSpecs,
  } = usePrefsStore();

  const { weightLog, currentWeight, targetWeight } = useSporStore();
  const { tasks, addTask } = useTaskStore();
  const { language } = useLanguageStore();
  const lang = (language || 'tr') as Language;

  const retirePlanTask = useCallback((taskId: number, planMode?: string) => {
    const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
    if (task?.isCompleted) {
      useCompletionStore.getState().record(task.id, task.title, task.completedAt ?? undefined, planMode);
    }
    useTaskStore.getState().removeTask(taskId);
    
    const isOnline = useNetworkStore.getState().isOnline;
    if (!isOnline) {
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
    } else {
      TaskService.deleteTask(taskId).catch(err => {
        if (!err.response) {
          useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
        }
      });
    }
  }, []);

  const applyTasks = useCallback(async (
    newTasks: ReturnType<typeof buildKiloAdaptationTasks>,
    planMode: 'spor' | 'spor2' | 'spor3' | 'exam' | 'exam2' | 'exam3' | 'tez' | 'mulakat' | 'mulakat2' | 'mulakat3' | 'ramazan',
    currentTaskIds: number[],
    currentHabitIds: string[],
  ) => {
    // Prune deleted tasks and habits to keep preference arrays clean and prevent cloud/local bloat
    const existingTaskIds = new Set(useTaskStore.getState().tasks.map(t => t.id));
    const prunedTaskIds = currentTaskIds.filter(id => existingTaskIds.has(id));

    const existingHabitIds = new Set(useHabitStore.getState().habits.map(h => h.id));
    const prunedHabitIds = currentHabitIds.filter(id => existingHabitIds.has(id));

    if (!newTasks.length) {
      if (prunedTaskIds.length !== currentTaskIds.length || prunedHabitIds.length !== currentHabitIds.length) {
        setPlanIds(planMode, prunedHabitIds, prunedTaskIds);
      }
      return;
    }

    const created: number[] = [];
    for (const payload of newTasks) {
      try {
        const t = await TaskService.createTask(payload);
        if (t?.id) {
          addTask(t);
          created.push(t.id);
        }
      } catch {}
    }
    setPlanIds(planMode, prunedHabitIds, [...prunedTaskIds, ...created]);
  }, [addTask, setPlanIds]);

  const run = useCallback(async (force = false) => {
    // ── PLAN AUTO-CLEANUP ON EXPIRATION ────────────────────────────────────
    const freshPrefs = usePrefsStore.getState();
    const freshSeasonal = freshPrefs.seasonal;
    const now = Date.now();
    const removeHabitFn = useHabitStore.getState().removeHabit;

    // RAMAZAN
    if (freshSeasonal.ramazan) {
      const stillActive = RAMAZAN.some(r => {
        const s = new Date(r.start);
        s.setDate(s.getDate() - 7);
        s.setHours(0, 0, 0, 0);
        const e = new Date(r.end);
        e.setHours(23, 59, 59, 999);
        return now >= s.getTime() && now <= e.getTime();
      });
      if (!stillActive) {
        freshPrefs.ramazanPlanHabitIds.forEach(id => removeHabitFn(id));
        freshPrefs.ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
        freshPrefs.clearPlanIds('ramazan');
        freshPrefs.setSeasonalPref('ramazan', false);
      }
    }

    // EXAMS
    // Exam 1
    if (freshSeasonal.examMode && freshSeasonal.examDate && new Date(freshSeasonal.examDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.examPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
      freshPrefs.clearPlanIds('exam');
      freshPrefs.setSeasonalPref('examName', '');
      freshPrefs.setSeasonalPref('examDate', null);
    }
    // Exam 2
    if (freshSeasonal.exam2Name && freshSeasonal.exam2Date && new Date(freshSeasonal.exam2Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.exam2PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2'));
      freshPrefs.clearPlanIds('exam2');
      freshPrefs.setSeasonalPref('exam2Name', '');
      freshPrefs.setSeasonalPref('exam2Date', null);
    }
    // Exam 3
    if (freshSeasonal.exam3Name && freshSeasonal.exam3Date && new Date(freshSeasonal.exam3Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.exam3PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3'));
      freshPrefs.clearPlanIds('exam3');
      freshPrefs.setSeasonalPref('exam3Name', '');
      freshPrefs.setSeasonalPref('exam3Date', null);
    }
    // Turn off examMode globally if all slots are cleared
    const updatedPrefsAfterExams = usePrefsStore.getState();
    if (updatedPrefsAfterExams.seasonal.examMode && !updatedPrefsAfterExams.seasonal.examDate && !updatedPrefsAfterExams.seasonal.exam2Date && !updatedPrefsAfterExams.seasonal.exam3Date) {
      freshPrefs.setSeasonalPref('examMode', false);
    }

    // TEZ
    if (freshSeasonal.tezMode && freshSeasonal.tezDate && new Date(freshSeasonal.tezDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.tezPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez'));
      freshPrefs.clearPlanIds('tez');
      freshPrefs.setSeasonalPref('tezMode', false);
      freshPrefs.setSeasonalPref('tezName', '');
      freshPrefs.setSeasonalPref('tezDate', null);
    }

    // MULAKATS
    // Mulakat 1
    if (freshSeasonal.mulakatMode && freshSeasonal.mulakatDate && new Date(freshSeasonal.mulakatDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.mulakatPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.mulakatPlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat'));
      freshPrefs.clearPlanIds('mulakat');
      freshPrefs.setSeasonalPref('mulakatName', '');
      freshPrefs.setSeasonalPref('mulakatDate', null);
    }
    // Mulakat 2
    if (freshSeasonal.mulakat2Name && freshSeasonal.mulakat2Date && new Date(freshSeasonal.mulakat2Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.mulakat2PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.mulakat2PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat2'));
      freshPrefs.clearPlanIds('mulakat2');
      freshPrefs.setSeasonalPref('mulakat2Name', '');
      freshPrefs.setSeasonalPref('mulakat2Date', null);
    }
    // Mulakat 3
    if (freshSeasonal.mulakat3Name && freshSeasonal.mulakat3Date && new Date(freshSeasonal.mulakat3Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.mulakat3PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.mulakat3PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat3'));
      freshPrefs.clearPlanIds('mulakat3');
      freshPrefs.setSeasonalPref('mulakat3Name', '');
      freshPrefs.setSeasonalPref('mulakat3Date', null);
    }
    // Turn off mulakatMode globally if all slots are cleared
    const updatedPrefsAfterMulakats = usePrefsStore.getState();
    if (updatedPrefsAfterMulakats.seasonal.mulakatMode && !updatedPrefsAfterMulakats.seasonal.mulakatDate && !updatedPrefsAfterMulakats.seasonal.mulakat2Date && !updatedPrefsAfterMulakats.seasonal.mulakat3Date) {
      freshPrefs.setSeasonalPref('mulakatMode', false);
    }

    // SPORS
    // Spor 1
    if (freshSeasonal.sporMode && freshSeasonal.sporDate && new Date(freshSeasonal.sporDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.sporPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.sporPlanTaskIds.forEach(id => retirePlanTask(id, 'spor'));
      freshPrefs.clearPlanIds('spor');
      freshPrefs.setSeasonalPref('sporGoal', '');
      freshPrefs.setSeasonalPref('sporDate', null);
    }
    // Spor 2
    if (freshSeasonal.spor2Goal && freshSeasonal.spor2Date && new Date(freshSeasonal.spor2Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.spor2PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.spor2PlanTaskIds.forEach(id => retirePlanTask(id, 'spor2'));
      freshPrefs.clearPlanIds('spor2');
      freshPrefs.setSeasonalPref('spor2Goal', '');
      freshPrefs.setSeasonalPref('spor2Date', null);
    }
    // Spor 3
    if (freshSeasonal.spor3Goal && freshSeasonal.spor3Date && new Date(freshSeasonal.spor3Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.spor3PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.spor3PlanTaskIds.forEach(id => retirePlanTask(id, 'spor3'));
      freshPrefs.clearPlanIds('spor3');
      freshPrefs.setSeasonalPref('spor3Goal', '');
      freshPrefs.setSeasonalPref('spor3Date', null);
    }
    // Turn off sporMode globally if all slots are cleared
    const updatedPrefsAfterSpors = usePrefsStore.getState();
    if (updatedPrefsAfterSpors.seasonal.sporMode && !updatedPrefsAfterSpors.seasonal.sporDate && !updatedPrefsAfterSpors.seasonal.spor2Date && !updatedPrefsAfterSpors.seasonal.spor3Date) {
      freshPrefs.setSeasonalPref('sporMode', false);
    }

    // Sync to cloud if any preferences were changed
    const finalPrefs = usePrefsStore.getState();
    if (JSON.stringify(freshSeasonal) !== JSON.stringify(finalPrefs.seasonal)) {
      finalPrefs.syncToCloud().catch(() => {});
    }

    if (!force && !(await shouldRunToday())) return;

    let existing = useTaskStore.getState().tasks;
    const activePrefs = usePrefsStore.getState();
    const activeSeasonal = activePrefs.seasonal;

    // ── AUTO-CLEANUP OVERDUE INCOMPLETE PLAN TASKS ─────────────────────────
    const logicalToday = new Date();
    logicalToday.setHours(logicalToday.getHours() - 3);
    const todayStart = new Date(logicalToday);
    todayStart.setHours(0, 0, 0, 0);

    const planTaskIdSet = new Set<number>([
      ...activePrefs.examPlanTaskIds,
      ...activePrefs.exam2PlanTaskIds,
      ...activePrefs.exam3PlanTaskIds,
      ...activePrefs.tezPlanTaskIds,
      ...activePrefs.mulakatPlanTaskIds,
      ...activePrefs.mulakat2PlanTaskIds,
      ...activePrefs.mulakat3PlanTaskIds,
      ...activePrefs.sporPlanTaskIds,
      ...activePrefs.spor2PlanTaskIds,
      ...activePrefs.spor3PlanTaskIds,
      ...activePrefs.ramazanPlanTaskIds,
    ]);

    const oldPlanTasks = existing.filter(t => {
      if (t.isCompleted) return false;
      if (!t.dueDate || t.dueDate.startsWith('0001')) return false;

      const isPast = new Date(t.dueDate).getTime() < todayStart.getTime();
      if (!isPast) return false;

      const isPlanTask = planTaskIdSet.has(t.id) || (t.tags && t.tags.some(tag =>
        ['exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3', 'spor', 'spor2', 'spor3', 'ramazan', 'yks', 'kpss'].includes(tag)
      ));
      
      const isWeightEntry = t.tags?.includes('weight_entry');

      return isPlanTask && !isWeightEntry;
    });

    oldPlanTasks.forEach(task => {
      const modeTag = task.tags?.find(tag =>
        ['exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3', 'spor', 'spor2', 'spor3', 'ramazan', 'yks', 'kpss'].includes(tag)
      );
      retirePlanTask(task.id, modeTag);
    });

    // Refresh existing list after cleanup to avoid duplication downstream
    existing = useTaskStore.getState().tasks;

    // ── KILO ────────────────────────────────────────────────────────────────
    if (activeSeasonal.sporMode && activeSeasonal.sporGoal) {
      const sporType = detectSporTypeLocal(activeSeasonal.sporGoal);

      if (sporType === 'kilo') {
        const cw = parseFloat(currentWeight) || 0;
        const tw = parseFloat(targetWeight) || 0;
        if (cw > 0 && tw > 0 && weightLog.length > 0) {
          const analysis = analyzeKiloProgress(weightLog, cw, tw);
          const newTasks = buildKiloAdaptationTasks(analysis, cw, tw, existing, lang);
          await applyTasks(newTasks, 'spor', sporPlanTaskIds, sporPlanHabitIds);
        }
      } else if (sporType === 'maraton') {
        const daysLeft = activeSeasonal.sporDate ? daysUntil(activeSeasonal.sporDate) : 0;
        const sporState = useSporStore.getState();
        const wkm = parseFloat(sporState.weeklyKm) || 30;
        const targetEvent = sporState.targetEvent || '10K';
        // Plan başlangıcından bu yana geçen hafta sayısı
        const weeksIn = 0;
        const newTasks = buildMaratonAdaptationTasks(wkm, targetEvent, daysLeft, weeksIn, 0.7, existing, lang);
        await applyTasks(newTasks, 'spor', sporPlanTaskIds, sporPlanHabitIds);
      } else if ((sporType === 'guc' || sporType === 'genel') && activeSeasonal.sporDate) {
        // Plan başlangıcını tahmin et: sporDate'den geriye 12 hafta
        const daysLeft = daysUntil(activeSeasonal.sporDate);
        const PLAN_WEEKS = 12;
        const weeksLeft = Math.ceil(daysLeft / 7);
        const weeksElapsed = Math.max(0, PLAN_WEEKS - weeksLeft);
        const td = useSporStore.getState().trainingDays ?? 3;
        const newTasks = buildGucAdaptationTasks(weeksElapsed, td, existing, lang);
        await applyTasks(newTasks, 'spor', sporPlanTaskIds, sporPlanHabitIds);
      }
    }

    // ── SINAV ───────────────────────────────────────────────────────────────
    const examSlots = [
      { active: activeSeasonal.examMode, name: activeSeasonal.examName, date: activeSeasonal.examDate, taskIds: examPlanTaskIds, habitIds: examPlanHabitIds, mode: 'exam' as const },
      { active: !!activeSeasonal.exam2Name && !!activeSeasonal.exam2Date, name: activeSeasonal.exam2Name, date: activeSeasonal.exam2Date, taskIds: exam2PlanTaskIds, habitIds: exam2PlanHabitIds, mode: 'exam2' as const },
      { active: !!activeSeasonal.exam3Name && !!activeSeasonal.exam3Date, name: activeSeasonal.exam3Name, date: activeSeasonal.exam3Date, taskIds: exam3PlanTaskIds, habitIds: exam3PlanHabitIds, mode: 'exam3' as const },
    ];
    for (const slot of examSlots) {
      if (slot.active && slot.name && slot.date) {
        const daysLeft = daysUntil(slot.date);
        const newTasks = buildSinavAdaptationTasks(slot.name, daysLeft, existing, lang);
        await applyTasks(newTasks, slot.mode, slot.taskIds, slot.habitIds);
      }
    }

    // ── TEZ ─────────────────────────────────────────────────────────────────
    if (activeSeasonal.tezMode && activeSeasonal.tezName && activeSeasonal.tezDate) {
      const daysLeft = daysUntil(activeSeasonal.tezDate);
      const newTasks = buildTezAdaptationTasks(activeSeasonal.tezName, daysLeft, existing, lang);
      await applyTasks(newTasks, 'tez', tezPlanTaskIds, tezPlanHabitIds);
    }

    // ── MÜLAKAT ─────────────────────────────────────────────────────────────
    const mulakatSlots = [
      { active: activeSeasonal.mulakatMode, name: activeSeasonal.mulakatName, date: activeSeasonal.mulakatDate, taskIds: mulakatPlanTaskIds, habitIds: mulakatPlanHabitIds, mode: 'mulakat' as const },
      { active: !!activeSeasonal.mulakat2Name && !!activeSeasonal.mulakat2Date, name: activeSeasonal.mulakat2Name, date: activeSeasonal.mulakat2Date, taskIds: mulakat2PlanTaskIds, habitIds: mulakat2PlanHabitIds, mode: 'mulakat2' as const },
      { active: !!activeSeasonal.mulakat3Name && !!activeSeasonal.mulakat3Date, name: activeSeasonal.mulakat3Name, date: activeSeasonal.mulakat3Date, taskIds: mulakat3PlanTaskIds, habitIds: mulakat3PlanHabitIds, mode: 'mulakat3' as const },
    ];
    for (const slot of mulakatSlots) {
      if (slot.active && slot.name && slot.date) {
        const daysLeft = daysUntil(slot.date);
        const newTasks = buildMulakatAdaptationTasks(slot.name, daysLeft, existing, lang);
        await applyTasks(newTasks, slot.mode, slot.taskIds, slot.habitIds);
      }
    }

    // ── RAMAZAN ─────────────────────────────────────────────────────────────
    if (activeSeasonal.ramazan && ramazanPlanTaskIds.length > 0) {
      const todayStr = getLocalDateString();
      const activeRamazan = RAMAZAN.find(r => todayStr >= r.start && todayStr <= r.end);
      if (activeRamazan) {
        const daysToEnd = daysUntil(activeRamazan.end);
        const newTasks = buildRamazanAdaptationTasks(daysToEnd, existing, lang);
        await applyTasks(newTasks, 'ramazan', ramazanPlanTaskIds, ramazanPlanHabitIds);
      }
    }

    // ── GÜNLÜK PLAN MOTORU ────────────────────────────────────────────────────
    // Her aktif plan için BUGÜNÜN görevlerini üretir (faz/ilerlemeye göre).
    // hasDailyToday içte kontrol edildiği için aynı gün tekrar çağrılsa da çoğaltmaz.
    const today = new Date();
    today.setHours(today.getHours() - 3); // 3-hour buffer for night owls
    const fresh = useTaskStore.getState().tasks;

    const sporKind = (goal: string): PlanKind => {
      const t = detectSporTypeLocal(goal);
      return t === 'yaris' ? 'genel' : t;
    };

    const dailySlots: { spec: DailyPlanSpec; mode: Parameters<typeof applyTasks>[1]; taskIds: number[]; habitIds: string[] }[] = [];

    // Sınav slotları
    for (const slot of examSlots) {
      if (slot.active && slot.name && slot.date) {
        dailySlots.push({
          spec: { kind: 'exam', name: slot.name, daysLeft: daysUntil(slot.date), dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
          mode: slot.mode, taskIds: slot.taskIds, habitIds: slot.habitIds,
        });
      }
    }
    // Tez
    if (activeSeasonal.tezMode && activeSeasonal.tezName && activeSeasonal.tezDate) {
      dailySlots.push({
        spec: { kind: 'tez', name: activeSeasonal.tezName, daysLeft: daysUntil(activeSeasonal.tezDate), dailyMinutes: planSpecs.tez?.dailyMinutes, templateId: planSpecs.tez?.templateId },
        mode: 'tez', taskIds: tezPlanTaskIds, habitIds: tezPlanHabitIds,
      });
    }
    // Mülakat slotları
    for (const slot of mulakatSlots) {
      if (slot.active && slot.name && slot.date) {
        dailySlots.push({
          spec: { kind: 'mulakat', name: slot.name, daysLeft: daysUntil(slot.date), dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
          mode: slot.mode, taskIds: slot.taskIds, habitIds: slot.habitIds,
        });
      }
    }
    // Spor slotları (kilo/maraton/güç/genel)
    const sporSlots = [
      { goal: activeSeasonal.sporMode ? activeSeasonal.sporGoal : '', date: activeSeasonal.sporDate, taskIds: sporPlanTaskIds, habitIds: sporPlanHabitIds, mode: 'spor' as const },
      { goal: activeSeasonal.spor2Goal, date: activeSeasonal.spor2Date, taskIds: spor2PlanTaskIds, habitIds: spor2PlanHabitIds, mode: 'spor2' as const },
      { goal: activeSeasonal.spor3Goal, date: activeSeasonal.spor3Date, taskIds: spor3PlanTaskIds, habitIds: spor3PlanHabitIds, mode: 'spor3' as const },
    ];
    for (const slot of sporSlots) {
      if (slot.goal && slot.date) {
        dailySlots.push({
          spec: { kind: sporKind(slot.goal), daysLeft: daysUntil(slot.date), dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
          mode: slot.mode, taskIds: slot.taskIds, habitIds: slot.habitIds,
        });
      }
    }
    // Ramazan (aktif dönemdeyse)
    if (activeSeasonal.ramazan) {
      const todayStr = getLocalDateString(today);
      const activeRamazan = RAMAZAN.find(r => todayStr >= r.start && todayStr <= r.end);
      if (activeRamazan) {
        dailySlots.push({
          spec: { kind: 'ramazan', daysLeft: daysUntil(activeRamazan.end), dailyMinutes: planSpecs.ramazan?.dailyMinutes, templateId: planSpecs.ramazan?.templateId },
          mode: 'ramazan', taskIds: ramazanPlanTaskIds, habitIds: ramazanPlanHabitIds,
        });
      }
    }

    for (const ds of dailySlots) {
      const daily = buildDailyTasks(ds.spec, fresh, lang, today);
      await applyTasks(daily, ds.mode, ds.taskIds, ds.habitIds);
    }

    await markRanToday();
  }, [
    seasonal, weightLog, currentWeight, targetWeight, lang,
    sporPlanTaskIds, sporPlanHabitIds,
    examPlanTaskIds, examPlanHabitIds,
    exam2PlanTaskIds, exam2PlanHabitIds,
    exam3PlanTaskIds, exam3PlanHabitIds,
    tezPlanTaskIds, tezPlanHabitIds,
    mulakatPlanTaskIds, mulakatPlanHabitIds,
    mulakat2PlanTaskIds, mulakat2PlanHabitIds,
    mulakat3PlanTaskIds, mulakat3PlanHabitIds,
    ramazanPlanTaskIds, ramazanPlanHabitIds,
    spor2PlanTaskIds, spor2PlanHabitIds,
    spor3PlanTaskIds, spor3PlanHabitIds,
    planSpecs,
    applyTasks,
  ]);

  useEffect(() => {
    // Kullanıcı giriş yapmış ve task'lar yüklenmişse çalıştır
    const { user } = useAuthStore.getState();
    if (user) {
      // Önce tek seferlik migrasyon (eski gelecek-tarihli döküm görevlerini temizle),
      // sonra günlük üretimi çalıştır.
      runPlanMigrationOnce().finally(() => run());
    }

    const handleAppStateChange = (nextStatus: string) => {
      if (nextStatus === 'active') {
        const { user: currentUser } = useAuthStore.getState();
        if (currentUser) {
          run();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [run]);

  return { runAdaptations: run };
}
