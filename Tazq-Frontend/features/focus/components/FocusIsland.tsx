import React from 'react';
import { Platform } from 'react-native';
import { MotiView } from 'moti';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { S, FAB_SIZE, NAV_BAR_HEIGHT, NAV_BAR_LIFT, NAV_BAR_MIN_INSET, NAV_BAR_MINIMIZED_HEIGHT } from '@/shared/constants/tokens';
import { useChromeStore } from '@/shared/store/useChromeStore';
import { useFocusStore } from '../store/useFocusStore';
import { LiveFocusPill } from './LiveFocusPill';

/*
  SÜREN SEANSIN TEK GÖSTERGESİ — tüm uygulamada (2026-11-01, kullanıcı: "odak seansı varken ayarlara girdim,
  bugün sayfasından farklı, Focus yazılı, şeffaf, uyumsuz ve çirkin bir popup geldi").
  Eskiden iki ayrı tasarım vardı: Bugün'de liste içi kart, diğer ekranlarda şeffaf cam hap ("Focus" İngilizce
  sabit yazıyordu). Artık HER YERDE aynı canlı kapsül (bkz. LiveFocusPill): opak, durumunu söyleyen, iki dilli.

  KONUM (Apple'ın "aksesuar görünümü" — Müzik'teki çalan-parça şeridi): sekme çubuğu olan ekranlarda çubuğun
  hemen üstünde, çubuk küçülünce onunla birlikte iner; çubuk yoksa güvenli alanın üstünde. Artı düğmesi olan
  ekranlarda (Bugün, Görevler) onunla aynı hizada, solunda. Odak ve nefes ekranlarında görünmez.
*/
export const FocusIsland = () => {
  const started = useFocusStore(s => s.isActive || (s.totalSeconds - s.seconds) > 0);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const minimized = useChromeStore(s => s.minimized) && Platform.OS === 'ios';

  if (!started || pathname === '/focus' || pathname === '/nefes') return null;

  const onDashboard = pathname === '/' || pathname === '/index';
  const hasNavBar = onDashboard || pathname === '/tasks' || pathname === '/cockpit' || pathname === '/modlar';
  const hasFab = onDashboard || pathname === '/tasks';
  // Artı düğmesi olan ekranda kapsül düğmeyle AYNI hizada kalır: düğme çubuk küçülünce inmiyor (MagneticFAB rest),
  // kapsül inseydi ikisi kayardı (2026-11-01 denetimi). Düğmesiz ekranda çubukla birlikte iner.
  const barHeight = minimized && !hasFab ? NAV_BAR_MINIMIZED_HEIGHT : NAV_BAR_HEIGHT;
  const bottomOffset = hasNavBar
    ? Math.max(insets.bottom, NAV_BAR_MIN_INSET) + NAV_BAR_LIFT + barHeight + (hasFab ? S.lg : S.sm)
    : insets.bottom + S.sm;

  return (
    <MotiView
      pointerEvents="box-none"
      // Çubuk küçülüp büyüdükçe kapsül de onunla birlikte iner/çıkar — süre sekme çubuğuyla AYNI (220ms).
      animate={{ bottom: bottomOffset }}
      transition={{ type: 'timing', duration: 220 }}
      style={{ position: 'absolute', left: S.lg, right: hasFab ? S.lg + FAB_SIZE + S.md : S.lg, zIndex: 9999 }}
    >
      <LiveFocusPill />
    </MotiView>
  );
};
