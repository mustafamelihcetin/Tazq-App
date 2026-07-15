import React from 'react';
import { S, ICON, R, B } from '@/shared/constants/tokens';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Zap } from 'lucide-react-native';
import { useFocusStore } from '../store/useFocusStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '@/shared/components/Touchable';

export const FocusIsland = () => {
  const isActive = useFocusStore(s => s.isActive);
  const seconds = useFocusStore(s => s.seconds);
  const currentTask = useFocusStore(s => s.currentTask);
  const { theme, colorScheme } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const isOnFocusScreen = pathname === '/focus';
  const isOnDashboard = pathname === '/' || pathname === '/index';

  // Dashboard has its own focus indicator (StatusHub); skip here to avoid covering the logo
  if (!isActive || isOnFocusScreen || isOnDashboard) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { top: insets.top + 8 }]}
    >
      <MotiView
        from={{ translateY: -60, opacity: 0, scale: 0.85 }}
        animate={{ translateY: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? theme.surfaceContainerHighest : '#fff',
            borderColor: theme.primary + '40',
            shadowColor: theme.primary,
          },
        ]}
      >
        <MotiView
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ loop: true, duration: 1800 }}
          style={[styles.dot, { backgroundColor: '#34c759' }]}
        />
        <Touchable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/focus');
          }}
          style={styles.inner}
          activeOpacity={0.8}
        >
          <Zap size={ICON.xs} color={theme.primary} fill={theme.primary} />
          <Text style={[styles.task, { color: theme.onSurface }]} numberOfLines={1}>
            {currentTask || 'Focus'}
          </Text>
          <Text style={[styles.time, { color: theme.primary }]}>
            {formatTime(seconds)}
          </Text>
        </Touchable>
      </MotiView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  } as any,
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: R.full,
    borderWidth: B.medium,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    gap: S.sm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: R.full,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    maxWidth: 220,
  },
  task: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  time: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
