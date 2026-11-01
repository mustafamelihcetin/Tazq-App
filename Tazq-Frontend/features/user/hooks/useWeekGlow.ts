import { useMemo } from 'react';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { useFocusHistoryStore } from '@/features/report/useFocusHistoryStore';
import { lastDays } from '@/features/dashboard/utils/dayHistory';

/**
 * AURANIN PARLAKLIĞI (bkz. AuraAvatar) — son 7 günün kaçında bir şey yaptın (görev, alışkanlık ya da odak).
 * Yalnız ölçülen: hiç kayıt yoksa sönük ama görünür taban (0.25), her aktif gün parlatır.
 */
export function useWeekGlow(): number {
  return useWeekAura().glow;
}

/** Aura + anlamı: son 7 günün kaçı aktif (profilde "Auran bu hafta N günde parladı"). */
export function useWeekAura(): { glow: number; activeDays: number } {
  const tasks = useTaskStore(s => s.tasks);
  const habits = useHabitStore(s => s.habits);
  const sessions = useFocusHistoryStore(s => s.sessions);
  return useMemo(() => {
    const days = lastDays({ sessions, tasks, habits });
    const active = days.filter(d => d.tasksDone + d.habitsDone + d.focusMin > 0).length;
    return { glow: 0.25 + 0.75 * (active / 7), activeDays: active };
  }, [tasks, habits, sessions]);
}
