import { toDateKey, calendarDayOf } from '@/shared/utils/dateKey';

/**
 * BİR MODUN SON HAFTALARI — "Modların Özeti" ekranının tek hesabı.
 *
 * Özet eskiden yol haritasını ve durum kartını tekrarlıyordu (kalan gün, bugünkü plan,
 * aktif mod sayısı). Artık rolü ayrı: yol haritası İLERİYE bakar, özet GERİYE.
 * Ölçü: modun plan alışkanlıklarının işaretlendiği günler + bitirilen plan görevleri,
 * Pazartesi başlayan YEREL haftalara göre. Kıyas bu haftanın şimdiye kadarı ile geçen
 * haftanın AYNI GÜNÜNE kadarki kısmı — yarım hafta tam haftayla kıyaslanmaz.
 */
export interface HistoryHabit { id: string; completedDates?: string[] | null }
export interface HistoryTask { id: number; isCompleted?: boolean; completedAt?: string | null }

export interface ModeHistory {
  /** Eskiden yeniye hafta toplamları; son eleman bu hafta. */
  weeks: number[];
  thisWeek: number;
  /** Geçen haftanın bugünkü gün dahil o güne kadarki toplamı. */
  lastWeekSameDay: number;
}

export function modeHistory({ habits, tasks, habitIds, taskIds, now = new Date(), weeks = 4 }: {
  habits: HistoryHabit[];
  tasks: HistoryTask[];
  habitIds: string[];
  taskIds: number[];
  now?: Date;
  weeks?: number;
}): ModeHistory {
  const todayIdx = (now.getDay() + 6) % 7; // 0 = Pazartesi
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIdx - 7 * (weeks - 1));
  // Gün anahtarı → [hafta, haftanın günü]
  const slot = new Map<string, [number, number]>();
  for (let i = 0; i < 7 * weeks; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    slot.set(toDateKey(d), [Math.floor(i / 7), i % 7]);
  }

  const totals = new Array(weeks).fill(0);
  let lastWeekSameDay = 0;
  const count = (key: string | null) => {
    const s = key ? slot.get(key) : undefined;
    if (!s) return;
    totals[s[0]]++;
    if (s[0] === weeks - 2 && s[1] <= todayIdx) lastWeekSameDay++;
  };

  const hIds = new Set(habitIds);
  for (const h of habits) {
    if (!hIds.has(h.id)) continue;
    for (const k of new Set(Array.isArray(h.completedDates) ? h.completedDates : [])) count(k);
  }
  const tIds = new Set(taskIds);
  for (const t of tasks) {
    if (tIds.has(t.id) && t.isCompleted) count(calendarDayOf(t.completedAt));
  }

  return { weeks: totals, thisWeek: totals[weeks - 1], lastWeekSameDay };
}
