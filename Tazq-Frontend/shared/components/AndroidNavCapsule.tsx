import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
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

  2026-10-25 ikinci tur (kullanıcı: "hâlâ çok demode, Ana Sayfa yazısı seçiliyken sığmıyor"):
  ikon + adı birlikte saran yuvarlak vurgu, 5 sekmede ~52 dp'ye düşüyor ve "Ana Sayfa"
  kenarlarına değiyordu. M3 gezinme çubuğunun dili: vurgu YALNIZ ikonun arkasında
  (56×32 hap, tonal — dolu mavi değil), ad altta, tint renginde ve kalın. Ad artık hiçbir
  kutuya sığmak zorunda değil; sekmeler arasında kayma korunuyor.
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
/** İkon hapı — M3 aktif gösterge ölçüsü (64×32), dar sekmede sekmeye sığacak kadar daralır. */
const PILL_W = 56;
const PILL_H = 32;

export function AndroidNavCapsule({ tabs, theme, isDark, showLabels }: { tabs: NavCapsuleTab[]; theme: AppTheme; isDark: boolean; showLabels: boolean }) {
  const reduceMotion = useReduceMotion();
  const [innerW, setInnerW] = useState(0);
  const tabW = innerW > 0 ? innerW / Math.max(tabs.length, 1) : 0;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.isActive));

  /*
    RN `Animated`, Reanimated DEĞİL (2026-10-25, cihazda görüldü): sayfa kaydırılınca çubuk
    yeniden çiziliyor ve Reanimated 4'ün animasyonlu stili Android'de (Yeni Mimari) İLK
    değerine dönüyordu — vurgunun ilk opaklığı 0 olduğu için seçili sekme vurgusuz kalıyordu
    (TodayRings yaylarındaki aynı sınıf hata, bkz. useTween). `Animated.Value` değerini
    yeniden çizimler arasında korur; görünürlük de animasyona değil ölçüme bağlı.
  */
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (tabW <= 0) return;
    const target = activeIndex * tabW;
    // İlk yerleşim ve "hareketi azalt" → kaymadan yerine.
    if (reduceMotion || !placed.current) { x.setValue(target); placed.current = true; return; }
    Animated.timing(x, { toValue: target, duration: 360, easing: EASE, useNativeDriver: true }).start();
  }, [activeIndex, tabW, reduceMotion]);
  const pillW = Math.min(PILL_W, tabW - S.xs);
  const pillStyle = { transform: [{ translateX: Animated.add(x, (tabW - pillW) / 2) }] };
  // Hapın dikey yeri: ikon kutusunun sekme içindeki ölçülen y'si (ad gizliyken de doğru);
  // mutlak konum satırın iç boşluğunu saymaz → NAV_CAPSULE_PAD eklenir.
  const [pillTop, setPillTop] = useState<number | null>(null);

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
        {/* Seçim vurgusu — yalnız ikonun arkasında, TONAL (dolu mavi reddedildi); renk ikon ve adda. */}
        {tabW > 0 && pillTop != null && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              { top: NAV_CAPSULE_PAD + pillTop, width: pillW, backgroundColor: theme.primary + (isDark ? '2E' : '1A') },
              pillStyle,
            ]}
          />
        )}
        {tabs.map((tab, i) => {
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
              <View
                style={styles.iconBox}
                onLayout={i === 0 ? (e) => setPillTop(e.nativeEvent.layout.y) : undefined}
              >
                <Icon size={NAV_ICON_SIZE} color={color} strokeWidth={tab.isActive ? 2.2 : 1.9} />
              </View>
              {showLabels && (
                <Text
                  numberOfLines={1}
                  // Ad ekran okuyucuya a11yLabel ile TAM verilir; kısa metin ikinci kez okunmasın.
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={[styles.label, { color, fontWeight: tab.isActive ? '700' : '500' }]}
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
  pill: { position: 'absolute', left: 0, height: PILL_H, borderRadius: R.full },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.xxs },
  iconBox: { height: PILL_H, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: NAV_LABEL_SIZE - 1, letterSpacing: 0 },
});
