import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useRouter } from 'expo-router';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { FocusService } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '../hooks/useAppTheme';

const DURATIONS = [15, 25, 50, 90];

export default function FocusScreen() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { t } = useLanguageStore();

  const { isActive, seconds, totalSeconds, setIsActive, tick, reset, setDuration, currentTask } = useFocusStore();
  const completedRef = useRef(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isActive && seconds > 0) {
      completedRef.current = false;
      interval = setInterval(() => tick(), 1000);
    } else if (seconds === 0 && !completedRef.current) {
      completedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const minutes = Math.round(totalSeconds / 60);
      FocusService.saveSession(currentTask || 'Focus', minutes, true).catch(() => {});
      setTimeout(() => {
        router.canGoBack() ? router.back() : router.replace('/');
      }, 1500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, seconds]);

  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completedRef.current = false;
    reset();
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalSeconds > 0 ? (totalSeconds - seconds) / totalSeconds : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          >
            <X size={24} color={theme.onSurface} />
          </TouchableOpacity>
          <View style={[styles.badge, { backgroundColor: theme.primary + '10' }]}>
            <Sparkles size={14} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary }]}>{t.deepFocus}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.durationRow}>
            {DURATIONS.map((min) => {
              const active = totalSeconds === min * 60;
              return (
                <TouchableOpacity
                  key={min}
                  onPress={() => { Haptics.selectionAsync(); setDuration(min); }}
                  disabled={isActive}
                  style={[
                    styles.durationChip,
                    {
                      backgroundColor: active ? theme.primary : (isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest),
                      opacity: isActive && !active ? 0.3 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.durationText, { color: active ? '#fff' : theme.onSurfaceVariant }]}>
                    {min}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Timer Visual */}
          <MotiView
            animate={{ scale: isActive ? 1.02 : 1 }}
            transition={{ type: 'timing', duration: 1500, loop: isActive }}
            style={styles.timerContainer}
          >
            <View style={[styles.timerCircle, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, borderColor: isDark ? theme.primary + '30' : 'rgba(0,0,0,0.05)' }]}>
                <Text style={[styles.timerText, { color: theme.onSurface }]}>{formatTime(seconds)}</Text>
                <Text style={[styles.currentTaskText, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                    {currentTask || t.focusSession}
                </Text>
            </View>
            
            {isActive && (
                <MotiView 
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1.2 }}
                    style={[styles.glowCircle, { backgroundColor: theme.primary }]}
                />
            )}
          </MotiView>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={resetTimer} style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow }]}>
              <RotateCcw size={24} color={theme.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTimer}
              style={[styles.playBtn, { backgroundColor: theme.primary, shadowColor: isDark ? theme.primary : '#000' }]}
            >
              <LinearGradient
                colors={isDark ? [theme.primary, '#3367ff'] : [theme.primary, theme.primaryContainer]}
                style={styles.btnGradient}
              >
                {isActive ? <Pause size={32} color="white" fill="white" /> : <Play size={32} color="white" fill="white" />}
              </LinearGradient>
            </TouchableOpacity>

            <View style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <Text style={[styles.progressText, { color: theme.onSurfaceVariant }]}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
            <Text style={[styles.quote, { color: theme.onSurfaceVariant }]}>{t.focusQuote}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  durationRow: { flexDirection: 'row', gap: 10, marginBottom: 40 },
  durationChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100 },
  durationText: { fontSize: 14, fontWeight: '800' },
  timerContainer: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  timerCircle: { width: '100%', height: '100%', borderRadius: 140, alignItems: 'center', justifyContent: 'center', borderWidth: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
  timerText: { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  currentTaskText: { fontSize: 14, fontWeight: '600', marginTop: 8, maxWidth: 200, textAlign: 'center' },
  glowCircle: { position: 'absolute', width: '100%', height: '100%', borderRadius: 140, zIndex: -1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 32, marginTop: 60 },
  secondaryBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 84, height: 84, borderRadius: 42, overflow: 'hidden', elevation: 8, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  btnGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  progressText: { fontSize: 12, fontWeight: '900' },
  footer: { padding: 40, alignItems: 'center' },
  quote: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', opacity: 0.5 },
});
