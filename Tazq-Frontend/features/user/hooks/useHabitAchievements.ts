import { useEffect, useMemo, useRef } from 'react';
import { milestone } from '@/features/habits/utils/habitSchedule';
import { useAchievementStore } from '@/features/user/store/useAchievementStore';
import { ACHIEVEMENTS, habitAchievementIds } from '@/features/user/utils/achievements';

/*
  ALIŞKANLIK BAŞARIMLARI (2026-11-06). Eşik bu oturumda aşılınca kutlanır; açılışta zaten aşılmışsa sessizce işlenir (eski kullanıcıya rozet yağmuru olmaz).
  Toplam tekrar asla düşmez: seri kırılınca rozet gitmez. Sade modda çalışmaz.
*/
export function useHabitAchievements(habits: { completedDates?: string[] }[], enabled: boolean): void {
  const best = useMemo(() => habits.reduce((m, h) => Math.max(m, milestone(h as Parameters<typeof milestone>[0]).total), 0), [habits]);
  const seen = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const prev = seen.current;
    seen.current = best;
    const store = useAchievementStore.getState();
    const missing = habitAchievementIds(best).filter(id => !store.unlocked.includes(id));
    if (missing.length === 0) return;
    if (prev == null) { useAchievementStore.setState({ unlocked: [...store.unlocked, ...missing] }); return; }
    if (best > prev) store.trigger(ACHIEVEMENTS[missing[missing.length - 1]]);
  }, [best, enabled]);
}
