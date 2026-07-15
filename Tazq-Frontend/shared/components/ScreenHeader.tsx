import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { R, B, S, TOP_BAR_HEIGHT, TOP_BAR_LIFT, sideInset } from '@/shared/constants/tokens';
import { Colors } from '@/shared/constants/Colors';

/**
 * Yüzen sayfa başlığı — dashboard, aksiyon merkezi, haftalık merkez ve dönemsel modlar.
 *
 * NEDEN ORTAK BİLEŞEN: bu başlık dört dosyada AYRI AYRI tanımlanmıştı. Kopyalar zamanla
 * ayrıştı ve boyları farklılaştı, çünkü yükseklik içerikten doğuyordu (`paddingVertical`
 * + en uzun çocuk):
 *     index → StatusHub (38) → 54pt
 *     tasks / cockpit / modlar → ikon (24) → ~40pt
 * Aynı görünmesi gereken dört başlık 14pt farkla çiziliyordu. Tek bir yerde durunca
 * ayrışma imkânsızlaşıyor — kural değil, yapı zorluyor.
 *
 * SABİT YÜKSEKLİK: iOS nav bar'ları da sabittir (44pt). İçeriğe göre uzayan bar, ona
 * bir öğe eklendiğinde sayfaların üst boşluk hesabını sessizce bozar (bkz. topBarSpace).
 *
 * SİMETRİ: yan yuvalar EŞİT genişlikte (SIDE_SLOT). Böylece ortadaki öğe, iki yandaki
 * içerik farklı genişlikte olsa bile gerçekten ortada durur. Eşit yuva olmadan "orta"
 * yandaki butonun genişliğine göre kayar.
 */

/** Yan yuva genişliği — iki yan EŞİT olmalı, yoksa orta öğe kayar. */
export const SIDE_SLOT = 90;

/** Apple HIG dokunma hedefi alt sınırı. Görsel öğe küçük olabilir, HEDEF olamaz. */
export const MIN_TOUCH = 44;

export interface ScreenHeaderProps {
  /** Sol yuva (geri, avatar…). */
  left?: React.ReactNode;
  /** Orta yuva — yanlardan bağımsız olarak ortalanır. */
  center?: React.ReactNode;
  /** Sağ yuva (aksiyon, filtre…). */
  right?: React.ReactNode;
}

export const ScreenHeader = ({ left, center, right }: ScreenHeaderProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={[
        styles.bar,
        {
          top: insets.top + TOP_BAR_LIFT,
          // Geniş/foldable ekranda içerikle aynı sütuna hizalanır (bkz. sideInset).
          left: sideInset(width),
          right: sideInset(width),
          // Android'de BlurView yok → opak zemin. iOS'ta blur'un altı saydam kalmalı,
          // yoksa bulanıklık görünmez.
          backgroundColor: Platform.OS === 'android'
            ? (isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)')
            : 'transparent',
          borderColor: theme.outline,
          elevation: Platform.OS === 'android' ? 4 : 0,
        },
        Platform.OS !== 'android' && (isDark ? styles.darkShadow : styles.lightShadow),
      ]}
    >
      {Platform.OS !== 'android' && (
        <BlurView intensity={isDark ? 50 : 30} tint={colorScheme} style={StyleSheet.absoluteFill} />
      )}

      <View style={styles.content}>
        {/*
          Orta yuva ÖNCE çiziliyor — sırası bilinçli. RN'de sonraki kardeş üstte kalır;
          orta öğe iki yanın arasına yazılsaydı sol buton onun ALTINDA, sağ buton
          ÜSTÜNDE kalırdı: aynı başlıkta iki farklı davranış.
          Mutlak konumlu, çünkü akışta yer kapsaydı yanların içeriği büyüdükçe "orta"
          kayardı. box-none: kutu dokunmayı yutmaz, yalnızca içindeki gerçek buton alır.
        */}
        <View style={styles.center} pointerEvents="box-none">
          {center}
        </View>

        <View style={styles.side}>{left}</View>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    zIndex: 100,
    borderRadius: R.full,
    borderWidth: B.thin,
    overflow: 'hidden',
  },
  // StyleSheet tema hook'una erişemez → Colors'tan doğrudan okunur.
  lightShadow: {
    shadowColor: Colors.light.onSurface,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  darkShadow: {
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // SABİT — içerikten doğmuyor. Bkz. yukarıdaki not.
    height: TOP_BAR_HEIGHT,
    paddingHorizontal: S.md,
  },
  side: {
    width: SIDE_SLOT,
    // Yuva barın tam boyu: içindeki buton dikeyde ortalanır ve dokunma hedefi
    // görsel öğe kadar değil, yuva kadar yüksek olur.
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: S.xs,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  center: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
