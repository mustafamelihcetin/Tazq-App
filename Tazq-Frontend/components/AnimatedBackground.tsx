import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  interpolate
} from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';

const Blob = ({ color, size, duration, delay = 0 }: { color: string, size: number, duration: number, delay?: number }) => {
  const { width, height } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    tx.value = withRepeat(
      withTiming(Math.random() * width * 0.5, { 
        duration, 
        easing: Easing.inOut(Easing.sin) 
      }), 
      -1, 
      true
    );
    ty.value = withRepeat(
      withTiming(Math.random() * height * 0.5, { 
        duration: duration * 1.2, 
        easing: Easing.inOut(Easing.sin) 
      }), 
      -1, 
      true
    );
    scale.value = withRepeat(
      withTiming(1.2, { duration: duration * 0.8 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value }
    ]
  }));

  return (
    <Animated.View 
      style={[
        styles.blob, 
        { 
          backgroundColor: color, 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          opacity: 0.15,
          left: Math.random() * width * 0.5,
          top: Math.random() * height * 0.5,
        },
        animatedStyle
      ]} 
    />
  );
};

export const AnimatedBackground = () => {
  const { theme, isDark } = useAppTheme();
  const { width, height } = useWindowDimensions();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Blob color={theme.primary} size={width * 0.8} duration={15000} />
      <Blob color={theme.secondary} size={width * 0.9} duration={20000} />
      <Blob color={theme.tertiary} size={width * 0.7} duration={18000} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    filter: 'blur(80px)', // Note: standard blur works on iOS/Web, Android might need expo-blur if filter isn't supported
  }
});
