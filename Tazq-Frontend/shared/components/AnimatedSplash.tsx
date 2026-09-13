import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing, useColorScheme, useWindowDimensions } from 'react-native';
import { TazqLogo } from './TazqLogo';
import { DottedBackground } from './DottedBackground';
import { haptic } from '@/shared/utils/haptics';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
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
 * ── SİSTEM GÖRÜNÜMÜNÜ İZLER, UYGULAMA TERCİHİNİ DEĞİL ────────────────────────
 * Zemin `useColorScheme()`den geliyor; yani sistem splash'inin (işletim sistemi
 * görünümüne göre açık/koyu) TAM KARŞILIĞI. Uygulamanın kendi tema tercihi diskten
 * geç okunuyor: onu izleseydik, koyu temayı elle seçmiş bir kullanıcıda sistem
 * splash'i açık, bizimki koyu olur ve tam devir teslim anında sıçrama görünürdü.
 * Kullanıcının tercihi, içerik belirirken zaten devreye giriyor.
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
  const scheme = useColorScheme();
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();

  const isDark = scheme === 'dark';
  const bg = isDark ? Colors.dark.background : Colors.light.background;
  const lineColor = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.10)';

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

  useEffect(() => {
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
  }, [reduceMotion]);

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
    <Animated.View style={[styles.container, { backgroundColor: bg, opacity: screenOpacity }]}>
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
          Varyant SİSTEM görünümünden: zemin de oradan geliyor. Uygulamanın tema
          tercihine bakan varsayılan davranış burada YANLIŞ olurdu — koyu temayı elle
          seçmiş bir kullanıcıda açık zemin üstüne beyaz yazı düşer, işaret kaybolurdu.
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
