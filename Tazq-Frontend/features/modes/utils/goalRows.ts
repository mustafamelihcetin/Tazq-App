import { calendarDayOf } from '@/shared/utils/dateKey';

/*
  HEDEF SATIRININ VERİSİ (2026-11-05, kullanıcı: "hepsi aktifken karmaşa oluyor, tek tek incelemek gerekiyor"). Saf: bir hedefin bugünkü durumu.
  Ölçüt Planım'la aynı: bugünün işleri + bitmemiş gecikenler + tarihsizler. İki ekran aynı sayıyı göstersin diye (bkz. usePlanItems).
*/
type TaskLike = { id: number; title: string; dueDate?: string | null; isCompleted?: boolean; isArchived?: boolean; tags?: string[] | null };
type HabitLike = { id: string; pausedAt?: unknown; completedDates?: string[] | null };

export interface GoalDay { done: number; total: number; next: string | null }

/**
 * Görev bu yuvanın mı. Kurulum görevleri aynı türde ortak etiket taşır: IELTS'in işi "exam" etiketiyle DGS satırına düşüyor, sayılar da şişiyordu (cihazda görüldü).
 * Kardeş yuvanın listesindeki görev bu yuvanın değildir; listede olmayan etiketli görev (başka cihazdan) eskisi gibi tanınır.
 */
export const SIBLING_SLOTS: Record<string, string[]> = {
  exam: ['exam2', 'exam3'], exam2: ['exam', 'exam3'], exam3: ['exam', 'exam2'],
  mulakat: ['mulakat2', 'mulakat3'], mulakat2: ['mulakat', 'mulakat3'], mulakat3: ['mulakat', 'mulakat2'],
  spor: ['spor2', 'spor3'], spor2: ['spor', 'spor3'], spor3: ['spor', 'spor2'],
};
export function foreignTaskIds(slot: string, prefs: Record<string, unknown>): Set<number> {
  return new Set((SIBLING_SLOTS[slot] ?? []).flatMap(s => (prefs[`${s}PlanTaskIds`] as number[] | undefined) ?? []));
}
export const belongsToSlot = (t: { id: number; tags?: string[] | null }, slot: string, taskIds: number[], foreign: Set<number>) =>
  taskIds.includes(t.id) || (!foreign.has(t.id) && (t.tags ?? []).includes(slot));

export function goalDay(slot: string, habitIds: string[], taskIds: number[], tasks: TaskLike[], habits: HabitLike[], today: string, foreign: Set<number> = new Set()): GoalDay {
  const planHabits = habits.filter(h => habitIds.includes(h.id) && !h.pausedAt);
  const todayTasks = tasks.filter(t => {
    if (t.isArchived || !belongsToSlot(t, slot, taskIds, foreign)) return false;
    const due = calendarDayOf(t.dueDate);
    return t.isCompleted ? due === today : !due || due <= today;
  });
  const done = todayTasks.filter(t => t.isCompleted).length + planHabits.filter(h => (h.completedDates ?? []).includes(today)).length;
  return { done, total: todayTasks.length + planHabits.length, next: todayTasks.find(t => !t.isCompleted)?.title ?? null };
}

/** Kaç hedef satırla gösterilir: tek hedef olduğu gibi kalır, karmaşa ikinciyle başlar. Tur açıkken kartlar açık kalır, tur onları gösterir. */
export const useCompactGoals = (cardCount: number, tourOn: boolean) => cardCount >= 2 && !tourOn;

/** Aynı türün satırları yan yana: açılan kart onların altına gelir. Tür sırası en yakın hedefe göre korunur. */
export function groupByType<T extends { type: string }>(rows: T[]): T[] {
  const order: string[] = [];
  for (const r of rows) if (!order.includes(r.type)) order.push(r.type);
  return order.flatMap(type => rows.filter(r => r.type === type));
}

/** Bir hedefin her an olabileceği durumlar. Satır, Planım ve boş liste aynı tablodan konuşur; yeni durum eklenince derleyici metnini ister. */
export const GOAL_STATES = ['active', 'allDone', 'empty', 'rest', 'passed', 'paused', 'notStarted', 'eid'] as const;
export type GoalState = (typeof GOAL_STATES)[number];

export function goalStateOf(g: { paused: boolean; restToday: boolean; daysLeft: number | null; done: number; total: number; notStarted?: boolean; eid?: boolean }): GoalState {
  if (g.paused) return 'paused';
  if (g.eid && g.total === 0) return 'eid';
  if (g.notStarted) return 'notStarted';
  if (g.daysLeft != null && g.daysLeft < 0) return 'passed';
  if (g.total > 0 && g.done >= g.total) return 'allDone';
  if (g.total > 0) return 'active';
  return g.restToday ? 'rest' : 'empty';
}

/** Çok yuvalı türde sıradaki boş yuva: 1. yuva boşaldıysa önce orası. Doluysa null: sınır (3) kullanıcıya sessizce çarpmaz, satır hiç çıkmaz. */
export function nextFreeSlot(names: string[], slots: string[]): string | null {
  const i = names.findIndex(n => !n.trim());
  return i < 0 ? null : slots[i];
}

/** Plan görevi taşıyan etiketler. Tasarruf ve bırakma da burada: eskiden listede yoktu, etiketsiz kaldırılıyordu. */
export const PLAN_MODE_TAGS = ['exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3', 'spor', 'spor2', 'spor3', 'ramazan', 'tasarruf', 'birakma', 'yks', 'kpss'] as const;

/**
 * GÜN GEÇİNCE YAPILMAMIŞ İŞ NE OLUR (2026-11-05, kullanıcı: "yaptı yapmadı erteledi"). Günlük üretilen iş devretmez: yarın yenisi gelir, liste şişmez.
 * Bir kez yapılacak kurulum işi ("Sahur alarmını kur") sessizce silinmez, bugüne devreder: eskiden spor ve Ramazan'da siliniyordu, kullanıcı planın bir adımını haber almadan kaybediyordu.
 * Tarihe bağlı öneri (kilo platosu, Kadir Gecesi) devretmez: dünkü öneri bugün yanlış olabilir.
 */
export function overdueAction(tags: string[] | null | undefined): 'rollover' | 'retire' {
  const t = tags ?? [];
  if (!t.some(x => (PLAN_MODE_TAGS as readonly string[]).includes(x))) return 'retire';
  if (t.includes('daily') || t.some(x => /_adapt$|_kadir$|^kilo_|^maraton_|^ramazan_/.test(x))) return 'retire';
  return 'rollover';
}

/**
 * AYNI ANDA KAÇ HEDEF (2026-11-05, kullanıcı: "3 fiziksel hedef çok mu, tekrar düşün").
 * Sınav ve mülakat gerçekten üst üste binebilir. Beden tek: kilo ve antrenman günü verisi tek takım tutuluyor, iki hedef yeterli. Bırakma her gün irade ister; sınır sayaç enflasyonunu keser.
 * Düşürülen sınır eski kaydı silmez: yenisi eklenemez, var olan kalır.
 */
export const GOAL_LIMITS = { exam: 3, mulakat: 3, spor: 2, birakma: 3 } as const;
export const quitRoomLeft = (count: number, selecting = 0) => Math.max(0, GOAL_LIMITS.birakma - count - selecting);
