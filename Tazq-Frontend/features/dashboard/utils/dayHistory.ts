/**
 * SON 7 GÜN — ana sayfa ekranında "haftayı kaydır" için (2026-10-30).
 *
 * Takvim haftası değil, BUGÜNDEN geriye 7 gün: parmakla sola kaydıran kullanıcı "dün,
 * evvelsi gün…" der, pazartesiyi değil. Sayımlar haftalık geri bakışla AYNI kurallardan
 * gelir (taskDayKey: bittiği gün; sessionDayKey: yerel gün; alışkanlık: completedDates) —
 * iki ekran aynı gün için farklı sayı göstermesin.
 *
 * Görev halkasının paydası geçmiş günde "o gün bitenler ∪ o güne vadeli olanlar": günün
 * planı yeniden kurulamaz; ölçülemeyen hedef uydurulmaz (bkz. içgörü dürüstlüğü).
 */
import { toDateKey, calendarDayOf } from '@/shared/utils/dateKey';
import { sessionDayKey, taskDayKey, type FocusSessionRow, type ReportTask, type ReportHabit } from '@/features/report/weeklyReport';

export interface DayStat {
  key: string;
  tasksDone: number;
  tasksTotal: number;
  focusMin: number;
  habitsDone: number;
  /** O gün var olan (kurulmuş) alışkanlık sayısı. */
  habitsTotal: number;
}

export function lastDays(
  { sessions, tasks, habits }: { sessions: FocusSessionRow[]; tasks: ReportTask[]; habits: ReportHabit[] },
  now: Date = new Date(),
  n = 7,
): DayStat[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  const at = new Map(keys.map((k, i) => [k, i]));
  const out: DayStat[] = keys.map(key => ({ key, tasksDone: 0, tasksTotal: 0, focusMin: 0, habitsDone: 0, habitsTotal: 0 }));

  for (const s of sessions ?? []) {
    const i = at.get(sessionDayKey(s.startedAt) ?? '');
    if (i !== undefined) out[i].focusMin += Math.max(0, s.minutes || 0);
  }
  for (const t of tasks ?? []) {
    const doneDay = taskDayKey(t);
    const dueDay = calendarDayOf(t.dueDate);
    const di = doneDay ? at.get(doneDay) : undefined;
    if (di !== undefined) { out[di].tasksDone++; out[di].tasksTotal++; }
    // Vadesi o gün olup o gün bitmeyen (açık kalan ya da başka gün biten) de paydadadır.
    const vi = dueDay ? at.get(dueDay) : undefined;
    if (vi !== undefined && vi !== di) out[vi].tasksTotal++;
  }
  for (const h of habits ?? []) {
    const created = h.createdAt ? toDateKey(new Date(h.createdAt)) : null;
    const done = new Set(h.completedDates ?? []);
    out.forEach(d => {
      if (created && d.key < created) return;
      d.habitsTotal++;
      if (done.has(d.key)) d.habitsDone++;
    });
  }
  return out;
}
