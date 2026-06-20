import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Modal, TextInput, KeyboardAvoidingView, AppState, Keyboard, Animated, ScrollView } from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import Svg, { Circle, G } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles, CheckCircle2, Pencil, Timer, ChevronRight, Coffee, Wind, CloudRain } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import { useTaskStore } from '../store/useTaskStore';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { FocusService } from '../services/api';
import { useAchievementStore } from '../store/useAchievementStore';
import { checkFocusAchievement } from '../utils/achievements';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { getRandomQuote } from '../constants/Quotes';
import { S, R, F } from '../constants/tokens';

const DURATIONS = [15, 25, 50, 90];
const POMODORO_WORK_MINS = 25;
const POMODORO_SHORT_BREAK = 5;
const POMODORO_LONG_BREAK = 15;

type AmbientSound = 'off' | 'rain' | 'cafe' | 'forest';

const SOUND_LABELS: Record<AmbientSound, { icon: React.ComponentType<any> | null; labelTr: string; labelEn: string }> = {
  off: { icon: null, labelTr: 'Sessiz', labelEn: 'Off' },
  rain: { icon: CloudRain, labelTr: 'Yağmur', labelEn: 'Rain' },
  cafe: { icon: Coffee, labelTr: 'Kafe', labelEn: 'Café' },
  forest: { icon: Wind, labelTr: 'Orman', labelEn: 'Forest' },
};

export default function FocusScreen() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguageStore();
  const { tasks } = useTaskStore();

  const {
    isActive, seconds, totalSeconds,
    setIsActive, tick, reset, setDuration, currentTask, setCurrentTask,
    rehydrateTimer, addFocusMinutes,
    pomodoroMode, pomodoroRound, pomodoroPhase,
    togglePomodoroMode, nextPomodoroPhase,
  } = useFocusStore();

  const completedRef = useRef(false);
  const { trigger: triggerAchievement } = useAchievementStore();

  // Sound
  const soundRef = useRef<AudioPlayer | null>(null);
  const [ambientSound, setAmbientSound] = useState<AmbientSound>('off');

  // Task picker
  const [taskPickerVisible, setTaskPickerVisible] = useState(false);
  const incompleteTasks = tasks.filter(t => !t.isCompleted);

  // Custom duration
  const [customVisible, setCustomVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState(false);
  const customInputRef = useRef<TextInput>(null);

  // Task inline edit
  const [taskEditMode, setTaskEditMode] = useState(false);
  const [taskEditInput, setTaskEditInput] = useState('');
  const taskInputRef = useRef<TextInput>(null);

  // Pomodoro transition overlay
  const [pomodoroTransition, setPomodoroTransition] = useState<{ visible: boolean; type: 'break' | 'work'; isLong?: boolean }>({ visible: false, type: 'break' });

  // Session summary
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryMinutes, setSummaryMinutes] = useState(0);
  const [summaryCompleted, setSummaryCompleted] = useState(false);

  const [quote, setQuote] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  const timerSize = Math.min(width * 0.72, height * 0.35);
  const elapsed = totalSeconds - seconds;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
  const sessionStarted = elapsed > 0;

  const { panResponder: customPan, animatedStyle: customSlide, prepare: prepareCustom, slideIn: customSlideIn } = useSwipeToDismiss({
    onDismiss: () => setCustomVisible(false),
  });
  const { panResponder: pickerPan, animatedStyle: pickerSlide, prepare: preparePicker, slideIn: pickerSlideIn } = useSwipeToDismiss({
    onDismiss: () => setTaskPickerVisible(false),
  });

  // ── Ambient sound ────────────────────────────────────────────────────────
  const playAmbientSound = async (type: AmbientSound) => {
    if (soundRef.current) {
      try { soundRef.current.remove(); } catch {}
      soundRef.current = null;
    }
    if (type === 'off') return;
    try {
      const sources: Record<string, any> = {
        rain: require('../assets/sounds/rain.wav'),
        cafe: require('../assets/sounds/cafe.wav'),
        forest: require('../assets/sounds/forest.wav'),
      };
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'mixWithOthers',
      });
      const player = createAudioPlayer(sources[type]);
      player.loop = true;
      player.volume = 0.4;
      player.play();
      soundRef.current = player;
    } catch (e) {
      console.warn('Ambient sound error:', e);
    }
  };

  useEffect(() => {
    return () => { try { soundRef.current?.remove(); } catch {} };
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => { rehydrateTimer(); }, []);

  useFocusEffect(useCallback(() => {
    setQuote(getRandomQuote(language));
  }, [language]));

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        rehydrateTimer();
      } else if (next === 'background') {
        const { isActive: active, seconds: secs, totalSeconds: total } = useFocusStore.getState();
        if (active && total > 0) {
          const elapsed = Math.max(1, Math.round((total - secs) / 60));
          FocusService.saveSession(currentTask || 'Focus', elapsed, false).catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, [currentTask]);

  // ── Session completion / Pomodoro transitions ─────────────────────────────
  useEffect(() => {
    if (seconds === 0 && totalSeconds > 0 && !completedRef.current) {
      completedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const { pomodoroMode: isPomo, pomodoroPhase: phase, pomodoroRound: round } = useFocusStore.getState();

      if (isPomo) {
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 500);

        if (phase === 'work') {
          const minutes = Math.round(totalSeconds / 60);
          FocusService.saveSession(currentTask || 'Focus', minutes, true).catch(() => {});
          addFocusMinutes(minutes);

          // Check focus achievements
          FocusService.getStats().then(s => {
            const total = (s.weeklyFocus || []).reduce((a: number, d: any) => a + (d.minutes || 0), 0);
            const ach = checkFocusAchievement(total);
            if (ach) triggerAchievement(ach);
          }).catch(() => {});

          const isLongBreak = round >= 4;
          nextPomodoroPhase();
          const breakMins = isLongBreak ? POMODORO_LONG_BREAK : POMODORO_SHORT_BREAK;
          setTimeout(() => {
            setDuration(breakMins);
            useFocusStore.setState({ isActive: true, lastActiveAt: Date.now() });
          }, 600);
          setPomodoroTransition({ visible: true, type: 'break', isLong: isLongBreak });
          setTimeout(() => setPomodoroTransition(p => ({ ...p, visible: false })), 3500);
        } else {
          // Break finished → next work round
          nextPomodoroPhase();
          setTimeout(() => { setDuration(POMODORO_WORK_MINS); }, 400);
          setPomodoroTransition({ visible: true, type: 'work' });
          setTimeout(() => setPomodoroTransition(p => ({ ...p, visible: false })), 3500);
        }
      } else {
        // Standard mode
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
        const minutes = Math.round(totalSeconds / 60);
        FocusService.saveSession(currentTask || 'Focus', minutes, true).catch(() => {});
        addFocusMinutes(minutes);
        FocusService.getStats().then(s => {
          const total = (s.weeklyFocus || []).reduce((a: number, d: any) => a + (d.minutes || 0), 0);
          const ach = checkFocusAchievement(total);
          if (ach) triggerAchievement(ach);
        }).catch(() => {
          const ach = checkFocusAchievement(minutes);
          if (ach) triggerAchievement(ach);
        });
        setSummaryMinutes(minutes);
        setSummaryCompleted(true);
        setSummaryVisible(true);
      }
    }
    if (isActive && seconds > 0) completedRef.current = false;
  }, [isActive, seconds]);

  // ── Actions ───────────────────────────────────────────────────────────────
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
    addFocusMinutes(minutesDone);
    setSummaryMinutes(minutesDone);
    setSummaryCompleted(false);
    setSummaryVisible(true);
  };

  const applyCustomDuration = () => {
    const mins = parseInt(customInput, 10);
    if (!isNaN(mins) && mins >= 1 && mins <= 480) {
      Haptics.selectionAsync();
      setDuration(mins);
      setCustomInput('');
      setCustomVisible(false);
      setCustomError(false);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCustomError(true);
      setTimeout(() => setCustomError(false), 700);
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const openTaskPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    preparePicker();
    setTaskPickerVisible(true);
  };

  const selectTask = (title: string) => {
    setCurrentTask(title);
    setTaskPickerVisible(false);
    Haptics.selectionAsync();
  };

  const startBreak = (mins: number) => {
    setSummaryVisible(false);
    completedRef.current = false;
    setDuration(mins);
    useFocusStore.setState({ isActive: true, lastActiveAt: Date.now() });
  };

  // ── Pomodoro round dots ───────────────────────────────────────────────────
  const PomodoroIndicator = () => (
    <View style={styles.pomodoroRow}>
      <View style={[styles.phaseBadge, { backgroundColor: pomodoroPhase === 'work' ? theme.primary + '20' : theme.tertiary + '20' }]}>
        <Text style={[styles.phaseLabel, { color: pomodoroPhase === 'work' ? theme.primary : theme.tertiary }]}>
          {pomodoroPhase === 'work'
            ? (language === 'tr' ? 'ÇALIŞMA' : 'WORK')
            : (language === 'tr' ? 'MOLA' : 'BREAK')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        {[1, 2, 3, 4].map(i => (
          <View
            key={i}
            style={{
              width: i === pomodoroRound ? 10 : 7,
              height: i === pomodoroRound ? 10 : 7,
              borderRadius: 5,
              backgroundColor: i < pomodoroRound
                ? theme.primary
                : i === pomodoroRound
                  ? (pomodoroPhase === 'work' ? theme.primary : theme.tertiary)
                  : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 11, color: theme.onSurfaceVariant, fontWeight: '600', opacity: 0.6 }}>
        {language === 'tr' ? `Tur ${pomodoroRound}/4` : `Round ${pomodoroRound}/4`}
      </Text>
    </View>
  );

  // ── Ambient sound row ─────────────────────────────────────────────────────
  const AmbientRow = () => (
    <View style={styles.ambientRow}>
      {(['off', 'rain', 'cafe', 'forest'] as AmbientSound[]).map(type => {
        const active = ambientSound === type;
        const cfg = SOUND_LABELS[type];
        const IconComp = cfg.icon;
        return (
          <TouchableOpacity
            key={type}
            onPress={() => {
              const next = active ? 'off' : type;
              setAmbientSound(next);
              playAmbientSound(next);
              Haptics.selectionAsync();
            }}
            style={[
              styles.ambientBtn,
              {
                backgroundColor: active ? (isDark ? theme.primary + '25' : theme.primary + '15') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                borderColor: active ? theme.primary + '60' : 'transparent',
              },
            ]}
          >
            {IconComp
              ? <IconComp size={15} color={active ? theme.primary : theme.onSurfaceVariant} />
              : <X size={13} color={active ? theme.primary : theme.onSurfaceVariant} />}
            <Text style={[styles.ambientLabel, { color: active ? theme.primary : theme.onSurfaceVariant }]}>
              {language === 'tr' ? cfg.labelTr : cfg.labelEn}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────
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

          <View style={[styles.badge, { backgroundColor: theme.primary + '15' }]}>
            <Sparkles size={11} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary, fontSize: F.caption, letterSpacing: 1 }]}>
              {t.focusLabel || t.deepFocus}
            </Text>
          </View>

          {/* Pomodoro toggle */}
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); togglePomodoroMode(); if (!pomodoroMode) setDuration(POMODORO_WORK_MINS); }}
            style={[
              styles.pomodoroToggle,
              {
                backgroundColor: pomodoroMode ? theme.primary + '20' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                borderColor: pomodoroMode ? theme.primary + '50' : 'transparent',
              },
            ]}
          >
            <Timer size={14} color={pomodoroMode ? theme.primary : theme.onSurfaceVariant} />
            <Text style={[styles.pomodoroToggleText, { color: pomodoroMode ? theme.primary : theme.onSurfaceVariant }]}>
              {language === 'tr' ? 'Pomodoro' : 'Pomodoro'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.content, { paddingHorizontal: S.lg }]}>

          {/* Duration chips (standard mode) / Pomodoro indicator */}
          {pomodoroMode ? (
            <PomodoroIndicator />
          ) : (
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
                        backgroundColor: active ? 'rgba(250,250,250,0.1)' : 'transparent',
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
              <TouchableOpacity
                onPress={() => { if (!isActive) { prepareCustom(); Haptics.selectionAsync(); setCustomVisible(true); } }}
                disabled={isActive}
                style={[
                  styles.durationChip,
                  {
                    backgroundColor: !DURATIONS.includes(Math.round(totalSeconds / 60)) && totalSeconds > 0 ? 'rgba(250,250,250,0.1)' : 'transparent',
                    borderColor: !DURATIONS.includes(Math.round(totalSeconds / 60)) && totalSeconds > 0 ? theme.primary : theme.outline,
                    borderWidth: 1,
                    opacity: isActive ? 0.35 : 1,
                    paddingHorizontal: S.md,
                    paddingVertical: S.sm,
                  },
                ]}
              >
                <Text style={[styles.durationText, {
                  color: !DURATIONS.includes(Math.round(totalSeconds / 60)) && totalSeconds > 0 ? theme.primary : theme.onSurfaceVariant,
                  fontSize: F.subhead, fontWeight: '900',
                }]}>···</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Timer */}
          <MotiView style={[styles.timerContainer, { width: timerSize, height: timerSize }]}>
            {/* Breath glow */}
            <MotiView
              from={{ scale: 0.88, opacity: 0 }}
              animate={isActive ? { scale: 1.14, opacity: isDark ? 0.18 : 0.10 } : { scale: 0.88, opacity: 0 }}
              transition={{ type: 'timing', duration: 4000, loop: isActive, repeatReverse: true }}
              style={[styles.breathGlow, { backgroundColor: pomodoroPhase === 'break' && pomodoroMode ? theme.tertiary : theme.primary, borderRadius: timerSize / 2, width: timerSize, height: timerSize }]}
            />

            {/* SVG ring */}
            {(() => {
              const r = (timerSize / 2) - 6;
              const circumference = 2 * Math.PI * r;
              const offset = circumference * (1 - progress);
              const strokeColor = pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary;
              return (
                <Svg width={timerSize} height={timerSize} style={{ position: 'absolute', zIndex: 2 }}>
                  <G rotation={-90} origin={`${timerSize / 2}, ${timerSize / 2}`}>
                    <Circle cx={timerSize / 2} cy={timerSize / 2} r={r} fill="none" stroke={isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.08)'} strokeWidth={8} />
                    {progress > 0 && (
                      <Circle cx={timerSize / 2} cy={timerSize / 2} r={r} fill="none" stroke={strokeColor} strokeWidth={8}
                        strokeDasharray={`${circumference}`} strokeDashoffset={`${offset}`} strokeLinecap="round" />
                    )}
                  </G>
                </Svg>
              );
            })()}

            <View style={[styles.timerCircle, {
              backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest,
              borderRadius: timerSize / 2,
            }]}>
              <Text style={[styles.timerText, { color: theme.onSurface, fontSize: 56 }]}>
                {formatTime(seconds)}
              </Text>

              {/* Task display — tap to edit inline, long-press to open picker */}
              {taskEditMode ? (
                <TextInput
                  ref={taskInputRef}
                  value={taskEditInput}
                  onChangeText={setTaskEditInput}
                  onSubmitEditing={() => { setCurrentTask(taskEditInput.trim() || ''); setTaskEditMode(false); }}
                  onBlur={() => { setCurrentTask(taskEditInput.trim() || ''); setTaskEditMode(false); }}
                  returnKeyType="done"
                  style={[styles.currentTaskText, { color: theme.primary, fontSize: F.body, maxWidth: timerSize * 0.75, borderBottomWidth: 1, borderBottomColor: theme.primary + '60', paddingBottom: 2, minWidth: 120, textAlign: 'center' }]}
                  autoCapitalize="none"
                  selectTextOnFocus
                />
              ) : (
                <TouchableOpacity
                  onPress={() => { setTaskEditInput(currentTask || ''); setTaskEditMode(true); setTimeout(() => taskInputRef.current?.focus(), 80); }}
                  onLongPress={openTaskPicker}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: timerSize * 0.8 }}
                  accessibilityLabel={language === 'tr' ? 'Görev seç veya düzenle' : 'Select or edit task'}
                >
                  <Text style={[styles.currentTaskText, { color: theme.onSurfaceVariant, fontSize: F.body, maxWidth: timerSize * 0.68 }]} numberOfLines={1}>
                    {currentTask || t.focusSession}
                  </Text>
                  <Pencil size={11} color={theme.onSurfaceVariant} style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              )}

              {/* Status badge */}
              <View style={[styles.statusBadge, { backgroundColor: isActive ? (pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary + '20' : theme.primary + '20') : theme.surfaceContainerHigh, marginTop: 12 }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? (pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary) : theme.onSurfaceVariant }]} />
                <Text style={[styles.statusText, { color: isActive ? (pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary) : theme.onSurfaceVariant, fontSize: F.caption }]}>
                  {isActive ? t.focusRunning : seconds === totalSeconds ? t.focusReady : t.focusPaused}
                </Text>
              </View>
            </View>
          </MotiView>

          {/* Task picker button (below timer) */}
          <TouchableOpacity
            onPress={openTaskPicker}
            style={[styles.taskPickerBtn, {
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }]}
          >
            <Text style={[styles.taskPickerLabel, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
              {currentTask
                ? currentTask
                : (language === 'tr' ? 'Görev seç...' : 'Pick a task...')}
            </Text>
            <ChevronRight size={14} color={theme.onSurfaceVariant} style={{ opacity: 0.5 }} />
          </TouchableOpacity>

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
              style={[styles.playBtn, { backgroundColor: pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary, shadowColor: isDark ? theme.primary : '#000', width: 84, height: 84, borderRadius: 42 }]}
            >
              <LinearGradient
                colors={isDark
                  ? [pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary, '#3367ff']
                  : [pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary, theme.primaryContainer]}
                style={styles.btnGradient}
              >
                {isActive
                  ? <Pause size={32} color={theme.onPrimary} fill={theme.onPrimary} />
                  : <Play size={32} color={theme.onPrimary} fill={theme.onPrimary} />}
              </LinearGradient>
            </TouchableOpacity>

            <View style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow, width: 56, height: 56, borderRadius: R.lg }]}>
              <Text style={[styles.progressText, { color: progress > 0 ? theme.primary : theme.onSurfaceVariant, fontSize: 13 }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>

          {/* Ambient sound row */}
          <AmbientRow />

          {/* End session */}
          <AnimatePresence>
            {sessionStarted && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: 10 }}
                transition={{ type: 'timing', duration: 300 }}
                style={{ marginTop: S.md, alignItems: 'center' }}
              >
                <TouchableOpacity
                  onPress={finishEarly}
                  style={[styles.finishBtn, { borderColor: theme.tertiary + '50', backgroundColor: theme.tertiary + '12' }]}
                >
                  <CheckCircle2 size={15} color={theme.tertiary} />
                  <Text style={[styles.finishText, { color: theme.tertiary, fontSize: F.body }]}>
                    {t.focusEndSession}
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

      {/* ── Pomodoro transition overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {pomodoroTransition.visible && (
          <MotiView
            from={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', damping: 18, stiffness: 300 }}
            style={[StyleSheet.absoluteFill, styles.transitionOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.92)' }]}
            pointerEvents="none"
          >
            <Text style={{ fontSize: 56 }}>
              {pomodoroTransition.type === 'break' ? (pomodoroTransition.isLong ? '☕' : '🧘') : '🎯'}
            </Text>
            <Text style={[styles.transitionTitle, { color: theme.onSurface }]}>
              {pomodoroTransition.type === 'break'
                ? (pomodoroTransition.isLong
                  ? (language === 'tr' ? 'Uzun Mola!' : 'Long Break!')
                  : (language === 'tr' ? 'Kısa Mola!' : 'Short Break!'))
                : (language === 'tr' ? 'Odaklanma Vakti!' : 'Back to Work!')}
            </Text>
            <Text style={[styles.transitionSub, { color: theme.onSurfaceVariant }]}>
              {pomodoroTransition.type === 'break'
                ? (pomodoroTransition.isLong
                  ? (language === 'tr' ? '15 dakika dinlen, hak ettin.' : '15 min rest — you earned it.')
                  : (language === 'tr' ? '5 dakika nefes al.' : 'Take 5, breathe.'))
                : (language === 'tr' ? 'Hazır olduğunda başla.' : 'Start when ready.')}
            </Text>
          </MotiView>
        )}
      </AnimatePresence>

      {/* ── Task picker modal ─────────────────────────────────────────────────── */}
      <Modal visible={taskPickerVisible} transparent animationType="none" onShow={() => pickerSlideIn()} onRequestClose={() => setTaskPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setTaskPickerVisible(false)} />
          <Animated.View
            style={[
              pickerSlide,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                maxHeight: height * 0.7,
                paddingBottom: insets.bottom + S.lg,
              },
            ]}
          >
            <View {...pickerPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 4, alignItems: 'center' }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }} />
            </View>

            <View style={{ paddingHorizontal: S.lg, paddingVertical: S.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: F.title, fontWeight: '800', color: theme.onSurface, letterSpacing: -0.3 }}>
                {language === 'tr' ? 'Görev Seç' : 'Select Task'}
              </Text>
              <TouchableOpacity onPress={() => setTaskPickerVisible(false)} style={{ padding: S.sm }}>
                <X size={18} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: height * 0.5 }}>
              {/* Clear selection */}
              <TouchableOpacity
                onPress={() => selectTask('')}
                style={[styles.taskPickerItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskPickerItemTitle, { color: theme.onSurfaceVariant, fontStyle: 'italic' }]}>
                    {language === 'tr' ? 'Seçimi temizle' : 'Clear selection'}
                  </Text>
                </View>
              </TouchableOpacity>

              {incompleteTasks.length === 0 ? (
                <View style={{ padding: S.xl, alignItems: 'center' }}>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center', opacity: 0.6 }}>
                    {language === 'tr' ? 'Bekleyen görev yok.' : 'No pending tasks.'}
                  </Text>
                </View>
              ) : (
                incompleteTasks.slice(0, 50).map(task => {
                  const priorityDot = task.priority === 'High' ? '#ff3b30' : task.priority === 'Medium' ? '#ff9f0a' : '#34c759';
                  const isSelected = currentTask === task.title;
                  return (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => selectTask(task.title)}
                      style={[
                        styles.taskPickerItem,
                        {
                          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                          backgroundColor: isSelected ? theme.primary + '10' : 'transparent',
                        },
                      ]}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityDot, marginTop: 3, flexShrink: 0 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskPickerItemTitle, { color: isSelected ? theme.primary : theme.onSurface }]} numberOfLines={2}>
                          {task.title}
                        </Text>
                        {task.dueDate && (
                          <Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.6, marginTop: 2 }}>
                            {new Date(task.dueDate).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        )}
                      </View>
                      {isSelected && <CheckCircle2 size={16} color={theme.primary} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Custom Duration Modal ─────────────────────────────────────────────── */}
      <Modal visible={customVisible} transparent animationType="none" onShow={() => customSlideIn()}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCustomVisible(false)} />
          <Animated.View
            style={[
              customSlide,
              styles.customSheet,
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', paddingBottom: kbHeight > 0 ? S.md : S.xxl, borderBottomLeftRadius: kbHeight > 0 ? R.lg : 0, borderBottomRightRadius: kbHeight > 0 ? R.lg : 0, maxHeight: height - insets.top - 16 },
            ]}
          >
            <View {...customPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>{t.focusCustomDuration}</Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>{t.focusCustomRange}</Text>
            <MotiView
              animate={customError ? { translateX: [-8, 8, -6, 6, -4, 4, -2, 2, 0] } : { translateX: 0 }}
              transition={{ type: 'timing', duration: 620 }}
            >
              <View style={[styles.inputRow, { borderColor: customError ? theme.error : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'), backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <TextInput
                  ref={customInputRef}
                  value={customInput}
                  onChangeText={(v) => { setCustomInput(v); if (customError) setCustomError(false); }}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder={t.focusCustomPlaceholder}
                  placeholderTextColor={customError ? theme.error + '80' : theme.onSurfaceVariant + '80'}
                  style={[styles.customInput, { color: customError ? theme.error : theme.onSurface, fontSize: 32 }]}
                  onSubmitEditing={applyCustomDuration}
                />
                <Text style={[styles.minLabel, { color: customError ? theme.error : theme.onSurfaceVariant }]}>min</Text>
              </View>
            </MotiView>
            {customError && (
              <Text style={{ fontSize: F.caption, color: theme.error, fontWeight: '700' }}>{t.focusCustomError}</Text>
            )}
            <TouchableOpacity
              onPress={applyCustomDuration}
              style={[styles.applyBtn, { backgroundColor: theme.primary, opacity: customInput.length > 0 ? 1 : 0.4 }]}
            >
              <Text style={[styles.applyBtnText, { color: theme.onPrimary }]}>{t.focusCustomApply}</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Session Summary Modal ─────────────────────────────────────────────── */}
      <Modal visible={summaryVisible} transparent animationType="fade" onRequestClose={() => setSummaryVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: S.xl }}>
          <MotiView
            from={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 280 }}
            style={{ width: '100%', borderRadius: R.lg, backgroundColor: theme.surface, padding: S.xl, alignItems: 'center', gap: S.md }}
          >
            {/* Icon */}
            <MotiView
              from={{ scale: 0, rotate: '-20deg' }}
              animate={{ scale: 1, rotate: '0deg' }}
              transition={{ type: 'spring', damping: 14, stiffness: 300, delay: 120 }}
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: summaryCompleted ? theme.primaryContainer : theme.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}
            >
              {summaryCompleted
                ? <CheckCircle2 size={36} color={theme.primary} strokeWidth={2.5} />
                : <Sparkles size={36} color={theme.secondary} strokeWidth={2.5} />}
            </MotiView>

            <Text style={{ fontSize: F.title, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5, textAlign: 'center' }}>
              {summaryCompleted ? t.summaryGreatWork : t.summaryGoodStart}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ fontSize: 52, fontWeight: '900', color: theme.primary, letterSpacing: -2, lineHeight: 56 }}>
                {summaryMinutes}
              </Text>
              <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurfaceVariant, marginBottom: 4 }}>
                {t.summaryMinFocused}
              </Text>
            </View>

            {!!currentTask && (
              <Text style={{ fontSize: F.body, fontWeight: '600', color: theme.onSurfaceVariant, textAlign: 'center', opacity: 0.7 }} numberOfLines={2}>
                {currentTask}
              </Text>
            )}

            <View style={{ width: '100%', backgroundColor: (summaryCompleted ? theme.primaryContainer : theme.secondaryContainer) + '60', borderRadius: R.md, padding: S.md, gap: 4 }}>
              <Text style={{ fontSize: F.body, fontWeight: '700', color: summaryCompleted ? theme.primary : theme.secondary, lineHeight: 20 }}>
                {summaryCompleted ? t.summaryCoachCompleted : t.summaryCoachGoodStart}
              </Text>
              {summaryCompleted && (
                <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.7 }}>
                  {t.summaryBreakSuggestion}
                </Text>
              )}
            </View>

            <View style={{ width: '100%', height: 1, backgroundColor: theme.onSurface + '12', marginVertical: S.xs }} />

            {/* Break button (only after standard completed session) */}
            {summaryCompleted && !pomodoroMode && (
              <TouchableOpacity
                onPress={() => startBreak(5)}
                style={{ width: '100%', paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1, borderColor: theme.tertiary + '50', backgroundColor: theme.tertiary + '12', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
              >
                <Text style={{ fontSize: F.body, fontWeight: '800', color: theme.tertiary }}>
                  {language === 'tr' ? '5 dk Mola Başlat' : 'Start 5-min Break'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => { setSummaryVisible(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); reset(); router.replace('/'); }}
              style={{ width: '100%', paddingVertical: S.md, borderRadius: R.full, backgroundColor: theme.primary, alignItems: 'center' }}
            >
              <Text style={{ fontSize: F.subhead, fontWeight: '900', color: theme.onPrimary, letterSpacing: 0.5 }}>
                {t.summaryBackHome}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setSummaryVisible(false); completedRef.current = false; reset(); }}
              style={{ paddingVertical: S.sm }}
            >
              <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.6 }}>
                {t.summaryNewSession}
              </Text>
            </TouchableOpacity>
          </MotiView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg },
  closeBtn: { width: 44, height: 44, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  badgeText: { fontWeight: '900', letterSpacing: 1 },
  pomodoroToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.full, borderWidth: 1 },
  pomodoroToggleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  pomodoroRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.xl, justifyContent: 'center' },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
  phaseLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
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
  taskPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1, marginTop: S.md, maxWidth: 260, gap: S.sm },
  taskPickerLabel: { fontSize: F.caption, fontWeight: '600', flex: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center' },
  playBtn: { overflow: 'hidden', elevation: 8, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  btnGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  progressText: { fontWeight: '900' },
  ambientRow: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  ambientBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1 },
  ambientLabel: { fontSize: 11, fontWeight: '700' },
  finishBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1 },
  finishText: { fontWeight: '700', letterSpacing: 0.3 },
  footer: { alignItems: 'center' },
  quote: { fontStyle: 'italic', textAlign: 'center', opacity: 0.5 },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  customSheet: { borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.sm },
  sheetHandle: { width: 36, height: 4, borderRadius: R.sm, marginBottom: S.sm },
  sheetTitle: { fontSize: F.title, fontWeight: '800', letterSpacing: -0.5 },
  sheetSub: { fontSize: F.body, fontWeight: '600', opacity: 0.5, marginBottom: S.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.xs, gap: S.sm, marginBottom: S.sm },
  customInput: { fontWeight: '900', letterSpacing: -1, minWidth: 80, textAlign: 'center' },
  minLabel: { fontSize: F.subhead, fontWeight: '700', opacity: 0.5 },
  applyBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
  applyBtnText: { color: 'white', fontWeight: '900', fontSize: F.subhead, letterSpacing: 0.5 },
  taskPickerItem: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingHorizontal: S.lg, paddingVertical: S.md, borderBottomWidth: StyleSheet.hairlineWidth },
  taskPickerItemTitle: { fontSize: F.body, fontWeight: '600', lineHeight: 20 },
  transitionOverlay: { alignItems: 'center', justifyContent: 'center', gap: S.md },
  transitionTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  transitionSub: { fontSize: F.subhead, fontWeight: '600', textAlign: 'center', opacity: 0.7 },
});
