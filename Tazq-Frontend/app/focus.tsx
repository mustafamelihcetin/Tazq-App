import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Modal, TextInput, AppState, Animated, ScrollView, BackHandler } from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import Svg, { Circle, G } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles, CheckCircle2, Pencil, Timer, ChevronRight, Coffee, Wind, CloudRain, Flame, Waves } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import { useTaskStore } from '../store/useTaskStore';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { FocusService } from '../services/api';
import { useAchievementStore } from '../store/useAchievementStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { checkFocusAchievement } from '../utils/achievements';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { getRandomQuote } from '../constants/Quotes';
import { S, R, F } from '../constants/tokens';

// Named focus presets — each encodes work + break durations
const PRESETS = [
  { key: 'sprint',   labelTr: 'Sprint',   labelEn: 'Sprint',   workMins: 15, shortBreak: 3,  longBreak: 8,  descTr: '15dk hızlı odak',    descEn: '15m quick focus' },
  { key: 'classic',  labelTr: 'Klasik',   labelEn: 'Classic',  workMins: 25, shortBreak: 5,  longBreak: 15, descTr: '25dk standart odak', descEn: '25m standard focus' },
  { key: 'extended', labelTr: 'Uzatılmış',labelEn: 'Extended', workMins: 50, shortBreak: 10, longBreak: 20, descTr: '50dk derin odak',     descEn: '50m deep focus' },
  { key: 'ultra',    labelTr: 'Ultra',    labelEn: 'Ultra',    workMins: 90, shortBreak: 20, longBreak: 30, descTr: '90dk akış durumu',   descEn: '90m flow state' },
] as const;
type PresetKey = typeof PRESETS[number]['key'];

type AmbientSound = 'off' | 'rain' | 'cafe' | 'forest' | 'ocean' | 'fireplace';

const SOUND_LABELS: Record<AmbientSound, { icon: React.ComponentType<any> | null; labelTr: string; labelEn: string }> = {
  off:       { icon: null,      labelTr: 'Sessiz',   labelEn: 'Off'       },
  rain:      { icon: CloudRain, labelTr: 'Yağmur',   labelEn: 'Rain'      },
  cafe:      { icon: Coffee,    labelTr: 'Kafe',      labelEn: 'Café'      },
  forest:    { icon: Wind,      labelTr: 'Orman',     labelEn: 'Forest'    },
  ocean:     { icon: Waves,     labelTr: 'Okyanus',   labelEn: 'Ocean'     },
  fireplace: { icon: Flame,     labelTr: 'Şömine',   labelEn: 'Fireplace' },
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
  const { soundEffects } = usePrefsStore();

  // Sound
  const soundRef = useRef<AudioPlayer | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ambientSound, setAmbientSound] = useState<AmbientSound>('off');

  // Breath cue phase — synced to glow animation (4s per half-cycle)
  const [breathPhase, setBreathPhase] = useState<'in' | 'out'>('in');

  // Task picker
  const [taskPickerVisible, setTaskPickerVisible] = useState(false);
  const incompleteTasks = tasks.filter(t => !t.isCompleted);

  // Named preset selection
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('classic');
  const activePreset = PRESETS.find(p => p.key === selectedPreset) ?? PRESETS[1];

  // Custom duration wheel
  const [customVisible, setCustomVisible] = useState(false);
  const [wheelValue, setWheelValue] = useState(25);
  const wheelRef = useRef<ScrollView>(null);

  // Task inline edit
  const [taskEditMode, setTaskEditMode] = useState(false);
  const [taskEditInput, setTaskEditInput] = useState('');
  const taskInputRef = useRef<TextInput>(null);

  // Pomodoro transition overlay
  const [pomodoroTransition, setPomodoroTransition] = useState<{ visible: boolean; type: 'break' | 'work'; isLong?: boolean }>({ visible: false, type: 'break' });
  const [pomodoroInfoVisible, setPomodoroInfoVisible] = useState(false);

  // Session summary
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryMinutes, setSummaryMinutes] = useState(0);
  const [summaryCompleted, setSummaryCompleted] = useState(false);
  const [completionRitual, setCompletionRitual] = useState(false);

  const [quote, setQuote] = useState('');
  const WHEEL_ITEM_H = 56;
  const WHEEL_MINS = Array.from({ length: 180 }, (_, i) => i + 1);

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
  const TARGET_VOL = 0.4;
  const FADE_STEPS = 20;
  const FADE_MS = 16; // ~300ms total

  const clearFade = () => {
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
  };

  const stopAmbientSound = () => {
    clearFade();
    if (soundRef.current) {
      try { soundRef.current.pause(); soundRef.current.remove(); } catch {}
      soundRef.current = null;
    }
  };

  const stopAmbientSoundFaded = () => {
    clearFade();
    const player = soundRef.current;
    if (!player) return;
    let vol = player.volume;
    const stepVal = vol / FADE_STEPS;
    fadeIntervalRef.current = setInterval(() => {
      vol = Math.max(0, vol - stepVal);
      try { player.volume = vol; } catch {}
      if (vol <= 0) {
        clearFade();
        try { player.pause(); player.remove(); } catch {}
        soundRef.current = null;
      }
    }, FADE_MS);
  };

  const playAmbientSound = async (type: AmbientSound, fadeIn = false) => {
    stopAmbientSound();
    if (type === 'off') return;
    try {
      const sources: Record<string, any> = {
        rain:      require('../assets/sounds/rain.mp3'),
        cafe:      require('../assets/sounds/cafe.mp3'),
        forest:    require('../assets/sounds/forest.mp3'),
        ocean:     require('../assets/sounds/ocean.mp3'),
        fireplace: require('../assets/sounds/fireplace.mp3'),
      };
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'mixWithOthers',
      });
      const player = createAudioPlayer(sources[type]);
      player.loop = true;
      if (fadeIn) {
        player.volume = 0;
        player.play();
        soundRef.current = player;
        let vol = 0;
        const stepVal = TARGET_VOL / FADE_STEPS;
        fadeIntervalRef.current = setInterval(() => {
          vol = Math.min(vol + stepVal, TARGET_VOL);
          try { if (soundRef.current) soundRef.current.volume = vol; } catch {}
          if (vol >= TARGET_VOL) clearFade();
        }, FADE_MS);
      } else {
        player.volume = TARGET_VOL;
        player.play();
        soundRef.current = player;
      }
    } catch (e) {
      console.warn('Ambient sound error:', e);
    }
  };

  useEffect(() => {
    return () => { clearFade(); stopAmbientSound(); };
  }, []);

  // Session transitions: clear preview timer, manage sound
  useEffect(() => {
    if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
    if (isActive && ambientSound !== 'off') playAmbientSound(ambientSound);
    else if (!isActive) stopAmbientSound();
  }, [isActive]);

  // Sound changes during an active session
  useEffect(() => {
    if (!isActive) return;
    if (ambientSound === 'off') stopAmbientSound();
    else playAmbientSound(ambientSound);
  }, [ambientSound]);

  // Breath cue cycle
  useEffect(() => {
    if (!isActive) { setBreathPhase('in'); return; }
    const iv = setInterval(() => setBreathPhase(p => p === 'in' ? 'out' : 'in'), 4000);
    return () => clearInterval(iv);
  }, [isActive]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => { rehydrateTimer(); }, []);

  useFocusEffect(useCallback(() => {
    setQuote(getRandomQuote(language));
  }, [language]));

  // Android hardware back button — go home instead of closing app
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true; // prevent default (app close)
    });
    return () => sub.remove();
  }, [router]));


  const backgroundSavedRef = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        backgroundSavedRef.current = false;
        rehydrateTimer();
      } else if (next === 'background') {
        if (backgroundSavedRef.current) return;
        const { isActive: active, seconds: secs, totalSeconds: total } = useFocusStore.getState();
        if (active && total > 0) {
          backgroundSavedRef.current = true;
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
      if (soundEffects) try {
        const p = createAudioPlayer(require('../assets/sounds/timer_end.mp3'));
        p.volume = 0.8;
        p.play();
        setTimeout(() => { try { p.remove(); } catch {} }, 5000);
      } catch {}

      const { pomodoroMode: isPomo, pomodoroPhase: phase, pomodoroRound: round } = useFocusStore.getState();

      if (isPomo) {
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 500);

        if (phase === 'work') {
          const minutes = Math.round(totalSeconds / 60);
          FocusService.saveSession(currentTask || 'Focus', minutes, true).catch(() => {});
          addFocusMinutes(minutes);

          // Check focus achievements using lifetime total
          FocusService.getStats().then(s => {
            const total = Math.round((s.totalFocusHours || 0) * 60);
            const ach = checkFocusAchievement(total);
            if (ach) triggerAchievement(ach);
          }).catch(() => {});

          const isLongBreak = round >= 4;
          nextPomodoroPhase();
          const breakMins = isLongBreak ? activePreset.longBreak : activePreset.shortBreak;
          setTimeout(() => {
            setDuration(breakMins);
            useFocusStore.setState({ isActive: true, lastActiveAt: Date.now() });
          }, 600);
          setPomodoroTransition({ visible: true, type: 'break', isLong: isLongBreak });
          setTimeout(() => setPomodoroTransition(p => ({ ...p, visible: false })), 3500);
        } else {
          // Break finished → next work round
          nextPomodoroPhase();
          setTimeout(() => { setDuration(activePreset.workMins); }, 400);
          setPomodoroTransition({ visible: true, type: 'work' });
          setTimeout(() => setPomodoroTransition(p => ({ ...p, visible: false })), 3500);
        }
      } else {
        // Standard mode
        stopAmbientSound();
        setAmbientSound('off');
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
        const minutes = Math.round(totalSeconds / 60);
        FocusService.saveSession(currentTask || 'Focus', minutes, true).catch(() => {});
        addFocusMinutes(minutes);
        FocusService.getStats().then(s => {
          const total = Math.round((s.totalFocusHours || 0) * 60);
          const ach = checkFocusAchievement(total);
          if (ach) triggerAchievement(ach);
        }).catch(() => {
          const ach = checkFocusAchievement(minutes);
          if (ach) triggerAchievement(ach);
        });
        setSummaryMinutes(minutes);
        setSummaryCompleted(true);
        setCompletionRitual(true);
        setTimeout(() => { setCompletionRitual(false); setSummaryVisible(true); }, 1800);
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
    if (elapsed > 0) {
      const minutesDone = Math.max(1, Math.round(elapsed / 60));
      FocusService.saveSession(currentTask || 'Focus', minutesDone, false).catch(() => {});
      addFocusMinutes(minutesDone);
      stopAmbientSound();
      setAmbientSound('off');
    }
    completedRef.current = false;
    reset();
  };

  const finishEarly = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopAmbientSound();
    setAmbientSound('off');
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
    if (wheelValue >= 1 && wheelValue <= 180) {
      Haptics.selectionAsync();
      setDuration(wheelValue);
      setCustomVisible(false);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header — left/right slots are equal width so badge stays perfectly centered */}
        <View style={[styles.header, { paddingVertical: S.md }]}>
          <View style={{ width: 110, alignItems: 'flex-start' }}>
            <TouchableOpacity
              onPress={() => {
                if (elapsed > 0) {
                  stopAmbientSound();
                  setAmbientSound('off');
                  setIsActive(false);
                  const minutesDone = Math.max(1, Math.round(elapsed / 60));
                  FocusService.saveSession(currentTask || 'Focus', minutesDone, false).catch(() => {});
                  addFocusMinutes(minutesDone);
                }
                router.canGoBack() ? router.back() : router.replace('/');
              }}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
            >
              <X size={20} color={theme.onSurface} />
            </TouchableOpacity>
          </View>

          <View style={[styles.badge, { backgroundColor: theme.primary + '15' }]}>
            <Sparkles size={11} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary, fontSize: F.caption, letterSpacing: 1 }]}>
              {t.focusLabel || t.deepFocus}
            </Text>
          </View>

          {/* Pomodoro toggle + info — hidden during active session */}
          <View style={{ width: 110, alignItems: 'flex-end' }}>
            <AnimatePresence>
              {!isActive && (
                <MotiView
                  key="pomo-controls"
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'timing', duration: 220 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); togglePomodoroMode(); if (!pomodoroMode) setDuration(activePreset.workMins); }}
                    style={[
                      styles.pomodoroToggle,
                      {
                        backgroundColor: pomodoroMode ? theme.primary + '20' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                        borderColor: pomodoroMode ? theme.primary + '50' : 'transparent',
                      },
                    ]}
                  >
                    <Timer size={14} color={pomodoroMode ? theme.primary : theme.onSurfaceVariant} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPomodoroInfoVisible(true); }}
                    style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '900', color: theme.onSurfaceVariant }}>ⓘ</Text>
                  </TouchableOpacity>
                </MotiView>
              )}
            </AnimatePresence>
          </View>
        </View>

        <View style={[styles.content, { paddingHorizontal: S.lg }]}>

          {/* Preset chips (standard mode) / Pomodoro indicator */}
          {pomodoroMode ? (
            <PomodoroIndicator />
          ) : (
            <AnimatePresence>
              {!sessionStarted && (
                <MotiView
                  key="chips"
                  from={{ opacity: 0, translateY: -6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: -6 }}
                  transition={{ type: 'timing', duration: 220 }}
                >
                  <View style={[styles.durationRow, { marginBottom: S.xl, gap: S.sm, flexWrap: 'wrap', justifyContent: 'center' }]}>
                    {PRESETS.map((preset) => {
                      const isActive = selectedPreset === preset.key && PRESETS.some(p => p.workMins * 60 === totalSeconds && p.key === preset.key);
                      const isSelected = selectedPreset === preset.key;
                      return (
                        <TouchableOpacity
                          key={preset.key}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedPreset(preset.key);
                            setDuration(preset.workMins);
                          }}
                          style={[
                            styles.durationChip,
                            {
                              backgroundColor: isSelected ? theme.primary + '18' : 'transparent',
                              borderColor: isSelected ? theme.primary : theme.outline,
                              borderWidth: 1,
                              paddingHorizontal: S.md,
                              paddingVertical: S.sm,
                              flexDirection: 'column',
                              alignItems: 'center',
                              minWidth: 64,
                            },
                          ]}
                        >
                          <Text style={[styles.durationText, { color: isSelected ? theme.primary : theme.onSurfaceVariant, fontSize: F.caption + 1, fontWeight: isSelected ? '900' : '700', letterSpacing: 0.2 }]}>
                            {language === 'tr' ? preset.labelTr : preset.labelEn}
                          </Text>
                          <Text style={{ fontSize: 10, color: isSelected ? theme.primary : theme.onSurfaceVariant, opacity: 0.7, fontWeight: '600', marginTop: 1 }}>
                            {preset.workMins}m
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      onPress={() => { prepareCustom(); Haptics.selectionAsync(); setCustomVisible(true); }}
                      style={[
                        styles.durationChip,
                        {
                          backgroundColor: !PRESETS.some(p => p.workMins * 60 === totalSeconds) && totalSeconds > 0 ? theme.primary + '18' : 'transparent',
                          borderColor: !PRESETS.some(p => p.workMins * 60 === totalSeconds) && totalSeconds > 0 ? theme.primary : theme.outline,
                          borderWidth: 1,
                          paddingHorizontal: S.md,
                          paddingVertical: S.sm,
                          flexDirection: 'column',
                          alignItems: 'center',
                          minWidth: 64,
                        },
                      ]}
                    >
                      <Text style={[styles.durationText, {
                        color: !PRESETS.some(p => p.workMins * 60 === totalSeconds) && totalSeconds > 0 ? theme.primary : theme.onSurfaceVariant,
                        fontSize: F.subhead, fontWeight: '900',
                      }]}>···</Text>
                      <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, opacity: 0.7, fontWeight: '600', marginTop: 1 }}>
                        {language === 'tr' ? 'Özel' : 'Custom'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </MotiView>
              )}
            </AnimatePresence>
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
              <Text style={[styles.timerText, { color: theme.onSurface, fontSize: Math.round(timerSize * 0.195) }]}>
                {formatTime(seconds)}
              </Text>

              {/* Task display — read-only during session, editable before */}
              {isActive ? (
                <Text style={[styles.currentTaskText, { color: theme.onSurfaceVariant, fontSize: F.body, maxWidth: timerSize * 0.75, textAlign: 'center' }]} numberOfLines={1}>
                  {currentTask || t.focusSession}
                </Text>
              ) : taskEditMode ? (
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
                  underlineColorAndroid="transparent"
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

              {/* Breath cue — fades between phases in sync with glow animation */}
              {isActive && (
                <MotiView
                  key={breathPhase}
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'timing', duration: 1400 }}
                  style={{ marginTop: 7 }}
                >
                  <Text style={{ fontSize: 9, letterSpacing: 2.5, fontWeight: '700', textAlign: 'center', color: pomodoroPhase === 'break' && pomodoroMode ? theme.tertiary : theme.primary, opacity: 0.4 }}>
                    {breathPhase === 'in'
                      ? (language === 'tr' ? 'NEFES AL' : 'INHALE')
                      : (language === 'tr' ? 'NEFES VER' : 'EXHALE')}
                  </Text>
                </MotiView>
              )}
            </View>
          </MotiView>

          {/* Controls */}
          <View style={[styles.controlsRow, { marginTop: S.xl, gap: S.xl }]}>
            <View style={{ width: 56, height: 56 }}>
              <AnimatePresence>
                {!isActive && (
                  <MotiView
                    key="reset-btn"
                    from={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: 'timing', duration: 200 }}
                  >
                    <TouchableOpacity
                      onPress={resetTimer}
                      disabled={!sessionStarted}
                      style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow, width: 56, height: 56, borderRadius: R.lg, opacity: sessionStarted ? 1 : 0.3 }]}
                    >
                      <RotateCcw size={24} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>
                  </MotiView>
                )}
              </AnimatePresence>
            </View>

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

            <View style={{ width: 56, height: 56 }} />
          </View>

          {/* Ambient sound row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.ambientRow}
            keyboardShouldPersistTaps="handled"
          >
            {(['rain', 'cafe', 'forest', 'ocean', 'fireplace'] as AmbientSound[]).map(type => {
              const active = ambientSound === type;
              const cfg = SOUND_LABELS[type];
              const IconComp = cfg.icon!;
              return (
                <TouchableOpacity
                  key={type}
                  activeOpacity={0.7}
                  onPress={() => {
                    const next = active ? 'off' : type;
                    setAmbientSound(next);
                    Haptics.selectionAsync();
                    if (!isActive) {
                      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                      if (next !== 'off') {
                        playAmbientSound(next, true);
                        previewTimerRef.current = setTimeout(() => {
                          if (!useFocusStore.getState().isActive) stopAmbientSoundFaded();
                          previewTimerRef.current = null;
                        }, 1800);
                      } else {
                        stopAmbientSoundFaded();
                      }
                    }
                  }}
                  style={[
                    styles.ambientBtn,
                    active
                      ? { backgroundColor: isDark ? theme.primary + '28' : theme.primary + '14', borderColor: theme.primary + '55' }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderColor: 'transparent' },
                  ]}
                >
                  <IconComp size={14} color={active ? theme.primary : theme.onSurfaceVariant} strokeWidth={active ? 2.2 : 1.8} />
                  <Text style={[styles.ambientLabel, { color: active ? theme.primary : theme.onSurfaceVariant, opacity: active ? 1 : 0.7 }]}>
                    {language === 'tr' ? cfg.labelTr : cfg.labelEn}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Pomodoro break guidance */}
          <AnimatePresence>
            {pomodoroMode && pomodoroPhase === 'break' && isActive && (
              <MotiView
                key="break-tip"
                from={{ opacity: 0, translateY: 6 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: 6 }}
                transition={{ type: 'timing', duration: 400 }}
                style={{ alignItems: 'center', marginTop: S.sm }}
              >
                <Text style={{ fontSize: F.caption, color: theme.tertiary, fontWeight: '700', letterSpacing: 0.2, opacity: 0.85 }}>
                  {language === 'tr' ? '💧 Su iç  ·  Esne  ·  Gözlerini kapat' : '💧 Hydrate  ·  Stretch  ·  Close your eyes'}
                </Text>
              </MotiView>
            )}
          </AnimatePresence>

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

        <AnimatePresence>
          {!isActive && (
            <MotiView
              key="footer-quote"
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'timing', duration: 350 }}
            >
              <View style={[styles.footer, { padding: S.xl }]}>
                <Text style={[styles.quote, { color: theme.onSurfaceVariant, fontSize: F.body }]}>{quote}</Text>
              </View>
            </MotiView>
          )}
        </AnimatePresence>
      </SafeAreaView>

      {/* ── Session completion ritual overlay ────────────────────────────────── */}
      <AnimatePresence>
        {completionRitual && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ type: 'timing', duration: 400 }}
            style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.78)' : 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center', gap: S.lg }]}
            pointerEvents="none"
          >
            <MotiView
              from={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 11, stiffness: 180, delay: 100 }}
              style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
            >
              <CheckCircle2 size={44} color={theme.primary} strokeWidth={2} />
            </MotiView>
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 380, delay: 320 }}
              style={{ alignItems: 'center', gap: S.sm }}
            >
              <Text style={{ fontSize: F.title, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}>
                {language === 'tr' ? 'Tamamlandı' : 'Complete'}
              </Text>
              <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant, fontWeight: '600', opacity: 0.7 }}>
                {language === 'tr' ? 'Harika bir seans ✦' : 'Great session ✦'}
              </Text>
            </MotiView>
          </MotiView>
        )}
      </AnimatePresence>

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
                  ? (language === 'tr' ? `${activePreset.longBreak} dakika dinlen, hak ettin.` : `${activePreset.longBreak} min rest — you earned it.`)
                  : (language === 'tr' ? `${activePreset.shortBreak} dakika nefes al.` : `${activePreset.shortBreak} min — breathe.`))
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
                  const priorityDot = task.priority === 'High' ? theme.priorityHigh : task.priority === 'Medium' ? theme.priorityMedium : theme.priorityLow;
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
      <Modal
        visible={customVisible}
        transparent
        animationType="none"
        onShow={() => {
          customSlideIn();
          setTimeout(() => {
            wheelRef.current?.scrollTo({ y: (wheelValue - 1) * WHEEL_ITEM_H, animated: false });
          }, 50);
        }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCustomVisible(false)} />
          <Animated.View
            style={[
              customSlide,
              styles.customSheet,
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', paddingBottom: S.xxl },
            ]}
          >
            <View {...customPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>{t.focusCustomDuration}</Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>{language === 'tr' ? '1 – 180 dakika' : '1 – 180 minutes'}</Text>

            {/* Drum-roll wheel */}
            <View style={{ height: WHEEL_ITEM_H * 5, width: '100%', alignItems: 'center', overflow: 'hidden' }}>
              {/* center selection indicator */}
              <View style={{ position: 'absolute', top: WHEEL_ITEM_H * 2, left: 24, right: 24, height: WHEEL_ITEM_H, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: theme.primary + '70', borderRadius: R.sm, pointerEvents: 'none' }} />
              {/* fade top */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: WHEEL_ITEM_H * 2, zIndex: 1, pointerEvents: 'none', background: 'transparent' }}
                    pointerEvents="none">
                <View style={{ flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', opacity: 0.7 }} />
              </View>
              {/* fade bottom */}
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: WHEEL_ITEM_H * 2, zIndex: 1, pointerEvents: 'none' }}
                    pointerEvents="none">
                <View style={{ flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', opacity: 0.7 }} />
              </View>
              <ScrollView
                ref={wheelRef}
                style={{ flex: 1, width: '100%' }}
                contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * 2 }}
                snapToInterval={WHEEL_ITEM_H}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_H);
                  const val = Math.min(180, Math.max(1, idx + 1));
                  setWheelValue(val);
                  Haptics.selectionAsync();
                }}
              >
                {WHEEL_MINS.map(m => (
                  <View key={m} style={{ height: WHEEL_ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 36, fontWeight: '900', letterSpacing: -1, color: theme.onSurface }}>
                      {m}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <Text style={[styles.minLabel, { color: theme.onSurfaceVariant, marginTop: S.xs }]}>
              {language === 'tr' ? 'DAKİKA' : 'MINUTES'}
            </Text>

            <TouchableOpacity
              onPress={applyCustomDuration}
              style={[styles.applyBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.applyBtnText, { color: theme.onPrimary }]}>{t.focusCustomApply}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
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
                onPress={() => startBreak(activePreset.shortBreak)}
                style={{ width: '100%', paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1, borderColor: theme.tertiary + '50', backgroundColor: theme.tertiary + '12', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
              >
                <Text style={{ fontSize: F.body, fontWeight: '800', color: theme.tertiary }}>
                  {language === 'tr' ? `${activePreset.shortBreak} dk Mola Başlat` : `Start ${activePreset.shortBreak}-min Break`}
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

      {/* ── Pomodoro Info Modal ── */}
      <Modal visible={pomodoroInfoVisible} transparent animationType="fade" onRequestClose={() => setPomodoroInfoVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 }} activeOpacity={1} onPress={() => setPomodoroInfoVisible(false)}>
          <MotiView
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18 }}
            style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 28, padding: 28, width: '100%', gap: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Timer size={20} color={theme.primary} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5, flex: 1 }}>
                {language === 'tr' ? 'Pomodoro Tekniği' : 'Pomodoro Technique'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '500', color: theme.onSurfaceVariant, lineHeight: 22 }}>
              {language === 'tr'
                ? `"${language === 'tr' ? activePreset.labelTr : activePreset.labelEn}" modunda ${activePreset.workMins} dk çalışıp ${activePreset.shortBreak} dk dinleniyorsun. 4. turda ${activePreset.longBreak} dk uzun mola.`
                : `In "${activePreset.labelEn}" mode you work for ${activePreset.workMins} min and rest ${activePreset.shortBreak} min. After round 4, a ${activePreset.longBreak}-min long break.`}
            </Text>
            <View style={{ gap: 8 }}>
              {PRESETS.map((preset) => {
                const isActive = preset.key === selectedPreset;
                return (
                  <TouchableOpacity
                    key={preset.key}
                    onPress={() => { setSelectedPreset(preset.key); setDuration(preset.workMins); if (pomodoroMode) {}; }}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isActive ? theme.primary + '18' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'), borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: isActive ? theme.primary + '40' : 'transparent' }}
                  >
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: isActive ? theme.primary : theme.onSurface }}>
                        {language === 'tr' ? preset.labelTr : preset.labelEn}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.7 }}>
                        {language === 'tr' ? preset.descTr : preset.descEn}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: isActive ? theme.primary : theme.onSurfaceVariant }}>
                        {language === 'tr' ? `${preset.workMins}dk çalış` : `${preset.workMins}m work`}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, opacity: 0.6 }}>
                        {language === 'tr' ? `${preset.shortBreak}/${preset.longBreak}dk mola` : `${preset.shortBreak}/${preset.longBreak}m break`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => setPomodoroInfoVisible(false)}
              style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '900', color: theme.onPrimary }}>
                {language === 'tr' ? 'Anladım' : 'Got it'}
              </Text>
            </TouchableOpacity>
          </MotiView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg },
  closeBtn: { width: 44, height: 44, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  badgeText: { fontWeight: '900', letterSpacing: 1 },
  pomodoroToggle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1 },
  pomodoroToggleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  pomodoroRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.xl, justifyContent: 'center' },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
  phaseLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
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
  ambientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: S.lg, paddingHorizontal: S.lg },
  ambientBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full, borderWidth: 1 },
  ambientLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.1 },
  finishBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1 },
  finishText: { fontWeight: '700', letterSpacing: 0.3 },
  footer: { alignItems: 'center' },
  quote: { fontStyle: 'italic', textAlign: 'center', opacity: 0.5 },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  customSheet: { borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.sm },
  sheetHandle: { width: 36, height: 4, borderRadius: R.sm, marginBottom: S.sm },
  sheetTitle: { fontSize: F.title, fontWeight: '800', letterSpacing: -0.5 },
  sheetSub: { fontSize: F.body, fontWeight: '600', opacity: 0.5, marginBottom: S.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.xs, marginBottom: 6 },
  customInput: { fontWeight: '900', letterSpacing: -2, textAlign: 'center' },
  minLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, opacity: 0.35, textAlign: 'center', marginBottom: S.sm },
  applyBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
  applyBtnText: { color: 'white', fontWeight: '900', fontSize: F.subhead, letterSpacing: 0.5 },
  taskPickerItem: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingHorizontal: S.lg, paddingVertical: S.md, borderBottomWidth: StyleSheet.hairlineWidth },
  taskPickerItemTitle: { fontSize: F.body, fontWeight: '600', lineHeight: 20 },
  transitionOverlay: { alignItems: 'center', justifyContent: 'center', gap: S.md },
  transitionTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  transitionSub: { fontSize: F.subhead, fontWeight: '600', textAlign: 'center', opacity: 0.7 },
});
