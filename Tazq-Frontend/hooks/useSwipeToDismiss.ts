import { useRef, useCallback } from 'react';
import { Animated, PanResponder } from 'react-native';

interface Options {
  onDismiss: () => void;
  threshold?: number;
  velocityThreshold?: number;
}

export function useSwipeToDismiss({ onDismiss, threshold = 80, velocityThreshold = 0.5 }: Options) {
  const translateY = useRef(new Animated.Value(900)).current;
  // opacity=0 keeps the sheet invisible until slideIn() is called,
  // preventing any native-thread race condition flash on open.
  const opacity = useRef(new Animated.Value(0)).current;

  // Call synchronously before setVisible(true).
  // Sets sheet off-screen AND invisible so no frame can show it prematurely.
  const prepare = useCallback(() => {
    translateY.setValue(900);
    opacity.setValue(0);
  }, [translateY, opacity]);

  // Call in Modal's onShow — makes sheet visible then slides it in.
  const slideIn = useCallback(() => {
    opacity.setValue(1);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [translateY, opacity]);

  const panResponder = useRef(
    PanResponder.create({
      // Only claim on the drag handle touch itself (not scroll content)
      onStartShouldSetPanResponder: () => true,
      // Only claim movement when clearly dragging downward — lets child ScrollViews scroll freely
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && gs.dy > Math.abs(gs.dx) * 1.5,
      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > threshold || gs.vy > velocityThreshold) {
          Animated.timing(translateY, {
            toValue: 900,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            onDismiss();
          });
        } else {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: (_, gs) => {
        if (gs.dy > threshold) {
          Animated.timing(translateY, {
            toValue: 900,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            onDismiss();
          });
        } else {
          Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
      },
      // false = don't block native scroll responders (ScrollView inside sheet can scroll)
      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  const animatedStyle = { transform: [{ translateY }], opacity };
  const resetPosition = () => translateY.setValue(0);

  return { panResponder, animatedStyle, resetPosition, slideIn, prepare };
}
