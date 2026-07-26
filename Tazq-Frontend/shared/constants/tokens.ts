import { Dimensions, Platform, StyleSheet, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Standard design baseline (iPhone X/11 dimensions: 375x812)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Tablet/foldable (ör. Pixel Pro Fold) ekranlarda her şeyin devasa şişmesini önlemek
// için ölçek oranını ÜSTTEN sınırla. Telefonlarda oran zaten ≤1.25 → değişmez;
// sadece geniş ekranlarda makul tutar.
const MAX_RATIO = 1.25;
// Dimensions hazır değilse (foldable/çok pencereli açılışta width/height 0/undefined
// olabilir) NaN üretme — 1'e düş (ölçeksiz). NaN bir style değeri render'ı patlatır.
const W_RATIO = SCREEN_WIDTH > 0 ? Math.min(SCREEN_WIDTH / BASE_WIDTH, MAX_RATIO) : 1;
const H_RATIO = SCREEN_HEIGHT > 0 ? Math.min(SCREEN_HEIGHT / BASE_HEIGHT, MAX_RATIO) : 1;

export const scale = (size: number) => W_RATIO * size;
export const verticalScale = (size: number) => H_RATIO * size;
export const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

// Geniş/foldable/tablet ekranlarda içeriği ortalı bir sütunla sınırlamak için.
// Telefonda ekran zaten < MAX_W → tam genişlik (etkisiz); geniş ekranda ortalanır.
export const MAX_W = 600;
// Floating header/bottom-bar gibi mutlak konumlu öğeleri ortalamak için yan boşluk.
export const sideInset = (screenW: number, base = 16) => Math.max(base, (screenW - MAX_W) / 2);

/**
 * Boşluk ölçeği — 4pt ızgara.
 *
 * Eski ölçek 4 → 8 → 16 → 24 → 40 → 64 idi ve 8-16 ile 16-24 arasında DELİK vardı.
 * Sonuç ölçülebilirdi: en çok elle yazılan boşluklar tam o deliklere düşüyordu
 * (12 → 41 kez, 6 → 39, 14 → 32, 10 → 31 — toplam 869 elle yazılmış değer).
 * Yani sorun disiplinsizlik değil, ölçeğin eksikliğiydi: 12'ye ihtiyaç duyan
 * geliştiricinin token'ı yoktu.
 *
 * Ara adımlar eklendi; MEVCUT adımların değerine dokunulmadı (xs/sm/md/lg/xl/xxl
 * aynı) — aksi halde 1059 kullanım kayardı. İsimler ideal değil ama kayma riski
 * taşımıyor: smd = sm ile md arası.
 *
 * iOS'un ızgarası: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40
 * Bkz. __tests__/designTokens.test.ts
 */
export const S = {
  xxs: moderateScale(2),   // saç teli aralık
  xs: moderateScale(4),
  sm: moderateScale(8),
  smd: moderateScale(12),  // sm–md arası — iOS'un en sık adımı (eskiden 41 kez elle)
  md: moderateScale(16),   // standart kenar boşluğu
  lmd: moderateScale(20),  // md–lg arası
  lg: moderateScale(24),
  slg: moderateScale(32),  // lg–xl arası
  xl: moderateScale(40),
  xxl: moderateScale(64),
} as const;

/**
 * Köşe yarıçapı ölçeği — iOS bandına hizalı.
 *
 * Eski ölçek (sm 8 / md 16 / lg 24) iOS'tan yuvarlaktı. Apple'ın gerçek değerleri:
 * gruplanmış liste hücresi ~10, kart ~12-16, sayfa/sheet ~16-22. lg=24, Apple'ın en
 * yuvarlak kartından bile yuvarlaktı — aşırı yuvarlak köşe, ucuz template estetiğinin
 * imzasıdır ve "iOS-native kalite" hedefiyle çelişiyordu.
 *
 * Ölçek kapalı bir küme: elle yarıçap yazmak yerine en yakın adımı seç. Ölçek dışına
 * çıkmak gerekiyorsa önce ölçeğin eksik olup olmadığını sor.
 * Bkz. __tests__/designTokens.test.ts
 */
export const R = {
  xs: moderateScale(4),    // minik: ilerleme çubuğu, mini rozet
  sm: moderateScale(8),    // küçük kontrol, chip
  md: moderateScale(12),   // KART — iOS standardı (eski: 16)
  lg: moderateScale(16),   // büyük kart, panel (eski: 24)
  xl: moderateScale(22),   // sheet / modal
  full: 999,               // hap/daire — ölçeklenmez
} as const;

/**
 * İkon boyutu ölçeği.
 *
 * Eskiden token yoktu: 371 kullanımda 22 farklı boyut vardı (11, 12, 13, 14, 15, 16,
 * 17, 18, 20, 22, 23, 24…). 13 ile 14 gözle ayırt edilemez ama sistemin olmadığını
 * gösterir. Boşluk/yarıçap/yazıda ölçek varken ikonda yoktu.
 */
export const ICON = {
  xs: moderateScale(12),   // satır içi mini glif
  sm: moderateScale(16),   // liste/satır ikonu
  md: moderateScale(20),   // buton ikonu
  lg: moderateScale(24),   // başlık, sekme
  xl: moderateScale(32),   // vurgu
  xxl: moderateScale(44),  // kahraman/boş durum ikonu
} as const;

/**
 * Punto ölçeği — iOS tip ölçeğine hizalı.
 *
 * 22 ile 34 arasında DELİK vardı ve dashboard'ın en görünür yazısı (selamlama) tam
 * oraya düşüyordu: `fontSize: isSmallScreen ? 22 : 28` diye elle yazılmıştı. Boşluk
 * ölçeğiyle aynı hikâye — geliştirici uydurmadı, token yoktu.
 *
 * 28 keyfi bir sayı değil: Apple'ın Title 1'i.
 *   largeTitle 34 · title1 28 · title2 22 · title3 20 · body 17 · caption 11
 *
 * Punto hiyerarşisinin OLMAMASI, uygulamanın hiyerarşiyi ağırlıktan almasının sebebiydi
 * (her şey 9-14pt'de sıkışınca tek kaldıraç ağırlık kalıyor → 253 kullanım 800/900'de).
 * Apple hiyerarşiyi puntodan alır. Bkz. W (tokens.ts) ve __tests__/designTokens.test.ts
 */
export const F = {
  caption: moderateScale(11),  // iOS Caption 2 — okunabilirliğin ALT SINIRI
  caption2: moderateScale(12), // iOS Caption 1 — rozet/etiket, caption'dan bir tık büyük
  footnote: moderateScale(13), // iOS Footnote — bölüm başlığı, yardımcı satır
  body: moderateScale(14),
  callout: moderateScale(16),  // iOS Callout — vurgulu gövde / ikincil başlık
  subhead: moderateScale(17),
  title3: moderateScale(20),   // iOS Title 3 — kart başlığı
  title: moderateScale(22),   // iOS Title 2
  display: moderateScale(28), // iOS Title 1 — selamlama, ekran başlığı
  hero: moderateScale(34),    // iOS Large Title
} as const;

/**
 * Yazı ağırlığı ölçeği — iOS'un çıktığı en ağır nokta 700'dür.
 *
 * Uygulamada 833 ağırlık kullanımının 253'ü (%30) 800 veya 900'dü. SF Pro'da bunlar
 * "Heavy" ve "Black": Apple bunları arayüzde KULLANMAZ (pazarlama görsellerinde kullanır).
 * Aşırı ağır yazı, "ucuz template" algısının en güçlü tek sinyalidir — renkten önce gelir.
 *
 * Daha kötüsü, ağırlık YANLIŞ İŞTE çalıştırılıyordu: 900'ün en sık kullanıldığı puntolar
 * 9, 10, 11 ve 14'tü. Yani en küçük yazılar en ağır kesildi. Sebep şu: ekranlarda punto
 * hiyerarşisi yok (her şey 9-14pt arasında sıkışmış), o yüzden tek kaldıraç olarak
 * ağırlık kalmış.
 *
 * Apple hiyerarşiyi PUNTO ve RENKTEN alır, ağırlıktan değil:
 *   Large title 34/bold · Title 22/bold · Headline 17/semibold
 *   Body 17/regular · Caption 12/regular · Section header 13/regular gri
 *
 * Bkz. __tests__/designTokens.test.ts
 */
export const W = {
  regular: '400',
  medium: '500',
  semibold: '600',  // etiket, buton, satır başlığı
  bold: '700',      // başlık — TAVAN, üstü yok
} as const;

// KULLANILMIYOR (ölü kod). Fontlar app/_layout.tsx'te useFonts ile 'Jakarta-*' takma
// adlarıyla yükleniyor ve yalnızca focus.tsx + legal.tsx doğrudan kullanıyor. Geri kalan
// uygulama sistem fontunda — iOS'ta bu SF Pro demek, yani zaten native olan seçim.
/**
 * METRİK ölçeği — bir bakışta okunan SAYILAR (3/5, %60, 42dk).
 *
 * F'ten ayrı, çünkü işi ayrı: F bir OKUMA ölçeğidir (cümle, etiket, başlık), bu ise
 * bir GÖSTERGE ölçeği. Apple da Fitness/Health'te büyük sayıları tip ölçeğinin dışında
 * tutar — largeTitle 34'te biter, halkaların ortasındaki sayı ondan büyüktür.
 *
 * Neden token: uygulamada 30 üstü 12 farklı punto vardı (30·32·34·36·40·42·44·45·48·
 * 52·56·60), 24 kullanımda. 42 ile 44 gözle ayırt edilemez ama sistemin olmadığını
 * söyler. Üç adım bu aralığın tamamını karşılıyor.
 *
 * Bu ölçek METİN İÇİN DEĞİLDİR. Cümle yazıyorsan F kullan.
 */
export const METRIC = {
  sm: moderateScale(32),  // ikincil sayı / dar ekranda ana sayı
  md: moderateScale(44),  // kart kahramanı
  lg: moderateScale(56),  // tam ekran gösterge
} as const;

export const FONT_FAMILY = {
  extraBold: Platform.OS === 'ios' ? 'System' : 'Jakarta-ExtraBold',
  bold: Platform.OS === 'ios' ? 'System' : 'Jakarta-Bold',
  semiBold: Platform.OS === 'ios' ? 'System' : 'Jakarta-SemiBold',
  medium: Platform.OS === 'ios' ? 'System' : 'Jakarta-Medium',
  regular: Platform.OS === 'ios' ? 'System' : 'Jakarta-Regular',
} as const;

export const LH = {
  tight: 1.2,
  normal: 1.45,
  relaxed: 1.65,
} as const;

// ── Optik harf aralığı (SF Pro tracking) ──────────────────────────────────
// Apple HIG: büyük başlıklar sıkı (negatif), küçük metin hafif açık (pozitif).
// iOS'ta native his verir; Android'de de okunabilirliği bozmadan tutarlı durur.
export const TRACKING = {
  hero: -0.8,     // ~34pt büyük başlık
  title: -0.4,    // 20–24pt başlık
  subhead: -0.2,  // 17pt
  body: -0.1,     // 14–16pt gövde
  caption: 0.2,   // 11–13pt küçük ipucu / rozet (okunabilirlik için açılır)
} as const;

// ── Yay fiziği (Apple HIG damped spring) ──────────────────────────────────
// Mekanik duration/easing yerine kütle-temelli yay → parmak ucunda "canlı" his.
// Moti/Reanimated ile iki platformda da BİREBİR aynı çalışır.
export const SPRING = { type: 'spring', mass: 1, stiffness: 140, damping: 18 } as const;       // tatlı esneme (kart/giriş)
export const SPRING_SNAPPY = { type: 'spring', mass: 0.7, stiffness: 220, damping: 22 } as const; // hızlı/keskin (buton/sheet)
export const SPRING_SOFT = { type: 'spring', mass: 1.1, stiffness: 90, damping: 18 } as const;    // yumuşak (büyük katman)

// Punto → optik tracking eşlemesi (genel kullanım).
export const trackingFor = (fontSize: number): number =>
  fontSize >= 30 ? TRACKING.hero
  : fontSize >= 20 ? TRACKING.title
  : fontSize >= 16 ? TRACKING.body
  : fontSize <= 12 ? TRACKING.caption
  : TRACKING.subhead;

export const B = {
  thin: Platform.OS === 'android' ? 1 : 1,
  medium: Platform.OS === 'android' ? 1.5 : 1.5,
} as const;

/**
 * Liste satırı ayırıcısının KALINLIĞI — 1 fiziksel piksel.
 *
 * Uygulamada 18 ayırıcı `borderBottomWidth: 1` yazıyordu. iOS'ta bu YANLIŞ: 1pt, @3x
 * bir ekranda 3 fiziksel piksel demek, yani Apple'ın çizgisinin ÜÇ KATI. Sonuç, gözün
 * "bu iOS değil" dediği o kalın, ağır çizgi.
 *
 * StyleSheet.hairlineWidth cihazın piksel yoğunluğuna göre çözülür (@3x'te ~0.33,
 * @2x'te 0.5, @1x'te 1) — yani her ekranda tam 1 piksel. Renk için: theme.separator.
 *
 * Kalınlık ve renk birlikte çalışır: ince çizgi belirgin renk ister (0.29/0.65),
 * kalın çizgi soluk renk ister. Birini alıp diğerini bırakmak dengeyi bozar.
 */
export const HAIRLINE = StyleSheet.hairlineWidth;

/**
 * iOS gruplanmış listede ayırıcı, satırın SOL KENARINDAN başlamaz — metnin başladığı
 * yerden başlar. Yani ikonun/avatarın altı boş kalır. Bu, Ayarlar'dan Mesajlar'a kadar
 * her Apple listesinde vardır ve "gruplanmış liste" hissini veren asıl detaydır;
 * tam genişlik ayırıcı, web/Android'in deseni.
 *
 * Kullanım: satırın soluna ne varsa (ikon genişliği + aradaki boşluk) kadar girinti ver.
 *   <View style={{ marginLeft: ICON.md + S.smd, borderBottomWidth: HAIRLINE }} />
 * Ayırıcının solunda hiçbir şey yoksa girinti verme — girinti ikonu takip eder, süs değil.
 */
export const separatorInset = (leadingWidth: number, gap: number = S.smd) => leadingWidth + gap;

// ── Yüzen çubukların kapladığı alan ───────────────────────────────────────
/**
 * Alt navbar `position: absolute` ile yüzer — scroll içeriği ONUN ALTINDAN geçer.
 * Sayfa dibinde bu kadar boşluk bırakılmazsa son öğeye ulaşılamaz.
 *
 * Beş sayfanın beşi de dibe sabit sayı yazmıştı ve her biri ayrı tahmin etmişti
 * (dördü 64, biri 98) — gerçek yükseklik home göstergeli bir iPhone'da 106. Yani
 * son 42pt barın arkasındaydı.
 *
 * Sayı burada, bileşende değil: geometri React'e bağlı değil ve testten/ekrandan
 * import edilebilmeli. BottomNavBar kendi stilini BU sabitlerden kurar — tersi değil.
 * Bkz. __tests__/navBarSpace.test.ts
 */
/**
 * Bar artık YÜZMÜYOR: ekranın dibine yapışık, tam genişlikte standart sekme çubuğu.
 *
 * Önceki hâl yüzen bir "pill"di (%92 genişlik, tam yuvarlak, 68pt) ve iki sorunu vardı:
 * arkadaki hap/daire göstergesi ile yuvarlak kabuk görsel olarak yük bindiriyordu, ve
 * 5 sekmeye düşen ~72pt'ye sekme ADI sığmıyordu — bar ya kalabalıklaşıyor ya isimsiz
 * kalıyordu ("Layers" = Modlar mı? sorusu). Tam genişlikte ikon + etiket rahat sığar,
 * gösterge şekline gerek kalmaz (aktif sekmeyi tint rengi söyler — iOS'un yaptığı).
 *
 * ÖLÇÜLER APPLE'IN KENDİ SPESİFİKASYONU: UIKit'te UITabBar içerik yüksekliği 49pt'dir
 * ve güvenli alan (home göstergesi, 34pt) bunun ALTINA eklenir → iPhone'da toplam 83pt.
 * Ekstra "nefes payı" eklenmez; Apple da eklemez. Etiket 10pt/semibold (bkz. F.tabLabel),
 * ikon ~24-25pt, aktif sekmenin tek işareti tint rengidir.
 */
export const NAV_BAR_HEIGHT = 49;     // UIKit UITabBar standart yüksekliği
export const NAV_BAR_LIFT = 0;        // dibe yapışık — yükselti yok
export const NAV_BAR_MIN_INSET = 0;   // ekstra pay yok; alt boşluk güvenli alandan gelir

/**
 * SEKME ÇUBUĞU İÇERİĞİ — ÖLÇEKLENMEZ.
 *
 * Bunlar bilerek `moderateScale` DIŞINDA. Sebebi bir hata: çubuk yüksekliği ham 49
 * iken ikon `ICON.lg` (moderateScale) ve etiket ölçekli yazılmıştı; ekran genişledikçe
 * içerik büyüyor ama kap büyümüyordu. Ölçüldü — 430pt telefonda yığın 41.2pt, tablette
 * 43.1pt oluyor ve 49pt'lik çubukta üst/alt pay 3pt'ye düşüyordu (sıkışık).
 *
 * Apple'da sekme çubuğunun ÜÇÜ DE sabittir: yükseklik 49, ikon ~25, etiket 10. Hiçbiri
 * ekran genişliğiyle değişmez — yalnızca Dynamic Type ile. Sekme çubuğu içerik değil
 * CHROME'dur; her cihazda aynı görünmesi beklenir.
 *
 * İkon 22: lucide çizgisel bir set ve 24pt'de SF Symbols'ten optik olarak DAHA AĞIR
 * duruyor. 22, Apple'ın sembol yoğunluğuna denk düşer ve 6.3pt nefes payı bırakır.
 */
export const NAV_ICON_SIZE = 22;
export const NAV_LABEL_SIZE = 10;

export const navBarSpace = (insetBottom: number) =>
  Math.max(insetBottom, NAV_BAR_MIN_INSET) + NAV_BAR_LIFT + NAV_BAR_HEIGHT;

/**
 * Üstteki yüzen başlık (TopBar) — aynı hikâye, aynı çözüm.
 *
 * Başlığın yüksekliği İÇERİĞİNDEN doğuyordu (en yüksek öğe StatusHub: 38pt, + dikey
 * iç boşluk 2×8 = 54). Sayfalar ise üste sabit `S.xxl` (64) yazmıştı. insets.top + 8
 * + 54 = 62 kapladığı için geriye 2pt kalıyordu: içerik başlığa DEĞİYORDU.
 *
 * index bunu fark etmiş ve hero'ya kendi payını eklemiş (marginTop: S.lg) — tasks,
 * cockpit ve modlar eklememişti. Yani sorun her sayfada ayrı yamanıyordu.
 *
 * Yükseklik artık SABİT ve açık: iOS nav bar'ları da sabittir (44pt), içeriğe göre
 * uzayıp kısalmaz. Bu hem tahmini bitiriyor hem de başlığa bir öğe eklendiğinde
 * başlığın sessizce büyümesini engelliyor.
 */
// Ölçeklenmez — NAV_BAR_HEIGHT gibi. İki yüzen bar aynı kuralla davranmalı: biri
// ekranla büyüyüp diğeri sabit kalırsa üst/alt boşluk oranı cihaza göre kayar.
// (Barın İÇİ ölçeklenir: avatar scale(34) geniş ekranda 42.5 → 54'lük bara sığar.)
/**
 * BAŞLIK ÇUBUĞU — sekme çubuğuyla AYNI SİSTEM.
 *
 * Eskiden yüzen bir "pill"di: 54pt, tam yuvarlak, 8pt havada, yanlardan boşluklu,
 * gölgeli. Sekme çubuğu Apple ölçüsüne (dibe yapışık, tam genişlik, hairline) geçince
 * ekranın iki ucu iki ayrı tasarım dili konuşur oldu. Apple bunu yapmaz: UINavigationBar
 * da UITabBar gibi tam genişlikte, düz ve hairline ayraçlıdır.
 *
 * 54 sayısı ayrıca içerikten türetilmişti (StatusHub 38 + 2×8) — kaçınılmak istenen
 * şeyin ta kendisi. UIKit'in standardı 44pt.
 *
 * ÖLÇEKLENMEZ: sekme çubuğunda olduğu gibi başlık da CHROME'dur; yükseklik, başlık ve
 * alt satır her cihazda aynıdır (yalnız Dynamic Type ile değişir). Ölçekli punto +
 * sabit yükseklik karışımı sekme çubuğunda sıkışmaya yol açmıştı, aynı hata burada
 * tekrarlanmıyor.
 */
export const TOP_BAR_HEIGHT = 44; // UIKit UINavigationBar standart yüksekliği
export const TOP_BAR_LIFT = 0;    // yüzmez — durum çubuğunun hemen altına yapışır
export const TOP_TITLE_SIZE = 17;    // Apple nav bar başlığı: 17pt semibold
export const TOP_SUBTITLE_SIZE = 11; // başlık altı yardımcı satır (ör. tarih aralığı)

/**
 * BAŞLIK ÇUBUĞUNDAKİ ÖĞE (avatar, logo, durum rozeti) — GÖRSEL boyut.
 *
 * Dokunma hedefi her zaman MIN_TOUCH (44); bu yalnız çizilen boyut. Apple'ın bar
 * button item'ları ~24-30pt görseldir, çubuğun kendisi 44pt'dir — yani öğe çubuğu
 * doldurmaz, içinde nefes alır.
 *
 * Neden sabit ve neden burada: bu öğeler 54pt'lik ESKİ çubuğa göre ölçülmüştü
 * (logo 30 + 2×12 boşluk = 54.5pt, avatar scale(34) ≈ 40pt). Çubuk Apple ölçüsü olan
 * 44pt'ye inince logo TAŞTI, avatar kenara 1.8pt kaldı — "sıkışmışlık" tam olarak
 * buydu. Ayrıca `scale()` ile yazıldıkları için tablette daha da büyüyorlardı; chrome
 * ölçeklenmez (bkz. NAV_ICON_SIZE).
 */
export const TOP_ITEM_SIZE = 32;

/**
 * BAŞLIK ÇUBUĞUNDAKİ AVATAR — artık glif öğelerle AYNI ölçüde (takma ad).
 *
 * ÖNCEDEN AYRIŞIKTI (34 vs 30) ve gerekçesi doğruydu: çubukta üç öğe vardı
 * (avatar · TAZQ kelime işareti · durum rozeti) ve bir FOTOĞRAF, aynı kutudaki tek
 * renkli bir gliften optik olarak küçük okunur; bu yüzden telafi ediliyordu.
 *
 * O gerekçe kelime işaretiyle birlikte düştü. Çubukta artık İKİ öğe var ve ikisi de
 * karşılıklı KENARDA duruyor. Aralarında hiçbir şey yokken göz onları doğrudan
 * karşılaştırır: farklı çaptaki iki daire "denge" değil "hata" gibi okunur. Üç öğeli
 * bir kompozisyonda gizlenen fark, iki öğeli olanda tek görülen şey olur.
 *
 * Optik telafi kaldırılmadı, YER DEĞİŞTİRDİ: fotoğrafın ağırlığı artık çapla değil,
 * çevresindeki halkanın incelmesiyle dengeleniyor (bkz. index.tsx avatarContainer).
 * Böylece iki kenar aynı çapta, aynı görsel ağırlıkta.
 *
 * 32pt, 44pt'lik çubukta 6pt nefes bırakır — Apple'ın nav bar bandının içinde.
 * Takma ad olarak tanımlı: ikisi bir daha ayrışamaz.
 */
export const TOP_AVATAR_SIZE = TOP_ITEM_SIZE;

/**
 * Alt sayfanın (bottom sheet) ÜST SINIRI.
 *
 * Dört dosyada `screenHeight - insets.top - 16` elle yazılıydı; 16 nereden geliyor
 * kimse bilmiyordu ve biri değişse diğerleri ayrışırdı. Tek yerde: güvenli alanın
 * altında, ekranın tepesine değmeyecek kadar pay.
 */
export const sheetMaxHeight = (screenHeight: number, insetTop: number) =>
  screenHeight - insetTop - S.md;

/** Yüzen başlığın kapladığı toplam dikey alan. Sayfa üstü boşluğu bundan az olamaz. */
export const topBarSpace = (insetTop: number) => insetTop + TOP_BAR_LIFT + TOP_BAR_HEIGHT;

// ── Dokunma hedefi ────────────────────────────────────────────────────────
/**
 * Apple HIG dokunma hedefi alt sınırı: 44×44pt.
 *
 * Bu GÖRSEL boyut değil, ERİŞİLEBİLİR alan. Bir ikon 24pt çizilebilir; parmağın
 * bulacağı alan yine de 44pt olmalı. İkisini karıştırmak, küçük ikonlu arayüzlerin
 * "hep ıskalıyorum" hissinin sebebidir.
 */
export const MIN_TOUCH = 44;

/**
 * Görsel boyutu MIN_TOUCH'a tamamlayan hitSlop.
 *
 * Elle hitSlop yazmak yerine bunu kullan: ölçü değişince pay kendiliğinden ayarlanır.
 * Zaten 44pt veya üstündeki öğe için sıfır döner — fazladan alan çalmaz, çünkü
 * komşu hedeflerle çakışmak da bir erişilebilirlik hatasıdır.
 *
 *   <Touchable hitSlop={touchSlop(scale(34))}>   // avatar 34pt → her yana 5pt
 */
export const touchSlop = (visualSize: number) => {
  const pad = Math.max(0, (MIN_TOUCH - visualSize) / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
};

export const getPremiumShadow = (elevation = 5, color = '#000000') => {
  if (Platform.OS === 'android') {
    return {
      elevation: elevation * 1.5,
      shadowColor: color,
    };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: elevation * 0.8 },
    shadowOpacity: 0.04 + (elevation * 0.005), // softer opacity
    shadowRadius: elevation * 1.5, // wider blur radius
  };
};
