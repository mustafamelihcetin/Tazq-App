import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/user/store/useAuthStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { hydrateHabits, pushHabits, isHabitsSyncReady } from '@/features/habits/sync/habitsSync';

const DEBOUNCE_MS = 2500;

/**
 * ALIŞKANLIKLARI HESABA EŞİTLER (bkz. habitsSync.ts — kapılar orada).
 *  · Giriş / çevrimiçi olma: bulut çekilir, yerel ile birleşir (gönderim kapısı ancak sonra açılır).
 *  · Değişiklik: 2,5 sn gecikmeli gönderim; başarısızsa "bekleyen" kalır, çevrimiçi olunca yeniden.
 * usePrefsSync ile aynı kalıp; misafirde hiçbir şey yapmaz.
 */
export function useHabitsSync() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !isOnline || userId == null) return;
    hydrateHabits(userId).then((ok) => {
      if (ok && dirty.current) pushHabits(userId).then((sent) => { if (sent) dirty.current = false; });
    });
  }, [isLoggedIn, isOnline, userId]);

  useEffect(() => {
    const unsub = useHabitStore.subscribe((s, prev) => {
      if (s.habits === prev.habits) return;
      dirty.current = true;
      const uid = useAuthStore.getState().user?.id ?? null;
      if (!isHabitsSyncReady(uid)) return; // birleştirme bitince yukarıdaki etki gönderir
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!useNetworkStore.getState().isOnline) return;
        pushHabits(uid).then((sent) => { if (sent) dirty.current = false; });
      }, DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
