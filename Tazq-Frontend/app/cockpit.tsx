import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform, Dimensions, Animated, useWindowDimensions, Alert } from 'react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import {
  Plus, Check, Flame, Clock,
  ChevronRight, Sparkles, CalendarDays, Trash2, ArrowLeft, BarChart3, Coffee,
  CalendarCheck, Sunrise,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.
import { useFocusHistoryStore } from '@/features/report/useFocusHistoryStore';
import { weekRange, summarizeWeek } from '@/features/report/weeklyReport';
import { useToastStore } from '@/shared/store/useToastStore';
import { useTaskStore, useActiveTasks, getLocalizedTaskTitle } from '@/features/tasks';
import { useFocusStore } from '@/features/focus';
import { useHabitStore, Habit, fmtDateKey } from '@/features/habits';
import { calendarDayOf } from '@/shared/utils/dateKey';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { describeHabit, rowHint } from '@/shared/utils/a11y';
import { celebrate } from '@/features/user/utils/celebrate';
import { usePrefsStore, renderModeEmojiIcon } from '@/features/modes';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { BentoCard } from '@/shared/components/BentoCard';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { ICON, S, R, F, B, TRACKING, MAX_W, contentMaxWidth, sideInset, HAIRLINE, navBarSpace, topBarSpace, TOP_BAR_HEIGHT , sheetMaxHeight, touchSlop } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { WideSplit, WideCol } from '@/shared/components/ResponsiveColumns';
import { ChromeShell } from '@/shared/components/ChromeShell';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { SwipeableHabitItem } from '@/features/habits/components/SwipeableHabitItem';
import { TourTarget } from '@/shared/components/TourContext';
import { HelpTourModal } from '@/features/onboarding/components/HelpTourModal';
import { useDemoGate, useTourGate } from '@/features/onboarding/utils/firstRun';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { swallow } from '@/shared/utils/swallow';
import { playSoundEffect } from '@/shared/utils/soundEffects';
import { haptic } from '@/shared/utils/haptics';
import { completeTask } from '@/features/tasks/utils/taskActions';
import { NewHabitForm } from '@/features/habits/components/NewHabitForm';
import { suggestHabitIcon } from '@/features/habits/utils/habitIcon';
import { localeOf } from '@/shared/utils/lang';
import { upperFor } from '@/shared/utils/localeCase';
import { SubtaskProgressRing } from '@/shared/components/SubtaskProgressRing';

// Alışkanlık odaklı kalmalı — mantıklı üst sınır (plan + manuel toplam).
const MAX_HABITS = 15;

/**
 * Alışkanlık simgeleri — 16'dan 28'e çıkarıldı ve HEPSİ FARKLI glif.
 *
 * İki sorun vardı:
 *  1. 🏃 ve 🧘 ikisi de `Activity` (kalp-atışı çizgisi) ikonuna eşleniyordu —
 *     ekranda aynı simge iki kez görünüyordu (bkz. modeIcons.tsx).
 *  2. Set yalnız 16 öğeydi ve tek satır yatay kaydırmada duruyordu; kullanıcı
 *     çoğunu hiç görmüyordu.
 *
 * Sıra rastgele değil, KATEGORİ akışına göre: hareket → sağlık → zihin →
 * üretim/yaratım → yaşam → sosyal/hedef. Böylece aradığın simgeyi taramadan bulursun.
 */
const HABIT_EMOJIS = [
  // hareket
  '💪', '🏃', '🚴', '🧘',
  // sağlık
  '💧', '😴', '🥗', '💊',
  // zihin / öğrenme
  '📚', '🧠', '✍️', '🗣️',
  // üretim / yaratım
  '💻', '🎨', '🎵', '📷',
  // yaşam
  '🌿', '🌅', '☕', '🧹',
  // para / sosyal
  '💰', '👥', '🙏', '🚭',
  // hedef / tempo
  '🎯', '🏆', '⏱️', '⚡',
];

function getWeekDays(startDay: 0 | 1 = 1): Date[] {
  const today = new Date();
  const day = today.getDay();
  const diff = (day - startDay + 7) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - diff);
  /*
    ÖĞLEN, gece yarısı DEĞİL. Günler `fmtDateKey` ile anahtarlanıyor ve o, gece
    kuşları için 3 saat geri alıyor: 00:00 → önceki günün 21:00'i. Şerit bu yüzden
    BİR GÜN KAYIKTI — Pazar sütunu "bugün" sanılıyor, her günün noktası bir önceki
    günün görevlerini gösteriyordu. Öğlen ±3 saatten etkilenmez (bkz. dateKey notları).
  */
  weekStart.setHours(12, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

function getLast28Days(): Date[] {
  return Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    return d;
  });
}

const DAY_LABELS_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];
const DAY_LABELS_EN_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LABELS_EN_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Bu turda eklenen metinler — iki dil YAN YANA.
 * Satır içi `tr ? '...' : '...'` dallanması iki dalı elle senkron tutmayı gerektiriyor
 * ve pratikte ayrışıyor (bkz. i18nRatchet).
 */
const DAY_COPY = {
  tr: {
    hint: 'İşaretlemek için ✓ · Seçenekler için satıra dokun',
    markingFor: (day: string) => `${day.toLocaleLowerCase('tr')} için işaretliyorsun`,
    futureBlocked: 'Gelecek bir gün işaretlenemez',
    markToday: 'Bugün tamamlandı olarak işaretle',
    markDay: (day: string) => `${day} için işaretle`,
    backToToday: 'Bugüne dön',
    today: 'Bugün',
    menuTitle: (day: string) => `${day} için ne yapmak istersin?`,
    skip: (day: string) => `${day} Pas Geç (Mola)`,
    undoSkip: 'Pas Geçmeyi Geri Al',
    done: 'tamamlandı',
    complete: 'Tamamla',
    openInTasks: 'Görevler ekranında açar',
    addTask: 'Görev Ekle',
    addTaskFor: (day: string) => `${day} için görev ekle`,
    tapPastDays: '← Geçmiş günlere dokun',
    dayCell: (day: string, done: number, total: number) => total > 0 ? `${day}, ${total} görevden ${done} tamamlandı` : `${day}, görev yok`,
  },
  en: {
    hint: 'Tap ✓ to mark · Tap the row for options',
    markingFor: (day: string) => `Marking for ${day.toLowerCase()}`,
    futureBlocked: 'You cannot check a future day',
    markToday: 'Mark done today',
    markDay: (day: string) => `Mark for ${day}`,
    backToToday: 'Back to today',
    today: 'Today',
    menuTitle: (day: string) => `What do you want to do for ${day.toLowerCase()}?`,
    skip: (day: string) => `Skip ${day} (Break)`,
    undoSkip: 'Undo Skip',
    done: 'done',
    complete: 'Complete',
    openInTasks: 'Opens in Tasks',
    addTask: 'Add Task',
    addTaskFor: (day: string) => `Add a task for ${day}`,
    tapPastDays: '← Tap past days',
    dayCell: (day: string, done: number, total: number) => total > 0 ? `${day}, ${done} of ${total} tasks done` : `${day}, no tasks`,
  },
};

export default function CockpitScreen() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  // Küçük ekranlarda boşlukları bir kademe sık → dikey kaydırma azalır.
  const isSmallScreen = screenWidth < 380 || screenHeight < 700;
  const compactPad = isSmallScreen ? S.sm : S.md;
  const { language } = useLanguageStore();
  // Arşivlenmişler hariç — merkez aktif hayatı gösterir (bkz. useActiveTasks).
  const rawTasks = useActiveTasks();
  const { habits: rawHabits, addHabit, removeHabit, toggleDate, toggleSkipDate, weeklyGoal, setWeeklyGoal, getStreak } = useHabitStore();
  const {
    seasonal,
    examPlanTaskIds, exam2PlanTaskIds, exam3PlanTaskIds,
    tezPlanTaskIds,
    mulakatPlanTaskIds, mulakat2PlanTaskIds, mulakat3PlanTaskIds,
    sporPlanTaskIds, spor2PlanTaskIds, spor3PlanTaskIds,
    ramazanPlanTaskIds, tasarrufPlanTaskIds, birakmaPlanTaskIds,
    examPlanHabitIds, exam2PlanHabitIds, exam3PlanHabitIds,
    tezPlanHabitIds,
    mulakatPlanHabitIds, mulakat2PlanHabitIds, mulakat3PlanHabitIds,
    sporPlanHabitIds, spor2PlanHabitIds, spor3PlanHabitIds,
    ramazanPlanHabitIds, tasarrufPlanHabitIds, birakmaPlanHabitIds,
    soundEffects,
    onboardingCompleted,
  } = usePrefsStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const { scrollY, onScroll } = useCollapsibleHeader();


  /* Örnek veri ve tur kapıları ORTAK kuraldan (bkz. features/onboarding/utils/firstRun). */
  // İlk ziyarette tur; boş hafta şeridini tur boyunca örnek veri doldurur (bkz. firstRun).
  const tourOn = useTourGate('cockpit');
  const demoGate = useDemoGate('cockpit', tourOn);

  const tasks = useMemo(() => {
    if (demoGate(rawTasks.length)) {
      return [
        {
          id: '88881',
          title: language === 'tr' ? 'Haftalık raporu tamamla' : 'Finish weekly report',
          isCompleted: true,
          dueDate: new Date().toISOString(),
          priority: 'High',
          tags: ['personal']
        },
        {
          id: '88882',
          title: language === 'tr' ? 'Kitap oku (20 sayfa)' : 'Read a book (20 pages)',
          isCompleted: false,
          dueDate: new Date().toISOString(),
          priority: 'Medium',
          tags: ['personal']
        }
      ] as any[];
    }
    return rawTasks;
  }, [rawTasks, demoGate, language]);

  const habits = useMemo(() => {
    if (demoGate(rawHabits.length)) {
      return [
        {
          id: 'mock-habit-1',
          name: language === 'tr' ? 'Su İç' : 'Drink Water',
          emoji: '🥛',
          completedDates: [fmtDateKey(new Date())],
          skippedDates: [],
          color: '#10B981'
        },
        {
          id: 'mock-habit-2',
          name: language === 'tr' ? 'Kitap Oku' : 'Read Book',
          emoji: '📚',
          completedDates: [],
          skippedDates: [],
          color: '#6366F1'
        }
      ] as any[];
    }
    return rawHabits;
  }, [rawHabits, demoGate, language]);

  const hasActiveSeasonalMode = seasonal.ramazan || seasonal.examMode || seasonal.tezMode || seasonal.mulakatMode || seasonal.sporMode;

  /*
    TASARRUF VE BIRAKMA EKSİKTİ — ikisi de gerçek plan görevi üretir (haftalık
    "birikimini gir", günlük destek görevleri). Kümede yoklarsa bu görevler
    aşağıdaki `tasks` filtresinden (satır ~360) geçemiyor ve genel listede
    mod bölümüyle ÇİFT görünüyordu.
  */
  const planTaskIdSet = useMemo(() => new Set([
    ...examPlanTaskIds, ...exam2PlanTaskIds, ...exam3PlanTaskIds,
    ...tezPlanTaskIds,
    ...mulakatPlanTaskIds, ...mulakat2PlanTaskIds, ...mulakat3PlanTaskIds,
    ...sporPlanTaskIds, ...spor2PlanTaskIds, ...spor3PlanTaskIds,
    ...ramazanPlanTaskIds, ...tasarrufPlanTaskIds, ...birakmaPlanTaskIds,
  ]), [
    examPlanTaskIds, exam2PlanTaskIds, exam3PlanTaskIds,
    tezPlanTaskIds,
    mulakatPlanTaskIds, mulakat2PlanTaskIds, mulakat3PlanTaskIds,
    sporPlanTaskIds, spor2PlanTaskIds, spor3PlanTaskIds,
    ramazanPlanTaskIds, tasarrufPlanTaskIds, birakmaPlanTaskIds,
  ]);

  const planHabitIdSet = useMemo(() => new Set([
    ...examPlanHabitIds, ...exam2PlanHabitIds, ...exam3PlanHabitIds,
    ...tezPlanHabitIds,
    ...mulakatPlanHabitIds, ...mulakat2PlanHabitIds, ...mulakat3PlanHabitIds,
    ...sporPlanHabitIds, ...spor2PlanHabitIds, ...spor3PlanHabitIds,
    ...ramazanPlanHabitIds, ...tasarrufPlanHabitIds, ...birakmaPlanHabitIds,
  ]), [
    examPlanHabitIds, exam2PlanHabitIds, exam3PlanHabitIds,
    tezPlanHabitIds,
    mulakatPlanHabitIds, mulakat2PlanHabitIds, mulakat3PlanHabitIds,
    sporPlanHabitIds, spor2PlanHabitIds, spor3PlanHabitIds,
    ramazanPlanHabitIds, tasarrufPlanHabitIds, birakmaPlanHabitIds,
  ]);

  const todayKey = fmtDateKey();
  const tr = language === 'tr';
  const weekStart: 0 | 1 = tr ? 1 : 0;
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const last28 = useMemo(() => getLast28Days(), []);

  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [addVisible, setAddVisible] = useState(false);
  const [showDayHint, setShowDayHint] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  useUiDepth(addVisible || planVisible);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('💪');
  // Simge addan tahmin edilir ("Su iç" → 💧) — kullanıcı elle seçtiği an tahmin susar ve seçimi kalır.
  const emojiPickedRef = useRef(false);
  const handleNewName = (v: string) => {
    setNewName(v);
    if (!emojiPickedRef.current) setNewEmoji(suggestHabitIcon(v, tr ? 'tr' : 'en') ?? '💪');
  };
  const handlePickEmoji = (e: string) => {
    emojiPickedRef.current = true;
    setNewEmoji(e);
  };
  const habitColors = [
    theme.primary,
    theme.secondary,
    theme.tertiary,
    theme.warning,
    theme.error,
    theme.info,
    theme.streak,
    isDark ? '#E2E8F0' : '#475569',
  ];
  const [newColor, setNewColor] = useState(() => theme.primary);
  /*
    HAFTANIN SAYILARI ORTAK MOTORDAN (bkz. features/report/weeklyReport.ts).

    Burada üç sayı ayrı ayrı hesaplanıyordu ve Geri Bakış ekranı aynı haftayı BAŞKA
    türlü hesaplıyordu: bu ekran yalnız kişisel görevleri ve "alışkanlık × 7" paydasını,
    öteki ekran sunucunun UTC kırılımını ve vade gününü kullanıyordu. Aynı hafta için
    iki farklı sayı gören kullanıcı hangisine güveneceğini bilemez.
  */
  const focusSessions = useFocusHistoryStore(s => s.sessions);
  const refreshFocusHistory = useFocusHistoryStore(s => s.refresh);
  const [planGoal, setPlanGoal] = useState('');
  const nameInputRef = useRef<any>(null);
  /*
    SATIR ANİMASYONLARI SAYFA DURUMU DEĞİL (2026-10-25, cihazda ölçüldü).
    İşaretleme önce sayfa durumuna (completingHabitIds) yazılıyordu: tek bir satır için 1700
    satırlık sayfanın tamamı baştan çiziliyordu — yavaş telefonda dokunuştan ilk görsel
    değişikliğe 1,4 sn, kayda 9 sn (JS iki kez ~1,3 sn kilitleniyordu). Artık her satırın
    kalıcı Animated.Value'ları var: dokunuşta halka YEREL animasyonla anında dolar, satır solar;
    sayfa yalnız bir kez, kayıtta çizilir.
  */
  const habitAnims = useRef(new Map<string, { opacity: Animated.Value; translateY: Animated.Value; fill: Animated.Value }>());
  const animFor = (id: string) => {
    let a = habitAnims.current.get(id);
    if (!a) { a = { opacity: new Animated.Value(1), translateY: new Animated.Value(0), fill: new Animated.Value(0) }; habitAnims.current.set(id, a); }
    return a;
  };

  const { panResponder: addPan, animatedStyle: addSlide, prepare: prepareAdd, slideIn: addSlideIn } = useSwipeToDismiss({
    onDismiss: () => setAddVisible(false),
  });
  const { panResponder: planPan, animatedStyle: planSlide, prepare: preparePlan, slideIn: planSlideIn } = useSwipeToDismiss({
    onDismiss: () => setPlanVisible(false),
  });

  useFocusEffect(useCallback(() => { void refreshFocusHistory(); }, [refreshFocusHistory]));

  useFocusEffect(useCallback(() => {
    setSelectedDay(fmtDateKey());
  }, []));

  useEffect(() => {
    AsyncStorage.getItem('tazq-day-hint-shown').then(val => {
      if (!val) {
        setShowDayHint(true);
        setTimeout(() => setShowDayHint(false), 4000);
        AsyncStorage.setItem('tazq-day-hint-shown', 'true').catch((e) => swallow('cockpit.persistDayHintFlag', e));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('tazq-seen-swipe-hint').then(val => {
      if (!val) {
        const timer = setTimeout(() => {
          setShowSwipeHint(true);
          AsyncStorage.setItem('tazq-seen-swipe-hint', 'true').catch((e) => swallow('cockpit.persistSwipeHintFlag', e));
        }, 1200);
        return () => clearTimeout(timer);
      }
    }).catch(() => {});
  }, []);

  // Reset add-habit form when sheet closes
  useEffect(() => {
    if (!addVisible) {
      setNewName('');
      setNewEmoji('💪');
      emojiPickedRef.current = false;
      setNewColor(habitColors[0]); // paletin ilki — eski sabit liste (#6366F1) palette yoktu, seçim görünmüyordu
    }
  }, [addVisible]);

  const dayLabels = tr ? DAY_LABELS_TR : (weekStart === 0 ? DAY_LABELS_EN_SUN : DAY_LABELS_EN_MON);

  // Personal tasks only — plan tasks are managed in modlar, not here
  const personalTasks = useMemo(
    () => tasks.filter((t) => !planTaskIdSet.has(t.id)),
    [tasks, planTaskIdSet]
  );

  /*
    ŞERİT VERİSİ — gün noktası GÖREVİ DE ALIŞKANLIĞI DA sayar.

    Nokta yalnız görevlere bakıyordu: yalnız alışkanlık takip eden kullanıcının haftası
    şeritte bomboş görünüyordu — üstelik ekranın yarısı alışkanlıklar. "Haftam nasıl
    geçti" sorusunun cevabı, insanın ilk baktığı yerde yoktu.
  */
  const weekData = useMemo(() => {
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    return weekDays.map((d) => {
      const key = fmtDateKey(d);
      const dayTasks = personalTasks.filter(
        (t) => calendarDayOf(t.dueDate) === key
      );
      const isPast = d < todayMidnight;
      const isFuture = key > todayKey;
      const habitsDone = habits.filter((h) => (h.completedDates ?? []).includes(key)).length;
      // Gelecek günde alışkanlık BEKLENMEZ; kurulmadan önceki günlerde de beklenmez.
      const habitsExpected = isFuture ? 0 : habits.filter((h) => !h.createdAt || fmtDateKey(new Date(h.createdAt)) <= key).length;
      const taskTotal = dayTasks.length;
      const taskDone = dayTasks.filter((t) => t.isCompleted).length;
      return {
        date: d,
        key,
        isToday: key === todayKey,
        isPast,
        total: taskTotal + habitsExpected,
        completed: taskDone + habitsDone,
      };
    });
  }, [personalTasks, habits, weekDays, todayKey]);
  const weekHasTasks = weekData.some(d => d.total > 0);

  /*
    SEÇİLİ GÜN ARTIK ALIŞKANLIKLARI DA KAPSIYOR.

    Ekranın ana jesti gün seçmek; ama alışkanlıklar hep BUGÜNE yazılıyordu. Kullanıcı
    çarşambaya dokunuyor, görevler değişiyor, alışkanlıklar bugünde kalıyordu — üstelik
    "dün yaptım, işaretlemeyi unuttum" hiçbir şekilde düzeltilemiyordu.
  */
  const isSelectedToday = selectedDay === todayKey;
  const isFutureDay = selectedDay > todayKey;
  const dc = DAY_COPY[language === 'en' ? 'en' : 'tr'];

  // Tasks for selected day
  const selectedDayTasks = useMemo(() =>
    personalTasks.filter((t) => calendarDayOf(t.dueDate) === selectedDay),
    [personalTasks, selectedDay]
  );


  /*
    Haftanın özeti ORTAK motordan. Eski hesap iki yerden ayrışıyordu:
      · yalnız kişisel görevleri sayıyordu (plan görevleri hiç görünmüyordu),
      · görevleri VADE gününe göre sayıyordu — dün vadeli işi bugün bitirince
        bu hafta sayılmayabiliyordu; tarihsiz görevler ise hiç sayılmıyordu.
  */
  const weekSummary = useMemo(
    () => summarizeWeek({ sessions: focusSessions, tasks, habits, range: weekRange(new Date()) }),
    [focusSessions, tasks, habits],
  );
  const thisWeekCompleted = weekSummary.totalTasks;

  // Haftalık Merkez artık TÜM alışkanlıkları gösterir (kişisel + mod). Önceden mod alışkanlıkları
  // (planHabitIdSet) hariç tutuluyordu → kullanıcı habitlerini burada göremeyip "boş" sanıyordu.
  // Kullanıcı tüm alışkanlıklarının haftalık ilerlemesini tek yerde görsün. (Silme mantığı plan
  // alışkanlıklarını zaten doğru temizliyor — setPlanIds ile.)
  const personalHabits = useMemo(
    () => habits.filter((h) => h && h.id),
    [habits]
  );

  /*
    Payda artık YAŞANMIŞ günler (bkz. habitDenominator): eskiden her zaman
    "alışkanlık × 7" idi, yani salı günü her şeyi yapan kullanıcı %29 görüyordu.
  */
  const habitsThisWeekPct = weekSummary.habitPct;

  const todayDow = new Date().getDay(); // 0 Sun … 6 Sat
  const showPlanButton = todayDow === 0 || todayDow >= 4;

  const handleAddHabit = () => {
    const name = newName.trim();
    if (!name) return;
    // Üst sınır — alışkanlık odaklı olmalı, sınırsız liste değil
    if (habits.length >= MAX_HABITS) {
      Alert.alert(
        tr ? 'Sınıra ulaşıldı' : 'Limit reached',
        tr ? `En fazla ${MAX_HABITS} alışkanlık takip edebilirsin. Odaklı kalmak için birini sil, sonra yenisini ekle.` : `You can track up to ${MAX_HABITS} habits. Remove one to add another and stay focused.`
      );
      return;
    }
    // Aynı alışkanlık iki kez eklenmesin (büyük/küçük harf duyarsız)
    const dup = habits.some(h => h.name.trim().toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'));
    if (dup) {
      Alert.alert(
        tr ? 'Zaten ekli' : 'Already added',
        tr ? `"${name}" alışkanlığı zaten listende.` : `"${name}" is already in your list.`
      );
      return;
    }
    haptic.success();
    addHabit(name, newEmoji, newColor);
    setNewName('');
    setNewEmoji('💪');
    emojiPickedRef.current = false;
    setNewColor(habitColors[0]); // paletin ilki — eski sabit liste (#6366F1) palette yoktu, seçim görünmüyordu
    setAddVisible(false);
  };

  const handleToggleHabit = (id: string) => {
    const habit = habits.find(h => h.id === id);
    const doneToday = Array.isArray(habit?.completedDates) && habit!.completedDates.includes(selectedDay);

    // Gelecek bir gün işaretlenemez: yapılmamış bir şeyi "yapıldı" saymak veriyi bozar.
    if (isFutureDay) {
      // Titreşim yok: tost görünür bir yanıt veriyor.
      useToastStore.getState().show(dc.futureBlocked, 'info');
      return;
    }

    if (!doneToday) {
      haptic.success();
      const pendingHabits = habits.filter(h => h.id !== id && !h.completedDates?.includes(selectedDay));
      const allHabitsDone = pendingHabits.length === 0;

      if (soundEffects && !allHabitsDone) {
        playSoundEffect(require('../assets/sounds/habit.mp3'), {
          context: 'cockpit.habitDoneSound',
          volume: 0.18,
          reassertVolumeAfterMs: 150,
        });
      }

      if (allHabitsDone && isSelectedToday) {
        /*
          ── KUTLAMA ORTAK KAPIDAN ──────────────────────────────────────────────
          Konfeti burada DOĞRUDAN tetikleniyordu ve Sade mod kapısı yoktu: modu
          kapatan kullanıcı ritüellerini bitirince yine tam ekran kutlama alıyordu.

          Kutlama kararı tek yere toplanmıştı (celebrate) ama bu dosya o
          birleştirmenin dışında kalmış — BEŞİNCİ kopyaydı. Bekçi test yalnız ana
          ekranı taradığı için görmüyordu; kural artık konfetiye dokunan HER ekranı
          kapsıyor (bkz. __tests__/liteMode.test.ts).

          Puan (20) kapının DIŞINDA işlenmeye devam ediyor: mod bir görünüm
          tercihidir, geçmişi budamaz.
        */
        celebrate({
          kind: 'habits-cleared',
          isLite: usePrefsStore.getState().uiMode === 'lite',
          tr: language === 'tr',
        });
      }
      if (!isSelectedToday) {
        // Geçmiş gün düzeltmesi: sessizce işaretlenir, satır listede kalır.
        toggleDate(id, selectedDay);
        return;
      }

      const a = animFor(id);
      Animated.sequence([
        // Anında geri bildirim: halka dolar (sayfa çizimi beklenmez).
        Animated.timing(a.fill, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(a.opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.timing(a.translateY, { toValue: 36, duration: 260, useNativeDriver: true }),
        ]),
      ]).start(() => {
        toggleDate(id, selectedDay);
        // Değerler atılır: satır "tamamlananlara" taşındı; geri alınırsa taze değerlerle döner.
        habitAnims.current.delete(id);
      });
    } else {
      haptic.commit();
      toggleDate(id, selectedDay);
    }
  };

  const handleDeleteHabit = (id: string, name: string) => {
    Alert.alert(
      tr ? 'Alışkanlığı Sil' : 'Delete Habit',
      tr ? `"${name}" alışkanlığı silinsin mi?` : `Delete "${name}"?`,
      [
        { text: tr ? 'İptal' : 'Cancel', style: 'cancel' },
        {
          text: tr ? 'Sil' : 'Delete',
          style: 'destructive',
          onPress: () => {
            const ps = usePrefsStore.getState();
            const planSlots = [
              { mode: 'exam' as const, hIds: ps.examPlanHabitIds, tIds: ps.examPlanTaskIds },
              { mode: 'exam2' as const, hIds: ps.exam2PlanHabitIds, tIds: ps.exam2PlanTaskIds },
              { mode: 'exam3' as const, hIds: ps.exam3PlanHabitIds, tIds: ps.exam3PlanTaskIds },
              { mode: 'tez' as const, hIds: ps.tezPlanHabitIds, tIds: ps.tezPlanTaskIds },
              { mode: 'mulakat' as const, hIds: ps.mulakatPlanHabitIds, tIds: ps.mulakatPlanTaskIds },
              { mode: 'mulakat2' as const, hIds: ps.mulakat2PlanHabitIds, tIds: ps.mulakat2PlanTaskIds },
              { mode: 'mulakat3' as const, hIds: ps.mulakat3PlanHabitIds, tIds: ps.mulakat3PlanTaskIds },
              { mode: 'spor' as const, hIds: ps.sporPlanHabitIds, tIds: ps.sporPlanTaskIds },
              { mode: 'spor2' as const, hIds: ps.spor2PlanHabitIds, tIds: ps.spor2PlanTaskIds },
              { mode: 'spor3' as const, hIds: ps.spor3PlanHabitIds, tIds: ps.spor3PlanTaskIds },
              { mode: 'ramazan' as const, hIds: ps.ramazanPlanHabitIds, tIds: ps.ramazanPlanTaskIds },
            ];
            for (const { mode, hIds, tIds } of planSlots) {
              if (hIds.includes(id)) ps.setPlanIds(mode, hIds.filter(hid => hid !== id), tIds);
            }
            removeHabit(id);
          },
        },
      ]
    );
  };

  const handleLongPressHabit = (id: string, name: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const safeSkipped = Array.isArray(habit.skippedDates) ? habit.skippedDates : [];
    // Menü SEÇİLİ güne işler: kullanıcı hangi güne bakıyorsa onu düzeltir.
    const isSkipped = safeSkipped.includes(selectedDay);
    const dayWord = isSelectedToday ? dc.today : selectedDayLabel;
    haptic.commit();
    Alert.alert(
      name,
      dc.menuTitle(dayWord),
      [
        {
          text: isSkipped ? dc.undoSkip : dc.skip(dayWord),
          onPress: () => {
            toggleSkipDate(id, selectedDay);
            haptic.success();
          }
        },
        {
          text: tr ? 'Alışkanlığı Sil' : 'Delete Habit',
          style: 'destructive',
          onPress: () => handleDeleteHabit(id, name)
        },
        { text: tr ? 'İptal' : 'Cancel', style: 'cancel' }
      ]
    );
  };

  const weeklyFocusMin = weekSummary.totalFocusMin;
  const focusHrs = Math.floor(weeklyFocusMin / 60);
  const focusMins = weeklyFocusMin % 60;
  const focusLabel = weeklyFocusMin >= 60
    ? `${focusHrs}${tr ? 'sa' : 'h'}${focusMins > 0 ? `${focusMins}${tr ? 'dk' : 'm'}` : ''}`
    : `${weeklyFocusMin} ${tr ? 'dk' : 'min'}`;

  const selectedDayObj = weekData.find((d) => d.key === selectedDay);
  const selectedDayLabel = selectedDayObj?.isToday
    ? (tr ? 'BUGÜN' : 'TODAY')
    : selectedDayObj?.date.toLocaleDateString(tr ? 'tr-TR' : 'en-US', {
        weekday: 'long', day: 'numeric',
      }) ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />

        {/*
          BAŞLIK = ZAMAN ÖLÇEĞİ: sol GÜNE yakınlaşır, orta BU HAFTA, sağ GEÇMİŞ haftalar.

          Eskiden sağdaki düğme alışkanlık ekliyordu; aynı iş ekranın İÇİNDE iki yerde
          daha duruyordu (boş durum kartı ve alışkanlıklar bölümünün altındaki düğme),
          görev ekleme de seçili günün başlığında. Yani çubuktaki düğme yeni bir şey
          sunmuyor, yalnız tekrar ediyordu.

          Sağ: GERİ BAKIŞ (/report). İkon soldan sağa taşındı; sol yuva geri tuşunun
          yeridir, oraya konan bir eylem "geri dön" gibi okunuyordu.

          Sol: BUGÜN ekranı (/gun) — günün saat ekseni ve "günü kapat" ritüeli. Adı
          "Bugün" olduğu için hep bugünü açması dürüst: bu bir DESTİNASYON, ekran içindeki
          gün seçimiyle ilgisi yok (seçimi bugüne almak şeritteki "Bugün" etiketinin işi).
          O ekran alt menüde yok; yalnız Görevler'deki tek bir düğmeden ya da sabah/akşam
          bildiriminden gidilebiliyordu, yani pratikte gizliydi.

          Başlık böylece iki KALICI hedef taşıyor: solda gün, sağda geçmiş haftalar.
        */}
        <ScreenHeader
          left={
            <Touchable
              onPress={() => router.push('/gun')}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel={dc.today}
            >
              <ChromeShell />
              <Sunrise size={ICON.md} color={theme.onSurface} />
            </Touchable>
          }
          title={tr ? 'Haftalık Merkez' : 'Weekly Hub'}
          subtitle={`${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${upperFor(weekDays[6].toLocaleString(tr ? 'tr-TR' : 'en-US', { month: 'short' }), tr)}`}
          scrollY={scrollY}
          right={
            <Touchable
              onPress={() => router.push('/report')}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel={tr ? 'Haftalık geri bakış' : 'Weekly review'}
            >
              <ChromeShell />
              <BarChart3 size={ICON.md} color={theme.onSurface} />
            </Touchable>
          }
        />

      <View style={{ flex: 1 }}>
        <Animated.ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.lg, paddingHorizontal: S.lg, paddingBottom: navBarSpace(insets.bottom) + S.md, width: '100%', maxWidth: contentMaxWidth(screenWidth), alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >

          {/* ── WEEK STRIP ── */}
          {/* Kenar boşluğu HEDEFİN dışında: kartın marginBottom'u ölçüme girip vurgu alanını
              kartın 16 dp altına taşırıyordu (cihazda görüldü). Üç tur hedefinde de aynı kural. */}
          <TourTarget id="weekStrip" spotRadius={R.md} style={{ marginBottom: S.md }}>
          <BentoCard index={0} style={{ padding: compactPad }}>
            {/* Kartın "BU HAFTA" etiketi kaldırıldı: hemen aşağıdaki bölüm de "BU HAFTA" diyordu ve
                başlık çubuğu zaten "19 – 25 EKİ". Satır yalnız "Bugün"e dön / ipucu için duruyor. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minHeight: isSelectedToday && !showDayHint ? 0 : undefined }}>
              {/*
                BUGÜNE DÖN — gün seçiminin YAPILDIĞI yerde ve yalnız gerektiğinde.
                Bu düğme önce başlık çubuğundaydı; bugün seçiliyken işlevi olmadığı için
                soluk duruyordu ve ekrana her girişte seçim bugüne döndüğü için pratikte
                HEP soluk görünüyordu — yani "bozuk düğme" gibi. Kalıcı bir yuvada
                çoğu zaman işlevsiz duran bir düğme, olmayan düğmeden kötüdür.
              */}
              {!isSelectedToday && (
                <Touchable
                  onPress={() => { haptic.select(); setSelectedDay(todayKey); }}
                  accessibilityRole="button"
                  accessibilityLabel={dc.backToToday}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: theme.primary + '18', paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.sm }}
                >
                  <CalendarCheck size={ICON.xs} color={theme.primary} />
                  <Text style={{ fontSize: F.caption, color: theme.primary, fontWeight: '700' }}>{dc.today}</Text>
                </Touchable>
              )}
              <AnimatePresence>
                {showDayHint && isSelectedToday && (
                  <MotiView
                    key="day-hint"
                    from={{ opacity: 0, translateX: 8 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    exit={{ opacity: 0, translateX: 8 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: theme.primary + '15', paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.sm }}
                  >
                    <Text style={{ fontSize: F.caption, color: theme.primary, fontWeight: '600' }}>
                      {dc.tapPastDays}
                    </Text>
                  </MotiView>
                )}
              </AnimatePresence>
            </View>
            <View style={styles.weekRow}>
              {weekData.map((day, i) => {
                const isSelected = day.key === selectedDay;
                const allDone = day.total > 0 && day.completed === day.total;
                const hasTasks = day.total > 0;
                return (
                  <Touchable
                    key={day.key}
                    onPress={() => {
                      setSelectedDay(day.key);
                      haptic.select();
                    }}
                    // Gün kutuları ekran okuyucuda adsız ve rolsüzdü; seçili olan da söylenmiyordu.
                    accessibilityRole="button"
                    accessibilityLabel={dc.dayCell(day.date.toLocaleDateString(localeOf(language), { weekday: 'long', day: 'numeric', month: 'long' }), day.completed, day.total)}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: day.isToday
                          ? theme.primary + '18'
                          : isSelected
                          ? isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                          : 'transparent',
                        borderColor: isSelected ? theme.primary + '70' : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[
                      styles.dayAbbr,
                      {
                        color: day.isToday ? theme.primary : theme.onSurfaceVariant,
                        opacity: day.isPast && !day.isToday ? 0.4 : 1,
                      },
                    ]}>
                      {dayLabels[i]}
                    </Text>
                    <View style={[
                      styles.dayCircle,
                      { backgroundColor: day.isToday ? theme.primary : 'transparent', opacity: day.isPast && !day.isToday ? 0.45 : 1 },
                    ]}>
                      <Text style={[
                        styles.dayNum,
                        { color: day.isToday ? theme.onPrimary : theme.onSurface },
                      ]}>
                        {day.date.getDate()}
                      </Text>
                    </View>
                    {/*
                      GÜNÜN HALKASI (Apple Activity — can-it-be-done/AppleActivity): nokta yalnız
                      "iş var" diyordu; halka "ne kadarı bitti" diyor. Hafta tek bakışta okunur.
                      Tamamlanan gün yeşil kapanır; işi olmayan gün boş kalır.
                    */}
                    {/* Haftada hiç iş yoksa halka satırı ÇİZİLMEZ: boş yuva şeridin altında
                        ~32 dp'lik boşluk bırakıp üst/alt dolguyu asimetrik yapıyordu (cihazda görüldü). */}
                    {weekHasTasks && (
                    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center', opacity: day.isPast && !day.isToday && !allDone ? 0.55 : 1 }}>
                      {hasTasks && (
                        <SubtaskProgressRing
                          total={day.total}
                          completed={day.completed}
                          size={16}
                          strokeWidth={3}
                          activeColor={allDone ? theme.success : theme.primary}
                          inactiveColor={theme.onSurfaceVariant}
                        />
                      )}
                    </View>
                    )}
                  </Touchable>
                );
              })}
            </View>
          </BentoCard>
          </TourTarget>

          {/*
            ── GENİŞ EKRANDA İKİ SÜTUN ────────────────────────────────────────────
            Hafta şeridi bölünmenin ÜSTÜNDE kalıyor: yedi gün yan yana durmak zorunda,
            yarım sütuna sıkışırsa gün kutuları okunmaz olur. Altında iş bölümü net —
            solda GÜN (seçili günün işleri ve haftalık karne), sağda SÜREKLİLİK
            (alışkanlıklar). Telefonda bu ayrım hiç devreye girmiyor.
          */}
          <WideSplit>

          <WideCol>
          {/* ── SELECTED DAY TASKS ── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {upperFor(selectedDayLabel, tr)}
            </Text>
            <Touchable
              onPress={() => {
                router.push({ pathname: '/tasks', params: { action: 'add', dateFilter: selectedDay } });
              }}
              accessibilityRole="button"
              accessibilityLabel={dc.addTaskFor(selectedDayLabel)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: theme.primary + '18', paddingHorizontal: S.smd, paddingVertical: S.sm, borderRadius: R.full }}
            >
              <Plus size={ICON.xs} color={theme.primary} strokeWidth={2.5} />
              <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.primary }}>
                {dc.addTask}
              </Text>
            </Touchable>
          </View>

          {/* Vurgu YALNIZ kart: başlık ve "Görev Ekle" aydınlatılan alanın kenarına yapışıyordu. */}
          <TourTarget id="dailySection" spotRadius={R.md} style={{ marginBottom: S.lg }}>
          <AnimatePresence>
            {selectedDayTasks.length === 0 ? (
              <MotiView
                key={`empty-${selectedDay}`}
                from={{ opacity: 0, translateY: -4 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 250 }}
                style={[
                  styles.dayTasksCard,
                  {
                    backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
                    borderColor: theme.outline,
                    paddingVertical: S.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={{ fontSize: F.body, fontWeight: '500', color: theme.onSurfaceMuted }}>
                  {tr ? 'Planlanmış görev yok' : 'No tasks planned'}
                </Text>
              </MotiView>
            ) : (
              <MotiView
                key={selectedDay}
                from={{ opacity: 0, translateY: -6 }}
                animate={{ opacity: 1, translateY: 0 }}
                /* ÇIKIŞ ANİMASYONU YOK (cihazda görüldü): tur bitince örnek liste kalkarken
                   çıkış animasyonu tamamlanmıyor, görünmez kart ~105 dp yer kaplamaya devam
                   ediyordu. Gün değişiminde giriş yeter; çıkan liste anında gider. */
                transition={{ type: 'spring', damping: 22 }}
                style={[
                  styles.dayTasksCard,
                  {
                    backgroundColor: isDark
                      ? theme.surfaceContainerHigh
                      : theme.surfaceContainerLowest,
                    borderColor: theme.outline,
                  },
                ]}
              >
                {selectedDayTasks.slice(0, 5).map((task, idx) => (
                  <Touchable
                    key={task.id}
                    onPress={() => {
                      router.push({ pathname: '/tasks', params: { highlightId: String(task.id) } });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={task.isCompleted ? `${getLocalizedTaskTitle(task, tr)}, ${dc.done}` : getLocalizedTaskTitle(task, tr)}
                    accessibilityHint={dc.openInTasks}
                    activeOpacity={0.7}
                    style={[
                      styles.dayTaskRow,
                      {
                        borderTopColor: theme.separator,
                        borderTopWidth: idx === 0 ? 0 : HAIRLINE,
                      },
                    ]}
                  >
                    {/*
                      Halka öncelik rengini TAŞIR — Aksiyon Merkezi, ana ekran ve Günüm ile
                      aynı dil. Eskiden halka gri, öncelik sağda ayrı bir noktaydı: aynı
                      satırda iki işaret, biri anlamsız.
                    */}
                    {/*
                      HALKA GERÇEKTEN TAMAMLAR (2026-10-25). Onay kutusu gibi görünüp satırla
                      aynı şeyi yapıyordu (Görevler'e git) — ekran okuyucu da satırı hem
                      "düğme" hem "işaretli" diye okuyordu. Artık Günüm ve ana ekranla aynı:
                      halkaya dokun = tamamla (ortak taskActions.completeTask), satıra dokun = aç.
                      Tamamlanmış iş burada geri alınmaz (Günüm kuralı); geri alma Görevler'de.
                    */}
                    {task.isCompleted ? (
                      <View style={[styles.miniCheck, { borderColor: theme.success, backgroundColor: theme.success }]}>
                        <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />
                      </View>
                    ) : (
                      <Touchable
                        onPress={() => { haptic.success(); void completeTask(task.id); }}
                        hitSlop={touchSlop(22)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: false }}
                        accessibilityLabel={`${getLocalizedTaskTitle(task, tr)} — ${dc.complete}`}
                        style={[
                          styles.miniCheck,
                          {
                            borderColor: task.priority === 'High' ? theme.priorityHigh
                              : task.priority === 'Medium' ? theme.priorityMedium
                              : theme.priorityLow,
                          },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.dayTaskText,
                        {
                          color: task.isCompleted ? theme.onSurfaceVariant : theme.onSurface,
                          textDecorationLine: task.isCompleted ? 'line-through' : 'none',
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {getLocalizedTaskTitle(task, tr)}
                    </Text>
                  </Touchable>
                ))}
                {selectedDayTasks.length > 5 && (
                  <Touchable
                    onPress={() => router.push({
                      pathname: '/tasks',
                      params: selectedDay === todayKey
                        ? { filter: 'today' }
                        : { dateFilter: selectedDay },
                    })}
                    style={[styles.dayTaskRow, { borderTopColor: theme.separator, borderTopWidth: HAIRLINE, justifyContent: 'center' }]}
                  >
                    <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.primary }}>
                      +{selectedDayTasks.length - 5} {tr ? 'daha' : 'more'}
                    </Text>
                  </Touchable>
                )}
              </MotiView>
            )}
          </AnimatePresence>
          </TourTarget>
          </WideCol>

          {/*
            SIRA: haftanın özeti alışkanlıkların ÜSTÜNDE.

            "Bu Hafta" kartı telefonda en altta kalıyordu: dört-beş alışkanlığı olan
            kullanıcı ekranın adını taşıyan sayıları hiç görmeden çıkıyordu. Şerit →
            seçili gün → HAFTANIN ÖZETİ → alışkanlıklar sırası, ekranın vaadiyle
            okunma sırasını aynı hizaya getiriyor.
          */}
          <WideCol>
          {/* ── BU HAFTA ──────────────────────────────────────────────────────
              Ad değişti: bu ekran "şimdi"yi anlatır, geri bakış ayrı ekranda
              ("Haftalık Geri Bakış"). İkisi de "Haftalık Özet/Rapor" adını taşıyınca
              kullanıcı hangisine bakacağını bilemiyordu. */}
          <View style={[styles.sectionHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {tr ? 'BU HAFTA' : 'THIS WEEK'}
            </Text>
            <Touchable
              onPress={() => router.push('/report')}
              accessibilityRole="button"
              accessibilityLabel={tr ? 'Haftalık geri bakış' : 'Weekly review'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, paddingVertical: S.xs, paddingHorizontal: S.sm }}
            >
              <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '700' }}>
                {tr ? 'Geri bakış' : 'Review'}
              </Text>
              <ChevronRight size={ICON.xs} color={theme.primary} />
            </Touchable>
          </View>

          {/*
            BU HAFTA — TEK KART, KUTU İÇİNDE KUTU YOK (2026-10-25, kullanıcı: "çok çirkin").
            Eskiden kartın içinde üç gri istatistik kutusu ve altında dördüncü bir gri kutu
            vardı: dört ayrı zemin, hiçbiri hizalı değil. Tremor KPI satırı / Apple Fitness
            özeti: üç sütun aynı yüzeyde, aralarında saç teli; etiket üstte (ikon + ad),
            sayı altta ve nötr. "Planla" bir LİSTE SATIRI — kartın tam genişliğinde, ayırıcıyla.
          */}
          <TourTarget id="weeklyReview" spotRadius={R.md} style={{ marginBottom: S.lg }}>
          <BentoCard index={habits.length + 2} style={{ padding: 0, overflow: 'hidden' }}>
            <View style={styles.kpiRow}>
              {[
                { Icon: Check, color: theme.success, value: String(thisWeekCompleted), label: tr ? 'Tamamlandı' : 'Completed' },
                { Icon: Clock, color: theme.primary, value: focusLabel, label: tr ? 'Odak' : 'Focus' },
                { Icon: Flame, color: theme.streak, value: `${habitsThisWeekPct}%`, label: tr ? 'Alışkanlık' : 'Habits' },
              ].map((stat, i) => (
                <View
                  key={stat.label}
                  accessible
                  accessibilityLabel={`${stat.label}: ${stat.value}`}
                  style={[styles.kpiCol, i > 0 && { borderLeftWidth: HAIRLINE, borderLeftColor: theme.separator }]}
                >
                  <View style={styles.kpiLabelRow}>
                    <stat.Icon size={ICON.xs} color={stat.color} strokeWidth={2.6} />
                    {/* Tek satır: dar sütunda hece ortasından kırılmasın ("Tamamlan/dı", cihazda görüldü). */}
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.statLabel, { color: theme.onSurfaceMuted }]}>
                      {stat.label}
                    </Text>
                  </View>
                  {/* Sayı NÖTR (Tremor KPI): renk yalnız küçük ikonda. */}
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statValue, { color: theme.onSurface, fontVariant: ['tabular-nums'] }]}>
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* HEDEF + PLAN TEK SATIR — hedef metni ayrı bir "çip" değil, satırın alt yazısı. */}
            <Touchable
              onPress={() => {
                setPlanGoal(weeklyGoal);
                preparePlan();
                setPlanVisible(true);
                haptic.commit();
              }}
              accessibilityRole="button"
              style={[styles.planRow, { borderTopColor: theme.separator }]}
            >
              <Sparkles size={ICON.sm} color={theme.primary} />
              <View style={{ flex: 1, gap: S.xxs }}>
                <Text style={[styles.planBtnText, { color: theme.onSurface }]}>
                  {showPlanButton
                    ? (tr ? 'Gelecek Haftayı Planla' : 'Plan Next Week')
                    : (tr ? 'Haftalık Hedefi Güncelle' : 'Update Weekly Goal')}
                </Text>
                {!!weeklyGoal && (
                  <Text numberOfLines={2} style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>
                    {weeklyGoal}
                  </Text>
                )}
              </View>
              <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
            </Touchable>
          </BentoCard>
          </TourTarget>
          </WideCol>

          <WideCol col="right">
          {/* ── HABITS ── */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
                {tr ? 'ALIŞKANLIKLAR' : 'HABITS'}
              </Text>
              {/*
                İPUCU TEMEL JESTİ ANLATIR. Eskiden burada yalnız "mola için basılı tut"
                yazıyordu: ileri bir jest, temel olanı (işaretlemek) öğretmeden.
                Seçili gün bugün değilse ne yaptığın da burada yazar — yoksa kullanıcı
                başka bir günü işaretlediğini fark etmez.
              */}
              {/* Alışkanlık yokken jest ipucu ve "son 28 gün" anlamsız — işaretlenecek satır yok. */}
              {habits.length > 0 && (
              <Text style={{ fontSize: F.caption, color: isSelectedToday ? theme.onSurfaceMuted : theme.primary, marginTop: S.xxs }}>
                {isSelectedToday ? dc.hint : dc.markingFor(selectedDayLabel)}
              </Text>
              )}
            </View>
            {habits.length > 0 && (
            <Text style={[styles.sectionSub, { color: theme.onSurfaceVariant }]}>
              {tr ? 'Son 28 gün' : 'Last 28 days'}
            </Text>
            )}
          </View>

          {personalHabits.length === 0 ? (
            <BentoCard index={1} style={{ alignItems: 'center', paddingVertical: S.xl, marginBottom: S.md }}>
              <MotiView
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ loop: true, duration: 2800 }}
                style={{ marginBottom: S.md, opacity: 0.35 }}
              >
                <Flame size={ICON.xxl} color={theme.primary} />
              </MotiView>
              {(
                <>
                  <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>
                    {tr ? 'İlk alışkanlığını ekle' : 'Add your first habit'}
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>
                    {hasActiveSeasonalMode
                      ? (tr ? 'Manuel ekle veya ana ekrandan mod planını uygula.' : 'Add manually or apply your mode plan from Home.')
                      : (tr ? 'Küçük alışkanlıklar büyük dönüşümler yaratır.' : 'Small habits create big transformations.')}
                  </Text>
                  <Touchable
                    onPress={() => { prepareAdd(); setAddVisible(true); }}
                    style={[styles.emptyAddBtn, { backgroundColor: theme.primary }]}
                  >
                    <Plus size={ICON.sm} color={theme.onPrimary} />
                    <Text style={[styles.emptyAddText, { color: theme.onPrimary }]}>
                      {tr ? 'Alışkanlık Ekle' : 'Add Habit'}
                    </Text>
                  </Touchable>
                </>
              )}
            </BentoCard>
          ) : (
            <View style={{ gap: S.sm, marginBottom: S.md }}>
              {[...personalHabits]
                .filter((h) => {
                  /*
                    BUGÜN: yapılan alışkanlık listeden çıkar (ekran sadeleşir).
                    BAŞKA GÜN: hepsi kalır — kullanıcı o günü DÜZELTMEYE gelmiştir;
                    yaptığını görmeden yanlışı düzeltemez.
                  */
                  if (!isSelectedToday) return true;
                  const safeDates = Array.isArray(h.completedDates) ? h.completedDates : [];
                  return !safeDates.includes(selectedDay);
                })
                .sort((a, b) => getStreak(b) - getStreak(a))
                .map((habit, hIdx) => {
                const safeColor = habit.color ?? '#6366F1';
                const safeDates = Array.isArray(habit.completedDates) ? habit.completedDates : [];
                const safeSkipped = Array.isArray(habit.skippedDates) ? habit.skippedDates : [];
                const isSkipped = safeSkipped.includes(selectedDay);
                const streak = getStreak({ ...habit, completedDates: safeDates, skippedDates: safeSkipped });
                const doneToday = safeDates.includes(selectedDay);
                const anim = animFor(habit.id);
                return (
                  <Animated.View key={habit.id} style={{ opacity: anim.opacity, transform: [{ translateY: anim.translateY }] }}>
                    <SwipeableHabitItem
                      onDelete={() => handleDeleteHabit(habit.id, habit.name)}
                      onSkip={() => {
                        haptic.commit();
                        toggleSkipDate(habit.id, selectedDay);
                      }}
                      isSkipped={isSkipped}
                      showPeekHint={showSwipeHint && hIdx === 0}
                    >
                      {/* Sesli ad: durum + seri (ekranda bunları yalnız renk ve rozet söylüyor). */}
                      <Touchable
                        accessibilityRole="button"
                        accessibilityLabel={describeHabit({ doneToday, skipped: isSkipped, streak }, habit.name, language)}
                        accessibilityState={{ checked: doneToday }}
                        accessibilityHint={rowHint(language)}
                        /*
                          SATIRA DOKUNMAK ARTIK BİR ŞEY YAPIYOR. Eskiden yalnız uzun adı
                          açıyordu — çoğu satırda görünür hiçbir sonucu yoktu, yani
                          kullanıcı dokunuyor ve "bozuk mu?" diye düşünüyordu. Silme ise
                          yalnız basılı tutmada gizliydi. İkisi tek menüde birleşti.
                        */
                        onPress={() => handleLongPressHabit(habit.id, habit.name)}
                        onLongPress={() => handleLongPressHabit(habit.id, habit.name)}
                        activeOpacity={0.9}
                      >
                        <View style={[
                          styles.habitCard, 
                          { 
                            backgroundColor: isSkipped
                              ? (isDark ? '#141416' : '#F3F4F6')
                              : isDark ? '#1C1C22' : '#FFFFFF', 
                            borderColor: isSkipped
                              ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
                              : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            opacity: isSkipped ? 0.75 : 1
                          }, 
                          isSmallScreen && { padding: S.sm }
                        ]}>
                          <View style={styles.habitRow}>
                            {/* Emoji + name + streak */}
                            <View style={styles.habitLeft}>
                              <View style={[styles.habitIcon, { backgroundColor: isSkipped ? 'rgba(0,0,0,0.05)' : safeColor + '22' }]}>
                                {renderModeEmojiIcon(habit.emoji ?? '📌', 20, isSkipped ? '#71717a' : safeColor)}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text 
                                  style={[
                                    styles.habitName, 
                                    { 
                                      color: isSkipped ? theme.onSurfaceVariant : theme.onSurface,
                                      textDecorationLine: isSkipped ? 'line-through' : 'none'
                                    }
                                  ]} 
                                  numberOfLines={2}
                                >
                                  {habit.name}
                                </Text>
                                <View style={styles.streakRow}>
                                  <Flame
                                    size={11}
                                    color={isSkipped ? '#71717a' : streak > 0 ? theme.streak : theme.onSurfaceVariant}
                                  />
                                  <Text style={[
                                    styles.streakText,
                                    { color: isSkipped ? '#71717a' : streak > 0 ? theme.streak : theme.onSurfaceVariant },
                                  ]}>
                                    {streak} {tr ? 'gün' : 'days'}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {/* Heatmap 4×7 */}
                            <View style={styles.heatmapGrid}>
                              {Array.from({ length: 4 }, (_, row) => (
                                <View key={row} style={styles.heatmapRow}>
                                  {Array.from({ length: 7 }, (_, col) => {
                                    const d = last28[row * 7 + col];
                                    if (!d) return <View key={col} style={styles.heatCell} />;
                                    const k = fmtDateKey(d);
                                    const done = safeDates.includes(k);
                                    const skippedDate = safeSkipped.includes(k);
                                    // Halka SEÇİLİ günü işaretler (varsayılan: bugün).
                                    const isToday = k === selectedDay;
                                    return (
                                      <View
                                        key={k}
                                        style={[
                                          styles.heatCell,
                                          {
                                            backgroundColor: done
                                              ? safeColor
                                              : skippedDate
                                              ? '#d97706'
                                              : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                                            borderWidth: isToday ? 1.5 : 0,
                                            borderColor: skippedDate ? '#d97706' : safeColor,
                                          },
                                        ]}
                                      />
                                    );
                                  })}
                                </View>
                              ))}
                            </View>

                            {/* Check/Skip status button */}
                            {/*
                              Uzun basış (mola) BURADAN KALKTI: pas geçmenin zaten iki
                              yolu vardı (kaydırma ve satır menüsü). Aynı sonucu veren
                              üçüncü gizli jest, öğrenilecek şeyi çoğaltmaktan başka işe
                              yaramıyordu.
                            */}
                            <Touchable
                              onPress={() => handleToggleHabit(habit.id)}
                              style={[
                                styles.checkBtn,
                                {
                                  backgroundColor: doneToday 
                                    ? safeColor 
                                    : isSkipped 
                                    ? '#d97706' 
                                    : 'transparent',
                                  borderColor: doneToday
                                    ? safeColor
                                    : isSkipped
                                    ? '#d97706'
                                    : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                                },
                              ]}
                              accessibilityLabel={isSelectedToday ? dc.markToday : dc.markDay(selectedDayLabel)}
                            >
                              {/* Dokunuşta YEREL olarak dolan halka (bkz. habitAnims) — sayfa çizimini beklemez. */}
                              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.checkFill, { backgroundColor: safeColor, opacity: anim.fill }]}>
                                <Check size={ICON.sm} color="#fff" strokeWidth={3} />
                              </Animated.View>
                              <MotiView
                                animate={{ scale: (doneToday || isSkipped) ? 1 : 0.6, opacity: (doneToday || isSkipped) ? 1 : 0.45 }}
                                transition={{ type: 'spring', damping: 14 }}
                              >
                                {isSkipped ? (
                                  <Coffee
                                    size={14}
                                    color="#fff"
                                  />
                                ) : (
                                  <Check
                                    size={15}
                                    color={doneToday ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)')}
                                    strokeWidth={3}
                                  />
                                )}
                              </MotiView>
                            </Touchable>
                          </View>
                        </View>
                      </Touchable>
                    </SwipeableHabitItem>
                  </Animated.View>
                );
              })}

              <Touchable
                onPress={() => { prepareAdd(); setAddVisible(true); }}
                style={[styles.addHabitRow, { borderColor: theme.outline }]}
              >
                <Plus size={ICON.sm} color={theme.onSurfaceVariant} />
                <Text style={[styles.addHabitText, { color: theme.onSurfaceVariant }]}>
                  {tr ? 'Alışkanlık Ekle' : 'Add Habit'}
                </Text>
              </Touchable>

              {/* Tamamlananlar EN ALTTA (iOS Reminders gibi): bekleyenler üstte kalır, tamamlanan
                  aşağı kayıp buraya oturur → çıkış animasyonu (aşağı) mantıkla aynı yönde. */}
              {(() => {
                // Bugün dışında zaten hepsi yukarıdaki listede duruyor (düzeltilebilsin diye).
                if (!isSelectedToday) return null;
                const doneHabits = personalHabits.filter(h => {
                  const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
                  return dates.includes(selectedDay);
                });
                if (doneHabits.length === 0) return null;
                return (
                  <View style={{ gap: S.sm, marginTop: S.sm }}>
                    <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, letterSpacing: 1, paddingHorizontal: S.xs }}>
                      {tr ? `BUGÜN TAMAMLANDI · ${doneHabits.length}` : `DONE TODAY · ${doneHabits.length}`}
                    </Text>
                    {/*
                      TEK GRUPLU YÜZEY — her biri ayrı yeşil kart değil (Görevler/Ana sayfa ile aynı dil).
                      Üstü ÇİZİLMEZ: alışkanlık "iptal" değil "yapıldı"; Hatırlatıcılar da yalnız soldurur.
                      Bitti bilgisini sağdaki dolu yeşil halka verir (görev satırlarıyla aynı işaret).
                    */}
                    <View style={{ borderRadius: R.lg, overflow: 'hidden', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderWidth: isDark ? B.thin : 0, borderColor: theme.outline }}>
                    {doneHabits.map((habit, hi) => (
                      <View
                        key={habit.id}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: S.md }}
                      >
                        <Touchable
                          onPress={() => handleLongPressHabit(habit.id, habit.name)}
                          onLongPress={() => handleLongPressHabit(habit.id, habit.name)}
                          accessibilityRole="button"
                          accessibilityLabel={habit.name}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.md }}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: R.full, backgroundColor: (habit.color ?? theme.success) + '22', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
                            {renderModeEmojiIcon(habit.emoji ?? '📌', 16, habit.color ?? theme.success)}
                          </View>
                          <View style={{ flex: 1, paddingVertical: S.smd, borderBottomWidth: hi < doneHabits.length - 1 ? HAIRLINE : 0, borderBottomColor: theme.separator }}>
                            <Text style={{ fontSize: F.body, fontWeight: '500', color: theme.onSurfaceMuted }} numberOfLines={2}>
                              {habit.name}
                            </Text>
                          </View>
                        </Touchable>
                        <Touchable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: true }}
                          accessibilityLabel={tr ? `${habit.name} — tamamlandı, geri al` : `${habit.name} — done, undo`}
                          onPress={() => handleToggleHabit(habit.id)}
                          hitSlop={touchSlop(22)}
                          style={{ width: 22, height: 22, borderRadius: R.full, backgroundColor: theme.success, alignItems: 'center', justifyContent: 'center', marginHorizontal: S.md }}
                          activeOpacity={0.7}
                        >
                          <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />
                        </Touchable>
                      </View>
                    ))}
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          </WideCol>

          </WideSplit>
        </Animated.ScrollView>
      </View>

      {/* ══ ADD HABIT SHEET ══ */}
      <Modal
        visible={addVisible}
        transparent
        animationType="none"
        onRequestClose={() => setAddVisible(false)}
        onShow={() => addSlideIn()}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Touchable style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddVisible(false)} accessibilityRole="button" accessibilityLabel={tr ? 'Kapat' : 'Close'} />
          <Animated.View
            style={[
              styles.sheet,
              addSlide,
              {
                paddingBottom: Math.max(insets.bottom, S.xl),
                // flexShrink: klavye açılınca KeyboardAvoidingView'ın iç alanı daralır;
                // sheet küçülebilmezse taşar. maxHeight yalnız ÜST sınır.
                flexShrink: 1,
                maxHeight: sheetMaxHeight(screenHeight, insets.top),
              },
            ]}
          >
            <GlassSurface corners="top" />
            <View
              {...addPan.panHandlers}
              style={styles.handleArea}
            >
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            </View>
            {/* Yeni Hedef formuyla aynı dil — bkz. NewHabitForm (ölçülen simetrik ızgara, kesilmeyen renkler). */}
            <NewHabitForm
              name={newName}
              onNameChange={handleNewName}
              emoji={newEmoji}
              onEmojiChange={handlePickEmoji}
              color={newColor}
              onColorChange={setNewColor}
              emojis={HABIT_EMOJIS}
              colors={habitColors}
              onAdd={handleAddHabit}
              onClose={() => setAddVisible(false)}
              theme={theme}
              isDark={isDark}
              tr={tr}
              inputRef={nameInputRef}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ PLAN WEEK SHEET ══ */}
      <Modal
        visible={planVisible}
        transparent
        animationType="none"
        onRequestClose={() => setPlanVisible(false)}
        onShow={() => planSlideIn()}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Touchable style={{ flex: 1 }} activeOpacity={1} onPress={() => setPlanVisible(false)} />
          <Animated.View
            style={[
              styles.sheet,
              planSlide,
              {
                paddingBottom: Math.max(insets.bottom, S.xl),
                maxHeight: sheetMaxHeight(screenHeight, insets.top),
              },
            ]}
          >
            <GlassSurface corners="top" />
            <View
              {...planPan.panHandlers}
              style={styles.handleArea}
            >
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>
              {showPlanButton
                ? (tr ? 'Gelecek Hafta' : 'Next Week')
                : (tr ? 'Haftalık Hedef' : 'Weekly Goal')}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
              {tr
                ? 'Bu haftanın ana hedefi ne olsun?'
                : "What's your main goal for this week?"}
            </Text>

            <TextInput
              value={planGoal}
              onChangeText={setPlanGoal}
              placeholder={
                tr
                  ? 'Örn: Her gün 2 saat derin odak...'
                  : 'e.g. 2 hours of deep focus every day...'
              }
              placeholderTextColor={theme.onSurfaceVariant + '80'}
              style={[
                styles.goalInput,
                {
                  backgroundColor: isDark
                    ? theme.surfaceContainerHighest
                    : theme.surfaceContainerLowest,
                  borderColor: theme.outline,
                  color: theme.onSurface,
                },
              ]}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
              underlineColorAndroid="transparent"
            />

            <Touchable
              onPress={() => {
                setWeeklyGoal(planGoal);
                setPlanVisible(false);
                haptic.success();
              }}
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.saveBtnText, { color: theme.onPrimary }]}>
                {tr ? 'Kaydet' : 'Save'}
              </Text>
            </Touchable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      <BottomNavBar />
      {tourOn && (
        <HelpTourModal
          pageId="cockpit"
          scrollRef={scrollViewRef}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconBtn: { width: 44, height: 44, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    gap: S.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1.5 },
  headerSub: { fontSize: F.caption, fontWeight: '600', marginTop: S.xxs },
  addBtn: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },

  // Week strip
  sectionLabel: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1.5, marginBottom: S.md },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: S.xs },
  dayCell: {
    flex: 1, alignItems: 'center', paddingVertical: S.sm,
    borderRadius: R.sm, borderWidth: B.thin, gap: S.xs,
  },
  dayAbbr: { fontSize: F.caption, fontWeight: '600', letterSpacing: 0.2 },
  dayCircle: { width: 30, height: 30, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: F.footnote, fontWeight: '700' },
  taskDot: { width: 5, height: 5, borderRadius: R.full },

  // Day tasks card
  // Yarıçap BentoCard'la aynı (R.md): aynı sütunda alt alta iki kart iki ayrı köşeyle duruyordu.
  dayTasksCard: { borderRadius: R.md, borderWidth: B.thin, overflow: 'hidden' },
  dayTasksHeading: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1, padding: S.md, paddingBottom: S.sm },
  dayTaskRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.md, paddingVertical: S.smd },
  miniCheck: { width: 22, height: 22, borderRadius: R.full, borderWidth: B.medium, alignItems: 'center', justifyContent: 'center' },
  dayTaskText: { flex: 1, fontSize: F.body, fontWeight: '600' },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: S.sm,
  },
  sectionTitle: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1.5 },
  sectionSub: { fontSize: F.caption, fontWeight: '600' },

  // Empty state
  emptyTitle: { fontSize: F.subhead, fontWeight: '600', marginBottom: S.sm, textAlign: 'center' },
  emptySub: { fontSize: F.body, textAlign: 'center', marginBottom: S.lg, lineHeight: 20, paddingHorizontal: S.md },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.smd, borderRadius: R.full },
  emptyAddText: { fontSize: F.body, fontWeight: '600' },

  // Habit row
  habitCard: { borderRadius: R.lg, borderWidth: B.thin, padding: S.md, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 2 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  habitLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  habitIcon: { width: 44, height: 44, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  habitName: { fontSize: F.body, fontWeight: '600' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.xxs },
  streakText: { fontSize: F.caption, fontWeight: '600' },

  // Heatmap
  heatmapGrid: { gap: S.xxs },
  heatmapRow: { flexDirection: 'row', gap: S.xxs },
  heatCell: { width: 11, height: 11, borderRadius: R.xs },

  // Check button
  checkBtn: { width: 36, height: 36, borderRadius: R.full, borderWidth: B.medium, alignItems: 'center', justifyContent: 'center' },
  checkFill: { borderRadius: R.full, alignItems: 'center', justifyContent: 'center', margin: -B.medium },
  deleteHabitBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  // Add habit row
  addHabitRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    borderWidth: B.thin, borderStyle: 'dashed', borderRadius: R.lg,
    padding: S.md, justifyContent: 'center',
  },
  addHabitText: { fontSize: F.body, fontWeight: '500' },

  // Weekly stats
  kpiRow: { flexDirection: 'row', paddingVertical: S.md },
  kpiCol: { flex: 1, alignItems: 'center', gap: S.xs, paddingHorizontal: S.xs },
  kpiLabelRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, maxWidth: '100%' },
  statValue: { fontSize: F.title, fontWeight: '600', letterSpacing: -0.5 },
  statLabel: { fontSize: F.caption, fontWeight: '500' },
  goalChip: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md, borderWidth: B.thin },
  goalText: { flex: 1, fontSize: F.body, fontWeight: '500' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: 56, paddingHorizontal: S.md, paddingVertical: S.smd, borderTopWidth: HAIRLINE },
  planBtnText: { fontSize: F.body, fontWeight: '600' },

  // Sheets
  // Ölçüler Yeni Hedef formuyla AYNI (yan 24 dp, ince tutamaç bandı): yan boşluk 40 dp idi ve
  // tutamaçla başlık arasında ~55 dp boşluk kalıyordu (cihazda görüldü).
  sheet: { borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingHorizontal: S.lg, paddingTop: 0, gap: S.md },
  handleArea: { paddingTop: S.sm, paddingBottom: S.xs, alignItems: 'center' },
  sheetHandle: { width: 36, height: 5, borderRadius: R.full },
  sheetTitle: { fontSize: F.title, fontWeight: '600', letterSpacing: -0.5 },
  sheetSub: { fontSize: F.body, marginTop: -S.sm },

  goalInput: { borderRadius: R.md, borderWidth: B.thin, padding: S.md, fontSize: F.body, fontWeight: '600', minHeight: 88 },
  saveBtn: { paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
  saveBtnText: { fontSize: F.subhead, fontWeight: '600' },
});

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
