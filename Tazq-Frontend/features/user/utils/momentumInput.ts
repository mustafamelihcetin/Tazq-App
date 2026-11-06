import { computeMomentum, type MomentumInput } from '@/shared/utils/momentum';
import { computeStreakFromHistory } from '@/features/dashboard/utils/streakDay';
import { summarizeWeek, type FocusSessionRow, type ReportHabit, type ReportTask } from '@/features/report/weeklyReport';
import { toDateKey } from '@/shared/utils/dateKey';

/*
  MOMENTUM GİRDİSİ (2026-11-06). Görev, odak ve alışkanlık sayıları Geri Bakış'la aynı motordan (summarizeWeek), son 7 yerel gün üzerinden gelir: pazartesi sıfırlanmaz, iki ekran farklı sayı söylemez.
  Aynı işlev geçmiş bir gün için de çalışır; hesap değişince son 7 günün skoru bununla yeniden üretilir, grafikte sahte sıçrama kalmaz.
*/
export function rollingDays(end: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return toDateKey(d);
  });
}

export function buildMomentumInput(p: {
  tasks: (ReportTask & MomentumInput['tasks'][number])[]; sessions: FocusSessionRow[]; habits: ReportHabit[]; streak: number; now: Date;
  /** Sunucuya henüz ulaşmamış bugünkü odak: büyük olan geçerli. */
  todayMinutes?: number;
}): MomentumInput {
  const days = rollingDays(p.now);
  const sum = summarizeWeek({ sessions: p.sessions, tasks: p.tasks, habits: p.habits, range: { days, startKey: days[0], endKey: days[6] }, now: p.now });
  const focus = [...sum.focusPerDay];
  focus[6] = Math.max(focus[6], p.todayMinutes ?? 0);
  return {
    tasks: p.tasks,
    weeklyFocus: focus.map(minutes => ({ minutes })),
    weeklyMinutes: focus.reduce((a, b) => a + b, 0),
    streak: p.streak,
    habitRatio: sum.habitPossible > 0 ? Math.min(1, sum.habitDone / sum.habitPossible) : null,
    now: p.now,
  };
}

/** Geçmiş bir günün skoru: o gün bitene kadarki kayıtlarla. Tarih "YYYY-MM-DD". */
export function momentumOnDay(day: string, p: { tasks: Parameters<typeof buildMomentumInput>[0]['tasks']; sessions: FocusSessionRow[]; habits: ReportHabit[]; focusGoalMinutes: number }): number {
  const [y, m, d] = day.split('-').map(Number);
  const now = new Date(y, m - 1, d, 12);
  const streak = computeStreakFromHistory({ tasks: p.tasks as never, habits: p.habits as never, focusDate: '', focusMinutes: 0, focusGoalMinutes: p.focusGoalMinutes, now });
  return computeMomentum(buildMomentumInput({ ...p, streak, now })).momentum;
}
