import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Modal, TextInput, AppState, Animated, ScrollView, BackHandler, Easing } from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles, CheckCircle2, Pencil, Timer, ChevronRight, Coffee, Wind, CloudRain, Flame, Waves, Music2, Headphones } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { FocusService } from '../services/api';
import { useAchievementStore } from '../store/useAchievementStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { checkFocusAchievement } from '../utils/achievements';
import { track } from '../utils/analytics';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { getRandomQuote } from '../constants/Quotes';
import { S, R, F, B } from '../constants/tokens';
import { Touchable } from '@/components/Touchable';

// Named focus presets — each encodes work + break durations
const PRESETS = [
  { key: 'sprint',   labelTr: 'Sprint',   labelEn: 'Sprint',   workMins: 15, shortBreak: 3,  longBreak: 8,  descTr: '15dk hızlı odak',    descEn: '15m quick focus' },
  { key: 'classic',  labelTr: 'Klasik',   labelEn: 'Classic',  workMins: 25, shortBreak: 5,  longBreak: 15, descTr: '25dk standart odak', descEn: '25m standard focus' },
  { key: 'extended', labelTr: 'Uzatılmış',labelEn: 'Extended', workMins: 50, shortBreak: 10, longBreak: 20, descTr: '50dk derin odak',     descEn: '50m deep focus' },
  { key: 'ultra',    labelTr: 'Ultra',    labelEn: 'Ultra',    workMins: 90, shortBreak: 20, longBreak: 30, descTr: '90dk akış durumu',   descEn: '90m flow state' },
] as const;
type PresetKey = typeof PRESETS[number]['key'];

type AmbientSound = 'off' | 'rain' | 'cafe' | 'forest' | 'ocean' | 'fireplace' | 'relaxing' | 'binaural';

const SOUND_LABELS: Record<AmbientSound, { icon: React.ComponentType<any> | null; labelTr: string; labelEn: string }> = {
  off:       { icon: null,       labelTr: 'Sessiz',       labelEn: 'Off'       },
  rain:      { icon: CloudRain,  labelTr: 'Yağmur',       labelEn: 'Rain'      },
  cafe:      { icon: Coffee,     labelTr: 'Kafe',          labelEn: 'Café'      },
  forest:    { icon: Wind,       labelTr: 'Orman',         labelEn: 'Forest'    },
  ocean:     { icon: Waves,      labelTr: 'Okyanus',       labelEn: 'Ocean'     },
  fireplace: { icon: Flame,      labelTr: 'Şömine',       labelEn: 'Fireplace' },
  relaxing:  { icon: Music2,     labelTr: 'Rahatlatıcı',  labelEn: 'Relaxing'  },
  binaural:  { icon: Headphones, labelTr: 'Frekans',      labelEn: 'Binaural'  },
};

export default function FocusScreen() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguageStore();

  const {
    isActive, seconds, totalSeconds,
    setIsActive, tick, reset, setDuration,
    rehydrateTimer, addFocusMinutes,
    pomodoroMode, pomodoroRound, pomodoroPhase,
    togglePomodoroMode, nextPomodoroPhase,
  } = useFocusStore();

  const completedRef = useRef(false);
  const { trigger: triggerAchievement } = useAchievementStore();
  const { soundEffects } = usePrefsStore();

  // Sound
  const soundRef = useRef<AudioPlayer | null>(null);
  const chimePlayerRef = useRef<AudioPlayer | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ambientSound, setAmbientSound] = useState<AmbientSound>('off');

  // Breath cue phase — synced to glow animation
  const [breathPhase, setBreathPhase] = useState<'in' | 'hold_in' | 'out' | 'hold_out'>('in');
  const [breathMode, setBreathMode] = useState<'classic' | 'box' | 'calm' | 'off'>('classic');
  const [breathPickerVisible, setBreathPickerVisible] = useState(false);
  const [zenMode, setZenMode] = useState(false);

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

  const [isExiting, setIsExiting] = useState(false);
  const [quote, setQuote] = useState('');

  useEffect(() => {
    const handleBackPress = () => {
      if (customVisible) { setCustomVisible(false); return true; }
      if (breathPickerVisible) { setBreathPickerVisible(false); return true; }
      if (taskEditMode) { setTaskEditMode(false); return true; }
      if (pomodoroInfoVisible) { setPomodoroInfoVisible(false); return true; }
      if (summaryVisible) { 
        setSummaryVisible(false); 
        if (summaryCompleted && !completionRitual) setCompletionRitual(true);
        return true; 
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [customVisible, breathPickerVisible, taskEditMode, pomodoroInfoVisible, summaryVisible, summaryCompleted, completionRitual]);

  const WHEEL_ITEM_H = 56;
  const WHEEL_MINS = Array.from({ length: 180 }, (_, i) => i + 1);

  const timerSize = Math.min(width * 0.72, height * 0.35);
  const elapsed = totalSeconds - seconds;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
  const sessionStarted = elapsed > 0;

  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const { panResponder: customPan, animatedStyle: customSlide, prepare: prepareCustom, slideIn: customSlideIn } = useSwipeToDismiss({
    onDismiss: () => setCustomVisible(false),
  });

  const { panResponder: breathPan, animatedStyle: breathSlide, prepare: prepareBreath, slideIn: breathSlideIn } = useSwipeToDismiss({
    onDismiss: () => setBreathPickerVisible(false),
  });

  // ── Ambient sound ────────────────────────────────────────────────────────
  const [ambientVolume, setAmbientVolume] = useState(0.4);
  const ambientVolumeRef = useRef(0.4);

  const updateAmbientVolume = (vol: number) => {
    setAmbientVolume(vol);
    ambientVolumeRef.current = vol;
    if (soundRef.current) {
      try { soundRef.current.volume = vol; } catch {}
    }
  };

  const FADE_STEPS = 20;
  const FADE_MS = 16; // ~300ms total
  const CROSSFADE_SEC = 2.0; // crossfade başlangıcı: son 2 saniye

  // Crossfade loop için: aktif ses kaynağını sakla, loop poll intervalını ayrı tut
  const crossfadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSoundTypeRef = useRef<AmbientSound>('off');

  const clearFade = () => {
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
  };

  const clearCrossfade = () => {
    if (crossfadeIntervalRef.current) { clearInterval(crossfadeIntervalRef.current); crossfadeIntervalRef.current = null; }
  };

  const stopAmbientSound = () => {
    clearFade();
    clearCrossfade();
    currentSoundTypeRef.current = 'off';
    if (soundRef.current) {
      try { soundRef.current.pause(); soundRef.current.remove(); } catch {}
      soundRef.current = null;
    }
  };

  const stopAllSounds = () => {
    clearFade();
    clearCrossfade();
    stopAmbientSound();
    if (chimePlayerRef.current) {
      try { chimePlayerRef.current.pause(); chimePlayerRef.current.remove(); } catch {}
      chimePlayerRef.current = null;
    }
  };

  const stopAmbientSoundFaded = () => {
    clearFade();
    clearCrossfade();
    currentSoundTypeRef.current = 'off';
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

  const getSoundSource = (type: AmbientSound) => {
    const sources: Record<string, any> = {
      rain:      require('../assets/sounds/rain.mp3'),
      cafe:      require('../assets/sounds/cafe.mp3'),
      forest:    require('../assets/sounds/forest.mp3'),
      ocean:     require('../assets/sounds/ocean.mp3'),
      fireplace: require('../assets/sounds/fireplace.mp3'),
      relaxing:  require('../assets/sounds/relaxing.mp3'),
      binaural:  require('../assets/sounds/binaural.wav'),
    };
    return sources[type];
  };

  // Crossfade loop: ses bitmeden önce yeni player başlat, ikisi arasında yumuşak geçiş
  const startCrossfadeLoop = (type: AmbientSound, currentPlayer: AudioPlayer) => {
    clearCrossfade();
    crossfadeIntervalRef.current = setInterval(() => {
      const player = soundRef.current;
      if (!player || currentSoundTypeRef.current !== type) {
        clearCrossfade();
        return;
      }
      const duration = player.duration;
      const currentTime = player.currentTime;
      if (!duration || duration <= 0) return;

      const remaining = duration - currentTime;
      if (remaining <= CROSSFADE_SEC && remaining > 0) {
        clearCrossfade();
        // Yeni player'ı başlat, fade-in yap
        try {
          const nextPlayer = createAudioPlayer(getSoundSource(type));
          nextPlayer.volume = 0;
          nextPlayer.play();

          const crossFadeSteps = Math.floor((CROSSFADE_SEC * 1000) / FADE_MS);
          const stepVal = ambientVolumeRef.current / crossFadeSteps;
          let vol = 0;
          let step = 0;

          const xfInterval = setInterval(() => {
            step++;
            vol = Math.min(vol + stepVal, ambientVolumeRef.current);
            try { nextPlayer.volume = vol; } catch {}
            // Mevcut player'ı fade-out
            try {
              if (player) player.volume = Math.max(0, ambientVolumeRef.current - vol);
            } catch {}

            if (step >= crossFadeSteps) {
              clearInterval(xfInterval);
              // Eski player'ı temizle
              try { player.pause(); player.remove(); } catch {}
              // Yeni player şimdi aktif
              if (currentSoundTypeRef.current === type) {
                soundRef.current = nextPlayer;
                nextPlayer.volume = ambientVolumeRef.current;
                startCrossfadeLoop(type, nextPlayer);
              } else {
                try { nextPlayer.pause(); nextPlayer.remove(); } catch {}
              }
            }
          }, FADE_MS);
        } catch {
          // crossfade başarısız olursa basit loop'a dön
          try { player.loop = true; } catch {}
        }
      }
    }, 500); // Her 500ms'de bir kontrol et
  };

  const playAmbientSound = async (type: AmbientSound, fadeIn = false) => {
    stopAmbientSound();
    if (type === 'off') return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'mixWithOthers',
      });
      const player = createAudioPlayer(getSoundSource(type));
      // loop=false — crossfade ile manuel döngü yapacağız
      player.loop = false;
      currentSoundTypeRef.current = type;

      if (fadeIn) {
        player.volume = 0;
        player.play();
        soundRef.current = player;
        let vol = 0;
        const stepVal = ambientVolumeRef.current / FADE_STEPS;
        fadeIntervalRef.current = setInterval(() => {
          vol = Math.min(vol + stepVal, ambientVolumeRef.current);
          try { if (soundRef.current) soundRef.current.volume = vol; } catch {}
          if (vol >= ambientVolumeRef.current) {
            clearFade();
            startCrossfadeLoop(type, player);
          }
        }, FADE_MS);
      } else {
        player.volume = ambientVolumeRef.current;
        player.play();
        soundRef.current = player;
        startCrossfadeLoop(type, player);
      }
    } catch (e) {
      console.warn('Ambient sound error:', e);
    }
  };

  useEffect(() => {
    return () => { stopAllSounds(); };
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
  const [breathSeconds, setBreathSeconds] = useState(0);
  useEffect(() => {
    if (!isActive || breathMode === 'off') {
      setBreathPhase('in');
      setBreathSeconds(0);
      return;
    }
    const iv = setInterval(() => {
      setBreathSeconds((prev) => {
        const next = prev + 1;
        if (breathMode === 'classic') {
          const mod = next % 8;
          if (mod < 4) setBreathPhase('in');
          else setBreathPhase('out');
        } else if (breathMode === 'box') {
          const mod = next % 16;
          if (mod < 4) setBreathPhase('in');
          else if (mod < 8) setBreathPhase('hold_in');
          else if (mod < 12) setBreathPhase('out');
          else setBreathPhase('hold_out');
        } else if (breathMode === 'calm') {
          const mod = next % 19;
          if (mod < 4) setBreathPhase('in');
          else if (mod < 11) setBreathPhase('hold_in');
          else setBreathPhase('out');
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [isActive, breathMode]);

  const getBreathText = () => {
    if (breathMode === 'off') return '';
    if (breathPhase === 'in') return language === 'tr' ? 'NEFES AL' : 'INHALE';
    if (breathPhase === 'hold_in') return language === 'tr' ? 'TUT' : 'HOLD';
    if (breathPhase === 'out') return language === 'tr' ? 'NEFES VER' : 'EXHALE';
    if (breathPhase === 'hold_out') return language === 'tr' ? 'BOŞ BEKLE' : 'HOLD OUT';
    return '';
  };

  const circleScaleAnim = useRef(new Animated.Value(1)).current;
  const glowScaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    if (!isActive || breathMode === 'off') {
      Animated.parallel([
        Animated.timing(circleScaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(glowScaleAnim, {
          toValue: 0.88,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
      return;
    }

    let targetCircleScale = 1.0;
    let targetGlowScale = 0.88;
    
    if (zenMode) {
      if (breathPhase === 'in' || breathPhase === 'hold_in') {
        targetCircleScale = 1.05;
        targetGlowScale = 1.14;
      } else {
        targetCircleScale = 0.95;
        targetGlowScale = 0.88;
      }
    } else {
      targetCircleScale = 1.0;
      if (breathPhase === 'in' || breathPhase === 'hold_in') {
        targetGlowScale = 1.14;
      } else {
        targetGlowScale = 0.88;
      }
    }

    let duration = 4000;
    if (breathPhase === 'in') {
      duration = 4000;
    } else if (breathPhase === 'out') {
      duration = breathMode === 'calm' ? 8000 : 4000;
    } else if (breathPhase === 'hold_in') {
      duration = breathMode === 'calm' ? 7000 : 4000;
    } else if (breathPhase === 'hold_out') {
      duration = 4000;
    }

    Animated.parallel([
      Animated.timing(circleScaleAnim, {
        toValue: targetCircleScale,
        duration: duration,
        useNativeDriver: true,
      }),
      Animated.timing(glowScaleAnim, {
        toValue: targetGlowScale,
        duration: duration,
        useNativeDriver: true,
      })
    ]).start();

  }, [isActive, breathPhase, breathMode, zenMode]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => { rehydrateTimer(); }, []);

  useFocusEffect(useCallback(() => {
    setQuote(getRandomQuote(language));
    return () => {
      stopAllSounds();
    };
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
          FocusService.saveSession('Focus', elapsed, false).catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, []);

  // ── Session completion / Pomodoro transitions ─────────────────────────────
  useEffect(() => {
    if (seconds === 0 && totalSeconds > 0 && !completedRef.current) {
      completedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Seans bitimi sesi — soundEffects toggle'ından bağımsız, her zaman çalar
      (async () => {
        try {
          await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' });
          const p = createAudioPlayer(require('../assets/sounds/timer_end.wav'));
          p.volume = 0.85;
          p.play();
          chimePlayerRef.current = p;
          setTimeout(() => {
            try {
              p.remove();
              if (chimePlayerRef.current === p) chimePlayerRef.current = null;
            } catch {}
          }, 8000);
        } catch {}
      })();

      const { pomodoroMode: isPomo, pomodoroPhase: phase, pomodoroRound: round } = useFocusStore.getState();

      if (isPomo) {
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 500);

        if (phase === 'work') {
          const minutes = Math.round(totalSeconds / 60);
          FocusService.saveSession('Focus', minutes, true).catch(() => {});
          addFocusMinutes(minutes);
          track('focus_completed', { minutes, pomodoro: true });

          // Check focus achievements using lifetime total
          FocusService.getStats().then(s => {
            const total = Math.round((s.totalFocusHours || 0) * 60);
            const ach = checkFocusAchievement(total);
            if (ach) triggerAchievement(ach);
          }).catch(() => {});

          const isLongBreak = round >= 4;
          nextPomodoroPhase();
          const breakMins = isLongBreak ? activePreset.longBreak : activePreset.shortBreak;
          setZenMode(false); // Reset Zen Mode on break transition
          setTimeout(() => {
            setDuration(breakMins);
            useFocusStore.setState({ isActive: true, lastActiveAt: Date.now() });
          }, 600);
          setPomodoroTransition({ visible: true, type: 'break', isLong: isLongBreak });
          setTimeout(() => setPomodoroTransition(p => ({ ...p, visible: false })), 3500);
        } else {
          // Break finished → next work round
          nextPomodoroPhase();
          setZenMode(false); // Reset Zen Mode on work transition
          setTimeout(() => { setDuration(activePreset.workMins); }, 400);
          setPomodoroTransition({ visible: true, type: 'work' });
          setTimeout(() => setPomodoroTransition(p => ({ ...p, visible: false })), 3500);
        }
      } else {
        // Standard mode
        stopAmbientSound();
        setAmbientSound('off');
        setZenMode(false); // Reset Zen Mode
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
        const minutes = Math.round(totalSeconds / 60);
        FocusService.saveSession('Focus', minutes, true).catch(() => {});
        addFocusMinutes(minutes);
        track('focus_completed', { minutes, pomodoro: false });
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
      FocusService.saveSession('Focus', minutesDone, false).catch(() => {});
      addFocusMinutes(minutesDone);
      stopAmbientSound();
      setAmbientSound('off');
    }
    completedRef.current = false;
    setZenMode(false);
    reset();
  };

  const finishEarly = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopAmbientSound();
    setAmbientSound('off');
    setIsActive(false);
    completedRef.current = true;
    setZenMode(false);
    const minutesDone = Math.max(1, Math.round(elapsed / 60));
    FocusService.saveSession('Focus', minutesDone, false).catch(() => {});
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
    <MotiView
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header — left/right slots are equal width so badge stays perfectly centered */}
        <MotiView
          pointerEvents={zenMode && isActive ? "none" : "auto"}
          animate={{ opacity: zenMode && isActive ? 0 : 1 }}
          transition={{ type: 'timing', duration: 400 }}
          style={[styles.header, { paddingVertical: S.md }]}
        >
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Touchable
              onPress={() => {
                stopAllSounds();
                setAmbientSound('off');
                if (elapsed > 0) {
                  setIsActive(false);
                  const minutesDone = Math.max(1, Math.round(elapsed / 60));
                  FocusService.saveSession('Focus', minutesDone, false).catch(() => {});
                  addFocusMinutes(minutesDone);
                }
                setIsExiting(true);
                setTimeout(() => {
                  router.canGoBack() ? router.back() : router.replace('/');
                }, 350);
              }}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              accessibilityRole="button"
              accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'}
            >
              <X size={20} color={theme.onSurface} />
            </Touchable>
          </View>

          <View style={[styles.badge, { backgroundColor: theme.primary + '15', flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginHorizontal: S.sm }]}>
            <Sparkles size={11} color={theme.primary} />
            <Text style={[styles.badgeText, { color: theme.primary, fontSize: F.caption, letterSpacing: 1, maxWidth: 120 }]} numberOfLines={1}>
              {t.focusLabel || t.deepFocus}
            </Text>
          </View>

          {/* Pomodoro & Breath Toggles - Unified Premium Pill */}
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <AnimatePresence>
              {!isActive && (
                <MotiView
                  key="pomo-controls"
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'timing', duration: 220 }}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderRadius: 20, padding: 3 }}
                >
                  <Touchable
                    onPress={() => { Haptics.selectionAsync(); setBreathPickerVisible(true); }}
                    style={{ padding: 6, borderRadius: 17, backgroundColor: breathMode !== 'off' ? theme.primary + '20' : 'transparent' }}
                  >
                    <Wind size={15} color={breathMode !== 'off' ? theme.primary : theme.onSurfaceVariant} strokeWidth={2.5} />
                  </Touchable>
                  <Touchable
                    onPress={() => { Haptics.selectionAsync(); togglePomodoroMode(); if (!pomodoroMode) setDuration(activePreset.workMins); }}
                    style={{ padding: 6, borderRadius: 17, backgroundColor: pomodoroMode ? theme.primary + '20' : 'transparent' }}
                  >
                    <Timer size={15} color={pomodoroMode ? theme.primary : theme.onSurfaceVariant} strokeWidth={2.5} />
                  </Touchable>
                </MotiView>
              )}
            </AnimatePresence>
          </View>
        </MotiView>

        <View style={[styles.content, { paddingHorizontal: S.lg }]}>

          {/* Top Foreground (Chips) - Animates height to push timer smoothly */}
          <MotiView 
            animate={{ height: sessionStarted ? 20 : 90 }}
            transition={{ type: 'timing', duration: 400 }}
            style={{ width: '100%', zIndex: 10 }} 
            pointerEvents="box-none"
          >
            {/* Preset chips (standard mode) / Pomodoro indicator */}
            <MotiView
              pointerEvents={zenMode && isActive ? "none" : "auto"}
              animate={{ opacity: zenMode && isActive ? 0 : 1 }}
              transition={{ type: 'timing', duration: 400 }}
              style={{ width: '100%', alignItems: 'center', paddingTop: S.sm }}
            >
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
                    <View style={[styles.durationRow, { marginBottom: S.md, gap: S.sm, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }]}>
                      {PRESETS.map((preset) => {
                        const isSelected = totalSeconds === preset.workMins * 60;
                        return (
                          <Touchable
                            key={preset.key}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setSelectedPreset(preset.key);
                              setDuration(preset.workMins);
                            }}
                            style={[
                              styles.durationChip,
                              {
                                backgroundColor: isSelected ? theme.primary + '18' : (Platform.OS === 'android' ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent'),
                                borderColor: isSelected ? theme.primary : theme.outline,
                                borderWidth: B.thin,
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
                          </Touchable>
                        );
                      })}
                      <Touchable
                        onPress={() => { prepareCustom(); Haptics.selectionAsync(); setCustomVisible(true); }}
                        style={[
                          styles.durationChip,
                          {
                            backgroundColor: !PRESETS.some(p => p.workMins * 60 === totalSeconds) && totalSeconds > 0 ? theme.primary + '18' : (Platform.OS === 'android' ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent'),
                            borderColor: !PRESETS.some(p => p.workMins * 60 === totalSeconds) && totalSeconds > 0 ? theme.primary : theme.outline,
                            borderWidth: B.thin,
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
                      </Touchable>
                    </View>
                  </MotiView>
                )}
              </AnimatePresence>
            )}
            </MotiView>
          </MotiView>

          {/* Timer Container (Takes remaining space to prevent overlap) */}
          <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 0 }} pointerEvents="box-none">
            <MotiView style={[styles.timerContainer, { width: timerSize, height: timerSize }]} pointerEvents="auto">
            {/* Breath glow */}
            {/* Breath glow */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.breathGlow,
                {
                  backgroundColor: pomodoroPhase === 'break' && pomodoroMode ? theme.tertiary : theme.primary,
                  borderRadius: timerSize / 2,
                  width: timerSize,
                  height: timerSize,
                  transform: [{ scale: glowScaleAnim }],
                  opacity: isActive && breathMode !== 'off' ? (isDark ? 0.18 : 0.10) : 0,
                }
              ]}
            />

            {/* SVG ring */}
            {(() => {
              const r = (timerSize / 2) - 6;
              const circumference = 2 * Math.PI * r;
              const offsetAnim = progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [circumference, 0]
              });
              const strokeColor = pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary;
              return (
                <Svg pointerEvents="none" width={timerSize} height={timerSize} style={{ position: 'absolute', zIndex: 12, opacity: zenMode && isActive ? 0.5 : 1 }}>
                  <G rotation={-90} origin={`${timerSize / 2}, ${timerSize / 2}`}>
                    <Circle cx={timerSize / 2} cy={timerSize / 2} r={r} fill="none" stroke={isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.08)'} strokeWidth={8} />
                    {progress > 0 && (
                      <AnimatedCircle cx={timerSize / 2} cy={timerSize / 2} r={r} fill="none" stroke={strokeColor} strokeWidth={8}
                        strokeDasharray={`${circumference}`} strokeDashoffset={offsetAnim} strokeLinecap="round" />
                    )}
                  </G>
                </Svg>
              );
            })()}

            <Animated.View
              pointerEvents={zenMode && isActive ? "box-none" : "auto"}
              style={[styles.timerCircle, {
                width: '100%',
                height: '100%',
                zIndex: 10,
                borderRadius: timerSize / 2,
                transform: [{ scale: circleScaleAnim }]
              }]}
            >
              <Touchable
                activeOpacity={0.9}
                onPress={() => {
                  if (isActive) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setZenMode(!zenMode);
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest,
                  borderRadius: timerSize / 2,
                  overflow: 'hidden',
                }}
              >
                {/* Standard Timer View (Fades out when Zen Mode is active) */}
                <MotiView
                  pointerEvents={zenMode && isActive ? "none" : "auto"}
                  animate={{
                    opacity: zenMode && isActive ? 0 : 1,
                    scale: zenMode && isActive ? 0.92 : 1,
                  }}
                  transition={{ type: 'timing', duration: 400 }}
                  style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
                >
                  <Text style={[styles.timerText, { color: theme.onSurface, fontSize: Math.round(timerSize * 0.195) }]}>
                    {formatTime(seconds)}
                  </Text>

                  {/* Status badge */}
                  <View style={[styles.statusBadge, { backgroundColor: isActive ? (pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary + '20' : theme.primary + '20') : theme.surfaceContainerHigh, marginTop: 12 }]}>
                    <View style={[styles.statusDot, { backgroundColor: isActive ? (pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary) : theme.onSurfaceVariant }]} />
                    <Text style={[styles.statusText, { color: isActive ? (pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary) : theme.onSurfaceVariant, fontSize: F.caption }]}>
                      {isActive ? t.focusRunning : seconds === totalSeconds ? t.focusReady : t.focusPaused}
                    </Text>
                  </View>

                  {/* Breath cue — fades between phases in sync with glow animation */}
                  <View style={{ height: 16, marginTop: 7, justifyContent: 'center', alignItems: 'center' }}>
                    <AnimatePresence>
                      {isActive && breathMode !== 'off' && (
                        <MotiView
                          key={`normal-breath-${breathPhase}`}
                          from={{ opacity: 0 }}
                          animate={{ opacity: 0.4 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'timing', duration: 400 }}
                        >
                          <Text style={{ fontSize: 9, letterSpacing: 2.5, fontWeight: '700', textAlign: 'center', color: pomodoroPhase === 'break' && pomodoroMode ? theme.tertiary : theme.primary }}>
                            {getBreathText()}
                          </Text>
                        </MotiView>
                      )}
                    </AnimatePresence>
                  </View>
                </MotiView>

                {/* Zen Mode View (Fades in when Zen Mode is active) */}
                <MotiView
                  pointerEvents={zenMode && isActive ? "auto" : "none"}
                  animate={{
                    opacity: zenMode && isActive ? 1 : 0,
                    scale: zenMode && isActive ? 1 : 0.95,
                  }}
                  transition={{ type: 'timing', duration: 400 }}
                  style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.md }]}
                >
                  {breathMode !== 'off' ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                      <AnimatePresence>
                        <MotiView
                          key={`zen-breath-${breathPhase}`}
                          from={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ type: 'timing', duration: 400 }}
                          style={{ alignItems: 'center' }}
                        >
                          <Text style={{ fontFamily: 'Jakarta-Bold', fontSize: Math.round(timerSize * 0.088), letterSpacing: 5, color: pomodoroPhase === 'break' && pomodoroMode ? theme.tertiary : theme.primary, textAlign: 'center' }}>
                            {getBreathText()}
                          </Text>
                        </MotiView>
                      </AnimatePresence>
                    </View>
                  ) : (
                    <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={24} color={theme.onSurface} style={{ opacity: 0.2 }} />
                    </View>
                  )}
                  <Text style={{ fontFamily: 'Jakarta-SemiBold', fontSize: 10, color: theme.onSurfaceVariant, opacity: 0.35, marginTop: 28, letterSpacing: 1 }}>
                    {language === 'tr' ? 'Çıkmak için dokun' : 'Tap to exit Zen Mode'}
                  </Text>
                </MotiView>
              </Touchable>
            </Animated.View>
            </MotiView>
          </View>

          {/* Controls & Bottom Section Wrapper */}
          <View style={{ width: '100%', alignItems: 'center', paddingBottom: S.md, gap: S.md, zIndex: 10 }} pointerEvents="box-none">
            {/* Controls */}
            <MotiView
              pointerEvents={zenMode && isActive ? "none" : "auto"}
              animate={{ opacity: zenMode && isActive ? 0 : 1 }}
              transition={{ type: 'timing', duration: 400 }}
              style={[styles.controlsRow, { gap: S.xl }]}
            >
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
                    <Touchable
                      onPress={resetTimer}
                      disabled={!sessionStarted}
                      accessibilityRole="button"
                      accessibilityLabel={language === 'tr' ? 'Sıfırla' : 'Reset'}
                      style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow, width: 56, height: 56, borderRadius: R.lg, opacity: sessionStarted ? 1 : 0.3 }]}
                    >
                      <RotateCcw size={24} color={theme.onSurfaceVariant} />
                    </Touchable>
                  </MotiView>
                )}
              </AnimatePresence>
            </View>

            <Touchable
              onPress={toggleTimer}
              accessibilityRole="button"
              accessibilityLabel={isActive ? (language === 'tr' ? 'Duraklat' : 'Pause') : (language === 'tr' ? 'Başlat' : 'Start')}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: isActive 
                  ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') 
                  : (pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary),
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: isActive ? 'transparent' : (pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : theme.primary),
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isActive ? 0 : 0.35,
                shadowRadius: 12,
                elevation: isActive ? 0 : 8,
              }}
            >
              {isActive
                ? <Pause size={28} color={theme.onSurface} fill={theme.onSurface} style={{ opacity: 0.8 }} />
                : <Play size={28} color={theme.onPrimary} fill={theme.onPrimary} style={{ marginLeft: 4 }} />}
            </Touchable>

            <View style={{ width: 56, height: 56 }} />
          </MotiView>

          {/* Ambient sound row */}
          <MotiView
            pointerEvents={zenMode && isActive ? "none" : "auto"}
            animate={{ opacity: zenMode && isActive ? 0 : 1 }}
            transition={{ type: 'timing', duration: 400 }}
            style={{ width: '100%', flexGrow: 0 }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.ambientRow, { marginTop: 0 }]}
              keyboardShouldPersistTaps="handled"
            >
              {(['rain', 'cafe', 'forest', 'ocean', 'fireplace', 'relaxing', 'binaural'] as AmbientSound[]).map(type => {
                const active = ambientSound === type;
                const cfg = SOUND_LABELS[type];
                const IconComp = cfg.icon!;
                return (
                  <Touchable
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
                  </Touchable>
                );
              })}
            </ScrollView>

            {/* Volume Control Stepper */}
            <AnimatePresence>
              {ambientSound !== 'off' && (
                <MotiView
                  key="volume-stepper"
                  from={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 24, marginTop: 12 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ type: 'timing', duration: 300 }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {[0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
                    <Touchable
                      key={v}
                      onPress={() => { updateAmbientVolume(v); Haptics.selectionAsync(); }}
                      style={{ width: 34, height: 24, justifyContent: 'center', alignItems: 'center' }}
                      accessibilityLabel={`Ses seviyesi ${v * 100}`}
                    >
                      <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: ambientVolume >= v ? theme.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)') }} />
                    </Touchable>
                  ))}
                </MotiView>
              )}
            </AnimatePresence>
          </MotiView>

          {/* Dynamic Bottom Area (Fixed height to prevent layout shifts) */}
          <View style={{ height: 44, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <AnimatePresence>
              {pomodoroMode && pomodoroPhase === 'break' && isActive ? (
                <MotiView
                  key="break-tip"
                  from={{ opacity: 0, translateY: 6 }}
                  animate={{ opacity: zenMode && isActive ? 0 : 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: 6 }}
                  transition={{ type: 'timing', duration: 400 }}
                  style={{ alignItems: 'center' }}
                  pointerEvents={zenMode && isActive ? "none" : "auto"}
                >
                  <Text style={{ fontSize: F.caption, color: theme.tertiary, fontWeight: '700', letterSpacing: 0.2, opacity: 0.85 }}>
                    {language === 'tr' ? '💧 Su iç  ·  Esne  ·  Gözlerini kapat' : '💧 Hydrate  ·  Stretch  ·  Close your eyes'}
                  </Text>
                </MotiView>
              ) : sessionStarted ? (
                <MotiView
                  key="end-session"
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: zenMode && isActive ? 0 : 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: 10 }}
                  transition={{ type: 'timing', duration: 300 }}
                  style={{ alignItems: 'center' }}
                  pointerEvents={zenMode && isActive ? "none" : "auto"}
                >
                  <Touchable
                    onPress={finishEarly}
                    style={[styles.finishBtn, { borderColor: theme.tertiary + '50', backgroundColor: theme.tertiary + '12' }]}
                  >
                    <CheckCircle2 size={15} color={theme.tertiary} />
                    <Text style={[styles.finishText, { color: theme.tertiary, fontSize: F.body }]}>
                      {t.focusEndSession}
                    </Text>
                  </Touchable>
                </MotiView>
              ) : (
                <MotiView
                  key="footer-quote"
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'timing', duration: 350 }}
                >
                  <View style={[styles.footer, { paddingHorizontal: S.xl }]}>
                    <Text style={{ fontStyle: 'italic', textAlign: 'center', opacity: 0.5, color: theme.onSurfaceVariant, fontSize: F.body }}>{quote}</Text>
                  </View>
                </MotiView>
              )}
            </AnimatePresence>
          </View>

          </View>
        </View>
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
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: F.title, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}>
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
          <Touchable style={styles.modalOverlay} activeOpacity={1} onPress={() => setCustomVisible(false)} />
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
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>{t.focusCustomDuration}</Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>{language === 'tr' ? '1 – 180 dakika' : '1 – 180 minutes'}</Text>

            {/* Drum-roll wheel */}
            <View style={{ height: WHEEL_ITEM_H * 5, width: '100%', alignItems: 'center', overflow: 'hidden' }}>
              {/* center selection indicator */}
              <View style={{ position: 'absolute', top: WHEEL_ITEM_H * 2, left: 24, right: 24, height: WHEEL_ITEM_H, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: theme.primary + '70', borderRadius: R.sm, pointerEvents: 'none' }} />
              {/* fade top */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: WHEEL_ITEM_H * 2, zIndex: 1, pointerEvents: 'none', backgroundColor: 'transparent' }}
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

            <Touchable
              onPress={applyCustomDuration}
              style={[styles.applyBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.applyBtnText, { color: theme.onPrimary }]}>{t.focusCustomApply}</Text>
            </Touchable>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Breath Picker Bottom Sheet Modal ────────────────────────────────── */}
      <Modal
        visible={breathPickerVisible}
        transparent
        animationType="none"
        onShow={breathSlideIn}
        onRequestClose={() => setBreathPickerVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Touchable style={styles.modalOverlay} activeOpacity={1} onPress={() => setBreathPickerVisible(false)} />
          <Animated.View
            style={[
              breathSlide,
              styles.customSheet,
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', paddingBottom: S.xxl },
            ]}
          >
            <View {...breathPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface, paddingHorizontal: 24 }]}>
              {language === 'tr' ? 'Nefes Egzersizi' : 'Breathing Exercise'}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant, paddingHorizontal: 24, marginBottom: 16 }]}>
              {language === 'tr' ? 'Odağınızı artırmak ve zihninizi sakinleştirmek için bir ritim seçin' : 'Select a rhythm to boost focus and calm your mind'}
            </Text>

            <View style={{ width: '100%', paddingHorizontal: 24, gap: 12 }}>
              {(['classic', 'box', 'calm', 'off'] as const).map((mode) => {
                const isActive = breathMode === mode;
                const title = mode === 'classic'
                  ? (language === 'tr' ? 'Klasik Nefes (4s Al - 4s Ver)' : 'Classic Breath (4s In - 4s Out)')
                  : mode === 'box'
                    ? (language === 'tr' ? 'Kutu Nefesi (4s Al - 4s Tut - 4s Ver - 4s Tut)' : 'Box Breathing (4s In - 4s Hold - 4s Out - 4s Hold)')
                    : mode === 'calm'
                      ? (language === 'tr' ? 'Sakinleştirici Nefes (4s Al - 7s Tut - 8s Ver)' : 'Calming Breath (4s In - 7s Hold - 8s Out)')
                      : (language === 'tr' ? 'Kapalı' : 'Off');

                const desc = mode === 'classic'
                  ? (language === 'tr' ? 'Sakinlik ve denge sağlar (Koherent Solunum)' : 'Promotes calm and balance (Coherent Breathing)')
                  : mode === 'box'
                    ? (language === 'tr' ? 'Odağı toplar ve stresi sıfırlar (Kutu Nefesi)' : 'Stabilizes concentration and resets stress (Box Breathing)')
                    : mode === 'calm'
                      ? (language === 'tr' ? 'Kaygıyı azaltır ve derin gevşeme sağlar (4-7-8 Tekniği)' : 'Reduces anxiety and triggers deep relaxation (4-7-8 Technique)')
                      : (language === 'tr' ? 'Ekrandaki solunum rehberini ve animasyonunu gizler' : 'Hides breathing guidance and animations');

                return (
                  <Touchable
                    key={mode}
                    onPress={() => {
                      setBreathMode(mode);
                      setBreathPickerVisible(false);
                      Haptics.selectionAsync();
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isActive ? theme.primary + '18' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: B.medium,
                      borderColor: isActive ? theme.primary : 'transparent',
                    }}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: isActive ? theme.primary : theme.onSurface }}>
                        {title}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.onSurfaceVariant, opacity: 0.8 }}>
                        {desc}
                      </Text>
                    </View>
                    {isActive && (
                      <CheckCircle2 size={20} color={theme.primary} />
                    )}
                  </Touchable>
                );
              })}
            </View>
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

            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: F.title, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5, textAlign: 'center' }}>
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
              <Touchable
                onPress={() => startBreak(activePreset.shortBreak)}
                style={{ width: '100%', paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.tertiary + '50', backgroundColor: theme.tertiary + '12', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
              >
                <Text style={{ fontSize: F.body, fontWeight: '800', color: theme.tertiary }}>
                  {language === 'tr' ? `${activePreset.shortBreak} dk Mola Başlat` : `Start ${activePreset.shortBreak}-min Break`}
                </Text>
              </Touchable>
            )}

            <Touchable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSummaryVisible(false);
                stopAllSounds();
                setAmbientSound('off');
                setIsExiting(true);
                setTimeout(() => {
                  reset();
                  router.replace('/');
                }, 350);
              }}
              style={{ width: '100%', paddingVertical: S.md, borderRadius: R.full, backgroundColor: theme.primary, alignItems: 'center' }}
            >
              <Text style={{ fontSize: F.subhead, fontWeight: '900', color: theme.onPrimary, letterSpacing: 0.5 }}>
                {t.summaryBackHome}
              </Text>
            </Touchable>

            <Touchable
              onPress={() => { setSummaryVisible(false); completedRef.current = false; reset(); }}
              style={{ paddingVertical: S.sm }}
            >
              <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.6 }}>
                {t.summaryNewSession}
              </Text>
            </Touchable>
          </MotiView>
        </View>
      </Modal>

      {/* ── Pomodoro Info Modal ── */}
      <Modal visible={pomodoroInfoVisible} transparent animationType="fade" onRequestClose={() => setPomodoroInfoVisible(false)}>
        <Touchable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 }} activeOpacity={1} onPress={() => setPomodoroInfoVisible(false)}>
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
                  <Touchable
                    key={preset.key}
                    onPress={() => { setSelectedPreset(preset.key); setDuration(preset.workMins); if (pomodoroMode) {}; }}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isActive ? theme.primary + '18' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'), borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: B.thin, borderColor: isActive ? theme.primary + '40' : 'transparent' }}
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
                  </Touchable>
                );
              })}
            </View>
            <Touchable
              onPress={() => setPomodoroInfoVisible(false)}
              style={{ backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '900', color: theme.onPrimary }}>
                {language === 'tr' ? 'Anladım' : 'Got it'}
              </Text>
            </Touchable>
          </MotiView>
        </Touchable>
      </Modal>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg },
  closeBtn: { width: 44, height: 44, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  badgeText: { fontWeight: '900', letterSpacing: 1 },
  pomodoroToggle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: B.thin },
  pomodoroToggleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  pomodoroRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.xl, justifyContent: 'center' },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full },
  phaseLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  content: { flex: 1, alignItems: 'center', width: '100%' },
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
  taskPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, marginTop: S.md, maxWidth: 260, gap: S.sm },
  taskPickerLabel: { fontSize: F.caption, fontWeight: '600', flex: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center' },
  playBtn: { overflow: 'hidden', elevation: 8, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  btnGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  ambientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: S.md, paddingHorizontal: S.lg },
  ambientBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full, borderWidth: B.thin },
  ambientLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.1 },
  finishBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin },
  finishText: { fontWeight: '700', letterSpacing: 0.3 },
  footer: { alignItems: 'center' },
  quote: { fontStyle: 'italic', textAlign: 'center', opacity: 0.5 },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  customSheet: { borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.sm },
  sheetHandle: { width: 36, height: 4, borderRadius: R.sm, marginBottom: S.sm },
  sheetTitle: { fontSize: F.title, fontWeight: '800', letterSpacing: -0.5 },
  sheetSub: { fontSize: F.body, fontWeight: '600', opacity: 0.5, marginBottom: S.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: B.thin, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.xs, marginBottom: 6 },
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
