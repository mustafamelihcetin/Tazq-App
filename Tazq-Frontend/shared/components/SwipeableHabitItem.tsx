import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { Trash2, Coffee } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { S, R } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  onSkip: () => void;
  isSkipped?: boolean;
  disabled?: boolean;
  showPeekHint?: boolean;
}

function triggerLightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export const SwipeableHabitItem = ({
  children,
  onDelete,
  onSkip,
  isSkipped = false,
  disabled = false,
  showPeekHint = false,
}: Props) => {
  const { language } = useLanguageStore();
  const translateX = useSharedValue(0);
  const actionsOpacity = useSharedValue(0);
  const contextX = useSharedValue(0);

  useEffect(() => {
    if (!showPeekHint) return;
    const timer = setTimeout(() => {
      translateX.value = withSequence(
        withTiming(-50, { duration: 380 }),
        withDelay(500, withSpring(0, { damping: 18, stiffness: 120 }))
      );
      actionsOpacity.value = withSequence(
        withTiming(1, { duration: 380 }),
        withDelay(500, withTiming(0, { duration: 300 }))
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [showPeekHint]);

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onBegin(() => {
      contextX.value = translateX.value;
    })
    .onUpdate((e) => {
      // Only allow leftward swipe (up to -140px to show both buttons nicely)
      const newX = Math.min(0, Math.max(-140, contextX.value + e.translationX));
      translateX.value = newX;
      actionsOpacity.value = Math.min(Math.abs(newX) / 100, 1);
    })
    .onEnd((e) => {
      const total = contextX.value + e.translationX;
      const isFastSwipe = e.velocityX < -500;
      const isOpened = total < -60;

      if (isFastSwipe || isOpened) {
        // Snap open to show both buttons (108px total width)
        translateX.value = withSpring(-116, { damping: 15, stiffness: 100 });
        actionsOpacity.value = withTiming(1);
        runOnJS(triggerLightHaptic)();
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
        actionsOpacity.value = withTiming(0);
      }
    })
    .onFinalize(() => {
      if (translateX.value > -60 && translateX.value < 0) {
        translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
        actionsOpacity.value = withTiming(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: actionsOpacity.value,
    transform: [{ scale: withSpring(actionsOpacity.value > 0.5 ? 1 : 0.8) }],
  }));

  const handleSkipPress = () => {
    // Snap back habit card
    translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
    actionsOpacity.value = withTiming(0);
    onSkip();
  };

  const handleDeletePress = () => {
    translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
    actionsOpacity.value = withTiming(0);
    onDelete();
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, styles.actionsZone]}>
        <Animated.View style={[actionStyle, styles.buttonsRow]}>
          <Touchable accessibilityRole="button" accessibilityLabel={isSkipped ? (language === 'tr' ? 'Atlamayı geri al' : 'Undo skip') : (language === 'tr' ? 'Bugün atla' : 'Skip today')} onPress={handleSkipPress} style={[styles.actionBtn, { backgroundColor: isSkipped ? '#3b82f6' : '#d97706' }]}>
            <Coffee size={20} color="white" />
          </Touchable>
          <Touchable accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Alışkanlığı sil' : 'Delete habit'} onPress={handleDeletePress} style={[styles.actionBtn, styles.deleteBtn]}>
            <Trash2 size={20} color="white" />
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
  actionsZone: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: S.sm,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: R.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#ff3b30',
  },
});
