import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { F, S, W } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * Gruplanmış liste bölüm başlığı — iOS'un imzası.
 *
 * PUNTO: 13 (Apple Footnote). Uygulamada 9pt yazılıydı, alt açıklama 8.5pt — ikisi de
 * okunabilirliğin alt sınırının (~11) ALTINDA. Yani başlıklar okunmuyordu; kullanıcı
 * onları "gri bir doku" olarak görüyordu. F ölçeğinde 13 yoktu (11'den 14'e atlıyordu),
 * o yüzden herkes elle 9/10 yazmıştı — 20 kullanım.
 *
 * AĞIRLIK: semibold (600). 700 yazılıydı: 9pt'de heavy kesim, "en küçük yazı en ağır"
 * anti-deseninin merkeziydi. Punto büyüyünce ağırlığa gerek kalmıyor — hiyerarşi
 * PUNTO ve RENKTEN geliyor, Apple'ın yöntemi bu.
 *
 * RENK: onSurfaceVariant (ikincil gri). Bir ara primary (mavi) idi ve kullanıcı koyu
 * temada okunmadığını bildirdi. Doğrusu zaten gri: bir başlık ne eylem ne durum
 * bildirir, dolayısıyla tint rengin taşıyacağı anlam yok — mavi olması dekoratifti.
 * iOS'ta bölüm başlıkları HER ZAMAN secondaryLabel'dır.
 */

/**
 * YATAY GİRİNTİ KAPSAYICININ İŞİ — bileşenin değil.
 *
 * İlk hâlinde `paddingHorizontal: S.md`'yi bileşene gömmüştüm ve iki kez ısırdı:
 *   1. Dashboard'da başlık dolgulu bir Touchable'a sarılıydı → 16+16 = 32pt girinti,
 *      aynı karttaki diğer başlıktan kaymış.
 *   2. Profil'de scroll zaten S.lg girinti veriyor → başlık altındaki karttan kayacaktı.
 *
 * Ders: girinti bir LİSTE özelliğidir, başlık özelliği değil. iOS'ta da bölüm başlığının
 * girintisi listeden gelir ve hem başlığa hem satırlara AYNI uygulanır. Bileşen onu
 * varsayarsa her farklı kapsayıcıda yanlış olur.
 *
 * Dikey boşluk KALIYOR: o başlığın kendi ritmi (üstündeki bölümden ayrılması), kapsayıcının
 * değil.
 */
export interface SectionHeaderProps {
  /** Başlık — büyük harfe bileşen çevirir, çağıran değil. */
  title: string;
  /** İsteğe bağlı yardımcı satır ("Tamamlamak için bas…"). */
  hint?: string;
  /**
   * Büyük harf çeviriminin DİLİ. Varsayılan İngilizce.
   *
   * Zorunlu bir ayrım: Türkçe'de "i"nin büyüğü "İ", İngilizce'de "I". Tek bir locale
   * sabitlemek diğer dili BOZAR — nitekim 'tr-TR' sabitlemiştim ve İngilizce başlıklar
   * "MY DAİLY HABITS" çıkıyordu. Türkçe'yi düzeltirken İngilizce'yi kırmışım.
   */
  tr?: boolean;
  theme: AppTheme;
  /**
   * Yatay girinti — kapsayıcı verir.
   *
   * Kart dolgusuzsa (dashboard) satırların girintisiyle AYNI değeri geç (S.md).
   * Kapsayıcı zaten girintiliyse (profil) hiç geçme: 0.
   */
  inset?: number;
  /** Ek boşluk/hizalama gerektiğinde. */
  style?: object;
  /** Konum ölçümü — bölüme kaydırma için (settings sayfası param ile bölüme atlar). */
  onLayout?: (e: { nativeEvent: { layout: { y: number } } }) => void;
}

export const SectionHeader = React.memo<SectionHeaderProps>(({ title, hint, theme, style, tr = false, inset = 0, onLayout }) => (
  <View style={[styles.wrap, { paddingHorizontal: inset }, style]} onLayout={onLayout}>
    <Text style={[styles.title, { color: theme.onSurfaceVariant }]}>
      {/*
        Büyük harf çevirimi BURADA ve dile GÖRE. Türkçe'de "i" → "İ", İngilizce'de
        "i" → "I". Düz toUpperCase() Türkçe'yi bozar ("İYİ" yerine "IYI"); sabit
        'tr-TR' ise İngilizce'yi bozar ("DAILY" yerine "DAİLY"). İkisi de yaşandı.
        (Backend'de bunun tersini — ToLower'ın Türkçe'de "I"yı "ı" yapmasını —
        gerçek bir üretim hatası olarak bulmuştuk. Aynı tuzak, her yön.)
      */}
      {title.toLocaleUpperCase(tr ? 'tr-TR' : 'en-US')}
    </Text>
    {hint ? (
      // İpucu ÜÇÜNCÜL: başlıktan bir seviye aşağı. Eskiden 8.5pt idi — görünmez.
      <Text style={[styles.hint, { color: theme.onSurfaceMuted }]}>{hint}</Text>
    ) : null}
  </View>
));

SectionHeader.displayName = 'SectionHeader';

const styles = StyleSheet.create({
  wrap: {
    // Yatay girinti YOK — `inset` prop'undan gelir (bkz. yukarıdaki not).
    paddingTop: S.md,
    paddingBottom: S.sm,
  },
  title: {
    fontSize: F.footnote,
    fontWeight: W.semibold,
    // Büyük harf metin optik olarak sıkışık görünür; hafif açmak okunurluğu artırır.
    // 1.5 yazılıydı — o 9pt için fazlaydı, 13pt'de harfler dağılırdı.
    letterSpacing: 0.6,
  },
  hint: {
    fontSize: F.caption,
    fontWeight: W.regular,
    marginTop: S.xxs,
  },
});
