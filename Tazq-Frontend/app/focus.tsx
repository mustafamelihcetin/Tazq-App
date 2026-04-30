import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';

const DURATIONS = [15, 25, 50, 90];

export default function FocusScreen() {
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
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
      // Brief pause then navigate back
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

  const handleDuration = (minutes: number) => {
    Haptics.selectionAsync();
    setDuration(minutes);
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalSeconds > 0 ? (totalSeconds - seconds) / totalSeconds : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={[styles.closeBtn, { backgroundColor: theme.surfaceContainerLow }]}
          >
            <X size={24} color={theme.onSurface} />
          </TouchableOpacity>
          <View style={[styles.badge, { backgroundColor: theme.tertiary + '15' }]}>
            <Sparkles size={14} color={theme.tertiary} />
            <Text style={[styles.badgeText, { color: theme.tertiary }]}>DEEP FOCUS</Text>
          </View>
        </View>

        {/* Duration Selector */}
        <View style={styles.durationRow}>
          {DURATIONS.map((min) => {
            const active = totalSeconds === min * 60;
            return (
              <TouchableOpacity
                key={min}
                onPress={() => handleDuration(min)}
                disabled={isActive}
                style={[
                  styles.durationChip,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceContainerLow,
                    opacity: isActive && !active ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={[styles.durationText, { color: active ? 'white' : theme.onSurfaceVariant }]}>
                  {min}m
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.content}>
          {/* Timer Circle */}
          <MotiView
            animate={{
              scale: isActive ? 1.04 : 1,
            }}
            transition={{ type: 'timing', duration: 1800, loop: isActive }}
            style={[styles.timerOuter, { borderColor: theme.primary + '15' }]}
          >
            {/* Progress ring overlay */}
            <View style={[
              styles.progressRing,
              {
                borderColor: theme.primary,
                // Simple visual — rotate based on progress
                transform: [{ rotate: `${progress * 360}deg` }],
                opacity: progress > 0 ? 0.6 : 0,
              }
            ]} />

            <View style={[styles.timerInner, { backgroundColor: theme.surfaceContainerLow, shadowColor: theme.primary }]}>
              <Text style={[styles.timerText, { color: theme.primary }]}>
                {formatTime(seconds)}
              </Text>
              <Text style={[styles.taskLabel, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                {currentTask || t.duration}
              </Text>
            </View>

            <View style={[styles.decoCircle, { backgroundColor: theme.secondary + '10', top: -20, right: -20 }]} />
            <View style={[styles.decoCircle, { backgroundColor: theme.tertiary + '10', bottom: 40, left: -30, width: 100, height: 100 }]} />
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={styles.controls}
          >
            <TouchableOpacity
              onPress={resetTimer}
              style={[styles.controlBtnSecondary, { backgroundColor: theme.surfaceContainerHigh }]}
            >
              <RotateCcw size={24} color={theme.onSurface} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTimer}
              style={[styles.playBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
            >
              {isActive
                ? <Pause size={32} color="white" fill="white" />
                : <Play size={32} color="white" fill="white" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>

            <View style={[styles.controlBtnSecondary, { backgroundColor: theme.surfaceContainerHigh }]}>
              <Text style={[styles.progressText, { color: theme.onSurfaceVariant }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </MotiView>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.quote, { color: theme.onSurfaceVariant }]}>
            "The secret of getting ahead is getting started."
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  closeBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
  },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  durationChip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 100,
  },
  durationText: { fontSize: 13, fontWeight: '800' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  timerOuter: {
    width: 320, height: 320, borderRadius: 160,
    borderWidth: 20,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  progressRing: {
    position: 'absolute',
    width: 320, height: 320, borderRadius: 160,
    borderWidth: 4,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  timerInner: {
    width: 260, height: 260, borderRadius: 130,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30,
    elevation: 10,
  },
  timerText: { fontSize: 64, fontWeight: '900', letterSpacing: -2 },
  taskLabel: { fontSize: 14, fontWeight: '600', marginTop: 8, maxWidth: 200, textAlign: 'center' },
  decoCircle: { position: 'absolute', width: 140, height: 140, borderRadius: 70, zIndex: -1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 32, marginTop: 64 },
  playBtn: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20,
    elevation: 8,
  },
  controlBtnSecondary: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  progressText: { fontSize: 12, fontWeight: '900' },
  footer: { padding: 40, alignItems: 'center' },
  quote: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', opacity: 0.6 },
});
