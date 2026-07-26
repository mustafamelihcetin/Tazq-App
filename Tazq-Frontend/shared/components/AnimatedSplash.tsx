import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import { TazqLogo } from './TazqLogo';
import { haptic } from '@/shared/utils/haptics';
import { Colors } from '@/shared/constants/Colors';

// Zemin PALETTEN. Elle yazılıyordu ve uygulamanınkiyle AYNI DEĞİLDİ
// (açık: #F8F8F7 vs #F4F4F5 → 4,4,2 RGB fark). Splash kaybolurken zemin
// değişiyor, tüm ekranı kaplayan bir sıçrama olarak görünüyordu.
const DARK_BG = Colors.dark.background;
const LIGHT_BG = Colors.light.background;
const DARK_LINE = 'rgba(255,255,255,0.18)';
const LIGHT_LINE = 'rgba(0,0,0,0.12)';

export const AnimatedSplash = ({
  onFinish,
  onReady,
  isDark = false,
  ready = true,
}: {
  onFinish: () => void;
  onReady: () => void;
  isDark?: boolean;
  /**
   * Uygulama gerçekten hazır mı (font + varlık yüklendi mi)?
   *
   * NEDEN GEREKLİ: animasyon SABİT 2.6 sn sürüyordu ve sonunda ekranı saydama
   * çekiyordu. Yavaş bir açılışta (soğuk başlatma, büyük paket) animasyon biter
   * ama uygulama hazır olmaz → kullanıcı BOŞ ekrana bakar; splash orada durur
   * ama görünmezdir. Artık giriş animasyonu bittikten sonra hazır olmayı BEKLER,
   * ancak ondan sonra kaybolur.
   */
  ready?: boolean;
}) => {
  const { width } = useWindowDimensions();
  // Ölçüler ekran genişliğinden türetilir → %100 responsive (küçük telefondan tablete).
  // Logo büyük ekranda sınırlanır (pikselleşmeyi önler); ince çizgi logoya oranlı.
  const logoWidth = Math.min(width * 0.48, 220);
  const logoHeight = logoWidth / 3.2;
  const lineWidth = Math.round(logoWidth * 0.42);

  const bg = isDark ? DARK_BG : LIGHT_BG;
  const lineColor = isDark ? DARK_LINE : LIGHT_LINE;

  // Giriş animasyonu bitti mi? Kaybolma bundan SONRA ve `ready` olunca başlar.
  const [introDone, setIntroDone] = React.useState(false);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(14)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    onReady();

    // Avuç İçinde Atan Kalp (Heartbeat Haptic Pulse) — logo otururken minik çift titreşim
    const hapticTimer = setTimeout(() => {
      haptic.select();
      setTimeout(() => {
        haptic.surface();
      }, 130);
    }, 650);

    Animated.sequence([
      // 1. Logo yükselerek belirir
      //    700ms idi. Toplam 2.6 sn ediyordu — açılış ekranında sektör eşiği
      //    1–1.5 sn, 2 sn üstü "bekliyorum" hissi verir. Apple splash'e animasyon
      //    koymaz; marka anı korunuyor ama kısaltıldı.
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // 2. Kalp atışı — haptic ile senkron mikroskopik nabız (marka "canlanır")
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.035,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 240,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 3. İnce çizgi merkezden dışa doğru açılır
      Animated.parallel([
        Animated.timing(lineOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(lineScale, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 4. Kısa nefes
      Animated.delay(220),

    ]).start(() => setIntroDone(true));

    return () => clearTimeout(hapticTimer);
  }, []);

  // 5. Kaybolma — giriş bitti VE uygulama hazır olduğunda. İkisi de şart:
  //    erken kaybolmak boş ekran, geç kaybolmak gereksiz bekleme demek.
  useEffect(() => {
    if (!introDone || !ready) return;
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 380,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onFinish());
  }, [introDone, ready]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: bg, opacity: screenOpacity }]}>
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ translateY: logoY }, { scale: logoScale }],
          alignItems: 'center',
        }}
      >
        <TazqLogo height={logoHeight} width={logoWidth} />

        <Animated.View
          style={[
            styles.line,
            {
              width: lineWidth,
              backgroundColor: lineColor,
              opacity: lineOpacity,
              transform: [{ scaleX: lineScale }],
            },
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
  line: {
    marginTop: -2,
    height: StyleSheet.hairlineWidth,
  },
});
