import React from 'react';
import { View } from 'react-native';
import { HAIRLINE, S } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * Liste/bölüm ayırıcısı — iOS'un ince, kesin çizgisi.
 *
 * NEDEN BİLEŞEN: uygulamada 31 ayırıcı vardı ve İKİ farklı sözdizimiyle yazılmışlardı:
 *     borderBottomWidth: 1, borderBottomColor: ...   (13 tane)
 *     <View style={{ height: 1, backgroundColor: ... }} />   (18 tane)
 * Aynı işi yapan iki yazım olunca tarama biriyle diğerini kaçırıyor — nitekim ilk
 * geçişimde 13'ünü düzeltip 18'ini görmedim. Kural yazmak yerine tek bir bileşene
 * indirgemek, kaçağı yapısal olarak imkânsız kılar.
 *
 * KALINLIK: HAIRLINE — tam 1 fiziksel piksel. `1` yazmak iOS'ta YANLIŞ: @3x bir ekranda
 * 1pt = 3 piksel, yani Apple'ın çizgisinin ÜÇ KATI. Gözün "bu iOS değil" dediği o kalın,
 * ağır çizgi buradan geliyordu.
 *
 * RENK: theme.separator (Apple systemSeparator). outline'dan 3.6× belirgin — çünkü ince
 * çizgi belirgin renk ister. İnce+belirgin iOS'un kesin çizgisi; kalın+soluk web'in
 * bulanık çizgisi. İkisi birlikte çalışır, birini alıp diğerini bırakmak dengeyi bozar.
 */

export interface SeparatorProps {
  theme: AppTheme;
  /**
   * Soldan girinti — iOS'ta ayırıcı satırın kenarından değil, METNİN başladığı yerden
   * başlar (ikonun altı boş kalır). Gruplanmış liste hissini veren asıl detay budur;
   * tam genişlik çizgi web/Android deseni.
   *
   * Satırın solunda bir şey yoksa girinti VERME — girinti ikonu takip eder, süs değil.
   */
  inset?: number;
  /** Ayırıcının üstünde/altında boşluk gerektiğinde (bölümler arası). */
  spacing?: number;
}

export const Separator = React.memo<SeparatorProps>(({ theme, inset = 0, spacing = 0 }) => (
  <View
    // Ekran okuyucu için görünmez: bir çizgi bilgi taşımaz, ritim taşır. VoiceOver'ın
    // "grup" diye duyurması gezinmeyi yavaşlatır.
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{
      height: HAIRLINE,
      backgroundColor: theme.separator,
      marginLeft: inset,
      marginVertical: spacing,
    }}
  />
));

Separator.displayName = 'Separator';

/** Yaygın girinti: satır ikonu + aradaki boşluk kadar. */
export const SEPARATOR_INSET_ICON = S.md + S.smd;
