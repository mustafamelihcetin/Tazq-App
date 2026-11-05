import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { modeRoomLeft } from '@/features/habits/utils/habitLimit';
import { makeClientKey } from '@/features/modes/hooks/usePlanAdaptations';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useStagedPlanStore } from '@/features/modes/store/useStagedPlanStore';
import { interleaveStaged, splitForFirstDay } from '@/features/modes/utils/stagedRollout';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { useBudgetStore, type BudgetType } from '@/shared/store/useBudgetStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useQuitStore, type QuitType } from '@/shared/store/useQuitStore';
import { toDateKey } from '@/shared/utils/dateKey';
import { swallow } from '@/shared/utils/swallow';
import { birakmaTypeLabel, birakmaTypeTasks, buildBirakmaPlan, buildTasarrufPlan, tasarrufTypeLabel, type SpendingArea, type TriggerId } from '@/shared/utils/lifeModePlans';

/*
  BİRİKİM VE BIRAKMA PLANINI BAŞLATMA TEK YERDE (2026-11-05). Kod kartların içindeydi; adım adım kurulum da aynı işi yapacağı için buraya alındı, iki kopya olmasın.
  Çevrimdışı çalışır: internet yoksa görev kuyruğa girer. Sunucu idempotency anahtarı aynı işin iki kez oluşmasını engeller (bkz. makeClientKey).
  Kademeli açılım: ilk gün 1 rutin + 1 görev, kalanı her gün birer sıradan gelir.
*/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskPayload = Record<string, any> & { title: string };

const pick = (tr: boolean, a: string, b: string) => ({ true: a, false: b }[String(tr) as 'true' | 'false']);

async function createPlanTask(raw: TaskPayload): Promise<number | null> {
  const payload = { ...raw, clientKey: raw.clientKey ?? makeClientKey(raw as never) };
  if (!useNetworkStore.getState().isOnline) {
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload } as never);
    useTaskStore.getState().addTask({ ...payload, id: tempId } as never);
    return tempId;
  }
  try {
    const t = await TaskService.createTask(payload as never);
    if (t?.id) { useTaskStore.getState().addTask(t); return t.id; }
  } catch (e) { swallow('lifePlanStart.createPlanTask', e); }
  return null;
}

export interface TasarrufInput { type: Exclude<BudgetType, ''>; start: number; target: number; monthly: number; cover: number; months: number; area: SpendingArea; lang: 'tr' | 'en' }

export async function startTasarrufPlan({ type, start, target, monthly, cover, months, area, lang }: TasarrufInput): Promise<void> {
  const tr = lang === 'tr';
  const content = buildTasarrufPlan(type, area);
  const habitIds: string[] = [];
  const staged = splitForFirstDay(content.habits, content.tasks);
  const room = modeRoomLeft(useHabitStore.getState().habits, 'tasarruf');
  staged.habitsNow.slice(0, room).forEach((h, i) => {
    const id = `habit_tasarruf_${i}_${Date.now()}`;
    useHabitStore.getState().addHabit(h.name, h.emoji, h.color, id, 'tasarruf');
    habitIds.push(id);
  });
  const taskIds: number[] = [];
  // Önek metnin dilinde: İngilizce başlığa Türkçe önek gidiyordu.
  const labelFor = (isTr: boolean) => tasarrufTypeLabel(type, isTr);
  const withLabel = (text: string, isTr: boolean) => (labelFor(isTr) && !text.toLowerCase().includes(labelFor(isTr).toLowerCase()) ? `${labelFor(isTr)}: ${text}` : text);
  useStagedPlanStore.getState().setQueue('tasarruf', interleaveStaged(
    staged.tasksLater.map(t => ({ titleTr: withLabel(t.title, true), titleEn: withLabel(t.titleEn, false), descTr: t.desc, descEn: t.descEn, priority: t.priority, tags: t.tags })) as never,
    [...staged.habitsNow.slice(room), ...staged.habitsLater].map(h => ({ nameTr: h.name, nameEn: h.nameEn ?? h.name, emoji: h.emoji, color: h.color, modeType: 'tasarruf' })) as never,
  ));
  for (const t of staged.tasksNow) {
    const titleTr = withLabel(t.title, true);
    const titleEn = withLabel(t.titleEn, false);
    const id = await createPlanTask({ title: pick(tr, titleTr, titleEn), description: JSON.stringify({ tr: titleTr, en: titleEn, descTr: t.desc, descEn: t.descEn }), priority: t.priority, isCompleted: false, tags: t.tags });
    if (id != null) taskIds.push(id);
  }
  const logTr = 'Bu hafta birikimini gir';
  const logEn = 'Log this week\'s balance';
  const wId = await createPlanTask({ title: pick(tr, logTr, logEn), description: JSON.stringify({ tr: logTr, en: logEn }), priority: 'Medium', dueDate: new Date().toISOString(), isCompleted: false, tags: ['tasarruf', 'budget_entry'] });
  if (wId != null) taskIds.push(wId);

  const d = new Date(); d.setMonth(d.getMonth() + (months || 6));
  // Türe özel hesaplanan başlangıç/hedef: ilerleme kartının kaynağı.
  const budget = useBudgetStore.getState();
  budget.setBudgetType(type);
  budget.setStartAmount(String(start));
  budget.setTargetAmount(String(target));
  budget.setCover(type === 'acilfon' ? monthly : 0, type === 'acilfon' ? cover : 0);
  const prefs = usePrefsStore.getState();
  prefs.setSeasonalPref('tasarrufMode', true);
  prefs.setSeasonalPref('tasarrufName', tasarrufTypeLabel(type, tr));
  prefs.setSeasonalPref('tasarrufDate', toDateKey(d));
  if (useBudgetStore.getState().log.length === 0) budget.addEntry(start); // başlangıç noktası
  prefs.setPlanIds('tasarruf', habitIds, taskIds);
  prefs.setPlanSpec('tasarruf', { ...usePrefsStore.getState().planSpecs.tasarruf }); // başlangıç damgası: Planım'daki yol çizgisi buna bakar
}

/** Temel (türden bağımsız) plan yoksa bir kez kurulur; yeni ya da var olan kimlikleri döner. */
async function ensureQuitBasePlan(trigger: TriggerId, tr: boolean): Promise<{ habitIds: string[]; taskIds: number[] }> {
  const prefs = usePrefsStore.getState();
  if (prefs.birakmaPlanHabitIds.length > 0 || prefs.birakmaPlanTaskIds.length > 0) return { habitIds: [...prefs.birakmaPlanHabitIds], taskIds: [...prefs.birakmaPlanTaskIds] };
  const content = buildBirakmaPlan('' as QuitType, trigger);
  const habitIds: string[] = [];
  const staged = splitForFirstDay(content.habits, content.tasks);
  const room = modeRoomLeft(useHabitStore.getState().habits, 'birakma');
  staged.habitsNow.slice(0, room).forEach((h, i) => {
    const id = `habit_birakma_${i}_${Date.now()}`;
    useHabitStore.getState().addHabit(h.name, h.emoji, h.color, id, 'birakma');
    habitIds.push(id);
  });
  const taskIds: number[] = [];
  const withLabel = (text: string, isTr: boolean) => { const l = pick(isTr, 'Bırakma', 'Quit'); return text.toLowerCase().includes(l.toLowerCase()) ? text : `${l}: ${text}`; };
  useStagedPlanStore.getState().setQueue('birakma', interleaveStaged(
    staged.tasksLater.map(t => ({ titleTr: withLabel(t.title, true), titleEn: withLabel(t.titleEn, false), descTr: t.desc, descEn: t.descEn, priority: t.priority, tags: t.tags })) as never,
    [...staged.habitsNow.slice(room), ...staged.habitsLater].map(h => ({ nameTr: h.name, nameEn: h.nameEn ?? h.name, emoji: h.emoji, color: h.color, modeType: 'birakma' })) as never,
  ));
  for (const t of staged.tasksNow) {
    const titleTr = withLabel(t.title, true);
    const titleEn = withLabel(t.titleEn, false);
    const id = await createPlanTask({ title: pick(tr, titleTr, titleEn), description: JSON.stringify({ tr: titleTr, en: titleEn, descTr: t.desc, descEn: t.descEn }), priority: t.priority, isCompleted: false, tags: t.tags });
    if (id != null) taskIds.push(id);
  }
  return { habitIds, taskIds };
}

export interface BirakmaInput { keys: Exclude<QuitType, ''>[]; custom: string; trigger: TriggerId; lang: 'tr' | 'en' }

export async function startBirakmaPlan({ keys, custom, trigger, lang }: BirakmaInput): Promise<void> {
  const tr = lang === 'tr';
  const { habitIds, taskIds } = await ensureQuitBasePlan(trigger, tr);
  // Yeni seçilen her tür için TİPE ÖZEL görevler sıraya girer, her gün biri açılır: iki şey seçen kullanıcı ilk gün 5 işle başlıyordu (cihazda görüldü).
  const later = keys.flatMap(k => birakmaTypeTasks(k)).map(t => ({ titleTr: t.title, titleEn: t.titleEn, descTr: t.desc, descEn: t.descEn, priority: t.priority, tags: t.tags }));
  const staged = useStagedPlanStore.getState();
  staged.setQueue('birakma', [...(interleaveStaged(later as never, []) as never[]), ...(staged.queues.birakma?.items ?? [])]);
  const prefs = usePrefsStore.getState();
  prefs.setPlanIds('birakma', habitIds, taskIds);
  prefs.setPlanSpec('birakma', { ...usePrefsStore.getState().planSpecs.birakma });
  prefs.setSeasonalPref('birakmaMode', true);
  const quit = useQuitStore.getState();
  keys.forEach(k => {
    const label = k === 'ozel' ? custom.trim() : birakmaTypeLabel(k, tr);
    if (k === 'ozel' && !label) return;
    quit.addItem(k, label);
  });
  const list = useQuitStore.getState().items;
  prefs.setSeasonalPref('birakmaName', list.length ? list[0].name + (list.length > 1 ? ` +${list.length - 1}` : '') : '');
}
