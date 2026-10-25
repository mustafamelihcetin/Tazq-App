import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import type { AppTheme } from '@/shared/constants/Colors';
import { S, R, HAIRLINE, NAV_BAR_HEIGHT, NAV_ICON_SIZE, NAV_LABEL_SIZE, NAV_CAPSULE_PAD } from '@/shared/constants/tokens';

/*
  ── ANDROID SEKME KAPSÜLÜ — iOS çubuğunun kardeşi (2026-10-25) ────────────────────
  Kullanıcı kararı: "iOS'takinin kardeşi". Denenip REDDEDİLENLER (kayıt için):
    · tam genişlik, dibe yapışık opak çubuk — "demode"
    · ters renkli (siyah/beyaz) dolu hap — "siyah beyaz gibi, daha kötü"
    · marka mavisi dolu hap — "mavi de çok çirkin, odak bozuyor"
  Ortak ders: dolu, renkli bir hap çubuğu ekranın en baskın öğesi yapıyor. Alt çubuk
  SAKİN olmalı.

  iOS 26 sekme çubuğunun dili (kullanıcının beğendiği): geniş yüzen kapsül, her sekmede
  ikon + altında ad; aktif sekmede ikon ve ad TINT rengi, arkasında çok hafif NÖTR bir
  seçim vurgusu (lozenge) — sekmeler arasında yumuşakça kayar. Android'de cam yok (bkz.
  AppBlur): opak yüzey + yumuşak katmanlı `boxShadow` + saç teli kenar.
  Vurgunun yeri ÖLÇÜLÜR (kapsülün gerçek genişliği / sekme sayısı) — tahmin yok.
*/

export interface NavCapsuleTab {
  id: string;
  Icon: LucideIcon;
  label: string;
  a11yLabel: string;
  isActive: boolean;
  onPress: () => void;
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
/** Vurgunun sekme kutusundan içeri payı — kapsülle eşmerkezli kalsın diye NAV_CAPSULE_PAD. */
const LOZENGE_INSET = NAV_CAPSULE_PAD;

export function AndroidNavCapsule({ tabs, theme, isDark, showLabels }: { tabs: NavCapsuleTab[]; theme: AppTheme; isDark: boolean; showLabels: boolean }) {
  const reduceMotion = useReduceMotion();
  const [innerW, setInnerW] = useState(0);
  const tabW = innerW > 0 ? innerW / Math.max(tabs.length, 1) : 0;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.isActive));

  const x = useSharedValue(-1);
  useEffect(() => {
    if (tabW <= 0) return;
    const target = activeIndex * tabW;
    // İlk yerleşim ve "hareketi azalt" → kaymadan yerine.
    x.value = reduceMotion || x.value < 0 ? target : withTiming(target, { duration: 360, easing: EASE });
  }, [activeIndex, tabW, reduceMotion]);
  const lozengeStyle = useAnimatedStyle(() => ({
    opacity: x.value < 0 ? 0 : 1,
    transform: [{ translateX: Math.max(0, x.value) }],
  }));

  return (
    <View
      style={[
        styles.capsule,
        {
          backgroundColor: theme.surfaceCard,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
          /*
            YUMUŞAK, KATMANLI GÖLGE — `boxShadow` (RN 0.76+ Yeni Mimari, Android'de de).
            `elevation` altta kirli koyu bir şerit bırakıyordu (cihazda görüldü).
          */
          boxShadow: isDark
            ? '0 12px 32px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.4)'
            : '0 12px 32px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.06)',
        },
      ]}
      accessibilityRole="tablist"
    >
      <View style={styles.row} onLayout={(e) => setInnerW(e.nativeEvent.layout.width)}>
        {/* Seçim vurgusu — NÖTR (iOS 26 lozenge), renk yalnız ikon ve adda. */}
        {tabW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lozenge,
              { width: tabW - LOZENGE_INSET * 2, left: LOZENGE_INSET, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.06)' },
              lozengeStyle,
            ]}
          />
        )}
        {tabs.map((tab) => {
          const { Icon } = tab;
          const color = tab.isActive ? theme.primary : theme.onSurfaceVariant;
          return (
            <Touchable
              key={tab.id}
              onPress={tab.onPress}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={tab.a11yLabel}
              accessibilityState={{ selected: tab.isActive }}
              style={styles.tab}
            >
              <Icon size={NAV_ICON_SIZE} color={color} strokeWidth={tab.isActive ? 2.2 : 1.9} />
              {showLabels && (
                <Text
                  numberOfLines={1}
                  // Ad ekran okuyucuya a11yLabel ile TAM verilir; kısa metin ikinci kez okunmasın.
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={[styles.label, { color }]}
                >
                  {tab.label}
                </Text>
              )}
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flex: 1,
    height: NAV_BAR_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: NAV_CAPSULE_PAD,
    borderRadius: R.full,
    borderWidth: HAIRLINE,
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'stretch', paddingVertical: NAV_CAPSULE_PAD },
  lozenge: { position: 'absolute', top: NAV_CAPSULE_PAD, bottom: NAV_CAPSULE_PAD, borderRadius: R.full },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.xxs },
  label: { fontSize: NAV_LABEL_SIZE - 1, fontWeight: '600', letterSpacing: 0 },
});
