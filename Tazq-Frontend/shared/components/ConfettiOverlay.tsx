import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useConfettiStore } from '@/shared/store/useConfettiStore';

const CONFETTI_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4',
  '#F97316', '#84CC16', '#FBBF24', '#34D399',
];

const PARTICLE_COUNT = 30;

interface ConfettiParticle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  size: number;
  color: string;
}

export const ConfettiOverlay: React.FC = () => {
  const { visible, hide } = useConfettiStore();
  const { width, height } = useWindowDimensions();

  const particles = useMemo<ConfettiParticle[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0),
      size: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })),
    []
  );

  useEffect(() => {
    if (!visible) return;

    // Reset particles
    particles.forEach(p => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      p.rotate.setValue(0);
      p.scale.setValue(0);
    });

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 150);

    // Animate particles
    const animations = particles.map((p, i) => {
      // Random direction (mostly upwards and outwards)
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
      const distance = 80 + Math.random() * 150;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;

      return Animated.sequence([
        // Initial burst
        Animated.parallel([
          Animated.timing(p.scale, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0.9, duration: 100, useNativeDriver: true }),
          Animated.spring(p.x, { toValue: targetX, damping: 10, stiffness: 100, useNativeDriver: true } as any),
          Animated.spring(p.y, { toValue: targetY, damping: 8, stiffness: 80, useNativeDriver: true } as any),
          Animated.timing(p.rotate, { toValue: 2 + Math.random() * 4, duration: 1200, useNativeDriver: true }),
        ]),
        // Fall down with gravity
        Animated.parallel([
          Animated.timing(p.y, { toValue: targetY + 250, duration: 1000, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ]);
    });

    Animated.parallel(animations).start(() => {
      hide();
    });

  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }]}>
      {particles.map((p, i) => {
        const rotateStr = p.rotate.interpolate({
          inputRange: [0, 6],
          outputRange: ['0deg', '360deg'],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: width / 2,
              top: height * 0.5,
              width: p.size,
              height: p.size * (i % 2 === 0 ? 1 : 1.6), // Mix of squares and rectangles
              backgroundColor: p.color,
              opacity: p.opacity,
              borderRadius: i % 3 === 0 ? p.size / 2 : 2, // Circle or rect
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: rotateStr },
                { scale: p.scale },
              ],
            }}
          />
        );
      })}
    </View>
  );
};
