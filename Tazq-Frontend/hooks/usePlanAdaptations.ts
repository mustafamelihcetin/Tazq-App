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
import { buildDailyTasks, DailyPlanSpec, PlanKind } from '../utils/dailyPlanEngine';
import { runPlanMigrationOnce } from '../utils/planMigration';

const LAST_RUN_KEY = 'plan_adaptations_last_run';

async function shouldRunToday(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(LAST_RUN_KEY);
    if (!last) return true;
    const today = new Date().toISOString().split('T')[0];
    return last !== today;
  } catch {
    return true;
  }
}

async function markRanToday() {
  const today = new Date().toISOString().split('T')[0];
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

  const applyTasks = useCallback(async (
    newTasks: ReturnType<typeof buildKiloAdaptationTasks>,
    planMode: 'spor' | 'spor2' | 'spor3' | 'exam' | 'exam2' | 'exam3' | 'tez' | 'mulakat' | 'mulakat2' | 'mulakat3' | 'ramazan',
    currentTaskIds: number[],
    currentHabitIds: string[],
  ) => {
    if (!newTasks.length) return;
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
    if (created.length) {
      setPlanIds(planMode, currentHabitIds, [...currentTaskIds, ...created]);
    }
  }, [addTask, setPlanIds]);

  const run = useCallback(async (force = false) => {
    if (!force && !(await shouldRunToday())) return;

    const existing = useTaskStore.getState().tasks;

    // ── KILO ────────────────────────────────────────────────────────────────
    if (seasonal.sporMode && seasonal.sporGoal) {
      const sporType = detectSporTypeLocal(seasonal.sporGoal);

      if (sporType === 'kilo') {
        const cw = parseFloat(currentWeight) || 0;
        const tw = parseFloat(targetWeight) || 0;
        if (cw > 0 && tw > 0 && weightLog.length > 0) {
          const analysis = analyzeKiloProgress(weightLog, cw, tw);
          const newTasks = buildKiloAdaptationTasks(analysis, cw, tw, existing, lang);
          await applyTasks(newTasks, 'spor', sporPlanTaskIds, sporPlanHabitIds);
        }
      } else if (sporType === 'maraton') {
        const daysLeft = seasonal.sporDate ? daysUntil(seasonal.sporDate) : 0;
        const sporState = useSporStore.getState();
        const wkm = parseFloat(sporState.weeklyKm) || 30;
        const targetEvent = sporState.targetEvent || '10K';
        // Plan başlangıcından bu yana geçen hafta sayısı
        const weeksIn = 0;
        const newTasks = buildMaratonAdaptationTasks(wkm, targetEvent, daysLeft, weeksIn, 0.7, existing, lang);
        await applyTasks(newTasks, 'spor', sporPlanTaskIds, sporPlanHabitIds);
      } else if ((sporType === 'guc' || sporType === 'genel') && seasonal.sporDate) {
        // Plan başlangıcını tahmin et: sporDate'den geriye 12 hafta
        const daysLeft = daysUntil(seasonal.sporDate);
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
      { active: seasonal.examMode, name: seasonal.examName, date: seasonal.examDate, taskIds: examPlanTaskIds, habitIds: examPlanHabitIds, mode: 'exam' as const },
      { active: !!seasonal.exam2Name && !!seasonal.exam2Date, name: seasonal.exam2Name, date: seasonal.exam2Date, taskIds: exam2PlanTaskIds, habitIds: exam2PlanHabitIds, mode: 'exam2' as const },
      { active: !!seasonal.exam3Name && !!seasonal.exam3Date, name: seasonal.exam3Name, date: seasonal.exam3Date, taskIds: exam3PlanTaskIds, habitIds: exam3PlanHabitIds, mode: 'exam3' as const },
    ];
    for (const slot of examSlots) {
      if (slot.active && slot.name && slot.date) {
        const daysLeft = daysUntil(slot.date);
        const newTasks = buildSinavAdaptationTasks(slot.name, daysLeft, existing, lang);
        await applyTasks(newTasks, slot.mode, slot.taskIds, slot.habitIds);
      }
    }

    // ── TEZ ─────────────────────────────────────────────────────────────────
    if (seasonal.tezMode && seasonal.tezName && seasonal.tezDate) {
      const daysLeft = daysUntil(seasonal.tezDate);
      const newTasks = buildTezAdaptationTasks(seasonal.tezName, daysLeft, existing, lang);
      await applyTasks(newTasks, 'tez', tezPlanTaskIds, tezPlanHabitIds);
    }

    // ── MÜLAKAT ─────────────────────────────────────────────────────────────
    const mulakatSlots = [
      { active: seasonal.mulakatMode, name: seasonal.mulakatName, date: seasonal.mulakatDate, taskIds: mulakatPlanTaskIds, habitIds: mulakatPlanHabitIds, mode: 'mulakat' as const },
      { active: !!seasonal.mulakat2Name && !!seasonal.mulakat2Date, name: seasonal.mulakat2Name, date: seasonal.mulakat2Date, taskIds: mulakat2PlanTaskIds, habitIds: mulakat2PlanHabitIds, mode: 'mulakat2' as const },
      { active: !!seasonal.mulakat3Name && !!seasonal.mulakat3Date, name: seasonal.mulakat3Name, date: seasonal.mulakat3Date, taskIds: mulakat3PlanTaskIds, habitIds: mulakat3PlanHabitIds, mode: 'mulakat3' as const },
    ];
    for (const slot of mulakatSlots) {
      if (slot.active && slot.name && slot.date) {
        const daysLeft = daysUntil(slot.date);
        const newTasks = buildMulakatAdaptationTasks(slot.name, daysLeft, existing, lang);
        await applyTasks(newTasks, slot.mode, slot.taskIds, slot.habitIds);
      }
    }

    // ── RAMAZAN ─────────────────────────────────────────────────────────────
    if (seasonal.ramazan && ramazanPlanTaskIds.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const activeRamazan = RAMAZAN.find(r => today >= r.start && today <= r.end);
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
    if (seasonal.tezMode && seasonal.tezName && seasonal.tezDate) {
      dailySlots.push({
        spec: { kind: 'tez', name: seasonal.tezName, daysLeft: daysUntil(seasonal.tezDate), dailyMinutes: planSpecs.tez?.dailyMinutes, templateId: planSpecs.tez?.templateId },
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
      { goal: seasonal.sporMode ? seasonal.sporGoal : '', date: seasonal.sporDate, taskIds: sporPlanTaskIds, habitIds: sporPlanHabitIds, mode: 'spor' as const },
      { goal: seasonal.spor2Goal, date: seasonal.spor2Date, taskIds: spor2PlanTaskIds, habitIds: spor2PlanHabitIds, mode: 'spor2' as const },
      { goal: seasonal.spor3Goal, date: seasonal.spor3Date, taskIds: spor3PlanTaskIds, habitIds: spor3PlanHabitIds, mode: 'spor3' as const },
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
    if (seasonal.ramazan) {
      const todayStr = today.toISOString().split('T')[0];
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
  }, []); // Yalnızca mount'ta

  return { runAdaptations: run };
}
