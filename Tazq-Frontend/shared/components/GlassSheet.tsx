import React from 'react';
import { StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { MotiView } from 'moti';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { R, S, concentric } from '@/shared/constants/tokens';

/**
 * CAM SAYFA — ortalanmış modal kartının eksiksiz kabuğu.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Sekme ve başlık çubuğu cam malzemeye geçtikten sonra ölçüldü: 15 dosya kendi OPAK
 * modal zeminini çiziyordu. Kullanıcı çubukları cam, açtığı formu opak görüyordu —
 * aynı ekranda iki malzeme dili. iOS 26/27'de sayfalar cam.
 *
 * Zemin (cam + ton katmanı + Android'de opak yüzey) `GlassSurface`te; bu bileşen
 * onun üstüne ortalanmış kartın giriş animasyonunu, genişliğini ve dolgusunu ekliyor.
 * Kendi animasyonu olan yüzeyler (alttan kayan sayfalar, uyarı, menü) doğrudan
 * `GlassSurface` kullanır.
 */

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
 * boşluk köşelerde incelir.
 *
 * ALT SINIR `R.md`: dolgu büyükse (24) formül 4 verir ve içerik kartı neredeyse
 * köşeli olur. Eşmerkezlilik kenara YAKIN iç içe şekiller içindir; kenardan uzak bir
 * kart kendi doğal yarıçapını korur. Apple'ın `ConcentricRectangle`ı da tam böyle
 * çalışıyor: dış − boşluk, ama bir minimumdan küçük değil.
 */
export const sheetInnerRadius = (padding: number = S.lg) => concentric(R.sheet, padding, R.md);

export function GlassSheet({ children, maxWidth = 420, padding = S.lg, style }: GlassSheetProps) {
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
      <GlassSurface radius={R.sheet} />
      {children}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    gap: S.md,
    // Cam ve ton katmanları mutlak konumlu; kabuk içeriği kendi şekline kırpar.
    // (Kırpma tek başına yetmiyor, yarıçap malzemeye de veriliyor — GlassSurface'e bkz.)
    overflow: 'hidden',
    // Android'de cam yok; yüzeyin zeminden ayrıldığı yükseltiyle söylenir.
    ...(Platform.OS === 'android' ? { elevation: 3 } : null),
  },
});
