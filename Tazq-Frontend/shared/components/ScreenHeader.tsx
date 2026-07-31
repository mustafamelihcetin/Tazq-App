import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, Animated } from 'react-native';
import { AppBlur } from '@/shared/components/AppBlur';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import {
  S, ICON, HAIRLINE, MAX_W,
  TOP_BAR_HEIGHT, TOP_TITLE_SIZE, TOP_SUBTITLE_SIZE,
} from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { haptic } from '@/shared/utils/haptics';

/**
 * Sayfa başlığı — ekranın üstüne yapışık, TAM GENİŞLİKTE, standart desen.
 * (dashboard, aksiyon merkezi, haftalık merkez ve dönemsel modlar)
 *
 * NEDEN ORTAK BİLEŞEN: bu başlık dört dosyada AYRI AYRI tanımlanmıştı. Kopyalar zamanla
 * ayrıştı ve boyları farklılaştı, çünkü yükseklik içerikten doğuyordu. Tek bir yerde
 * durunca ayrışma imkânsızlaşıyor — kural değil, yapı zorluyor.
 *
 * NEDEN YÜZEN "PILL" DEĞİL (değişiklik): önceki hâl 54pt, tam yuvarlak, 8pt havada,
 * yanlardan boşluklu ve gölgeliydi. Sekme çubuğu Apple ölçüsüne geçtiğinde ekranın iki
 * ucu iki ayrı tasarım dili konuşmaya başladı — üstte yüzen kart, altta sistem chrome'u.
 * Apple bunu yapmaz: UINavigationBar da UITabBar gibi tam genişlikte, düz ve hairline
 * ayraçlıdır. Artık ikisi tek sistem.
 *
 * ÖLÇÜLER APPLE'IN SPESİFİKASYONU:
 *   · yükseklik 44pt, durum çubuğunun hemen altında (blur durum çubuğunu da kaplar)
 *   · başlık 17pt semibold, ortalanmış
 *   · yarı saydam zemin (blur) + altta tek hairline ayraç, GÖLGE YOK
 *   · yükseklik/başlık ÖLÇEKLENMEZ — chrome her cihazda aynıdır
 *
 * BAŞLIK BİLEŞENDE: eskiden her ekran başlığını kendi `center` yuvasına Text olarak
 * yazıyordu (F.title3 + adjustsFontSizeToFit). Bu, sabit yüksekliğin sağladığı
 * tutarlılığı geri bozuyordu: dar ekranda başlık küçülüyor, geniş ekranda büyüyordu —
 * yani aynı başlık cihaza göre farklı puntoda çiziliyordu. Artık `title` prop'u var;
 * tipografi tek yerde, ekranlar ayrışamaz.
 *
 * SİMETRİ: yan yuvalar EŞİT genişlikte (SIDE_SLOT). Böylece ortadaki öğe, iki yandaki
 * içerik farklı genişlikte olsa bile gerçekten ortada durur.
 */

/** Yan yuva genişliği — iki yan EŞİT olmalı, yoksa orta öğe kayar. */
export const SIDE_SLOT = 90;

/** Apple HIG dokunma hedefi alt sınırı. Görsel öğe küçük olabilir, HEDEF olamaz. */
export const MIN_TOUCH = 44;

export interface ScreenHeaderProps {
  /** Sol yuva (avatar, aksiyon…). `onBack` verilirse yok sayılır. */
  left?: React.ReactNode;
  /**
   * Standart başlık — 17pt semibold, ortalanmış. Tipografi bileşende olduğu için
   * ekranlar arasında ayrışamaz. Özel bir orta öğe gerekiyorsa `center` kullan.
   */
  title?: string;
  /** Başlığın altındaki yardımcı satır (ör. haftanın tarih aralığı). */
  subtitle?: string;
  /** Alt satırın rengi — verilmezse ikincil metin rengi. */
  subtitleColor?: string;
  /**
   * Orta yuva için KAÇIŞ KAPISI — yalnız başlık metni yetmediğinde (ör. ana sayfadaki
   * dokunulabilir TAZQ logosu). `title` verilmişse o kazanır.
   */
  center?: React.ReactNode;
  /** Sağ yuva (aksiyon, filtre…). */
  right?: React.ReactNode;
  /**
   * Sayfanın kaydırma konumu. Verilirse başlık ÇÖKEN başlığa dönüşür (iOS deseni).
   *
   * NEDEN: ana sayfada İKİ AYRI başlık sistemi vardı. Üstte 44pt'lik çubukta hiç
   * değişmeyen "TAZQ" kelime işareti, altında 28pt'lik selamlama. Aşağı kaydırınca
   * selamlama gidiyor, yerine hiçbir şey gelmiyordu; geriye nerede olduğunu söylemeyen
   * bir çubuk kalıyordu. iOS'ta bunlar TEK sistemdir: büyük başlık kaydıkça kompakt
   * başlığa dönüşür.
   *
   * ÇUBUĞUN KENDİSİ DE bu değere bağlı (bkz. chromeOpacity) — animasyon mantığı burada,
   * tek yerde. Ekran yalnız "ne kadar kaydırıldı" bilgisini verir; nasıl görüneceğine
   * çubuk karar verir. Ayrı ayrı verilseydi ekranlar farklı eşikler seçip ayrışırdı.
   */
  scrollY?: Animated.Value;
  /**
   * Başlığın TAM göründüğü kaydırma mesafesi — büyük başlığın ekrandan çıktığı an.
   * Ölçülerek verilmeli, tahmin edilerek değil: punto ve satır sayısı cihaza göre
   * değişir (bkz. index.tsx heroHeight).
   */
  collapseAt?: number;
  /**
   * Verilirse sol yuvaya STANDART geri düğmesi çizilir.
   *
   * NEDEN BURADA: geri düğmesi uygulamada birden çok biçimde yazılmıştı ve ikonu bile
   * ayrışmıştı. Aynı eylemin her sayfada farklı görünmesi, kullanıcıyı her sayfada
   * yeniden öğrenmeye zorluyor. Tek yer = tek davranış.
   */
  onBack?: () => void;
  /** Geri düğmesinin erişilebilirlik etiketi (varsayılan: "Geri"). */
  backLabel?: string;
}

export const ScreenHeader = ({
  left, title, subtitle, subtitleColor, center, right, onBack, backLabel, scrollY, collapseAt,
}: ScreenHeaderProps) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();

  /**
   * Başlığın belirmesi — büyük başlık ekrandan çıkarken devralır.
   *
   * Geçiş son 32pt'de yapılıyor: daha uzunu başlığı yarı saydam gezdirir, daha kısası
   * ani bir yanıp sönme gibi okunur.
   */
  const titleProgress = React.useMemo(() => {
    if (!scrollY) return null;
    /*
      `collapseAt` YOKSA BAŞLIK HEP GÖRÜNÜR — ve bu iki farklı ekran türünü ayırıyor.

      İki meşru kullanım var:

       · SAYFADA BÜYÜK BAŞLIK VAR (ana sayfa): tepedeyken asıl başlık içerikteki
         selamlamadır; çubuktaki başlık ancak o kayıp gidince devralır. `collapseAt`
         verilir ve devir teslim ölçülen yükseklikte olur.

       · SAYFADA BÜYÜK BAŞLIK YOK (diğer ekranlar): tepedeyken sayfanın adını söyleyen
         BAŞKA hiçbir şey yoktur. Başlığı da gizlersek kullanıcı nerede olduğunu
         bilemez — "temiz" değil, kayıp hissettirir. Burada gizlenmesi gereken tek şey
         ÇUBUĞUN KENDİSİ (zemin + ayraç); yazı durmalı.

      Yani "header yok gibi" demek "başlık yok" demek değil: kutu yok demek.
    */
    if (collapseAt == null) return null;
    const end = Math.max(collapseAt, 1);
    return scrollY.interpolate({
      inputRange: [Math.max(end - 32, 0), end],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  }, [scrollY, collapseAt]);

  /**
   * ÇUBUĞUN ZEMİNİ VE AYRACI — başlıktan ÇOK DAHA ERKEN beliriyor (16pt).
   *
   * Bu ayrım tasarımın can alıcı yeri. iOS'ta büyük başlık gösterilirken nav bar
   * GÖRÜNMEZDİR: zemini yoktur, ayracı yoktur, sayfayla aynı renge erir. Çubuk ancak
   * içerik altına girmeye başlayınca belirir.
   *
   * Önce yalnız başlık canlandırılmıştı, çubuk hep açık bırakılmıştı. Sonuç: ortası boş
   * ama çerçevesi çizili bir araç çubuğu — göz onu "bitmemiş" diye okuyor, çünkü çizili
   * bir kutu içindeki boşluk eksiklik demektir. Zemin de kaybolunca ortada kutu kalmaz:
   * avatar ve durum rozeti sayfanın üstünde serbestçe durur, asıl başlık ise altındaki
   * büyük selamlamadır. Apple'ın ana ekranlarını "temiz" gösteren şey tam olarak budur.
   *
   * 16pt: içerik çubuğun altına girer girmez. Başlığın eşiğini beklemez — arada içerik
   * bulanıklaşmadan kayardı.
   */
  const chromeOpacity = React.useMemo(() => {
    if (!scrollY) return 1;
    return scrollY.interpolate({ inputRange: [0, 16], outputRange: [0, 1], extrapolate: 'clamp' });
  }, [scrollY]);

  /** Marka işaretinin sönmesi — başlığın belirmesinin tersi. */
  const inverseProgress = React.useMemo(
    () => titleProgress?.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) ?? 1,
    [titleProgress],
  );

  /**
   * Geçiş TAMAMLANDI MI — yalnız dokunma hedefi ve ekran okuyucu için.
   *
   * Görsel geçiş yerel sürücüde, JS'e uğramadan akıyor. Ama "hangi öğe dokunulabilir"
   * sorusunun cevabı JS tarafında bilinmek zorunda: sönmüş bir logo tıklanabilir
   * kalırsa görünmeyen bir tuzak olur. Dinleyici her karede çağrılıyor ama durum
   * yalnızca EŞİK GEÇİLİRKEN değişiyor — kaydırma başına iki render, kare başına değil.
   */
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    if (!scrollY || collapseAt == null) return;
    const id = scrollY.addListener(({ value }) => {
      const next = value >= collapseAt;
      setCollapsed((prev) => (prev === next ? prev : next));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, collapseAt]);

  const leftSlot = onBack ? (
    <Touchable
      onPress={() => { haptic.surface(); onBack(); }}
      accessibilityRole="button"
      accessibilityLabel={backLabel ?? (language === 'tr' ? 'Geri' : 'Back')}
      // Görsel glif ICON.lg, dokunma hedefi HIG alt sınırı (44pt).
      style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginLeft: -S.sm }}
    >
      <ArrowLeft size={ICON.lg} color={theme.onSurface} />
    </Touchable>
  ) : left;

  const titleStack = title ? (
    <Animated.View
      style={[
        styles.titleStack,
        titleProgress != null && {
          opacity: titleProgress,
          // Yukarı doğru 6pt kayarak yerleşiyor — büyük başlığın kaydığı YÖNLE aynı.
          // Salt soluklaşma "belirdi" der; kayma "o başlık BURAYA geldi" der. Mesafe
          // küçük tutuldu: chrome'da hareket bilgi taşımalı, gösteri yapmamalı.
          transform: [{ translateY: titleProgress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        },
        // Logo ile aynı yuvayı paylaşırken üstüne bindirilir; ikisi çapraz geçer.
        center != null && styles.centerOverlay,
      ]}
      pointerEvents="none"
      // Çökmemişken bu başlık ekranda GÖRÜNMEZ (opaklık 0) ama erişilebilirlik ağacında
      // durur: ekran okuyucu, sayfadaki büyük selamlamayla birlikte aynı cümleyi iki kez
      // okurdu. Çöktüğünde tersi geçerli — o zaman asıl başlık budur.
      accessibilityElementsHidden={titleProgress != null && !collapsed}
      importantForAccessibility={titleProgress != null && !collapsed ? 'no-hide-descendants' : 'auto'}
    >
      {/* numberOfLines={1} + kırpma: Apple başlığı KÜÇÜLTMEZ, gerekirse "…" ile keser.
          Küçültmek aynı başlığı cihaza göre farklı puntoda çizmek demekti. */}
      <Text
        numberOfLines={1}
        accessibilityRole="header"
        style={[styles.title, { color: theme.onSurface }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={[styles.subtitle, { color: subtitleColor ?? theme.onSurfaceVariant }]}>
          {subtitle}
        </Text>
      ) : null}
    </Animated.View>
  ) : null;

  /*
    ORTA YUVA — `center` ve `title` BİRLİKTE verilebilir: aynı yeri sırayla kullanırlar.
    Ana sayfada tepede marka işareti, kaydırınca selamlama duruyor. Üst üste konup
    opaklıkları ters yönde canlandırılıyor; yer kapmadıkları için birbirlerini itmezler.

    `pointerEvents`: sönmüş logo dokunuşu YUTMAMALI. Opaklığı 0 olan bir düğme
    tıklanabilir kalırsa kullanıcı başlığa dokunduğunda beklemediği bir panel açılır —
    görünmeyen bir tuzak. Bu yüzden eşik geçildiğinde tek bir durum değişimi yapılıyor
    (bkz. collapsed); her karede değil, yalnız geçişte.
  */
  const centerSlot = center != null ? (
    <>
      <Animated.View
        style={[styles.centerOverlay, titleProgress != null && { opacity: inverseProgress }]}
        pointerEvents={collapsed ? 'none' : 'box-none'}
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      >
        {center}
      </Animated.View>
      {titleStack}
    </>
  ) : titleStack;

  return (
    <View
      style={[
        styles.bar,
        // Blur durum çubuğunu DA kaplar (iOS'ta nav bar böyledir): içerik yukarı
        // kayarken durum çubuğunun altında da bulanıklaşır, çıplak kalmaz.
        { paddingTop: insets.top },
      ]}
    >
      {/*
        ZEMİN + AYRAÇ AYRI KATMANDA — sırf opaklığı canlandırılabilsin diye.
        `backgroundColor`/`borderColor` doğrudan canlandırılamaz (yerel sürücü yalnız
        opaklık ve dönüşümü destekler). Ayrı bir katmanın opaklığı ise destekleniyor:
        böylece çubuk UI thread'de belirir, kaydırma sırasında kare düşmez.
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: chromeOpacity,
            backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.surfaceFloating,
            borderBottomWidth: HAIRLINE,
            borderBottomColor: theme.outlineVariant,
          },
        ]}
      >
        {Platform.OS === 'ios' && (
          <AppBlur material="chrome" />
        )}
      </Animated.View>

      {/* Geniş/foldable ekranda içerikle aynı sütuna hizalanır (sayfa gövdesi de MAX_W). */}
      <View style={[styles.column, { maxWidth: Math.min(width, MAX_W) }]}>
        <View style={styles.content}>
          {/*
            Orta yuva ÖNCE çiziliyor — sırası bilinçli. RN'de sonraki kardeş üstte kalır;
            orta öğe iki yanın arasına yazılsaydı sol buton onun ALTINDA, sağ buton
            ÜSTÜNDE kalırdı: aynı başlıkta iki farklı davranış.
            Mutlak konumlu, çünkü akışta yer kapsaydı yanların içeriği büyüdükçe "orta"
            kayardı. box-none: kutu dokunmayı yutmaz, yalnızca içindeki gerçek buton alır.
          */}
          <View style={styles.center} pointerEvents="box-none">
            {centerSlot}
          </View>

          <View style={styles.side}>{leftSlot}</View>
          <View style={[styles.side, styles.sideRight]}>{right}</View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    // Zemin ve ayraç BURADA DEĞİL, canlandırılabilen ayrı katmanda (yukarı bak).
    // Tek ince çizgi — sekme çubuğunun üstündeki ayracın aynısı. Gölge YOK: Apple
    // chrome'a gölge koymaz (koyu temada eski gölge `primary` rengindeydi, yani
    // başlığın etrafında mavi bir parıltı vardı).
  },
  column: {
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // SABİT — içerikten doğmuyor. Bkz. yukarıdaki not.
    height: TOP_BAR_HEIGHT,
    paddingHorizontal: S.md,
  },
  side: {
    width: SIDE_SLOT,
    // Yuva barın tam boyu: içindeki buton dikeyde ortalanır ve dokunma hedefi
    // görsel öğe kadar değil, yuva kadar yüksek olur.
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: S.xs,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  center: {
    position: 'absolute',
    top: 0, bottom: 0,
    // Yan yuvaların İÇİNE girmez. `left/right: 0` idi: mutlak konum padding'i yok
    // sayar, yani orta yuva çubuğun TAMAMINI kaplıyordu. Kısa başlıklarda fark
    // edilmiyordu ama uzun bir başlık avatarın ve durum rozetinin ALTINA uzanıyor,
    // "…" ile kesileceğine onlarla üst üste biniyordu. Sınır artık gerçek orta bölge:
    // iki yanda S.md kenar boşluğu + SIDE_SLOT yuva.
    left: S.md + SIDE_SLOT,
    right: S.md + SIDE_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Logo ve başlık AYNI yeri kullanır: ikisi de mutlak konumlu, üst üste. Akışta yer
  // kapsalardı birbirlerini iterlerdi ve geçiş sırasında ikisi de kayardı.
  centerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: {
    alignItems: 'center',
    justifyContent: 'center',
    // Yan yuvaların arasına sığsın; taşarsa başlık "…" ile kesilir.
    maxWidth: '100%',
    paddingHorizontal: S.sm,
  },
  title: {
    // ÖLÇEKLENMEZ — chrome her cihazda aynı (bkz. TOP_TITLE_SIZE).
    fontSize: TOP_TITLE_SIZE,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2, // SF Pro Text 17pt'de hafif sıkışır
  },
  subtitle: {
    fontSize: TOP_SUBTITLE_SIZE,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: S.xxs,
  },
});
