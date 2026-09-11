import React from 'react';
import { StyleSheet, StyleProp, ViewStyle, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import type { BlurTint } from 'expo-blur';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceTransparency } from '@/shared/hooks/useReduceTransparency';

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

/**
 * LIQUID GLASS — iOS 26+ için gerçek sistem malzemesi.
 *
 * ── NEDEN OPSİYONEL YÜKLENİYOR ────────────────────────────────────────────────
 * `expo-glass-effect` bir NATIVE modül. Derlemede yoksa (eski bir geliştirme
 * derlemesi, Expo Go, Android) `require` patlar. Uygulamadaki mevcut desen bu:
 * Google Sign-In, SystemUI ve NavigationBar da aynı şekilde savunmacı yükleniyor.
 *
 * Modül yoksa DEĞİŞEN HİÇBİR ŞEY OLMAZ — `expo-blur` yolu aynen çalışır. Yani bu
 * dosya yeni derleme alınmadan da güvenli; cam yalnız desteklendiği yerde belirir.
 */
let GlassModule: any = null;
try {
  GlassModule = require('expo-glass-effect');
} catch (e) {
  // Sessiz: modülün olmaması bir hata değil, desteklenmeyen bir ortam.
}

/** Cam malzeme bu cihazda GERÇEKTEN çizilebilir mi? */
function canUseGlass(): boolean {
  if (Platform.OS !== 'ios' || !GlassModule) return false;
  try {
    // İki ayrı kontrol: derleme/işletim sistemi uygunluğu + çalışma anı API varlığı.
    // İkincisi bazı iOS 26 beta sürümlerinde API'nin eksik olmasına karşı — o
    // sürümlerde yalnız ilkine bakmak ÇÖKMEYE yol açıyor.
    const buildOk = GlassModule.isLiquidGlassAvailable?.() ?? false;
    const runtimeOk = GlassModule.isGlassEffectAPIAvailable?.() ?? buildOk;
    return !!(buildOk && runtimeOk);
  } catch (e) {
    return false;
  }
}

/** Malzeme kalınlığı → cam stili. `thick` tam örtmeli, o yüzden normal cam. */
const GLASS_STYLE: Record<BlurMaterial, 'clear' | 'regular'> = {
  thin: 'clear',
  regular: 'regular',
  thick: 'regular',
  chrome: 'regular',
};

export const AppBlur = ({ material = 'regular', tint, style, children }: AppBlurProps) => {
  const { colorScheme, theme } = useAppTheme();
  const reduceTransparency = useReduceTransparency();
  const level = INTENSITY[material][colorScheme === 'dark' ? 'dark' : 'light'];

  /*
    ŞEFFAFLIĞI AZALT — her şeyden ÖNCE gelir.

    Tercihi açan kullanıcı bulanıklık istemiyor. Cam da blur da bu isteği çiğner;
    doğrusu opak bir yüzey. Bu kontrol en başta duruyor ki hiçbir malzeme yolu
    onu atlayamasın. iOS 27'nin cam yoğunluk kaydırıcısı da aynı aileden bir
    tercih — sistem yüzeyleri otomatik uyar, bizimkilerin uyması için bu gerekir.
  */
  if (reduceTransparency) {
    return (
      <View style={[style ?? StyleSheet.absoluteFill, { backgroundColor: theme.surfaceFloating }]}>
        {children}
      </View>
    );
  }

  /*
    iOS 26+ → GERÇEK cam. Sistem malzemesi olduğu için kırılma, ışık ve kenar
    davranışını Apple yönetir; iOS sürümü ilerledikçe kendiliğinden güncellenir.
    Taklit etmeye çalışmak her yıl kovalamak demekti.
  */
  if (canUseGlass()) {
    const GlassView = GlassModule.GlassView;
    return (
      <GlassView
        glassEffectStyle={GLASS_STYLE[material]}
        /*
          TEMA SİSTEMDEN DEĞİL UYGULAMADAN GELİR.

          TAZQ kendi tema tercihini tutuyor (açık / koyu / sistem). Cam varsayılan
          olarak SİSTEMİN görünümünü izler; kullanıcı uygulamada koyu tema seçmişken
          telefon açık temadaysa cam açık kalır ve yüzey, üstündeki koyu içerikle
          çakışır. `tint` verilmişse (giriş ve tanıtım ekranı zemini temadan bağımsız
          olarak koyudur) o kazanır — aynı kaçış kapısı blur yolunda da var.
        */
        colorScheme={tint ?? colorScheme}
        style={style ?? StyleSheet.absoluteFill}
      >
        {children}
      </GlassView>
    );
  }

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
