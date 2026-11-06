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

import { appDayKey, logicalNow } from '@/shared/utils/appDay';
import { ramadanCloseAfter, ramadanFrameNow, ramadanRangesNow } from '@/features/modes/utils/ramadanPreview';
import { overdueAction, PLAN_MODE_TAGS } from '@/features/modes/utils/goalRows';
import { budgetFor } from '@/features/modes/utils/ramadanBrain';
import { lightDayFor, noteIgnored, noteShown, startPlanAffinityBridge, usePlanAffinityStore } from '@/features/modes/store/usePlanAffinityStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { modeRoomLeft, routinesToRest } from '@/features/habits/utils/habitLimit';
import { HABIT_LIMIT_COPY } from '@/features/habits/utils/habitLimitCopy';
import { useStagedPlanStore } from '@/features/modes/store/useStagedPlanStore';
import { useCallback, useEffect } from 'react';
import { swallow } from '@/shared/utils/swallow';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrefsStore } from '../store/usePrefsStore';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { useTaskStore } from '@/features/tasks';
import { useAuthStore } from '@/features/user';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { TaskService } from '@/shared/services/api';
import {
  analyzeKiloProgress,
  buildKiloAdaptationTasks,
  buildMaratonAdaptationTasks,
  weeklyTrainingAdherence,
  buildSinavAdaptationTasks,
  buildTezAdaptationTasks,
  buildMulakatAdaptationTasks,
  buildGucAdaptationTasks,
  buildRamazanAdaptationTasks,
  detectSporTypeLocal,
  daysUntil,
  Language,
} from '@/features/modes/utils/planAdaptations';
import { RAMAZAN, getModePreview } from '../utils/turkishModes';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useHabitStore } from '@/features/habits';
import { isSamePlanOccurrence, trimToPlanBudget, buildDailyTasks, allocatePlanBudget, desiredDailyCount, planBudgetFor, DailyPlanSpec, PlanKind } from '@/features/modes/utils/dailyPlanEngine';
import { runPlanMigrationOnce } from '@/features/modes/utils/planMigration';
import { findExamCurriculum, pickSubject, pickTopic, subjectExamLabel } from '@/shared/utils/curriculum';
import { useSubjectStore } from '@/shared/store/useSubjectStore';
import { useBudgetStore, type BudgetType } from '@/shared/store/useBudgetStore';
import { useQuitStore, type QuitType } from '@/shared/store/useQuitStore';
import { buildTasarrufPlan, buildBirakmaPlan } from '@/shared/utils/lifeModePlans';
import { isWeightEntryTask, canLogWeight, daysUntilNextWeight, ensureWeeklyWeightTask, isPhantomKiloPlan } from '@/features/modes/utils/weightCheckin';
import { MODE_TASK_TAGS, PLAN_TAGS, duplicatePlanTasks, planDedupeKey, retireModeTasksByTag } from '@/features/modes/utils/planTaskOps';
import { makeClientKey } from '@/shared/utils/planKey';
import { getExtraPool, ensureExtraPool } from '@/features/modes/utils/planPoolSync';
import { parseDateKey, calendarDayOf } from '@/shared/utils/dateKey';
import { isSlotPausedNow, markPausedHabitsSkipped } from '@/features/modes/utils/pauseOps';
import { releaseStagedPlanItems } from '@/features/modes/utils/stagedRollout';
import { repairStagedQueuesOnce } from '@/features/modes/utils/stagedRepair';
import { isStudyManaged, runStudySync, startStudyPlanBridge, studyBlocksForSlot, studyToday } from '@/features/studyplan/sync';
import { blocksToTasks, isStudyTask } from '@/features/studyplan/utils/planBridge';
import { useStudyPlanStore } from '@/features/studyplan/store/useStudyPlanStore';
import type { StudyBlock } from '@/features/studyplan/utils/planCore';

const LAST_RUN_KEY = 'plan_adaptations_last_run';

// Persist-middleware'li bir store'un AsyncStorage hidrasyonunu bekler.
// Zaten hidrate ise hemen, değilse onFinishHydration ile çözülür (güvenli fallback).
function whenHydrated(store: any): Promise<void> {
  return new Promise<void>((resolve) => {
    const p = store?.persist;
    if (!p || typeof p.hasHydrated !== 'function') return resolve();
    if (p.hasHydrated()) return resolve();
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    try {
      const unsub = p.onFinishHydration?.(() => { unsub?.(); done(); });
    } catch { done(); }
    // Güvenlik ağı: hidrasyon sinyali kaçarsa 3 sn sonra yine de devam et.
    setTimeout(done, 3000);
  });
}

// MODE_TASK_TAGS artik planTaskOps.ts'te (tek kaynak) — kapatma yollari da ayni
// kumeyi kullansin diye oraya tasindi.

function getLocalDateString(d: Date = new Date()): string {
  return appDayKey(d);
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

function dateKey(date?: string | null): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function isPlanGeneratedTask(task: { tags?: string[] | null }): boolean {
  return (task.tags ?? []).some(tag => PLAN_TAGS.includes(tag));
}

// Adaptif zorluk sinyali: son tamamlama davranışından (plan görevleri).
// activeDays7 = son 7 günde en az 1 plan görevi tamamlanan gün sayısı.
// total14 = son 14 gündeki plan tamamlaması sayısı (yeterli geçmiş eşiği).
function computeAdherenceSignal(): { activeDays7: number; total14: number } {
  const events = useCompletionStore.getState().events;
  const now = Date.now();
  const d7 = now - 7 * 86400000;
  const d14 = now - 14 * 86400000;
  const days = new Set<string>();
  let total14 = 0;
  for (const e of events) {
    if (!e.planMode) continue;
    const t = new Date(e.completedAt).getTime();
    if (t >= d14) total14++;
    if (t >= d7) days.add(e.completedAt.slice(0, 10));
  }
  return { activeDays7: days.size, total14 };
}

export { makeClientKey };

function inferBudgetType(name?: string | null): BudgetType {
  if (!name) return '';
  const n = name.toLowerCase();
  if (n.includes('birikim') || n.includes('saving')) return 'birikim';
  if (n.includes('borç') || n.includes('debt') || n.includes('payoff') || n.includes('kapatma')) return 'borc';
  if (n.includes('acil') || n.includes('emergency') || n.includes('fon')) return 'acilfon';
  return 'birikim'; // fallback
}

/**
 * Bir modun habitlerini onar. İki durum:
 *  A) Kayıtlı ID'ler VAR → yalnız eksik olanları eski ID'leriyle geri ekle (mevcut davranış).
 *  B) Kayıtlı ID'ler BOŞ (eski kırılganlıkla kaybolmuş) VE o moda ait yerelde HİÇ habit yok
 *     → şablondan YENİDEN üret + ID'leri buluta geri yaz (bir daha kaybolmasın).
 * (B) yalnız tam-kayıp durumunda çalışır → kullanıcının bilerek sildiği habitleri geri getirmez.
 * storedTaskIds korunur (görevleri ezmemek için).
 */
/** Yeni sınır (bkz. habitLimit) bir kez uygulanır: fazlalar SİLİNMEZ, dinlenir; kullanıcı geri açarsa tekrar kapatılmaz. */
async function applyModeRoutineCaps(lang: 'tr' | 'en'): Promise<void> {
  try {
    if (await AsyncStorage.getItem('tazq-mode-routine-caps-v1')) return;
    await AsyncStorage.setItem('tazq-mode-routine-caps-v1', '1');
    const rest = routinesToRest(useHabitStore.getState().habits);
    if (rest.length === 0) return;
    rest.forEach(h => useHabitStore.getState().pauseHabit(h.id));
    useToastStore.getState().show(HABIT_LIMIT_COPY[lang].modeCapToast(rest.length), 'info');
  } catch (e) { swallow('planAdaptations.modeCaps', e); }
}

function healModeHabits(
  planMode: string,
  templateHabits: any[],
  storedHabitIds: string[],
  storedTaskIds: number[],
  addOne: (h: any, id: string) => void,
): void {
  if (!Array.isArray(templateHabits) || templateHabits.length === 0) return;
  const localHabits = useHabitStore.getState().habits;
  const hasHabit = (id: string) => localHabits.some(h => h.id === id);

  if (storedHabitIds.length > 0) {
    if (!storedHabitIds.some(id => !hasHabit(id))) return; // hepsi mevcut
    templateHabits.forEach((h, i) => {
      const id = storedHabitIds[i];
      if (id && !hasHabit(id)) addOne(h, id);
    });
    return;
  }

  // (B) Boş ID: yalnız o moda ait yerel habit HİÇ yoksa yeniden üret.
  if (localHabits.some(h => h.planMode === planMode)) return;
  // YIĞILMA KÖKÜ (2026-11-05): alışkanlık sırada beklerken kimlik listesi boştur; bu, "plan bozuldu" sanılıp şablonun
  // tamamı ekleniyordu ve kademeli açılım hiçe iniyordu. Sıra varsa onarım yok; yoksa da sınır kadar.
  if ((useStagedPlanStore.getState().queues[planMode]?.items.length ?? 0) > 0) return;
  const ids: string[] = [];
  templateHabits.slice(0, modeRoomLeft(localHabits, planMode)).forEach((h, i) => {
    const id = `habit_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    ids.push(id);
    addOne(h, id);
  });
  if (ids.length > 0) usePrefsStore.getState().setPlanIds(planMode as any, ids, storedTaskIds);
}

function selfHealActiveModes(tr: boolean) {
  const freshPrefs = usePrefsStore.getState();
  const freshSeasonal = freshPrefs.seasonal;
  const currentHabits = useHabitStore.getState().habits;
  const hasHabit = (id: string) => currentHabits.some(h => h.id === id);
  const addHabitFn = useHabitStore.getState().addHabit;
  const taskIdsFor = (mode: string): number[] => ((freshPrefs as any)[`${mode}PlanTaskIds`] ?? []) as number[];

  // 1. RAMAZAN
  const ramazanHasPlan = freshPrefs.ramazanPlanHabitIds.length > 0 || taskIdsFor('ramazan').length > 0;
  if (freshSeasonal.ramazan && ramazanHasPlan) {
    const tId = freshPrefs.planSpecs.ramazan?.templateId;
    const modePreview = getModePreview('ramazan');
    const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
    healModeHabits('ramazan', template.habits, freshPrefs.ramazanPlanHabitIds, taskIdsFor('ramazan'),
      (h, id) => addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, id, 'ramazan', h.nameTr, h.name));
  }

  // 2. EXAMS
  const examSlotsToHeal = [
    { active: freshSeasonal.examMode, name: freshSeasonal.examName, date: freshSeasonal.examDate, habitIds: freshPrefs.examPlanHabitIds, slot: 'exam' as const },
    { active: !!freshSeasonal.exam2Name && !!freshSeasonal.exam2Date, name: freshSeasonal.exam2Name, date: freshSeasonal.exam2Date, habitIds: freshPrefs.exam2PlanHabitIds, slot: 'exam2' as const },
    { active: !!freshSeasonal.exam3Name && !!freshSeasonal.exam3Date, name: freshSeasonal.exam3Name, date: freshSeasonal.exam3Date, habitIds: freshPrefs.exam3PlanHabitIds, slot: 'exam3' as const },
  ];
  for (const slot of examSlotsToHeal) {
    const hasPlan = slot.habitIds.length > 0 || taskIdsFor(slot.slot).length > 0;
    if (slot.active && slot.name && slot.date && hasPlan) {
      const tId = freshPrefs.planSpecs[slot.slot]?.templateId;
      const modePreview = getModePreview('exam', { examName: slot.name, examDate: slot.date });
      const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
      healModeHabits(slot.slot, template.habits, slot.habitIds, taskIdsFor(slot.slot),
        (h, id) => addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, id, slot.slot, h.nameTr, h.name));
    }
  }

  // 3. TEZ
  const tezHasPlan = freshPrefs.tezPlanHabitIds.length > 0 || taskIdsFor('tez').length > 0;
  if (freshSeasonal.tezMode && freshSeasonal.tezName && freshSeasonal.tezDate && tezHasPlan) {
    const tId = freshPrefs.planSpecs.tez?.templateId;
    const modePreview = getModePreview('tez', { tezName: freshSeasonal.tezName, tezDate: freshSeasonal.tezDate });
    const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
    healModeHabits('tez', template.habits, freshPrefs.tezPlanHabitIds, taskIdsFor('tez'),
      (h, id) => addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, id, 'tez', h.nameTr, h.name));
  }

  // 4. MULAKATS
  const mulakatSlotsToHeal = [
    { active: freshSeasonal.mulakatMode, name: freshSeasonal.mulakatName, date: freshSeasonal.mulakatDate, habitIds: freshPrefs.mulakatPlanHabitIds, slot: 'mulakat' as const },
    { active: !!freshSeasonal.mulakat2Name && !!freshSeasonal.mulakat2Date, name: freshSeasonal.mulakat2Name, date: freshSeasonal.mulakat2Date, habitIds: freshPrefs.mulakat2PlanHabitIds, slot: 'mulakat2' as const },
    { active: !!freshSeasonal.mulakat3Name && !!freshSeasonal.mulakat3Date, name: freshSeasonal.mulakat3Name, date: freshSeasonal.mulakat3Date, habitIds: freshPrefs.mulakat3PlanHabitIds, slot: 'mulakat3' as const },
  ];
  for (const slot of mulakatSlotsToHeal) {
    const hasPlan = slot.habitIds.length > 0 || taskIdsFor(slot.slot).length > 0;
    if (slot.active && slot.name && slot.date && hasPlan) {
      const tId = freshPrefs.planSpecs[slot.slot]?.templateId;
      const modePreview = getModePreview('mulakat', { mulakatName: slot.name, mulakatDate: slot.date });
      const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
      healModeHabits(slot.slot, template.habits, slot.habitIds, taskIdsFor(slot.slot),
        (h, id) => addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, id, slot.slot, h.nameTr, h.name));
    }
  }

  // 5. SPORS
  const sporSlotsToHeal = [
    { goal: freshSeasonal.sporMode ? freshSeasonal.sporGoal : '', date: freshSeasonal.sporDate, habitIds: freshPrefs.sporPlanHabitIds, slot: 'spor' as const },
    { goal: freshSeasonal.spor2Goal, date: freshSeasonal.spor2Date, habitIds: freshPrefs.spor2PlanHabitIds, slot: 'spor2' as const },
    { goal: freshSeasonal.spor3Goal, date: freshSeasonal.spor3Date, habitIds: freshPrefs.spor3PlanHabitIds, slot: 'spor3' as const },
  ];
  for (const slot of sporSlotsToHeal) {
    const hasPlan = slot.habitIds.length > 0 || taskIdsFor(slot.slot).length > 0;
    if (slot.goal && slot.date && hasPlan) {
      const tId = freshPrefs.planSpecs[slot.slot]?.templateId;
      const sporState = useSporStore.getState();
      const inputs = {
        currentWeight: parseFloat(sporState.currentWeight) || undefined,
        targetWeight: parseFloat(sporState.targetWeight) || undefined,
        weeklyKm: parseFloat(sporState.weeklyKm) || undefined,
        targetEvent: sporState.targetEvent || undefined,
        trainingDays: sporState.trainingDays || undefined,
        gender: sporState.gender || undefined,
      };
      const modePreview = getModePreview('spor', { sporGoal: slot.goal, sporDate: slot.date, sporInputs: inputs });
      const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
      healModeHabits(slot.slot, template.habits, slot.habitIds, taskIdsFor(slot.slot),
        (h, id) => addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, id, slot.slot, h.nameTr, h.name));
    }
  }

  // 6. TASARRUF
  const tasarrufHasPlan = freshPrefs.tasarrufPlanHabitIds.length > 0 || taskIdsFor('tasarruf').length > 0;
  if (freshSeasonal.tasarrufMode && freshSeasonal.tasarrufName && tasarrufHasPlan) {
    const bStore = useBudgetStore.getState();
    const inferred = inferBudgetType(freshSeasonal.tasarrufName);
    if (bStore.budgetType === '' && inferred) {
      bStore.setBudgetType(inferred);
      bStore.setStartAmount('0');
      bStore.setTargetAmount('1000');
    }
    const typeToUse = bStore.budgetType || inferred || 'birikim';
    const plan = buildTasarrufPlan(typeToUse);
    healModeHabits('tasarruf', plan.habits, freshPrefs.tasarrufPlanHabitIds, taskIdsFor('tasarruf'),
      (h, id) => addHabitFn(h.name, h.emoji, h.color, id, 'tasarruf', h.name, h.nameEn));
  }

  // 7. BIRAKMA
  const birakmaHasPlan = freshPrefs.birakmaPlanHabitIds.length > 0 || taskIdsFor('birakma').length > 0;
  if (freshSeasonal.birakmaMode && freshSeasonal.birakmaName && birakmaHasPlan) {
    const qStore = useQuitStore.getState();
    if (qStore.items.length === 0) {
      const nameStr = freshSeasonal.birakmaName;
      let inferredType: QuitType = 'ozel';
      if (/sigara|smoke/i.test(nameStr)) inferredType = 'sigara';
      else if (/sosyal|social/i.test(nameStr)) inferredType = 'sosyal';
      else if (/seker|sugar|şeker/i.test(nameStr)) inferredType = 'seker';
      else if (/alkol|alcohol/i.test(nameStr)) inferredType = 'alkol';
      else if (/kumar|gambling/i.test(nameStr)) inferredType = 'kumar';
      qStore.addItem(inferredType, nameStr);
    }
    const plan = buildBirakmaPlan('' as QuitType);
    healModeHabits('birakma', plan.habits, freshPrefs.birakmaPlanHabitIds, taskIdsFor('birakma'),
      (h, id) => addHabitFn(h.name, h.emoji, h.color, id, 'birakma', h.name, h.nameEn));
  }
}

/** Bkz. `run` sarmalayıcısındaki not — modül seviyesinde, TÜM hook örnekleri arasında paylaşılır. */
let adaptationRunInFlight: Promise<void> | null = null;

/*
  YAŞAM DÖNGÜSÜNÜN TEK SAHİBİ (2026-11-06, kök neden: KPSS'te 9 kopya görev). Bu kanca dokuz yerde çağrılabiliyor (kök düzen, Modlar,
  Planım, plan penceresi, üç mod kartı, iki kilo penceresi) ve HER örnek kendi öne geliş dinleyicisini kuruyordu. Motor modül kilidiyle
  birleşiyordu ama arkasından gelen kademeli açılım birleşmiyordu: uygulama her öne geldiğinde örnek sayısı kadar paralel görev açılıyordu.
  Artık yalnız `lifecycle` veren kök düzen kendiliğinden çalışır; diğerleri yalnız `runAdaptations` alır.
*/
export function usePlanAdaptations({ lifecycle = false }: { lifecycle?: boolean } = {}) {
  const lifecycleUserId = useAuthStore(s => s.user?.id);
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

  const rolloverPlanTask = useCallback((taskId: number, todayStr: string) => {
    const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedPayload = { ...task, dueDate: todayStr };
    useTaskStore.getState().updateTask(taskId, { dueDate: todayStr });

    const isOnline = useNetworkStore.getState().isOnline;
    if (!isOnline) {
      useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload: updatedPayload });
    } else {
      TaskService.updateTask(taskId, updatedPayload as any).catch(err => {
        if (!err.response) {
          useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload: updatedPayload });
        }
      });
    }
  }, []);

  const applyTasks = useCallback(async (
    newTasks: ReturnType<typeof buildKiloAdaptationTasks>,
    planMode: 'spor' | 'spor2' | 'spor3' | 'exam' | 'exam2' | 'exam3' | 'tez' | 'mulakat' | 'mulakat2' | 'mulakat3' | 'ramazan' | 'tasarruf' | 'birakma',
    currentTaskIds: number[],
    currentHabitIds: string[],
  ) => {
    // Prune deleted tasks and habits to keep preference arrays clean and prevent cloud/local bloat
    const existingTaskIds = new Set(useTaskStore.getState().tasks.map(t => t.id));
    const prunedTaskIds = currentTaskIds.filter(id => existingTaskIds.has(id));

    const localHabits = useHabitStore.getState().habits;
    const existingHabitIds = new Set(localHabits.map(h => h.id));
    // KIRILGANLIK KORUMASI: Yerelde HİÇ habit yoksa (hidrate olmamış / yeni cihaz / logout sonrası)
    // habit ID'lerini BUDAMA — yoksa bulut ID'leri boşa ezilir ve habitler KALICI kaybolur
    // (görevler sunucuda ayrı tabloda tutulduğu için kurtulur, habitler cihaza-özel olduğundan kaybolurdu).
    // Sadece yerelde gerçekten habit VARKEN buda (o zaman eksikler = kullanıcının sildikleri).
    const prunedHabitIds = localHabits.length === 0
      ? currentHabitIds
      : currentHabitIds.filter(id => existingHabitIds.has(id));

    /*
      DURAKLATMA KAPISI TEK NOKTADA.

      Görev üreten dört ayrı yol var (sınav/tez/mülakat adaptasyonları, Ramazan,
      günlük plan motoru, tartım hatırlatmaları) ve hepsi buradan geçiyor. Kapıyı
      çağrı yerlerine dağıtmak, ilerde eklenecek beşinci yolun sessizce duraklatmayı
      delmesi demekti. Budama (prune) yine çalışır: duraklı plan da silinmiş görev
      kimliklerini taşımamalı.
    */
    if (isSlotPausedNow(planMode)) {
      if (prunedTaskIds.length !== currentTaskIds.length || prunedHabitIds.length !== currentHabitIds.length) {
        setPlanIds(planMode, prunedHabitIds, prunedTaskIds);
      }
      return;
    }

    if (!newTasks.length) {
      if (prunedTaskIds.length !== currentTaskIds.length || prunedHabitIds.length !== currentHabitIds.length) {
        setPlanIds(planMode, prunedHabitIds, prunedTaskIds);
      }
      return;
    }

    const created: number[] = [];
    const allPrefs = usePrefsStore.getState() as unknown as Record<string, unknown>;
    const allPlanIds = new Set(Object.keys(allPrefs).filter(k => k.endsWith('PlanTaskIds')).flatMap(k => (allPrefs[k] as number[]) ?? []));
    const incoming = newTasks as (typeof newTasks[number] & { tags?: string[] })[];
    const trimmed = trimToPlanBudget(incoming, useTaskStore.getState().tasks, allPlanIds, new Date());
    // Başka mod bütçeyi doldurmuş olsa da sınav planının ilk bloğu listeye iner: plan görünmez olmasın.
    const firstStudy = isStudyTask(incoming[0] ?? {}) && !trimmed.length && !useTaskStore.getState().tasks.some(t => isStudyTask(t) && (t.tags ?? []).includes(planMode) && !t.isCompleted);
    for (const rawPayload of firstStudy ? incoming.slice(0, 1) : trimmed) {
      // Idempotency anahtarı ekle (backend çift kaydı reddetsin; offline retry güvenli).
      const payload = { ...rawPayload, clientKey: rawPayload.clientKey ?? makeClientKey(rawPayload) };
      const currentTasks = useTaskStore.getState().tasks;
      const duplicate = currentTasks.some(task => {
        if (!isPlanGeneratedTask(task)) return false;
        if (planDedupeKey(task) !== planDedupeKey(payload)) return false;
        return isSamePlanOccurrence(task, payload);
      });
      if (duplicate) continue;

      try {
        const t = await TaskService.createTask(payload);
        if (t?.id) {
          addTask(t);
          created.push(t.id);
        }
      } catch {
        // Cihaz gerçekten offline ise görevi KAYBETME: optimistik ekle + kuyruğa al
        // ki online olunca tek senkron yolundan (useOfflineSync) yazılsın. Böylece
        // manuel görevlerle aynı offline-first modeli izler.
        // Timeout/5xx gibi "sunucu görmüş olabilir" durumlarında kuyruğa ALMIYORUZ
        // (çift kayıt riski); o görevler bir sonraki açılışta yeniden üretilir ve
        // her açılışta çalışan dedupe pass'i olası kopyaları zaten temizler.
        if (!useNetworkStore.getState().isOnline) {
          const tempId = -Date.now() - created.length;
          useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
          addTask({ ...payload, id: tempId } as any);
          created.push(tempId);
        }
      }
    }
    const taskIds = Array.from(new Set([...prunedTaskIds, ...created]));
    setPlanIds(planMode, prunedHabitIds, taskIds);
  }, [addTask, setPlanIds]);

  const runImpl = useCallback(async (force = false) => {
    // Sade modda hedefler duraklatıldıysa üretim ve süpürme yok: durum olduğu gibi kalır, dönüşte motor kaldığı yerden sürer.
    { const p = usePrefsStore.getState(); if (p.uiMode === 'lite' && p.liteGoalsPaused) return; }
    // ── HİDRASYON GÜVENLİĞİ (HER ÇAĞRI İÇİN) ───────────────────────────────
    // run() aşağıda kapalı modlara ait plan/alışkanlık/config'i siler. Store'lar
    // AsyncStorage'dan yüklenmeden çalışırsa seasonal=VARSAYILAN (tüm modlar kapalı)
    // görünür → TÜM planlar yanlışlıkla silinir (cold boot'ta veri kaybı).
    // Mount efekti zaten bekliyor; ama AppState 'active' dinleyicisi run()'ı kapısız
    // çağırabiliyor → bu yüzden güvenliği run()'ın İÇİNE koyuyoruz (tüm yollar kapsanır).
    // hasHydrated zustand 4.5 persist API'sinde garanti; yoksa (?? true) üretimi bloklamayız.
    const prefsHyd = (usePrefsStore as any).persist?.hasHydrated?.() ?? true;
    const habitHyd = (useHabitStore as any).persist?.hasHydrated?.() ?? true;
    const taskHyd = (useTaskStore as any).persist?.hasHydrated?.() ?? true;
    if (!prefsHyd || !habitHyd || !taskHyd) return;
    // Bulut kopyası bu kullanıcı için yüklenmeden temizlik YOK: yerel "kapalı" görünen modlar gerçekte kapalı olmayabilir.
    const adaptUserId = require('@/features/user/store/useAuthStore').useAuthStore.getState().user?.id ?? null;
    if (adaptUserId != null && usePrefsStore.getState().cloudHydratedFor !== adaptUserId) return;

    // Duraklı planların bugünü seriyi kırmadan geçsin (üretim kapısından ÖNCE:
    // günde bir çalışan kapıya takılırsa duraklı günler işaretsiz kalırdı).
    markPausedHabitsSkipped();

    // ── SELF-HEALING ACTIVE MODES ──────────────────────────────────────────
    selfHealActiveModes(lang === 'tr');
    void applyModeRoutineCaps(lang);

    // ── PLAN AUTO-CLEANUP ON EXPIRATION ────────────────────────────────────
    const freshPrefs = usePrefsStore.getState();
    const freshSeasonal = freshPrefs.seasonal;
    const now = Date.now();
    const removeHabitFn = useHabitStore.getState().removeHabit;

    // RAMAZAN
    if (freshSeasonal.ramazan) {
      const stillActive = ramadanRangesNow().some(r => {
        const s = parseDateKey(r.start);
        s.setDate(s.getDate() - 7);
        s.setHours(0, 0, 0, 0);
        return now >= s.getTime() && now <= ramadanCloseAfter(parseDateKey(r.end)).getTime();
      });
      if (!stillActive) {
        freshPrefs.ramazanPlanHabitIds.forEach(id => removeHabitFn(id));
        freshPrefs.ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
        freshPrefs.clearPlanIds('ramazan');
        freshPrefs.setSeasonalPref('ramazan', false);
      }
    }

    // EXAMS
    // anyExamExpired: bu çalışmada bir slot GERÇEKTEN süresi dolup temizlendi mi?
    // Global-off yalnız bu durumda yapılır → kullanıcının YENİ açtığı (tarih girmemiş)
    // boş modu yanlışlıkla kapatılmaz (toggle'ın geri snap'lemesi bug'ı çözülür).
    let anyExamExpired = false;
    // Exam 1
    if (freshSeasonal.examMode && freshSeasonal.examDate && parseDateKey(freshSeasonal.examDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.examPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
      freshPrefs.clearPlanIds('exam');
      freshPrefs.setSeasonalPref('examName', '');
      freshPrefs.setSeasonalPref('examDate', null);
      anyExamExpired = true;
    }
    // Exam 2
    if (freshSeasonal.exam2Name && freshSeasonal.exam2Date && parseDateKey(freshSeasonal.exam2Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.exam2PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2'));
      freshPrefs.clearPlanIds('exam2');
      freshPrefs.setSeasonalPref('exam2Name', '');
      freshPrefs.setSeasonalPref('exam2Date', null);
      anyExamExpired = true;
    }
    // Exam 3
    if (freshSeasonal.exam3Name && freshSeasonal.exam3Date && parseDateKey(freshSeasonal.exam3Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.exam3PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3'));
      freshPrefs.clearPlanIds('exam3');
      freshPrefs.setSeasonalPref('exam3Name', '');
      freshPrefs.setSeasonalPref('exam3Date', null);
      anyExamExpired = true;
    }
    // Turn off examMode globally ONLY after a real expiration cleared the last slot.
    const updatedPrefsAfterExams = usePrefsStore.getState();
    // Sınav tarihi geçince plan kapanır; kullanıcıya SÖYLENİR (2026-11-05, diğer modlar sorarken sınav sessizdi).
    if (anyExamExpired) useToastStore.getState().show(HABIT_LIMIT_COPY[lang].examClosedToast, 'info');
    if (anyExamExpired && updatedPrefsAfterExams.seasonal.examMode && !updatedPrefsAfterExams.seasonal.examDate && !updatedPrefsAfterExams.seasonal.exam2Date && !updatedPrefsAfterExams.seasonal.exam3Date) {
      freshPrefs.setSeasonalPref('examMode', false);
    }

    // TEZ
    if (freshSeasonal.tezMode && freshSeasonal.tezDate && parseDateKey(freshSeasonal.tezDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.tezPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez'));
      freshPrefs.clearPlanIds('tez');
      freshPrefs.setSeasonalPref('tezMode', false);
      freshPrefs.setSeasonalPref('tezName', '');
      freshPrefs.setSeasonalPref('tezDate', null);
    }

    // MULAKATS
    let anyMulakatExpired = false;
    // Mulakat 1
    if (freshSeasonal.mulakatMode && freshSeasonal.mulakatDate && parseDateKey(freshSeasonal.mulakatDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.mulakatPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.mulakatPlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat'));
      freshPrefs.clearPlanIds('mulakat');
      freshPrefs.setSeasonalPref('mulakatName', '');
      freshPrefs.setSeasonalPref('mulakatDate', null);
      anyMulakatExpired = true;
    }
    // Mulakat 2
    if (freshSeasonal.mulakat2Name && freshSeasonal.mulakat2Date && parseDateKey(freshSeasonal.mulakat2Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.mulakat2PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.mulakat2PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat2'));
      freshPrefs.clearPlanIds('mulakat2');
      freshPrefs.setSeasonalPref('mulakat2Name', '');
      freshPrefs.setSeasonalPref('mulakat2Date', null);
      anyMulakatExpired = true;
    }
    // Mulakat 3
    if (freshSeasonal.mulakat3Name && freshSeasonal.mulakat3Date && parseDateKey(freshSeasonal.mulakat3Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.mulakat3PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.mulakat3PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat3'));
      freshPrefs.clearPlanIds('mulakat3');
      freshPrefs.setSeasonalPref('mulakat3Name', '');
      freshPrefs.setSeasonalPref('mulakat3Date', null);
      anyMulakatExpired = true;
    }
    // Turn off mulakatMode globally ONLY after a real expiration cleared the last slot.
    const updatedPrefsAfterMulakats = usePrefsStore.getState();
    if (anyMulakatExpired && updatedPrefsAfterMulakats.seasonal.mulakatMode && !updatedPrefsAfterMulakats.seasonal.mulakatDate && !updatedPrefsAfterMulakats.seasonal.mulakat2Date && !updatedPrefsAfterMulakats.seasonal.mulakat3Date) {
      freshPrefs.setSeasonalPref('mulakatMode', false);
    }

    // SPORS — deadline'da SESSİZ SİLME YOK.
    // Spor/fiziksel hedef tarihinin geçmesi artık modlar ekranında kullanıcıya
    // "Hedef Sonucu" diyaloğu (özet + Uzat/Kapat) olarak gösterilir; emeğin sonucu
    // (ör. kilo: başlangıç→son) görünür olur. Otomatik temizlik kullanıcının
    // kararını ezmesin diye buradan kaldırıldı (kapatma kararını review veriyor).
    // Üretim tarafında süresi geçmiş spor için yeni görev üretilmez (aşağıda guard).

    // ── ORPHAN SWEEP ──────────────────────────────────────────────────────────
    // KAPALI modlara ait artık görevleri tag ile süpür. Mod kapatılırken id-tabanlı
    // temizlik kaçırmış olabilir (offline tempId→realId kayması, başarısız silme vb.).
    // Bu, her açılışta çalışan kendini-iyileştiren bir garanti katmanıdır.
    {
      const sSeasonal = usePrefsStore.getState().seasonal;
      if (!sSeasonal.examMode) {
        retireModeTasksByTag('exam', sSeasonal.examName);
        retireModeTasksByTag('exam2', sSeasonal.exam2Name);
        retireModeTasksByTag('exam3', sSeasonal.exam3Name);
      }
      if (!sSeasonal.tezMode) {
        retireModeTasksByTag('tez', sSeasonal.tezName);
      }
      if (!sSeasonal.mulakatMode) {
        retireModeTasksByTag('mulakat', sSeasonal.mulakatName);
        retireModeTasksByTag('mulakat2', sSeasonal.mulakat2Name);
        retireModeTasksByTag('mulakat3', sSeasonal.mulakat3Name);
      }
      if (!sSeasonal.sporMode) {
        retireModeTasksByTag('spor', sSeasonal.sporGoal);
        retireModeTasksByTag('spor2', sSeasonal.spor2Goal);
        retireModeTasksByTag('spor3', sSeasonal.spor3Goal);
      }
      if (!sSeasonal.ramazan) retireModeTasksByTag('ramazan');
      if (!sSeasonal.tasarrufMode) retireModeTasksByTag('tasarruf', sSeasonal.tasarrufName);
      if (!sSeasonal.birakmaMode) retireModeTasksByTag('birakma', sSeasonal.birakmaName);

      // ── ALIŞKANLIK ORPHAN SWEEP ──────────────────────────────────────────────
      // Kapalı modlara ait alışkanlıkları sil. Mod tespiti: yeni alışkanlıklarda
      // `planMode`, eski (legacy) olanlarda id öneki (`habit_<modtype>_...`).
      // Manuel alışkanlıklar (id `habit_<timestamp>_...`) etkilenmez → yanlış-pozitif yok.
      const offModes = new Set<string>();
      /*
        İKİNCİ/ÜÇÜNCÜ YUVA UNUTULMUŞTU. `h.planMode` yeni alışkanlıklarda 'exam2',
        'mulakat3' gibi yuva-özel değerler taşıyor ama bu küme yalnız temel adları
        içeriyordu — master anahtar kapatılınca (bkz. altındaki "ARTIK PLAN ID
        TEMİZLİĞİ" bloğu, satır 666/668, zaten exam2/exam3/mulakat2/… için prefs
        id'lerini temizliyor) o yuvaların ALIŞKANLIK NESNELERİ hiç süpürülmüyordu:
        prefs'teki referans gitse de alışkanlık listede kalıcı bir hayalet olarak
        kalıyordu.
      */
      if (!sSeasonal.examMode) { offModes.add('exam'); offModes.add('exam2'); offModes.add('exam3'); offModes.add('yks'); offModes.add('kpss'); }
      if (!sSeasonal.tezMode) offModes.add('tez');
      if (!sSeasonal.mulakatMode) { offModes.add('mulakat'); offModes.add('mulakat2'); offModes.add('mulakat3'); }
      if (!sSeasonal.sporMode) { offModes.add('spor'); offModes.add('spor2'); offModes.add('spor3'); }
      if (!sSeasonal.ramazan) offModes.add('ramazan');
      if (!sSeasonal.tasarrufMode) offModes.add('tasarruf');
      if (!sSeasonal.birakmaMode) offModes.add('birakma');
      if (offModes.size > 0) {
        const removeHabitOrphan = useHabitStore.getState().removeHabit;
        useHabitStore.getState().habits.forEach(h => {
          const idMode = h.id.match(/^habit_(ramazan|yks|kpss|exam|tez|mulakat|spor|tasarruf|birakma)_/)?.[1];
          const mode = h.planMode ?? idMode;
          if (mode && offModes.has(mode)) removeHabitOrphan(h.id);
        });
      }

      // ── ARTIK PLAN ID TEMİZLİĞİ ─────────────────────────────────────────────
      // Kapalı modların prefs'teki plan id'lerini de temizle. Eski global-off bug'ı
      // modu kapatıp id'leri bırakıyordu → `planApplied` yanlış true kalıyor, mod
      // tekrar açılınca banner'da şablon/review/custom adımlarının HİÇBİRİ render
      // edilmiyor (hepsi !planApplied koşullu) → "plan gelmedi" boş sheet.
      {
        const cp = usePrefsStore.getState();
        const clearIfStale = (off: boolean, modes: string[]) => {
          if (!off) return;
          modes.forEach(m => {
            const hIds = (cp as any)[`${m}PlanHabitIds`] as any[] | undefined;
            const tIds = (cp as any)[`${m}PlanTaskIds`] as any[] | undefined;
            if ((hIds?.length ?? 0) > 0 || (tIds?.length ?? 0) > 0) cp.clearPlanIds(m as any);
          });
        };
        clearIfStale(!sSeasonal.examMode, ['exam', 'exam2', 'exam3']);
        clearIfStale(!sSeasonal.tezMode, ['tez']);
        clearIfStale(!sSeasonal.mulakatMode, ['mulakat', 'mulakat2', 'mulakat3']);
        clearIfStale(!sSeasonal.sporMode, ['spor', 'spor2', 'spor3']);
        clearIfStale(!sSeasonal.ramazan, ['ramazan']);
      }

      // ── HAYALET KONFIG TEMİZLİĞİ ────────────────────────────────────────────
      // Master mod KAPALI ama config (ad/tarih/hedef) hâlâ doluysa temizle. Eski
      // global-off bug'ı modu kapatıp config'i bırakıyordu → kapalı mod tekrar
      // açılınca eski plan "hayalet" geliyordu. Kapalı mod = config olmamalı.
      const zp = usePrefsStore.getState();
      const zs = zp.seasonal;
      if (!zs.examMode) {
        if (zs.examName || zs.examDate) { zp.setSeasonalPref('examName', ''); zp.setSeasonalPref('examDate', null); }
        if (zs.exam2Name || zs.exam2Date) { zp.setSeasonalPref('exam2Name', ''); zp.setSeasonalPref('exam2Date', null); }
        if (zs.exam3Name || zs.exam3Date) { zp.setSeasonalPref('exam3Name', ''); zp.setSeasonalPref('exam3Date', null); }
      }
      if (!zs.tezMode && (zs.tezName || zs.tezDate)) { zp.setSeasonalPref('tezName', ''); zp.setSeasonalPref('tezDate', null); }
      if (!zs.mulakatMode) {
        if (zs.mulakatName || zs.mulakatDate) { zp.setSeasonalPref('mulakatName', ''); zp.setSeasonalPref('mulakatDate', null); }
        if (zs.mulakat2Name || zs.mulakat2Date) { zp.setSeasonalPref('mulakat2Name', ''); zp.setSeasonalPref('mulakat2Date', null); }
        if (zs.mulakat3Name || zs.mulakat3Date) { zp.setSeasonalPref('mulakat3Name', ''); zp.setSeasonalPref('mulakat3Date', null); }
      }
      if (!zs.sporMode) {
        if (zs.sporGoal || zs.sporDate) { zp.setSeasonalPref('sporGoal', ''); zp.setSeasonalPref('sporDate', null); }
        if (zs.spor2Goal || zs.spor2Date) { zp.setSeasonalPref('spor2Goal', ''); zp.setSeasonalPref('spor2Date', null); }
        if (zs.spor3Goal || zs.spor3Date) { zp.setSeasonalPref('spor3Goal', ''); zp.setSeasonalPref('spor3Date', null); }
      }
    }

    // Sync to cloud if any preferences were changed
    const finalPrefs = usePrefsStore.getState();
    if (JSON.stringify(freshSeasonal) !== JSON.stringify(finalPrefs.seasonal)) {
      finalPrefs.syncToCloud().catch((e) => swallow('planAdaptations.syncPrefsToCloud', e, { capture: true }));
    }

    // NOT: shouldRunToday kapısı buradan KALDIRILDI. Aşağıdaki duplicate-dedupe
    // ve geçmiş-tarih temizliği HER açılışta çalışmalı (ucuz + idempotent),
    // yoksa gün içinde ikinci açılışta bayat/çift görevler temizlenmeden kalıyordu.
    // Kapı, yalnızca görev ÜRETIMINI günde 1 kez sınırlamak için KILO bloğunun
    // hemen öncesine taşındı.
    let existing = useTaskStore.getState().tasks;
    const activePrefs = usePrefsStore.getState();
    const activeSeasonal = activePrefs.seasonal;

    // ── DEDUPE PLAN TASKS CREATED DURING OFFLINE / BLOCKED API PERIODS ─────
    const duplicates = duplicatePlanTasks(existing);

    // Kopya artık oluşmamalı: oluşursa sessizce temizlenmez, hata kaydına düşer (başlık gitmez, yalnız sayı).
    if (duplicates.length > 0) {
      swallow('planAdaptations.duplicateRemoved', new Error(`plan duplicate removed: ${duplicates.length}`), { capture: true });
    }
    duplicates.forEach(task => {
      retirePlanTask(task.id, task.tags?.find(tag => PLAN_TAGS.includes(tag)));
    });

    if (duplicates.length > 0) {
      const removedIds = new Set(duplicates.map(task => task.id));
      const updatedPrefs = usePrefsStore.getState();
      const slots = [
        { mode: 'exam' as const, taskIds: updatedPrefs.examPlanTaskIds, habitIds: updatedPrefs.examPlanHabitIds },
        { mode: 'exam2' as const, taskIds: updatedPrefs.exam2PlanTaskIds, habitIds: updatedPrefs.exam2PlanHabitIds },
        { mode: 'exam3' as const, taskIds: updatedPrefs.exam3PlanTaskIds, habitIds: updatedPrefs.exam3PlanHabitIds },
        { mode: 'tez' as const, taskIds: updatedPrefs.tezPlanTaskIds, habitIds: updatedPrefs.tezPlanHabitIds },
        { mode: 'mulakat' as const, taskIds: updatedPrefs.mulakatPlanTaskIds, habitIds: updatedPrefs.mulakatPlanHabitIds },
        { mode: 'mulakat2' as const, taskIds: updatedPrefs.mulakat2PlanTaskIds, habitIds: updatedPrefs.mulakat2PlanHabitIds },
        { mode: 'mulakat3' as const, taskIds: updatedPrefs.mulakat3PlanTaskIds, habitIds: updatedPrefs.mulakat3PlanHabitIds },
        { mode: 'spor' as const, taskIds: updatedPrefs.sporPlanTaskIds, habitIds: updatedPrefs.sporPlanHabitIds },
        { mode: 'spor2' as const, taskIds: updatedPrefs.spor2PlanTaskIds, habitIds: updatedPrefs.spor2PlanHabitIds },
        { mode: 'spor3' as const, taskIds: updatedPrefs.spor3PlanTaskIds, habitIds: updatedPrefs.spor3PlanHabitIds },
        { mode: 'ramazan' as const, taskIds: updatedPrefs.ramazanPlanTaskIds, habitIds: updatedPrefs.ramazanPlanHabitIds },
      ];
      slots.forEach(slot => {
        const nextIds = slot.taskIds.filter(id => !removedIds.has(id));
        if (nextIds.length !== slot.taskIds.length) {
          updatedPrefs.setPlanIds(slot.mode, slot.habitIds, nextIds);
        }
      });
      existing = useTaskStore.getState().tasks;
    }

    // ── AUTO-CLEANUP OVERDUE INCOMPLETE PLAN TASKS ─────────────────────────
    const logicalToday = logicalNow();
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

    // YEREL GÜN ANAHTARI — todayStr aşağıda tekrar hesaplanıyordu, buraya taşındı.
    const todayStr = `${logicalToday.getFullYear()}-${String(logicalToday.getMonth() + 1).padStart(2, '0')}-${String(logicalToday.getDate()).padStart(2, '0')}`;

    // Sınav planı: işaretleri al, biten günleri kapat, dünün kalanını kaldır (her açılışta, üretim kapısından önce).
    startStudyPlanBridge();
    startPlanAffinityBridge();
    runStudySync();
    existing = useTaskStore.getState().tasks;

    const oldPlanTasks = existing.filter(t => {
      if (t.isCompleted) return false;
      if (!t.dueDate || t.dueDate.startsWith('0001')) return false;

      /*
        YEREL GÜN KARŞILAŞTIRMASI — ham `new Date(t.dueDate).getTime() < todayStart.getTime()`
        `t.dueDate` çoğunlukla salt tarih ('YYYY-MM-DD', bkz. planAdaptations.ts daysFromNow)
        olduğu için UTC gece yarısı okunuyordu; negatif UTC-fark saat dilimlerinde BUGÜN
        vadeli bir görev "geçmiş" sayılıyordu. Spor/Ramazan etiketli görevlerde bu dal
        SİLMEYE gidiyor (aşağıda retirePlanTask) — yani kullanıcı henüz bir günü bile
        geçmemiş bir görevi aynı gün içinde kaybedebiliyordu. calendarDayOf hem salt
        günü hem tam zaman damgasını doğru yerel güne indirger.
      */
      if (isStudyTask(t)) return false; // Sınav planı görevi devretmez: runStudySync kaldırır, plan yeniden kurar.
      const dueDay = calendarDayOf(t.dueDate);
      const isPast = dueDay !== null && dueDay < todayStr;
      if (!isPast) return false;

      const isLifeDaily = !!t.tags?.includes('daily') && (t.tags.includes('tasarruf') || t.tags.includes('birakma'));
      const isPlanTask = isLifeDaily || planTaskIdSet.has(t.id) || (t.tags && t.tags.some(tag =>
        ['exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3', 'spor', 'spor2', 'spor3', 'ramazan', 'yks', 'kpss'].includes(tag)
      ));
      
      // Tartım görevleri geçmiş-temizliğinden MUAF (kilo geçmişi/kadans korunur).
      // Etiketsiz eski görevler de tanınsın diye ortak yardımcı kullanılıyor.
      const isWeightEntry = isWeightEntryTask(t);

      return isPlanTask && !isWeightEntry;
    });

    oldPlanTasks.forEach(task => {
      noteIgnored(task);
      if (overdueAction(task.tags) === 'rollover') rolloverPlanTask(task.id, todayStr);
      else retirePlanTask(task.id, task.tags?.find(tag => (PLAN_MODE_TAGS as readonly string[]).includes(tag)));
    });

    // Refresh existing list after cleanup to avoid duplication downstream
    existing = useTaskStore.getState().tasks;

    // ── TARTIM GÖREVİ GÜVENLİK DUVARI ────────────────────────────────────────
    // ÖNEMLİ: Bu blok ÜRETİM KAPISININ ÖNÜNDE olmalı. Eskiden run()'ın en sonundaydı;
    // günde 1 kez çalışan kapı yüzünden günün ikinci açılışında hiç ulaşılmıyor,
    // mükerrer/yetim tartım görevleri temizlenmeden kalıyordu.
    {
      const wSeasonal = usePrefsStore.getState().seasonal;
      const isKiloActive = !!wSeasonal.sporMode && !!(
        wSeasonal.sporGoal?.toLocaleLowerCase('tr').includes('kilo') ||
        wSeasonal.sporGoal?.toLowerCase().includes('weight')
      );
      // ARŞİVLENMİŞ GÖREV "AÇIK" SAYILMAZ — `findOpenWeightTasks` ile aynı ölçüt.
      // Burada arşiv filtresi yoktu: arşivlenmiş tek bir tartım görevi "açık" görünüp
      // zincir onarımını KALICI olarak susturabiliyordu (kullanıcı bir daha tartım
      // görevi almaz, sebebini de anlayamazdı — weightCheckin.ts'teki notun aynısı).
      const openWeightTasks = useTaskStore.getState().tasks.filter(t => !t.isCompleted && !t.isArchived && isWeightEntryTask(t));

      const wPrefs = usePrefsStore.getState();
      const wPlan = { taskIds: wPrefs.sporPlanTaskIds, habitIds: wPrefs.sporPlanHabitIds };
      if (!isKiloActive || isPhantomKiloPlan(wPlan, useSporStore.getState(), useTaskStore.getState().tasks)) {
        // Kilo modu kapalı ya da plan hiç seçilmemiş → açık tartım görevleri süpürülür, form geri gelir.
        openWeightTasks.forEach(t => retirePlanTask(t.id, 'spor'));
        if (isKiloActive) wPrefs.clearPlanIds('spor');
      } else if (openWeightTasks.length === 0 && wPlan.taskIds.length + wPlan.habitIds.length > 0) {
        /*
          ZİNCİR KOPMASI ONARIMI.

          Haftalık tartım, kendi kendini zincirleyen TEK plan görevi: her kayıttan sonra
          bir sonraki (+7 gün) oluşturuluyor. Diğer plan görevlerini günlük motor her gün
          yeniden ürettiği için onlar kendiliğinden iyileşiyor; bu zincirin ise tek bir
          halkası var.

          `ensureWeeklyWeightTask` yalnız İKİ yerden çağrılıyordu: tartım kaydedilince
          ve plan ilk kurulunca. Kullanıcı açık tartım görevini silerse (kaydırıp sil,
          ya da senkron kazası) ikisi de bir daha tetiklenmiyor ve HAFTALIK TARTIM KALICI
          OLARAK DURUYOR. Kullanıcı bunu bir hata olarak da algılamıyor; sadece "artık
          sormuyor" diye düşünüyor.

          Burada her açılışta onarılıyor: kilo modu açık ve hiç açık tartım görevi yoksa
          yenisi kuruluyor. Tarih, kadansa saygılı — tartım vakti geldiyse bugüne,
          gelmediyse kalan gün kadar ileriye.
        */
        const log = useSporStore.getState().weightLog;
        const due = canLogWeight(log)
          ? new Date()
          : (() => {
              const d = new Date();
              d.setDate(d.getDate() + Math.max(1, daysUntilNextWeight(log)));
              d.setHours(8, 0, 0, 0);
              return d;
            })();
        // Beklenmiyor (ateşle-unut): açılışı ağ isteğine bağlamamak için.
        ensureWeeklyWeightTask(due, lang).catch((e: unknown) => swallow('planAdaptations.weightTaskRepair', e));
      } else if (openWeightTasks.length > 1) {
        // Yalnız 1 açık tartım görevi kalsın. "En güncel" = önce gerçek (pozitif) sunucu
        // id'leri, sonra en büyük id. Düz `b.id - a.id` sıralaması, offline geçici
        // id'ler NEGATİF olduğu için yeni offline görevi eski sunucu görevine
        // kurban ediyordu.
        const sorted = [...openWeightTasks].sort((a, b) => {
          const aReal = a.id > 0, bReal = b.id > 0;
          if (aReal !== bReal) return aReal ? -1 : 1;
          return b.id - a.id;
        });
        sorted.slice(1).forEach(t => retirePlanTask(t.id, 'spor'));
      }
      existing = useTaskStore.getState().tasks;
    }

    // ── ÜRETIM KAPISI ─────────────────────────────────────────────────────────
    // Temizlik/dedupe yukarıda her açılışta çalıştı; görev üretimi ise günde 1 kez.
    if (!force && !(await shouldRunToday())) return;

    /*
      İKİNCİ KAPI: PLAN UYGULANMADAN GÖREV ÜRETİLMEZ.

      Üretim koşulu birçok modda yalnız "mod açık + ad + tarih" idi. Yani kullanıcı sınavı
      seçip tarihi girdiği ANDA — daha planı görmeden, günlük süresini seçmeden — görev
      üretiliyor ve `applyTasks` içinden `setPlanIds` yazılıyordu. Bu, planı kullanıcı adına
      başlatmak demekti ve ekranda şu zincire yol açıyordu:

        • `examApplied` true oluyor → kart "Kurulumu Tamamla" bölümünden "Aktif Hedeflerim"e
          taşınıyor. Bölüm değişince React kartı YENİDEN KURUYOR: açık kart kapanıyor.
          Kullanıcı bunu "kart yukarı zıpladı / kayboldu" diye yaşıyor.
        • Üstteki özet geri sayımı göstermeye başlıyor (tarih oraya "gidiyor"),
          ama kart hâlâ "Kurulumu tamamla" diyor — çünkü günlük süre gerçekten seçilmedi.
          Ekran kendi kendisiyle çelişiyor.

      Tasarruf, Bırakma ve Ramazan'ın adaptasyon bloğu zaten plan şartı koşuyordu; sınav,
      tez, mülakat ve spor bu sözleşmeden sapmıştı. Kapı tek yerde toplanıyor: plan ancak
      kullanıcı "Planı Seç" akışını bitirip gerçekten uyguladıysa (elinde alışkanlık ya da
      görev kimliği varsa) beslenir.
    */
    const hasAppliedPlan = (taskIds: number[], habitIds: string[]) =>
      taskIds.length > 0 || habitIds.length > 0;

    // ── KILO ────────────────────────────────────────────────────────────────
    const sporDeadlinePast = !!activeSeasonal.sporDate && parseDateKey(activeSeasonal.sporDate).setHours(23, 59, 59, 999) < Date.now();
    if (activeSeasonal.sporMode && activeSeasonal.sporGoal && !sporDeadlinePast
        && hasAppliedPlan(sporPlanTaskIds, sporPlanHabitIds)) {
      const sporType = detectSporTypeLocal(activeSeasonal.sporGoal);

      if (sporType === 'kilo') {
        const cw = parseFloat(currentWeight) || 0;
        const tw = parseFloat(targetWeight) || 0;
        if (cw > 0 && tw > 0 && weightLog.length > 0) {
          // Hedef hız kullanıcının GERÇEK tarihine göre hesaplansın (sabit varsayım değil).
          const kiloDaysLeft = activeSeasonal.sporDate ? daysUntil(activeSeasonal.sporDate) : undefined;
          const analysis = analyzeKiloProgress(weightLog, cw, tw, kiloDaysLeft);
          const newTasks = buildKiloAdaptationTasks(analysis, cw, tw, existing, lang);
          await applyTasks(newTasks, 'spor', sporPlanTaskIds, sporPlanHabitIds);
        }
      } else if (sporType === 'maraton') {
        const daysLeft = activeSeasonal.sporDate ? daysUntil(activeSeasonal.sporDate) : 0;
        const sporState = useSporStore.getState();
        const wkm = parseFloat(sporState.weeklyKm) || 30;
        const targetEvent = sporState.targetEvent || '10K';
        // Plan başlangıcından bu yana geçen hafta sayısı (gerçek planStartDate'ten)
        const mStart = planSpecs.spor?.startDate;
        const weeksIn = mStart
          ? Math.max(0, Math.floor((Date.now() - new Date(mStart).getTime()) / (7 * 86400000)))
          : 0;
        /*
          UYUM ORANI ARTIK GERÇEK. Buraya sabit `0.7` yazılıydı ve fonksiyonun karar
          eşikleri `< 0.5` ile `>= 0.8` olduğu için iki dal da hiç çalışmıyordu: maraton
          planı, kullanıcı o hafta hiç koşmasa da her şeyi yapsa da aynı kalıyordu.

          Ölçü, kullanıcının spor kartında GÖRDÜĞÜ sayının aynısı (son 7 günde antrenman
          yapılan ayrı gün sayısı / haftalık hedef). Hareket senkronu bu görevleri sağlık
          verisinden otomatik kapattığı için, gerçek koşu ve yürüyüşler artık doğrudan
          plana yansıyor — veri yalnızca ekranda durmuyor, kararı besliyor.
        */
        const trainTarget = sporState.trainingDays ?? 3;
        const adherence = weeklyTrainingAdherence(existing, sporPlanTaskIds, trainTarget, weeksIn);
        const newTasks = buildMaratonAdaptationTasks(
          wkm, targetEvent, daysLeft, weeksIn, adherence, existing, lang,
          // Dinlenmemişken hacim artırma önerisi ERTELENİR (bkz. planAdaptations).
          usePrefsStore.getState().recoveryState,
        );
        await applyTasks(newTasks, 'spor', sporPlanTaskIds, sporPlanHabitIds);
      } else if ((sporType === 'guc' || sporType === 'genel') && activeSeasonal.sporDate) {
        // Geçen hafta sayısını GERÇEK plan başlangıcından hesapla (planStartDate).
        // Eski kod 12 haftalık sabit varsayımla tahmin ediyordu; hedef 12 haftadan
        // uzaksa weeksElapsed 0'da takılıp DELOAD (her 4 hafta) hiç tetiklenmiyordu.
        const startDate = planSpecs.spor?.startDate;
        const weeksElapsed = startDate
          ? Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / (7 * 86400000)))
          : 0;
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
      if (slot.active && slot.name && slot.date && hasAppliedPlan(slot.taskIds, slot.habitIds)) {
        if (isStudyManaged(slot.name)) continue; // Sınav planı kendi işlerini üretir; üstüne ayrı görev binmez.
        const daysLeft = daysUntil(slot.date);
        const newTasks = buildSinavAdaptationTasks(slot.name, daysLeft, existing, lang);
        await applyTasks(newTasks, slot.mode, slot.taskIds, slot.habitIds);
      }
    }

    // ── TEZ ─────────────────────────────────────────────────────────────────
    if (activeSeasonal.tezMode && activeSeasonal.tezName && activeSeasonal.tezDate
        && hasAppliedPlan(tezPlanTaskIds, tezPlanHabitIds)) {
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
      if (slot.active && slot.name && slot.date && hasAppliedPlan(slot.taskIds, slot.habitIds)) {
        const daysLeft = daysUntil(slot.date);
        const newTasks = buildMulakatAdaptationTasks(slot.name, daysLeft, existing, lang);
        await applyTasks(newTasks, slot.mode, slot.taskIds, slot.habitIds);
      }
    }

    // ── RAMAZAN ─────────────────────────────────────────────────────────────
    if (activeSeasonal.ramazan && ramazanPlanTaskIds.length > 0) {
      const todayStr = getLocalDateString();
      const activeRamazan = ramadanRangesNow().find(r => todayStr >= r.start && todayStr <= r.end);
      if (activeRamazan) {
        const daysToEnd = daysUntil(activeRamazan.end);
        const newTasks = buildRamazanAdaptationTasks(daysToEnd, existing, lang);
        await applyTasks(newTasks, 'ramazan', ramazanPlanTaskIds, ramazanPlanHabitIds);
      }
    }

    // ── GÜNLÜK PLAN MOTORU ────────────────────────────────────────────────────
    // Her aktif plan için BUGÜNÜN görevlerini üretir (faz/ilerlemeye göre).
    // hasDailyToday içte kontrol edildiği için aynı gün tekrar çağrılsa da çoğaltmaz.
    // Günlük görevler GERÇEK yerel güne tarihlenir (buffer YOK). Eskiden buradaki
    // -3 saatlik gece buffer'ı dueDate'e sızıyor, gece 00:00–03:00 üretilen görev
    // "dün" damgalanıp ("26 Haz" sorunu) aynı sabah geçmiş-temizliğine takılıyordu.
    // Gece-kuşu buffer'ı yalnızca üretim-kapısında (shouldRunToday) ve geçmiş-tarih
    // temizliği eşiğinde (todayStart) korunur; görev damgasını kaydırmaz.
    const today = new Date();
    const fresh = useTaskStore.getState().tasks;

    const sporKind = (goal: string): PlanKind => {
      const t = detectSporTypeLocal(goal);
      return t === 'yaris' ? 'genel' : t;
    };

    const dailySlots: { spec: DailyPlanSpec; mode: Parameters<typeof applyTasks>[1]; taskIds: number[]; habitIds: string[]; subjectId?: string; topicId?: string; study?: StudyBlock[] | null }[] = [];

    // Konu/müfredat takibi için bugünün gün indeksi (deterministik rotasyon)
    const subjectDayIndex = Math.floor(today.getTime() / 86400000);
    const subjectProgress = useSubjectStore.getState().progress;

    // Sınav slotları — bilinen sınavda günün konusunu seç ("KPSS — Türkçe"),
    // bilinmeyen sınavda düz ad (jenerik akış). Görev üretilirse ilerleme güncellenir.
    for (const slot of examSlots) {
      if (slot.active && slot.name && slot.date && hasAppliedPlan(slot.taskIds, slot.habitIds)) {
        let planName = slot.name;
        let subjectId: string | undefined;
        let topicId: string | undefined;
        const curriculum = findExamCurriculum(slot.name);
        if (curriculum) {
          const weakTopicIds = planSpecs[slot.mode]?.weakTopicIds;
          // Zayıf konusu olan DERS de rotasyonda öne çıkar — eskiden yalnız
          // `pickTopic`e gidiyordu, dersin KENDİSİNİN sırası kör rotasyondaydı
          // (bkz. curriculum.ts'teki pickSubject notu).
          const subject = pickSubject(curriculum, subjectProgress, subjectDayIndex, weakTopicIds);
          if (subject) {
            subjectId = subject.id;
            const topic = pickTopic(subject, subjectProgress, subjectDayIndex, weakTopicIds);
            topicId = topic?.id;
            planName = subjectExamLabel(slot.name, subject, lang, topic);
          }
        }
        dailySlots.push({
          spec: { kind: 'exam', slot: slot.mode, name: planName, daysLeft: daysUntil(slot.date), dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
          mode: slot.mode, taskIds: slot.taskIds, habitIds: slot.habitIds, subjectId, topicId, study: studyBlocksForSlot(slot.mode, slot.name),
        });
      }
    }
    // Tez — zayıf alan kendi-kendine seçimi (bkz. WeakAreaPicker) spec.name'e eklenir,
    // AYNI "—" biçimi exam'daki subjectExamLabel ile (bkz. weakAreas.ts).
    if (activeSeasonal.tezMode && activeSeasonal.tezName && activeSeasonal.tezDate
        && hasAppliedPlan(tezPlanTaskIds, tezPlanHabitIds)) {
      dailySlots.push({
        spec: { kind: 'tez', slot: 'tez', name: activeSeasonal.tezName, weakAreaIds: planSpecs.tez?.weakTopicIds, hiddenItems: planSpecs.tez?.hiddenItems, daysLeft: daysUntil(activeSeasonal.tezDate), dailyMinutes: planSpecs.tez?.dailyMinutes, templateId: planSpecs.tez?.templateId },
        mode: 'tez', taskIds: tezPlanTaskIds, habitIds: tezPlanHabitIds,
      });
    }
    // Mülakat slotları — aynı alan-etiketleme deseni.
    for (const slot of mulakatSlots) {
      if (slot.active && slot.name && slot.date && hasAppliedPlan(slot.taskIds, slot.habitIds)) {
        dailySlots.push({
          spec: { kind: 'mulakat', slot: slot.mode, name: slot.name, weakAreaIds: planSpecs[slot.mode]?.weakTopicIds, hiddenItems: planSpecs[slot.mode]?.hiddenItems, daysLeft: daysUntil(slot.date), dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
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
      if (slot.goal && (slot.date || sporKind(slot.goal) === 'kilo') && hasAppliedPlan(slot.taskIds, slot.habitIds)) { // Kilo hedefinde tarih sorulmaz; şart bu planı görevsiz bırakıyordu
        const kind = sporKind(slot.goal);
        /*
          SPOR ŞABLONLARI {name} KULLANMIYOR — bu yüzden `name` ataması sabit metni
          HİÇ etkilemiyor (bkz. dailyPlanEngine.ts .replace('{name}', ...), yer tutucu
          yoksa no-op). Yalnız iki yere akıyor: AI havuz genişletme ipucu
          (planPoolSync.ts → AiService.planPool({ name })) ve plan özeti ekranı. Yani en
          düşük riskli kişiselleştirme yolu — sabit görev havuzuna dokunmadan.
        */
        dailySlots.push({
          spec: { kind, slot: slot.mode, name: slot.goal, weakAreaIds: planSpecs[slot.mode]?.weakTopicIds, hiddenItems: planSpecs[slot.mode]?.hiddenItems, daysLeft: slot.date ? daysUntil(slot.date) : 3650, dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
          mode: slot.mode, taskIds: slot.taskIds, habitIds: slot.habitIds,
        });
      }
    }
    // Ramazan (aktif dönemdeyse) — adaptasyon bloğu zaten plan şartı koşuyordu, günlük
    // üretim ise koşmuyordu; ikisi aynı kapıya bağlandı.
    if (activeSeasonal.ramazan && hasAppliedPlan(ramazanPlanTaskIds, ramazanPlanHabitIds)) {
      const todayStr = getLocalDateString(today);
      const activeRamazan = ramadanRangesNow().find(r => todayStr >= r.start && todayStr <= r.end);
      if (activeRamazan) {
        dailySlots.push({
          spec: { kind: 'ramazan', slot: 'ramazan', hiddenItems: planSpecs.ramazan?.hiddenItems, daysLeft: daysUntil(activeRamazan.end), dailyMinutes: planSpecs.ramazan?.dailyMinutes, templateId: planSpecs.ramazan?.templateId },
          mode: 'ramazan', taskIds: ramazanPlanTaskIds, habitIds: ramazanPlanHabitIds,
        });
      }
    }
    // Tasarruf ve Bırakma: kurulumdan sonra sessiz kalıyordu; artık günde bir küçük adım (2026-11-05).
    {
      const life = usePrefsStore.getState() as unknown as Record<string, number[] & string[]>;
      if (activeSeasonal.tasarrufMode && hasAppliedPlan(life.tasarrufPlanTaskIds ?? [], life.tasarrufPlanHabitIds ?? [])) {
        dailySlots.push({ spec: { kind: 'tasarruf', slot: 'tasarruf', name: activeSeasonal.tasarrufName, hiddenItems: planSpecs.tasarruf?.hiddenItems, daysLeft: activeSeasonal.tasarrufDate ? daysUntil(activeSeasonal.tasarrufDate) : 3650, dailyMinutes: 15 }, mode: 'tasarruf', taskIds: life.tasarrufPlanTaskIds ?? [], habitIds: life.tasarrufPlanHabitIds ?? [] });
      }
      if (activeSeasonal.birakmaMode && hasAppliedPlan(life.birakmaPlanTaskIds ?? [], life.birakmaPlanHabitIds ?? [])) {
        dailySlots.push({ spec: { kind: 'birakma', slot: 'birakma', name: activeSeasonal.birakmaName, hiddenItems: planSpecs.birakma?.hiddenItems, daysLeft: 3650, dailyMinutes: 15 }, mode: 'birakma', taskIds: life.birakmaPlanTaskIds ?? [], habitIds: life.birakmaPlanHabitIds ?? [] });
      }
    }

    // Adaptif zorluk sinyali (tüm planlar için ortak) — günlük üretimi modüle eder.
    const adherence = computeAdherenceSignal();
    // Ramazan içerik varyantı YALNIZCA gerçekten Ramazan'dayken uygulanır.
    // Eskiden `seasonal.ramazan` (mod anahtarı) doğrudan bayrak olarak veriliyordu;
    // mod Ramazan'dan 7 gün ÖNCE açılabildiği için kilo/spor görevleri oruç
    // başlamadan "İftar sonrası…" metinlerine dönüyordu. Ramazan'ın kendi slotu
    // zaten gerçek tarih aralığını kontrol ediyordu — asimetri giderildi.
    const inRamazanNow = ramadanFrameNow().fasting;
    const subjectTodayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    /*
      GÜNLÜK PLAN BÜTÇESİ (bkz. allocatePlanBudget): tüm modların toplamı sınırlı; kullanıcının bugünkü kendi
      işleri (plan dışı, bitmemiş) çoksa bütçe daralır. Önce her moda 1, hedef tarihi en yakın önce.
    */
    const recoveryNow = usePrefsStore.getState().recoveryState;
    const ownToday = fresh.filter(t => !t.isCompleted && !(t.tags ?? []).includes('daily') && (() => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    })()).length;
    const caps = allocatePlanBudget(
      dailySlots.map(ds => ds.spec),
      dailySlots.map(ds => (ds.study ? ds.study.filter(b => !b.done && !b.skipped).length : desiredDailyCount({ ...ds.spec, adherence, recovery: recoveryNow, lightDay: lightDayFor(ds.mode, today), isRamazan: inRamazanNow }))),
      budgetFor(ramadanFrameNow(), planBudgetFor(ownToday)),
    );
    for (const [slotIndex, ds] of dailySlots.entries()) {
      /*
        TOPARLANMA SİNYALİ SPEC'E GİRİYOR.

        Uyku senkronu bu değeri tercihlere yazıyor (bkz. useSleepHealthSync); motor da
        burada okuyor. Sağlık entegrasyonu kapalıysa 'unknown' kalır ve üretim bugünkü
        gibi çalışır — yani özellik kimseyi zorlamıyor, yalnız veri verene daha iyi
        hizmet ediyor.
      */
      const recovery = usePrefsStore.getState().recoveryState;
      const spec = { ...ds.spec, adherence, recovery, isRamazan: inRamazanNow, maxCount: caps[slotIndex], lightDay: lightDayFor(ds.mode, today) };
      // Genişletilmiş havuz VARSA kullanılır; yoksa motor sabit havuzla çalışır.
      // Eksikse arka planda doldurulur — beklenmez, bugünü etkilemez (bkz. planPoolSync).
      if (ds.study) {
        // Sınav planı: görev yalnız henüz açılmamış bloklar için; konu ancak görev BİTİNCE ilerler (bkz. planCore).
        const openTags = new Set(fresh.flatMap(t => t.tags ?? []));
        const fresher = ds.study.filter(b => !openTags.has(b.id));
        const existingCount = ds.study.length - fresher.length;
        const tasks = blocksToTasks(fresher, useStudyPlanStore.getState(), studyToday(), ds.mode, Math.max(0, caps[slotIndex] - existingCount), lang);
        await applyTasks(tasks as unknown as Parameters<typeof applyTasks>[0], ds.mode, ds.taskIds, ds.habitIds);
        continue;
      }
      // "Bugün olmaz" dediyse bugün bu plandan yeni görev açılmaz (bkz. planManage.skipPlanTaskToday).
      if (planSpecs[ds.mode]?.restDay === subjectTodayKey) continue;
      const daily = buildDailyTasks({ ...spec, extraPool: getExtraPool(spec), affinity: usePlanAffinityStore.getState().bySlot[ds.mode] }, fresh, lang, today);
      ensureExtraPool(spec);
      await applyTasks(daily, ds.mode, ds.taskIds, ds.habitIds);
      noteShown(ds.mode, daily, Math.floor(today.getTime() / 86400000));
      // Konu çalışıldıysa ilerlemeyi işaretle → yarın rotasyon bir sonraki konuya geçer.
      if (daily.length > 0 && ds.subjectId) {
        useSubjectStore.getState().markStudied(ds.subjectId, subjectTodayKey);
        if (ds.topicId) useSubjectStore.getState().markStudied(ds.topicId, subjectTodayKey);
      }
    }

    // NOT: Tartım görevi güvenlik duvarı ÜRETİM KAPISININ ÖNÜNE taşındı (yukarı) —
    // her açılışta çalışması gerekiyor, günde bir değil.

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

  /*
    EŞZAMANLI ÇAĞRI BİRLEŞTİRME — MODÜL SEVİYESİNDE, HOOK ÖRNEĞİ DEĞİL.

    `usePlanAdaptations()` SEKİZ ayrı yerden çağrılıyor (app/_layout.tsx arka planda,
    app/modlar.tsx, app/onboarding.tsx, TurkishModeBanner, TasarrufCard, BirakmaCard,
    SporCard, WeightEntryModal) — her biri KENDİ `runImpl` kapanışını alır. Bir
    `useRef` burada İŞE YARAMAZ: her bileşen örneğinin kendi ref'i olur, ikisi
    birbirinden habersiz kalır. Kilit modül düzeyinde olmalı ki TÜM örnekler aynı
    anda tek bir çalışmayı paylaşsın.

    ÖLÇÜLEN RİSK: kullanıcı bir modu etkinleştirip `setTimeout(() => runAdaptations(true), 300)`
    tetiklerken AYNI anda `_layout.tsx`'in arka plan tetikleyicisi de çalışırsa, ikisi
    de "bugün için görev üretildi mi" kontrolünü BİRBİRİNDEN HABERSİZ, hâlâ "hayır"
    durumundayken geçip aynı günün görevini sunucuda İKİ KEZ oluşturabilir —
    TasarrufCard/BirakmaCard'ın `apply()`'ında düzeltilen çift-dokunuş hatasının motor
    seviyesindeki karşılığı.

    NEDEN "MEŞGULSE ATLA" DEĞİL: `app/modlar.tsx` dönen söze (`Promise`) `.then()` ile
    bağlanıp iş GERÇEKTEN bitince taze görev sayısını okuyor. Sessizce atlayan bir
    kilit, o `.then()`'i hemen (işi beklemeden) tetikler ve eski sayıyı okurdu —
    aynı sorunu başka bir yere taşımış olurduk. Bunun yerine eşzamanlı çağrılar AYNI
    sözü paylaşır: tek çalışma, herkes gerçek bitişi bekler (`api.ts`teki
    `tryRefreshToken`'ın `refreshPromise` birleştirmesiyle aynı kalıp).
  */
  const run = useCallback(async (force = false) => {
    if (adaptationRunInFlight) return adaptationRunInFlight;
    const p = runImpl(force).finally(() => {
      if (adaptationRunInFlight === p) adaptationRunInFlight = null;
    });
    adaptationRunInFlight = p;
    return p;
  }, [runImpl]);

  useEffect(() => {
    if (!lifecycle) return;
    // Kullanıcı giriş yapmış ve task'lar yüklenmişse çalıştır
    const { user } = useAuthStore.getState();
    if (user) {
      // ── HİDRASYON KAPISI ────────────────────────────────────────────────
      // run() kapalı modlara ait plan/alışkanlık/config'i süpürür. AsyncStorage
      // rehydrate'i async; prefs HENÜZ yüklenmeden çalışırsa seasonal = VARSAYILAN
      // (tüm modlar kapalı) görünür → tüm planlar yanlışlıkla silinir ("ilerleme
      // gelip gidiyor, hiçbir planda kalmıyor"). Bu yüzden önce ilgili kalıcı
      // store'ların hidrasyonunu bekle.
      Promise.all([
        whenHydrated(usePrefsStore),
        whenHydrated(useHabitStore),
        whenHydrated(useTaskStore),
        whenHydrated(useStagedPlanStore),
      ]).then(() => {
        // Önce tek seferlik migrasyon (eski gelecek-tarihli döküm görevlerini temizle),
        // sonra günlük üretimi çalıştır.
        runPlanMigrationOnce().finally(() => run().finally(() => repairStagedQueuesOnce(user.id).finally(() => releaseStagedPlanItems())));
      });
    }

    const handleAppStateChange = (nextStatus: string) => {
      if (nextStatus === 'active') {
        const { user: currentUser } = useAuthStore.getState();
        if (currentUser) {
          run().finally(() => releaseStagedPlanItems()); // kademeli açılım (bkz. stagedRollout)
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [run, lifecycle, lifecycleUserId]);

  return { runAdaptations: run };
}
