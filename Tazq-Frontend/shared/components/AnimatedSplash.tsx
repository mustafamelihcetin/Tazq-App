import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing, useColorScheme, useWindowDimensions } from 'react-native';
import { TazqLogo } from './TazqLogo';
import { DottedBackground } from './DottedBackground';
import { haptic } from '@/shared/utils/haptics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useThemeStore } from '@/shared/store/useThemeStore';
import { Colors } from '@/shared/constants/Colors';

/**
 * AÇILIŞ EKRANI.
 *
 * ── ZEMİN: UYGULAMANIN KENDİ ZEMİNİ ───────────────────────────────────────────
 * Açılışta göz hareketi değil RENK SIÇRAMASINI yakalar. Eskiden üç ayrı zemin vardı:
 * Android penceresi siyah, sistem splash'i lacivert, bu ekran ise açık/koyu tema
 * rengi. Yani her açılışta tam ekran bir sıçrama oluyordu.
 *
 * Bir tur bunun tersi denendi — açılışın TAMAMI marka lacivertine boyandı. O da geri
 * alındı: lacivert uygulamanın hiçbir yerinde yok (palet soğuk nötrler + mavi vurgu),
 * tam ekran kaplayınca boğuyor ve içeri girerken başka bir dünyaya geçiliyormuş gibi
 * duruyordu.
 *
 * Şimdi açılış, uygulamanın İLK EKRANINA benziyor: aynı zemin rengi, ortada aynı ikon.
 * Marka rengi kaybolmuyor — tam ekran bir alan yerine ikonun içinde duruyor.
 *
 * ── AÇILIŞ BİR KÖPRÜ: SİSTEMDE BAŞLAR, UYGULAMADA BİTER ──────────────────────
 * Bir tur yalnızca `useColorScheme()` izlendi — yani sistem splash'inin tam karşılığı.
 * Gerekçesi sağlamdı (devir teslim anında sıçrama olmasın) ama SONUCU yanlıştı ve
 * kullanıcı tablette yakaladı: uygulamayı AÇIK temada kullanan biri, sistemi koyuysa
 * koyu bir açılış görüp aydınlık bir uygulamaya giriyordu. Sıçrama yok olmamıştı,
 * yalnızca sona taşınmıştı — hem de daha kötü bir yere, içeri girilen ana.
 *
 * Şimdi iki ucu da tutuyoruz. Zemin SİSTEM renginde başlıyor (sistem splash'inden
 * devralma yine görünmez), sonra ekran daha bomboşken UYGULAMANIN rengine geçiyor.
 * İşaret, çizgi ve doku çizilmeye başladığında renk çoktan oturmuş oluyor; yani
 * görünen hiçbir şey renk değiştirmiyor, yalnız boş zemin devrediyor.
 *
 * Tema tercihi diskten okunuyor: geçiş, okuma BİTTİKTEN sonra başlıyor (bkz.
 * themeReady). Erken başlasaydı yanlış renge geçip geri dönebilirdi.
 *
 * ── SİSTEM SPLASH'İ YALNIZCA RENK ─────────────────────────────────────────────
 * Bir tur, devir teslim görünmesin diye sistem splash'ine UYGULAMA İKONU konuldu ve
 * bu ekran da aynı ikonu aynı yerde çizdi. Geri alındı: kullanıcı zaten o ikona basarak
 * geldi, açılışta ikinci kez göstermek fazlalık.
 *
 * Şimdi sistem splash'i sadece zemin rengi (iOS'ta tamamen boş, Android'de işletim
 * sistemi kendi başlatıcı ikonunu gösteriyor — o davranış bizim elimizde değil).
 * Marka anı burada kuruluyor: kelime işareti belirir, altında ÜÇ NOKTA görünür,
 * noktalar birbirine doğru kayıp tek bir çizgide birleşir. Zemin aynı olduğu için
 * devir teslim yine görünmüyor.
 *
 * ── NEDEN DÜZ BİR ÇİZGİ DEĞİL ─────────────────────────────────────────────────
 * Önce yalnız bir çizgi vardı ve merkezden dışa açılıyordu. Teknik olarak kusursuzdu
 * ama hiçbir şey SÖYLEMİYORDU: aynı çizgiyi herhangi bir uygulamanın açılışına
 * koyabilirdiniz. Bir açılış ekranı kullanıcının uygulamayı her gün gördüğü tek
 * ortak andır; orada harcanan bir saniyenin bir karşılığı olmalı.
 *
 * Üç nokta tek çizgiye dönüşüyor — uygulamanın tek cümlelik vaadi bu: dağınık işler
 * tek bir plana dönüşür. Metin KULLANILMIYOR, bilerek: açılış sırasında yazı tipleri
 * hâlâ yükleniyor (bkz. `ready`), yazı bir an yanlış yüzle görünürdü; ayrıca geometri
 * iki dilde de aynı şeyi anlatıyor, çeviri gerektirmiyor.
 *
 * ── SÜRE ──────────────────────────────────────────────────────────────────────
 * Sektör eşiği 1–1.5 sn; 2 sn üstü "bekliyorum" hissi verir. Toplam 1.85 sn idi,
 * çizgi yerine noktaların birleşmesi konunca ~1.31 sn oldu. Eşiğin içinde kalıyor:
 * eklenen 280ms'in karşılığı, açılışın bir şey ANLATMASI (bkz. aşağıdaki not).
 *
 * ── HAREKETİ AZALT ────────────────────────────────────────────────────────────
 * Tercih açıkken hiçbir şey hareket etmez: işaret olduğu yerde belirir, ekran kısaca
 * sönerek kapanır. Uygulamanın geri kalanı bu tercihi zaten dinliyordu; açılış atlanmıştı.
 */

/** Giriş animasyonunun parçaları (ms) — toplamı süre bütçesini belirler. */
const INTRO_HOLD = 90;        // sistem splash'inden devralınırken kısa bir sükûnet
const INTRO_MARK = 360;       // kelime işaretinin belirmesi
const INTRO_PULSE_UP = 130;   // nabzın yükselişi
const INTRO_PULSE_DOWN = 190; // nabzın oturması
const INTRO_DOTS = 240;       // üç noktanın belirmesi
const INTRO_MERGE = 320;      // noktaların ortada birleşmesi
const INTRO_LINE = 240;       // birleşmeden doğan çizginin açılması
const OUTRO_FADE = 260;       // içeriğe geçiş
/**
 * Zeminin sistem renginden uygulama rengine geçme süresi.
 *
 * İşaret INTRO_HOLD'dan (90ms) sonra belirmeye başlıyor ve kendi içinde 360ms
 * soluyor; bu 240ms onun altında, ekran daha okunacak bir şey taşımazken bitiyor.
 */
const BG_BRIDGE = 240;

/**
 * KELİME İŞARETİNİN GERÇEK GEOMETRİSİ — ölçülmüş, tahmin değil.
 *
 * ── ÖLÇÜLEN SORUN ────────────────────────────────────────────────────────────
 * Logo ile altındaki çizgi arasında kullanıcının bildirdiği fazla boşluk, aslında
 * verilen boşluk DEĞİLDİ: boşluğun çoğu PNG'nin kendi içindeki şeffaf piksellerdi.
 *
 * tazq_text_*.png 282×153 ve mürekkep yalnız 245×82'lik bir kutuda duruyor:
 * üstte %28.1, altta %18.3 şeffaf alan var. Dolayısıyla `marginTop` ne verilirse
 * verilsin, görünen aralık her zaman "verilen değer + resmin alt boşluğu" oluyordu.
 * Ölçülen: ~27pt aralık, 32pt'lik bir kelime işaretinin altında — kelimenin kendi
 * boyunun %85'i kadar. Göz bunu "kopmuş" diye okur.
 *
 * Bir de kutu oranı yanlıştı: bileşen 3.2 varsayıyor, resim 1.843. `contain` bunu
 * yükseklikten sığdırıp yanlara ölü alan bırakıyordu — yani kabın genişliği görünen
 * kelimeyle ilgisizdi ve altındaki çizgi ona göre hesaplanamıyordu.
 *
 * Aşağıdaki oranlar o ölçümün kendisi. Artık her şey MÜREKKEPTEN türüyor: kelimenin
 * ekranda kapladığı genişlik, çizginin genişliği ve aradaki optik boşluk.
 * Görsel dosya değişirse bu üç sayı yeniden ölçülmeli — başka hiçbir yer değişmez.
 */
const LOGO_ASPECT = 282 / 153;   // PNG kutusunun oranı (bileşenin varsaydığı 3.2 DEĞİL)
const LOGO_INK_W = 245 / 282;    // kutunun ne kadarı yatayda mürekkep
const LOGO_INK_H = 82 / 153;     // ... ve dikeyde
const LOGO_INK_BOTTOM = 28 / 153;// mürekkebin ALTINDAKİ şeffaf pay
/**
 * Optik aralık: kelime işaretinin boyunun yarısı.
 *
 * Bir kelime işaretiyle altındaki kural çizgisi arasındaki klasik oran 0.4–0.6×;
 * ölçüldüğünde buradaki 0.85× idi. Yarım, iki uçtan da güvenli.
 */
const LOGO_GAP_RATIO = 0.5;

/**
 * Tema tercihi diskten OKUNDU mu?
 *
 * Okunmadan önce mağaza varsayılanı ('system') döner. O anda köprüyü başlatmak,
 * yanlış renge geçip geri dönmek demek olurdu.
 */
function useThemeHydrated() {
  const [hydrated, setHydrated] = React.useState(() => useThemeStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsub = useThemeStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);
  return hydrated;
}

export const AnimatedSplash = ({
  onFinish,
  onReady,
  ready = true,
}: {
  onFinish: () => void;
  onReady: () => void;
  /**
   * Uygulama gerçekten hazır mı (font + varlık yüklendi mi)?
   *
   * NEDEN GEREKLİ: animasyon SABİT süreliydi ve sonunda ekranı saydama çekiyordu.
   * Yavaş bir açılışta (soğuk başlatma, büyük paket) animasyon biter ama uygulama
   * hazır olmaz → kullanıcı BOŞ ekrana bakar; splash orada durur ama görünmezdir.
   */
  ready?: boolean;
}) => {
  const systemScheme = useColorScheme();
  const { colorScheme } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const themeReady = useThemeHydrated();

  /** Devralınan renk: sistem splash'i ne çizdiyse o. */
  const systemBg = systemScheme === 'dark' ? Colors.dark.background : Colors.light.background;
  /** Varılan renk: uygulamanın kendi teması (tercih + sistem). */
  const isDark = colorScheme === 'dark';
  const bg = isDark ? Colors.dark.background : Colors.light.background;
  const lineColor = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.10)';
  /*
    Nokta ÇİZGİDEN KOYU. Aynı tonu paylaşsalardı noktalar görünmezdi: bir çizgi uzun
    ve sürekli, üç nokta ise toplam birkaç piksel — aynı opaklık gözde aynı ağırlığı
    vermiyor. Bu bir tasarım tercihi değil, alan farkının telafisi.
  */
  const dotColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.38)';
  /** İki uç aynıysa geçişe hiç gerek yok — çoğu kullanıcıda durum bu. */
  const needsBridge = bg !== systemBg;

  /*
    ÖLÇÜ EKRAN GENİŞLİĞİNDEN TÜRER → küçük telefondan tablete %100 responsive.
    Tek serbest sayı `markWidth`: kelime işaretinin ekranda GÖRÜNEN genişliği.
    Resim kutusu ondan geri hesaplanıyor, aralık ve çizgi de ondan.
  */
  const markWidth = Math.min(width * 0.24, 110);
  /* Kabın oranı resmin oranına EŞİT → `contain` artık hiçbir yönde ölü alan bırakmıyor. */
  const boxWidth = markWidth / LOGO_INK_W;
  const boxHeight = boxWidth / LOGO_ASPECT;
  /* Çizgi tam kelimenin genişliği: iki kenar da aynı hizada biter. */
  const lineWidth = Math.round(markWidth);
  /*
    Verilecek boşluk = istenen optik aralık EKSİ resmin kendi alt payı. Bu çıkarma
    olmadan aralık her zaman resmin görünmez boşluğu kadar fazla çıkıyor.
  */
  const inkHeight = boxHeight * LOGO_INK_H;
  const markGap = Math.max(0, Math.round(inkHeight * LOGO_GAP_RATIO - boxHeight * LOGO_INK_BOTTOM));
  /*
    Noktanın çapı ve yayılımı ÇİZGİDEN türer, elle yazılmaz: markWidth ekran
    genişliğinden geldiği için küçük telefondan tablete kadar oran korunur.
    Nokta çizginin kalınlığından kalın olmalı (saç teli bir nokta görünmez),
    ama iri de olmamalı — 3pt göz için "işaret", 6pt "buton" okunur.
  */
  const dotSize = Math.max(3, Math.round(lineWidth * 0.035));
  const dotSpread = lineWidth / 2;

  const [introDone, setIntroDone] = React.useState(false);

  // Hareketi Azalt açıkken her şey son hâliyle başlar.
  const markOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const markY = useRef(new Animated.Value(reduceMotion ? 0 : 8)).current;
  const markScale = useRef(new Animated.Value(1)).current;
  const lineScale = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  /*
    Noktaların üç hâli tek değerde toplanıyor:
      dotSpread  1 → dağınık, 0 → ortada birleşmiş
      dotOpacity 0 → yok, 1 → görünür (birleşme bitince çizgiye devrederken 0'a döner)
    Hareketi Azalt açıkken noktalar hiç çizilmez; çizgi son hâliyle durur.
  */
  const dotsSpread = useRef(new Animated.Value(1)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  /*
    Zemin geçişi AYRI bir katmanda ve JS sürücüsüyle.

    Renk yerel sürücüde canlandırılamaz; kabın kendisine verilseydi aynı View üstünde
    biri JS biri yerel iki animasyon olur ve RN bunu reddeder. Bu yüzden uygulamanın
    rengi, sistem renginin ÜSTÜNDE açılan ayrı bir katman: kap ve opaklığı yerel
    sürücüde kalmaya devam ediyor.
  */
  const bridgeOpacity = useRef(new Animated.Value(needsBridge ? 0 : 1)).current;

  // Zemin köprüsü: tema diskten okunur okunmaz, ekran hâlâ boşken.
  useEffect(() => {
    if (!needsBridge || !themeReady) return;
    Animated.timing(bridgeOpacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : BG_BRIDGE,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [needsBridge, themeReady, reduceMotion]);

  /*
    Giriş, tema diskten OKUNANA kadar bekler: işaret yanlış zemine düşmesin. Okuma
    tipik olarak 40ms'nin altında, yani INTRO_HOLD'un içinde erir; yavaş bir açılışta
    sükûnet anı biraz uzar — kullanıcı boş bir zemin görür, yanlış renkte bir işaret
    değil.
  */
  useEffect(() => {
    if (!themeReady) return;
    onReady();

    if (reduceMotion) {
      // Hareket yok — ama uygulamanın hazır olmasını beklemek YİNE gerekiyor,
      // yoksa boş ekran görünür.
      setIntroDone(true);
      return;
    }

    /*
      TEK DOKUNUŞ — nabız atarken, tam o anda.

      Titreşim iki vuruşluydu; açılışta iki kez titremek marka anından çok bildirim
      gibi okunuyordu. Tek dokunuş kalıyor ama NABZA denk geliyor: kullanıcı hareketi
      görürken aynı anda hissediyor — ikisi tek olay gibi okunuyor.
      Kullanıcının titreşim tercihine saygılı (bkz. haptics.enabled).
    */
    const hapticTimer = setTimeout(() => haptic.select(), INTRO_HOLD + INTRO_MARK);

    Animated.sequence([
      // 1. Sistem splash'inden devralınan sakin an — ikon zaten ekranda, kıpırdamıyor.
      Animated.delay(INTRO_HOLD),

      // 2. Kelime işareti ikonun altında belirir (yukarı doğru 8pt yerleşerek).
      Animated.parallel([
        Animated.timing(markOpacity, {
          toValue: 1,
          duration: INTRO_MARK,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(markY, {
          toValue: 0,
          duration: INTRO_MARK,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      /*
        3. KALP ATIŞI — işaret otururken mikroskopik bir nabız.

        Bir tur kaldırılmıştı (süreyi kısaltmak için). Geri alındı: onsuz açılış "duran
        bir yazı" oluyor; marka anını canlı kılan tam olarak bu 320ms. Ölçü bilinçli
        olarak küçük — %3.5 büyüme göz tarafından "nefes" olarak okunur, "animasyon"
        olarak değil.
      */
      Animated.sequence([
        Animated.timing(markScale, {
          toValue: 1.035,
          duration: INTRO_PULSE_UP,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(markScale, {
          toValue: 1,
          duration: INTRO_PULSE_DOWN,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 4. ÜÇ NOKTA belirir — henüz dağınık.
      Animated.timing(dotsOpacity, {
        toValue: 1,
        duration: INTRO_DOTS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      /*
        5. BİRLEŞME. Noktalar ortaya doğru kayarken çizgi aynı anda açılıyor ve
        noktalar sönüyor: üçü tek harekette devrediliyor. Ayrı ayrı yapılsaydı
        (önce sön, sonra çiz) araya boş bir kare girer ve "birleşme" okunmazdı.
        Yay fiziği değil zamanlama: bir yayın sekmesi "toplanma"yı gevşetirdi.
      */
      Animated.parallel([
        Animated.timing(dotsSpread, {
          toValue: 0,
          duration: INTRO_MERGE,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(INTRO_MERGE - INTRO_LINE),
          Animated.parallel([
            Animated.timing(dotsOpacity, {
              toValue: 0,
              duration: INTRO_LINE,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(lineScale, {
              toValue: 1,
              duration: INTRO_LINE,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
    ]).start(() => setIntroDone(true));

    return () => clearTimeout(hapticTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, themeReady]);

  // 5. Kaybolma — giriş bitti VE uygulama hazır olduğunda. İkisi de şart:
  //    erken kaybolmak boş ekran, geç kaybolmak gereksiz bekleme demek.
  useEffect(() => {
    if (!introDone || !ready) return;
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: reduceMotion ? 120 : OUTRO_FADE,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onFinish());
  }, [introDone, ready, reduceMotion]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: systemBg, opacity: screenOpacity }]}>
      {/* Uygulamanın rengi: sistem renginin üstünde açılır (bkz. yukarıdaki köprü notu). */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: bridgeOpacity }]}
      />

      {/*
        UYGULAMANIN KENDİ ZEMİN DOKUSU — ana ekranda da aynısı var (bkz. app/index.tsx).
        Açılış böylece "ayrı bir ekran" değil, uygulamanın kendi tuvalinin ilk hâli
        oluyor: düz bir renk alanı yerine, içeri girince devam eden bir yüzey.
        Değerler ana ekranla BİREBİR aynı — ayrışırsa geçiş yine görünür olur.
      */}
      <DottedBackground
        color={isDark ? Colors.dark.onBackground : Colors.light.onBackground}
        opacity={isDark ? 0.05 : 0.08}
        size={24}
        dotSize={1}
      />

      <Animated.View
        style={[
          styles.markSlot,
          { opacity: markOpacity, transform: [{ translateY: markY }, { scale: markScale }] },
        ]}
      >
        {/*
          Varyant UYGULAMANIN temasından — çünkü işaret çizilmeye başladığında zemin
          çoktan oraya geçmiş oluyor (bkz. köprü). Kural değişmedi, yalnız hangi
          "zemin"den bahsettiğimiz değişti: mürekkep hep ALTINDAKİ renge göre seçilir,
          yoksa açık zemine beyaz yazı düşer ve işaret kaybolur.
        */}
        <TazqLogo height={boxHeight} width={boxWidth} variant={isDark ? 'white' : 'dark'} />
        {/*
          Çizgi ve noktalar AYNI şeridi paylaşıyor: nokta katmanı çizginin üstüne
          mutlak konumlu biniyor, ikisi de aynı genişlikten türüyor. Böylece
          birleşme tam çizginin doğduğu yerde oluyor; iki ayrı kutu olsaydı
          yükseklik farkı yüzünden noktalar çizginin üstüne değil YANINA düşerdi.
        */}
        <Animated.View style={[styles.line, { width: lineWidth, marginTop: markGap }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: lineColor, transform: [{ scaleX: lineScale }] },
            ]}
          />
          {!reduceMotion && [-1, 0, 1].map((slot) => (
            <Animated.View
              key={slot}
              style={{
                position: 'absolute',
                // Dikey merkez: nokta çizgiden kalın, farkın yarısı kadar yukarı.
                top: (StyleSheet.hairlineWidth - dotSize) / 2,
                left: lineWidth / 2 - dotSize / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: dotColor,
                opacity: dotsOpacity,
                transform: [{
                  translateX: dotsSpread.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, slot * dotSpread],
                  }),
                }],
              }}
            />
          ))}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  markSlot: {
    alignItems: 'center',
  },
  line: {
    height: StyleSheet.hairlineWidth,
    // `overflow` YOK: noktalar birleşmeden önce şeridin uçlarında ve dikeyde
    // taşıyor; kırpılsalardı "dağınıklık" hiç görünmezdi.
  },
});
