import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import * as HapticsOriginal from 'expo-haptics';
const Haptics = {
  notificationAsync: (type: any) => HapticsOriginal.notificationAsync(type).catch(() => {}),
  impactAsync: (style: any) => HapticsOriginal.impactAsync(style).catch(() => {}),
  selectionAsync: () => HapticsOriginal.selectionAsync().catch(() => {}),
  NotificationFeedbackType: HapticsOriginal.NotificationFeedbackType,
  ImpactFeedbackStyle: HapticsOriginal.ImpactFeedbackStyle,
};
import { ICON, S, R } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
  showPeekHint?: boolean;
}

// Worklet-safe: called via runOnJS so haptics fires from JS thread
function triggerLightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export const SwipeableItem = ({ children, onDelete, disabled, showPeekHint }: Props) => {
  const { language } = useLanguageStore();
  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);
  const contextX = useSharedValue(0);

  // One-time educational peek on first render
  useEffect(() => {
    if (!showPeekHint) return;
    const timer = setTimeout(() => {
      translateX.value = withSequence(
        withTiming(-44, { duration: 380 }),
        withDelay(500, withSpring(0, { damping: 18, stiffness: 120 }))
      );
      deleteOpacity.value = withSequence(
        withTiming(1, { duration: 380 }),
        withDelay(500, withTiming(0, { duration: 300 }))
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [showPeekHint]);

  // Pan gesture runs entirely on UI thread — no JS thread involvement during drag
  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    // Activate after 10px horizontal; fail (→ scroll wins) if vertical moves first
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onBegin(() => {
      contextX.value = translateX.value;
    })
    .onUpdate((e) => {
      // Only allow leftward swipe
      const newX = Math.min(0, contextX.value + e.translationX);
      translateX.value = newX;
      deleteOpacity.value = Math.min(Math.abs(newX) / 80, 1);
    })
    .onEnd((e) => {
      const total = contextX.value + e.translationX;
      // velocityX in gesture handler is px/s; -500 px/s ≈ the original -0.5 px/ms threshold
      const isFastSwipe = e.velocityX < -500;
      const isOpened = total < -40;

      if (isFastSwipe || isOpened) {
        translateX.value = withSpring(-80, { damping: 15, stiffness: 100 });
        deleteOpacity.value = withTiming(1);
        runOnJS(triggerLightHaptic)();
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
        deleteOpacity.value = withTiming(0);
      }
    })
    .onFinalize(() => {
      // Snap back if gesture was cancelled mid-swipe (interrupted by scroll or system gesture)
      if (translateX.value > -40 && translateX.value < 0) {
        translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
        deleteOpacity.value = withTiming(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: deleteOpacity.value,
    transform: [{ scale: withSpring(deleteOpacity.value > 0.5 ? 1 : 0.8) }],
  }));

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, styles.deleteZone]}>
        <Animated.View style={actionStyle}>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={language === 'tr' ? 'Sil' : 'Delete'}
            onPress={onDelete}
            style={styles.deleteBtn}
          >
            <Trash2 size={ICON.lg} color="white" />
          </Touchable>
        </Animated.View>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative', marginBottom: S.sm },
  deleteZone: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: S.md,
  },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: R.full,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
