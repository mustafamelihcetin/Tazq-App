import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useConfettiStore } from '@/shared/store/useConfettiStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Check } from 'lucide-react-native';
import { swallow } from '@/shared/utils/swallow';

const CONFETTI_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4',
  '#F97316', '#84CC16', '#FBBF24', '#34D399',
];

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
  const { visible, title, subtitle, intensity, sound, hide } = useConfettiStore();
  const { width, height } = useWindowDimensions();
  const { language } = useLanguageStore();
  const { theme, isDark } = useAppTheme();
  const playerRef = useRef<any>(null);

  // Clean up player on component unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch (e) { swallow('ConfettiOverlay.soundStopRelease', e); }
      }
    };
  }, []);

  // Dynamic particle count based on success intensity
  const particleCount = useMemo(() => {
    if (intensity === 'low') return 20;
    if (intensity === 'high') return 75;
    return 40;
  }, [intensity]);

  // Responsive physics constants scaled by success intensity
  const burstOriginX = width / 2;
  const burstOriginY = height / 2;
  
  const minBurstDistance = useMemo(() => {
    if (intensity === 'high') return width * 0.35;
    if (intensity === 'low') return width * 0.15;
    return width * 0.25;
  }, [width, intensity]);

  const maxBurstDistance = useMemo(() => {
    if (intensity === 'high') return width * 0.65;
    if (intensity === 'low') return width * 0.35;
    return width * 0.5;
  }, [width, intensity]);

  const gravityFallAmount = useMemo(() => {
    if (intensity === 'high') return height * 0.45;
    if (intensity === 'low') return height * 0.22;
    return height * 0.35;
  }, [height, intensity]);

  const particles = useMemo<ConfettiParticle[]>(() =>
    Array.from({ length: particleCount }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0),
      size: 5 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })),
    [particleCount]
  );

  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.6)).current;

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

    // Reset badge
    badgeOpacity.setValue(0);
    badgeScale.setValue(0.6);

    // Stop and remove previous player if it exists to avoid overlapping/leaking
    if (playerRef.current) {
      try {
        playerRef.current.remove();
      } catch (e) { swallow('ConfettiOverlay.badgeSoundPlay', e); }
      playerRef.current = null;
    }

    if (sound) {
      try {
        const { createAudioPlayer } = require('expo-audio');
        let soundFile: any = null;
        let volumeValue = 0.20;

        if (sound === 'day_cleared') {
          soundFile = require('../../assets/sounds/day_cleared.mp3');
          volumeValue = 0.08; // extremely soft, gentle chime
        } else if (sound === 'habit') {
          soundFile = require('../../assets/sounds/habit.mp3');
          volumeValue = 0.18;
        } else if (sound === 'freeze') {
          soundFile = require('../../assets/sounds/freeze.mp3');
          volumeValue = 0.15;
        } else if (sound === 'levelup') {
          soundFile = require('../../assets/sounds/levelup.mp3');
          volumeValue = 0.20;
        } else if (sound === 'success') {
          soundFile = require('../../assets/sounds/success.mp3');
          volumeValue = 0.15;
        }

        if (soundFile) {
          playerRef.current = createAudioPlayer(soundFile);
          const p = playerRef.current;
          p.volume = volumeValue;
          p.play();

          // Set volume again after native load completes to guarantee override
          setTimeout(() => {
            try {
              if (playerRef.current === p) p.volume = volumeValue;
            } catch (e) { swallow('ConfettiOverlay.soundRelease', e); }
          }, 150);

          // Auto-remove after 15 seconds to free up resources
          setTimeout(() => {
            try {
              if (playerRef.current === p) {
                p.remove();
                playerRef.current = null;
              }
            } catch (e) { swallow('ConfettiOverlay.soundPlay', e); }
          }, 15000);
        }
      } catch (err) {
        console.warn('[Confetti Audio Play Error]', err);
      }
    }

    // Trigger haptic feedback based on intensity
    if (intensity === 'high') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, 150);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 150);
    }

    // Animate particles
    const particleAnimations = particles.map((p, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const distance = minBurstDistance + Math.random() * (maxBurstDistance - minBurstDistance);
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;
      const burstDuration = intensity === 'high' ? 180 : 140;
      const fallDuration = intensity === 'high' ? 1400 : 1000;

      return Animated.sequence([
        // Burst phase
        Animated.parallel([
          Animated.timing(p.scale, { toValue: 1, duration: burstDuration, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0.95, duration: burstDuration, useNativeDriver: true }),
          Animated.spring(p.x, { toValue: targetX, damping: 12, stiffness: 120, useNativeDriver: true } as any),
          Animated.spring(p.y, { toValue: targetY, damping: 9, stiffness: 90, useNativeDriver: true } as any),
          Animated.timing(p.rotate, { toValue: 4 + Math.random() * 6, duration: burstDuration + fallDuration, useNativeDriver: true }),
        ]),
        // Gravity / fall down phase
        Animated.parallel([
          Animated.timing(p.y, { toValue: targetY + gravityFallAmount, duration: fallDuration, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0, duration: fallDuration * 0.75, useNativeDriver: true }),
        ])
      ]);
    });

    // Animate badge
    const badgeAnimation = Animated.sequence([
      Animated.parallel([
        Animated.timing(badgeOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1, damping: 12, stiffness: 150, useNativeDriver: true } as any)
      ]),
      Animated.delay(intensity === 'high' ? 1400 : 1100),
      Animated.parallel([
        Animated.timing(badgeOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(badgeScale, { toValue: 0.95, duration: 250, useNativeDriver: true })
      ])
    ]);

    Animated.parallel([
      Animated.parallel(particleAnimations),
      badgeAnimation
    ]).start(() => {
      hide();
    });

    // Clean up
    return () => {};

  }, [visible, particleCount]);

  if (!visible) {
    return <View style={{ width: 0, height: 0, opacity: 0 }} pointerEvents="none" />;
  }

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 9999, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }]}>
      {/* Particles Layer */}
      <View style={StyleSheet.absoluteFill}>
        {particles.map((p, i) => {
          const rotateStr = p.rotate.interpolate({
            inputRange: [0, 10],
            outputRange: ['0deg', '360deg'],
          });

          return (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: burstOriginX,
                top: burstOriginY,
                width: p.size,
                height: p.size * (i % 2 === 0 ? 1 : 1.5),
                backgroundColor: p.color,
                opacity: p.opacity,
                borderRadius: i % 3 === 0 ? p.size / 2 : 2,
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

      {/* Success Badge Layer (Centered naturally via flex) */}
      <Animated.View style={[styles.badge, {
        backgroundColor: isDark ? 'rgba(28, 28, 34, 0.92)' : 'rgba(255, 255, 255, 0.92)',
        borderColor: theme.outlineVariant + '40',
        opacity: badgeOpacity,
        transform: [{ scale: badgeScale }]
      }]}>
        <View style={[styles.iconWrapper, { backgroundColor: theme.primary }]}>
          <Check size={18} color={theme.onPrimary} strokeWidth={3.5} />
        </View>
        <View style={{ gap: 2 }}>
          <Text style={[styles.badgeTitle, { color: theme.onSurface }]}>
            {title || (language === 'tr' ? 'Görev Tamamlandı!' : 'Task Completed!')}
          </Text>
          <Text style={[styles.badgeSubtitle, { color: theme.onSurfaceVariant }]}>
            {subtitle || (language === 'tr' ? 'Bugün de hedefine bir adım yaklaştın.' : 'You are one step closer to your goal today.')}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTitle: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  badgeSubtitle: {
    fontSize: 10.5,
    fontFamily: 'Jakarta-SemiBold',
    opacity: 0.8,
  },
});
