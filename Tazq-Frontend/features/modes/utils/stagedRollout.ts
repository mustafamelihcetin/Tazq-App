/**
 * KADEMELİ AÇILIM (madde 4).
 *
 * Mod açılışında şablonun bütün alışkanlıkları ve günlere yayılmış görevleri bir anda
 * oluşturuluyordu: ilk gün 3 alışkanlık + 3-4 görev. Kullanıcı daha ne yaptığını
 * anlamadan "0/6" ile karşılaşıyordu — terk riskinin en yüksek olduğu an.
 *
 * Kural (kullanıcı kararı 2026-10-29):
 *  · İlk gün 1 çekirdek alışkanlık + en önemli 1 görev.
 *  · Kalanlar sıraya girer; bir önceki gün en az bir plan işi tamamlandıysa günde
 *    BİR öğe açılır. Tamamlama yoksa yük artmaz.
 *  · Yalnız yeni açılan modlar: önceden açılmış modların sırası yoktur, dokunulmaz.
 *  · Kendi akışı olan görevler (kilo girişi zinciri, Ramazan öncesi tarihliler) sıraya
 *    girmez — onların tarihi ve devamı başka yerde yönetiliyor.
 */
import { dayKeyOf } from '@/features/dashboard/utils/streakDay';
import type { StagedPlanEntry } from '@/features/modes/store/useStagedPlanStore';
import { roomLeft } from '@/features/habits/utils/habitLimit';

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export function splitForFirstDay<H, T extends { priority?: string }>(
  habits: H[],
  tasks: T[],
  opts: { pinned?: (task: T) => boolean } = {},
) {
  const pinned = tasks.filter(t => opts.pinned?.(t));
  const free = tasks
    .filter(t => !opts.pinned?.(t))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (PRIORITY_ORDER[a.t.priority ?? 'Low'] ?? 2) - (PRIORITY_ORDER[b.t.priority ?? 'Low'] ?? 2) || a.i - b.i)
    .map(x => x.t);
  return {
    habitsNow: habits.slice(0, 1),
    tasksNow: [...free.slice(0, 1), ...pinned],
    habitsLater: habits.slice(1),
    tasksLater: free.slice(1),
  };
}

export type StagedEntry<TT, HH> = { kind: 'task'; item: TT } | { kind: 'habit'; item: HH };

/** Görev ve alışkanlık dönüşümlü: açılımlar gün gün tek türe yığılmasın. */
export function interleaveStaged<TT, HH>(tasks: TT[], habits: HH[]): StagedEntry<TT, HH>[] {
  const out: StagedEntry<TT, HH>[] = [];
  for (let i = 0; i < Math.max(tasks.length, habits.length); i++) {
    if (i < tasks.length) out.push({ kind: 'task', item: tasks[i] });
    if (i < habits.length) out.push({ kind: 'habit', item: habits[i] });
  }
  return out;
}

/** O gün bu planın (yalnız bu planın) bir işi tamamlandı mı? */
export function planCompletedOn(
  dayKey: string,
  habitIds: string[],
  taskIds: number[],
  habits: Array<{ id: string; completedDates?: string[] }>,
  tasks: Array<{ id: number; isCompleted?: boolean; completedAt?: string | null }>,
): boolean {
  const hs = new Set(habitIds);
  const ts = new Set(taskIds);
  return habits.some(h => hs.has(h.id) && (h.completedDates ?? []).includes(dayKey))
    || tasks.some(t => ts.has(t.id) && !!t.isCompleted && dayKeyOf(t.completedAt) === dayKey);
}

/** Yuvanın modu açık mı: exam2 → examMode, spor3 → sporMode, ramazan → ramazan. */
export function isSlotModeOn(prefs: Record<string, unknown>, slot: string): boolean {
  const base = slot.replace(/\d+$/, '');
  const seasonal = (prefs.seasonal ?? {}) as Record<string, unknown>;
  return !!seasonal[base === 'ramazan' ? 'ramazan' : `${base}Mode`];
}

/** Günde en fazla bir açılım; sıra boşsa hiç. */
export function canUnlockToday(queue: { items: unknown[]; lastUnlockDay: string | null }, today: string): boolean {
  return queue.items.length > 0 && queue.lastUnlockDay !== today;
}

/**
 * Günlük açılım — usePlanAdaptations her çalıştığında çağrılır (günde bir kez etkili).
 *
 * Plan kapatılmışsa (yuvanın kimlik listeleri boş) sıra silinir. Oluşturma başarısız
 * olursa (çevrimdışı) öğe sırada KALIR ve bir sonraki çalışmada yeniden denenir —
 * "açıldı" işareti yalnız başarıda konur.
 */
export async function releaseStagedPlanItems(): Promise<void> {
  const { useStagedPlanStore } = require('@/features/modes/store/useStagedPlanStore');
  const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
  const { useHabitStore, fmtDateKey } = require('@/features/habits/store/useHabitStore');
  const { useTaskStore } = require('@/features/tasks/store/useTaskStore');
  const { useLanguageStore } = require('@/shared/store/useLanguageStore');
  const { TaskService } = require('@/shared/services/api');
  const { translateTag } = require('@/features/tasks/utils/taskTags');
  const { swallow } = require('@/shared/utils/swallow');

  const today: string = fmtDateKey();
  const yesterday: string = fmtDateKey(new Date(Date.now() - 86400000));
  const lang: 'tr' | 'en' = useLanguageStore.getState().language === 'en' ? 'en' : 'tr';

  const queues = useStagedPlanStore.getState().queues as Record<string, { items: StagedPlanEntry[]; lastUnlockDay: string | null }>;
  for (const [slot, queue] of Object.entries(queues)) {
    const prefs = usePrefsStore.getState() as unknown as Record<string, unknown>;
    const habitIds = (prefs[`${slot}PlanHabitIds`] as string[] | undefined) ?? [];
    const taskIds = (prefs[`${slot}PlanTaskIds`] as number[] | undefined) ?? [];
    /*
      SİLME KARARI MODUN DURUMUNA GÖRE, kimliklere göre DEĞİL. Kurulum kimlikleri önce
      temizleyip sunucuyu bekledikten sonra yazıyor; o arada çalışan açılım boş listeyi
      "plan kapandı" sanıp sırayı siliyordu (cihazda yakalandı). Kimlik yoksa beklenir.
    */
    if (!isSlotModeOn(prefs, slot)) { useStagedPlanStore.getState().clear(slot); continue; }
    if (habitIds.length === 0 && taskIds.length === 0) continue;
    if (!canUnlockToday(queue, today)) continue;
    if (!planCompletedOn(yesterday, habitIds, taskIds, useHabitStore.getState().habits, useTaskStore.getState().tasks)) continue;

    /*
      ALIŞKANLIK SINIRI (madde 6): sınır doluyken sıradaki alışkanlık BEKLER; araya
      sıradaki görev açılır (görev sınıra sayılmaz). Yalnız alışkanlık kaldıysa bugün
      açılım yok — yer açılınca devam eder.
    */
    const full = roomLeft(useHabitStore.getState().habits) === 0;
    const index = full ? queue.items.findIndex(e => e.kind === 'task') : 0;
    if (index < 0) continue;
    const head = queue.items[index];
    try {
      if (head.kind === 'habit') {
        const h = head.item;
        const id = `habit_${h.modeType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        useHabitStore.getState().addHabit(lang === 'tr' ? h.nameTr : h.nameEn, h.emoji, h.color, id, h.modeType, h.nameTr, h.nameEn);
        usePrefsStore.getState().setPlanIds(slot, [...habitIds, id], taskIds);
      } else {
        const t = head.item;
        const title = lang === 'tr' ? t.titleTr : t.titleEn;
        const description = JSON.stringify({ tr: t.titleTr, en: t.titleEn, ...(t.descTr && { descTr: t.descTr }), ...(t.descEn && { descEn: t.descEn }) });
        const created = await TaskService.createTask({
          title, description, priority: t.priority, isCompleted: false, subtasks: [],
          tags: t.tags.map((tag: string) => translateTag(tag, lang)),
          // Vade GERÇEK yerel gün: `today` seri günü (gece 03'e kadar dünü sayar), vade için yanlış.
          dueDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
        });
        useTaskStore.getState().addTask({ ...created, title });
        usePrefsStore.getState().setPlanIds(slot, habitIds, [...taskIds, created.id]);
      }
      useStagedPlanStore.getState().commitAt(slot, index, today);
    } catch (e) {
      swallow('stagedRollout.release', e); // sırada kalır, sonraki çalışmada yeniden denenir
    }
  }
}
