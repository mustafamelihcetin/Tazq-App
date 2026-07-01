/**
 * CollapsingHeaderScreen — Apple HIG "büyük başlık + buzlu cam çöküşü" deseni.
 * Tepede şeffaf header + büyük başlık; kaydırınca büyük başlık söner, üst bara
 * kompakt başlık yerleşir ve buzlu cam belirginleşir.
 * iOS: gerçek BlurView (frost). Android: opak yüksek-blur fallback (BlurView Android'de zayıf).
 * RN Animated + useNativeDriver → 60fps, JS thread bloklanmaz. Her iki platformda aynı.
 */
import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { ArrowLeft } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, TRACKING } from '@/shared/constants/tokens';

const HEADER_H = 52;

interface Props {
  title: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  backLabel?: string;
}

export function CollapsingHeaderScreen({ title, onBack, rightSlot, children, backLabel }: Props) {
  const { theme, isDark } = useAppTheme();
  const scrollY = useRef(new Animated.Value(0)).current;

  const frostOpacity = scrollY.interpolate({ inputRange: [0, 40], outputRange: [0, 1], extrapolate: 'clamp' });
  const compactOpacity = scrollY.interpolate({ inputRange: [44, 72], outputRange: [0, 1], extrapolate: 'clamp' });
  const compactTranslate = scrollY.interpolate({ inputRange: [44, 72], outputRange: [8, 0], extrapolate: 'clamp' });
  const largeOpacity = scrollY.interpolate({ inputRange: [0, 52], outputRange: [1, 0], extrapolate: 'clamp' });
  const largeScale = scrollY.interpolate({ inputRange: [0, 52], outputRange: [1, 0.94], extrapolate: 'clamp' });
  const largeTranslate = scrollY.interpolate({ inputRange: [0, 52], outputRange: [0, -6], extrapolate: 'clamp' });
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.headerAbs, { height: HEADER_H }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: frostOpacity }]}>
          {Platform.OS === 'ios'
            ? <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(18,18,22,0.94)' : 'rgba(255,255,255,0.96)' }]} />}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: theme.outlineVariant }} />
        </Animated.View>
        <View style={styles.headerRow}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={backLabel ?? 'Back'}>
              <ArrowLeft size={24} color={theme.onSurface} />
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
          <Animated.Text numberOfLines={1} style={[styles.compactTitle, { color: theme.onSurface, opacity: compactOpacity, transform: [{ translateY: compactTranslate }] }]}>{title}</Animated.Text>
          <View style={{ width: 40, alignItems: 'flex-end' }}>{rightSlot}</View>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: HEADER_H + S.xs, paddingBottom: 120, gap: S.lg }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        <Animated.View style={{ opacity: largeOpacity, transform: [{ scale: largeScale }, { translateY: largeTranslate }] }}>
          <Text style={[styles.largeTitle, { color: theme.onSurface }]}>{title}</Text>
        </Animated.View>
        {children}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerAbs: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md },
  compactTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', letterSpacing: TRACKING.subhead },
  largeTitle: { fontSize: 30, fontWeight: '800', letterSpacing: TRACKING.hero, includeFontPadding: false },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
