import React from 'react';
import { F, S, ICON, R, B, NAV_BAR_HEIGHT, NAV_BAR_LIFT, NAV_BAR_MIN_INSET, NAV_BAR_MINIMIZED_HEIGHT } from '@/shared/constants/tokens';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import { Zap } from 'lucide-react-native';
import { useFocusStore } from '../store/useFocusStore';
import { useChromeStore } from '@/shared/store/useChromeStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';
import { AppBlur } from '@/shared/components/AppBlur';
import { haptic } from '@/shared/utils/haptics';

export const FocusIsland = () => {
  const isActive = useFocusStore(s => s.isActive);
  const seconds = useFocusStore(s => s.seconds);
  const currentTask = useFocusStore(s => s.currentTask);
  const { theme, colorScheme } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const minimized = useChromeStore(s => s.minimized) && Platform.OS === 'ios';

  const isOnFocusScreen = pathname === '/focus';
  const isOnDashboard = pathname === '/' || pathname === '/index';

  // Dashboard has its own focus indicator (StatusHub); skip here to avoid covering the logo
  if (!isActive || isOnFocusScreen || isOnDashboard) return null;

  /*
    ── HAP EKRANIN ÜSTÜNDEN SEKME ÇUBUĞUNUN ÜSTÜNE TAŞINDI ──────────────────────

    Eskiden `top: insets.top + 8` ile Dynamic Island tarafında duruyordu. Orası
    yanlış yuvaydı: sürüyor olan bir odak seansı bir BİLDİRİM değil, arka planda
    devam eden bir iş. Apple bu iş için ayrı bir yer tanımlıyor — sekme çubuğunun
    hemen üstündeki "aksesuar görünümü", yani Müzik'teki çalan-parça şeridi.
    Odak seansı da tıpkı çalan bir şarkı gibi: devam ediyor, her an dokunulabilir,
    ama ekranın konusu değil.

    Üstelik eski konum başlık çubuğuyla aynı bölgeyi paylaşıyordu ve orada zaten
    avatar, marka işareti ve durum rozeti var.

    KONUM İKİ DURUMA GÖRE: sekme çubuğu olan ekranlarda çubuğun üstünde, olmayanlarda
    güvenli alanın hemen üstünde. Çubuk küçüldüğünde hap da onunla birlikte iniyor —
    Apple'ın aksesuar davranışı da bu.
  */
  const hasNavBar = pathname === '/tasks' || pathname === '/cockpit' || pathname === '/modlar';
  const barHeight = (minimized ? NAV_BAR_MINIMIZED_HEIGHT : NAV_BAR_HEIGHT);
  const bottomOffset = hasNavBar
    ? Math.max(insets.bottom, NAV_BAR_MIN_INSET) + NAV_BAR_LIFT + barHeight + S.sm
    : insets.bottom + S.sm;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <MotiView
      pointerEvents="box-none"
      // Çubuk küçülüp büyüdükçe hap da onunla birlikte iner/çıkar. Süre sekme
      // çubuğununkiyle AYNI (220ms) — ikisi tek hareket gibi okunmalı.
      animate={{ bottom: bottomOffset }}
      transition={{ type: 'timing', duration: 220 }}
      style={styles.wrapper}
    >
      <MotiView
        // Aşağıdan doğar: hap artık sekme çubuğunun üstünden çıkıyor, tepeden inmiyor.
        from={{ translateY: 24, opacity: 0, scale: 0.9 }}
        animate={{ translateY: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        style={[
          styles.pill,
          {
            // iOS'ta zemin CAM (aşağıda); Android'de bu turdan önceki opak yüzey.
            backgroundColor: Platform.OS === 'ios' ? 'transparent' : (isDark ? theme.surfaceContainerHighest : '#fff'),
            borderColor: theme.primary + '40',
            shadowColor: theme.primary,
          },
        ]}
      >
        {/*
          RENKLİ CAM — süren bir seans, duran bir yüzeyle aynı renkte olmamalı.
          Apple'ın çalan-parça şeridi de böyle tonlanır: malzeme aynı, rengi durumdan
          geliyor. Ton yalnız iOS'ta; Android opak yüzeyini koruyor.
        */}
        {Platform.OS === 'ios' && (
          <AppBlur material="chrome" radius={R.full} glassTint={theme.primary} />
        )}
        <MotiView
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ loop: true, duration: 1800 }}
          style={[styles.dot, { backgroundColor: '#34c759' }]}
        />
        <Touchable
          onPress={() => {
            router.push('/focus');
          }}
          style={styles.inner}
          activeOpacity={0.8}
        >
          <Zap size={ICON.xs} color={theme.primary} fill={theme.primary} />
          <Text style={[styles.task, { color: theme.onSurface }]} numberOfLines={1}>
            {currentTask || 'Focus'}
          </Text>
          <Text style={[styles.time, { color: theme.primary }]}>
            {formatTime(seconds)}
          </Text>
        </Touchable>
      </MotiView>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    // `bottom` çalışma anında veriliyor: sekme çubuğu var mı, küçülmüş mü —
    // ikisi de ekrana göre değişiyor (bkz. bileşendeki konum notu).
    alignItems: 'center',
    zIndex: 9999,
  } as any,
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.full,
    borderWidth: B.medium,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    gap: S.sm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: R.full,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    maxWidth: 220,
  },
  task: {
    fontSize: F.footnote,
    fontWeight: '700',
    flexShrink: 1,
  },
  time: {
    fontSize: F.body,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
