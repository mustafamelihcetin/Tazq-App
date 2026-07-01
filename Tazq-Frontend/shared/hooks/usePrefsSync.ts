import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/user/store/useAuthStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

// Tercih değişikliklerini (mod seçimleri, planlar, üretkenlik saati vb.) debounce ederek
// backend'e gönderir. Yalnızca giriş yapılmış ve çevrimiçiyken push edilir.
// Çevrimdışıyken tercihler lokalde kalıcı kalır; tekrar online olununca sonraki değişiklikte
// (ya da online geçişinde) güncel snapshot gönderilir.
const DEBOUNCE_MS = 2500;

export function usePrefsSync() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const firstRun = useRef(true);

  useEffect(() => {
    // prefs store'daki herhangi bir alan değiştiğinde tetiklenir.
    const unsub = usePrefsStore.subscribe(() => {
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const { isLoggedIn: logged } = useAuthStore.getState();
        const { isOnline: online } = useNetworkStore.getState();
        if (!logged || !online) return; // online/login olunca aşağıdaki effect yakalar
        dirty.current = false;
        usePrefsStore.getState().syncToCloud();
      }, DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Online + login geçişlerinde, bekleyen (dirty) değişiklikleri flush et.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (isLoggedIn && isOnline && dirty.current) {
      dirty.current = false;
      usePrefsStore.getState().syncToCloud();
    }
  }, [isLoggedIn, isOnline]);
}
