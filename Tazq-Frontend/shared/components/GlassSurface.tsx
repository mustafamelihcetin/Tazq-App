import React from 'react';
import { View, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { AppBlur, type BlurMaterial } from '@/shared/components/AppBlur';
import { R } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * CAM YÜZEY — sayfa, modal, menü ve uyarının ZEMİNİ. Yalnız zemin.
 *
 * ── NEDEN GlassSheet'TEN AYRI ─────────────────────────────────────────────────
 * GlassSheet ortalanmış kart için eksiksiz bir kabuk: kendi giriş animasyonu,
 * genişliği ve dolgusu var. Uygulamadaki yüzeylerin çoğu ise öyle değil:
 *
 *  · alttan kayan sayfalar (görev formu, hızlı taslak, durum merkezi…) kendi
 *    kaydırma animasyonunu ve sürükleyerek kapatma jestini taşıyor
 *  · uyarı kutusu ölçek + kayma animasyonunu kendisi yürütüyor
 *  · bağlam menüsü kendi yay fiziğiyle açılıyor
 *
 * Bunları GlassSheet'e sokmak ya animasyonlarını söküp atmak ya da iki animasyonu
 * üst üste bindirmek demekti. Oysa değişmesi gereken tek şey ZEMİN. Bu bileşen
 * kabın ilk çocuğu olarak konur; kabın düzenine, jestine, animasyonuna dokunmaz.
 *
 * ── OPAKLIK TAHMİN DEĞİL, KONTRAST GEREĞİ ─────────────────────────────────────
 * Saf cam üstünde metin okunmaz: arkadaki içerik kaydıkça kontrast oynar ve bir anda
 * AA'nın altına düşer. Apple'ın kendi sayfaları da saf cam değildir — camın üstünde
 * bir TON katmanı vardır ve içerik onun üstünde durur.
 *
 * Buradaki değerler o ton katmanı. TEK yerde duruyorlar ki her yüzeyde yeniden
 * uydurulmasın (bkz. AppBlur'ün "17 çağrıda 12 farklı sayı" notu — aynı hata).
 *
 * CİHAZDA ÖLÇÜLDÜ: ilk değerler (0.82 / 0.78) SAYDAM göründü — özellikle koyu temada
 * sayfanın arkasındaki kartlar seçiliyor ve sayfa "yarım çizilmiş" duruyordu. Bir
 * MODAL SAYFA, çubuklar gibi içeriğin üstünde yüzen bir yüzey değil; bir BELGEDİR ve
 * dikkatin tamamını alır. Apple'ın kendi sayfaları da tam yükseklikte opaklaşır.
 *
 * Değerler bu yüzden neredeyse opak. Cam yine de orada: kenar ışığı ve derinlik
 * duruyor, ama okunurluk pazarlık konusu değil. Ayar TEK yerden yapılır; bütün
 * sayfa, menü ve uyarılar birlikte değişir.
 *
 * ÇUBUKLAR BURAYA DAHİL DEĞİL: başlık ve sekme çubuğu saf cam kalır (bkz. AppBlur).
 * Onlarda içerik altından akar ve camın berraklığı derinlik demektir.
 *
 * ── ANDROID: OPAK ─────────────────────────────────────────────────────────────
 * Android'de cam malzeme yok ve Material'ın sayfaları opaktır. Bu turdan önce
 * Android'deki bütün sayfalar opaktı; öyle KALIYOR. Aynı ton rengi tam örtmeyle
 * çiziliyor — iki platform aynı paleti konuşuyor, yalnız malzeme farklı.
 * (Sekme çubuğu da aynı ilkeyle ayrıldı: iOS'ta yüzen cam, Android'de opak.)
 */
export const VEIL_OPACITY = { light: 0.96, dark: 0.94 };

/**
 * Hangi köşeler yuvarlanır?
 *
 *  · all  ortalanmış kart, menü, uyarı; klavyenin üstünde duran sayfa
 *  · top  ekranın dibine yapışık sayfa — alt kenar ekranın kenarıdır
 */
export type GlassCorners = 'all' | 'top';

export interface GlassSurfaceProps {
  /** Kabuğun köşe yarıçapı. Varsayılan cam sayfa bandı (`R.sheet`). */
  radius?: number;
  corners?: GlassCorners;
  /** Varsayılan `thick` — üstünde metin okunacak yüzeyler için. */
  material?: BlurMaterial;
}

/**
 * Yüzeyin şekli.
 *
 * YALNIZ ÜST KÖŞELER İÇİN köşe başına yarıçap KULLANILMIYOR. Cam (iOS 26+) köşe
 * başına yarıçapı destekliyor ama yedek bulanıklık katmanı kendi kırpmasını
 * yapıyor ve köşe başına değerlerde nasıl davrandığı cihazda doğrulanmadı. Bunun
 * yerine yüzey dört köşeden eşit yuvarlanıyor ve alt kenarı yarıçap kadar AŞAĞI
 * uzatılıyor: alt köşeler ekranın dışında kalıyor. Üç malzeme yolunun (cam, bulanık,
 * opak) üçünde de kanıtlanmış tek biçim eşit yarıçap — ana sayfadaki durum
 * düğmesinin köşe hatası da tam bu yolla kapandı.
 */
export const surfaceShape = (radius: number, corners: GlassCorners): ViewStyle =>
  corners === 'top'
    ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: -radius, borderRadius: radius }
    : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius };

export function GlassSurface({ radius = R.sheet, corners = 'all', material = 'thick' }: GlassSurfaceProps) {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const shape = surfaceShape(radius, corners);
  // Ton rengi palet token'ı: açıkta en açık yüzey, koyuda zeminden yükselen yüzey.
  const fill = isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest;

  if (Platform.OS !== 'ios') {
    return <View pointerEvents="none" style={[shape, { backgroundColor: fill }]} />;
  }

  return (
    <>
      {/* Yarıçap MALZEMEYE de veriliyor: kabın kırpması cam/blur katmanını güvenilir
          kırpmıyor (bkz. AppBlur radius notu). */}
      <AppBlur material={material} radius={radius} style={shape} />
      <View
        pointerEvents="none"
        style={[shape, { backgroundColor: fill, opacity: VEIL_OPACITY[isDark ? 'dark' : 'light'] }]}
      />
    </>
  );
}
