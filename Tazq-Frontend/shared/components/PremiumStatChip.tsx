import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { R, S, F, B } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import type { AppTheme } from '@/shared/constants/Colors';

export interface Surprise {
  icon: string;
  label: string;
  /** nudge = 0/empty state (soft glow only). celebrate = positive value (ripple + float). */
  tier: 'nudge' | 'celebrate';
}

interface Props {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
  isDark: boolean;
  theme: AppTheme;
  getSurprise: () => Surprise;
}

export const PremiumStatChip = React.memo(function PremiumStatChip({
  icon, value, label, color, isDark, theme, getSurprise,
}: Props) {
  const tapTime = useRef(0);
  const [burst,    setBurst]    = React.useState(false);
  const [burstKey, setBurstKey] = React.useState(0);
  const [surprise, setSurprise] = React.useState<Surprise | null>(null);

  // Shared: soft glow background
  const glowOpacity = useSharedValue(0);
  const glowStyle   = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  // celebrate only: ripple circle expands from center
  const rippleScale   = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);
  const rippleStyle   = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  // celebrate only: icon pops
  const iconScale = useSharedValue(1);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  const triggerBurst = useCallback(() => {
    const s = getSurprise();
    setSurprise(s);
    setBurst(true);
    setBurstKey(k => k + 1);

    if (s.tier === 'nudge') {
      // ── Soft glow pulse: fade in → fade out (no ripple, no emoji float) ──
      glowOpacity.value = withSequence(
        withTiming(0.55, { duration: 250, easing: Easing.out(Easing.quad) }),
        withTiming(0,    { duration: 700, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      // ── Celebrate: ripple from center + icon pop + glow ──
      glowOpacity.value = withSequence(
        withTiming(0.35, { duration: 180 }),
        withTiming(0,    { duration: 600, easing: Easing.out(Easing.cubic) }),
      );

      rippleScale.value = 0;
      rippleOpacity.value = 0.6;
      rippleScale.value = withTiming(9, { duration: 480, easing: Easing.out(Easing.cubic) });
      rippleOpacity.value = withTiming(0, { duration: 450, easing: Easing.out(Easing.quad) });

      iconScale.value = 1.3;
      iconScale.value = withSpring(1, { damping: 9, stiffness: 200 });
    }

    setTimeout(() => { setBurst(false); setSurprise(null); }, 1900);
  }, [getSurprise, glowOpacity, rippleScale, rippleOpacity, iconScale]);

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - tapTime.current < 380) {
      Haptics.notificationAsync(
        surprise?.tier === 'nudge'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      triggerBurst();
    }
    tapTime.current = now;
  }, [triggerBurst, surprise]);

  const isCelebrate = burst && surprise?.tier === 'celebrate';

  return (
    <Touchable onPress={handlePress} activeOpacity={0.9} style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>

        {/* ─── Floating emoji — celebrate tier only ─── */}
        {isCelebrate && surprise && (
          <MotiView
            key={`float-${burstKey}`}
            from={{ opacity: 1, scale: 0.5, translateY: 8 }}
            animate={{ opacity: 0, scale: 1.1, translateY: -60 }}
            transition={{ type: 'timing', duration: 680, easing: Easing.out(Easing.cubic) }}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              alignItems: 'center',
              zIndex: 30,
              pointerEvents: 'none',
            }}
          >
            <Text style={{ fontSize: 34 }}>{surprise.icon}</Text>
          </MotiView>
        )}

        {/* ─── Card ─── */}
        <View style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderRadius: R.md,
          borderWidth: B.thin,
          borderColor: burst
            ? color + '50'
            : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
          overflow: 'hidden',
          padding: S.md,
          alignItems: 'center',
          gap: S.xs,
        }}>

          {/* Glow overlay — both tiers */}
          <Animated.View
            pointerEvents="none"
            style={[{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: color + '30',
            }, glowStyle]}
          />

          {/* Ripple — celebrate tier only */}
          <Animated.View
            pointerEvents="none"
            style={[{
              position: 'absolute',
              width: 22, height: 22,
              borderRadius: R.full,
              backgroundColor: color + '50',
              alignSelf: 'center',
              top: '50%',
              marginTop: -11,
            }, rippleStyle]}
          />

          {/* Icon — pops on celebrate, static on nudge */}
          <Animated.View style={isCelebrate ? iconStyle : undefined}>
            <MotiView
              key={`ico-${burstKey}`}
              from={{ opacity: burst ? 0 : 1 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 120 }}
            >
              {burst && surprise
                ? <Text style={{ fontSize: 18, lineHeight: 20 }}>{surprise.icon}</Text>
                : icon}
            </MotiView>
          </Animated.View>

          {/* Value */}
          <Text style={{
            fontSize: F.title, fontWeight: '700', letterSpacing: -1,
            color, lineHeight: 26,
          }}>
            {value}
          </Text>

          {/* Label / reactive message */}
          <MotiView
            key={`lbl-${burstKey}`}
            from={{ opacity: 0, translateY: 3 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 190, delay: 40 }}
          >
            <Text style={{
              fontSize: burst ? 9 : 8,
              fontWeight: '700',
              letterSpacing: 0.3,
              textAlign: 'center',
              color: burst ? color : theme.onSurfaceVariant,
              opacity: burst ? 1 : 0.55,
            }}>
              {burst && surprise ? surprise.label : label.toUpperCase()}
            </Text>
          </MotiView>
        </View>
      </View>
    </Touchable>
  );
});
