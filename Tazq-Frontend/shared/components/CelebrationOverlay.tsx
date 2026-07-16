import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback, useWindowDimensions, Platform, BackHandler } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAchievementStore } from '@/features/user/store/useAchievementStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { F, R, S, B } from '@/shared/constants/tokens';
import { renderAchievementIcon, ACHIEVEMENT_ICONS } from '@/shared/utils/achievementIcons';

const CONFETTI_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4',
  '#F97316', '#84CC16', '#FBBF24', '#34D399',
];

const PARTICLE_COUNT = 44;

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  size: number;
  color: string;
  shape: 'circle' | 'rect' | 'triangle';
}

export const CelebrationOverlay: React.FC = () => {
  const { pending, clearPending, queue } = useAchievementStore();
  const { theme, colorScheme } = useAppTheme();
  const { language } = useLanguageStore();
  const isDark = colorScheme === 'dark';
  const { width, height } = useWindowDimensions();
  const tr = language === 'tr';

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.5)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0.3)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0),
      size: 4 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: i % 3 === 0 ? 'circle' : i % 3 === 1 ? 'rect' : 'triangle',
    })),
  []);

  const resetAll = () => {
    overlayOpacity.setValue(0);
    cardScale.setValue(0.5);
    cardOpacity.setValue(0);
    emojiScale.setValue(0.3);
    ringScale.setValue(0.6);
    ringOpacity.setValue(0);
    shimmerX.setValue(-1);
    particles.forEach(p => {
      p.x.setValue(0); p.y.setValue(0);
      p.opacity.setValue(0); p.rotate.setValue(0); p.scale.setValue(0);
    });
  };

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => { clearPending(); resetAll(); });
  };

  useEffect(() => {
    if (!pending) return;

    resetAll();

    // Premium haptic sequence
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); }, 120);
    setTimeout(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }, 280);
    setTimeout(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }, 500);

    // Overlay fade in
    Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    // Pulsing glow ring behind card
    Animated.sequence([
      Animated.delay(60),
      Animated.parallel([
        Animated.spring(ringScale, { toValue: 1.4, damping: 8, stiffness: 120, useNativeDriver: true } as any),
        Animated.timing(ringOpacity, { toValue: 0.35, duration: 180, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.8, duration: 500, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    // Card spring entrance — two-stage: overshoot then settle
    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1.06, damping: 9, stiffness: 200, useNativeDriver: true } as any),
      Animated.timing(cardOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      Animated.spring(cardScale, { toValue: 1, damping: 14, stiffness: 240, useNativeDriver: true } as any).start();
    });

    // Shimmer sweep across card
    setTimeout(() => {
      Animated.timing(shimmerX, { toValue: 2, duration: 700, useNativeDriver: true }).start();
    }, 260);

    // Emoji triple-bounce
    setTimeout(() => {
      Animated.sequence([
        Animated.spring(emojiScale, { toValue: 1.3, damping: 5, stiffness: 350, useNativeDriver: true } as any),
        Animated.spring(emojiScale, { toValue: 0.92, damping: 12, stiffness: 280, useNativeDriver: true } as any),
        Animated.spring(emojiScale, { toValue: 1.08, damping: 14, stiffness: 220, useNativeDriver: true } as any),
        Animated.spring(emojiScale, { toValue: 1, damping: 20, stiffness: 260, useNativeDriver: true } as any),
      ]).start();
    }, 100);

    // Two-wave confetti burst
    const cx = width / 2;
    const cy = height * 0.42;
    const WAVE1 = Math.floor(PARTICLE_COUNT * 0.6);
    const WAVE2 = PARTICLE_COUNT - WAVE1;

    // Wave 1 — radial burst
    particles.slice(0, WAVE1).forEach((p, i) => {
      const angle = (i / WAVE1) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const dist = 80 + Math.random() * 160;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist - 60;
      const delay = i * 12;

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.scale, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0.95, duration: 100, useNativeDriver: true }),
          Animated.spring(p.x, { toValue: tx, damping: 11, stiffness: 75, useNativeDriver: true } as any),
          Animated.spring(p.y, { toValue: ty, damping: 9, stiffness: 55, useNativeDriver: true } as any),
          Animated.timing(p.rotate, { toValue: 4 + Math.random() * 6, duration: 1000, useNativeDriver: true }),
        ]),
      ]).start();

      setTimeout(() => {
        Animated.timing(p.opacity, { toValue: 0, duration: 550, useNativeDriver: true }).start();
      }, delay + 450 + Math.random() * 250);
    });

    // Wave 2 — upward shower (delayed 200ms)
    particles.slice(WAVE1).forEach((p, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const dist = 60 + Math.random() * 200;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      const delay = 200 + i * 22;

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.scale, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0.9, duration: 80, useNativeDriver: true }),
          Animated.timing(p.x, { toValue: tx, duration: 900, useNativeDriver: true }),
          Animated.timing(p.y, { toValue: ty + 60, duration: 900, useNativeDriver: true }), // gravity fall
          Animated.timing(p.rotate, { toValue: 3 + Math.random() * 8, duration: 900, useNativeDriver: true }),
        ]),
      ]).start();

      setTimeout(() => {
        Animated.timing(p.opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
      }, delay + 380 + Math.random() * 300);
    });

    // Oto-kapanış: sırada başka kutlama varsa daha kısa (akışı 6sn+ bloklamasın)
    dismissTimer.current = setTimeout(dismiss, queue.length > 0 ? 1800 : 3000);

    // Android donanım geri tuşu kutlamayı kapatsın (overlay RN Modal değil, absolute View)
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true; // varsayılan geri davranışını engelle
    });

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      backSub.remove();
    };
  }, [pending?.id]);

  if (!pending) return null;

  const cx = width / 2;
  const cy = height * 0.42;
  const shimmerTranslate = shimmerX.interpolate({ inputRange: [-1, 2], outputRange: [-300, 300] });

  return (
    <TouchableWithoutFeedback onPress={dismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity, zIndex: 9999 }]}>
        <BlurView intensity={isDark ? 60 : 48} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.48)' : 'rgba(0,0,0,0.22)' }]} />

        {/* Confetti particles */}
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: cx - p.size / 2,
              top: cy - p.size / 2,
              width: p.size,
              height: p.shape === 'rect' ? p.size * 2 : p.size,
              borderRadius: p.shape === 'circle' ? p.size : p.shape === 'triangle' ? 1 : 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { scale: p.scale },
                { rotate: p.rotate.interpolate({ inputRange: [0, 10], outputRange: ['0deg', '720deg'] }) },
              ],
            }}
          />
        ))}

        {/* Pulsing glow ring */}
        <Animated.View style={{
          position: 'absolute',
          left: cx - 80,
          top: height * 0.5 - 80,
          width: 160,
          height: 160,
          borderRadius: R.full,
          backgroundColor: theme.primary + '40',
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }} />

        {/* Card */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
                overflow: 'hidden',
              },
            ]}
          >
            {/* Shimmer sweep */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 80,
                backgroundColor: 'rgba(255,255,255,0.12)',
                transform: [{ translateX: shimmerTranslate }, { skewX: '-20deg' }],
                zIndex: 0,
              }}
              pointerEvents="none"
            />

            <Animated.View style={{
              width: 120,
              height: 120,
              borderRadius: R.full,
              borderWidth: B.medium,
              borderColor: (ACHIEVEMENT_ICONS[pending.id]?.color || theme.primary) + '30', // 19% opacity colored border
              backgroundColor: ACHIEVEMENT_ICONS[pending.id]?.color || theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: S.lg,
              transform: [{ scale: emojiScale }],
              shadowColor: ACHIEVEMENT_ICONS[pending.id]?.color || theme.primary,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 6,
              zIndex: 1,
            }}>
              {renderAchievementIcon(pending.id, 56)}
            </Animated.View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.title, { color: theme.onSurface }]}>
              {tr ? pending.titleTr : pending.titleEn}
            </Text>
            <Text style={[styles.subtitle, { color: theme.onSurfaceMuted }]}>
              {tr ? pending.subtitleTr : pending.subtitleEn}
            </Text>
            <View style={[styles.pill, { backgroundColor: theme.primary + '1C' }]}>
              <Text style={[styles.pillText, { color: theme.primary }]}>
                ✦ {tr ? 'Başarım Açıldı' : 'Achievement Unlocked'} ✦
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
    width: 288,
    borderRadius: R.lg + 6,
    borderWidth: B.thin,
    padding: S.xl + 4,
    alignItems: 'center',
    gap: S.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.3,
    shadowRadius: 48,
    elevation: 24,
    backfaceVisibility: 'hidden',
  },
  achievementIcon: { width: 100, height: 100, marginBottom: S.sm },
  title: { fontSize: F.title + 2, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: F.body, fontWeight: '500', textAlign: 'center', lineHeight: 22 },
  pill: {
    marginTop: S.sm,
    paddingHorizontal: S.md + 4,
    paddingVertical: S.xs + 2,
    borderRadius: R.full,
  },
  pillText: { fontSize: F.caption, fontWeight: '700', letterSpacing: 0.8 },
});
