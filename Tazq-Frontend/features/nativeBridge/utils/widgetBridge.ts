import { useHabitStore } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { fmtDateKey } from '@/features/habits';
import { completeTask } from '@/features/tasks/utils/taskActions';
import { swallow } from '@/shared/utils/swallow';
import TazqWidgetBridge from '@/modules/tazq-widget-bridge/src/TazqWidgetBridgeModule';

/**
 * Telefon → Ana Ekran Widget'ı ve Apple Watch köprüsü.
 *
 * `TazqWidgetBridge` yalnız iOS'ta, native kodu derlenmiş bir build'de dolu
 * gelir — Android'de, Expo Go'da ya da native kodu henüz içermeyen ESKİ bir
 * dev client'ta `null`dur (bkz. modül dosyasındaki `requireOptionalNativeModule`
 * notu). Her çağıran bu tek fonksiyondan geçtiği için platform/derleme
 * kontrolü tek yerde kalıyor.
 */
function getBridge(): typeof TazqWidgetBridge {
  return TazqWidgetBridge;
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
