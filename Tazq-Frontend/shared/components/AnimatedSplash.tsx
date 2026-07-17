import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { TazqLogo } from './TazqLogo';

const DARK_BG = '#0A0A0A';
const LIGHT_BG = '#F8F8F7';
const DARK_LINE = 'rgba(255,255,255,0.18)';
const LIGHT_LINE = 'rgba(0,0,0,0.12)';

export const AnimatedSplash = ({
  onFinish,
  onReady,
  isDark = false,
}: {
  onFinish: () => void;
  onReady: () => void;
  isDark?: boolean;
}) => {
  const { width } = useWindowDimensions();
  // Ölçüler ekran genişliğinden türetilir → %100 responsive (küçük telefondan tablete).
  // Logo büyük ekranda sınırlanır (pikselleşmeyi önler); ince çizgi logoya oranlı.
  const logoWidth = Math.min(width * 0.48, 220);
  const logoHeight = logoWidth / 3.2;
  const lineWidth = Math.round(logoWidth * 0.42);

  const bg = isDark ? DARK_BG : LIGHT_BG;
  const lineColor = isDark ? DARK_LINE : LIGHT_LINE;

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
      Haptics.selectionAsync().catch(() => {});
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 130);
    }, 650);

    Animated.sequence([
      // 1. Logo yükselerek belirir (0–700ms)
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: 0,
          duration: 700,
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

      // 4. Bekleme
      Animated.delay(600),

      // 5. Her şey yumuşakça kaybolur
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());

    return () => clearTimeout(hapticTimer);
  }, []);

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
