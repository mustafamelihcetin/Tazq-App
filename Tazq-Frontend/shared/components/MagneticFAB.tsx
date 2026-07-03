import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  useWindowDimensions,
  StyleSheet,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { TourTarget } from '@/shared/components/TourContext';

interface MagneticFABProps {
  onPress: () => void;
  storageKey: string;
  isDark: boolean;
  theme: any;
  children: React.ReactNode;
  style?: any;
  buttonSize?: number;
  borderRadius?: number;
  tourId?: string;
}

export const MagneticFAB: React.FC<MagneticFABProps> = ({
  onPress,
  storageKey,
  isDark,
  theme,
  children,
  style,
  buttonSize = 64,
  borderRadius,
  tourId,
}) => {
  const finalBorderRadius = borderRadius !== undefined ? borderRadius : buttonSize / 2;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [loaded, setLoaded] = useState(false);
  const isDragging = useRef(false);

  // Load persisted position on mount
  useEffect(() => {
    const loadPosition = async () => {
      try {
        const storedX = await AsyncStorage.getItem(`${storageKey}_x`);
        const storedY = await AsyncStorage.getItem(`${storageKey}_y`);

        const defaultX = screenWidth - buttonSize - 16;
        const defaultY = screenHeight - insets.bottom - 150;

        const initialX = storedX ? parseFloat(storedX) : defaultX;
        const initialY = storedY ? parseFloat(storedY) : defaultY;

        pan.setValue({ x: initialX, y: initialY });
      } catch (err) {
        // Fallback silently
      } finally {
        setLoaded(true);
      }
    };
    loadPosition();
  }, [screenWidth, screenHeight, insets, storageKey, buttonSize]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only take control if the user drags beyond a small threshold
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.extractOffset();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Premium touch state: slightly scale up and add depth
        Animated.spring(scale, {
          toValue: 1.08,
          useNativeDriver: true,
          tension: 100,
          friction: 6,
        }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        isDragging.current = false;
        pan.flattenOffset();

        // Scale back to normal
        Animated.spring(scale, {
          toValue: 1.0,
          useNativeDriver: true,
          tension: 100,
          friction: 6,
        }).start();

        // Calculate click vs drag
        const dragDistance = Math.sqrt(
          gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy
        );

        if (dragDistance < 6) {
          // It was a tap/click!
          onPress();
          return;
        }

        // Snap mechanics
        const margin = 16;
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        // Snapping X to closest side edge
        const snapLeft = margin;
        const snapRight = screenWidth - buttonSize - margin;
        const snapToRight = currentX > (screenWidth - buttonSize) / 2;
        const targetX = snapToRight ? snapRight : snapLeft;

        // Clamping Y to safe zone between top and bottom nav bars
        const safeMinY = insets.top + 70;
        const safeMaxY = screenHeight - insets.bottom - 160;
        const targetY = Math.max(safeMinY, Math.min(safeMaxY, currentY));

        // Spring animation to settled position
        Animated.parallel([
          Animated.spring(pan.x, {
            toValue: targetX,
            useNativeDriver: true,
            damping: 15,
            stiffness: 120,
          }),
          Animated.spring(pan.y, {
            toValue: targetY,
            useNativeDriver: true,
            damping: 15,
            stiffness: 120,
          }),
        ]).start(async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          // Persist the snapped position coordinates
          try {
            await AsyncStorage.setItem(`${storageKey}_x`, String(targetX));
            await AsyncStorage.setItem(`${storageKey}_y`, String(targetY));
          } catch (e) {
            // Ignore storage errors
          }
        });
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        pan.flattenOffset();
        Animated.spring(scale, {
          toValue: 1.0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  if (!loaded) return null;

  const innerContent = (
    <View style={[StyleSheet.absoluteFill, { borderRadius: finalBorderRadius, alignItems: 'center', justifyContent: 'center' }]}>
      {children}
    </View>
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: finalBorderRadius,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale: scale },
          ],
        },
        style,
      ]}
    >
      {tourId ? (
        <TourTarget id={tourId} style={StyleSheet.absoluteFill}>
          {innerContent}
        </TourTarget>
      ) : (
        innerContent
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 200,
    elevation: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
