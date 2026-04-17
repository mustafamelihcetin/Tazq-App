import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Canvas,
  BlurMask,
  Circle,
  useComputedValue,
  useValue,
  runSpring,
  Skia,
  Group,
} from '@shopify/react-native-skia';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  interpolate
} from 'react-native-reanimated';

const AnimatedCircle = ({ color, size, startX, startY }) => {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0.1);

  useEffect(() => {
    tx.value = withRepeat(
      withTiming(Math.random() * 100 - 50, { 
        duration: 15000 + Math.random() * 10000, 
        easing: Easing.inOut(Easing.cubic) 
      }), 
      -1, 
      true
    );
    ty.value = withRepeat(
      withTiming(Math.random() * 100 - 50, { 
        duration: 18000 + Math.random() * 8000, 
        easing: Easing.inOut(Easing.cubic) 
      }), 
      -1, 
      true
    );
    opacity.value = withRepeat(
      withTiming(0.2, { 
        duration: 12000, 
        easing: Easing.inOut(Easing.sin) 
      }), 
      -1, 
      true
    );
  }, []);

  return (
    <Circle 
      cx={startX} 
      cy={startY} 
      r={size} 
      color={color} 
      opacity={0.3}
    >
      <BlurMask blur={80} style="normal" />
    </Circle>
  );
};

export const AnimatedBackground = () => {
  const { width, height } = useWindowDimensions();

  return (
    <Canvas style={{ position: 'absolute', width, height }}>
      <Group>
        <AnimatedCircle 
          color="#4F46E5" 
          size={width * 0.4} 
          startX={width * 0.2} 
          startY={height * 0.2} 
        />
        <AnimatedCircle 
          color="#0EA5E9" 
          size={width * 0.5} 
          startX={width * 0.8} 
          startY={height * 0.8} 
        />
        <AnimatedCircle 
          color="#8B5CF6" 
          size={width * 0.3} 
          startX={width * 0.1} 
          startY={height * 0.7} 
        />
      </Group>
    </Canvas>
  );
};
