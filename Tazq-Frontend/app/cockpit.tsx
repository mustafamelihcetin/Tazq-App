import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Keyboard, Platform, Dimensions, Animated, useWindowDimensions } from 'react-native';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
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
import { DisplayValue, DisplayReadout } from '@/shared/components/DisplayPanel';
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
import { HabitPlanSheet } from '@/features/habits/components/HabitPlanSheet';
import { HabitBubble } from '@/features/habits/components/HabitBubble';
import { WeekPanel, type WeekSeg } from '@/features/week/WeekPanel';
import { WeekHabits } from '@/features/week/WeekHabits';
import { habitWeekStory } from '@/features/week/habitWeek';
import { planSummary } from '@/features/habits/utils/planCopy';
import { celebrateMilestone } from '@/features/habits/utils/autoMark';
import { scheduleOf, consistency, isPlannedDay, isDueToday, orderForNow, weekProgress, countOn, targetOf, isQuantity, missState } from '@/features/habits/utils/habitSchedule';
import type { PlanFields } from '@/features/habits/utils/habitSchedule';
import { suggestHabitIcon } from '@/features/habits/utils/habitIcon';
import { localeOf } from '@/shared/utils/lang';
import { upperFor } from '@/shared/utils/localeCase';
import { useActiveHabitList } from '@/features/habits';
import { HABIT_LIMIT, roomLeft, restSuggestions } from '@/features/habits/utils/habitLimit';
import { habitColor, HABIT_PALETTE, type PaletteColor } from '@/features/habits/utils/habitColor';
import { HABIT_LIMIT_COPY } from '@/features/habits/utils/habitLimitCopy';

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


const DAY_LABELS_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];
const DAY_LABELS_EN_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LABELS_EN_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Bu turda eklenen metinler — iki dil YAN YANA.
 * Satır içi `tr ? '...' : '...'` dallanması iki dalı elle senkron tutmayı gerektiriyor
 * ve pratikte ayrışıyor (bkz. i18nRatchet).
 */
/** Haftanın cümlesi (sözlük — bkz. i18nRatchet). */
const WEEK_COPY = {
  tr: {
    fresh: 'Hafta yeni başlıyor — bir alışkanlık ya da kısa bir odakla aç.',
    story: (focus: string, tasks: number, habitPct: number, hasHabits: boolean): WeekSeg[] => [
      'Bu hafta ', { em: focus }, ' odaklandın, ', { em: `${tasks} görev` }, ' bitirdin',
      ...(hasHabits ? ['; alışkanlıklarda ', { em: `%${habitPct}` }] as WeekSeg[] : []), '.',
    ],
  },
  en: {
    fresh: 'The week is just starting — open it with a habit or a short focus.',
    story: (focus: string, tasks: number, habitPct: number, hasHabits: boolean): WeekSeg[] => [
      'This week you focused ', { em: focus }, ' and finished ', { em: `${tasks} task${tasks === 1 ? '' : 's'}` },
      ...(hasHabits ? ['; habits at ', { em: `${habitPct}%` }] as WeekSeg[] : []), '.',
    ],
  },
};

const DAY_COPY = {
  tr: {
    hint: 'İşaretlemek için ✓ · Seçenekler için satıra dokun',
    markingFor: (day: string) => `${day.toLocaleLowerCase('tr')} için işaretliyorsun`,
    cellA11y: (name: string, day: string, done: boolean) => `${name}, ${day}: ${done ? 'yapıldı' : 'yapılmadı'}`,
    streakText: (n: number, unit: 'day' | 'week') => `${n} ${unit === 'week' ? 'haftalık' : 'günlük'} seri`,
    todayHead: 'BUGÜN', gridHint: '✓ bugünü işaretler · geçmiş günü düzeltmek için noktasına dokun',
    todayA11y: (name: string, done: boolean) => `${name}, bugün ${done ? 'yapıldı — geri al' : 'işaretle'}`,
    futureBlocked: 'Gelecek bir gün işaretlenemez',
    markToday: 'Bugün tamamlandı olarak işaretle',
    markDay: (day: string) => `${day} için işaretle`,
    backToToday: 'Bugüne dön',
    today: 'Bugün',
    menuTitle: (day: string) => day,
    skip: 'Mola ver',
    undoSkip: 'Molayı kaldır',
    deleteHabit: 'Sil',
    done: 'tamamlandı',
    complete: 'Tamamla',
    openInTasks: 'Görevler ekranında açar',
    addTask: 'Görev Ekle',
    addTaskFor: (day: string) => `${day} için görev ekle`,
    dayTaskCount: (n: number) => n > 0 ? `${n} görev` : 'Görev yok',
    tapPastDays: '← Geçmiş günlere dokun',
    dayCell: (day: string, done: number, total: number) => total > 0 ? `${day}, ${total} görevden ${done} tamamlandı` : `${day}, görev yok`,
  },
  en: {
    hint: 'Tap ✓ to mark · Tap the row for options',
    markingFor: (day: string) => `Marking for ${day.toLowerCase()}`,
    cellA11y: (name: string, day: string, done: boolean) => `${name}, ${day}: ${done ? 'done' : 'not done'}`,
    streakText: (n: number, unit: 'day' | 'week') => `${n}-${unit === 'week' ? 'week' : 'day'} streak`,
    todayHead: 'TODAY', gridHint: '✓ marks today · tap a dot to fix a past day',
    todayA11y: (name: string, done: boolean) => `${name}, today ${done ? 'done — undo' : 'mark done'}`,
    futureBlocked: 'You cannot check a future day',
    markToday: 'Mark done today',
    markDay: (day: string) => `Mark for ${day}`,
    backToToday: 'Back to today',
    today: 'Today',
    menuTitle: (day: string) => day,
    skip: 'Take a break',
    undoSkip: 'Remove break',
    deleteHabit: 'Delete',
    done: 'done',
    complete: 'Complete',
    openInTasks: 'Opens in Tasks',
    addTask: 'Add Task',
    addTaskFor: (day: string) => `Add a task for ${day}`,
    dayTaskCount: (n: number) => n === 0 ? 'No tasks' : n === 1 ? '1 task' : `${n} tasks`,
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
  const { language, t } = useLanguageStore();
  // Arşivlenmişler hariç — merkez aktif hayatı gösterir (bkz. useActiveTasks).
  const rawTasks = useActiveTasks();
  const { habits: allHabits, addHabit, removeHabit, toggleDate, toggleSkipDate, weeklyGoal, setWeeklyGoal, getStreak, pauseHabit, resumeHabit, updatePlan, tapHabit } = useHabitStore();
  const [newPlan, setNewPlan] = useState<PlanFields>({});
  const [newColor, setNewColor] = useState(HABIT_PALETTE[0].light); // elle eklenen alışkanlık rengi (bkz. habitColor)
  const [planFor, setPlanFor] = useState<string | null>(null); // "Planı düzenle" açık olan alışkanlık
  // Dinlenenler bugünün listesinde yok; altta ayrı bölümde, geri getirilebilir (madde 6).
  const rawHabits = useActiveHabitList();
  const restedHabits = useMemo(() => allHabits.filter(h => !!h.pausedAt), [allHabits]);
  const lc = HABIT_LIMIT_COPY[language === 'en' ? 'en' : 'tr'];
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
      // Gelecek günde alışkanlık BEKLENMEZ; kurulmadan önceki günlerde de beklenmez. Plana duyarlı:
      // "Pzt-Çar-Cum" salı beklenmez; "haftada N" yalnız yapıldığı gün sayılır (bkz. habitSchedule).
      const habitsExpected = isFuture ? 0 : habits.filter((h) =>
        (!h.createdAt || fmtDateKey(new Date(h.createdAt)) <= key) && isPlannedDay(h, key)
        && (scheduleOf(h).kind !== 'weekly' || (h.completedDates ?? []).includes(key))).length;
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
    // Uyarı klavyenin ALTINDA kalıyordu (cihazda görüldü): önce klavye kapanır.
    Keyboard.dismiss();
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
    addHabit(name, newEmoji, newColor, undefined, undefined, undefined, undefined, newPlan);
    setNewPlan({});
    setNewColor(HABIT_PALETTE[0].light);
    setNewName('');
    setNewEmoji('💪');
    emojiPickedRef.current = false;
    setAddVisible(false);
  };

  // Izgaradaki hücre O GÜNÜ işaretler; gün verilmezse seçili gün.
  const handleToggleHabit = (id: string, day: string = selectedDay) => {
    const habit = habits.find(h => h.id === id);
    const doneToday = Array.isArray(habit?.completedDates) && habit!.completedDates.includes(day);

    // Gelecek bir gün işaretlenemez: yapılmamış bir şeyi "yapıldı" saymak veriyi bozar.
    if (day > todayKey) {
      // Titreşim yok: tost görünür bir yanıt veriyor.
      useToastStore.getState().show(dc.futureBlocked, 'info');
      return;
    }

    // Miktarlıda ara adım (3/8): yalnız hafif tik; gün ancak hedefte "yapıldı".
    if (habit && !doneToday && isQuantity(habit) && countOn(habit, day) + 1 < targetOf(habit)) {
      haptic.select();
      tapHabit(id, day);
      return;
    }

    if (!doneToday) {
      haptic.success();
      const pendingHabits = habits.filter(h => h.id !== id && isDueToday(h, day) && !h.completedDates?.includes(day) && !h.skippedDates?.includes(day));
      const allHabitsDone = pendingHabits.length === 0;

      if (soundEffects && !allHabitsDone) {
        playSoundEffect(require('../assets/sounds/habit.mp3'), {
          context: 'cockpit.habitDoneSound',
          volume: 0.18,
          reassertVolumeAfterMs: 150,
        });
      }

      if (allHabitsDone && day === todayKey) {
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
      tapHabit(id, day);
      celebrateMilestone(id, day); // 7/21/66. tekrar
    } else {
      haptic.commit();
      tapHabit(id, day);
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

  /*
    SINIR (madde 6): 7 aktif alışkanlık, modlarınkiler dahil. Dolunca ekleme yerine
    neden olduğu anlatılır ve "birini dinlendir" önerilir — hiçbir şey silinmez.
  */
  const restHabit = (id: string, name: string) => {
    pauseHabit(id);
    haptic.success();
    useToastStore.getState().show(lc.restedToast(name), 'success', { label: lc.resume, onAction: () => resumeHabit(id) });
  };
  const offerRest = () => {
    const picks = restSuggestions(allHabits, 3);
    Alert.alert(lc.pickTitle, lc.pickBody, [
      ...picks.map(h => ({ text: h.name, onPress: () => restHabit(h.id, h.name) })),
      { text: lc.cancel, style: 'cancel' as const },
    ]);
  };
  const openAddHabit = () => {
    if (roomLeft(allHabits) === 0) {
      Alert.alert(lc.fullTitle, lc.fullBody, [
        { text: lc.restOne, onPress: offerRest },
        { text: lc.whyBtn, onPress: () => Alert.alert(lc.whyTitle, lc.whyBody, [{ text: lc.restOne, onPress: offerRest }, { text: lc.ok, style: 'cancel' }]) },
        { text: lc.ok, style: 'cancel' },
      ]);
      return;
    }
    prepareAdd();
    setAddVisible(true);
  };
  const bringBack = (id: string, name: string) => {
    if (roomLeft(allHabits) === 0) { openAddHabit(); return; }
    resumeHabit(id);
    haptic.success();
    useToastStore.getState().show(lc.resumedToast(name), 'success');
  };
  // Sınırın ÜSTÜNDE olan (eski) kullanıcıya BİR KEZ nazik öneri; seçim kullanıcının.
  useEffect(() => {
    const extra = rawHabits.length - HABIT_LIMIT;
    if (extra <= 0) return;
    AsyncStorage.getItem('tazq-habit-limit-noticed').then(v => {
      if (v) return;
      AsyncStorage.setItem('tazq-habit-limit-noticed', '1').catch((e) => swallow('cockpit.habitLimitNoticed', e));
      Alert.alert(lc.overTitle, lc.overBody(rawHabits.length, extra), [
        { text: lc.overLater, style: 'cancel' },
        { text: lc.overApply, onPress: () => restSuggestions(allHabits, extra).forEach(h => pauseHabit(h.id)) },
      ]);
    }).catch((e) => swallow('cockpit.habitLimitRead', e));
  }, [rawHabits.length]);

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
          text: isSkipped ? dc.undoSkip : dc.skip,
          onPress: () => {
            toggleSkipDate(id, selectedDay);
            haptic.success();
          }
        },
        { text: tr ? 'Planı düzenle' : 'Edit plan', onPress: () => setPlanFor(id) },
        { text: lc.rest, onPress: () => restHabit(id, name) },
        {
          text: dc.deleteHabit,
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

  // Haftanın cümlesi — veriden, vurgu yalnız sayılarda (ana sayfadaki yaşayan cümleyle aynı dil).
  const weekSentence: WeekSeg[] = weekSummary.totalFocusMin === 0 && thisWeekCompleted === 0 && weekSummary.habitDone === 0
    ? [WEEK_COPY[tr ? 'tr' : 'en'].fresh]
    : WEEK_COPY[tr ? 'tr' : 'en'].story(focusLabel, thisWeekCompleted, habitsThisWeekPct, weekSummary.habitPossible > 0);


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

          {/* ── HAFTA PANELİ (bkz. features/week/WeekPanel): cümle, gün halkaları, seçili günün
              alışkanlıkları ve takvim satırı, hafta sayıları — tek ekran. Tur hedefleri burada. ── */}
          <TourTarget id="weekStrip" spotRadius={R.md} style={{ marginBottom: S.lg }}>
            <WeekPanel
              label={`${upperFor(tr ? 'Bu hafta' : 'This week', tr)} · ${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${upperFor(weekDays[6].toLocaleString(tr ? 'tr-TR' : 'en-US', { month: 'short' }), tr)}`}
              sentence={weekSentence}
              days={weekData.map((d, i) => ({
                key: d.key, abbr: dayLabels[i], num: d.date.getDate(), isToday: d.isToday, isFuture: d.key > todayKey,
                ratio: d.total > 0 ? d.completed / d.total : null,
                a11y: dc.dayCell(d.date.toLocaleDateString(localeOf(language), { weekday: 'long', day: 'numeric', month: 'long' }), d.completed, d.total),
              }))}
              selectedKey={selectedDay}
              onSelectDay={setSelectedDay}
              day={
                /* Seçili günün işleri Takvim'de (madde 5); burada tek satır. */
                <TourTarget id="dailySection" spotRadius={R.md}>
                  <Touchable
                    onPress={() => router.push({ pathname: '/gun', params: { date: selectedDay } })}
                    accessibilityRole="button"
                    accessibilityLabel={`${selectedDayLabel}, ${dc.dayTaskCount(selectedDayTasks.length)} — ${t.dayView.openInCalendar}`}
                    style={styles.dayLine}
                  >
                    <Text style={{ fontSize: F.caption, fontWeight: '700', letterSpacing: 0.8, color: isSelectedToday ? theme.primary : theme.onSurface }} numberOfLines={1}>{upperFor(selectedDayLabel, tr)}</Text>
                    <Text style={{ flex: 1, fontSize: F.caption, color: theme.onSurfaceVariant }} numberOfLines={1}>{`· ${dc.dayTaskCount(selectedDayTasks.length)}`}</Text>
                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.primary }}>{t.dayView.openInCalendar}</Text>
                    <ChevronRight size={ICON.xs} color={theme.primary} />
                  </Touchable>
                </TourTarget>
              }
              stats={
                <TourTarget id="weeklyReview" spotRadius={R.md}>
                  {/* HEDEF + PLAN TEK SATIR — hedef metni satırın alt yazısı. */}
                  <Touchable
                    onPress={() => {
                      setPlanGoal(weeklyGoal);
                      preparePlan();
                      setPlanVisible(true);
                      haptic.commit();
                    }}
                    accessibilityRole="button"
                    style={[styles.planRow, { borderTopWidth: 0, paddingTop: 0 }]}
                  >
                    <Sparkles size={ICON.sm} color={theme.primary} />
                    <View style={{ flex: 1, gap: S.xxs }}>
                      <Text style={[styles.planBtnText, { color: theme.onSurface }]}>
                        {showPlanButton
                          ? (tr ? 'Gelecek Haftayı Planla' : 'Plan Next Week')
                          : (tr ? 'Haftalık Hedefi Güncelle' : 'Update Weekly Goal')}
                      </Text>
                      {!!weeklyGoal && (
                        <Text numberOfLines={2} style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{weeklyGoal}</Text>
                      )}
                    </View>
                    <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
                  </Touchable>
                </TourTarget>
              }
            />
          </TourTarget>

          {/* ── ALIŞKANLIKLAR: anlam kartı (bkz. features/week/WeekHabits) — tek cümle + alışkanlık
              başına tek satır (hedefe dolan çubuk, "3/7", seçili gün ✓). ── */}
          {personalHabits.length > 0 && (
            <View style={{ marginBottom: S.md }}>
              <WeekHabits
                label={tr ? 'ALIŞKANLIKLAR' : 'HABITS'}
                story={habitWeekStory(personalHabits, weekData.map(d => d.key), todayKey, tr ? 'tr' : 'en',
                  k => new Date(`${k}T12:00:00`).toLocaleDateString(localeOf(language), { weekday: 'long' }), h => habitColor(h, isDark))}
                habits={personalHabits}
                weekKeys={weekData.map(d => d.key)}
                todayKey={todayKey}
                onToday={h => handleToggleHabit(h.id, todayKey)}
                onTodayHold={h => { haptic.commit(); toggleSkipDate(h.id, todayKey); }}
                onOpen={h => router.push({ pathname: '/aliskanlik', params: { id: h.id } })}
                todayLabel={(h, done) => dc.todayA11y(h.name, done)}
                streakLabel={(n, unit) => dc.streakText(n, unit)}
                renderName={(habit, sub) => {
                  const doneToday = (habit.completedDates ?? []).includes(todayKey);
                  const isSkipped = (habit.skippedDates ?? []).includes(todayKey);
                  const streak = getStreak(habit);
                  return (
                    /* Satıra dokun → alışkanlığın sayfası (takvim, seri, desen, plan); basılı tut → hızlı menü. */
                    <Touchable
                      accessibilityRole="button"
                      accessibilityLabel={describeHabit({ doneToday, skipped: isSkipped, streak }, habit.name, language)}
                      accessibilityState={{ checked: doneToday }}
                      accessibilityHint={rowHint(language)}
                      onPress={() => router.push({ pathname: '/aliskanlik', params: { id: habit.id } })}
                      onLongPress={() => handleLongPressHabit(habit.id, habit.name)}
                      style={styles.gridHead}
                    >
                      {renderModeEmojiIcon(habit.emoji ?? '📌', 16, habitColor(habit, isDark))}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: F.body, fontWeight: '600', color: theme.onSurface }} numberOfLines={1}>{habit.name}</Text>
                        {!!sub && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }} numberOfLines={1}>{sub}</Text>}
                      </View>
                    </Touchable>
                  );
                }}
              />
            </View>
          )}

          <WideSplit>
          <WideCol>
          {/* ── ALIŞKANLIKLAR: ekleme. ── */}
          {personalHabits.length === 0 ? (
            <BentoCard index={1} style={{ alignItems: 'center', paddingVertical: S.xl, marginBottom: S.md }}>
              <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>
                {tr ? 'İlk alışkanlığını ekle' : 'Add your first habit'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>
                {hasActiveSeasonalMode
                  ? (tr ? 'Manuel ekle veya ana ekrandan mod planını uygula.' : 'Add manually or apply your mode plan from Home.')
                  : (tr ? 'Küçük alışkanlıklar büyük dönüşümler yaratır.' : 'Small habits create big transformations.')}
              </Text>
              <Touchable onPress={openAddHabit} accessibilityRole="button" style={[styles.emptyAddBtn, { backgroundColor: theme.primary }]}>
                <Plus size={ICON.sm} color={theme.onPrimary} />
                <Text style={[styles.emptyAddText, { color: theme.onPrimary }]}>{tr ? 'Alışkanlık Ekle' : 'Add Habit'}</Text>
              </Touchable>
            </BentoCard>
          ) : (
            <Touchable onPress={openAddHabit} accessibilityRole="button" style={[styles.addHabitRow, { borderColor: theme.outline, marginBottom: S.md }]}>
              <Plus size={ICON.sm} color={theme.onSurfaceVariant} />
              <Text style={[styles.addHabitText, { color: theme.onSurfaceVariant }]}>{tr ? 'Alışkanlık Ekle' : 'Add Habit'}</Text>
            </Touchable>
          )}
          </WideCol>

          <WideCol col="right">
          {restedHabits.length > 0 && (
            <View style={{ marginTop: S.md, gap: S.xs }}>
              <Text style={[styles.sectionTitle, { color: theme.onSurfaceMuted }]}>{upperFor(lc.restedSection(restedHabits.length), tr)}</Text>
              {restedHabits.map(h => (
                <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.sm, paddingHorizontal: S.md, borderRadius: R.md, backgroundColor: theme.surfaceCard }}>
                  <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurfaceVariant }} numberOfLines={1}>{h.name}</Text>
                  <Touchable onPress={() => bringBack(h.id, h.name)} accessibilityRole="button" accessibilityLabel={`${h.name} — ${lc.resume}`} style={{ paddingHorizontal: S.smd, paddingVertical: S.xs }}>
                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.primary }}>{lc.resume}</Text>
                  </Touchable>
                </View>
              ))}
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
          behavior="padding"
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
              colors={HABIT_PALETTE}
              emojis={HABIT_EMOJIS}
              onAdd={handleAddHabit}
              onClose={() => setAddVisible(false)}
              theme={theme}
              isDark={isDark}
              tr={tr}
              inputRef={nameInputRef}
              plan={newPlan}
              onPlanChange={setNewPlan}
            />
          </Animated.View>
        </KeyboardAvoidingView>
        <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
      </Modal>

      {(() => {
        const h = habits.find(x => x.id === planFor);
        return (
          <HabitPlanSheet visible={!!h} title={h?.name ?? ''} color={h ? habitColor(h, isDark) : theme.primary}
            initial={h ? { schedule: h.schedule, target: h.target, unit: h.unit, slot: h.slot, autoFrom: h.autoFrom } : {}}
            onSave={p => { if (h) updatePlan(h.id, p); }} onClose={() => setPlanFor(null)}
            theme={theme} isDark={isDark} lang={tr ? 'tr' : 'en'} />
        );
      })()}

      {/* ══ PLAN WEEK SHEET ══ */}
      <Modal
        visible={planVisible}
        transparent
        animationType="none"
        onRequestClose={() => setPlanVisible(false)}
        onShow={() => planSlideIn()}
      >
        <KeyboardAvoidingView
          behavior="padding"
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
        <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
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
  dayLink: { flexDirection: 'row', alignItems: 'center', gap: S.smd, padding: S.md, borderRadius: R.lg },
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
  dayLine: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: 32 },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 28 },
  habitLine: { flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingVertical: S.smd, paddingHorizontal: S.md },
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
