import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useStagedPlanStore, type StagedPlanEntry } from '@/features/modes/store/useStagedPlanStore';
import { interleaveStaged, splitForFirstDay } from '@/features/modes/utils/stagedRollout';
import { getModePreview } from '@/features/modes/utils/turkishModes';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useBudgetStore, type BudgetType } from '@/shared/store/useBudgetStore';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { useQuitStore, type QuitType } from '@/shared/store/useQuitStore';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { birakmaTypeLabel, birakmaTypeTasks, buildBirakmaPlan, buildTasarrufPlan, tasarrufTypeLabel } from '@/shared/utils/lifeModePlans';
import { swallow } from '@/shared/utils/swallow';

/*
  KAYBOLAN PLAN ADIMLARININ ONARIMI (2026-11-06). Eski hata (bkz. planLifecycleOwner testi) görevi kopyalarken sıradaki adımları da siliyordu:
  plan sessizce duruyor, kalan görev ve alışkanlıklar hiç açılmıyordu. Bu onarım her kullanıcı ve her yuva için bir kez çalışır.

  Yalnız kuyruğu en az bir kez çalışmış planlara dokunur (hata başka yerde oluşmaz). Eksikler bir anda listeye dökülmez, kuyruğa döner:
  günde en çok bir adım ve yalnız önceki gün iş yapıldıysa (bkz. stagedRollout). Var olan, kuyrukta bekleyen ya da yapılmış adım eklenmez.
  Kullanıcının kurulumda seçtiği alan veya tetikleyiciye özel ek görev şablondan bilinemez; o yüzden geri getirilmez.
*/
const FLAG = 'tazq-staged-repair-v1';

interface DraftTask { titleTr: string; titleEn: string; descTr?: string; descEn?: string; priority: string; tags: string[] }
interface DraftHabit { nameTr: string; nameEn: string; emoji: string; color: string }
interface SlotPlan { slot: string; modeType: string; tasks: DraftTask[]; habits: DraftHabit[] }

const norm = (s?: string | null) => (s ?? '').trim().toLocaleLowerCase('tr');

/** Plan kurulurken başlığa hedefin adı önek olur ("KPSS: ..."). Kurulum ve onarım aynı kuralı kullanır. */
export function formatWithPrefix(titleStr: string, prefixStr: string): string {
  if (!prefixStr || !titleStr) return titleStr;
  const p = prefixStr.trim();
  const t = titleStr.trim();
  const pLower = p.toLowerCase();
  const tLower = t.toLowerCase();
  if (tLower.startsWith(`${pLower}:`) || tLower.startsWith(`${pLower} -`)) return `${p}: ${t.slice(p.length + 1).replace(/^[:\s-]+/, '').trim()}`;
  if (tLower.startsWith(`${pLower} `)) return `${p}: ${t.slice(p.length).trim()}`;
  return `${p}: ${t}`;
}

const VISIBLE_TAG: Record<string, string> = { exam: 'education', tez: 'education', mulakat: 'work', spor: 'fitness', ramazan: 'ramazan' };

/** Şablon ayıklaması kurulumla aynı: ileri tarihli görevler günlük motorun, kilo zinciri kendi akışının. */
function fromTemplate(slot: string, modeType: string, prefix: string, mode: ReturnType<typeof getModePreview>, templateId?: string): SlotPlan {
  // Kayıtlı şablon yoksa önerilen ilk şablon: kurulum penceresi ve selfHeal de böyle seçer.
  const template = mode.templates?.find(t => t.id === templateId) ?? mode.templates?.[0];
  const tasks = (template?.tasks ?? mode.tasks ?? []).filter(t => !(t.daysFromNow !== undefined && t.daysFromNow > 1) && !t.tags?.includes('weight_entry'));
  const habits = template?.habits ?? mode.habits ?? [];
  return {
    slot,
    modeType,
    tasks: tasks.map(t => ({
      titleTr: prefix ? formatWithPrefix(t.titleTr, prefix) : t.titleTr,
      titleEn: prefix ? formatWithPrefix(t.titleEn, prefix) : t.titleEn,
      descTr: t.descTr,
      descEn: t.descEn,
      priority: t.priority,
      tags: Array.from(new Set([modeType, slot, ...(t.tags ?? []), ...(VISIBLE_TAG[modeType] ? [VISIBLE_TAG[modeType]] : [])])),
    })),
    habits: habits.map(h => ({ nameTr: h.nameTr ?? h.name, nameEn: h.name, emoji: h.emoji, color: h.color })),
  };
}

function lifePlan(slot: 'tasarruf' | 'birakma'): SlotPlan {
  const labelled = (label: string, text: string) => (label && !text.toLowerCase().includes(label.toLowerCase()) ? `${label}: ${text}` : text);
  if (slot === 'tasarruf') {
    const type = (useBudgetStore.getState().budgetType || 'birikim') as Exclude<BudgetType, ''>;
    const content = buildTasarrufPlan(type);
    return {
      slot,
      modeType: slot,
      tasks: content.tasks.map(t => ({ titleTr: labelled(tasarrufTypeLabel(type, true), t.title), titleEn: labelled(tasarrufTypeLabel(type, false), t.titleEn), descTr: t.desc, descEn: t.descEn, priority: t.priority, tags: t.tags })),
      habits: content.habits.map(h => ({ nameTr: h.name, nameEn: h.nameEn ?? h.name, emoji: h.emoji, color: h.color })),
    };
  }
  const base = buildBirakmaPlan('' as QuitType);
  const typeTasks = useQuitStore.getState().items.flatMap(i => birakmaTypeTasks(i.type).map(t => ({ t, label: [birakmaTypeLabel(i.type, true), birakmaTypeLabel(i.type, false)] })));
  return {
    slot,
    modeType: slot,
    tasks: [
      ...base.tasks.map(t => ({ titleTr: labelled('Bırakma', t.title), titleEn: labelled('Quit', t.titleEn), descTr: t.desc, descEn: t.descEn, priority: t.priority, tags: t.tags })),
      ...typeTasks.map(({ t, label }) => ({ titleTr: labelled(label[0], t.title), titleEn: labelled(label[1], t.titleEn), descTr: t.desc, descEn: t.descEn, priority: t.priority, tags: t.tags })),
    ],
    habits: base.habits.map(h => ({ nameTr: h.name, nameEn: h.nameEn ?? h.name, emoji: h.emoji, color: h.color })),
  };
}

function slotPlan(slot: string): SlotPlan | null {
  const prefs = usePrefsStore.getState();
  const s = prefs.seasonal as unknown as Record<string, string | null | undefined>;
  const templateId = (prefs.planSpecs as Record<string, { templateId?: string } | undefined>)[slot]?.templateId;
  const base = slot.replace(/\d+$/, '');
  const n = slot.slice(base.length);
  if (base === 'exam') {
    const name = s[`exam${n}Name`]; const date = s[`exam${n}Date`];
    return name && date ? fromTemplate(slot, 'exam', name, getModePreview('exam', { examName: name, examDate: date }), templateId) : null;
  }
  if (base === 'tez') return s.tezName && s.tezDate ? fromTemplate(slot, 'tez', s.tezName, getModePreview('tez', { tezName: s.tezName, tezDate: s.tezDate }), templateId) : null;
  if (base === 'mulakat') {
    const name = s[`mulakat${n}Name`]; const date = s[`mulakat${n}Date`];
    return name && date ? fromTemplate(slot, 'mulakat', name, getModePreview('mulakat', { mulakatName: name, mulakatDate: date }), templateId) : null;
  }
  if (base === 'spor') {
    const goal = s[`spor${n}Goal`]; const date = s[`spor${n}Date`];
    if (!goal || !date) return null;
    const spor = useSporStore.getState();
    const sporInputs = {
      currentWeight: parseFloat(spor.currentWeight) || undefined,
      targetWeight: parseFloat(spor.targetWeight) || undefined,
      weeklyKm: parseFloat(spor.weeklyKm) || undefined,
      targetEvent: spor.targetEvent || undefined,
      trainingDays: spor.trainingDays || undefined,
      gender: spor.gender || undefined,
    };
    return fromTemplate(slot, 'spor', goal, getModePreview('spor', { sporGoal: goal, sporDate: date, sporInputs }), templateId);
  }
  if (base === 'ramazan') return fromTemplate(slot, 'ramazan', '', getModePreview('ramazan'), templateId);
  if (slot === 'tasarruf' || slot === 'birakma') return lifePlan(slot);
  return null;
}

/** Şablonda olup hiçbir yerde bulunmayan adımlar. Saf: yalnız verilen kümelere bakar. */
export function missingEntries(
  plan: SlotPlan,
  seen: { queue: StagedPlanEntry[]; taskTitles: Set<string>; habitNames: Set<string> },
): StagedPlanEntry[] {
  const raw = (title: string) => title.replace(/^[^:]{1,60}:\s*/, '');
  const known = new Set(seen.taskTitles);
  seen.queue.forEach(e => { if (e.kind === 'task') { known.add(norm(e.item.titleTr)); known.add(norm(e.item.titleEn)); } });
  const has = (title: string) => known.has(norm(title)) || known.has(norm(raw(title)));
  const names = new Set(seen.habitNames);
  seen.queue.forEach(e => { if (e.kind === 'habit') { names.add(norm(e.item.nameTr)); names.add(norm(e.item.nameEn)); } });

  const tasks = plan.tasks.filter(t => !has(t.titleTr) && !has(t.titleEn));
  const habits = plan.habits.filter(h => !names.has(norm(h.nameTr)) && !names.has(norm(h.nameEn)));
  // Sıra kurulumla aynı: önemli olan önce.
  const ordered = splitForFirstDay(habits, tasks);
  return interleaveStaged(
    [...ordered.tasksNow, ...ordered.tasksLater],
    [...ordered.habitsNow, ...ordered.habitsLater].map(h => ({ ...h, modeType: plan.modeType })),
  ) as StagedPlanEntry[];
}

/** Kullanıcı başına bir kez. Bulut tercihleri gelmeden çalışmaz: modlar kapalı görünür, onarım boşuna tükenirdi. */
export async function repairStagedQueuesOnce(userId: number | null | undefined): Promise<number> {
  if (userId == null || usePrefsStore.getState().cloudHydratedFor !== userId) return 0;
  const flag = `${FLAG}:${userId}`;
  try {
    if (await AsyncStorage.getItem(flag)) return 0;
    await AsyncStorage.setItem(flag, '1');
    const seasonal = usePrefsStore.getState().seasonal as unknown as Record<string, unknown>;
    const { addItems, queues } = { addItems: useStagedPlanStore.getState().appendItems, queues: useStagedPlanStore.getState().queues };

    const taskTitles = new Set<string>();
    useTaskStore.getState().tasks.forEach(t => {
      taskTitles.add(norm(t.title));
      const title = t.title.replace(/^[^:]{1,60}:\s*/, '');
      taskTitles.add(norm(title));
      if (t.description?.startsWith('{"tr":')) {
        try {
          const d = JSON.parse(t.description) as { tr?: string; en?: string };
          taskTitles.add(norm(d.tr));
          taskTitles.add(norm(d.en));
        } catch (e) { swallow('stagedRepair.parse', e); }
      }
    });
    useCompletionStore.getState().events.forEach(e => {
      taskTitles.add(norm(e.taskName));
      taskTitles.add(norm(e.taskName.replace(/^[^:]{1,60}:\s*/, '')));
    });
    const habitNames = new Set<string>();
    useHabitStore.getState().habits.forEach(h => { [h.name, h.nameTr, h.nameEn].forEach(n => { if (n) habitNames.add(norm(n)); }); });

    let added = 0;
    for (const [slot, queue] of Object.entries(queues)) {
      if (!queue.lastUnlockDay) continue;
      const base = slot.replace(/\d+$/, '');
      if (!seasonal[base === 'ramazan' ? 'ramazan' : `${base}Mode`]) continue;
      const plan = slotPlan(slot);
      if (!plan) continue;
      const missing = missingEntries(plan, { queue: queue.items, taskTitles, habitNames });
      if (missing.length > 0) {
        addItems(slot, missing);
        added += missing.length;
      }
    }
    return added;
  } catch (e) {
    swallow('stagedRepair.run', e, { capture: true });
    return 0;
  }
}
