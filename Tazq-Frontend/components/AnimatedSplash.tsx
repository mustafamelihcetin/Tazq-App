import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, useColorScheme, useWindowDimensions } from 'react-native';
import { TazqLogo } from './TazqLogo';

const DARK_BG = '#0A0A0A';
const LIGHT_BG = '#F8F8F7';
const DARK_LINE = 'rgba(255,255,255,0.18)';
const LIGHT_LINE = 'rgba(0,0,0,0.12)';
const LINE_WIDTH = 72;

export const AnimatedSplash = ({
  onFinish,
  onReady,
}: {
  onFinish: () => void;
  onReady: () => void;
}) => {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const { width } = useWindowDimensions();
  const logoWidth = width * 0.48;
  const logoHeight = logoWidth / 3.2;

  const bg = isDark ? DARK_BG : LIGHT_BG;
  const lineColor = isDark ? DARK_LINE : LIGHT_LINE;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(14)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    onReady();

    Animated.sequence([
      // Logo fades in + rises (0–700ms)
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

      // Hold briefly
      Animated.delay(200),

      // Line grows from center outward (900–1300ms)
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

      // Hold
      Animated.delay(700),

      // Fade out everything
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 600,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.container, { backgroundColor: bg, opacity: screenOpacity }]}>
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ translateY: logoY }],
          alignItems: 'center',
        }}
      >
        <TazqLogo height={logoHeight} width={logoWidth} />

        <Animated.View
          style={[
            styles.line,
            {
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
    marginTop: 20,
    width: LINE_WIDTH,
    height: StyleSheet.hairlineWidth,
  },
});
