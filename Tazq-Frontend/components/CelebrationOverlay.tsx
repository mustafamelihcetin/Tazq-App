import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAchievementStore } from '../store/useAchievementStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { F, R, S } from '../constants/tokens';

const CONFETTI_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4',
  '#F97316', '#84CC16',
];

const PARTICLE_COUNT = 28;

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
  size: number;
  color: string;
  shape: 'circle' | 'rect';
}

export const CelebrationOverlay: React.FC = () => {
  const { pending, clearPending } = useAchievementStore();
  const { theme, colorScheme } = useAppTheme();
  const { language } = useLanguageStore();
  const isDark = colorScheme === 'dark';
  const { width, height } = useWindowDimensions();
  const tr = language === 'tr';

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.55)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0.4)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      size: 5 + Math.random() * 7,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    })),
  []);

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.85, duration: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      clearPending();
      overlayOpacity.setValue(0);
      cardScale.setValue(0.55);
      cardOpacity.setValue(0);
      emojiScale.setValue(0.4);
      particles.forEach(p => { p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(0); p.rotate.setValue(0); });
    });
  };

  useEffect(() => {
    if (!pending) return;

    // Haptic sequence
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 180);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 400);

    // Overlay fade in
    Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();

    // Card spring in
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, damping: 13, stiffness: 180, useNativeDriver: true } as any),
      Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    // Emoji bounce
    setTimeout(() => {
      Animated.sequence([
        Animated.spring(emojiScale, { toValue: 1.25, damping: 6, stiffness: 300, useNativeDriver: true } as any),
        Animated.spring(emojiScale, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true } as any),
      ]).start();
    }, 120);

    // Confetti burst
    const cx = width / 2;
    const cy = height * 0.42;
    particles.forEach((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 90 + Math.random() * 140;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist - 40;
      const delay = i * 18;

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.spring(p.x, { toValue: tx, damping: 12, stiffness: 80, useNativeDriver: true } as any),
          Animated.spring(p.y, { toValue: ty, damping: 10, stiffness: 60, useNativeDriver: true } as any),
          Animated.timing(p.rotate, { toValue: 3 + Math.random() * 5, duration: 900, useNativeDriver: true }),
        ]),
      ]).start();

      // Fade out after burst
      setTimeout(() => {
        Animated.timing(p.opacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      }, delay + 500 + Math.random() * 300);
    });

    // Auto-dismiss
    dismissTimer.current = setTimeout(dismiss, 2600);
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, [pending?.id]);

  if (!pending) return null;

  const cx = width / 2;
  const cy = height * 0.42;

  return (
    <TouchableWithoutFeedback onPress={dismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity, zIndex: 9999 }]}>
        <BlurView intensity={isDark ? 55 : 45} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.25)' }]} />

        {/* Confetti particles */}
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: cx - p.size / 2,
              top: cy - p.size / 2,
              width: p.size,
              height: p.shape === 'rect' ? p.size * 1.8 : p.size,
              borderRadius: p.shape === 'circle' ? p.size : 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: p.rotate.interpolate({ inputRange: [0, 10], outputRange: ['0deg', '720deg'] }) },
              ],
            }}
          />
        ))}

        {/* Card */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
              },
            ]}
          >
            <Animated.Text style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}>
              {pending.emoji}
            </Animated.Text>
            <Text style={[styles.title, { color: theme.onSurface }]}>
              {tr ? pending.titleTr : pending.titleEn}
            </Text>
            <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
              {tr ? pending.subtitleTr : pending.subtitleEn}
            </Text>
            <View style={[styles.pill, { backgroundColor: theme.primary + '18' }]}>
              <Text style={[styles.pillText, { color: theme.primary }]}>
                {tr ? 'Başarım Açıldı' : 'Achievement Unlocked'}
              </Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 280,
    borderRadius: R.lg + 4,
    borderWidth: 1,
    padding: S.xl,
    alignItems: 'center',
    gap: S.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  emoji: { fontSize: 72, lineHeight: 80, marginBottom: S.sm },
  title: { fontSize: F.title + 2, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: F.body, fontWeight: '500', textAlign: 'center', opacity: 0.65, lineHeight: 20 },
  pill: {
    marginTop: S.sm,
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 1,
    borderRadius: R.full,
  },
  pillText: { fontSize: F.caption, fontWeight: '800', letterSpacing: 0.5 },
});
