import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

interface Options {
  onDismiss: () => void;
  threshold?: number;
  velocityThreshold?: number;
}

export function useSwipeToDismiss({ onDismiss, threshold = 80, velocityThreshold = 0.5 }: Options) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 4 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > threshold || gs.vy > velocityThreshold) {
          Animated.timing(translateY, {
            toValue: 600,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onDismiss();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
      onPanResponderTerminate: (_, gs) => {
        if (gs.dy > threshold) {
          translateY.setValue(0);
          onDismiss();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const animatedStyle = { transform: [{ translateY }] };

  const resetPosition = () => translateY.setValue(0);

  return { panResponder, animatedStyle, resetPosition };
}
