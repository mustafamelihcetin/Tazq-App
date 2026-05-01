import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { Sparkles, Timer as TimerIcon, Play, Zap } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';

export const DynamicIsland = () => {
  const { width } = useWindowDimensions();
  const { theme, colorScheme } = useAppTheme();
  const { t } = useLanguageStore();
  const router = useRouter();
  const { isActive, seconds, currentTask } = useFocusStore();

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
      <TouchableOpacity 
        onPress={handlePress}
        activeOpacity={0.9}
        style={[
            styles.wrapper, 
            { 
                backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerLowest,
                borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            }
        ]}
      >
        <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: isActive ? theme.primaryContainer : theme.surfaceContainerHigh }]}>
                <Zap size={20} color={isActive ? theme.onPrimaryContainer : theme.onSurfaceVariant} fill={isActive ? theme.onPrimaryContainer : 'none'} />
            </View>
            
            <View style={styles.textContainer}>
                <Text style={[styles.label, { color: isDark ? theme.secondary : theme.onSurfaceVariant }]}>
                    {isActive ? t.activeFocus : t.dailyGoal}
                </Text>
                <Text style={[styles.title, { color: theme.onSurface }]} numberOfLines={1}>
                    {isActive ? currentTask : 'Finalize Design System'}
                </Text>
            </View>

            <TouchableOpacity 
                onPress={handlePress}
                style={[
                    styles.actionButton, 
                    { 
                        backgroundColor: theme.primary,
                        shadowColor: isDark ? theme.primary : '#000',
                    }
                ]}
            >
                <LinearGradient
                    colors={isDark ? [theme.primary, '#3367ff'] : [theme.primary, theme.primaryContainer]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btnGradient}
                >
                    <Text style={[styles.actionText, { color: theme.onPrimary }]}>
                        {isActive ? formatTime(seconds) : t.start}
                    </Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    marginVertical: 12,
  },
  wrapper: {
    borderRadius: 48,
    padding: 12,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Plus Jakarta Sans' : 'sans-serif',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Plus Jakarta Sans' : 'sans-serif',
  },
  actionButton: {
    borderRadius: 100,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 5,
    overflow: 'hidden',
  },
  btnGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.2,
  }
});
