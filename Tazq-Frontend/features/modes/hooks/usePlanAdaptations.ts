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
import { useSporStore } from '@/shared/store/useSporStore';
import { useTaskStore } from '@/features/tasks';
import { useAuthStore } from '@/features/user';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { TaskService } from '@/shared/services/api';
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
} from '@/shared/utils/planAdaptations';
import { RAMAZAN, getModePreview } from '../utils/turkishModes';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useHabitStore } from '@/features/habits';
import { buildDailyTasks, DailyPlanSpec, PlanKind } from '@/shared/utils/dailyPlanEngine';
import { runPlanMigrationOnce } from '@/shared/utils/planMigration';
import { findExamCurriculum, pickSubject, subjectExamLabel } from '@/shared/utils/curriculum';
import { useSubjectStore } from '@/shared/store/useSubjectStore';
import { useBudgetStore, type BudgetType } from '@/shared/store/useBudgetStore';
import { useQuitStore, type QuitType } from '@/shared/store/useQuitStore';
import { buildTasarrufPlan, buildBirakmaPlan } from '@/shared/utils/lifeModePlans';

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
const PLAN_TAGS = ['exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3', 'spor', 'spor2', 'spor3', 'ramazan', 'yks', 'kpss', 'daily'];

// Mod başına o moda ait TÜM görev etiketleri (günlük slotlar + adaptasyon görevleri).
// Kapalı modlara ait artık görevleri tag ile süpürmek için kullanılır — id-takibi
// (offline tempId→realId kayması vb.) bozulsa bile artık kalmamasını GARANTİ eder.
// NOT: 'weight_entry' bilinçli dışarıda (kilo geçmişi korunur); 'daily' modlar arası
// ortak olduğundan tek başına kullanılmaz (slot tag'leri daily görevleri zaten kapsar).
const MODE_TASK_TAGS: Record<string, string[]> = {
  exam: ['exam', 'exam2', 'exam3', 'yks', 'kpss', 'sinav_eve', 'sinav_week', 'sinav_sprint_start', 'sinav_60'],
  tez: ['tez', 'tez_weekly', 'tez_final_2weeks', 'tez_sprint_30', 'tez_60'],
  mulakat: ['mulakat', 'mulakat2', 'mulakat3', 'mulakat_day', 'mulakat_eve', 'mulakat_3days', 'mulakat_week', 'mulakat_2weeks'],
  spor: ['spor', 'spor2', 'spor3', 'kilo', 'maraton', 'guc', 'genel', 'kilo_adapt', 'kilo_measure', 'maraton_taper', 'maraton_race_week', 'maraton_warn', 'maraton_missed', 'maraton_progress', 'guc_deload', 'guc_progress'],
  ramazan: ['ramazan', 'ramazan_kadir'],
};

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

function dateKey(date?: string | null): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function isPlanGeneratedTask(task: { tags?: string[] | null }): boolean {
  return (task.tags ?? []).some(tag => PLAN_TAGS.includes(tag));
}

// Deterministik idempotency anahtarı: aynı (etiketler|gün|başlık) için aynı sonucu
// verir → backend çift kaydı reddedebilir. FNV-1a tabanlı kısa hash (<=64 char).
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
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

function makeClientKey(payload: { title: string; dueDate?: string | null; tags?: string[] | null }): string {
  const tags = (payload.tags ?? []).slice().sort().join(',');
  const day = dateKey(payload.dueDate);
  const basis = `${tags}|${day}|${payload.title.trim().toLocaleLowerCase('tr')}`;
  // Çift FNV (ileri + ters) ile çakışma riskini düşür; okunur bir önek ekle.
  return `${day}:${fnv1a(basis)}${fnv1a(basis.split('').reverse().join(''))}`.slice(0, 64);
}

function planDedupeKey(task: { title: string; tags?: string[] | null }): string {
  const tags = (task.tags ?? []).filter(tag => PLAN_TAGS.includes(tag)).sort().join(',');
  return `${task.title.trim().toLocaleLowerCase('tr')}|${tags}`;
}

function inferBudgetType(name?: string | null): BudgetType {
  if (!name) return '';
  const n = name.toLowerCase();
  if (n.includes('birikim') || n.includes('saving')) return 'birikim';
  if (n.includes('borç') || n.includes('debt') || n.includes('payoff') || n.includes('kapatma')) return 'borc';
  if (n.includes('acil') || n.includes('emergency') || n.includes('fon')) return 'acilfon';
  return 'birikim'; // fallback
}

function selfHealActiveModes(tr: boolean) {
  const freshPrefs = usePrefsStore.getState();
  const freshSeasonal = freshPrefs.seasonal;
  const currentHabits = useHabitStore.getState().habits;
  const hasHabit = (id: string) => currentHabits.some(h => h.id === id);
  const addHabitFn = useHabitStore.getState().addHabit;

  // 1. RAMAZAN
  if (freshSeasonal.ramazan && freshPrefs.ramazanPlanHabitIds.length > 0) {
    const missing = freshPrefs.ramazanPlanHabitIds.some(id => !hasHabit(id));
    if (missing) {
      const tId = freshPrefs.planSpecs.ramazan?.templateId;
      const modePreview = getModePreview('ramazan');
      const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
      template.habits.forEach((h, i) => {
        const storedId = freshPrefs.ramazanPlanHabitIds[i];
        if (storedId && !hasHabit(storedId)) {
          addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, storedId, 'ramazan', h.nameTr, h.name);
        }
      });
    }
  }

  // 2. EXAMS
  const examSlotsToHeal = [
    { active: freshSeasonal.examMode, name: freshSeasonal.examName, date: freshSeasonal.examDate, habitIds: freshPrefs.examPlanHabitIds, slot: 'exam' as const },
    { active: !!freshSeasonal.exam2Name && !!freshSeasonal.exam2Date, name: freshSeasonal.exam2Name, date: freshSeasonal.exam2Date, habitIds: freshPrefs.exam2PlanHabitIds, slot: 'exam2' as const },
    { active: !!freshSeasonal.exam3Name && !!freshSeasonal.exam3Date, name: freshSeasonal.exam3Name, date: freshSeasonal.exam3Date, habitIds: freshPrefs.exam3PlanHabitIds, slot: 'exam3' as const },
  ];
  for (const slot of examSlotsToHeal) {
    if (slot.active && slot.name && slot.date && slot.habitIds.length > 0) {
      if (slot.habitIds.some(id => !hasHabit(id))) {
        const tId = freshPrefs.planSpecs[slot.slot]?.templateId;
        const modePreview = getModePreview('exam', { examName: slot.name, examDate: slot.date });
        const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
        template.habits.forEach((h, i) => {
          const storedId = slot.habitIds[i];
          if (storedId && !hasHabit(storedId)) {
            addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, storedId, slot.slot, h.nameTr, h.name);
          }
        });
      }
    }
  }

  // 3. TEZ
  if (freshSeasonal.tezMode && freshSeasonal.tezName && freshSeasonal.tezDate && freshPrefs.tezPlanHabitIds.length > 0) {
    if (freshPrefs.tezPlanHabitIds.some(id => !hasHabit(id))) {
      const tId = freshPrefs.planSpecs.tez?.templateId;
      const modePreview = getModePreview('tez', { tezName: freshSeasonal.tezName, tezDate: freshSeasonal.tezDate });
      const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
      template.habits.forEach((h, i) => {
        const storedId = freshPrefs.tezPlanHabitIds[i];
        if (storedId && !hasHabit(storedId)) {
          addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, storedId, 'tez', h.nameTr, h.name);
        }
      });
    }
  }

  // 4. MULAKATS
  const mulakatSlotsToHeal = [
    { active: freshSeasonal.mulakatMode, name: freshSeasonal.mulakatName, date: freshSeasonal.mulakatDate, habitIds: freshPrefs.mulakatPlanHabitIds, slot: 'mulakat' as const },
    { active: !!freshSeasonal.mulakat2Name && !!freshSeasonal.mulakat2Date, name: freshSeasonal.mulakat2Name, date: freshSeasonal.mulakat2Date, habitIds: freshPrefs.mulakat2PlanHabitIds, slot: 'mulakat2' as const },
    { active: !!freshSeasonal.mulakat3Name && !!freshSeasonal.mulakat3Date, name: freshSeasonal.mulakat3Name, date: freshSeasonal.mulakat3Date, habitIds: freshPrefs.mulakat3PlanHabitIds, slot: 'mulakat3' as const },
  ];
  for (const slot of mulakatSlotsToHeal) {
    if (slot.active && slot.name && slot.date && slot.habitIds.length > 0) {
      if (slot.habitIds.some(id => !hasHabit(id))) {
        const tId = freshPrefs.planSpecs[slot.slot]?.templateId;
        const modePreview = getModePreview('mulakat', { mulakatName: slot.name, mulakatDate: slot.date });
        const template = modePreview.templates?.find(t => t.id === tId) || modePreview.templates?.[0] || modePreview;
        template.habits.forEach((h, i) => {
          const storedId = slot.habitIds[i];
          if (storedId && !hasHabit(storedId)) {
            addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, storedId, slot.slot, h.nameTr, h.name);
          }
        });
      }
    }
  }

  // 5. SPORS
  const sporSlotsToHeal = [
    { goal: freshSeasonal.sporMode ? freshSeasonal.sporGoal : '', date: freshSeasonal.sporDate, habitIds: freshPrefs.sporPlanHabitIds, slot: 'spor' as const },
    { goal: freshSeasonal.spor2Goal, date: freshSeasonal.spor2Date, habitIds: freshPrefs.spor2PlanHabitIds, slot: 'spor2' as const },
    { goal: freshSeasonal.spor3Goal, date: freshSeasonal.spor3Date, habitIds: freshPrefs.spor3PlanHabitIds, slot: 'spor3' as const },
  ];
  for (const slot of sporSlotsToHeal) {
    if (slot.goal && slot.date && slot.habitIds.length > 0) {
      if (slot.habitIds.some(id => !hasHabit(id))) {
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
        template.habits.forEach((h, i) => {
          const storedId = slot.habitIds[i];
          if (storedId && !hasHabit(storedId)) {
            addHabitFn(tr ? h.nameTr : h.name, h.emoji, h.color, storedId, slot.slot, h.nameTr, h.name);
          }
        });
      }
    }
  }

  // 6. TASARRUF
  if (freshSeasonal.tasarrufMode && freshSeasonal.tasarrufName && freshPrefs.tasarrufPlanHabitIds.length > 0) {
    const bStore = useBudgetStore.getState();
    const inferred = inferBudgetType(freshSeasonal.tasarrufName);
    if (bStore.budgetType === '' && inferred) {
      bStore.setBudgetType(inferred);
      bStore.setStartAmount('0');
      bStore.setTargetAmount('1000');
    }
    if (freshPrefs.tasarrufPlanHabitIds.some(id => !hasHabit(id))) {
      const typeToUse = bStore.budgetType || inferred || 'birikim';
      const plan = buildTasarrufPlan(typeToUse);
      plan.habits.forEach((h, i) => {
        const storedId = freshPrefs.tasarrufPlanHabitIds[i];
        if (storedId && !hasHabit(storedId)) {
          addHabitFn(h.name, h.emoji, h.color, storedId, 'tasarruf', h.name, h.nameEn);
        }
      });
    }
  }

  // 7. BIRAKMA
  if (freshSeasonal.birakmaMode && freshSeasonal.birakmaName && freshPrefs.birakmaPlanHabitIds.length > 0) {
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
    if (freshPrefs.birakmaPlanHabitIds.some(id => !hasHabit(id))) {
      const plan = buildBirakmaPlan('' as QuitType);
      plan.habits.forEach((h, i) => {
        const storedId = freshPrefs.birakmaPlanHabitIds[i];
        if (storedId && !hasHabit(storedId)) {
          addHabitFn(h.name, h.emoji, h.color, storedId, 'birakma', h.name, h.nameEn);
        }
      });
    }
  }
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
    for (const rawPayload of newTasks) {
      // Idempotency anahtarı ekle (backend çift kaydı reddetsin; offline retry güvenli).
      const payload = { ...rawPayload, clientKey: rawPayload.clientKey ?? makeClientKey(rawPayload) };
      const currentTasks = useTaskStore.getState().tasks;
      const duplicate = currentTasks.some(task =>
        !task.isCompleted &&
        isPlanGeneratedTask(task) &&
        planDedupeKey(task) === planDedupeKey(payload)
      );
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

  const run = useCallback(async (force = false) => {
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

    // ── SELF-HEALING ACTIVE MODES ──────────────────────────────────────────
    selfHealActiveModes(lang === 'tr');

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
    // anyExamExpired: bu çalışmada bir slot GERÇEKTEN süresi dolup temizlendi mi?
    // Global-off yalnız bu durumda yapılır → kullanıcının YENİ açtığı (tarih girmemiş)
    // boş modu yanlışlıkla kapatılmaz (toggle'ın geri snap'lemesi bug'ı çözülür).
    let anyExamExpired = false;
    // Exam 1
    if (freshSeasonal.examMode && freshSeasonal.examDate && new Date(freshSeasonal.examDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.examPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
      freshPrefs.clearPlanIds('exam');
      freshPrefs.setSeasonalPref('examName', '');
      freshPrefs.setSeasonalPref('examDate', null);
      anyExamExpired = true;
    }
    // Exam 2
    if (freshSeasonal.exam2Name && freshSeasonal.exam2Date && new Date(freshSeasonal.exam2Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.exam2PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2'));
      freshPrefs.clearPlanIds('exam2');
      freshPrefs.setSeasonalPref('exam2Name', '');
      freshPrefs.setSeasonalPref('exam2Date', null);
      anyExamExpired = true;
    }
    // Exam 3
    if (freshSeasonal.exam3Name && freshSeasonal.exam3Date && new Date(freshSeasonal.exam3Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.exam3PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3'));
      freshPrefs.clearPlanIds('exam3');
      freshPrefs.setSeasonalPref('exam3Name', '');
      freshPrefs.setSeasonalPref('exam3Date', null);
      anyExamExpired = true;
    }
    // Turn off examMode globally ONLY after a real expiration cleared the last slot.
    const updatedPrefsAfterExams = usePrefsStore.getState();
    if (anyExamExpired && updatedPrefsAfterExams.seasonal.examMode && !updatedPrefsAfterExams.seasonal.examDate && !updatedPrefsAfterExams.seasonal.exam2Date && !updatedPrefsAfterExams.seasonal.exam3Date) {
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
    let anyMulakatExpired = false;
    // Mulakat 1
    if (freshSeasonal.mulakatMode && freshSeasonal.mulakatDate && new Date(freshSeasonal.mulakatDate).setHours(23, 59, 59, 999) < now) {
      freshPrefs.mulakatPlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.mulakatPlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat'));
      freshPrefs.clearPlanIds('mulakat');
      freshPrefs.setSeasonalPref('mulakatName', '');
      freshPrefs.setSeasonalPref('mulakatDate', null);
      anyMulakatExpired = true;
    }
    // Mulakat 2
    if (freshSeasonal.mulakat2Name && freshSeasonal.mulakat2Date && new Date(freshSeasonal.mulakat2Date).setHours(23, 59, 59, 999) < now) {
      freshPrefs.mulakat2PlanHabitIds.forEach(id => removeHabitFn(id));
      freshPrefs.mulakat2PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat2'));
      freshPrefs.clearPlanIds('mulakat2');
      freshPrefs.setSeasonalPref('mulakat2Name', '');
      freshPrefs.setSeasonalPref('mulakat2Date', null);
      anyMulakatExpired = true;
    }
    // Mulakat 3
    if (freshSeasonal.mulakat3Name && freshSeasonal.mulakat3Date && new Date(freshSeasonal.mulakat3Date).setHours(23, 59, 59, 999) < now) {
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
      const sweepTags = new Set<string>();
      if (!sSeasonal.examMode) MODE_TASK_TAGS.exam.forEach(t => sweepTags.add(t));
      if (!sSeasonal.tezMode) MODE_TASK_TAGS.tez.forEach(t => sweepTags.add(t));
      if (!sSeasonal.mulakatMode) MODE_TASK_TAGS.mulakat.forEach(t => sweepTags.add(t));
      if (!sSeasonal.sporMode) MODE_TASK_TAGS.spor.forEach(t => sweepTags.add(t));
      if (!sSeasonal.ramazan) MODE_TASK_TAGS.ramazan.forEach(t => sweepTags.add(t));
      if (sweepTags.size > 0) {
        const orphans = useTaskStore.getState().tasks.filter(t =>
          (t.tags ?? []).some(tag => sweepTags.has(tag))
        );
        orphans.forEach(t => {
          const modeTag = (t.tags ?? []).find(tag => sweepTags.has(tag));
          retirePlanTask(t.id, modeTag);
        });
      }

      // ── ALIŞKANLIK ORPHAN SWEEP ──────────────────────────────────────────────
      // Kapalı modlara ait alışkanlıkları sil. Mod tespiti: yeni alışkanlıklarda
      // `planMode`, eski (legacy) olanlarda id öneki (`habit_<modtype>_...`).
      // Manuel alışkanlıklar (id `habit_<timestamp>_...`) etkilenmez → yanlış-pozitif yok.
      const offModes = new Set<string>();
      if (!sSeasonal.examMode) { offModes.add('exam'); offModes.add('yks'); offModes.add('kpss'); }
      if (!sSeasonal.tezMode) offModes.add('tez');
      if (!sSeasonal.mulakatMode) offModes.add('mulakat');
      if (!sSeasonal.sporMode) offModes.add('spor');
      if (!sSeasonal.ramazan) offModes.add('ramazan');
      if (offModes.size > 0) {
        const removeHabitOrphan = useHabitStore.getState().removeHabit;
        useHabitStore.getState().habits.forEach(h => {
          const idMode = h.id.match(/^habit_(ramazan|yks|kpss|exam|tez|mulakat|spor)_/)?.[1];
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
      finalPrefs.syncToCloud().catch(() => {});
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
    const seenPlanTasks = new Set<string>();
    const duplicatePlanTasks = existing.filter(task => {
      if (task.isCompleted || !isPlanGeneratedTask(task)) return false;
      const key = planDedupeKey(task);
      if (!key) return false;
      if (seenPlanTasks.has(key)) return true;
      seenPlanTasks.add(key);
      return false;
    });

    duplicatePlanTasks.forEach(task => {
      retirePlanTask(task.id, task.tags?.find(tag => PLAN_TAGS.includes(tag)));
    });

    if (duplicatePlanTasks.length > 0) {
      const removedIds = new Set(duplicatePlanTasks.map(task => task.id));
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

    // ── ÜRETIM KAPISI ─────────────────────────────────────────────────────────
    // Temizlik/dedupe yukarıda her açılışta çalıştı; görev üretimi ise günde 1 kez.
    if (!force && !(await shouldRunToday())) return;

    // ── KILO ────────────────────────────────────────────────────────────────
    const sporDeadlinePast = !!activeSeasonal.sporDate && new Date(activeSeasonal.sporDate).setHours(23, 59, 59, 999) < Date.now();
    if (activeSeasonal.sporMode && activeSeasonal.sporGoal && !sporDeadlinePast) {
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
        // Plan başlangıcından bu yana geçen hafta sayısı (gerçek planStartDate'ten)
        const mStart = planSpecs.spor?.startDate;
        const weeksIn = mStart
          ? Math.max(0, Math.floor((Date.now() - new Date(mStart).getTime()) / (7 * 86400000)))
          : 0;
        const newTasks = buildMaratonAdaptationTasks(wkm, targetEvent, daysLeft, weeksIn, 0.7, existing, lang);
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

    const dailySlots: { spec: DailyPlanSpec; mode: Parameters<typeof applyTasks>[1]; taskIds: number[]; habitIds: string[]; subjectId?: string }[] = [];

    // Konu/müfredat takibi için bugünün gün indeksi (deterministik rotasyon)
    const subjectDayIndex = Math.floor(today.getTime() / 86400000);
    const subjectProgress = useSubjectStore.getState().progress;

    // Sınav slotları — bilinen sınavda günün konusunu seç ("KPSS — Türkçe"),
    // bilinmeyen sınavda düz ad (jenerik akış). Görev üretilirse ilerleme güncellenir.
    for (const slot of examSlots) {
      if (slot.active && slot.name && slot.date) {
        let planName = slot.name;
        let subjectId: string | undefined;
        const curriculum = findExamCurriculum(slot.name);
        if (curriculum) {
          const subject = pickSubject(curriculum, subjectProgress, subjectDayIndex);
          if (subject) {
            planName = subjectExamLabel(slot.name, subject, lang);
            subjectId = subject.id;
          }
        }
        dailySlots.push({
          spec: { kind: 'exam', slot: slot.mode, name: planName, daysLeft: daysUntil(slot.date), dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
          mode: slot.mode, taskIds: slot.taskIds, habitIds: slot.habitIds, subjectId,
        });
      }
    }
    // Tez
    if (activeSeasonal.tezMode && activeSeasonal.tezName && activeSeasonal.tezDate) {
      dailySlots.push({
        spec: { kind: 'tez', slot: 'tez', name: activeSeasonal.tezName, daysLeft: daysUntil(activeSeasonal.tezDate), dailyMinutes: planSpecs.tez?.dailyMinutes, templateId: planSpecs.tez?.templateId },
        mode: 'tez', taskIds: tezPlanTaskIds, habitIds: tezPlanHabitIds,
      });
    }
    // Mülakat slotları
    for (const slot of mulakatSlots) {
      if (slot.active && slot.name && slot.date) {
        dailySlots.push({
          spec: { kind: 'mulakat', slot: slot.mode, name: slot.name, daysLeft: daysUntil(slot.date), dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
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
          spec: { kind: sporKind(slot.goal), slot: slot.mode, daysLeft: daysUntil(slot.date), dailyMinutes: planSpecs[slot.mode]?.dailyMinutes, templateId: planSpecs[slot.mode]?.templateId },
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
          spec: { kind: 'ramazan', slot: 'ramazan', daysLeft: daysUntil(activeRamazan.end), dailyMinutes: planSpecs.ramazan?.dailyMinutes, templateId: planSpecs.ramazan?.templateId },
          mode: 'ramazan', taskIds: ramazanPlanTaskIds, habitIds: ramazanPlanHabitIds,
        });
      }
    }

    // Adaptif zorluk sinyali (tüm planlar için ortak) — günlük üretimi modüle eder.
    const adherence = computeAdherenceSignal();
    const subjectTodayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (const ds of dailySlots) {
      const daily = buildDailyTasks({ ...ds.spec, adherence }, fresh, lang, today);
      await applyTasks(daily, ds.mode, ds.taskIds, ds.habitIds);
      // Konu çalışıldıysa ilerlemeyi işaretle → yarın rotasyon bir sonraki konuya geçer.
      if (daily.length > 0 && ds.subjectId) {
        useSubjectStore.getState().markStudied(ds.subjectId, subjectTodayKey);
      }
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
      ]).then(() => {
        // Önce tek seferlik migrasyon (eski gelecek-tarihli döküm görevlerini temizle),
        // sonra günlük üretimi çalıştır.
        runPlanMigrationOnce().finally(() => run());
      });
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
