import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { AppBlur } from '@/shared/components/AppBlur';
import { HAIRLINE, TOP_ITEM_SIZE } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * ÜST BAR DÜĞMESİNİN KABUĞU — iOS 26/27'de araç çubuğu düğmeleri cam bir halkanın
 * içinde durur, çıplak bir glif olarak değil.
 *
 * ── NEDEN ─────────────────────────────────────────────────────────────────────
 * Başlık ve sekme çubuğu cam malzemeye geçtikten sonra üst bardaki düğmeler geride
 * kaldı: zeminsiz iki ikon (geri, sırala, ara) doğrudan içeriğin üstünde duruyordu.
 * Ana sayfadaki durum düğmesinin zaten bir kabuğu vardı — yani aynı çubuktaki
 * düğmeler iki farklı dil konuşuyordu.
 *
 * ── ÖLÇÜ: DOKUNMA HEDEFİ DEĞİL, GÖRSEL BANT ───────────────────────────────────
 * Kabuk ilk halinde dokunma hedefini (40–44pt) tamamen dolduruyordu ve 44pt'lik
 * çubukta kenarlara dayanıp TAŞIYOR görünüyordu. Görsel boyut ile erişilebilir alan
 * aynı şey değil: hedef 44pt kalır, kabuk `TOP_ITEM_SIZE` (32pt) çizilir — avatarla
 * ve durum düğmesiyle AYNI ölçü. 44pt'lik çubukta 6pt nefes kalır ve üç öğe tek bir
 * banda hizalanır.
 *
 * Kabuk, hedefin ortasına yerleşir; hedef 40pt de olsa 44pt de olsa görünen daire
 * aynı boyda kalır — çubuktaki düğmeler ekrandan ekrana ayrışamaz.
 *
 * ── ANDROID: KABUK YOK ────────────────────────────────────────────────────────
 * Material'ın araç çubuğu düğmeleri çıplak gliftir; kabuk eklemek Android'de yabancı
 * durur. Bu yüzden burada `null` dönülüyor — Android GÖRSEL OLARAK HİÇ değişmiyor,
 * düzen de değişmiyor (kabuk mutlak konumlu, yer kaplamıyor).
 *
 * KULLANIM: mevcut dokunma hedefinin İLK çocuğu olarak konur:
 *   <Touchable style={styles.headerIconBtn}>
 *     <ChromeShell />
 *     <Icon ... />
 *   </Touchable>
 */
export function ChromeShell({ size = TOP_ITEM_SIZE, material = 'thin' as const }: { size?: number; material?: 'thin' | 'regular' }) {
  const { theme } = useAppTheme();
  if (Platform.OS !== 'ios') return null;

  const radius = size / 2;

  return (
    // Hedefin TAMAMINI kaplayan saydam bir kap; daire onun ortasında. Böylece kabuk
    // dokunma hedefinin boyutundan bağımsız olarak hep aynı ölçüde çizilir.
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <View style={{ width: size, height: size, borderRadius: radius }}>
        {/* Yarıçap malzemeye de veriliyor: kabın kırpması cam/blur katmanında güvenilir değil. */}
        <AppBlur material={material} radius={radius} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, borderWidth: HAIRLINE, borderColor: theme.outlineVariant },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
