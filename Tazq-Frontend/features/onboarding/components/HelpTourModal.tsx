/*
 * KATMAN DÜZELTMESİ: bu dosya `shared` altındaydı.
 *
 * Tanıtım turu modalı — tur ilerlemesini tercihlerde tutuyor ve özellik önizlemesini
 * çiziyor. `features/onboarding` bunun doğal yeri.
 *
 * `shared` en alt katman: yukarıdaki hiçbir şeyi bilmemeli. Taşıma yalnız YERİ
 * değiştirdi; mantık aynen korundu.
 */
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing, useWindowDimensions, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing as REasing } from 'react-native-reanimated';
import { AppBlur } from '@/shared/components/AppBlur';
import { MotiView } from 'moti';
import { TourFeaturePreview } from '@/features/onboarding/components/TourFeaturePreview';
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
  Compass,
} from 'lucide-react-native';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useActiveModeSummary } from '@/features/modes/hooks/useActiveModeSummary';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F } from '@/shared/constants/tokens';
import { haptic } from '@/shared/utils/haptics';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.

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
/*
  AKTİF PLAN ADIMI — dashboard turuna eklendi.

  Bu oturumda ana ekranın en üstüne, aktif modu (sınav/spor/tez…) olan kullanıcılar
  için kaydırmalı bir plan kartı (ModeDeck) eklendi — kullanıcının bir önceki
  şikâyeti tam olarak buydu ("sağa sola kaydırma yok"). Beş adımlık dashboard
  turunda buna TEK KELİME yoktu; kaydırma jesti görünmeyen bir jesttir, tanıtılmazsa
  keşfedilmez. Adım yalnız gerçekten aktif modu OLAN kullanıcıya gösterilir (bkz.
  ACTIVE_MODE_STEP_TITLES) — yoksa işaret ettiği kart ekranda hiç yok demektir.
*/
const activeModeStep: TourStep = {
  Icon: Compass,
  color: (t) => t.primary,
  title: { tr: 'Aktif Planın', en: 'Your Active Plan' },
  desc: {
    tr: 'Aktif hedeflerin en üstte, geri sayımıyla duruyor. Birden fazla hedefin varsa aralarında sağa sola kaydır.',
    en: 'Your active goals sit at the top with their countdown. If you have more than one, swipe left and right to switch.',
  },
};
const ACTIVE_MODE_STEP_TITLES = ['Aktif Planın', 'Your Active Plan'];

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
      /*
        ÖLÇÜLEN HATA: "Karta dokunarak aç" diyordu — ama BUGÜN kartına dokunmak yalnız
        küçük bir kutlama animasyonu tetikliyor. Haftalık özeti açan, başlıktaki KÜÇÜK
        gösterge ikonu; kart onun ANLATTIĞI şey, onun kendisi değil.
      */
      desc: {
        tr: 'Günlük hedefine ne kadar yaklaştığını burada gör. Başlıktaki gösterge ikonuna dokunarak haftalık karneni, odak süreni ve detaylı istatistiklerini aç.',
        en: 'See how close you are to today’s goal right here. Tap the gauge icon in the header to open your weekly review, focus time and detailed stats.',
      },
    },
    /*
      TAZQ CORE — logonun işi hiçbir yerde anlatılmıyordu ve logonun dokunulabilir
      olduğunu gösteren bir işaret de yok. Ayrı bir ipucu balonu ya da rozet eklemek
      yerine, kullanıcının zaten bir kez gördüğü tura tek adım.
    */
    {
      Icon: Sparkles,
      color: (t) => t.tertiary,
      title: { tr: 'TAZQ Core', en: 'TAZQ Core' },
      desc: {
        tr: 'Üstteki logoya dokun: görevlerini ara, bir cümleyle görev ekle ya da işler birikince tek dokunuşla günü toparla.',
        en: 'Tap the logo up top: search your tasks, add one in a sentence, or tidy up a crowded day in one tap.',
      },
    },
    // SONA eklendi (index 5) — TourFeaturePreview'daki mevcut 'dashboard-0'..'dashboard-4'
    // eşlemesi yeniden numaralanmasın diye; yalnız yeni bir 'dashboard-5' case'i gerekti.
    activeModeStep,
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
    /*
      ÖLÇÜLEN EKSİK: kullanıcı "sağa sola kaydırma yok" diye şikâyet etmişti; kart artık
      kaydırılabiliyor (bkz. ModeDeck) ama bu adım o jestten hiç bahsetmiyordu. Görünmeyen
      bir jest tanıtılmazsa keşfedilmez.
    */
    {
      Icon: Sparkles,
      color: (t) => t.primary,
      title: { tr: 'Yaşam Modları', en: 'Life Modes' },
      desc: {
        tr: 'Aktif dönem hedeflerinin özeti. Sınav, tez, tasarruf ya da spor gibi yolculuklarını buradan takip et — birden fazla hedefin varsa aralarında sağa sola kaydır.',
        en: 'A summary of your active goals. Track journeys like exams, thesis, savings, or fitness here — swipe left and right if you have more than one.',
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
    /*
      ÖLÇÜLEN HATA: "grafiklerle takip et, geçmiş haftalarla kıyasla" diyordu — sanki
      bu içerik Kokpit'in kendi içindeymiş gibi. Gerçekte grafikli karne ayrı bir
      ekranda (`/report`); Kokpit yalnız oraya götüren bir düğme taşıyor.
    */
    {
      Icon: Trophy,
      color: (t) => t.success,
      title: { tr: 'Haftalık Karne', en: 'Weekly Review' },
      desc: {
        tr: 'Başlıktaki düğmeye dokunarak haftanın genel karnesini aç — istikrarlı yükselişini grafiklerle takip et ve kendini geçmiş haftalarla kıyasla.',
        en: 'Tap the button in the header to open your weekly report card — track your steady climb and compare against past weeks.',
      },
    },
  ],
};

const TOUR_LABELS = {
  tr: { back: 'Geri', skip: 'Atla', skipTour: 'Turu atla', next: 'Sonraki', done: 'Anladım' },
  en: { back: 'Back', skip: 'Skip', skipTour: 'Skip tour', next: 'Next', done: 'Got it' },
};

export const HelpTourModal: React.FC<HelpTourModalProps> = ({ pageId }) => {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { theme, isDark } = useAppTheme();
  const { completedTours, setTourCompleted, setHelpTourShown, uiMode } = usePrefsStore();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const L = tr ? TOUR_LABELS.tr : TOUR_LABELS.en;

  /*
    SADE MODDA GİZLİ ÖZELLİK ANLATILMAZ.

    Sade mod ivme skorunu ekrandan kaldırıyor (bkz. app/index.tsx isLite). Turun ilk
    adımı ise tam olarak "İvme Skorun"u anlatıyordu — kullanıcı ekranda olmayan bir
    şeyin nasıl çalıştığını dinliyordu. Bir tur, gördüğü ekranı anlatmalı.
  */
  const GAMIFIED_STEP_TITLES = ['İvme Skorun', 'Your Momentum'];
  /*
    "AKTİF PLANIN" ADIMI DA AYNI KURALA TABİ — göstermediği ekranı anlatmaz.

    Adım, aktif modu olan kullanıcılar için üstte beliren kaydırmalı plan kartını
    tanıtıyor (bkz. ACTIVE_MODE_STEP_TITLES). Hiç aktif modu olmayan biri turu
    izlerken bu adım işaret ettiği kartı ekranında hiç göremez — var olmayan bir
    şeyi öğretmiş olurduk.
  */
  const hasActiveMode = useActiveModeSummary().activeCount > 0;
  const allSteps = TOURS[pageId] ?? [];
  const steps = allSteps.filter(st => {
    const isGamified = GAMIFIED_STEP_TITLES.includes(st.title.tr) || GAMIFIED_STEP_TITLES.includes(st.title.en);
    if (uiMode === 'lite' && isGamified) return false;
    const isActiveModeStep = ACTIVE_MODE_STEP_TITLES.includes(st.title.tr) || ACTIVE_MODE_STEP_TITLES.includes(st.title.en);
    if (isActiveModeStep && !hasActiveMode) return false;
    return true;
  });
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
    haptic.success();
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
      haptic.surface();
      setDir(1);
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const back = () => {
    if (currentStep > 0) {
      haptic.surface();
      setDir(-1);
      setCurrentStep((s) => s - 1);
    }
  };

  /*
    ANDROID GERİ TUŞU TURU YÖNETİR. Tur bir modal değil, sayfanın üstünde bir katman:
    geri tuşu arkadaki SAYFADAN çıkıyor, tur açık kalıyordu. Artık önce bir adım geri,
    ilk adımda turu kapatır (atla ile aynı: bir daha gösterilmez).
  */
  const backRef = useRef({ back, finish, currentStep });
  backRef.current = { back, finish, currentStep };
  useEffect(() => {
    if (isTourShown) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const r = backRef.current;
      if (r.currentStep > 0) r.back(); else r.finish();
      return true;
    });
    return () => sub.remove();
  }, [isTourShown]);

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
    // accessibilityViewIsModal: ekran okuyucu turun ARKASINDAKİ sayfada gezinmesin.
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: enter }]} pointerEvents="auto" accessibilityViewIsModal>
      {/* Çok hafif cam efekti (iOS blur) + ince karartma — uygulama silik görünür, yazı okunur */}
      <AppBlur material="thin" />
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
          {/* Görsel adımın SIRASINA değil KİMLİĞİNE bağlı: Sade modda ilk adım (İvme)
              düşünce sıra kayıyor ve her adım bir öncekinin görselini gösteriyordu. */}
          <TourFeaturePreview pageId={pageId} step={allSteps.indexOf(stepData)} theme={theme} isDark={isDark} accent={accent} tr={tr} frameW={screenW} />
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

      {/* ── HER ADIMDA "Atla" ── eskiden yalnız ilk adımda vardı (orada sol düğme); ikinci
          adımdan sonra turdan çıkmanın tek yolu sonuna kadar gitmekti. */}
      {currentStep > 0 && currentStep < maxStep && (
        <Touchable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel={L.skipTour}
          style={[styles.textBtn, { position: 'absolute', top: insets.top + S.sm, right: S.md }]}
        >
          <Text style={[styles.textBtnLabel, { color: 'rgba(255,255,255,0.55)' }]}>{L.skip}</Text>
        </Touchable>
      )}

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
            <Touchable onPress={back} accessibilityRole="button" style={styles.textBtn}>
              <Text style={[styles.textBtnLabel, { color: 'rgba(255,255,255,0.85)' }]}>
                {L.back}
              </Text>
            </Touchable>
          ) : (
            <Touchable onPress={finish} accessibilityRole="button" accessibilityLabel={L.skipTour} style={styles.textBtn}>
              <Text style={[styles.textBtnLabel, { color: 'rgba(255,255,255,0.55)' }]}>
                {L.skip}
              </Text>
            </Touchable>
          )}

          <Touchable onPress={next} accessibilityRole="button" style={[styles.nextBtn, { backgroundColor: accent }]}>
            <Text style={styles.nextBtnLabel}>
              {currentStep === maxStep ? L.done : L.next}
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
