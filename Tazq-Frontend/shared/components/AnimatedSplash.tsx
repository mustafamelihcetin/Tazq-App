import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing, useColorScheme, useWindowDimensions } from 'react-native';
import { TazqLogo } from './TazqLogo';
import { DottedBackground } from './DottedBackground';
import { haptic } from '@/shared/utils/haptics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useThemeStore } from '@/shared/store/useThemeStore';
import { Colors } from '@/shared/constants/Colors';
import { S } from '@/shared/constants/tokens';

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
 * Marka anı burada, TEK bir şeyle kuruluyor: kelime işareti belirir, altındaki ince
 * çizgi açılır. Zemin aynı olduğu için devir teslim yine görünmüyor.
 *
 * ── SÜRE ──────────────────────────────────────────────────────────────────────
 * Sektör eşiği 1–1.5 sn; 2 sn üstü "bekliyorum" hissi verir. Toplam 1.85 sn idi,
 * şimdi ~1.1 sn.
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
const INTRO_LINE = 260;       // ince çizginin açılması
const OUTRO_FADE = 260;       // içeriğe geçiş
/**
 * Zeminin sistem renginden uygulama rengine geçme süresi.
 *
 * İşaret INTRO_HOLD'dan (90ms) sonra belirmeye başlıyor ve kendi içinde 360ms
 * soluyor; bu 240ms onun altında, ekran daha okunacak bir şey taşımazken bitiyor.
 */
const BG_BRIDGE = 240;

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
  /** İki uç aynıysa geçişe hiç gerek yok — çoğu kullanıcıda durum bu. */
  const needsBridge = bg !== systemBg;

  // Ölçü ekran genişliğinden türer → küçük telefondan tablete %100 responsive.
  const markWidth = Math.min(width * 0.48, 220);
  const markHeight = markWidth / 3.2;
  const lineWidth = Math.round(markWidth * 0.5);

  const [introDone, setIntroDone] = React.useState(false);

  // Hareketi Azalt açıkken her şey son hâliyle başlar.
  const markOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const markY = useRef(new Animated.Value(reduceMotion ? 0 : 8)).current;
  const markScale = useRef(new Animated.Value(1)).current;
  const lineScale = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
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

      // 4. İnce çizgi merkezden dışa açılır — marka anının noktası.
      Animated.timing(lineScale, {
        toValue: 1,
        duration: INTRO_LINE,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
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
        <TazqLogo height={markHeight} width={markWidth} variant={isDark ? 'white' : 'dark'} />
        <Animated.View
          style={[
            styles.line,
            { width: lineWidth, backgroundColor: lineColor, transform: [{ scaleX: lineScale }] },
          ]}
        />
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
    marginTop: S.sm,
    height: StyleSheet.hairlineWidth,
  },
});
