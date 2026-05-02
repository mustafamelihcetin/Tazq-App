import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles, CheckCircle2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { FocusService } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { getRandomQuote } from '../constants/Quotes';
import { S, R, F } from '../constants/tokens';
import i18n from 'i18n-js';

const DURATIONS = [15, 25, 50, 90];

export default function FocusScreen() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { t, language } = useLanguageStore();
  const isTR = i18n.locale?.startsWith('tr');

  const { isActive, seconds, totalSeconds, setIsActive, tick, reset, setDuration, currentTask, rehydrateTimer } = useFocusStore();
  const completedRef = useRef(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const timerSize = Math.min(width * 0.72, height * 0.35);
  const elapsed = totalSeconds - seconds;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
  const sessionStarted = elapsed > 0;

  const [quote, setQuote] = useState('');

  useEffect(() => { 
    rehydrateTimer(); 
    setQuote(getRandomQuote(language));
  }, []);

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

  const finishEarly = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsActive(false);
    completedRef.current = true;
    const minutesDone = Math.max(1, Math.round(elapsed / 60));
    FocusService.saveSession(currentTask || 'Focus', minutesDone, false).catch(() => {});
    router.canGoBack() ? router.back() : router.replace('/');
  };

  const applyCustomDuration = () => {
    const mins = parseInt(customInput, 10);
    if (!isNaN(mins) && mins >= 1 && mins <= 480) {
      Haptics.selectionAsync();
      setDuration(mins);
      setCustomInput('');
      setCustomVisible(false);
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { paddingVertical: S.md }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          >
            <X size={20} color={theme.onSurface} />
          </TouchableOpacity>
          <View style={[styles.badge, { backgroundColor: theme.primary + '10' }]}>
            <Sparkles size={12} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary, fontSize: F.caption }]}>{t.deepFocus}</Text>
          </View>
        </View>

        <View style={[styles.content, { paddingHorizontal: S.lg }]}>
          {/* Duration chips */}
          <View style={[styles.durationRow, { marginBottom: S.xl, gap: S.sm }]}>
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
                      backgroundColor: active ? 'rgba(250, 250, 250, 0.1)' : 'transparent',
                      borderColor: active ? theme.primary : theme.outline,
                      borderWidth: 1,
                      opacity: isActive ? 0.35 : 1,
                      paddingHorizontal: S.md,
                      paddingVertical: S.sm,
                    },
                  ]}
                >
                  <Text style={[styles.durationText, { color: active ? theme.primary : theme.onSurfaceVariant, fontSize: F.body, fontWeight: active ? '900' : '600' }]}>
                    {min}m
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom duration chip */}
            <TouchableOpacity
              onPress={() => { if (!isActive) { Haptics.selectionAsync(); setCustomVisible(true); } }}
              disabled={isActive}
              style={[
                styles.durationChip,
                {
                  backgroundColor: !DURATIONS.includes(Math.round(totalSeconds / 60)) && totalSeconds > 0
                    ? 'rgba(250, 250, 250, 0.1)'
                    : 'transparent',
                  borderColor: !DURATIONS.includes(Math.round(totalSeconds / 60)) && totalSeconds > 0
                    ? theme.primary
                    : theme.outline,
                  borderWidth: 1,
                  opacity: isActive ? 0.35 : 1,
                  paddingHorizontal: S.md,
                  paddingVertical: S.sm,
                },
              ]}
            >
              <Text style={[styles.durationText, {
                color: !DURATIONS.includes(Math.round(totalSeconds / 60)) && totalSeconds > 0 ? theme.primary : theme.onSurfaceVariant,
                fontSize: F.subhead,
                fontWeight: '900'
              }]}>···</Text>
            </TouchableOpacity>
          </View>

          {/* Timer Visual */}
          <MotiView style={[styles.timerContainer, { width: timerSize, height: timerSize }]}>
            {/* Breath glow */}
            <MotiView
              from={{ scale: 0.88, opacity: 0 }}
              animate={isActive ? { scale: 1.14, opacity: isDark ? 0.18 : 0.10 } : { scale: 0.88, opacity: 0 }}
              transition={{ type: 'timing', duration: 4000, loop: isActive, repeatReverse: true }}
              style={[styles.breathGlow, {
                backgroundColor: theme.primary,
                borderRadius: timerSize / 2,
                width: timerSize,
                height: timerSize,
              }]}
            />

            <View style={[styles.timerCircle, {
              backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest,
              borderColor: progress > 0
                ? theme.primary + (isDark ? '60' : '40')
                : (isDark ? theme.primary + '30' : 'rgba(0,0,0,0.05)'),
              borderRadius: timerSize / 2,
              borderWidth: 8,
            }]}>
              <Text style={[styles.timerText, { color: theme.onSurface, fontSize: 56 }]}>
                {formatTime(seconds)}
              </Text>
              <Text style={[styles.currentTaskText, { color: theme.onSurfaceVariant, fontSize: F.body, maxWidth: timerSize * 0.75 }]} numberOfLines={1}>
                {currentTask || t.focusSession}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: isActive ? theme.primary + '20' : theme.surfaceContainerHigh, marginTop: 12 }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? theme.primary : theme.onSurfaceVariant }]} />
                <Text style={[styles.statusText, { color: isActive ? theme.primary : theme.onSurfaceVariant, fontSize: F.caption }]}>
                  {isActive ? (isTR ? 'ÇALIŞIYOR' : 'RUNNING') : seconds === totalSeconds ? (isTR ? 'HAZIR' : 'READY') : (isTR ? 'DURAKLATILDI' : 'PAUSED')}
                </Text>
              </View>
            </View>
          </MotiView>

          {/* Controls */}
          <View style={[styles.controlsRow, { marginTop: S.xl, gap: S.xl }]}>
            <TouchableOpacity
              onPress={resetTimer}
              style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow, width: 56, height: 56, borderRadius: R.lg }]}
            >
              <RotateCcw size={24} color={theme.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTimer}
              style={[styles.playBtn, { backgroundColor: theme.primary, shadowColor: isDark ? theme.primary : '#000', width: 84, height: 84, borderRadius: 42 }]}
            >
              <LinearGradient
                colors={isDark ? [theme.primary, '#3367ff'] : [theme.primary, theme.primaryContainer]}
                style={styles.btnGradient}
              >
                {isActive
                  ? <Pause size={32} color={theme.onPrimary} fill={theme.onPrimary} />
                  : <Play size={32} color={theme.onPrimary} fill={theme.onPrimary} />}
              </LinearGradient>
            </TouchableOpacity>

            <View style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow, width: 56, height: 56, borderRadius: R.lg }]}>
              <Text style={[styles.progressText, { color: theme.onSurfaceVariant, fontSize: F.body }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>

          {/* End session */}
          <AnimatePresence>
            {sessionStarted && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: 10 }}
                transition={{ type: 'timing', duration: 300 }}
                style={{ marginTop: S.lg, alignItems: 'center' }}
              >
                <TouchableOpacity
                  onPress={finishEarly}
                  style={[styles.finishBtn, { borderColor: theme.tertiary + '50', backgroundColor: theme.tertiary + '12' }]}
                >
                  <CheckCircle2 size={15} color={theme.tertiary} />
                  <Text style={[styles.finishText, { color: theme.tertiary, fontSize: F.body }]}>
                    {isTR ? 'Seansı Bitir' : 'End Session'}
                  </Text>
                </TouchableOpacity>
              </MotiView>
            )}
          </AnimatePresence>
        </View>

        <View style={[styles.footer, { padding: S.xl }]}>
          <Text style={[styles.quote, { color: theme.onSurfaceVariant, fontSize: F.body }]}>{quote}</Text>
        </View>
      </SafeAreaView>

      {/* Custom Duration Modal */}
      <Modal visible={customVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCustomVisible(false)} />
          <MotiView
            from={{ translateY: 60, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 18 }}
            style={[styles.customSheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
            <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
              {isTR ? 'Özel Süre' : 'Custom Duration'}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
              {isTR ? '1 – 480 dakika arası' : '1 – 480 minutes'}
            </Text>

            <View style={[styles.inputRow, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
              <TextInput
                value={customInput}
                onChangeText={setCustomInput}
                keyboardType="number-pad"
                maxLength={3}
                placeholder={isTR ? 'dakika' : 'minutes'}
                placeholderTextColor={theme.onSurfaceVariant + '80'}
                style={[styles.customInput, { color: theme.onSurface, fontSize: 32 }]}
                autoFocus
                onSubmitEditing={applyCustomDuration}
              />
              <Text style={[styles.minLabel, { color: theme.onSurfaceVariant }]}>min</Text>
            </View>

            <TouchableOpacity
              onPress={applyCustomDuration}
              style={[styles.applyBtn, { backgroundColor: theme.primary, opacity: customInput.length > 0 ? 1 : 0.4 }]}
            >
              <Text style={[styles.applyBtnText, { color: theme.onPrimary }]}>{isTR ? 'Uygula' : 'Apply'}</Text>
            </TouchableOpacity>
          </MotiView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg },
  closeBtn: { width: 44, height: 44, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  badgeText: { fontWeight: '900', letterSpacing: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  durationRow: { flexDirection: 'row' },
  durationChip: { borderRadius: 100 },
  durationText: { fontWeight: '800' },
  timerContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  timerCircle: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
  timerText: { fontWeight: '900', letterSpacing: -2 },
  currentTaskText: { fontWeight: '600', marginTop: 8, textAlign: 'center' },
  breathGlow: { position: 'absolute', zIndex: -1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontWeight: '900', letterSpacing: 1.5 },
  controlsRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center' },
  playBtn: { overflow: 'hidden', elevation: 8, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  btnGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  progressText: { fontWeight: '900' },
  finishBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1 },
  finishText: { fontWeight: '700', letterSpacing: 0.3 },
  footer: { alignItems: 'center' },
  quote: { fontStyle: 'italic', textAlign: 'center', opacity: 0.5 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  customSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: S.lg, paddingBottom: S.xxl, alignItems: 'center', gap: S.sm },
  sheetHandle: { width: 36, height: 4, borderRadius: R.sm, marginBottom: S.sm },
  sheetTitle: { fontSize: F.title, fontWeight: '800', letterSpacing: -0.5 },
  sheetSub: { fontSize: F.body, fontWeight: '600', opacity: 0.5, marginBottom: S.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.xs, gap: S.sm, marginBottom: S.sm },
  customInput: { fontWeight: '900', letterSpacing: -1, minWidth: 80, textAlign: 'center' },
  minLabel: { fontSize: F.subhead, fontWeight: '700', opacity: 0.5 },
  applyBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
  applyBtnText: { color: 'white', fontWeight: '900', fontSize: F.subhead, letterSpacing: 0.5 },
});
