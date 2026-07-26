import React from 'react';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import type { BlurTint } from 'expo-blur';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * BULANIK YÜZEY — uygulamadaki TEK blur girişi.
 *
 * İKİ SORUNU BİRDEN ÇÖZÜYOR.
 *
 * 1) ANDROID'DE HİÇ BULANIKLAŞTIRMIYORDUK. `expo-blur`ün Android varsayılanı
 *    `blurMethod: 'none'` ve dokümanı açık: "Renders a semi-transparent view INSTEAD OF
 *    rendering a blur effect." Yani 17 çağrının tamamı Android'de düz yarı saydam
 *    dikdörtgendi. iOS'ta malzeme gibi duran şey Android'de sadece altındaki içeriği
 *    bulanıklaştırmadan sızdıran bir örtüydü — kullanıcı bunu "cam" diye değil "çizim
 *    hatası" diye okur. Buradan `dimezisBlurViewSdk31Plus` veriliyor: Android 12+'ta
 *    gerçek blur, altındaki sürümlerde sessizce eski davranış.
 *
 * 2) YOĞUNLUK SİSTEMİ YOKTU. 17 çağrıda 12 farklı sayı vardı (15, 18, 20, 25, 28, 30,
 *    40, 48, 55, 60, 75, 90) ve tema yönü bile tutarsızdı: bir yerde koyu tema daha
 *    YÜKSEK, başka yerde daha DÜŞÜK yoğunluk alıyordu. Her çağrı kendi sayısını
 *    uydurmuştu. Sayı seçmek bir tasarım kararıdır ve 17 yerde ayrı ayrı verilemez.
 *
 * KURAL: çağıran taraf sayı yazmaz, MALZEME söyler. Apple'ın kendi sözlüğü kullanılıyor
 * (thin/regular/thick/chrome) — yeni bir dil icat etmeye gerek yok.
 *
 * Bkz. __tests__/appBlur.test.ts
 */

/**
 * Malzeme kalınlığı — ne kadar sakladığına göre.
 *
 *  · thin    arkası OKUNSUN, sadece geri çekilsin (küçük yüzeyler, tur örtüsü)
 *  · regular standart panel/menü — arkası seçilir ama okunmaz
 *  · thick   arkası KAYBOLSUN (kutlama, tam ekran anlar)
 *  · chrome  sistem çubukları — en yoğun, çünkü içerik altından KAYARAK geçer
 */
export type BlurMaterial = 'thin' | 'regular' | 'thick' | 'chrome';

/**
 * Koyu ve açık tema AYRI ayarlanıyor: aynı yoğunluk iki temada aynı şeyi hissettirmez.
 * Açık zeminde bulanıklaşan bir görüntü hâlâ parlak kalır ve daha çok örtme ister;
 * koyu zeminde ise fazla yoğunluk yüzeyi düz siyaha çevirip malzeme olmaktan çıkarır.
 * `chrome` değerleri BİLEREK eskisiyle birebir aynı — başlık ve sekme çubuğunun görünümü
 * bu birleştirmede değişmesin diye.
 */
const INTENSITY: Record<BlurMaterial, { light: number; dark: number }> = {
  thin: { light: 20, dark: 25 },
  regular: { light: 40, dark: 35 },
  thick: { light: 60, dark: 55 },
  chrome: { light: 90, dark: 70 },
};

export interface AppBlurProps {
  /** Varsayılan `regular` — panel/menü yüzeyi. */
  material?: BlurMaterial;
  /**
   * Tema rengini EZER. Yalnız zemini temadan bağımsız sabit olan ekranlar için
   * (giriş ve tanıtım ekranı her zaman koyu). Başka yerde kullanılırsa yüzey, açık
   * temada koyu kalır — kaçış kapısı olduğu için bilinçli seçilmeli.
   */
  tint?: BlurTint;
  /** Varsayılan: kapsayıcıyı tamamen doldurur. */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export const AppBlur = ({ material = 'regular', tint, style, children }: AppBlurProps) => {
  const { colorScheme } = useAppTheme();
  const level = INTENSITY[material][colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <BlurView
      intensity={level}
      tint={tint ?? colorScheme}
      /*
        `chrome` Android'de BULANIKLAŞTIRMAZ — bilinçli. Sistem çubuklarının arkasındaki
        içerik KAYAR, yani blur her karede yeniden hesaplanır; üstelik ekranda sürekli
        duran iki yüzeyde (başlık + sekme çubuğu). Diğer malzemelerin arkası sabittir,
        blur bir kez hesaplanır. Android'in kendi tasarım dili de opak app bar'dır;
        çubukların zemini zaten opak `surfaceFloating` (bkz. Colors.ts).
      */
      blurMethod={material === 'chrome' ? 'none' : 'dimezisBlurViewSdk31Plus'}
      style={style ?? StyleSheet.absoluteFill}
    >
      {children}
    </BlurView>
  );
};
