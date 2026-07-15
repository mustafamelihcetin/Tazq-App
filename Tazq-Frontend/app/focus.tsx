import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Modal, TextInput, AppState, Animated, ScrollView, BackHandler, Easing, InteractionManager, AccessibilityInfo } from 'react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import Svg, { Circle, G, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles, CheckCircle2, Pencil, Timer, ChevronRight, Coffee, Wind, CloudRain, Flame, Waves, Music2, Headphones, Shield } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusStore } from '@/features/focus';
import { useShallow } from 'zustand/react/shallow';
import * as HapticsOriginal from 'expo-haptics';
const Haptics = {
  notificationAsync: (type: any) => HapticsOriginal.notificationAsync(type).catch(() => {}),
  impactAsync: (style: any) => HapticsOriginal.impactAsync(style).catch(() => {}),
  selectionAsync: () => HapticsOriginal.selectionAsync().catch(() => {}),
  NotificationFeedbackType: HapticsOriginal.NotificationFeedbackType,
  ImpactFeedbackStyle: HapticsOriginal.ImpactFeedbackStyle,
};
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
import { ICON, S, R, F, B, SPRING_SOFT } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { HelpTourModal } from '@/shared/components/HelpTourModal';
import { TourTarget, useTour } from '@/shared/components/TourContext';
import { Easing as RNEasing } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, useDerivedValue, withRepeat, withTiming, withDelay, cancelAnimation, Easing as ReEasing, type SharedValue } from 'react-native-reanimated';
import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { swallow } from '@/shared/utils/swallow';
import type { AppTheme } from '@/shared/constants/Colors';
import { Separator } from '@/shared/components/Separator';

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

// ── Saniyeye bağlı izole render'lar ───────────────────────────────────────────
// Kasma/ısı düzeltmesi: eskiden parent tüm store'a abone olduğu için `seconds` her saniye
// değişince 2000+ satırlık ağaç yeniden render oluyordu. Saniyeye bağlı iki parçayı buraya
// izole ettik → artık yalnız bu minik bileşenler saniyede bir render olur, ana ekran olmaz.

// Sayaç metni (dk : atan iki nokta : sn). Yalnız seconds/isActive'e abone.
const CountdownText = React.memo(({ timerSize, colonColor, reduceMotion }: { timerSize: number; colonColor: string; reduceMotion?: boolean }) => {
  const seconds = useFocusStore(s => s.seconds);
  const isActive = useFocusStore(s => s.isActive);
  const big = Math.round(timerSize * 0.205);
  const mid = Math.round(timerSize * 0.185);
  // İki nokta: Sakin mod'da sabit; normalde sert blink (0.2↔1) yerine nazik kımıltı (0.55↔0.85) —
  // saniyeliği yaşam belirtisi kalsın ama göz köşesinde rahatsız etmesin.
  const colonOpacity = reduceMotion ? 0.7 : ((isActive && seconds % 2 === 1) ? 0.55 : 0.85);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={[styles.timerText, styles.timerGlow, { color: '#FFFFFF', fontSize: big }]}>
        {Math.floor(seconds / 60).toString().padStart(2, '0')}
      </Text>
      <Text style={[styles.timerText, { color: colonColor, fontSize: mid, marginHorizontal: S.xxs, opacity: colonOpacity }]}>:</Text>
      <Text style={[styles.timerText, styles.timerGlow, { color: '#FFFFFF', fontSize: big }]}>
        {(seconds % 60).toString().padStart(2, '0')}
      </Text>
    </View>
  );
});

// SVG halka + zen yörünge Animated.Value'ları saniyeye göre besler (kendisi görünmez).
// Animated.Value güncellemesi native/JS animasyon düğümünü tazeler; React re-render gerektirmez.
const ProgressDriver = React.memo(({ progressAnim, nativeProgressAnim }: { progressAnim: Animated.Value; nativeProgressAnim: Animated.Value }) => {
  const progress = useFocusStore(s => (s.totalSeconds > 0 ? (s.totalSeconds - s.seconds) / s.totalSeconds : 0));
  useEffect(() => {
    progressAnim.setValue(progress);
    nativeProgressAnim.setValue(progress);
  }, [progress]);
  return null;
});

// ── Skia nebula ───────────────────────────────────────────────────────────────
// Eski görsel: koyu lacivert taban + 3 yarı-saydam renkli dairenin döndürülüp harmanlanması
// (üst üste katman = overdraw = ısı). Yeni: aynı görünüm tek GPU shader'ı ile, tek draw call,
// overdraw ve maske pass olmadan. Renk merkezleri zamana göre yumuşakça sürüklenir.
const NEBULA_SKSL = `
uniform float u_time;
uniform float2 u_res;
uniform float3 c1;
uniform float3 c2;
uniform float3 c3;
uniform float u_hold;

// Yumuşak, dalgalı ışık perdesi — aurora "curtain". Dalga merkezi zamanla süzülür,
// smoothstep ile geniş/blurlu kenar, hafif dikey çizgilenme perde dokusu verir.
float curtain(float2 uv, float t, float yBase, float amp, float freq, float phase) {
  float center = yBase
    + amp * sin(uv.x * freq + t + phase)
    + amp * 0.45 * sin(uv.x * freq * 2.3 + t * 1.4 + phase);
  float d = abs(uv.y - center);
  float glow = smoothstep(0.32, 0.0, d);
  float streak = 0.86 + 0.14 * sin(uv.x * 34.0 + t * 0.6 + phase);
  return glow * glow * streak;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  // Basılı tutma (nefes al): uv'yi merkeze doğru topla → aurora içe çekilir, bırakınca yayılır.
  uv = mix(uv, float2(0.5, 0.5), u_hold * 0.14);
  float t = u_time * 0.33;

  // Derin uzay tabanı — altta daha koyu
  float3 col = mix(float3(0.05, 0.09, 0.20), float3(0.02, 0.03, 0.09), uv.y);

  // Tutunca perdeler parlar (aurora "yoğunlaşır")
  float boost = 1.0 + u_hold * 0.85;
  col += c2 * curtain(uv, t,        0.44, 0.10, 3.0, 0.0) * 0.55 * boost;
  col += c1 * curtain(uv, t * 1.12, 0.56, 0.12, 2.3, 2.0) * 0.42 * boost;
  col += c3 * curtain(uv, t * 0.9,  0.34, 0.08, 3.6, 4.0) * 0.38 * boost;

  // Merkezde toplanan yumuşak ışık çekirdeği — tut süresince birikir (nefesi topla)
  float core = smoothstep(0.5, 0.0, distance(uv, float2(0.5, 0.5)));
  col += (c1 * 0.4 + float3(0.16, 0.18, 0.26)) * core * core * u_hold * 0.6;

  return half4(col, 1.0);
}
`;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// c1=primary, c2=tertiary, c3=secondary (eski blob renkleriyle birebir).
// paused=true iken zaman uniform'u dondurulur → shader yeniden çizmez, GPU boşta (zen/ritual).
/**
 * Shader MODÜL seviyesinde derlenir — bileşen içinde değil.
 *
 * Eskiden `useMemo(() => Skia.RuntimeEffect.Make(NEBULA_SKSL), [])` bileşenin İÇİNDEYDİ.
 * useMemo bileşen ÖRNEĞİ başına saklar, yani:
 *   - Odak ekranına her girişte yeniden derleniyordu (yeni mount = yeni örnek).
 *   - Aynı anda iki Nebula var (zen zemini + daire içi) → aynı shader İKİ KEZ derleniyordu.
 *
 * Modül seviyesinde bir kez derlenir ve tüm örnekler paylaşır. Uygulama ömrü boyunca tek
 * derleme.
 *
 * NOT: bu, ilk girişteki gecikmenin TAMAMINI çözmez — SkSL derlense bile GPU'nun kendi
 * pipeline'ı ilk çizimde oluşur ve bu maliyet doğaldır. O yüzden aurora ayrıca yumuşak
 * açılıyor (bkz. kullanım yeri): kalan gecikme "takılma" değil "beliriş" gibi okunsun.
 */
const NEBULA_EFFECT = Skia.RuntimeEffect.Make(NEBULA_SKSL);

// size: kare (daire-içi kullanım). width/height verilirse tam-ekran (zen zemini). speedScale: akış hızı.
const Nebula = React.memo(({ size, width, height, c1, c2, c3, paused, speedScale = 1, holdSV }: { size: number; width?: number; height?: number; c1: string; c2: string; c3: string; paused: boolean; speedScale?: number; holdSV?: SharedValue<number> }) => {
  const w = width ?? size;
  const h = height ?? size;
  // Derleme modül seviyesinde — bkz. NEBULA_EFFECT.
  const clock = useClock();
  const pausedSV = useSharedValue(paused);
  useEffect(() => { pausedSV.value = paused; }, [paused]);
  const frozen = useSharedValue(0);
  const time = useDerivedValue(() => {
    'worklet';
    // Duraklatıldıysa saati OKUMA → donar (redraw yok). hold değişince uniforms yine de yeniden hesaplanır.
    if (pausedSV.value) return frozen.value;
    const v = (clock.value / 1000) * speedScale;
    frozen.value = v;
    return v;
  });
  const rgb1 = useMemo(() => hexToRgb(c1), [c1]);
  const rgb2 = useMemo(() => hexToRgb(c2), [c2]);
  const rgb3 = useMemo(() => hexToRgb(c3), [c3]);
  const uniforms = useDerivedValue(() => ({
    u_time: time.value,
    u_res: [w, h],
    c1: rgb1,
    c2: rgb2,
    c3: rgb3,
    u_hold: holdSV ? holdSV.value : 0,
  }));
  if (!NEBULA_EFFECT) return null;
  return (
    <Canvas style={{ width: w, height: h }}>
      <Fill>
        <Shader source={NEBULA_EFFECT} uniforms={uniforms} />
      </Fill>
    </Canvas>
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
  theme: AppTheme;
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
    <View style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center' }}>
      {[1, 2, 3, 4].map(i => (
        <View
          key={i}
          style={{
            width: i === pomodoroRound ? 10 : 7,
            height: i === pomodoroRound ? 10 : 7,
            borderRadius: R.xs,
            backgroundColor: i < pomodoroRound
              ? theme.primary
              : i === pomodoroRound
                ? (pomodoroPhase === 'work' ? theme.primary : theme.tertiary)
                : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
          }}
        />
      ))}
    </View>
    <Text style={{ fontSize: 11, color: theme.onSurfaceMuted, fontWeight: '600' }}>
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

  // Kasma/ısı düzeltmesi: `seconds` bilinçli olarak SEÇİLMİYOR. Böylece saniyelik tick artık
  // bu dev bileşeni değil, yalnızca CountdownText/ProgressDriver çocuklarını render eder.
  const {
    isActive, totalSeconds, currentTask,
    setIsActive, reset, setDuration,
    rehydrateTimer, addFocusMinutes,
    pomodoroMode, pomodoroRound, pomodoroPhase,
    togglePomodoroMode, nextPomodoroPhase,
    strictMode, setStrictMode, addFocusPoints,
  } = useFocusStore(useShallow(s => ({
    isActive: s.isActive, totalSeconds: s.totalSeconds, currentTask: s.currentTask,
    setIsActive: s.setIsActive, reset: s.reset, setDuration: s.setDuration,
    rehydrateTimer: s.rehydrateTimer, addFocusMinutes: s.addFocusMinutes,
    pomodoroMode: s.pomodoroMode, pomodoroRound: s.pomodoroRound, pomodoroPhase: s.pomodoroPhase,
    togglePomodoroMode: s.togglePomodoroMode, nextPomodoroPhase: s.nextPomodoroPhase,
    strictMode: s.strictMode, setStrictMode: s.setStrictMode, addFocusPoints: s.addFocusPoints,
  })));

  // sessionStarted bir boolean selector: değeri sadece geçişlerde değişir (her saniye değil),
  // dolayısıyla parent'ı saniyede bir render ETTİRMEZ.
  const sessionStarted = useFocusStore(s => s.isActive || (s.totalSeconds - s.seconds) > 0);
  // Bitiş algısı için boolean selector: yalnız sıfır-geçişinde değişir → saniyelik render yok.
  const atZero = useFocusStore(s => s.seconds === 0);

  // elapsed'i (geçen saniye) event handler'larda güncel oku — render'a bağlı closure değil.
  const getElapsed = () => {
    const st = useFocusStore.getState();
    return st.totalSeconds - st.seconds;
  };

  const completedRef = useRef(false);
  const { trigger: triggerAchievement } = useAchievementStore();
  // Derin odak tercihleri artık prefs store'da (cihazda kalıcı) — her seansda sıfırlanmaz.
  const { soundEffects, focusBreathMode, setFocusBreathMode, focusAmbientSound, setFocusAmbientSound, focusPreset, setFocusPreset } = usePrefsStore();
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
  const playRequestIdRef = useRef(0);
  // Kalıcı tercihler store'dan; isimler aynı kaldığı için ekranın gerisi değişmiyor.
  const ambientSound = focusAmbientSound as AmbientSound;
  const setAmbientSound = setFocusAmbientSound as (v: AmbientSound) => void;

  // Breath cue phase — synced to glow animation
  const [breathPhase, setBreathPhase] = useState<'in' | 'hold_in' | 'out' | 'hold_out'>('in');
  const breathMode = focusBreathMode;
  const setBreathMode = setFocusBreathMode;
  const [breathPickerVisible, setBreathPickerVisible] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  // (Aurora reanimated animasyonları timerSize tanımından sonra kuruldu — aşağıya bakınız.)

  // Named preset selection — kalıcı (store)
  const selectedPreset = focusPreset as PresetKey;
  const setSelectedPreset = setFocusPreset as (v: PresetKey) => void;
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
  // Zen zemini tam DAİRENİN boyutundan büyümeye başlasın: ışık dairenin içinden taşsın,
  // rastgele bir ölçekten değil. Eskiden 0.6 sabiti vardı ve daireyle ilgisi yoktu.
  const zenFrom = timerSize / width;

  // Nebula artık Skia shader ile çiziliyor (tek draw call, overdraw yok). Eski 3-blob reanimated
  // katmanları kaldırıldı. Ripple halkaları hâlâ reanimated.
  const rp0 = useSharedValue(0);
  const rp1 = useSharedValue(0);
  const rp2 = useSharedValue(0);
  // Basılı tutma "nefesi topla": tut → aurora içe toplanıp parlar (shader u_hold); bırak → dışa dalga (exhale).
  const holdBloom = useSharedValue(0);        // 0→1 hold yoğunluğu, Nebula shader'ına u_hold olarak gider
  const releaseRipple = useSharedValue(0);    // bırakınca tek seferlik dışa yayılan dalga
  const pressStartRef = useRef(0);
  const chargeHapticRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Zen'e sakin otomatik geçiş için: kullanıcı bu seansda zen'e elle dokunduysa zorlama.
  const userToggledZenRef = useRef(false);
  // ── Sakin mod (reduce-motion) ──────────────────────────────────────────────
  // OS "Hareketi Azalt" ayarını izle. Açıkken dekoratif hareket (aurora, halkalar,
  // yanıp sönme) durur → erişilebilirlik + gerçek meditatif sükûnet.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted) setReduceMotion(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduceMotion(v));
    return () => { mounted = false; sub.remove(); };
  }, []);

  // Aurora zen modunda gizleniyor; completionRitual'da %78 karartma altında kalıyor.
  // Bu durumda (ve Sakin mod'da) Skia nebula'yı duraklat → shader yeniden çizmez, GPU boşta.
  const auroraVisible = !(zenMode && isActive) && !completionRitual;

  // Hipnotik nabız halkaları yalnız isActive iken (ve Sakin mod kapalıyken) çalışır.
  useEffect(() => {
    if (!isActive || reduceMotion) {
      cancelAnimation(rp0); cancelAnimation(rp1); cancelAnimation(rp2);
      return;
    }
    const easeOut = ReEasing.out(ReEasing.ease);
    rp0.value = withRepeat(withTiming(1, { duration: 8400, easing: easeOut }), -1, false);
    rp1.value = withDelay(2800, withRepeat(withTiming(1, { duration: 8400, easing: easeOut }), -1, false));
    rp2.value = withDelay(5600, withRepeat(withTiming(1, { duration: 8400, easing: easeOut }), -1, false));
  }, [isActive, reduceMotion]);

  // Sakin karşılama: seans başlayınca kullanıcı sayacı görsün, sonra ekran kendini zen'e bıraksın
  // (clock-watching'i azaltır). Kullanıcı bu seansda zen'e elle dokunduysa zorlamaz; tek dokunuşla çıkılır.
  useEffect(() => {
    if (!isActive) { userToggledZenRef.current = false; return; }
    const id = setTimeout(() => {
      if (useFocusStore.getState().isActive && !userToggledZenRef.current) setZenMode(true);
    }, 2500);
    return () => clearTimeout(id);
  }, [isActive]);
  // Opaklık çan eğrisi: sin(value·π) → başta 0, ortada tepe (0.28), sonda 0. Böylece döngü
  // başa dönerken (value 1→0) halka zaten görünmez olduğundan "pat" atlama olmaz, akış kesintisiz.
  const rp0Style = useAnimatedStyle(() => ({ opacity: 0.28 * Math.sin(rp0.value * Math.PI), transform: [{ scale: 1 + rp0.value * 0.22 }] }));
  const rp1Style = useAnimatedStyle(() => ({ opacity: 0.28 * Math.sin(rp1.value * Math.PI), transform: [{ scale: 1 + rp1.value * 0.22 }] }));
  const rp2Style = useAnimatedStyle(() => ({ opacity: 0.28 * Math.sin(rp2.value * Math.PI), transform: [{ scale: 1 + rp2.value * 0.22 }] }));
  // Bırakma dalgası: daireden dışa yayılıp sönen tek halka (nefes verme). Opaklık çan eğrisi → kesintisiz.
  const releaseRippleStyle = useAnimatedStyle(() => ({ opacity: 0.34 * Math.sin(releaseRipple.value * Math.PI), transform: [{ scale: 1 + releaseRipple.value * 0.5 }] }));
  // progress/elapsed artık parent render'ında hesaplanmıyor (saniyeye bağlıydı).
  // progressAnim'i <ProgressDriver/> besliyor; sessionStarted yukarıda boolean selector'dan geliyor.
  const progressAnim = useRef(new Animated.Value(0)).current;
  const nativeProgressAnim = useRef(new Animated.Value(0)).current;

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
      try { soundRef.current.volume = vol; } catch (e) { swallow('focus.updateAmbientVolume', e); }
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
      try { soundRef.current.pause(); soundRef.current.release(); } catch (e) { swallow('focus.stopAmbientSound', e); }
      soundRef.current = null;
    }
  };

  const stopAllSounds = () => {
    clearFade();
    clearCrossfade();
    stopAmbientSound();
    if (chimePlayerRef.current) {
      try { chimePlayerRef.current.pause(); chimePlayerRef.current.release(); } catch (e) { swallow('focus.stopAllSounds', e); }
      chimePlayerRef.current = null;
    }
  };

  // stepMs: adım aralığı. Varsayılan hızlı (seans geçişleri); önizleme için daha büyük değer =
  // daha uzun/yumuşak "sakin" kapanış.
  const stopAmbientSoundFaded = (stepMs: number = FADE_MS) => {
    clearFade();
    clearCrossfade();
    currentSoundTypeRef.current = 'off';
    const player = soundRef.current;
    if (!player) return;
    let vol = player.volume;
    const stepVal = vol / FADE_STEPS;
    fadeIntervalRef.current = setInterval(() => {
      vol = Math.max(0, vol - stepVal);
      try { player.volume = vol; } catch (e) { swallow('focus.ambientFadeOutVolume', e); }
      if (vol <= 0) {
        clearFade();
        try { player.pause(); player.release(); } catch (e) { swallow('focus.ambientStopRelease', e); }
        soundRef.current = null;
      }
    }, stepMs);
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
    const myId = ++playRequestIdRef.current;
    stopAmbientSound();
    if (type === 'off') return;
    try {
      const player = createAudioPlayer(getSoundSource(type));
      if (myId !== playRequestIdRef.current) {
        try { player.release(); } catch (e) { swallow('focus.ambientSwapRelease', e); }
        return;
      }
      player.loop = true; // Use native looping
      currentSoundTypeRef.current = type;

      if (fadeIn) {
        player.volume = 0;
        player.play();
        soundRef.current = player;
        let vol = 0;
        const stepVal = ambientVolumeRef.current / FADE_STEPS;
        fadeIntervalRef.current = setInterval(() => {
          if (myId !== playRequestIdRef.current) {
            clearFade();
            try { player.release(); } catch (e) { swallow('focus.ambientFadeInRelease', e); }
            return;
          }
          vol = Math.min(vol + stepVal, ambientVolumeRef.current);
          try { if (soundRef.current) soundRef.current.volume = vol; } catch (e) { swallow('focus.ambientFadeInVolume', e); }
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
    if (isActive) {
      // Seans başladı → bekleyen önizleme (demo) timer'ını iptal et, sesi tam ele al.
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      if (ambientSound !== 'off') {
        playAmbientSound(ambientSound);
      } else {
        stopAmbientSound();
      }
    } else {
      // Seans yokken önizleme akışını (kendi 7sn timer'ı + yumuşak fade'i) onPress yönetir;
      // burada timer'ı SİLMİYORUZ ki demo kesilmesin. Ses kapatıldıysa güvenlik amaçlı durdur.
      if (ambientSound === 'off') {
        stopAmbientSound();
      }
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
              setTimeout(() => { try { p.release(); } catch (e) { swallow('focus.warningChimeRelease', e); } }, 3000);
            }
          } catch (e) { swallow('focus.warningChimePlay', e); }
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
          FocusService.saveSession('Focus', elapsed, false).catch((e) => swallow('focus.saveSessionOnAbort', e, { capture: true }));
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
        } catch (e) { swallow('focus.doneChimeRelease', e); }
      }, 8000);
    } catch (e) {
      console.warn('[Focus Chime Play Error]', e);
    }
  };

  // ── Session completion / Pomodoro transitions ─────────────────────────────
  useEffect(() => {
    if (atZero && totalSeconds > 0 && !completedRef.current) {
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
          FocusService.saveSession('Focus', minutes, true).catch((e) => swallow('focus.saveSessionOnComplete', e, { capture: true }));
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
        // Kasma düzeltmesi: bitiş anında yalnız görsel + haptik senkron çalışsın; ses release,
        // network ve store yazımları gibi ağır defter işleri ritual animasyonunun ilk karelerini
        // bloklamasın diye InteractionManager ile animasyon sonrasına ertelenir.
        const minutes = Math.round(totalSeconds / 60);
        setZenMode(false); // Reset Zen Mode (görsel geçiş)
        setSummaryMinutes(minutes);
        setSummaryCompleted(true);
        setCompletionRitual(true);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
        setTimeout(() => { setCompletionRitual(false); setSummaryVisible(true); }, 1800);

        InteractionManager.runAfterInteractions(() => {
          stopAmbientSound();
          setAmbientSound('off');
          FocusService.saveSession('Focus', minutes, true).catch((e) => swallow('focus.saveSessionOnComplete', e, { capture: true }));
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
        });
      }
    }
    if (isActive && !atZero) completedRef.current = false;
  }, [isActive, atZero]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const elapsed = getElapsed();
    if (elapsed > 0) {
      const minutesDone = Math.round(elapsed / 60);
      if (minutesDone >= 1) {
        FocusService.saveSession('Focus', minutesDone, false).catch((e) => swallow('focus.saveSessionOnStop', e, { capture: true }));
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
    const minutesDone = Math.round(getElapsed() / 60);
    if (minutesDone >= 1) {
      FocusService.saveSession('Focus', minutesDone, false).catch((e) => swallow('focus.saveSessionOnStop', e, { capture: true }));
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
            {/* Zen zemini: tam-ekran aurora — loş, yavaş, blurlu. "Talep etmeyen varlık":
                göz fark eder ama takip etmez. Daireden taşıp genişleyerek gelir. */}
            <MotiView
              pointerEvents="none"
              /*
                GEÇİŞ TEK BİR HAREKET: daireki ışık BÜYÜYÜP ekranı dolduruyor — ölüp
                yeniden doğmuyor. Üç şey düzeldi:

                1. Başlangıç ölçeği artık DAİRENİN GERÇEK ORANI (zenFrom), keyfi 0.6 değil.
                   Yorum zaten "daireden taşıp genişleyerek gelir" diyordu — niyet doğruydu,
                   sayı uydurmaydı: 0.6, dairenin ekrandaki payıyla (0.72) uyuşmuyordu, yani
                   ışık dairenin İÇİNDEN değil rastgele bir yerden büyüyordu.

                2. Yay fiziği (SPRING_SOFT), mekanik süre değil. Işığın yayılması kütlesi
                   olan bir şeydir; sabit süreli `timing` onu asansör kapısı gibi açıyordu.

                3. Süre uyumsuzluğu giderildi: daire aurorası 400ms'de ölüyor, zemin
                   900ms'de yetişiyordu — 400. ms'de ekran %44 doluydu ve arada KARANLIK
                   BİR BOŞLUK kalıyordu. Kullanıcının "tamamlayıcı değil" dediği şey buydu.
                   Daire aurorası artık 700ms'de sönüyor, yani zemin büyürken üstünde.
              */
              from={{ opacity: 0, scale: zenFrom }}
              animate={{ opacity: 0.3, scale: 1 }}
              exit={{ opacity: 0, scale: zenFrom }}
              transition={SPRING_SOFT}
              style={StyleSheet.absoluteFill}
            >
              <Nebula
                size={0}
                width={width}
                height={height}
                c1={theme.primary}
                c2={theme.tertiary}
                c3={theme.secondary}
                paused={!(zenMode && isActive) || reduceMotion}
                speedScale={0.45}
                holdSV={holdBloom}
              />
            </MotiView>
          </MotiView>
        )}
      </AnimatePresence>
      {/* Zen'de yıldızlar kısılır — aurora zemin, yörünge saati figür (figür-zemin ilkesi). */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: (zenMode && isActive) ? 0.4 : 1 }} pointerEvents="none">
        <Starfield active={zenMode && isActive} timerSize={timerSize} />
      </View>
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
                const elapsed = getElapsed();
                if (elapsed > 0) {
                  setIsActive(false);
                  const minutesDone = Math.max(1, Math.round(elapsed / 60));
                  FocusService.saveSession('Focus', minutesDone, false).catch((e) => swallow('focus.saveSessionOnExit', e, { capture: true }));
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
              <X size={ICON.md} color={theme.onSurface} />
            </Touchable>
          </View>

          <View style={[styles.badge, { backgroundColor: theme.primary + '15', flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginHorizontal: S.sm }]}>
            <Sparkles size={ICON.xs} color={theme.primary} />
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
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', borderRadius: R.xl, padding: S.xs }}
                >
                  <Touchable
                    accessibilityRole="button"
                    accessibilityLabel={language === 'tr' ? 'Nefes modu ayarları' : 'Breathing mode settings'}
                    accessibilityState={{ selected: breathMode !== 'off' }}
                    onPress={() => { Haptics.selectionAsync(); setBreathPickerVisible(true); }}
                    style={{ padding: S.sm, borderRadius: R.lg, backgroundColor: breathMode !== 'off' ? theme.primary + '20' : 'transparent' }}
                  >
                    <Wind size={ICON.sm} color={breathMode !== 'off' ? theme.primary : theme.onSurfaceVariant} strokeWidth={2.5} />
                  </Touchable>
                  <Touchable
                    accessibilityRole="switch"
                    accessibilityLabel={language === 'tr' ? 'Pomodoro modu' : 'Pomodoro mode'}
                    accessibilityState={{ checked: pomodoroMode }}
                    onPress={() => { Haptics.selectionAsync(); togglePomodoroMode(); if (!pomodoroMode) setDuration(activePreset.workMins); }}
                    style={{ padding: S.sm, borderRadius: R.lg, backgroundColor: pomodoroMode ? theme.primary + '20' : 'transparent' }}
                  >
                    <Timer size={ICON.sm} color={pomodoroMode ? theme.primary : theme.onSurfaceVariant} strokeWidth={2.5} />
                  </Touchable>
                  <Touchable
                    onPress={() => { Haptics.selectionAsync(); setStrictMode(!strictMode); }}
                    style={{ padding: S.sm, borderRadius: R.lg, backgroundColor: strictMode ? theme.primary + '20' : 'transparent' }}
                    accessibilityRole="button"
                    accessibilityState={{ checked: strictMode }}
                    accessibilityLabel={language === 'tr' ? 'Katı Odak Modu' : 'Strict Focus Mode'}
                  >
                    <Shield size={ICON.sm} color={strictMode ? theme.primary : theme.onSurfaceVariant} strokeWidth={2.5} />
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
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap', justifyContent: 'flex-end' }}
              >
                {breathMode !== 'off' && (
                  <View style={{ paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: theme.primary + '18' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>{language === 'tr' ? 'Nefes' : 'Breath'}</Text>
                  </View>
                )}
                {pomodoroMode && (
                  <View style={{ paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: theme.primary + '18' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>Pomodoro</Text>
                  </View>
                )}
                {strictMode && (
                  <View style={{ paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: theme.primary }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onPrimary, letterSpacing: 0.3 }}>{language === 'tr' ? 'Katı Mod' : 'Strict Mode'}</Text>
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
                      contentContainerStyle={{ gap: S.sm, paddingHorizontal: S.lmd, flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
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
                              style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.xs, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full }}
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
                              style={{ paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full }}
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
            {/* Saniyeye bağlı progress'i SVG/zen-orbit Animated.Value'larına besler (görünmez, null render) */}
            <ProgressDriver progressAnim={progressAnim} nativeProgressAnim={nativeProgressAnim} />
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
                    {sessionStarted && (
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
                          borderRadius: R.full,
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

            {/* Hipnotik nabız — soft halkalar, yalnız aktifken ve Sakin mod kapalıyken */}
            {isActive && !reduceMotion && (() => {
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

            {/* Nefes verme dalgası — basılı tutup BIRAKINCA daireden dışa yayılıp sönen tek halka */}
            {isActive && !reduceMotion && (
              <ReAnimated.View
                pointerEvents="none"
                style={[
                  { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: timerSize / 2, borderWidth: 2, borderColor: (pomodoroMode && pomodoroPhase === 'break') ? theme.tertiary : theme.primary },
                  releaseRippleStyle,
                ]}
              />
            )}

            <Animated.View
              pointerEvents={zenMode && isActive ? "box-none" : "auto"}
              style={[styles.timerCircle, {
                width: '100%',
                height: '100%',
                zIndex: 10,
                borderRadius: timerSize / 2,
                transform: [{ scale: circleScaleAnim }],
                // iOS ısı düzeltmesi: bu view breath modunda circleScaleAnim ile her karede
                // ölçekleniyor. Üzerindeki shadowRadius:30 gölge (shadowPath yok) hareketli view'da
                // her frame offscreen pass ile yeniden rasterize edilir → cihaz ısınır. Breath aktifken
                // gölgeyi kapat: 0.1 opaklıktaki siyah gölge parlayan orb altında zaten görünmez.
                ...(isActive && breathMode !== 'off'
                  ? { shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 }
                  : null),
              }]}
            >
              <Touchable
                activeOpacity={1}
                onPressIn={() => {
                  pressStartRef.current = Date.now();
                  if (isActive && !reduceMotion) {
                    // Nefesi topla: aurora yavaşça (~1.8 sn) içe toplanıp parlar
                    holdBloom.value = withTiming(1, { duration: 1800, easing: ReEasing.out(ReEasing.ease) });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Toplanma dolunca yumuşak "hazır" haptik (arc: dokun → topla → hazır → bırak)
                    if (chargeHapticRef.current) clearTimeout(chargeHapticRef.current);
                    chargeHapticRef.current = setTimeout(() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }, 1800);
                  }
                }}
                onPressOut={() => {
                  if (chargeHapticRef.current) { clearTimeout(chargeHapticRef.current); chargeHapticRef.current = null; }
                  if (isActive && !reduceMotion) {
                    // Nefes ver: toplanan ışık geri çekilir + daireden dışa tek dalga yayılır
                    holdBloom.value = withTiming(0, { duration: 1400, easing: ReEasing.inOut(ReEasing.ease) });
                    releaseRipple.value = 0;
                    releaseRipple.value = withTiming(1, { duration: 1100, easing: ReEasing.out(ReEasing.ease) });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } else {
                    holdBloom.value = 0;
                  }
                }}
                onPress={() => {
                  if (!isActive) return;
                  // Uzun basış = topraklanma jesti → zen'i toggle ETME (sadece bloom yaşandı).
                  if (Date.now() - pressStartRef.current > 260) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  userToggledZenRef.current = true; // elle dokunuldu → otomatik-zen zorlamasın
                  setZenMode(!zenMode);
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
                    /*
                      YUMUŞAK AÇILIŞ — `from` yoktu, yani aurora opacity 1'de başlıyordu
                      ve GPU pipeline'ı hazır olunca BİRDEN beliriyordu. Kullanıcı bunu
                      "500-600ms gecikme" olarak bildirdi; teknik olarak doğru ama asıl
                      rahatsız eden gecikmenin kendisi değil, ANİ olması: hazır olmayan
                      bir şeyi hazırmış gibi göstermek onu takılma gibi gösteriyordu.

                      Derleme maliyeti tek derlemeye indirildi (bkz. NEBULA_EFFECT) ama
                      ilk çizimdeki GPU pipeline maliyeti doğaldır ve kaldırılamaz.
                      Doğru çözüm onu SAKLAMAK değil, tasarlamak: aurora artık sönükten
                      açılıyor, yani gecikme bir kusur değil bir doğuş gibi okunuyor.
                    */
                    from={{ opacity: 0 }}
                    animate={{ opacity: (zenMode && isActive) ? 0 : 1 }}
                    transition={{ type: 'timing', duration: (zenMode && isActive) ? 400 : 700 }}
                    // iOS ısı: yuvarlak kırpma zaten dıştaki Touchable'da (borderRadius+overflow) yapılıyor.
                    // Buradaki ikinci maske hareketli aurora'ya her karede offscreen mask pass ekliyordu → kaldırıldı.
                    style={StyleSheet.absoluteFill}
                  >
                    {/* Nebula — tek GPU shader'ı (taban + sürüklenen renk merkezleri). zen/ritual'da duraklar. */}
                    <Nebula
                      size={timerSize}
                      c1={theme.primary}
                      c2={theme.tertiary}
                      c3={theme.secondary}
                      paused={!auroraVisible || reduceMotion}
                      holdSV={holdBloom}
                    />
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
                    {/* Tatlı zaman — dakika · atan iki nokta · saniye. Saniyeye bağlı tek render burada izole. */}
                    <CountdownText
                      timerSize={timerSize}
                      colonColor={(pomodoroMode && pomodoroPhase === 'break') ? theme.tertiary : theme.primary}
                      reduceMotion={reduceMotion}
                    />

                    {/* Odak bağlamı — yalnız görev varsa niyetini göster; yoksa temiz bırak */}
                    {currentTask ? (
                      <MotiView
                        from={{ opacity: 0, translateY: 4 }}
                        animate={{ opacity: 0.82, translateY: 0 }}
                        transition={{ type: 'timing', duration: 450 }}
                        style={{ maxWidth: timerSize * 0.72, marginTop: S.md }}
                      >
                        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' }}>
                          {currentTask}
                        </Text>
                      </MotiView>
                    ) : null}

                    {/* Breath cue — fades between phases in sync with glow animation */}
                    <View style={{ height: 28, marginTop: S.sm, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
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
                        <Sparkles size={ICON.lg} color={theme.onSurface} style={{ opacity: 0.2 }} />
                      </View>
                    )}
                    <Text style={{ fontFamily: 'Jakarta-SemiBold', fontSize: 10, color: '#8E8E93', opacity: 0.25, marginTop: S.slg, letterSpacing: 1 }}>
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
                      <RotateCcw size={ICON.lg} color={theme.onSurfaceVariant} />
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
                borderRadius: R.full,
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
                ? <Pause size={ICON.xl} color={theme.onSurface} fill={theme.onSurface} style={{ opacity: 0.8 }} />
                : <Play size={ICON.xl} color={theme.onPrimary} fill={theme.onPrimary} style={{ marginLeft: S.xs }} />}
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
                          // Demo: sese dokununca bir süre çalsın (7 sn) sonra sakince kapansın (~1.4 sn fade).
                          // Seçim kalıcı olduğu için seans başlayınca yine bu ses çalar.
                          playAmbientSound(next, true);
                          previewTimerRef.current = setTimeout(() => {
                            if (!useFocusStore.getState().isActive) stopAmbientSoundFaded(70);
                            previewTimerRef.current = null;
                          }, 7000);
                        } else {
                          stopAmbientSoundFaded(70);
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
                  animate={{ opacity: 1, height: 24, marginTop: S.smd }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ type: 'timing', duration: 300 }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm }}
                >
                  {[0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
                    <Touchable
                      key={v}
                      hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                      onPress={() => { updateAmbientVolume(v); Haptics.selectionAsync(); }}
                      style={{ width: 34, height: 24, justifyContent: 'center', alignItems: 'center' }}
                      accessibilityLabel={`Ses seviyesi ${v * 100}`}
                    >
                      <View style={{ width: '100%', height: 4, borderRadius: R.xs, backgroundColor: ambientVolume >= v ? theme.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)') }} />
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
                  <Text style={{ fontSize: F.caption, color: theme.tertiary, fontWeight: '700', letterSpacing: 0.2 }}>
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
                    <CheckCircle2 size={ICON.sm} color={theme.tertiary} />
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
                    <Text style={{ fontStyle: 'italic', textAlign: 'center', color: theme.onSurfaceMuted, fontSize: F.body }}>{quote}</Text>
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
              style={{ width: 88, height: 88, borderRadius: R.full, backgroundColor: theme.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
            >
              <CheckCircle2 size={ICON.xxl} color={theme.primary} strokeWidth={2} />
            </MotiView>
            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 380, delay: 320 }}
              style={{ alignItems: 'center', gap: S.sm }}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: F.title, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.5 }}>
                {language === 'tr' ? 'Tamamlandı' : 'Complete'}
              </Text>
              <Text style={{ fontSize: F.body, color: theme.onSurfaceMuted, fontWeight: '600' }}>
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
            <Text style={[styles.transitionSub, { color: theme.onSurfaceMuted }]}>
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
            <View {...customPan.panHandlers} style={{ paddingTop: S.md, paddingBottom: S.lmd, alignItems: 'center' }}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>{t.focusCustomDuration}</Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceMuted }]}>{language === 'tr' ? '1 – 180 dakika' : '1 – 180 minutes'}</Text>

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
                    <Text style={{ fontSize: 36, fontWeight: '700', letterSpacing: -1, color: theme.onSurface }}>
                      {m}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <Text style={[styles.minLabel, { color: theme.onSurfaceMuted, marginTop: S.xs }]}>
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
            <View {...breathPan.panHandlers} style={{ paddingTop: S.md, paddingBottom: S.lmd, alignItems: 'center' }}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface, paddingHorizontal: S.lg }]}>
              {language === 'tr' ? 'Nefes Egzersizi' : 'Breathing Exercise'}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceMuted, paddingHorizontal: S.lg, marginBottom: S.md }]}>
              {language === 'tr' ? 'Odağınızı artırmak ve zihninizi sakinleştirmek için bir ritim seçin' : 'Select a rhythm to boost focus and calm your mind'}
            </Text>

            <View style={{ width: '100%', paddingHorizontal: S.lg, gap: S.smd }}>
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
                      borderRadius: R.lg,
                      padding: S.md,
                      borderWidth: B.medium,
                      borderColor: isActive ? theme.primary : 'transparent',
                    }}
                  >
                    <View style={{ flex: 1, gap: S.xs }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: isActive ? theme.primary : theme.onSurface }}>
                        {title}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.onSurfaceVariant }}>
                        {desc}
                      </Text>
                    </View>
                    {isActive && (
                      <CheckCircle2 size={ICON.md} color={theme.primary} />
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
                borderRadius: R.full, 
                backgroundColor: summaryCompleted ? theme.primaryContainer : theme.secondaryContainer, 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              {summaryCompleted
                ? <CheckCircle2 size={ICON.xl} color={theme.primary} strokeWidth={2.2} />
                : <Sparkles size={ICON.xl} color={theme.secondary} strokeWidth={2.2} />}
            </MotiView>

            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: F.title, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.5, textAlign: 'center' }}>
              {summaryCompleted ? t.summaryGreatWork : t.summaryGoodStart}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.xs }}>
              <Text style={{ fontSize: 52, fontWeight: '700', color: theme.primary, letterSpacing: -2, lineHeight: 56 }}>
                {summaryMinutes}
              </Text>
              <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurfaceVariant, marginBottom: S.xs }}>
                {t.summaryMinFocused}
              </Text>
            </View>



            <View style={{ width: '100%', backgroundColor: (summaryCompleted ? theme.primaryContainer : theme.secondaryContainer) + '60', borderRadius: R.md, padding: S.md, gap: S.xs }}>
              <Text style={{ fontSize: F.body, fontWeight: '700', color: summaryCompleted ? theme.primary : theme.secondary, lineHeight: 20 }}>
                {summaryCompleted ? t.summaryCoachCompleted : t.summaryCoachGoodStart}
              </Text>
              {summaryCompleted && (
                <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceMuted }}>
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
                          hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setUserRating(num);
                            track('ux_rating_submitted', { score: num, type: 'CES_focus' });
                            setRatingSubmitted(true);
                          }}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: R.full,
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

            <Separator theme={theme} spacing={S.xs} />
            {/* Break button (only after standard completed session) */}
            {summaryCompleted && !pomodoroMode && (
              <Touchable
                onPress={() => startBreak(activePreset.shortBreak)}
                style={{ width: '100%', paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.tertiary + '50', backgroundColor: theme.tertiary + '12', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.sm }}
              >
                <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.tertiary }}>
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
              <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onPrimary, letterSpacing: 0.5 }}>
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
              <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurfaceMuted }}>
                {t.summaryNewSession}
              </Text>
            </Touchable>
          </MotiView>
        </View>
      </Modal>

      {/* ── Pomodoro Info Modal ── */}
      <Modal visible={pomodoroInfoVisible} transparent animationType="fade" onRequestClose={() => setPomodoroInfoVisible(false)}>
        <Touchable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: S.slg }} activeOpacity={1} onPress={() => setPomodoroInfoVisible(false)}>
          <MotiView
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18 }}
            style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: R.xl, padding: S.slg, width: '100%', gap: S.md }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd }}>
              <View style={{ width: 40, height: 40, borderRadius: R.md, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Timer size={ICON.md} color={theme.primary} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.5, flex: 1 }}>
                {language === 'tr' ? 'Pomodoro Tekniği' : 'Pomodoro Technique'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '500', color: theme.onSurfaceVariant, lineHeight: 22 }}>
              {language === 'tr'
                ? `"${language === 'tr' ? activePreset.labelTr : activePreset.labelEn}" modunda ${activePreset.workMins} dk çalışıp ${activePreset.shortBreak} dk dinleniyorsun. 4. turda ${activePreset.longBreak} dk uzun mola.`
                : `In "${activePreset.labelEn}" mode you work for ${activePreset.workMins} min and rest ${activePreset.shortBreak} min. After round 4, a ${activePreset.longBreak}-min long break.`}
            </Text>
            <View style={{ gap: S.sm }}>
              {PRESETS.map((preset) => {
                const isActive = preset.key === selectedPreset;
                return (
                  <Touchable
                    key={preset.key}
                    onPress={() => { setSelectedPreset(preset.key); setDuration(preset.workMins); if (pomodoroMode) {}; }}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isActive ? theme.primary + '18' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'), borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.smd, borderWidth: B.thin, borderColor: isActive ? theme.primary + '40' : 'transparent' }}
                  >
                    <View style={{ gap: S.xxs }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? theme.primary : theme.onSurface }}>
                        {language === 'tr' ? preset.labelTr : preset.labelEn}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.onSurfaceMuted }}>
                        {language === 'tr' ? preset.descTr : preset.descEn}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: S.xxs }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? theme.primary : theme.onSurfaceVariant }}>
                        {language === 'tr' ? `${preset.workMins}dk çalış` : `${preset.workMins}m work`}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.onSurfaceMuted }}>
                        {language === 'tr' ? `${preset.shortBreak}/${preset.longBreak}dk mola` : `${preset.shortBreak}/${preset.longBreak}m break`}
                      </Text>
                    </View>
                  </Touchable>
                );
              })}
            </View>
            <Touchable
              onPress={() => setPomodoroInfoVisible(false)}
              style={{ backgroundColor: theme.primary, borderRadius: R.lg, paddingVertical: S.md, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.onPrimary }}>
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  badgeText: { fontWeight: '700', letterSpacing: 1 },
  pomodoroToggle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, borderWidth: B.thin },
  pomodoroToggleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  pomodoroRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.xl, justifyContent: 'center' },
  phaseBadge: { paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full },
  phaseLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  content: { flex: 1, alignItems: 'center', width: '100%' },
  durationRow: { flexDirection: 'row' },
  durationChip: { borderRadius: R.full },
  durationText: { fontWeight: '700' },
  timerContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  timerCircle: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
  timerText: { fontWeight: '200', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  timerGlow: { textShadowColor: 'rgba(150,180,255,0.45)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
  currentTaskText: { fontWeight: '600', marginTop: S.sm, textAlign: 'center' },
  breathGlow: { position: 'absolute', zIndex: -1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full },
  statusDot: { width: 6, height: 6, borderRadius: R.full },
  statusText: { fontWeight: '700', letterSpacing: 1.5 },
  taskPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, marginTop: S.md, maxWidth: 260, gap: S.sm },
  taskPickerLabel: { fontSize: F.caption, fontWeight: '600', flex: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center' },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center' },
  playBtn: { overflow: 'hidden', elevation: 8, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  btnGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  ambientRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.md, paddingHorizontal: S.lg },
  ambientBtn: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin },
  ambientLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.1 },
  finishBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin },
  finishText: { fontWeight: '700', letterSpacing: 0.3 },
  footer: { alignItems: 'center' },
  quote: { fontStyle: 'italic', textAlign: 'center', opacity: 0.5 },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  customSheet: { borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: S.lg, alignItems: 'center', gap: S.sm },
  sheetHandle: { width: 36, height: 4, borderRadius: R.sm, marginBottom: S.sm },
  sheetTitle: { fontSize: F.title, fontWeight: '700', letterSpacing: -0.5 },
  sheetSub: { fontSize: F.body, fontWeight: '600', marginBottom: S.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: B.thin, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.xs, marginBottom: S.sm },
  customInput: { fontWeight: '700', letterSpacing: -2, textAlign: 'center' },
  minLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: S.sm },
  applyBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
  applyBtnText: { color: 'white', fontWeight: '700', fontSize: F.subhead, letterSpacing: 0.5 },
  taskPickerItem: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingHorizontal: S.lg, paddingVertical: S.md, borderBottomWidth: StyleSheet.hairlineWidth },
  taskPickerItemTitle: { fontSize: F.body, fontWeight: '600', lineHeight: 20 },
  transitionOverlay: { alignItems: 'center', justifyContent: 'center', gap: S.md },
  transitionTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  transitionSub: { fontSize: F.subhead, fontWeight: '600', textAlign: 'center' },
});
