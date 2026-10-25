import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Touchable } from '@/shared/components/Touchable';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { haptic } from '@/shared/utils/haptics';
import type { AppTheme } from '@/shared/constants/Colors';
import { S, R, F, MIN_TOUCH } from '@/shared/constants/tokens';

/*
  BÖLÜMLÜ SEÇİCİ — iOS UISegmentedControl / M3 SegmentedButton'ın ortak paydası.

  Formdaki öncelik ve tekrar seçicileri, seçileni DOLU, DOYGUN bir renkle boyuyordu
  (kırmızı/turuncu/yeşil, mor). Alt çubukta öğrenilen ders burada da geçerli: dolu
  renkli hap ekranın en baskın öğesi olur ve formun asıl işi olan başlığı bastırır.
  Seçim NÖTR bir kaydırıcıyla (ray içinde bir ton açık yüzey) gösteriliyor; anlam
  rengi yalnız küçük işarette (öncelik noktası) kalıyor — Apple Hatırlatıcılar ve
  Things da böyle.

  Kaydırıcının yeri ÖLÇÜLÜR (rayın gerçek genişliği / seçenek sayısı) — tahmin yok,
  tablet ve büyük yazı boyutunda da tam oturur.
*/

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  /** Etiketin önündeki küçük işaret (öncelik noktası, tekrar ikonu). */
  leading?: (selected: boolean) => React.ReactNode;
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const PAD = S.xxs;

export function SegmentedControl<K extends string>({
  options, value, onChange, theme, isDark, accessibilityLabel,
}: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  theme: AppTheme;
  isDark: boolean;
  accessibilityLabel: string;
}) {
  const reduceMotion = useReduceMotion();
  const [innerW, setInnerW] = useState(0);
  const segW = innerW > 0 ? innerW / Math.max(options.length, 1) : 0;
  const index = Math.max(0, options.findIndex((o) => o.key === value));

  const x = useSharedValue(-1);
  useEffect(() => {
    if (segW <= 0) return;
    const target = index * segW;
    x.value = reduceMotion || x.value < 0 ? target : withTiming(target, { duration: 280, easing: EASE });
  }, [index, segW, reduceMotion]);
  const thumbStyle = useAnimatedStyle(() => ({
    opacity: x.value < 0 ? 0 : 1,
    transform: [{ translateX: Math.max(0, x.value) }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: theme.surfaceField }]}
    >
      <View style={styles.row} onLayout={(e) => setInnerW(e.nativeEvent.layout.width)}>
        {segW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                width: segW,
                backgroundColor: isDark ? theme.surfaceCard : '#FFFFFF',
                boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 3px rgba(15,23,42,0.12), 0 1px 1px rgba(15,23,42,0.04)',
              },
              thumbStyle,
            ]}
          />
        )}
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Touchable
              key={o.key}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected, checked: selected }}
              activeOpacity={0.7}
              onPress={() => { if (!selected) { haptic.select(); onChange(o.key); } }}
              style={styles.segment}
            >
              {o.leading?.(selected)}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[styles.label, { color: selected ? theme.onSurface : theme.onSurfaceVariant, fontWeight: selected ? '600' : '500' }]}
              >
                {o.label}
              </Text>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: R.md, padding: PAD },
  row: { flexDirection: 'row' },
  thumb: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: R.md - PAD },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH - PAD * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.xs,
    paddingHorizontal: S.xs,
  },
  label: { fontSize: F.footnote, letterSpacing: 0 },
});
