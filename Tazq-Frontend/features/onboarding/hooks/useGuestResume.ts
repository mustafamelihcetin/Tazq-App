import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/user/store/useAuthStore';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { shouldAbandonGuest } from '../utils/guestResume';

/**
 * Yarım kalan misafirlik: hoş geldini bitirmeden kapatan misafir giriş ekranından başlar (bkz. guestResume).
 * Yalnız soğuk açılışta, üç depo da diskten okunduktan sonra, BİR KEZ — aynı oturumda "göz at"a yeni
 * basan kişi etkilenmez. Misafirlik bitince kök düzenin auth kapısı (isGuest'e bağlı) girişe götürür.
 */
export function useGuestResume() {
  const checked = useRef(false);
  const authReady = useAuthStore(s => s._hasHydrated);
  const sessionReady = useSessionStore(s => s._hasHydrated);
  const prefsReady = usePrefsStore(s => s._hasHydrated);
  useEffect(() => {
    if (checked.current || !authReady || !sessionReady || !prefsReady) return;
    checked.current = true;
    const prefs = usePrefsStore.getState();
    if (shouldAbandonGuest({ isGuest: useSessionStore.getState().isGuest, isLoggedIn: useAuthStore.getState().isLoggedIn, welcomeStatus: prefs.welcomeStatus })) {
      useSessionStore.getState().setGuest(false);
      useSessionStore.getState().setGuestProfile(null);
      prefs.setWelcomeStatus('unknown');
      prefs.setCapturePending(false);
    }
  }, [authReady, sessionReady, prefsReady]);
}
