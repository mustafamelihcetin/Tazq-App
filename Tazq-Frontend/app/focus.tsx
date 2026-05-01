import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles } from 'lucide-react-native';
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
  const { width, height } = useWindowDimensions();
  const { t } = useLanguageStore();

  const isSmallDevice = width < 380;
  const isShortDevice = height < 750;

  const { isActive, seconds, totalSeconds, setIsActive, tick, reset, setDuration, currentTask } = useFocusStore();
  const completedRef = useRef(false);

  // Dynamically calculate timer size
  const timerSize = Math.min(width * 0.72, height * 0.35);

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
        <View style={[styles.header, { paddingVertical: isSmallDevice ? 12 : 16 }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          >
            <X size={20} color={theme.onSurface} />
          </TouchableOpacity>
          <View style={[styles.badge, { backgroundColor: theme.primary + '10' }]}>
            <Sparkles size={12} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary, fontSize: isSmallDevice ? 9 : 10 }]}>{t.deepFocus}</Text>
          </View>
        </View>

        <View style={[styles.content, { paddingHorizontal: isSmallDevice ? 20 : 24 }]}>
          <View style={[styles.durationRow, { marginBottom: isSmallDevice ? 30 : 40, gap: isSmallDevice ? 8 : 10 }]}>
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
                      paddingHorizontal: isSmallDevice ? 16 : 20,
                      paddingVertical: isSmallDevice ? 8 : 10
                    },
                  ]}
                >
                  <Text style={[styles.durationText, { color: active ? '#fff' : theme.onSurfaceVariant, fontSize: isSmallDevice ? 12 : 14 }]}>
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
            style={[styles.timerContainer, { width: timerSize, height: timerSize }]}
          >
            <View style={[styles.timerCircle, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, borderColor: isDark ? theme.primary + '30' : 'rgba(0,0,0,0.05)', borderRadius: timerSize / 2, borderWidth: isSmallDevice ? 6 : 8 }]}>
                <Text style={[styles.timerText, { color: theme.onSurface, fontSize: isSmallDevice ? 44 : 56 }]}>{formatTime(seconds)}</Text>
                <Text style={[styles.currentTaskText, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 12 : 14, maxWidth: timerSize * 0.75 }]} numberOfLines={1}>
                    {currentTask || t.focusSession}
                </Text>
            </View>
            
            {isActive && (
                <MotiView 
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.4, scale: 1.2 }}
                    style={[styles.glowCircle, { backgroundColor: theme.primary, borderRadius: timerSize / 2 }]}
                />
            )}
          </MotiView>

          {/* Controls */}
          <View style={[styles.controlsRow, { marginTop: isSmallDevice ? 40 : 60, gap: isSmallDevice ? 24 : 32 }]}>
            <TouchableOpacity onPress={resetTimer} style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow, width: isSmallDevice ? 48 : 56, height: isSmallDevice ? 48 : 56, borderRadius: isSmallDevice ? 24 : 28 }]}>
              <RotateCcw size={isSmallDevice ? 20 : 24} color={theme.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTimer}
              style={[styles.playBtn, { backgroundColor: theme.primary, shadowColor: isDark ? theme.primary : '#000', width: isSmallDevice ? 72 : 84, height: isSmallDevice ? 72 : 84, borderRadius: isSmallDevice ? 36 : 42 }]}
            >
              <LinearGradient
                colors={isDark ? [theme.primary, '#3367ff'] : [theme.primary, theme.primaryContainer]}
                style={styles.btnGradient}
              >
                {isActive ? <Pause size={isSmallDevice ? 28 : 32} color="white" fill="white" /> : <Play size={isSmallDevice ? 28 : 32} color="white" fill="white" />}
              </LinearGradient>
            </TouchableOpacity>

            <View style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow, width: isSmallDevice ? 48 : 56, height: isSmallDevice ? 48 : 56, borderRadius: isSmallDevice ? 24 : 28 }]}>
                <Text style={[styles.progressText, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 10 : 12 }]}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>
        </View>

        <View style={[styles.footer, { padding: isSmallDevice ? 24 : 40 }]}>
            <Text style={[styles.quote, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 12 : 14 }]}>{t.focusQuote}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  badgeText: { fontWeight: '900', letterSpacing: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  durationRow: { flexDirection: 'row' },
  durationChip: { borderRadius: 100 },
  durationText: { fontWeight: '800' },
  timerContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  timerCircle: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
  timerText: { fontWeight: '900', letterSpacing: -2 },
  currentTaskText: { fontWeight: '600', marginTop: 8, textAlign: 'center' },
  glowCircle: { position: 'absolute', width: '100%', height: '100%', zIndex: -1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center' },
  playBtn: { overflow: 'hidden', elevation: 8, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  btnGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  progressText: { fontWeight: '900' },
  footer: { alignItems: 'center' },
  quote: { fontStyle: 'italic', textAlign: 'center', opacity: 0.5 },
});
