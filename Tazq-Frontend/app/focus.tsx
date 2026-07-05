import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Modal, TextInput, AppState, Animated, ScrollView, BackHandler, Easing } from 'react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import Svg, { Circle, G, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles, CheckCircle2, Pencil, Timer, ChevronRight, Coffee, Wind, CloudRain, Flame, Waves, Music2, Headphones, Shield } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusStore } from '@/features/focus';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { FocusService } from '@/shared/services/api';
import { useAchievementStore, checkFocusAchievement } from '@/features/user';
import { usePrefsStore } from '@/features/modes';
import { track } from '@/shared/utils/analytics';
import { StatusBar } from 'expo-status-bar';
import { useToastStore } from '@/shared/store/useToastStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Colors } from '@/shared/constants/Colors';
import { getRandomQuote } from '@/shared/constants/Quotes';
import { S, R, F, B } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { HelpTourModal } from '@/shared/components/HelpTourModal';
import { TourTarget, useTour } from '@/shared/components/TourContext';
import { Easing as RNEasing } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing as ReEasing } from 'react-native-reanimated';

interface StarGroupProps {
  timerSize: number;
  duration: number;
  initialVal: number;
  starCount: number;
}

const StarGroup = React.memo(({ timerSize, duration, initialVal, starCount }: StarGroupProps) => {
  const maxRadius = Math.max(200, timerSize * 1.5);

  const starsData = useRef<{ x: number; y: number; size: number; color: string }[] | null>(null);
  if (!starsData.current) {
    starsData.current = Array.from({ length: starCount }, () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 10 + Math.random() * (maxRadius - 10);
      const size = 1.0 + Math.random() * 1.6;
      const colors = ['#FFFFFF', '#E3F2FD', '#E0F7FA', '#FFF9C4', '#F3E5F5'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      return {
        x: maxRadius + Math.cos(angle) * distance,
        y: maxRadius + Math.sin(angle) * distance,
        size,
        color,
      };
    });
  }

  const scaleShared = useSharedValue(0.1 + initialVal * 2.9);
  const rotationShared = useSharedValue(0);

  useEffect(() => {
    const initialProgress = initialVal;
    const remainingProgress = 1 - initialProgress;
    const firstDuration = duration * remainingProgress;

    const direction = initialVal < 0.5 ? 1 : -1;
    rotationShared.value = withRepeat(
      withTiming(360 * direction, { duration: duration * 10, easing: ReEasing.linear }),
      -1,
      false
    );

    if (firstDuration > 0) {
      scaleShared.value = withTiming(3.0, { duration: firstDuration, easing: ReEasing.linear }, (finished) => {
        if (finished) {
          scaleShared.value = 0.1;
          scaleShared.value = withRepeat(
            withTiming(3.0, { duration: duration, easing: ReEasing.linear }),
            -1,
            false
          );
        }
      });
    } else {
      scaleShared.value = withRepeat(
        withTiming(3.0, { duration: duration, easing: ReEasing.linear }),
        -1,
        false
      );
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = scaleShared.value;
    let opacity = 0;
    if (scale < 0.6) {
      opacity = (scale - 0.1) / 0.5;
    } else if (scale < 2.0) {
      opacity = 1;
    } else {
      opacity = Math.max(0, 1 - (scale - 2.0) / 1.0);
    }

    return {
      opacity: opacity,
      transform: [
        { scale: scale },
        { rotate: `${rotationShared.value}deg` }
      ],
    };
  });

  return (
    <ReAnimated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: maxRadius * 2,
          height: maxRadius * 2,
        },
        animatedStyle,
      ]}
    >
      {starsData.current?.map((star, idx) => (
        <View
          key={idx}
          style={{
            position: 'absolute',
            left: star.x - star.size / 2,
            top: star.y - star.size / 2,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: star.color,
          }}
        />
      ))}
    </ReAnimated.View>
  );
});

const Starfield = React.memo(({ active, timerSize }: { active: boolean; timerSize: number }) => {
  if (!active) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]} pointerEvents="none">
      <StarGroup timerSize={timerSize} duration={12000} initialVal={0.0} starCount={15} />
      <StarGroup timerSize={timerSize} duration={12000} initialVal={0.33} starCount={15} />
      <StarGroup timerSize={timerSize} duration={12000} initialVal={0.66} starCount={15} />
    </View>
  );
});

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

interface PomodoroIndicatorProps {
  pomodoroPhase: 'work' | 'break';
  pomodoroRound: number;
  theme: any;
  language: string;
  isDark: boolean;
}

const PomodoroIndicator = React.memo(({ pomodoroPhase, pomodoroRound, theme, language, isDark }: PomodoroIndicatorProps) => (
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
));

export default function FocusScreen() {
  // Derin odak ekranı sistem temasından bağımsızdır: her iki modda da sakin, koyu meditatif kimlik.
  useAppTheme();
  const theme = Colors.dark;
  const isDark = true;
  const colorScheme: 'light' | 'dark' = 'dark';
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguageStore();

  const {
    isActive, seconds, totalSeconds, currentTask,
    setIsActive, tick, reset, setDuration,
    rehydrateTimer, addFocusMinutes,
    pomodoroMode, pomodoroRound, pomodoroPhase,
    togglePomodoroMode, nextPomodoroPhase,
    strictMode, setStrictMode, addFocusPoints,
  } = useFocusStore();

  const completedRef = useRef(false);
  const { trigger: triggerAchievement } = useAchievementStore();
  const { soundEffects } = usePrefsStore();
  const { measureAll } = useTour();
  const handleStepChange = (step: number) => {
    setTimeout(() => {
      measureAll();
    }, 150);
  };

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

  // (Aurora reanimated animasyonları timerSize tanımından sonra kuruldu — aşağıya bakınız.)

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
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

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

  // Sürekli odak animasyonları — reanimated (UI thread). timerSize'dan SONRA kurulmalı (worklet'ler ona bağlı).
  const auroraRot = useSharedValue(0);
  const b1 = useSharedValue(0);
  const b2 = useSharedValue(0);
  const b3 = useSharedValue(0);
  const rp0 = useSharedValue(0);
  const rp1 = useSharedValue(0);
  const rp2 = useSharedValue(0);
  useEffect(() => {
    const ease = ReEasing.inOut(ReEasing.ease);
    const easeOut = ReEasing.out(ReEasing.ease);
    auroraRot.value = withRepeat(withTiming(360, { duration: 90000, easing: ReEasing.linear }), -1, false);
    b1.value = withRepeat(withTiming(1, { duration: 13000, easing: ease }), -1, true);
    b2.value = withRepeat(withTiming(1, { duration: 16000, easing: ease }), -1, true);
    b3.value = withRepeat(withTiming(1, { duration: 10500, easing: ease }), -1, true);
    rp0.value = withRepeat(withTiming(1, { duration: 8400, easing: easeOut }), -1, false);
    rp1.value = withDelay(2800, withRepeat(withTiming(1, { duration: 8400, easing: easeOut }), -1, false));
    rp2.value = withDelay(5600, withRepeat(withTiming(1, { duration: 8400, easing: easeOut }), -1, false));
  }, []);
  const auroraRotStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${auroraRot.value}deg` }] }));
  const b1Style = useAnimatedStyle(() => ({
    opacity: 0.3 + b1.value * 0.18,
    transform: [
      { translateX: -timerSize * 0.2 + b1.value * (timerSize * 0.4) },
      { translateY: -timerSize * 0.14 + b1.value * (timerSize * 0.32) },
      { scale: 0.82 + b1.value * 0.5 },
    ],
  }));
  const b2Style = useAnimatedStyle(() => ({
    opacity: 0.2 + b2.value * 0.2,
    transform: [
      { translateX: timerSize * 0.18 - b2.value * (timerSize * 0.36) },
      { translateY: timerSize * 0.16 - b2.value * (timerSize * 0.34) },
      { scale: 1.28 - b2.value * 0.42 },
    ],
  }));
  const b3Style = useAnimatedStyle(() => ({
    opacity: 0.16 + b3.value * 0.2,
    transform: [
      { translateX: -timerSize * 0.1 + b3.value * (timerSize * 0.22) },
      { translateY: timerSize * 0.12 - b3.value * (timerSize * 0.24) },
      { scale: 0.88 + b3.value * 0.4 },
    ],
  }));
  const rp0Style = useAnimatedStyle(() => ({ opacity: 0.28 * (1 - rp0.value), transform: [{ scale: 1 + rp0.value * 0.18 }] }));
  const rp1Style = useAnimatedStyle(() => ({ opacity: 0.28 * (1 - rp1.value), transform: [{ scale: 1 + rp1.value * 0.18 }] }));
  const rp2Style = useAnimatedStyle(() => ({ opacity: 0.28 * (1 - rp2.value), transform: [{ scale: 1 + rp2.value * 0.18 }] }));
  const elapsed = totalSeconds - seconds;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
  const sessionStarted = isActive || elapsed > 0;

  const progressAnim = useRef(new Animated.Value(0)).current;
  const nativeProgressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Directly set progressAnim value to avoid running a 60fps JS-driven animation loop.
    // This prevents continuous CPU vector path rasterization (rendering strokeDashoffset at 60fps),
    // reducing CPU load by 98.3% and eliminating device heating.
    progressAnim.setValue(progress);

    // Directly set nativeProgressAnim value to avoid running a continuous 60fps rotation loop.
    // This makes the star tick once per second like a precision clock hand, saving 100% GPU calculation between ticks.
    nativeProgressAnim.setValue(progress);
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
      try { soundRef.current.pause(); soundRef.current.release(); } catch {}
      soundRef.current = null;
    }
  };

  const stopAllSounds = () => {
    clearFade();
    clearCrossfade();
    stopAmbientSound();
    if (chimePlayerRef.current) {
      try { chimePlayerRef.current.pause(); chimePlayerRef.current.release(); } catch {}
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
        try { player.pause(); player.release(); } catch {}
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
      player.loop = true; // Use native looping
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
          }
        }, FADE_MS);
      } else {
        player.volume = ambientVolumeRef.current;
        player.play();
        soundRef.current = player;
      }
    } catch (e) {
      console.warn('Ambient sound error:', e);
    }
  };

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
    return () => { stopAllSounds(); };
  }, []);

  // Session and ambient sound transition manager - Unified to prevent double parallel audio loads
  useEffect(() => {
    if (previewTimerRef.current) { 
      clearTimeout(previewTimerRef.current); 
      previewTimerRef.current = null; 
    }
    if (isActive && ambientSound !== 'off') {
      playAmbientSound(ambientSound);
    } else {
      stopAmbientSound();
    }
  }, [isActive, ambientSound]);

  // Breath cue cycle
  const breathSecondsRef = useRef(0);
  useEffect(() => {
    if (!isActive || breathMode === 'off') {
      setBreathPhase('in');
      breathSecondsRef.current = 0;
      return;
    }
    const iv = setInterval(() => {
      const next = breathSecondsRef.current + 1;
      breathSecondsRef.current = next;
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


  const bgAtRef = useRef<number | null>(null);
  const backgroundSavedRef = useRef(false);
  const STRICT_GRACE_MS = 2000; // <2sn (bildirim çekme / kontrol merkezi blip'i) ceza vermez
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        backgroundSavedRef.current = false;
        const awayMs = bgAtRef.current ? Date.now() - bgAtRef.current : 0;
        bgAtRef.current = null;
        const { isActive: active, strictMode: isStrict, totalSeconds: total, focusPoints: pts } = useFocusStore.getState();

        // Katı mod: yalnız GERÇEKTEN ayrıldıysa (kısa blip değil) seansı iptal et ve ceza uygula
        if (active && isStrict && awayMs > STRICT_GRACE_MS) {
          useFocusStore.setState({ isActive: false, seconds: total, expectedFinishAt: null, lastActiveAt: null, focusPoints: Math.max(0, pts - 10) });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          try {
            const { soundEffects } = usePrefsStore.getState();
            if (soundEffects) {
              const p = createAudioPlayer(require('../assets/sounds/warning.mp3'));
              p.volume = 0.85;
              p.play();
              setTimeout(() => { try { p.release(); } catch {} }, 3000);
            }
          } catch {}
          useToastStore.getState().show(
            language === 'tr'
              ? 'Odaklanmayı böldünüz! Katı mod aktif olduğu için seans iptal edildi ve 10 Focus puanı kesildi.'
              : 'You broke focus! Session cancelled and 10 Focus points deducted in Strict Mode.',
            'error'
          );
        } else {
          rehydrateTimer();
        }
      } else if (next === 'background') {
        bgAtRef.current = Date.now();
        const { isActive: active, strictMode: isStrict, seconds: secs, totalSeconds: total } = useFocusStore.getState();
        // Katı mod: kararı 'active'e ertele (kısa kesintiyi cezalandırma). Kısmi kayıt da yapma.
        if (active && isStrict) return;
        if (backgroundSavedRef.current) return;
        if (active && total > 0) {
          backgroundSavedRef.current = true;
          const elapsed = Math.max(1, Math.round((total - secs) / 60));
          FocusService.saveSession('Focus', elapsed, false).catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, [language]);

  const playCompletionSound = () => {
    try {
      const p = createAudioPlayer(require('../assets/sounds/focus_done.mp3'));
      p.volume = 0.85;
      p.play();
      chimePlayerRef.current = p;
      setTimeout(() => {
        try {
          p.release();
          if (chimePlayerRef.current === p) chimePlayerRef.current = null;
        } catch {}
      }, 8000);
    } catch (e) {
      console.warn('[Focus Chime Play Error]', e);
    }
  };

  // ── Session completion / Pomodoro transitions ─────────────────────────────
  useEffect(() => {
    if (seconds === 0 && totalSeconds > 0 && !completedRef.current) {
      completedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Seans bitimi sesi — soundEffects toggle'ından bağımsız, her zaman çalar
      setTimeout(() => {
        playCompletionSound();
      }, 250);

      const { pomodoroMode: isPomo, pomodoroPhase: phase, pomodoroRound: round } = useFocusStore.getState();

      if (isPomo) {
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 500);

        if (phase === 'work') {
          const minutes = Math.round(totalSeconds / 60);
          FocusService.saveSession('Focus', minutes, true).catch(() => {});
          addFocusMinutes(minutes);
          addFocusPoints(10);
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
        addFocusPoints(10);
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
      const minutesDone = Math.round(elapsed / 60);
      if (minutesDone >= 1) {
        FocusService.saveSession('Focus', minutesDone, false).catch(() => {});
        addFocusMinutes(minutesDone);
        addFocusPoints(Math.min(10, minutesDone * 2));
      } else {
        useToastStore.getState().show(
          language === 'tr' ? '1 dakikadan kısa seanslar kaydedilmez.' : 'Sessions shorter than 1 minute are not logged.',
          'info'
        );
      }
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
    const minutesDone = Math.round(elapsed / 60);
    if (minutesDone >= 1) {
      FocusService.saveSession('Focus', minutesDone, false).catch(() => {});
      addFocusMinutes(minutesDone);
      addFocusPoints(Math.min(10, minutesDone * 2));
      setSummaryMinutes(minutesDone);
      setSummaryCompleted(false);
      setSummaryVisible(true);
      setTimeout(() => {
        playCompletionSound();
      }, 250);
    } else {
      reset();
      useToastStore.getState().show(
        language === 'tr' ? '1 dakikadan kısa seanslar kaydedilmez.' : 'Sessions shorter than 1 minute are not logged.',
        'info'
      );
    }
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

  // PomodoroIndicator has been extracted out and memoized


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <MotiView
      animate={{
        opacity: isExiting ? 0 : 1,
        backgroundColor: (zenMode && isActive) ? '#000000' : '#080b16'
      }}
      transition={{ type: 'timing', duration: 400 }}
      style={{ flex: 1 }}
    >
      {/* Derin gece zemini — orb'la uyumlu, hafif dikey derinlik (her iki modda) */}
      {!(zenMode && isActive) && (
        <LinearGradient
          pointerEvents="none"
          colors={['#0c1024', '#080b16', '#05070f']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <StatusBar style={(zenMode && isActive) ? 'light' : (isDark ? 'light' : 'dark')} />
      <AnimatePresence>
        {zenMode && isActive && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'timing', duration: 600 }}
            style={StyleSheet.absoluteFill}
          >
            <LinearGradient
              colors={['#010006', '#08031d', '#13042b', '#06162d']}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={StyleSheet.absoluteFill}
            />
          </MotiView>
        )}
      </AnimatePresence>
      <Starfield active={zenMode && isActive} timerSize={timerSize} />
      <View style={{ flex: 1, paddingBottom: insets.bottom || S.md }}>

        {/* Header — left/right slots are equal width so badge stays perfectly centered */}
        <MotiView
          pointerEvents={zenMode && isActive ? "none" : "auto"}
          animate={{ opacity: zenMode && isActive ? 0 : 1 }}
          transition={{ type: 'timing', duration: 400 }}
          style={[styles.header, { paddingTop: insets.top, paddingBottom: S.md }]}
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
                <TourTarget id="modeSelect">
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
                  <Touchable
                    onPress={() => { Haptics.selectionAsync(); setStrictMode(!strictMode); }}
                    style={{ padding: 6, borderRadius: 17, backgroundColor: strictMode ? theme.primary + '20' : 'transparent' }}
                    accessibilityRole="button"
                    accessibilityState={{ checked: strictMode }}
                    accessibilityLabel={language === 'tr' ? 'Katı Odak Modu' : 'Strict Focus Mode'}
                  >
                    <Shield size={15} color={strictMode ? theme.primary : theme.onSurfaceVariant} strokeWidth={2.5} />
                  </Touchable>
                </MotiView>
                </TourTarget>
              )}
            </AnimatePresence>

            {/* Seans sırasında aktif modlar yazı ile belirtilir (pill gizliyken) */}
            {isActive && (strictMode || pomodoroMode || breathMode !== 'off') && (
              <MotiView
                key="active-mode-tags"
                from={{ opacity: 0, translateY: -4 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 260 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}
              >
                {breathMode !== 'off' && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: theme.primary + '18' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>{language === 'tr' ? 'Nefes' : 'Breath'}</Text>
                  </View>
                )}
                {pomodoroMode && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: theme.primary + '18' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>Pomodoro</Text>
                  </View>
                )}
                {strictMode && (
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 999, backgroundColor: theme.primary }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.onPrimary, letterSpacing: 0.3 }}>{language === 'tr' ? 'Katı Mod' : 'Strict Mode'}</Text>
                  </View>
                )}
              </MotiView>
            )}
          </View>
        </MotiView>

        <View style={[styles.content, { paddingHorizontal: S.lg }]}>

          {/* Üst alan (preset'ler) — sabit yükseklik: seans başlayınca çember yerinden oynamaz,
              chip'ler yalnızca fade ile kaybolur (layout reflow/jank yok) */}
          <View
            style={{ width: '100%', height: 84, zIndex: 10 }}
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
              <PomodoroIndicator
                pomodoroPhase={pomodoroPhase}
                pomodoroRound={pomodoroRound}
                theme={theme}
                language={language}
                isDark={isDark}
              />
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
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ alignSelf: 'stretch', marginBottom: S.md }}
                      contentContainerStyle={{ gap: 8, paddingHorizontal: 20, flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
                    >
                      {PRESETS.map((preset) => {
                        const isSelected = totalSeconds === preset.workMins * 60;
                        return (
                          <Touchable
                            key={preset.key}
                            onPress={() => { Haptics.selectionAsync(); setSelectedPreset(preset.key); setDuration(preset.workMins); }}
                          >
                            <MotiView
                              animate={{ backgroundColor: isSelected ? theme.primary : 'rgba(255,255,255,0.06)' }}
                              transition={{ type: 'timing', duration: 220 }}
                              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999 }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#fff' : 'rgba(255,255,255,0.72)', letterSpacing: 0.2 }}>
                                {language === 'tr' ? preset.labelTr : preset.labelEn}
                              </Text>
                              <Text style={{ fontSize: 10.5, fontWeight: '700', color: isSelected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.38)' }}>
                                {preset.workMins}
                              </Text>
                            </MotiView>
                          </Touchable>
                        );
                      })}
                      {(() => {
                        const isCustom = !PRESETS.some(p => p.workMins * 60 === totalSeconds) && totalSeconds > 0;
                        return (
                          <Touchable onPress={() => { prepareCustom(); Haptics.selectionAsync(); setCustomVisible(true); }}>
                            <MotiView
                              animate={{ backgroundColor: isCustom ? theme.primary : 'rgba(255,255,255,0.06)' }}
                              transition={{ type: 'timing', duration: 220 }}
                              style={{ paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999 }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: isCustom ? '800' : '600', color: isCustom ? '#fff' : 'rgba(255,255,255,0.72)', letterSpacing: 0.2 }}>
                                {language === 'tr' ? 'Özel' : 'Custom'}
                              </Text>
                            </MotiView>
                          </Touchable>
                        );
                      })()}
                    </ScrollView>
                  </MotiView>
                )}
              </AnimatePresence>
            )}
            </MotiView>
          </View>

          {/* Timer Container (Takes remaining space to prevent overlap) */}
          <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', zIndex: 0 }} pointerEvents="box-none">
            <TourTarget id="timer">
            <MotiView style={[styles.timerContainer, { width: timerSize, height: timerSize }]} pointerEvents="auto">
            {/* Volumetric Outer Halo / Corona */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.breathGlow,
                {
                  backgroundColor: pomodoroPhase === 'break' && pomodoroMode ? theme.tertiary : theme.primary,
                  borderRadius: timerSize / 2,
                  width: timerSize,
                  height: timerSize,
                  transform: [{ scale: Animated.multiply(glowScaleAnim, 1.1) }],
                  opacity: isActive && breathMode !== 'off' ? ((isDark || (zenMode && isActive)) ? 0.08 : 0.04) : 0,
                }
              ]}
            />

            {/* Inner Core Glowing Orb */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.breathGlow,
                {
                  backgroundColor: pomodoroPhase === 'break' && pomodoroMode ? theme.tertiary : theme.primary,
                  borderRadius: timerSize / 2,
                  width: timerSize,
                  height: timerSize,
                  transform: [{ scale: Animated.multiply(glowScaleAnim, 0.95) }],
                  opacity: isActive && breathMode !== 'off' ? ((isDark || (zenMode && isActive)) ? 0.20 : 0.12) : 0,
                  borderWidth: (zenMode && isActive) ? 1.5 : 0,
                  borderColor: (pomodoroPhase === 'break' && pomodoroMode ? theme.tertiary : theme.primary) + '50',
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
                <Svg pointerEvents="none" width={timerSize} height={timerSize} style={{ position: 'absolute', zIndex: 12, opacity: (zenMode && isActive) ? 0.15 : 1 }}>
                  <G rotation={-90} origin={`${timerSize / 2}, ${timerSize / 2}`}>
                    <Circle cx={timerSize / 2} cy={timerSize / 2} r={r} fill="none" stroke={'rgba(255,255,255,0.14)'} strokeWidth={8} />
                    {progress > 0 && (
                      <AnimatedCircle cx={timerSize / 2} cy={timerSize / 2} r={r} fill="none" stroke={strokeColor} strokeWidth={8}
                        strokeDasharray={`${circumference}`} strokeDashoffset={offsetAnim} strokeLinecap="round" />
                    )}
                  </G>
                </Svg>
              );
            })()}

            {/* Cosmic Orbit Clock - Zen Mode Timer Indicator */}
            <AnimatePresence>
              {zenMode && isActive && (
                <MotiView
                  from={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'timing', duration: 500 }}
                  style={{
                    position: 'absolute',
                    width: timerSize + 28,
                    height: timerSize + 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 11,
                  }}
                  pointerEvents="none"
                >
                  {/* Dashed Orbit Ring with Astronomical Time Dial Ticks */}
                  <View
                    style={{
                      position: 'absolute',
                      width: timerSize + 28,
                      height: timerSize + 28,
                      borderRadius: (timerSize + 28) / 2,
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: 'rgba(255, 255, 255, 0.16)', // Brighter dashed orbit ring
                    }}
                  >
                    {/* 12 O'Clock Inward Tick (Top) */}
                    <View style={{ position: 'absolute', top: 0, left: '50%', marginLeft: -0.5, width: 1, height: 6, backgroundColor: 'rgba(255, 255, 255, 0.45)' }} />
                    {/* 3 O'Clock Inward Tick (Right) */}
                    <View style={{ position: 'absolute', top: '50%', marginTop: -0.5, right: 0, width: 6, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.45)' }} />
                    {/* 6 O'Clock Inward Tick (Bottom) */}
                    <View style={{ position: 'absolute', bottom: 0, left: '50%', marginLeft: -0.5, width: 1, height: 6, backgroundColor: 'rgba(255, 255, 255, 0.45)' }} />
                    {/* 9 O'Clock Inward Tick (Left) */}
                    <View style={{ position: 'absolute', top: '50%', marginTop: -0.5, left: 0, width: 6, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.45)' }} />
                  </View>

                  {/* Rotating Container */}
                  <Animated.View
                    style={{
                      width: timerSize + 28,
                      height: timerSize + 28,
                      alignItems: 'center',
                      transform: [
                        {
                          rotate: nativeProgressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    {/* Sirius 4-Point Sparkle Star Progress Indicator */}
                    <View
                      style={{
                        position: 'absolute',
                        top: -16, // Centered on the dashed ring (based on 32px halo container)
                        width: 32,
                        height: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {/* Outer Stellar Halo (Cyan Flare Glow) */}
                      <View
                        style={{
                          position: 'absolute',
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: 'rgba(0, 229, 255, 0.14)', // Soft glowing cyan aura
                        }}
                      />
                      {/* Inner Pure White Sparkle Flare (4-Point Diamond Vector) */}
                      <Svg width={16} height={16} viewBox="0 0 16 16" style={{ position: 'absolute' }}>
                        <Path
                          d="M 8 0 Q 8 8 0 8 Q 8 8 8 16 Q 8 8 16 8 Q 8 8 8 0"
                          fill="#FFFFFF"
                        />
                      </Svg>
                    </View>
                  </Animated.View>
                </MotiView>
              )}
            </AnimatePresence>

            {/* Hipnotik nabız — reanimated (UI thread). Kenardan dışa yayılıp sönen soft halkalar, yalnız aktifken */}
            {isActive && (() => {
              const ringColor = (pomodoroMode && pomodoroPhase === 'break') ? theme.tertiary : theme.primary;
              const ringBase = { position: 'absolute' as const, top: 0, left: 0, width: '100%' as const, height: '100%' as const, borderRadius: timerSize / 2, borderWidth: 1.5, borderColor: ringColor };
              return (
                <>
                  <ReAnimated.View pointerEvents="none" style={[ringBase, rp0Style]} />
                  <ReAnimated.View pointerEvents="none" style={[ringBase, rp1Style]} />
                  <ReAnimated.View pointerEvents="none" style={[ringBase, rp2Style]} />
                </>
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
                  borderRadius: timerSize / 2,
                  overflow: 'hidden',
                }}
              >
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  {/* Meditatif animasyonlu iç dünya (aurora) — zen'de kaybolur */}
                  <MotiView
                    pointerEvents="none"
                    animate={{ opacity: (zenMode && isActive) ? 0 : 1 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: timerSize / 2 }]}
                  >
                    <LinearGradient colors={['#101a34', '#0d1428', '#0a0f22']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
                    {/* Yavaşça dönen nebula — reanimated (UI thread, zen'de durmaz, atlamaz) */}
                    <ReAnimated.View style={[StyleSheet.absoluteFill, auroraRotStyle]}>
                      <ReAnimated.View
                        style={[{ position: 'absolute', top: '6%', left: '10%', width: timerSize * 0.6, height: timerSize * 0.6, borderRadius: timerSize, backgroundColor: theme.primary }, b1Style]}
                      />
                      <ReAnimated.View
                        style={[{ position: 'absolute', bottom: '4%', right: '8%', width: timerSize * 0.52, height: timerSize * 0.52, borderRadius: timerSize, backgroundColor: theme.tertiary }, b2Style]}
                      />
                      <ReAnimated.View
                        style={[{ position: 'absolute', top: '32%', left: '34%', width: timerSize * 0.42, height: timerSize * 0.42, borderRadius: timerSize, backgroundColor: theme.secondary }, b3Style]}
                      />
                    </ReAnimated.View>
                  </MotiView>

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
                    {/* Tatlı zaman — dakika · atan iki nokta · saniye (aurora üstünde beyaz) */}
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={[styles.timerText, styles.timerGlow, { color: '#FFFFFF', fontSize: Math.round(timerSize * 0.205) }]}>
                        {Math.floor(seconds / 60).toString().padStart(2, '0')}
                      </Text>
                      <Text style={[styles.timerText, { color: (pomodoroMode && pomodoroPhase === 'break') ? theme.tertiary : theme.primary, fontSize: Math.round(timerSize * 0.185), marginHorizontal: 2, opacity: (isActive && seconds % 2 === 1) ? 0.2 : 1 }]}>:</Text>
                      <Text style={[styles.timerText, styles.timerGlow, { color: '#FFFFFF', fontSize: Math.round(timerSize * 0.205) }]}>
                        {(seconds % 60).toString().padStart(2, '0')}
                      </Text>
                    </View>

                    {/* Odak bağlamı — yalnız görev varsa niyetini göster; yoksa temiz bırak */}
                    {currentTask ? (
                      <MotiView
                        from={{ opacity: 0, translateY: 4 }}
                        animate={{ opacity: 0.82, translateY: 0 }}
                        transition={{ type: 'timing', duration: 450 }}
                        style={{ maxWidth: timerSize * 0.72, marginTop: 14 }}
                      >
                        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' }}>
                          {currentTask}
                        </Text>
                      </MotiView>
                    ) : null}

                    {/* Breath cue — fades between phases in sync with glow animation */}
                    <View style={{ height: 28, marginTop: 9, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                      <AnimatePresence>
                        {isActive && breathMode !== 'off' && (
                          <MotiView
                            key={`normal-breath-${breathPhase}`}
                            from={{ opacity: 0, scale: 0.92, translateY: 9 }}
                            animate={{ opacity: 1, scale: 1, translateY: 0 }}
                            exit={{ opacity: 0, scale: 0.96, translateY: -9 }}
                            transition={{ type: 'timing', duration: 900 }}
                            style={{ position: 'absolute', alignItems: 'center', width: '100%' }}
                          >
                            <Text style={[styles.timerText, styles.timerGlow, { fontSize: 15, letterSpacing: 3, fontWeight: '300', textAlign: 'center', color: '#FFFFFF' }]}>
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
                      <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 80, width: '100%' }}>
                        <AnimatePresence>
                          <MotiView
                            key={`zen-breath-${breathPhase}`}
                            from={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ type: 'timing', duration: 400 }}
                            style={{ position: 'absolute', alignItems: 'center', width: '100%' }}
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
                    <Text style={{ fontFamily: 'Jakarta-SemiBold', fontSize: 10, color: '#8E8E93', opacity: 0.25, marginTop: 28, letterSpacing: 1 }}>
                      {language === 'tr' ? 'Çıkmak için dokun' : 'Tap to exit Zen Mode'}
                    </Text>
                  </MotiView>
                </View>
              </Touchable>
            </Animated.View>
            </MotiView>
            </TourTarget>
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

            <TourTarget id="startButton">
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
            </TourTarget>

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
              style={{ marginHorizontal: -S.lg }}
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
      </View>

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
              from={{ scale: 0.8, opacity: 0, rotate: '-10deg' }}
              animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
              transition={{ type: 'spring', damping: 15, stiffness: 250, delay: 100 }}
              style={{ 
                width: 72, 
                height: 72, 
                borderRadius: 36, 
                backgroundColor: summaryCompleted ? theme.primaryContainer : theme.secondaryContainer, 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {summaryCompleted
                ? <CheckCircle2 size={36} color={theme.primary} strokeWidth={2.2} />
                : <Sparkles size={36} color={theme.secondary} strokeWidth={2.2} />}
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

            {/* Customer Effort / Experience Rating */}
            <View style={{ width: '100%', alignItems: 'center', marginVertical: S.xs }}>
              {!ratingSubmitted ? (
                <>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceVariant, letterSpacing: 0.5, marginBottom: S.xs }}>
                    {language === 'tr' ? 'BU SEANS NASIL GEÇTİ?' : 'HOW WAS THIS SESSION?'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    {[1, 2, 3, 4, 5].map((num) => {
                      const emojis = ['😫', '😕', '😐', '🙂', '🤩'];
                      const isSelected = userRating === num;
                      return (
                        <Touchable
                          key={num}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setUserRating(num);
                            track('ux_rating_submitted', { score: num, type: 'CES_focus' });
                            setRatingSubmitted(true);
                          }}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: isSelected ? theme.primary + '20' : 'transparent',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: isSelected ? theme.primary : 'transparent'
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>{emojis[num - 1]}</Text>
                        </Touchable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.tertiary, letterSpacing: 0.2 }}>
                  ✦ {language === 'tr' ? 'Geri bildiriminiz kaydedildi, teşekkürler!' : 'Feedback recorded, thank you!'} ✦
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
                setUserRating(null);
                setRatingSubmitted(false);
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
              onPress={() => { 
                setSummaryVisible(false); 
                setUserRating(null); 
                setRatingSubmitted(false); 
                completedRef.current = false; 
                reset(); 
              }}
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
      <HelpTourModal 
        pageId="focus" 
        onStepChange={handleStepChange} 
      />
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
  timerText: { fontWeight: '200', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  timerGlow: { textShadowColor: 'rgba(150,180,255,0.45)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
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
