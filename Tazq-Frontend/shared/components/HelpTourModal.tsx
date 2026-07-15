import { useLanguageStore } from '@/shared/store/useLanguageStore';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing as REasing } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { TourFeaturePreview } from '@/shared/components/TourFeaturePreview';
import {
  Rocket,
  Flame,
  ListChecks,
  BarChart3,
  Search,
  Target,
  SlidersHorizontal,
  Timer,
  Play,
  Sparkles,
  Zap,
  LayoutGrid,
  CalendarDays,
  TrendingUp,
  Trophy,
  Moon,
} from 'lucide-react-native';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F } from '@/shared/constants/tokens';
import * as HapticsOriginal from 'expo-haptics';
const Haptics = {
  notificationAsync: (type: any) => HapticsOriginal.notificationAsync(type).catch(() => {}),
  impactAsync: (style: any) => HapticsOriginal.impactAsync(style).catch(() => {}),
  selectionAsync: () => HapticsOriginal.selectionAsync().catch(() => {}),
  NotificationFeedbackType: HapticsOriginal.NotificationFeedbackType,
  ImpactFeedbackStyle: HapticsOriginal.ImpactFeedbackStyle,
};

type PageId = 'dashboard' | 'focus' | 'tasks' | 'modlar' | 'cockpit';
type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface HelpTourModalProps {
  pageId: PageId;
  onStepChange?: (step: number) => void;
}

interface TourStep {
  Icon: IconType;
  color: (t: any) => string;
  title: { tr: string; en: string };
  desc: { tr: string; en: string };
}

// ─────────────────────────────────────────────────────────────
//  Sayfa turları — uygulamanın kendi ikon seti (lucide), emoji yok.
//  Betimleyici, kısa, boğmayan dil.
// ─────────────────────────────────────────────────────────────
const TOURS: Record<PageId, TourStep[]> = {
  dashboard: [
    {
      Icon: Rocket,
      color: (t) => t.primary,
      title: { tr: 'İvme Skorun', en: 'Your Momentum' },
      desc: {
        tr: 'Görev, odak ve serin tek bir skorda toplanır. Tatil günlerinde İvme Kalkanı’nı açarak skorunun erimesini durdurabilirsin.',
        en: 'Tasks, focus and streak roll into one score. Turn on the Momentum Shield to keep it from decaying on rest days.',
      },
    },
    {
      Icon: Flame,
      color: (t) => t.streak,
      title: { tr: 'Günlük Alışkanlıklar', en: 'Daily Habits' },
      desc: {
        tr: 'Su içmek, kitap okumak gibi rutinlerini gün bitmeden işaretle. Serini bozmadan devam ettikçe güçlenir.',
        en: 'Check off routines like water or reading before the day ends. Keep the streak alive and it grows stronger.',
      },
    },
    {
      Icon: ListChecks,
      color: (t) => t.success,
      title: { tr: 'Görev Akışın', en: 'Task Flow' },
      desc: {
        tr: 'Bugünün görevleri burada. Bir görevi tamamladığında ivmene anında güç ekler.',
        en: 'Today’s tasks live here. Completing one gives your momentum an instant boost.',
      },
    },
    {
      Icon: BarChart3,
      color: (t) => t.tertiary,
      title: { tr: 'Bugün & Kokpit', en: 'Today & Cockpit' },
      desc: {
        tr: 'Günlük hedefine ne kadar yaklaştığını gör. Karta dokunarak haftalık karneni, odak süreni ve detaylı istatistiklerini aç.',
        en: 'See how close you are to today’s goal. Tap the card to open your weekly review, focus time and detailed stats.',
      },
    },
  ],
  tasks: [
    {
      Icon: Search,
      color: (t) => t.primary,
      title: { tr: 'Ara, Süz & Ekle', en: 'Search, Filter & Add' },
      desc: {
        tr: 'Görevlerini anında ara, duruma göre süz (Tümü, Bugün, Yüksek…). Sağ alttaki + butonuyla saniyeler içinde yeni görev ekle.',
        en: 'Search instantly, filter by status (All, Today, High…). Tap the + button at the bottom-right to add a task in seconds.',
      },
    },
    {
      Icon: Target,
      color: (t) => t.success,
      title: { tr: 'Görev Listen', en: 'Your Task List' },
      desc: {
        tr: 'Tamamlamak için göreve dokun. Sola kaydırınca ertele (takvim) ve sil seçenekleri açılır. Renkli nokta önceliğini gösterir.',
        en: 'Tap a task to complete it. Swipe left to reveal reschedule and delete. The colored dot shows its priority.',
      },
    },
  ],
  focus: [
    {
      Icon: SlidersHorizontal,
      color: (t) => t.secondary,
      title: { tr: 'Mod & Ambiyans', en: 'Mode & Ambience' },
      desc: {
        tr: 'Nefes, Pomodoro ya da katı odak modunu seç. Altındaki yağmur, kafe ve okyanus gibi ambiyans seslerinden birini açarak konsantre ol.',
        en: 'Pick breathing, Pomodoro or strict focus. Turn on an ambient sound below — rain, cafe or ocean — to lock in.',
      },
    },
    {
      Icon: Timer,
      color: (t) => t.primary,
      title: { tr: 'Zamanlayıcı & Süre', en: 'Timer & Duration' },
      desc: {
        tr: 'Süreni seç (15, 25, 50 dk) ve geri sayımı başlat. Odaklandığın her dakika doğrudan ivme skoruna işler.',
        en: 'Choose your length (15, 25, 50 min) and start the countdown. Every focused minute feeds your momentum.',
      },
    },
    {
      Icon: Play,
      color: (t) => t.success,
      title: { tr: 'Başlat & Katı Mod', en: 'Start & Strict Mode' },
      desc: {
        tr: 'Büyük butona dokunup seansı başlat. Katı Mod, seans bitene kadar dikkat dağıtıcıları ve çıkışı kilitler.',
        en: 'Tap the big button to begin. Strict Mode locks out distractions and the exit until the session ends.',
      },
    },
    {
      Icon: Moon,
      color: (t) => t.secondary,
      title: { tr: 'Zen Modu', en: 'Zen Mode' },
      desc: {
        tr: 'Seansı başlat, sonra sayaç çemberine dokun: ekran koyu bir yıldız gökyüzüne dönüşür, geriye yalnızca zamanın ve yörüngedeki yıldız kalır. Derin odak için her şey kaybolur.',
        en: 'Start the session, then tap the timer circle: the screen turns into a dark starfield, leaving only your time and an orbiting star. Everything fades for deep focus.',
      },
    },
  ],
  modlar: [
    {
      Icon: Sparkles,
      color: (t) => t.primary,
      title: { tr: 'Dönemsel Modlar', en: 'Seasonal Modes' },
      desc: {
        tr: 'Aktif dönem hedeflerinin özeti. Sınav, tez, tasarruf ya da spor gibi yolculuklarını buradan takip et.',
        en: 'A summary of your active goals. Track journeys like exams, thesis, savings, or fitness here.',
      },
    },
    {
      Icon: Target,
      color: (t) => t.tertiary,
      title: { tr: 'Yeni Hedef Keşfet', en: 'Discover New Goals' },
      desc: {
        tr: 'Sınav, tez, tasarruf ya da spor… Bir hedef seç, Tazq o döneme özel görev ve alışkanlıkları senin için otomatik kursun.',
        en: 'Exam, thesis, savings or fitness… Pick a goal and Tazq automatically builds tailored tasks and habits for that season.',
      },
    },
    {
      Icon: LayoutGrid,
      color: (t) => t.success,
      title: { tr: 'Plan İçeriği', en: 'Plan Contents' },
      desc: {
        tr: 'Aktif modun ürettiği görev ve alışkanlıkları buradan gör, düzenle veya kaldır.',
        en: 'See, tweak, or remove the tasks and habits your active mode created — all in one place.',
      },
    },
  ],
  cockpit: [
    {
      Icon: CalendarDays,
      color: (t) => t.tertiary,
      title: { tr: 'Haftalık Şerit', en: 'Week Strip' },
      desc: {
        tr: 'Haftanın günleri arasında gez. Her günün üretkenliğini tek bakışta karşılaştır.',
        en: 'Move across the days of your week. Compare each day’s output at a glance.',
      },
    },
    {
      Icon: TrendingUp,
      color: (t) => t.primary,
      title: { tr: 'Günlük Detay', en: 'Daily Detail' },
      desc: {
        tr: 'Seçtiğin günün odak süresi, tamamlanan görevleri ve alışkanlık oranı burada açılır.',
        en: 'Focus time, completed tasks, and habit rate for the selected day open up here.',
      },
    },
    {
      Icon: Trophy,
      color: (t) => t.success,
      title: { tr: 'Haftalık Karne', en: 'Weekly Review' },
      desc: {
        tr: 'Haftanın genel karnesi. İstikrarlı yükselişini grafiklerle takip et ve kendini geçmiş haftalarla kıyasla.',
        en: 'Your weekly report card. Track your steady climb and compare against past weeks.',
      },
    },
  ],
};

export const HelpTourModal: React.FC<HelpTourModalProps> = ({ pageId }) => {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { theme, isDark } = useAppTheme();
  const { completedTours, setTourCompleted, setHelpTourShown } = usePrefsStore();
  const { language } = useLanguageStore();
  const tr = language === 'tr';

  const steps = TOURS[pageId] ?? [];
  const isTourShown = completedTours?.[pageId] === true || steps.length === 0;

  const [currentStep, setCurrentStep] = useState(0);
  const [dir, setDir] = useState(1); // 1 ileri, -1 geri (slide yönü)
  const maxStep = steps.length - 1;
  const stepData = steps[currentStep];
  const accent = stepData ? stepData.color(theme) : theme.primary;

  // Kart giriş/çıkış (native driver: opacity + translateY)
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTourShown) return;
    setCurrentStep(0);
    Animated.spring(enter, {
      toValue: 1,
      tension: 55,
      friction: 11,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTourShown]);

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(enter, {
      toValue: 0,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setTourCompleted(pageId, true);
      setHelpTourShown(true); // legacy uyumluluk
    });
  };

  const next = () => {
    if (currentStep < maxStep) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDir(1);
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const back = () => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDir(-1);
      setCurrentStep((s) => s - 1);
    }
  };

  if (isTourShown || !stepData) return null;

  const Icon = stepData.Icon;
  const contentShift = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  // Sağa/sola kaydırarak adım değiştir
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-16, 16])
    .failOffsetY([-24, 24])
    .onEnd((e) => {
      if (e.translationX <= -46) next();
      else if (e.translationX >= 46) back();
    });

  // İşlev animasyonu yüzeyi — genişlik responsive, yükseklik içeriğe göre (dinamik)
  const screenW = Math.max(240, Math.min(winW - 40, 400));
  const maxScreenH = winH * 0.5;
  const frameW = screenW; // önizlemeye verilen içerik genişliği

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: enter }]} pointerEvents="auto">
      {/* Çok hafif cam efekti (iOS blur) + ince karartma — uygulama silik görünür, yazı okunur */}
      <BlurView
        intensity={18}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? 'rgba(6, 8, 12, 0.58)' : 'rgba(17, 19, 26, 0.45)' },
        ]}
      />

      {/* Ortalanmış içerik — sağa/sola kaydırılabilir */}
      <GestureDetector gesture={swipe}>
      <Animated.View
        style={[
          styles.stage,
          { paddingTop: insets.top, transform: [{ translateY: contentShift }] },
        ]}
      >
        {/* ── İşlev animasyonu: uygulamadan temiz bir kesit (telefon yok) ── */}
        <MotiView
          key={`frame-${currentStep}`}
          from={{ opacity: 0, translateX: dir * 40, scale: 0.97 }}
          animate={{ opacity: 1, translateX: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 400, easing: REasing.out(REasing.cubic) }}
          style={[
            styles.screen,
            {
              width: screenW,
              maxHeight: maxScreenH,
              backgroundColor: theme.background,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            },
          ]}
        >
          <TourFeaturePreview pageId={pageId} step={currentStep} theme={theme} isDark={isDark} accent={accent} tr={tr} frameW={screenW} />
        </MotiView>

        {/* ── Alt yazı: adım · başlık · açıklama ── */}
        <MotiView
          key={`text-${currentStep}`}
          from={{ opacity: 0, translateX: dir * 26 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 360, easing: REasing.out(REasing.cubic) }}
          style={styles.textBlock}
        >
          <View style={styles.titleRow}>
            <Icon size={17} color={accent} strokeWidth={2.4} />
            <Text style={[styles.counter, { color: accent }]}>
              {String(currentStep + 1).padStart(2, '0')}  ·  {String(steps.length).padStart(2, '0')}
            </Text>
          </View>
          <Text style={[styles.title, { color: '#FFFFFF' }]}>
            {tr ? stepData.title.tr : stepData.title.en}
          </Text>
          <Text style={[styles.desc, { color: 'rgba(255,255,255,0.86)' }]}>
            {tr ? stepData.desc.tr : stepData.desc.en}
          </Text>
        </MotiView>
      </Animated.View>
      </GestureDetector>

      {/* ── Alt kontroller (kutusuz, sahneye gömülü) ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dotsRow}>
          {steps.map((_, i) => (
            <MotiView
              key={i}
              animate={{
                width: i === currentStep ? 22 : 6,
                backgroundColor: i === currentStep ? accent : 'rgba(255,255,255,0.22)',
              }}
              transition={{ type: 'timing', duration: 260 }}
              style={styles.dot}
            />
          ))}
        </View>

        <View style={styles.controls}>
          {currentStep > 0 ? (
            <Touchable onPress={back} style={styles.textBtn}>
              <Text style={[styles.textBtnLabel, { color: 'rgba(255,255,255,0.85)' }]}>
                {tr ? 'Geri' : 'Back'}
              </Text>
            </Touchable>
          ) : (
            <Touchable onPress={finish} style={styles.textBtn}>
              <Text style={[styles.textBtnLabel, { color: 'rgba(255,255,255,0.55)' }]}>
                {tr ? 'Atla' : 'Skip'}
              </Text>
            </Touchable>
          )}

          <Touchable onPress={next} style={[styles.nextBtn, { backgroundColor: accent }]}>
            <Text style={styles.nextBtnLabel}>
              {currentStep === maxStep ? (tr ? 'Anladım' : 'Got it') : tr ? 'Sonraki' : 'Next'}
            </Text>
          </Touchable>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    zIndex: 9990,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: S.slg,
    gap: S.slg,
  },
  screen: {
    borderRadius: R.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 18,
  },
  textBlock: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginBottom: S.smd,
  },
  counter: {
    fontSize: F.caption,
    fontWeight: '700',
    letterSpacing: 3,
    opacity: 0.9,
  },
  title: {
    fontSize: F.title,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: S.smd,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  desc: {
    fontSize: F.subhead,
    lineHeight: 25,
    textAlign: 'center',
    paddingHorizontal: S.xs,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: S.slg,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    marginBottom: S.lg,
  },
  dot: {
    height: 6,
    borderRadius: R.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  textBtn: {
    paddingVertical: S.smd,
    paddingHorizontal: S.smd,
  },
  textBtnLabel: {
    fontSize: F.body,
    fontWeight: '600',
  },
  nextBtn: {
    paddingVertical: S.md,
    paddingHorizontal: S.slg,
    borderRadius: R.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  nextBtnLabel: {
    color: '#FFFFFF',
    fontSize: F.body,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
