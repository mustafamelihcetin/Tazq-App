import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { AppBlur } from '@/shared/components/AppBlur';
import { R, HAIRLINE } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * ÜST BAR DÜĞMESİNİN KABUĞU — iOS 26/27'de araç çubuğu düğmeleri cam bir halkanın
 * içinde durur, çıplak bir glif olarak değil.
 *
 * ── NEDEN ─────────────────────────────────────────────────────────────────────
 * Başlık çubuğu ve sekme çubuğu cam malzemeye geçtikten sonra üst bardaki düğmeler
 * geride kaldı: zeminsiz iki ikon (geri, sırala, ara) doğrudan içeriğin üstünde
 * duruyordu. Sayfa kaydıkça altlarından geçen içerik onlarla aynı düzlemdeymiş gibi
 * okunuyor ve dokunulabilir olduklarını söyleyen hiçbir işaret kalmıyordu. Ana
 * sayfadaki durum düğmesinin zaten bir kabuğu vardı — yani aynı çubuktaki düğmeler
 * iki farklı dil konuşuyordu.
 *
 * ── ANDROID: KABUK YOK ────────────────────────────────────────────────────────
 * Material'ın araç çubuğu düğmeleri çıplak gliftir; kabuk eklemek Android'de yabancı
 * durur. Bu yüzden burada `null` dönülüyor — Android bu turda GÖRSEL OLARAK HİÇ
 * değişmiyor, düzen de değişmiyor (kabuk mutlak konumlu, yer kaplamıyor).
 *
 * KULLANIM: mevcut dokunma hedefinin İLK çocuğu olarak konur, hiçbir düzeni bozmaz:
 *   <Touchable style={styles.headerIconBtn}>
 *     <ChromeShell />
 *     <Icon ... />
 *   </Touchable>
 */
export function ChromeShell({ radius = R.full, material = 'thin' as const }: { radius?: number; material?: 'thin' | 'regular' }) {
  const { theme } = useAppTheme();
  if (Platform.OS !== 'ios') return null;

  return (
    <>
      {/* Yarıçap malzemeye de veriliyor: kabın kırpması cam/blur katmanında güvenilir değil. */}
      <AppBlur material={material} radius={radius} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: HAIRLINE, borderColor: theme.outlineVariant }]}
      />
    </>
  );
}
