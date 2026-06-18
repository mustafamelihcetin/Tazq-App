import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { S, R } from '../constants/tokens';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}

export const SwipeableItem = ({ children, onDelete, disabled }: Props) => {
  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);
  const startTranslateX = useSharedValue(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => {
        return !disabled && Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy);
      },
      onPanResponderGrant: () => {
        startTranslateX.value = translateX.value;
      },
      onPanResponderMove: (_, gs) => {
        const newX = Math.min(0, startTranslateX.value + gs.dx);
        translateX.value = newX;
        deleteOpacity.value = Math.min(Math.abs(newX) / 80, 1);
      },
      onPanResponderRelease: (_, gs) => {
        const total = startTranslateX.value + gs.dx;
        const isFastSwipe = gs.vx < -0.5;
        const isOpening = total < -40;

        if (isFastSwipe || isOpening) {
          translateX.value = withSpring(-80, { damping: 15, stiffness: 100 });
          deleteOpacity.value = withTiming(1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
          deleteOpacity.value = withTiming(0);
        }
      },
      onPanResponderTerminate: () => {
        translateX.value = withSpring(translateX.value < -40 ? -80 : 0);
      },
    })
  ).current;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: deleteOpacity.value,
    transform: [{ scale: withSpring(deleteOpacity.value > 0.5 ? 1 : 0.8) }],
  }));

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, styles.deleteZone]}>
        <Animated.View style={actionStyle}>
          <TouchableOpacity
            onPress={onDelete}
            style={styles.deleteBtn}
          >
            <Trash2 size={22} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Animated.View {...panResponder.panHandlers} style={animatedStyle}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative', marginBottom: S.sm },
  deleteZone: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingRight: S.md },
  deleteBtn: { width: 48, height: 48, borderRadius: R.full, backgroundColor: '#ff3b30', justifyContent: 'center', alignItems: 'center' },
});
