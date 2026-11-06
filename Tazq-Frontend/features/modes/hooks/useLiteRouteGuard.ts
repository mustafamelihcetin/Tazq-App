import { useEffect } from 'react';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { isHiddenInLite } from '@/features/modes/utils/liteScope';
import { goHome } from '@/shared/utils/authNavigation';
import { cancelEveningBrief, cancelExamCountdownNotifs, cancelMorningBrief, cancelRamadanStartNotification, cancelWeeklySummary } from '@/shared/utils/notifications';
import { useSplashPrefs } from '@/shared/store/useSplashPrefs';

/** Bildirim ya da eski bir bağlantı kapsam dışı sayfayı açmak isterse ana sayfaya döner; özetler ve geri sayımlar susar, açılış sadeleşir (bkz. liteScope). */
export function useLiteRouteGuard(route: string | undefined, router: { dismissTo: (href: '/') => void }): void {
  const lite = usePrefsStore(s => s.uiMode === 'lite');
  useEffect(() => {
    useSplashPrefs.getState().setPlain(lite);
    if (!lite) return;
    void cancelWeeklySummary(); void cancelMorningBrief(); void cancelEveningBrief(); void cancelExamCountdownNotifs(); void cancelRamadanStartNotification();
  }, [lite]);
  useEffect(() => { if (lite && isHiddenInLite(route)) goHome(router); }, [lite, route, router]);
}
