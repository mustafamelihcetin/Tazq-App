import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, Modal, AppState, Animated, ScrollView, BackHandler, InteractionManager, AccessibilityInfo } from 'react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import Svg, { Circle, G, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Play, Pause, RotateCcw, X, Sparkles, CheckCircle2, Coffee, Wind, CloudRain, Flame, Waves, Music2, Headphones, AudioLines, SlidersHorizontal, SkipForward } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusStore, focusDayKey } from '@/features/focus';
import { useShallow } from 'zustand/react/shallow';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { preloadCompletionChime, playCompletionChime, releaseCompletionChime } from '@/features/focus/completionChime';
import { FocusService } from '@/shared/services/api';
import { useAchievementStore, checkFocusAchievement } from '@/features/user';
import { usePrefsStore } from '@/features/modes';
import { track } from '@/shared/utils/analytics';
import { StatusBar } from 'expo-status-bar';
import { useToastStore } from '@/shared/store/useToastStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useLowPowerGraphics } from '@/shared/hooks/useLowPowerGraphics';
import { Colors } from '@/shared/constants/Colors';
import { getRandomQuote } from '@/shared/constants/Quotes';
import { ICON, S, R, F, B, SPRING_SOFT } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { HelpTourModal } from '@/features/onboarding/components/HelpTourModal';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  commitFocusSession, setFocusScreenVisible, finalizeDueSession,
} from '@/features/focus/session';
import { SessionSummary } from '@/features/focus/components/SessionSummary';
import { FocusTaskPicker } from '@/features/focus/components/FocusTaskPicker';
import { FocusModesSheet, PomodoroInfoSheet } from '@/features/focus/components/FocusModeSheets';
import { sceneOf, sceneLights, sceneAccent, sceneTheme } from '@/features/focus/utils/focusScenes';
import { FocusLights } from '@/features/focus/components/FocusLights';
import { getNotificationPermissionStatus } from '@/shared/utils/notifications';
import { useTaskStore, getLocalizedTaskTitle } from '@/features/tasks';
import { completeTask } from '@/features/tasks/utils/taskActions';
import { isWeightEntryTask } from '@/features/modes/utils/weightCheckin';
import { useTourGate } from '@/features/onboarding/utils/firstRun';
import { TourTarget } from '@/shared/components/TourContext';
import ReAnimated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, cancelAnimation, Easing as ReEasing } from 'react-native-reanimated';
import { swallow } from '@/shared/utils/swallow';
import type { AppTheme } from '@/shared/constants/Colors';
import { haptic } from '@/shared/utils/haptics';

import { Starfield, Nebula } from '@/features/focus/components/FocusBackdrop';
import { RollingDigits } from '@/shared/components/RollingDigits';
import { FocusWeekStrip } from '@/features/focus/components/FocusWeekStrip';
import { recentFocus } from '@/features/focus/focusStreak';
import { useFocusHistoryStore } from '@/features/report/useFocusHistoryStore';
import { goHome } from '@/shared/utils/authNavigation';
import { useFocusSheetTheme } from '@/features/focus/hooks/useFocusSheetTheme';


// ── Saniyeye bağlı izole render'lar ───────────────────────────────────────────
// Kasma/ısı düzeltmesi: eskiden parent tüm store'a abone olduğu için `seconds` her saniye
// değişince 2000+ satırlık ağaç yeniden render oluyordu. Saniyeye bağlı iki parçayı buraya
// izole ettik → artık yalnız bu minik bileşenler saniyede bir render olur, ana ekran olmaz.

// Sayaç metni (dk : atan iki nokta : sn). Yalnız seconds/isActive'e abone.
const CountdownText = React.memo(({ timerSize, colonColor, reduceMotion, a11yLabel }: { timerSize: number; colonColor: string; reduceMotion?: boolean; a11yLabel: (m: number) => string }) => {
  const seconds = useFocusStore(s => s.seconds);
  const isActive = useFocusStore(s => s.isActive);
  const big = Math.round(timerSize * 0.205);
  const mid = Math.round(timerSize * 0.185);
  // İki nokta: Sakin mod'da sabit; normalde sert blink (0.2↔1) yerine nazik kımıltı (0.55↔0.85) —
  // saniyeliği yaşam belirtisi kalsın ama göz köşesinde rahatsız etmesin.
  const colonOpacity = reduceMotion ? 0.7 : ((isActive && seconds % 2 === 1) ? 0.55 : 0.85);
  /*
    Ekran okuyucu kalan süreyi DAKİKA olarak okur. Etiket bilerek burada: ana ekranda
    olsaydı her dakika 2000+ satırlık ağaç yeniden render olurdu (bkz. yukarıdaki not).
  */
  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={a11yLabel(Math.ceil(seconds / 60))} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* Rakamlar KAYAR (react-bits Counter → RollingDigits); Sakin mod'da kaymaz. */}
      <RollingDigits value={Math.floor(seconds / 60).toString().padStart(2, '0')} fontSize={big} textStyle={[styles.timerText, styles.timerGlow, { color: '#FFFFFF' }]} reduceMotion={reduceMotion} />
      {/* ':' rakamlarla DİKEY ORTALI — satır 'center', böylece küçük iki nokta tabana düşmez.
          Küçük hizalama payı: optik olarak tam ortaya oturması için minik yukarı nudge. */}
      <Text style={[styles.timerText, { color: colonColor, fontSize: mid, marginHorizontal: S.xxs, opacity: colonOpacity, includeFontPadding: false, textAlignVertical: 'center' }]}>:</Text>
      <RollingDigits value={(seconds % 60).toString().padStart(2, '0')} fontSize={big} textStyle={[styles.timerText, styles.timerGlow, { color: '#FFFFFF' }]} reduceMotion={reduceMotion} />
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


// Named focus presets — each encodes work + break durations
/**
 * Bu ekranın metinleri — iki dil YAN YANA.
 * Satır içi `tr ? '...' : '...'` dallanması iki dalı elle senkron tutmayı gerektiriyor
 * ve pratikte ayrışıyor (bkz. i18nRatchet).
 */
const FOCUS_COPY = {
  tr: {
    pickTask: 'Konu',
    paused: 'DURAKLATILDI',
    skipBreak: 'Molayı atla',
    endConfirm: 'Emin misin?',
    todayProgress: (m: number, g: number) => `Bugün ${m} / ${g} dk`,
    todayDone: 'Bugünkü hedefin tamam ✦',
    keepAwake: 'Ekran Açık Kalsın',
    keepAwakeDesc: 'Seans boyunca ekran kararmaz',
    strictDesc: '10 sn+ ayrılırsan seans biter',
    remaining: (m: number) => `Kalan süre ${m} dakika`,
    notifOff: 'Bildirimler kapalı — süre bitince haber veremeyiz.',
    presetLabel: (name: string, m: number) => `${name}, ${m} dakika`,
    streak: (n: number) => `${n} gün seri`,
    weekA11y: (mins: number[], streak: number) => `Son 7 gün odak dakikaları: ${mins.join(', ')}. Seri ${streak} gün.`,
    custom: 'Özel',
    customLabel: 'Özel süre',
  },
  en: {
    pickTask: 'Topic',
    paused: 'PAUSED',
    skipBreak: 'Skip break',
    endConfirm: 'Are you sure?',
    todayProgress: (m: number, g: number) => `Today ${m} / ${g} min`,
    todayDone: 'Today’s goal reached ✦',
    keepAwake: 'Keep Screen On',
    keepAwakeDesc: 'The screen stays awake during a session',
    strictDesc: 'Leaving for 10s+ ends the session',
    remaining: (m: number) => `${m} minutes remaining`,
    notifOff: 'Notifications are off — we cannot tell you when time is up.',
    presetLabel: (name: string, m: number) => `${name}, ${m} minutes`,
    streak: (n: number) => `${n}-day streak`,
    weekA11y: (mins: number[], streak: number) => `Focus minutes, last 7 days: ${mins.join(', ')}. Streak ${streak} days.`,
    custom: 'Custom',
    customLabel: 'Custom duration',
  },
};

// expo-keep-awake etiketi: yalnız bu ekranın isteği, başka yerin isteğini kapatmaz.
const KEEP_AWAKE_TAG = 'tazq-focus';

const PRESETS = [
  { key: 'sprint',   labelTr: 'Sprint',   labelEn: 'Sprint',   workMins: 15, shortBreak: 3,  longBreak: 8,  descTr: '15dk hızlı odak',    descEn: '15m quick focus' },
  { key: 'classic',  labelTr: 'Klasik',   labelEn: 'Classic',  workMins: 25, shortBreak: 5,  longBreak: 15, descTr: '25dk standart odak', descEn: '25m standard focus' },
  { key: 'extended', labelTr: 'Uzatılmış',labelEn: 'Extended', workMins: 50, shortBreak: 10, longBreak: 20, descTr: '50dk derin odak',     descEn: '50m deep focus' },
  { key: 'ultra',    labelTr: 'Ultra',    labelEn: 'Ultra',    workMins: 90, shortBreak: 20, longBreak: 30, descTr: '90dk akış durumu',   descEn: '90m flow state' },
] as const;
type PresetKey = typeof PRESETS[number]['key'];

type AmbientSound = 'off' | 'rain' | 'cafe' | 'forest' | 'ocean' | 'fireplace' | 'relaxing' | 'binaural' | 'brown';

const SOUND_LABELS: Record<AmbientSound, { icon: React.ComponentType<any> | null; labelTr: string; labelEn: string }> = {
  off:       { icon: null,       labelTr: 'Sessiz',       labelEn: 'Off'       },
  rain:      { icon: CloudRain,  labelTr: 'Yağmur',       labelEn: 'Rain'      },
  cafe:      { icon: Coffee,     labelTr: 'Kafe',          labelEn: 'Café'      },
  forest:    { icon: Wind,       labelTr: 'Orman',         labelEn: 'Forest'    },
  ocean:     { icon: Waves,      labelTr: 'Okyanus',       labelEn: 'Ocean'     },
  fireplace: { icon: Flame,      labelTr: 'Şömine',       labelEn: 'Fireplace' },
  relaxing:  { icon: Music2,     labelTr: 'Rahatlatıcı',  labelEn: 'Relaxing'  },
  binaural:  { icon: Headphones, labelTr: 'Frekans',      labelEn: 'Binaural'  },
  brown:     { icon: AudioLines, labelTr: 'Derin Gürültü', labelEn: 'Brown Noise' },
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
    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, fontWeight: '600' }}>
      {language === 'tr' ? `Tur ${pomodoroRound}/4` : `Round ${pomodoroRound}/4`}
    </Text>
  </View>
));

export default function FocusScreen() {
  /*
    Odak turunda HİÇ kapı yoktu: ekran arka plandayken bile açılabiliyordu. Ortak kapı +
    ÇALIŞAN seansta bekleme: "hızlı odak" ile doğrudan seansa girilince anlatım sayacın
    üstüne binmesin; tur bir sonraki boşta ziyarette açılır.
  */
  const tourOn = useTourGate('focus', useFocusStore(s => s.isActive));
  // Derin odak ekranı sistem temasından bağımsızdır: her iki modda da sakin, koyu meditatif kimlik.
  /*
    ALT SAYFALARIN TEMASI AYRI: ekranın kendisi her zaman koyu (meditatif kimlik), ama
    alt sayfaların zemini `GlassSurface` ve o uygulamanın temasını izliyor. Açık temada
    zemin açık, yazı ise koyu paletten (açık renk) geliyordu: açık üstüne açık, okunmaz.
  */
  // Odak ekranından açılan pencereler seçili sahnenin vurgusunu taşır (bkz. useFocusSheetTheme).
  const { theme: sheetTheme, isDark: sheetDark } = useFocusSheetTheme();
  // Sahnenin vurgusu ekranın ana rengi (bkz. focusScenes.sceneTheme); Aurora → eski palet.
  const focusSceneId = usePrefsStore(s => s.focusScene);
  const theme = React.useMemo(() => sceneTheme(sceneOf(focusSceneId), Colors.dark), [focusSceneId]);
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
    rehydrateTimer, startBreak,
    pomodoroMode, pomodoroRound, pomodoroPhase,
    togglePomodoroMode, nextPomodoroPhase,
    strictMode, setStrictMode,
  } = useFocusStore(useShallow(s => ({
    isActive: s.isActive, totalSeconds: s.totalSeconds, currentTask: s.currentTask,
    setIsActive: s.setIsActive, reset: s.reset, setDuration: s.setDuration,
    rehydrateTimer: s.rehydrateTimer, startBreak: s.startBreak,
    pomodoroMode: s.pomodoroMode, pomodoroRound: s.pomodoroRound, pomodoroPhase: s.pomodoroPhase,
    togglePomodoroMode: s.togglePomodoroMode, nextPomodoroPhase: s.nextPomodoroPhase,
    strictMode: s.strictMode, setStrictMode: s.setStrictMode,
  })));

  // Bugünün odak dakikası: gün değiştiyse sayaç bu ekranda da 0 görünmeli (store gün
  // anahtarını tutuyor; tazeleme uygulama açılışında oluyor).
  const dailyFocusToday = useFocusStore(s => (s.dailyFocusDate === focusDayKey() ? s.dailyFocusMinutes : 0));
  const dailyGoalMinutes = useFocusStore(s => s.dailyGoalMinutes);
  const sessionKind = useFocusStore(s => s.sessionKind);
  // Mola: standart molada da, pomodoro molasında da aynı kurallar geçerli.
  const inBreak = sessionKind === 'break' || (pomodoroMode && pomodoroPhase === 'break');

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
  const L = FOCUS_COPY[language === 'en' ? 'en' : 'tr'];
  const isPaused = sessionStarted && !isActive && !atZero;
  const dayProgress = dailyGoalMinutes > 0 ? Math.min(1, dailyFocusToday / dailyGoalMinutes) : 0;
  // Son 7 günün odak dakikaları + seri — Haftalık Geri Bakış'la aynı gün kuralı (focusStreak).
  const focusSessions = useFocusHistoryStore(st => st.sessions);
  const recent = useMemo(() => recentFocus(focusSessions, dailyFocusToday), [focusSessions, dailyFocusToday]);
  /*
    Bitiş alarmı bildirim iznine bağlı. İzin kapalıysa kullanıcı "süre bitince haber
    verir" sanıp telefonu bırakıyor ve seansın bittiğini çok sonra öğreniyor.
    Durum yalnız OKUNUR — sistem diyaloğu burada AÇILMAZ (bkz. notifications).
  */
  const [notifBlocked, setNotifBlocked] = useState(false);
  useEffect(() => {
    let alive = true;
    getNotificationPermissionStatus().then((st) => { if (alive) setNotifBlocked(st !== 'granted'); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // Bitirme onayı: ilk dokunuş sorar, ikincisi bitirir (4 sn sonra geri döner).
  const [confirmEnd, setConfirmEnd] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { trigger: triggerAchievement } = useAchievementStore();
  // Derin odak tercihleri artık prefs store'da (cihazda kalıcı) — her seansda sıfırlanmaz.
  const { focusAmbientSound, setFocusAmbientSound, focusPreset, setFocusPreset, focusKeepAwake, setFocusKeepAwake, focusAutoZen, setFocusAutoZen, focusScene, setFocusScene, uiMode } = usePrefsStore();
  // Sahne: hareket + palet + vurgu birlikte (bkz. focusScenes.ts).
  const scene = sceneOf(focusScene);
  const [sc1, sc2, sc3] = sceneLights(scene, theme);
  const workAccent = sceneAccent(scene, theme.primary);
  /*
    SADE MOD BAŞARIM KUTLAMASINI SUSTURUR — kural görev tamamlamada zaten var
    (bkz. app/tasks.tsx `handleToggle`, `!isLite` kapısı), ama odak seansı bitince
    tetiklenen başarımlar bu ekranda hiç kontrol edilmiyordu. `CelebrationOverlay`
    global (bkz. app/_layout.tsx) ve kendi kapısı yok, yani Sade moddaki kullanıcı
    odak seansını bitirince yine tam ekran konfeti/kart görüyordu.
  */
  const isLiteMode = uiMode === 'lite';

  // ── SES MOTORU HAZIRLIK ────────────────────────────────────────────────────
  // `setAudioModeAsync` asenkron; tamamlanmadan `play()` çağrılırsa iOS'ta ses
  // bazen gelmez ve kullanıcı sesi kapatıp açmak zorunda kalır. Ref ile takip
  // ediyoruz: kurulum bitmeden yüklenen çalma isteği kurulum sonrasında yeniden
  // denenir.
  const audioModeReadyRef = useRef(false);
  const pendingPlayRef = useRef<{ type: AmbientSound; fadeIn: boolean } | null>(null);

  // Sound
  const soundRef = useRef<AudioPlayer | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playRequestIdRef = useRef(0);
  // Kalıcı tercihler store'dan; isimler aynı kaldığı için ekranın gerisi değişmiyor.
  const ambientSound = focusAmbientSound as AmbientSound;
  const setAmbientSound = setFocusAmbientSound as (v: AmbientSound) => void;

  // Nefes artık ayrı bir seans (app/nefes.tsx, madde 14): sayacın üstündeki ipucu kaldırıldı.
  const [modesSheetVisible, setModesSheetVisible] = useState(false);
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

  // Seansa görev bağlama (bkz. FocusTaskPicker)
  const [taskPickerVisible, setTaskPickerVisible] = useState(false);

  // Pomodoro transition overlay
  const [pomodoroTransition, setPomodoroTransition] = useState<{ visible: boolean; type: 'break' | 'work'; isLong?: boolean }>({ visible: false, type: 'break' });
  const [pomodoroInfoVisible, setPomodoroInfoVisible] = useState(false);

  // Session summary
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryMinutes, setSummaryMinutes] = useState(0);
  const [summaryCompleted, setSummaryCompleted] = useState(false);
  const [completionRitual, setCompletionRitual] = useState(false);
  /*
    SEANSA BAĞLI GÖREV — özet açılırken DONDURULUR.
    Bağ seans bitince store'dan silinir (reset); özet penceresi ise ondan sonra da
    açık kalıyor. Soruyu sorabilmek için görevin kimliği ve adı o an kopyalanır.
  */
  const [summaryTask, setSummaryTask] = useState<{ id: number; title: string } | null>(null);

  const [quote, setQuote] = useState('');

  useEffect(() => {
    const handleBackPress = () => {
      if (customVisible) { setCustomVisible(false); return true; }
      if (modesSheetVisible) { setModesSheetVisible(false); return true; }
      if (taskPickerVisible) { setTaskPickerVisible(false); return true; }
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
  }, [customVisible, modesSheetVisible, taskPickerVisible, pomodoroInfoVisible, summaryVisible, summaryCompleted, completionRitual]);

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
  // Zayıf Android'de aurora duraklar (tek kare) — bkz. useLowPowerGraphics. iOS'ta hep false.
  const lowPowerGraphics = useLowPowerGraphics();
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
    if (!focusAutoZen) return; // kullanıcı kapattıysa ekran olduğu gibi kalır
    const id = setTimeout(() => {
      if (useFocusStore.getState().isActive && !userToggledZenRef.current) setZenMode(true);
    }, 2500);
    return () => clearTimeout(id);
  }, [isActive, focusAutoZen]);
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
    releaseCompletionChime();
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
    /*
      AMBİYANS SESLERİ (2026-10-25 yeniden işlendi, kaynak betik: ölçüm + üretim). Ölçülen sorunlar:
       · Yükseklik −7 … −34 LUFS (27 dB fark): sesler arası geçişte biri bağırıyor biri fısıldıyordu
         → hepsi −26 LUFS, tepe ≤ −3 dBFS (orman +1.1 dBFS ile KIRPILIYORDU).
       · Döngü dikişleri: okyanus/orman baş-son fade'li (her turda ses 13 dB çöküyordu),
         "rahatlatıcı" 18 sn'de sert kesiliyor, binaural her 30 sn'de TIK → kenarlar kesildi,
         3 sn eşit güçlü çapraz geçiş + 3 ms mikro yumuşatma (AAC kenar tıkı); ölçümde dikiş temiz.
       · Yağmurun enerjisinin %47'si 60 Hz altı uğultuydu → yüksek geçiren süzgeç.
       · MP3 döngüde boşluk bırakır → AAC (.m4a).
      Frekans: 200/240 Hz (40 Hz gama) + pembe gürültü yatağı, 60 sn tam devir. Rahatlatıcı:
      üretilmiş 120 sn evrilen Re majör katman. Derin Gürültü: üretilmiş stereo kahverengi gürültü.
    */
    const sources: Record<string, any> = {
      rain:      require('../assets/sounds/rain.m4a'),
      cafe:      require('../assets/sounds/cafe.m4a'),
      forest:    require('../assets/sounds/forest.m4a'),
      ocean:     require('../assets/sounds/ocean.m4a'),
      fireplace: require('../assets/sounds/fireplace.m4a'),
      relaxing:  require('../assets/sounds/relaxing.m4a'),
      binaural:  require('../assets/sounds/binaural.m4a'),
      brown:     require('../assets/sounds/brown.m4a'),
    };
    return sources[type];
  };

  const playAmbientSound = async (type: AmbientSound, fadeIn = false) => {
    /*
      AudioMode henüz kurulmadıysa çalma isteğini sakla; kurulum tamamlanınca
      (yukarıdaki useEffect) bu istek yeniden denenir. Birden fazla gelirse
      sonuncusu kazanır — kullanıcının son seçimi.
    */
    if (!audioModeReadyRef.current) {
      pendingPlayRef.current = { type, fadeIn };
      return;
    }
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
      swallow('focus.ambientSound', e);
    }
  };

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'mixWithOthers',
    }).then(() => {
      audioModeReadyRef.current = true;
      /*
        Kurulum bitmeden gelen çalma isteği (ör. kalıcı tercih zaten 'rain' ise mount
        anında ses efekti tetiklenir ama AudioMode henüz ayarlı değildir) burada
        yeniden denenir.
      */
      if (pendingPlayRef.current) {
        const { type, fadeIn } = pendingPlayRef.current;
        pendingPlayRef.current = null;
        playAmbientSound(type, fadeIn);
      }
    }).catch(() => { audioModeReadyRef.current = true; }); // hata olsa da bloke etme
    return () => { stopAllSounds(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      goHome(router);
      return true; // prevent default (app close)
    });
    return () => sub.remove();
  }, [router]));


  /*
    ── EKRAN GÖRÜNÜRLÜĞÜ + EKRANI AÇIK TUTMA ────────────────────────────────
    Odak ekranı açıkken bitişi ekran kutluyor (ses + ritüel): bitiş bildirimi susar
    (bkz. session.isFocusScreenVisible).

    Ekran açık tutuluyor çünkü telefon kendiliğinden kararıp kilitleniyordu; üstelik
    katı modda bu otomatik kilit "odaktan ayrıldın" sayılıp seansı iptal ediyordu.
    Katı modda tercih ne olursa olsun açık tutulur — kuralın adil olmasının şartı bu.
  */
  useFocusEffect(useCallback(() => {
    setFocusScreenVisible(true);
    return () => setFocusScreenVisible(false);
  }, []));

  const keepScreenOn = isActive && (focusKeepAwake || strictMode);
  useEffect(() => {
    if (!keepScreenOn) return;
    let released = false;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((e) => swallow('focus.keepAwake', e));
    return () => {
      if (released) return;
      released = true;
      try { deactivateKeepAwake(KEEP_AWAKE_TAG); } catch (e) { swallow('focus.keepAwakeRelease', e); }
    };
  }, [keepScreenOn]);

  /*
    ── ARKA PLANDAN DÖNÜŞ ────────────────────────────────────────────────────
    Sayaç ve katı mod kararı artık `_layout` + `session.ts` işi: uygulama hangi
    ekranda olursa olsun aynı biçimde çalışsın diye. Ekran yalnız dolmuş bir seans
    varsa onu kaydın kapanmasına bırakır (kilit zaten ikinci kaydı engeller).
  */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') finalizeDueSession();
    });
    return () => sub.remove();
  }, []);

  // Çan seans sürerken hazırlanır ki bitişte yükleme gecikmesi olmasın (bkz. completionChime).
  useEffect(() => {
    if (isActive) preloadCompletionChime();
  }, [isActive]);

  // ── Session completion / Pomodoro transitions ─────────────────────────────
  useEffect(() => {
    if (atZero && totalSeconds > 0 && !completedRef.current) {
      completedRef.current = true;
      // Titreşim sesin GERÇEKTEN başladığı an gelir (bkz. completionChime): eskiden ses
      // 250 ms ertelenip üstüne yükleniyordu, titreşimden kopuk geliyordu.
      // Seans bitimi sesi — soundEffects toggle'ından bağımsız, her zaman çalar.
      playCompletionChime(() => haptic.alarm());

      const { pomodoroMode: isPomo, pomodoroPhase: phase, pomodoroRound: round, sessionKind: kind, finishedAt } = useFocusStore.getState();
      /*
        GEÇ AÇILIŞ: seans uygulama kapalıyken dolmuş olabilir. Saatler sonra açılan
        ekranda molayı kendiliğinden başlatmak, kullanıcının istemediği bir sayaç
        başlatmak olurdu — o durumda mola yalnız HAZIRLANIR.
      */
      const justFinished = !finishedAt || Date.now() - finishedAt < 60_000;

      if (kind === 'break') {
        /*
          MOLA BİTTİ — mola ODAK DEĞİLDİR, kaydedilmez.
          Eskiden mola da standart seans sayılıp dakikaları odak olarak yazılıyordu
          (özet ekranı "harika seans" diyordu); haftalık odak süresi şişiyordu.
        */
        setZenMode(false);
        /*
          POMODORO TUR SAYACI: mola artık ayrı bir tür olduğu için pomodoro molası da
          buraya düşüyor. Faz ilerletilmezse döngü "mola" evresinde ÇAKILI kalır ve
          sıradaki tur hiç başlamaz.
        */
        if (isPomo && phase === 'break') nextPomodoroPhase();
        setDuration(activePreset.workMins);
        setPomodoroTransition({ visible: true, type: 'work' });
        setTimeout(() => setPomodoroTransition(p => ({ ...p, visible: false })), 3000);
        stopAmbientSound();
      } else if (isPomo) {
        setTimeout(() => haptic.commit(), 250);
        setTimeout(() => haptic.commit(), 500);

        if (phase === 'work') {
          const minutes = Math.round(totalSeconds / 60);
          commitSession(minutes, true);
          track('focus_completed', { minutes, pomodoro: true });

          // Check focus achievements using lifetime total
          FocusService.getStats().then(s => {
            const total = Math.round((s.totalFocusHours || 0) * 60);
            const ach = checkFocusAchievement(total);
            if (ach && !isLiteMode) triggerAchievement(ach);
          }).catch(() => {});

          const isLongBreak = round >= 4;
          nextPomodoroPhase();
          const breakMins = isLongBreak ? activePreset.longBreak : activePreset.shortBreak;
          setZenMode(false); // Reset Zen Mode on break transition
          setTimeout(() => {
            // Mola bir seanstır: kendi kimliğiyle ve bitiş anıyla başlar (bkz. startBreak).
            if (justFinished) startBreak(breakMins);
            else setDuration(breakMins);
          }, 600);
          setPomodoroTransition({ visible: true, type: 'break', isLong: isLongBreak });
          setTimeout(() => setPomodoroTransition(p => ({ ...p, visible: false })), 3500);
        } else {
          // Pomodoro molası bitti → sıradaki çalışma turu (mola kaydedilmez)
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
        captureSummaryTask();
        setSummaryMinutes(minutes);
        setSummaryCompleted(true);
        setCompletionRitual(true);
        setTimeout(() => haptic.commit(), 300);
        setTimeout(() => haptic.commit(), 600);
        setTimeout(() => { setCompletionRitual(false); setSummaryVisible(true); }, 1800);

        /*
          KİLİT ŞİMDİ, SENKRON — kayıt yine ertelenir. Sıfırla/Kapat'a bu pencerede
          basılırsa `reset()` sessionId'yi null'lar ve `commitSession` aşağıda YENİ
          bir kimlikle kilidi ikinci kez alabiliyordu (aynı seans iki kez kaydediliyordu,
          bkz. commitFocusSession'daki not). Kilit burada, ağır iş hâlâ ertelenmiş.
        */
        const claimedNow = useFocusStore.getState().claimCommit();
        InteractionManager.runAfterInteractions(() => {
          stopAmbientSound();
          setAmbientSound('off');
          if (claimedNow) commitSession(minutes, true, true);
          track('focus_completed', { minutes, pomodoro: false });
          FocusService.getStats().then(s => {
            const total = Math.round((s.totalFocusHours || 0) * 60);
            const ach = checkFocusAchievement(total);
            if (ach && !isLiteMode) triggerAchievement(ach);
          }).catch(() => {
            const ach = checkFocusAchievement(minutes);
            if (ach && !isLiteMode) triggerAchievement(ach);
          });
        });
      }
    }
    if (isActive && !atZero) completedRef.current = false;
  }, [isActive, atZero]);

  // ── Actions ───────────────────────────────────────────────────────────────
  /**
   * SEANSI KAYDET — karar `features/focus/session.ts` içinde (ekrandan bağımsız).
   *
   * Kural ekrandan çıkarıldı çünkü seans ekran kapalıyken de bitiyor: telefon kilitli,
   * uygulama kapalı ya da kullanıcı başka sayfada. Ekranın payına yalnız kullanıcıya
   * ne söyleneceği kaldı.
   *
   * @returns Seans kaydedildiyse `true`.
   */
  const commitSession = (minutes: number, completed: boolean, alreadyClaimed = false): boolean => {
    const res = commitFocusSession(minutes, completed, alreadyClaimed);
    if (res === 'too-short') {
      useToastStore.getState().show(
        language === 'tr' ? '1 dakikadan kısa seanslar kaydedilmez.' : 'Sessions shorter than 1 minute are not logged.',
        'info',
      );
    }
    return res === 'saved';
  };

  /**
   * Seansa bağlı görevi özet için yakalar.
   *
   * Tartım görevleri DIŞARIDA: onlar kilo girilmeden tamamlanamıyor (bkz. weightCheckin);
   * "bitti mi?" diye sormak, evet denince sessizce başarısız olan bir söz vermek olurdu.
   */
  const captureSummaryTask = () => {
    const { currentTaskId } = useFocusStore.getState();
    if (currentTaskId == null) { setSummaryTask(null); return; }
    const task = useTaskStore.getState().tasks.find(x => x.id === currentTaskId);
    if (!task || task.isCompleted || task.isArchived || isWeightEntryTask(task)) { setSummaryTask(null); return; }
    setSummaryTask({ id: task.id, title: getLocalizedTaskTitle(task, language === 'tr') });
  };

  const toggleTimer = () => {
    haptic.commit();
    setIsActive(!isActive);
  };

  /** Mola erken bitsin: çalışma turuna dön (mola kaydedilmez). */
  const skipBreak = () => {
    // Titreşim YOK: sayaç gözle görülür biçimde çalışma turuna dönüyor.
    completedRef.current = false;
    setZenMode(false);
    stopAmbientSound();
    if (pomodoroMode && pomodoroPhase === 'break') nextPomodoroPhase();
    setDuration(activePreset.workMins);
  };

  useEffect(() => { if (!sessionStarted && confirmEnd) setConfirmEnd(false); }, [sessionStarted, confirmEnd]);

  const onEndPress = () => {
    if (!confirmEnd) {
      // Titreşim YOK: düğme "Emin misin?" yazısına dönüşüyor, görünen bir yanıt var.
      setConfirmEnd(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmEnd(false), 4000);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmEnd(false);
    finishEarly();
  };

  const resetTimer = () => {
    haptic.surface();
    const elapsed = getElapsed();
    if (elapsed > 0) {
      // Mola için commitSession zaten 'not-focus' döner: mola dakikası odak sayılmaz.
      commitSession(Math.round(elapsed / 60), false);
      stopAmbientSound();
      setAmbientSound('off');
    }
    completedRef.current = false;
    setZenMode(false);
    reset();
  };

  const finishEarly = () => {
    haptic.success();
    stopAmbientSound();
    // Mola erken bitirilirse: kaydedilecek bir şey yok, sıradaki tura hazırlan.
    if (useFocusStore.getState().sessionKind === 'break') {
      setIsActive(false);
      completedRef.current = true;
      setZenMode(false);
      setDuration(activePreset.workMins);
      return;
    }
    /*
      setAmbientSound('off') BURADAN KALDIRILDI.

      ── ÖLÇÜLEN SORUN ──────────────────────────────────────────────────────────
      "Erken Bitir" özetini kapatan kullanıcı "Mola Başlat"a basabilir. Mola bir
      seans olduğu için isActive→true ve ses efekti tetiklenir — ama tercih zaten
      'off' yapılmış, yani mola boyunca ses çalmıyor.
      Kullanıcının bildirdiği "sesi kapatıp açmak gerekiyor" sorununun tam kaynağı.

      Ses DOSYASI zaten durduruldu (stopAmbientSound). TERCIH ise kalıcıdır:
      kullanıcı yağmur seçtiyse molada da yağmur çalmalı. Tercih yalnızca
      kullanıcı düğmeye basınca veya özetten ana sayfaya gidince 'off' olmalı.
    */
    setIsActive(false);
    completedRef.current = true;
    setZenMode(false);
    const minutesDone = Math.round(getElapsed() / 60);
    if (commitSession(minutesDone, false)) {
      captureSummaryTask();
      setSummaryMinutes(minutesDone);
      setSummaryCompleted(false);
      setSummaryVisible(true);
      playCompletionChime(); // özetle aynı anda; gecikme modalla sesi ayırıyordu
    } else {
      // Kaydedilmeyen seans için özet göstermek yanıltıcı olur; sayaç sıfırlanır.
      reset();
    }
  };

  const applyCustomDuration = () => {
    if (wheelValue >= 1 && wheelValue <= 180) {
      haptic.select();
      setDuration(wheelValue);
      setCustomVisible(false);
    } else {
      haptic.error();
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };



  const startBreakSession = (mins: number) => {
    setSummaryVisible(false);
    completedRef.current = false;
    startBreak(mins);
  };

  // PomodoroIndicator has been extracted out and memoized


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <MotiView
      animate={{
        backgroundColor: (zenMode && isActive) ? '#000000' : scene.backdrop[1]
      }}
      transition={{ type: 'timing', duration: 400 }}
      style={{ flex: 1 }}
    >
      {/* Derin gece zemini — orb'la uyumlu, hafif dikey derinlik (her iki modda) */}
      {!(zenMode && isActive) && (
        <LinearGradient
          pointerEvents="none"
          colors={scene.backdrop}
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
              colors={scene.zen}
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
              animate={{ opacity: scene.zenOpacity, scale: 1 }}
              exit={{ opacity: 0, scale: zenFrom }}
              transition={SPRING_SOFT}
              style={StyleSheet.absoluteFill}
            >
              <Nebula
                size={0}
                width={width}
                height={height}
                c1={sc1}
                c2={sc2}
                c3={sc3}
                scene={scene.id}
                base={scene.base}
                paused={!(zenMode && isActive) || reduceMotion}
                lowFps={lowPowerGraphics}
                speedScale={0.45}
                holdSV={holdBloom}
              />
            </MotiView>
          </MotiView>
        )}
      </AnimatePresence>
      {/* Zen'de yıldızlar kısılır — aurora zemin, yörünge saati figür (figür-zemin ilkesi). */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: (zenMode && isActive) ? 0.4 : 1 }} pointerEvents="none">
        {/* Yıldız alanı YALNIZ Aurora'nın parçacık dili; diğer sahnelerin parçacıkları kendi shader'larında
            (Gelgit: kabarcık · Kor: kıvılcım · Sis: ateşböceği) — sahneler yalnız renkle ayrışmasın. */}
        <Starfield active={zenMode && isActive && scene.id === 'aurora'} timerSize={timerSize} colors={scene.stars} />
      </View>
      <View style={{ flex: 1, paddingBottom: insets.bottom || S.md }}>

        {/* Header — X solda, mod pill'i sağda; başlık MUTLAK ekran-merkezinde (position:absolute).
            Böylece "Derin Odak" X ve pill'in genişliğinden bağımsız her zaman tam ortada durur
            (eski flex düzeninde pill genişleyince badge merkezden kayıyordu = simetrisizlik). */}
        <MotiView
          pointerEvents={zenMode && isActive ? "none" : "auto"}
          animate={{ opacity: zenMode && isActive ? 0 : 1 }}
          transition={{ type: 'timing', duration: 400 }}
          style={[styles.header, { paddingTop: insets.top, paddingBottom: S.md }]}
        >
          <View style={{ flexShrink: 0 }}>
            <Touchable
              onPress={() => {
                stopAllSounds();
                setAmbientSound('off');
                const elapsed = getElapsed();
                if (elapsed > 0) {
                  setIsActive(false);
                  /*
                    `Math.max(1, ...)` YAZILIYDI: 5 saniyelik bir seans 1 dakika olarak
                    kaydediliyordu — "1 dakikadan kısa kaydedilmez" kuralının tam tersi.
                    Ayrıca puan verilmiyordu, yani aynı seans "durdur" ile puan
                    kazanıyor, "çık" ile kazanmıyordu. İkisi de ortak karara bağlandı.
                  */
                  commitSession(Math.round(elapsed / 60), false);
                  /*
                    ÇIKIŞ SEANSI BİTİRİR — sıfırlama eskiden YOKTU: seans duraklamış
                    halde kalıyor, kullanıcı geri dönüp devam edince aynı dakikalar
                    ikinci kez sayılıyordu (kısmi + tam).
                  */
                  reset();
                  completedRef.current = false;
                }
                /*
                  ÇIKIŞTA TEK ANİMASYON. Eskiden ekran önce kendini 400 ms soldurup
                  (Skia aurora dahil tüm ağaç — zayıf GPU'da pahalı), 350 ms sonra bir de
                  yığın geçişini oynatıyordu; ikincisi sırasında ana sayfa kuruluyordu.
                  Huawei Y6'da kare başına 65–85 ms, 500 ms'lik donmalar ölçüldü.
                */
                router.canGoBack() ? router.back() : goHome(router);
              }}
              style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              accessibilityRole="button"
              accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'}
            >
              <X size={ICON.md} color={theme.onSurface} />
            </Touchable>
          </View>

          {/* Başlık — MUTLAK ekran-merkezinde: X ve pill genişliğinden bağımsız, hep tam ortada. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top, bottom: S.md, alignItems: 'center', justifyContent: 'center' }}>
            <View style={[styles.badge, { backgroundColor: theme.primary + '15', maxWidth: '44%' }]}>
              <Sparkles size={ICON.xs} color={theme.primary} />
              <Text style={[styles.badgeText, { color: theme.primary, fontSize: F.caption, letterSpacing: 1 }]} numberOfLines={1}>
                {t.focusLabel || t.deepFocus}
              </Text>
            </View>
          </View>

          {/* Pomodoro & Breath Toggles - Unified Premium Pill */}
          <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
            <AnimatePresence>
              {!isActive && (
                <TourTarget id="modeSelect" spotRadius={R.lg} spotPad={S.xs}>
                <MotiView
                  key="pomo-controls"
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'timing', duration: 220 }}
                >
                  {/* Tek "modlar" butonu — soldaki X ile aynı boyut/biçim → header simetrik.
                      Modlar (Pomodoro/Katı/…) alt-sheet'te açılır; Nefes ayrı seansa götürür. Aktif mod varsa buton vurgulanır. */}
                  {(() => {
                    const anyModeOn = pomodoroMode || strictMode;
                    return (
                      <Touchable
                        accessibilityRole="button"
                        accessibilityLabel={language === 'tr' ? 'Odak modları' : 'Focus modes'}
                        accessibilityState={{ expanded: modesSheetVisible }}
                        onPress={() => { haptic.select(); setModesSheetVisible(true); }}
                        style={[styles.closeBtn, { backgroundColor: anyModeOn ? theme.primary + '20' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }]}
                      >
                        <SlidersHorizontal size={ICON.md} color={anyModeOn ? theme.primary : theme.onSurface} strokeWidth={2.4} />
                      </Touchable>
                    );
                  })()}
                </MotiView>
                </TourTarget>
              )}
            </AnimatePresence>

            {/* Seans sırasında aktif modlar yazı ile belirtilir (pill gizliyken) */}
            {isActive && (strictMode || pomodoroMode) && (
              <MotiView
                key="active-mode-tags"
                from={{ opacity: 0, translateY: -4 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 260 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap', justifyContent: 'flex-end' }}
              >
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
            {/*
              BUGÜN — günlük hedef uygulamada vardı ama bu ekranda hiç görünmüyordu.
              Düz bir satır yerine ince bir ölçek: ekranın dilinde (halka, aurora) bir
              ilerleme ifadesi, sayıyı okumadan da "ne kadar yol aldım" görünüyor.
            */}
            {!sessionStarted && !pomodoroMode && dailyGoalMinutes > 0 && (
              // Son 7 gün + seri (bkz. FocusWeekStrip). Eskiden yalnız bugünün çizgisi vardı.
              <View style={{ marginBottom: S.md }}>
                <FocusWeekStrip
                  days={recent.days}
                  goal={dailyGoalMinutes}
                  caption={(dayProgress >= 1 ? L.todayDone : L.todayProgress(dailyFocusToday, dailyGoalMinutes)) + (recent.streak >= 2 ? ` · ${L.streak(recent.streak)}` : '')}
                  a11yLabel={L.weekA11y(recent.days.map(d => d.minutes), recent.streak)}
                  todayColor={theme.primary}
                  doneColor={theme.tertiary}
                  reduceMotion={reduceMotion}
                />
              </View>
            )}
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
                    // Kap içeriği kadar daralırsa segment sıkışır — tam genişlik, okunur sınırla.
                    style={{ width: '100%', maxWidth: 360, alignSelf: 'center' }}
                  >
                    {/*
                      SEGMENTLİ SEÇİCİ — kaydırmalı haplar DEĞİL.
                      Haplar ortalayan bir kabın içinde genişliksiz bir ScrollView'daydı: satır
                      içeriği kadar genişleyip ortalanıyor, sol ucu ekran dışında kalıyordu
                      ("rint 15" — ve oraya kaydırılamıyordu). Beş seçenek telefonda sığmıyordu.
                      Bedtime/Headspace (can-it-be-done) süreyi tek, ekrana oturan bir kontrolle
                      seçtirir: eşit genişlik, yalnız dakika; ad ekran okuyucuda kalır.
                    */}
                    <TourTarget id="duration" style={{ marginBottom: S.md }} spotRadius={R.full} spotPad={S.xs}>
                    <View style={styles.segment}>
                      {PRESETS.map((preset) => {
                        const isSelected = totalSeconds === preset.workMins * 60;
                        return (
                          <Touchable
                            key={preset.key}
                            style={{ flex: 1 }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={L.presetLabel(language === 'tr' ? preset.labelTr : preset.labelEn, preset.workMins)}
                            onPress={() => { haptic.select(); setSelectedPreset(preset.key); setDuration(preset.workMins); }}
                          >
                            <MotiView
                              animate={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0)' }}
                              transition={{ type: 'timing', duration: 200 }}
                              style={styles.segmentItem}
                            >
                              <Text style={{ fontSize: F.body, fontWeight: isSelected ? '700' : '600', color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] }}>
                                {preset.workMins}
                              </Text>
                            </MotiView>
                          </Touchable>
                        );
                      })}
                      {(() => {
                        const isCustom = !PRESETS.some(p => p.workMins * 60 === totalSeconds) && totalSeconds > 0;
                        return (
                          <Touchable
                            style={{ flex: 1 }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isCustom }}
                            accessibilityLabel={L.customLabel}
                            onPress={() => { prepareCustom(); haptic.select(); setCustomVisible(true); }}
                          >
                            <MotiView
                              animate={{ backgroundColor: isCustom ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0)' }}
                              transition={{ type: 'timing', duration: 200 }}
                              style={styles.segmentItem}
                            >
                              <Text style={{ fontSize: F.footnote, fontWeight: isCustom ? '700' : '600', color: isCustom ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                                {isCustom ? Math.round(totalSeconds / 60) : L.custom}
                              </Text>
                            </MotiView>
                          </Touchable>
                        );
                      })()}
                    </View>
                    </TourTarget>
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

            {/* SVG ring */}
            {(() => {
              const r = (timerSize / 2) - 6;
              const circumference = 2 * Math.PI * r;
              const offsetAnim = progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [circumference, 0]
              });
              const strokeColor = pomodoroMode && pomodoroPhase === 'break' ? theme.tertiary : workAccent;
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
                      borderColor: scene.accent ? scene.accent + '33' : 'rgba(255, 255, 255, 0.16)', // yörünge: sahnenin vurgusunda (Aurora: beyaz)
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
                          backgroundColor: scene.accent ? scene.accent + '40' : 'rgba(0, 229, 255, 0.14)', // halo: sahnenin vurgusu (Aurora: camgöbeği)
                        }}
                      />
                      {/* Inner Pure White Sparkle Flare (4-Point Diamond Vector) */}
                      {/* İşaret sahnenin simgesi: Aurora yıldız (Sirius) · Gelgit ay · Kor kor tanesi · Sis ateşböceği. */}
                      {scene.marker === 'star' ? (
                        <Svg width={16} height={16} viewBox="0 0 16 16" style={{ position: 'absolute' }}>
                          <Path
                            d="M 8 0 Q 8 8 0 8 Q 8 8 8 16 Q 8 8 16 8 Q 8 8 8 0"
                            fill="#FFFFFF"
                          />
                        </Svg>
                      ) : scene.marker === 'moon' ? (
                        <Svg width={14} height={14} viewBox="0 0 14 14" style={{ position: 'absolute' }}>
                          <Path d="M 9.5 1 A 6 6 0 1 0 13 9.5 A 5 5 0 1 1 9.5 1 Z" fill="#F0FDFF" />
                        </Svg>
                      ) : (
                        <View style={{ position: 'absolute', width: scene.marker === 'ember' ? 9 : 7, height: scene.marker === 'ember' ? 9 : 7, borderRadius: R.full, backgroundColor: scene.marker === 'ember' ? scene.stars[1] : scene.stars[3] }} />
                      )}
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
              }]}
            >
              {/* Basılı tutma bir TOPRAKLANMA jesti, adı olan bir düğme değil:
                  ağacın dışında kalır, sayaç ve düğmeler kendi adlarıyla okunur. */}
              <Touchable
                accessible={false}
                activeOpacity={1}
                onPressIn={() => {
                  pressStartRef.current = Date.now();
                  if (isActive && !reduceMotion) {
                    // Nefesi topla: aurora yavaşça (~1.8 sn) içe toplanıp parlar
                    holdBloom.value = withTiming(1, { duration: 1800, easing: ReEasing.out(ReEasing.ease) });
                    haptic.surface();
                    // Toplanma dolunca yumuşak "hazır" haptik (arc: dokun → topla → hazır → bırak)
                    if (chargeHapticRef.current) clearTimeout(chargeHapticRef.current);
                    chargeHapticRef.current = setTimeout(() => {
                      haptic.commit();
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
                    haptic.surface();
                  } else {
                    holdBloom.value = 0;
                  }
                }}
                onPress={() => {
                  if (!isActive) return;
                  // Uzun basış = topraklanma jesti → zen'i toggle ETME (sadece bloom yaşandı).
                  if (Date.now() - pressStartRef.current > 260) return;
                  haptic.surface();
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
                      c1={sc1}
                      c2={sc2}
                      c3={sc3}
                      scene={scene.id}
                      base={scene.base}
                      paused={!auroraVisible || reduceMotion}
                      lowFps={lowPowerGraphics}
                      holdSV={holdBloom}
                    />
                  </MotiView>

                  {/* Işık toplama — her 5 odak dakikası sahnenin bir ışığı (bkz. FocusLights). Molada toplanmaz. */}
                  {!(pomodoroMode && pomodoroPhase === 'break') && <FocusLights size={timerSize} color={scene.stars[1]} active={isActive} />}

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
                      a11yLabel={L.remaining}
                      timerSize={timerSize}
                      colonColor={(pomodoroMode && pomodoroPhase === 'break') ? theme.tertiary : workAccent}
                      reduceMotion={reduceMotion}
                    />

                    {/*
                      ODAK BAĞLAMI — seans SÜRERKEN yalnız okunur bir satır; seans YOKKEN
                      dokunulabilir. Eskiden görev yalnız ana sayfadan/Bugün'den bağlanabiliyordu;
                      doğrudan bu ekrana gelen kullanıcı adsız seans başlatıyordu (bkz. FocusTaskPicker).
                    */}
                    {sessionStarted ? (
                      currentTask ? (
                        <MotiView
                          from={{ opacity: 0, translateY: 4 }}
                          animate={{ opacity: 0.82, translateY: 0 }}
                          transition={{ type: 'timing', duration: 450 }}
                          style={{ maxWidth: timerSize * 0.72, marginTop: S.md, alignItems: 'center' }}
                        >
                          {/* Android'in varsayılan "highQuality" satır kırma stratejisi, "…" ile kısaltılan
                              metni çizildiğinden dar ölçüyor; ilk harfin sol yarısı kırpılıyordu ("TAZQ" → "ΓAZQ",
                              cihazda görüldü). "simple" ölçümü çizimle eşitler. */}
                          <Text numberOfLines={1} textBreakStrategy="simple" style={{ color: 'rgba(255,255,255,0.8)', fontSize: F.footnote, fontWeight: '600', letterSpacing: 0.3 }}>
                            {currentTask}
                          </Text>
                        </MotiView>
                      ) : null
                    ) : (
                      <Touchable
                        accessibilityRole="button"
                        accessibilityLabel={currentTask || L.pickTask}
                        onPress={() => setTaskPickerVisible(true)}
                        style={{ maxWidth: timerSize * 0.82, marginTop: S.md, flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: currentTask ? theme.primary + '1A' : 'rgba(255,255,255,0.07)' }}
                      >
                        {/* Seçili konu accent bir nokta ile işaretlenir; boşken nokta soluk. */}
                        <View style={{ width: 5, height: 5, borderRadius: R.full, backgroundColor: currentTask ? theme.primary : 'rgba(255,255,255,0.35)' }} />
                        <Text numberOfLines={1} style={{ color: currentTask ? theme.primary : 'rgba(255,255,255,0.62)', fontSize: F.footnote, fontWeight: '600', letterSpacing: 0.2, textAlign: 'center' }}>
                          {currentTask || L.pickTask}
                        </Text>
                      </Touchable>
                    )}

                    {/* Duraklatıldı göstergesi (eski nefes ipucunun yeri; nefes artık ayrı seans) */}
                    <View style={{ height: 28, marginTop: S.sm, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                      {/* DURAKLATILDI — duraklamış sayaç hiçbir şey söylemiyordu: ekran
                          donmuş gibi görünüyor, kullanıcı neden ilerlemediğini anlamıyordu. */}
                      {isPaused && (
                        <Text style={{ fontSize: F.caption, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.45)' }}>
                          {L.paused}
                        </Text>
                      )}
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
                      <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                        <Sparkles size={ICON.lg} color={theme.onSurface} style={{ opacity: 0.2 }} />
                      </View>
                    {/* Sahnenin parlak çekirdeği üstünde de okunsun: beyaz + yumuşak gölge (gri %25 Kor'da kayboluyordu). */}
                    <Text style={{ fontFamily: 'Jakarta-SemiBold', fontSize: 10, color: '#FFFFFF', opacity: 0.55, marginTop: S.slg, letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }}>
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
              {/* Sıfırlanacak bir şey yokken (seans başlamamış) düğme hiç çizilmez — yeri
                  korunur ki oynat düğmesi kaymasın. Eskiden %30 opaklıkla "ölü" duruyordu. */}
              <AnimatePresence>
                {!isActive && sessionStarted && (
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
                      style={[styles.secondaryBtn, { backgroundColor: 'rgba(255,255,255,0.08)', width: 56, height: 56, borderRadius: R.full }]}
                    >
                      <RotateCcw size={ICON.lg} color={theme.onSurfaceVariant} />
                    </Touchable>
                  </MotiView>
                )}
              </AnimatePresence>
            </View>

            <TourTarget id="startButton" style={{ alignSelf: 'center' }} spotRadius={R.full} spotPad={S.sm}>
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

            {/* Sağ yuva: molada "atla" — mola bitmeden çalışmaya dönmenin yolu yoktu. */}
            <View style={{ width: 56, height: 56 }}>
              {inBreak && (
                <Touchable
                  onPress={skipBreak}
                  accessibilityRole="button"
                  accessibilityLabel={L.skipBreak}
                  style={[styles.secondaryBtn, { backgroundColor: theme.surfaceContainerLow, width: 56, height: 56, borderRadius: R.lg }]}
                >
                  <SkipForward size={ICON.lg} color={theme.onSurfaceVariant} />
                </Touchable>
              )}
            </View>
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
              {(['rain', 'cafe', 'forest', 'ocean', 'fireplace', 'relaxing', 'binaural', 'brown'] as AmbientSound[]).map(type => {
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
                      haptic.select();
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
                      onPress={() => { updateAmbientVolume(v); haptic.select(); }}
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
              {inBreak && isActive ? (
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
                  {/*
                    İKİ DOKUNUŞ: ilk dokunuş "emin misin?" der, ikincisi bitirir. Tek
                    dokunuşla biten düğme, sayacın hemen altında duruyor ve yanlışlıkla
                    dokunan kullanıcının seansını yarıda kesiyordu. Onay 4 saniyede geri döner.
                  */}
                  <Touchable
                    onPress={onEndPress}
                    accessibilityRole="button"
                    accessibilityLabel={confirmEnd ? L.endConfirm : t.focusEndSession}
                    style={[styles.finishBtn, { borderColor: (confirmEnd ? theme.error : theme.tertiary) + '50', backgroundColor: (confirmEnd ? theme.error : theme.tertiary) + '12' }]}
                  >
                    <CheckCircle2 size={ICON.sm} color={confirmEnd ? theme.error : theme.tertiary} />
                    <Text style={[styles.finishText, { color: confirmEnd ? theme.error : theme.tertiary, fontSize: F.body }]}>
                      {confirmEnd ? L.endConfirm : t.focusEndSession}
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
                    {notifBlocked ? (
                      <Text style={{ textAlign: 'center', color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600' }}>{L.notifOff}</Text>
                    ) : (
                      <Text style={{ fontStyle: 'italic', textAlign: 'center', color: theme.onSurfaceMuted, fontSize: F.body }}>{quote}</Text>
                    )}
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
              { paddingBottom: S.xxl },
            ]}
          >
            <GlassSurface corners="top" />
            <View {...customPan.panHandlers} style={{ paddingTop: S.md, paddingBottom: S.lmd, alignItems: 'center' }}>
              <View style={[styles.sheetHandle, { backgroundColor: sheetDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: sheetTheme.onSurface }]}>{t.focusCustomDuration}</Text>
            <Text style={[styles.sheetSub, { color: sheetTheme.onSurfaceMuted }]}>{language === 'tr' ? '1 – 180 dakika' : '1 – 180 minutes'}</Text>

            {/* Drum-roll wheel */}
            <View style={{ height: WHEEL_ITEM_H * 5, width: '100%', alignItems: 'center', overflow: 'hidden' }}>
              {/* center selection indicator */}
              <View style={{ position: 'absolute', top: WHEEL_ITEM_H * 2, left: 24, right: 24, height: WHEEL_ITEM_H, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: sheetTheme.primary + '70', borderRadius: R.sm, pointerEvents: 'none' }} />
              {/* fade top */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: WHEEL_ITEM_H * 2, zIndex: 1, pointerEvents: 'none', backgroundColor: 'transparent' }}
                    pointerEvents="none">
                <View style={{ flex: 1, backgroundColor: sheetDark ? sheetTheme.surfaceContainerHigh : sheetTheme.surfaceContainerLowest, opacity: 0.7 }} />
              </View>
              {/* fade bottom */}
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: WHEEL_ITEM_H * 2, zIndex: 1, pointerEvents: 'none' }}
                    pointerEvents="none">
                <View style={{ flex: 1, backgroundColor: sheetDark ? sheetTheme.surfaceContainerHigh : sheetTheme.surfaceContainerLowest, opacity: 0.7 }} />
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
                  haptic.select();
                }}
              >
                {WHEEL_MINS.map(m => (
                  <View key={m} style={{ height: WHEEL_ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 36, fontWeight: '700', letterSpacing: -1, color: sheetTheme.onSurface }}>
                      {m}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <Text style={[styles.minLabel, { color: sheetTheme.onSurfaceMuted, marginTop: S.xs }]}>
              {language === 'tr' ? 'DAKİKA' : 'MINUTES'}
            </Text>

            <Touchable
              onPress={applyCustomDuration}
              style={[styles.applyBtn, { backgroundColor: sheetTheme.primary }]}
            >
              <Text style={[styles.applyBtnText, { color: sheetTheme.onPrimary }]}>{t.focusCustomApply}</Text>
            </Touchable>
          </Animated.View>
        </View>
      </Modal>

      {/* Odak modları — görsel ve metinler ayrı dosyada (bkz. FocusModeSheets). */}
      <FocusModesSheet
        visible={modesSheetVisible}
        onClose={() => setModesSheetVisible(false)}
        language={language === 'en' ? 'en' : 'tr'}
        labels={{ keepAwake: L.keepAwake, keepAwakeDesc: L.keepAwakeDesc, strictDesc: L.strictDesc }}
        pomodoroOn={pomodoroMode}
        strictOn={strictMode}
        keepAwakeOn={focusKeepAwake || strictMode}
        autoZenOn={focusAutoZen}
        onBreath={() => { haptic.select(); setModesSheetVisible(false); router.push('/nefes'); }}
        onPomodoro={() => { haptic.select(); togglePomodoroMode(); if (!pomodoroMode) setDuration(activePreset.workMins); }}
        onStrict={() => { haptic.select(); setStrictMode(!strictMode); }}
        onKeepAwake={() => { haptic.select(); setFocusKeepAwake(!focusKeepAwake); }}
        onAutoZen={() => { haptic.select(); setFocusAutoZen(!focusAutoZen); }}
        scene={scene.id}
        onScene={(id) => { haptic.select(); setFocusScene(id); }}
      />

      <FocusTaskPicker
        visible={taskPickerVisible}
        language={language === 'en' ? 'en' : 'tr'}
        onClose={() => setTaskPickerVisible(false)}
        onPick={(title, taskId) => {
          setTaskPickerVisible(false);
          useFocusStore.getState().setCurrentTask(title, taskId);
        }}
      />

      {/* ── Seans özeti ───────────────────────────────────────────────────────
          Görsel ve mantık ayrı dosyada (bkz. SessionSummary): bağlı görev sorusu,
          günlük hedef ve "+5 dk" buraya eklendi. */}
      <SessionSummary
        visible={summaryVisible}
        minutes={summaryMinutes}
        completed={summaryCompleted}
        taskTitle={summaryTask?.title ?? null}
        dailyMinutes={dailyFocusToday}
        dailyGoal={dailyGoalMinutes}
        breakMinutes={activePreset.shortBreak}
        showBreak={summaryCompleted && !pomodoroMode}
        language={language === 'en' ? 'en' : 'tr'}
        t={t}
        onClose={() => setSummaryVisible(false)}
        onStartBreak={() => startBreakSession(activePreset.shortBreak)}
        onExtend={() => {
          // "Biraz daha" — aynı konuyla kısa bir seans; süre seçmeye geri dönmek gerekmesin.
          setSummaryVisible(false);
          completedRef.current = false;
          setDuration(5);
          setIsActive(true);
        }}
        onNewSession={() => { setSummaryVisible(false); completedRef.current = false; reset(); }}
        onCompleteTask={() => { if (summaryTask) void completeTask(summaryTask.id); }}
        onHome={() => {
          haptic.commit();
          setSummaryVisible(false);
          stopAllSounds();
          setAmbientSound('off');
          reset();
          goHome(router); // tek animasyon — bkz. kapat düğmesindeki not
        }}
      />

      <PomodoroInfoSheet
        visible={pomodoroInfoVisible}
        onClose={() => setPomodoroInfoVisible(false)}
        language={language === 'en' ? 'en' : 'tr'}
        presets={PRESETS}
        activePreset={activePreset}
        selectedPreset={selectedPreset}
        onSelectPreset={(key, workMins) => { setSelectedPreset(key as PresetKey); setDuration(workMins); }}
      />

      {tourOn && (
        <HelpTourModal
          pageId="focus"
        />
      )}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', width: '100%', padding: S.xxs, borderRadius: R.full, backgroundColor: 'rgba(255,255,255,0.06)' },
  segmentItem: { alignItems: 'center', justifyContent: 'center', paddingVertical: S.sm, borderRadius: R.full, minHeight: 36 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg },
  closeBtn: { width: 44, height: 44, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  badgeText: { fontWeight: '700', letterSpacing: 1 },
  pomodoroToggle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, borderWidth: B.thin },
  pomodoroToggleText: { fontSize: F.caption2, fontWeight: '700', letterSpacing: 0.2 },
  pomodoroRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.xl, justifyContent: 'center' },
  phaseBadge: { paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full },
  phaseLabel: { fontSize: F.caption, fontWeight: '700', letterSpacing: 1.5 },
  content: { flex: 1, alignItems: 'center', width: '100%' },
  durationRow: { flexDirection: 'row' },
  durationChip: { borderRadius: R.full },
  durationText: { fontWeight: '700' },
  timerContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  // Android'de elevation YOK (2026-10-25, cihazda görüldü): daire saydam, Android gölgeyi görünümün
  // ALTINA çizdiği için gölge dairenin içinden görünüyordu; Android 9 büyük yarıçaplı gölgeyi
  // çokgenle yaklaştırdığından sakin modda dairenin içinde koyu bir SEKİZGEN beliriyordu.
  // Koyu zeminde bu gölgenin zaten görsel karşılığı yok. iOS gölgesi değişmedi.
  timerCircle: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: Platform.OS === 'android' ? 0 : 10 },
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
  ambientLabel: { fontSize: F.caption2, fontWeight: '700', letterSpacing: 0.1 },
  finishBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin },
  finishText: { fontWeight: '700', letterSpacing: 0.3 },
  footer: { alignItems: 'center' },
  quote: { fontStyle: 'italic', textAlign: 'center', opacity: 0.5 },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  customSheet: { borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, padding: S.lg, alignItems: 'center', gap: S.sm },
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
  transitionTitle: { fontSize: F.display, fontWeight: '700', letterSpacing: -0.5 },
  transitionSub: { fontSize: F.subhead, fontWeight: '600', textAlign: 'center' },
});
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
