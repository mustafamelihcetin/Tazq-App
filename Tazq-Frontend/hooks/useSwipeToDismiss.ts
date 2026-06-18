import { useRef, useCallback } from 'react';
import { Animated, PanResponder } from 'react-native';

interface Options {
  onDismiss: () => void;
  threshold?: number;
  velocityThreshold?: number;
}

export function useSwipeToDismiss({ onDismiss, threshold = 80, velocityThreshold = 0.5 }: Options) {
  const translateY = useRef(new Animated.Value(0)).current;

  // Call on Modal's onShow — slides the sheet up from off-screen
  const slideIn = useCallback(() => {
    translateY.setValue(500);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 180,
    }).start();
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      // Claim the gesture immediately on touch-start so Reanimated/MotiView can't steal it
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Stop any in-flight spring before the user drags
        translateY.stopAnimation();
      },
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
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  const animatedStyle = { transform: [{ translateY }] };
  const resetPosition = () => translateY.setValue(0);

  return { panResponder, animatedStyle, resetPosition, slideIn };
}
