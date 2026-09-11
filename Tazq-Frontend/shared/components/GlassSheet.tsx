import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { MotiView } from 'moti';
import { AppBlur } from '@/shared/components/AppBlur';
import { R, S, concentric } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * CAM SAYFA — modal ve alt sayfaların ortak yüzeyi.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Sekme ve başlık çubuğu cam malzemeye geçtikten sonra ölçüldü: 15 dosya kendi OPAK
 * modal zeminini çiziyordu. Kullanıcı çubukları cam, açtığı formu opak görüyordu —
 * aynı ekranda iki malzeme dili. iOS 26/27'de sayfalar cam.
 *
 * Her modalın kendi zeminini çizmesi ayrıca aynı hatayı 15 kez yapma riski demekti;
 * yüzey artık tek yerde.
 *
 * ── OPAKLIK TAHMİN DEĞİL, KONTRAST GEREĞİ ─────────────────────────────────────
 * Saf cam üstünde metin okunmaz: arkadaki içerik kaydıkça kontrast oynar ve bir anda
 * AA'nın altına düşer. Apple'ın kendi sayfaları da saf cam değildir — camın üstünde
 * bir TON katmanı vardır ve içerik onun üstünde durur.
 *
 * Buradaki değerler o ton katmanı. Tek yerde duruyorlar ki her modalda yeniden
 * uydurulmasın (bkz. AppBlur'ün "17 çağrıda 12 farklı sayı" notu — aynı hata).
 * Koyu temada daha yüksek: koyu zeminde açık metnin altındaki yüzey daha çok
 * kapatmazsa arkadaki parlak içerik metnin içinden geçer.
 */
const VEIL_OPACITY = { light: 0.82, dark: 0.78 };

export type GlassSheetProps = {
  children: React.ReactNode;
  /** Ortalanmış kart için üst sınır. Alt sayfalarda tam genişlik istenirse geç. */
  maxWidth?: number;
  /** Kabuğun kendi dolgusu. Eşmerkezli iç yarıçap bundan türer. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * İçerideki kartların DOĞRU yarıçapı — eşmerkezli.
 *
 * Kabuk `R.sheet` (28) ve içerik kenardan `padding` kadar içeride. İç kartın
 * yarıçapı `28 − padding` olmalı; aksi hâlde iki eğri paralel kalmaz ve aradaki
 * boşluk köşelerde incelir. Çağıran bunu elle hesaplamasın diye dışa veriliyor.
 */
export const sheetInnerRadius = (padding: number = S.lg) => concentric(R.sheet, padding);

export function GlassSheet({ children, maxWidth = 420, padding = S.lg, style }: GlassSheetProps) {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.96, translateY: 16 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18 }}
      style={[
        styles.sheet,
        { maxWidth, padding, borderRadius: R.sheet },
        style,
      ]}
    >
      {/* Yarıçap MALZEMEYE de veriliyor: `overflow:hidden` cam/blur katmanını
          güvenilir kırpmıyor (bkz. AppBlur radius notu). */}
      <AppBlur material="thick" radius={R.sheet} />
      {/*
        TON KATMANI — camla içerik arasında. Metnin okunabilirliği buradan geliyor;
        camın kendisi tek başına kontrast garanti etmez.
      */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
            opacity: VEIL_OPACITY[isDark ? 'dark' : 'light'],
            borderRadius: R.sheet,
          },
        ]}
      />
      {children}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    gap: S.md,
    // Cam ve ton katmanları mutlak konumlu; kabuk onları kendi şekline kırpar.
    // (Kırpma tek başına yetmiyor, yarıçap malzemeye de veriliyor — yukarıya bkz.)
    overflow: 'hidden',
    // Android'de cam yok; yüzeyin zeminden ayrıldığı yükseltiyle söylenir.
    ...(Platform.OS === 'android' ? { elevation: 3 } : null),
  },
});
