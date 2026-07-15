import React from 'react';
import { S, ICON, R, B } from '@/shared/constants/tokens';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { Sparkles, Timer as TimerIcon, Play, Zap } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/shared/constants/Colors';
import { useRouter } from 'expo-router';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { Touchable } from '@/shared/components/Touchable';

export const DynamicIsland = () => {
  const { width } = useWindowDimensions();
  const { theme, colorScheme } = useAppTheme();
  const { t } = useLanguageStore();
  const router = useRouter();
  const isActive = useFocusStore(s => s.isActive);
  const seconds = useFocusStore(s => s.seconds);
  const currentTask = useFocusStore(s => s.currentTask);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/focus');
  };

  const isDark = colorScheme === 'dark';

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={styles.container}
    >
      <Touchable
        onPress={handlePress}
        activeOpacity={0.9}
        style={[
            styles.wrapper,
            {
                backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerLowest,
                borderColor: isActive ? theme.primary + '40' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                borderWidth: isActive ? 1.5 : 1.2,
            }
        ]}
      >
        <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: isActive ? theme.primaryContainer : theme.surfaceContainerHigh }]}>
                {isActive ? (
                  <MotiView
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ loop: true, duration: 1800 }}
                  >
                    <Zap size={ICON.md} color={theme.onPrimaryContainer} fill={theme.onPrimaryContainer} />
                  </MotiView>
                ) : (
                  <Zap size={ICON.md} color={theme.onSurfaceVariant} />
                )}
            </View>

            <View style={styles.textContainer}>
                <Text style={[styles.label, { color: isActive ? theme.primary : (isDark ? theme.secondary : theme.onSurfaceVariant) }]}>
                    {isActive ? t.activeFocus : t.dailyGoal}
                </Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.title, { color: theme.onSurface }]} numberOfLines={1}>
                    {isActive ? (currentTask && currentTask.length > 24 ? currentTask.substring(0, 24) + '...' : (currentTask || t.focusSession)) : t.focusReady}
                </Text>
            </View>

            <Touchable
                onPress={handlePress}
                style={[
                    styles.actionButton,
                    {
                        backgroundColor: isActive ? '#34c759' : theme.primary,
                        shadowColor: isActive ? '#34c759' : (isDark ? theme.primary : '#000'),
                    }
                ]}
            >
                <LinearGradient
                    colors={isActive ? ['#34c759', '#30d158'] : (isDark ? [theme.primary, theme.primaryDim] : [theme.primary, theme.primaryContainer])}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btnGradient}
                >
                    <Text style={[styles.actionText, { color: '#fff' }]}>
                        {isActive ? formatTime(seconds) : t.start}
                    </Text>
                </LinearGradient>
            </Touchable>
        </View>
      </Touchable>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: S.lg,
    marginBottom: S.md,
  },
  wrapper: {
    borderRadius: R.xl,
    padding: S.smd,
    borderWidth: B.thin,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.smd,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: S.xxs,
    fontFamily: 'Jakarta-ExtraBold',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
  },
  actionButton: {
    borderRadius: R.full,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 0,
    overflow: 'hidden',
  },
  btnGradient: {
    paddingHorizontal: S.lmd,
    paddingVertical: S.smd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 13,
    fontFamily: 'Jakarta-ExtraBold',
    letterSpacing: -0.2,
  }
});
