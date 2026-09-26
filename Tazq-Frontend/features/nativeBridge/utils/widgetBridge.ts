import { Platform } from 'react-native';
import { useHabitStore } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { fmtDateKey } from '@/features/habits';
import { completeTask } from '@/features/tasks/utils/taskActions';
import { swallow } from '@/shared/utils/swallow';

/**
 * Telefon → Ana Ekran Widget'ı ve Apple Watch köprüsü.
 *
 * Yalnız iOS'ta gerçek bir native modül var (bkz. modules/tazq-widget-bridge);
 * Android'de ve Expo Go'da modül hiç bağlı değil, o yüzden her çağrı sessizce
 * no-op olmalı — bu dosyanın dışına "Platform.OS === 'ios'" kontrolü sızdırmamak
 * için burada tek noktadan yapılıyor.
 */
function getBridge(): typeof import('@/modules/tazq-widget-bridge/src/TazqWidgetBridgeModule').default | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('@/modules/tazq-widget-bridge/src/TazqWidgetBridgeModule').default;
  } catch {
    return null;
  }
}

let lastPushedJson = '';

/**
 * Widget/Watch'ın gösterdiği özeti hesaplar ve değiştiyse native tarafa yazar.
 *
 * Aynı JSON'u art arda yazmamak için son gönderilenle karşılaştırılıyor — bu,
 * her render'da native köprüyü (ve WCSession'ı) tetiklemeden, bir `useEffect`
 * içinde state değişince çağrılabilmesini sağlıyor.
 */
export function pushWidgetSummary(): void {
  const bridge = getBridge();
  if (!bridge) return;

  const habits = useHabitStore.getState().habits;
  const todayKey = fmtDateKey(new Date());
  const habitsTotal = habits.length;
  const habitsCompletedToday = habits.filter(h => h.completedDates.includes(todayKey)).length;
  const streak = useFocusStore.getState().localStreak;

  const payload: Record<string, unknown> = {
    streak,
    habitsCompletedToday,
    habitsTotal,
    language: useLanguageStore.getState().language,
  };

  const json = JSON.stringify(payload);
  if (json === lastPushedJson) return;
  lastPushedJson = json;
  bridge.updateSharedData(json).catch((e: unknown) => swallow('nativeWidgetBridge.push', e));
}

/**
 * Watch'tan gelen tek eylemi dinler: alışkanlık tamamlama.
 *
 * Odak başlat/durdur BİLEREK dinlenmiyor — telefondaki odak akışı commit/claim
 * adımlarıyla bir durum makinesi; Watch'tan körlemesine yazmak yarım ya da çift
 * oturum riski taşır. Bkz. modules/tazq-widget-bridge/ios/TazqWidgetBridgeModule.swift.
 *
 * `app/_layout.tsx`'teki bildirim dinleyicisiyle aynı desen: tek başlatma
 * noktası, `[isLoggedIn]` bağımlı bir effect içinde çağrılır.
 */
export function initWatchBridge(): () => void {
  const bridge = getBridge();
  if (!bridge) return () => {};

  const sub = bridge.addListener('onWatchAction', (event) => {
    if (event.type !== 'habitCompleted') return;
    const habitId = Number(event.data?.habitId);
    if (!Number.isFinite(habitId)) return;
    completeTask(habitId).catch((e: unknown) => swallow('nativeWidgetBridge.watchAction', e));
  });

  return () => sub.remove();
}
