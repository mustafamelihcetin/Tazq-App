import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, KeyboardAvoidingView, Platform, Dimensions, Animated, useWindowDimensions, Alert } from 'react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { BlurView } from 'expo-blur';
import {
  Plus, Check, Flame, Clock, Target,
  ChevronRight, Sparkles, CalendarDays, Trash2, ArrowLeft, BarChart3, Coffee,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as HapticsOriginal from 'expo-haptics';
const Haptics = {
  notificationAsync: (type: any) => HapticsOriginal.notificationAsync(type).catch(() => {}),
  impactAsync: (style: any) => HapticsOriginal.impactAsync(style).catch(() => {}),
  selectionAsync: () => HapticsOriginal.selectionAsync().catch(() => {}),
  NotificationFeedbackType: HapticsOriginal.NotificationFeedbackType,
  ImpactFeedbackStyle: HapticsOriginal.ImpactFeedbackStyle,
};
import { useTaskStore, getLocalizedTaskTitle } from '@/features/tasks';
import { useFocusStore } from '@/features/focus';
import { useHabitStore, Habit, fmtDateKey } from '@/features/habits';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore, renderModeEmojiIcon } from '@/features/modes';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { BentoCard } from '@/shared/components/BentoCard';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { FocusService } from '@/shared/services/api';
import { S, R, F, B, TRACKING, MAX_W, sideInset } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { SwipeableHabitItem } from '@/shared/components/SwipeableHabitItem';
import { TourTarget, useTour } from '@/shared/components/TourContext';
import { HelpTourModal } from '@/shared/components/HelpTourModal';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { swallow } from '@/shared/utils/swallow';
import { playSoundEffect } from '@/shared/utils/soundEffects';

// Alışkanlık odaklı kalmalı — mantıklı üst sınır (plan + manuel toplam).
const MAX_HABITS = 15;
const HABIT_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#8B5CF6', '#06B6D4',
];

const HABIT_EMOJIS = [
  '💪', '📚', '💧', '🏃', '🧘', '✍️', '🥗', '😴',
  '🎯', '🎨', '💊', '🌿', '🎵', '🧠', '🌅', '⚡',
];

function getWeekDays(startDay: 0 | 1 = 1): Date[] {
  const today = new Date();
  const day = today.getDay();
  const diff = (day - startDay + 7) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
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
  const rawTasks = useTaskStore(s => s.tasks);
  const { habits: rawHabits, addHabit, removeHabit, toggleDate, toggleSkipDate, weeklyGoal, setWeeklyGoal, getStreak } = useHabitStore();
  const {
    seasonal,
    examPlanTaskIds, exam2PlanTaskIds, exam3PlanTaskIds,
    tezPlanTaskIds,
    mulakatPlanTaskIds, mulakat2PlanTaskIds, mulakat3PlanTaskIds,
    sporPlanTaskIds, spor2PlanTaskIds, spor3PlanTaskIds,
    ramazanPlanTaskIds,
    examPlanHabitIds, exam2PlanHabitIds, exam3PlanHabitIds,
    tezPlanHabitIds,
    mulakatPlanHabitIds, mulakat2PlanHabitIds, mulakat3PlanHabitIds,
    sporPlanHabitIds, spor2PlanHabitIds, spor3PlanHabitIds,
    ramazanPlanHabitIds,
    soundEffects,
    completedTours,
    onboardingCompleted,
  } = usePrefsStore();

  const { measureAll } = useTour();
  const scrollViewRef = useRef<ScrollView>(null);

  const handleStepChange = (step: number) => {
    try {
      if (step === 2) {
        scrollViewRef.current?.scrollTo({ y: 380, animated: true });
      } else {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
      setTimeout(() => {
        measureAll();
      }, 350);
    } catch (e) {
      console.error('[Cockpit] error during step scroll:', e);
    }
  };

  const tasks = useMemo(() => {
    // Demo veri yalnızca ilk kez onboarding yapan yeni kullanıcıya; dönen/reaktive kullanıcıya değil.
    if (completedTours?.cockpit !== true && !onboardingCompleted) {
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
  }, [rawTasks, completedTours, onboardingCompleted, language]);

  const habits = useMemo(() => {
    if (completedTours?.cockpit !== true && !onboardingCompleted) {
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
  }, [rawHabits, completedTours, onboardingCompleted, language]);

  const hasActiveSeasonalMode = seasonal.ramazan || seasonal.examMode || seasonal.tezMode || seasonal.mulakatMode || seasonal.sporMode;

  const planTaskIdSet = useMemo(() => new Set([
    ...examPlanTaskIds, ...exam2PlanTaskIds, ...exam3PlanTaskIds,
    ...tezPlanTaskIds,
    ...mulakatPlanTaskIds, ...mulakat2PlanTaskIds, ...mulakat3PlanTaskIds,
    ...sporPlanTaskIds, ...spor2PlanTaskIds, ...spor3PlanTaskIds,
    ...ramazanPlanTaskIds,
  ]), [
    examPlanTaskIds, exam2PlanTaskIds, exam3PlanTaskIds,
    tezPlanTaskIds,
    mulakatPlanTaskIds, mulakat2PlanTaskIds, mulakat3PlanTaskIds,
    sporPlanTaskIds, spor2PlanTaskIds, spor3PlanTaskIds,
    ramazanPlanTaskIds,
  ]);

  const planHabitIdSet = useMemo(() => new Set([
    ...examPlanHabitIds, ...exam2PlanHabitIds, ...exam3PlanHabitIds,
    ...tezPlanHabitIds,
    ...mulakatPlanHabitIds, ...mulakat2PlanHabitIds, ...mulakat3PlanHabitIds,
    ...sporPlanHabitIds, ...spor2PlanHabitIds, ...spor3PlanHabitIds,
    ...ramazanPlanHabitIds,
  ]), [
    examPlanHabitIds, exam2PlanHabitIds, exam3PlanHabitIds,
    tezPlanHabitIds,
    mulakatPlanHabitIds, mulakat2PlanHabitIds, mulakat3PlanHabitIds,
    sporPlanHabitIds, spor2PlanHabitIds, spor3PlanHabitIds,
    ramazanPlanHabitIds,
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
  const [completingHabitIds, setCompletingHabitIds] = useState<Set<string>>(new Set());
  const [expandedHabitIds, setExpandedHabitIds] = useState<Set<string>>(new Set());
  const toggleHabitExpand = (id: string) => {
    setExpandedHabitIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('💪');
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
  const [weeklyFocusMin, setWeeklyFocusMin] = useState(0);
  const [planGoal, setPlanGoal] = useState('');
  const nameInputRef = useRef<any>(null);
  const habitExitAnimMap = useRef<Map<string, { opacity: Animated.Value; translateY: Animated.Value }>>(new Map());

  const { panResponder: addPan, animatedStyle: addSlide, prepare: prepareAdd, slideIn: addSlideIn } = useSwipeToDismiss({
    onDismiss: () => setAddVisible(false),
  });
  const { panResponder: planPan, animatedStyle: planSlide, prepare: preparePlan, slideIn: planSlideIn } = useSwipeToDismiss({
    onDismiss: () => setPlanVisible(false),
  });

  const fetchStats = useCallback(() => {
    FocusService.getStats()
      .then((s) => {
        const total = (s.weeklyFocus || []).reduce(
          (acc: number, d: any) => acc + (d.minutes || 0), 0
        );
        setWeeklyFocusMin(total);
      })
      .catch(() => {});
  }, []);

  useFocusEffect(fetchStats);

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
      setNewColor(HABIT_COLORS[0]);
    }
  }, [addVisible]);

  const dayLabels = tr ? DAY_LABELS_TR : (weekStart === 0 ? DAY_LABELS_EN_SUN : DAY_LABELS_EN_MON);

  // Personal tasks only — plan tasks are managed in modlar, not here
  const personalTasks = useMemo(
    () => tasks.filter((t) => !planTaskIdSet.has(t.id)),
    [tasks, planTaskIdSet]
  );

  // Week strip data
  const weekData = useMemo(() => {
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    return weekDays.map((d) => {
      const key = fmtDateKey(d);
      const dayTasks = personalTasks.filter(
        (t) => t.dueDate && fmtDateKey(new Date(t.dueDate)) === key
      );
      const isPast = d < todayMidnight;
      return {
        date: d,
        key,
        isToday: key === todayKey,
        isPast,
        total: dayTasks.length,
        completed: dayTasks.filter((t) => t.isCompleted).length,
      };
    });
  }, [personalTasks, weekDays, todayKey]);

  // Tasks for selected day
  const selectedDayTasks = useMemo(() =>
    personalTasks.filter((t) => t.dueDate && fmtDateKey(new Date(t.dueDate)) === selectedDay),
    [personalTasks, selectedDay]
  );

  // Weekly stats
  const weekKeys = useMemo(() => new Set(weekDays.map(fmtDateKey)), [weekDays]);

  const thisWeekCompleted = useMemo(() =>
    personalTasks.filter(
      (t) => t.isCompleted && t.dueDate && weekKeys.has(fmtDateKey(new Date(t.dueDate)))
    ).length,
    [personalTasks, weekKeys]
  );

  // Haftalık Merkez artık TÜM alışkanlıkları gösterir (kişisel + mod). Önceden mod alışkanlıkları
  // (planHabitIdSet) hariç tutuluyordu → kullanıcı habitlerini burada göremeyip "boş" sanıyordu.
  // Kullanıcı tüm alışkanlıklarının haftalık ilerlemesini tek yerde görsün. (Silme mantığı plan
  // alışkanlıklarını zaten doğru temizliyor — setPlanIds ile.)
  const personalHabits = useMemo(
    () => habits.filter((h) => h && h.id),
    [habits]
  );

  const habitsThisWeekPct = useMemo(() => {
    const total = personalHabits.length * 7;
    if (total === 0) return 0;
    const done = personalHabits.reduce(
      (acc, h) => acc + (Array.isArray(h.completedDates) ? h.completedDates : []).filter((d: string) => weekKeys.has(d)).length,
      0
    );
    return Math.round((done / total) * 100);
  }, [personalHabits, weekKeys]);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addHabit(name, newEmoji, newColor);
    setNewName('');
    setNewEmoji('💪');
    setNewColor(HABIT_COLORS[0]);
    setAddVisible(false);
  };

  const handleToggleHabit = (id: string) => {
    const habit = habits.find(h => h.id === id);
    const doneToday = Array.isArray(habit?.completedDates) && habit!.completedDates.includes(todayKey);

    if (!doneToday) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const pendingHabits = habits.filter(h => h.id !== id && !h.completedDates?.includes(todayKey));
      const allHabitsDone = pendingHabits.length === 0;

      if (soundEffects && !allHabitsDone) {
        playSoundEffect(require('../assets/sounds/habit.mp3'), {
          context: 'cockpit.habitDoneSound',
          volume: 0.18,
          reassertVolumeAfterMs: 150,
        });
      }

      if (allHabitsDone) {
        require('@/shared/store/useConfettiStore').useConfettiStore.getState().trigger(
          language === 'tr' ? 'Alışkanlıklar Tamam!' : 'All Habits Done!',
          language === 'tr' ? 'Bugünkü tüm alışkanlık hedeflerini tamamladın. Harika istikrar! 🌟' : 'You completed all habit targets for today. Great consistency! 🌟',
          'medium',
          'day_cleared'
        );
        useFocusStore.getState().addFocusPoints(20);
      }
      const opacity = new Animated.Value(1);
      const translateY = new Animated.Value(0);
      habitExitAnimMap.current.set(id, { opacity, translateY });
      // Add to completingHabitIds → triggers re-render → Animated.View picks up the new style
      setCompletingHabitIds(prev => new Set([...prev, id]));

      Animated.sequence([
        Animated.delay(260),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 36, duration: 260, useNativeDriver: true }),
        ]),
      ]).start(() => {
        habitExitAnimMap.current.delete(id);
        toggleDate(id, todayKey);
        // Remove from completing set → re-render → habit now filtered out (doneToday=true, not completing)
        setCompletingHabitIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toggleDate(id, todayKey);
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
    const isSkipped = safeSkipped.includes(todayKey);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      name,
      tr ? 'Bu alışkanlık için ne yapmak istersin?' : 'What do you want to do with this habit?',
      [
        {
          text: isSkipped ? (tr ? 'Pas Geçmeyi Geri Al' : 'Undo Skip') : (tr ? 'Bugün Pas Geç (Mola)' : 'Skip Today (Break)'),
          onPress: () => {
            toggleSkipDate(id, todayKey);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const focusHrs = Math.floor(weeklyFocusMin / 60);
  const focusMins = weeklyFocusMin % 60;
  const focusLabel = weeklyFocusMin >= 60
    ? `${focusHrs}${tr ? 'sa' : 'h'}${focusMins > 0 ? `${focusMins}${tr ? 'dk' : 'm'}` : ''}`
    : `${weeklyFocusMin}${tr ? 'dk' : 'm'}`;

  const selectedDayObj = weekData.find((d) => d.key === selectedDay);
  const selectedDayLabel = selectedDayObj?.isToday
    ? (tr ? 'BUGÜN' : 'TODAY')
    : selectedDayObj?.date.toLocaleDateString(tr ? 'tr-TR' : 'en-US', {
        weekday: 'long', day: 'numeric',
      }).toUpperCase() ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />

      <MotiView 
            from={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ type: 'timing', duration: 250 }}
            style={[
                styles.floatingTopBar,
                {
                    position: 'absolute',
                    top: insets.top + S.sm,
                    left: sideInset(screenWidth),
                    right: sideInset(screenWidth),
                    zIndex: 100,
                    backgroundColor: Platform.OS === 'android' ? (isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)') : 'transparent',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    elevation: Platform.OS === 'android' ? 4 : 0,
                },
                Platform.OS !== 'android' && {
                    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 24,
                }
            ]}
        >
            {Platform.OS === 'ios' && (
              <BlurView 
                  intensity={isDark ? 30 : 60} 
                  tint={colorScheme}
                  style={StyleSheet.absoluteFill}
              />
            )}
            <View style={[styles.topBarContent, { paddingHorizontal: S.sm, minHeight: 48 }]}>
              {/* Left Side — Haftalık rapor (denge için sola alındı) */}
              <View style={{ width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                  <Touchable
                    onPress={() => router.push('/report')}
                    style={styles.headerIconBtn}
                    accessibilityRole="button"
                    accessibilityLabel={tr ? 'Haftalık rapor' : 'Weekly report'}
                  >
                    <BarChart3 size={22} color={theme.onSurface} />
                  </Touchable>
              </View>

              {/* Center Title */}
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
                  <Text 
                    numberOfLines={1} 
                    adjustsFontSizeToFit
                    style={{ fontSize: 20, fontWeight: '600', color: theme.onSurface, letterSpacing: TRACKING.title, textAlign: 'center' }}
                  >
                      {tr ? 'Haftalık Merkez' : 'Weekly Hub'}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: theme.primary, letterSpacing: 0.5, marginTop: 1 }}>
                    {`${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleString(tr ? 'tr-TR' : 'en-US', { month: 'short' }).toUpperCase()}`}
                  </Text>
              </View>

              {/* Right Side — Ekle (denge için tek buton) */}
              <View style={{ width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                  <Touchable
                    onPress={() => { prepareAdd(); setAddVisible(true); }}
                    style={styles.headerIconBtn}
                    accessibilityRole="button"
                    accessibilityLabel={tr ? 'Ekle' : 'Add'}
                  >
                    <Plus size={24} color={theme.onSurface} />
                  </Touchable>
              </View>
            </View>
        </MotiView>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 80 + insets.top, paddingHorizontal: isSmallScreen ? S.md : S.lg, paddingBottom: 140, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── WEEK STRIP ── */}
          <TourTarget id="weekStrip">
          <BentoCard index={0} style={{ padding: compactPad, marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                {tr ? 'BU HAFTA' : 'THIS WEEK'}
              </Text>
              <AnimatePresence>
                {showDayHint && (
                  <MotiView
                    key="day-hint"
                    from={{ opacity: 0, translateX: 8 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    exit={{ opacity: 0, translateX: 8 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                  >
                    <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '600' }}>
                      {tr ? '← Geçmiş günlere dokun' : '← Tap past days'}
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
                      Haptics.selectionAsync();
                    }}
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
                    <View style={[
                      styles.taskDot,
                      {
                        backgroundColor: hasTasks
                          ? allDone ? theme.success : (day.isPast ? theme.onSurfaceVariant : theme.primary)
                          : 'transparent',
                        opacity: day.isPast && !day.isToday ? 0.4 : 1,
                      },
                    ]} />
                  </Touchable>
                );
              })}
            </View>
          </BentoCard>
          </TourTarget>

          {/* ── SELECTED DAY TASKS ── */}
          <TourTarget id="dailySection">
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {selectedDayLabel.toUpperCase()}
            </Text>
            <Touchable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/tasks', params: { action: 'add', dateFilter: selectedDay } });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary + '18', paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full }}
            >
              <Plus size={13} color={theme.primary} strokeWidth={2.5} />
              <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.primary }}>
                {tr ? 'Görev Ekle' : 'Add Task'}
              </Text>
            </Touchable>
          </View>

          <AnimatePresence>
            {selectedDayTasks.length === 0 ? (
              <MotiView
                key={`empty-${selectedDay}`}
                from={{ opacity: 0, translateY: -4 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'timing', duration: 250 }}
                style={[
                  styles.dayTasksCard,
                  {
                    backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
                    borderColor: theme.outline + '30',
                    marginBottom: S.lg,
                    paddingVertical: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={{ fontSize: F.body, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.5 }}>
                  {tr ? 'Planlanmış görev yok' : 'No tasks planned'}
                </Text>
              </MotiView>
            ) : (
              <MotiView
                key={selectedDay}
                from={{ opacity: 0, translateY: -6 }}
                animate={{ opacity: 1, translateY: 0 }}
                exit={{ opacity: 0, translateY: -6 }}
                transition={{ type: 'spring', damping: 22 }}
                style={[
                  styles.dayTasksCard,
                  {
                    backgroundColor: isDark
                      ? theme.surfaceContainerHigh
                      : theme.surfaceContainerLowest,
                    borderColor: theme.outline + '30',
                    marginBottom: S.lg,
                  },
                ]}
              >
                {selectedDayTasks.slice(0, 5).map((task, idx) => (
                  <Touchable
                    key={task.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push({ pathname: '/tasks', params: { highlightId: String(task.id) } });
                    }}
                    activeOpacity={0.7}
                    style={[
                      styles.dayTaskRow,
                      {
                        borderTopColor: theme.outline + '20',
                        borderTopWidth: idx === 0 ? 0 : 1,
                      },
                    ]}
                  >
                    <View style={[
                      styles.miniCheck,
                      {
                        borderColor: task.isCompleted ? theme.success : theme.outline + '80',
                        backgroundColor: task.isCompleted ? theme.success + '18' : 'transparent',
                      },
                    ]}>
                      {task.isCompleted && <Check size={10} color={theme.success} strokeWidth={3} />}
                    </View>
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
                    <View style={[
                      styles.priorityPip,
                      {
                        backgroundColor:
                          task.priority === 'High' ? theme.priorityHigh
                          : task.priority === 'Medium' ? theme.priorityMedium
                          : theme.priorityLow,
                      },
                    ]} />
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
                    style={[styles.dayTaskRow, { borderTopColor: theme.outline + '20', borderTopWidth: 1, justifyContent: 'center' }]}
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

          {/* ── HABITS ── */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
                {tr ? 'ALIŞKANLIKLAR' : 'HABITS'}
              </Text>
              <Text style={{ fontSize: 9.5, color: theme.onSurfaceVariant, opacity: 0.6, marginTop: 2 }}>
                {tr ? 'Mola için butona basılı tut' : 'Hold check button to take break'}
              </Text>
            </View>
            <Text style={[styles.sectionSub, { color: theme.onSurfaceVariant }]}>
              {tr ? 'Son 28 gün' : 'Last 28 days'}
            </Text>
          </View>

          {personalHabits.length === 0 ? (
            <BentoCard index={1} style={{ alignItems: 'center', paddingVertical: S.xl, marginBottom: S.md }}>
              <MotiView
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ loop: true, duration: 2800 }}
                style={{ marginBottom: S.md, opacity: 0.35 }}
              >
                <Flame size={40} color={theme.primary} />
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
                    <Plus size={15} color={theme.onPrimary} />
                    <Text style={[styles.emptyAddText, { color: theme.onPrimary }]}>
                      {tr ? 'Alışkanlık Ekle' : 'Add Habit'}
                    </Text>
                  </Touchable>
                </>
              )}
            </BentoCard>
          ) : (
            <View style={{ gap: S.sm, marginBottom: S.md }}>
              {/* Tamamlanan alışkanlıklar — tam liste */}
              {(() => {
                const doneHabits = personalHabits.filter(h => {
                  const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
                  return dates.includes(todayKey) && !completingHabitIds.has(h.id);
                });
                if (doneHabits.length === 0) return null;
                return (
                  <View style={{ gap: S.xs, marginBottom: S.sm }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.success, opacity: 0.7, letterSpacing: 1, paddingHorizontal: S.sm }}>
                      {tr ? `✓ BUGÜN TAMAMLANDI (${doneHabits.length})` : `✓ DONE TODAY (${doneHabits.length})`}
                    </Text>
                    {doneHabits.map(habit => (
                      <View
                        key={habit.id}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.md, paddingVertical: 10, borderRadius: R.lg,
                          backgroundColor: theme.success + (isDark ? '12' : '0D'),
                          borderWidth: B.thin, borderColor: theme.success + '18' }}
                      >
                        <Touchable
                          onPress={() => toggleHabitExpand(habit.id)}
                          onLongPress={() => handleLongPressHabit(habit.id, habit.name)}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.md }}
                          activeOpacity={0.8}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (habit.color ?? theme.success) + '22', alignItems: 'center', justifyContent: 'center' }}>
                            {renderModeEmojiIcon(habit.emoji ?? '📌', 16, habit.color ?? theme.success)}
                          </View>
                          <Text style={{ flex: 1, fontSize: F.body, fontWeight: '500', color: theme.onSurfaceVariant, textDecorationLine: 'line-through', opacity: 0.55 }} numberOfLines={expandedHabitIds.has(habit.id) ? undefined : 1}>
                            {habit.name}
                          </Text>
                        </Touchable>
                        <Touchable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: true }}
                          accessibilityLabel={tr ? `${habit.name} — tamamlandı, geri al` : `${habit.name} — done, undo`}
                          onPress={() => handleToggleHabit(habit.id)}
                          style={{ padding: S.xs }}
                          activeOpacity={0.7}
                        >
                          <Check size={14} color={theme.success} strokeWidth={3} />
                        </Touchable>
                      </View>
                    ))}
                  </View>
                );
              })()}
              {[...personalHabits]
                .filter((h) => {
                  const safeDates = Array.isArray(h.completedDates) ? h.completedDates : [];
                  const doneToday = safeDates.includes(todayKey);
                  return !doneToday || completingHabitIds.has(h.id);
                })
                .sort((a, b) => getStreak(b) - getStreak(a))
                .map((habit, hIdx) => {
                const safeColor = habit.color ?? '#6366F1';
                const safeDates = Array.isArray(habit.completedDates) ? habit.completedDates : [];
                const safeSkipped = Array.isArray(habit.skippedDates) ? habit.skippedDates : [];
                const isSkipped = safeSkipped.includes(todayKey);
                const streak = getStreak({ ...habit, completedDates: safeDates, skippedDates: safeSkipped });
                const doneToday = safeDates.includes(todayKey);
                const habitExitAnim = habitExitAnimMap.current.get(habit.id);
                return (
                  <Animated.View key={habit.id} style={habitExitAnim ? { opacity: habitExitAnim.opacity, transform: [{ translateY: habitExitAnim.translateY }] } : undefined}>
                    <SwipeableHabitItem
                      onDelete={() => handleDeleteHabit(habit.id, habit.name)}
                      onSkip={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        toggleSkipDate(habit.id, todayKey);
                      }}
                      isSkipped={isSkipped}
                      showPeekHint={showSwipeHint && hIdx === 0}
                    >
                      <Touchable
                        onPress={() => toggleHabitExpand(habit.id)}
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
                                  numberOfLines={expandedHabitIds.has(habit.id) ? undefined : 1}
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
                                    const isToday = k === todayKey;
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
                            <Touchable
                              onPress={() => handleToggleHabit(habit.id)}
                              onLongPress={() => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                toggleSkipDate(habit.id, todayKey);
                              }}
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
                              accessibilityLabel={tr ? 'Bugün tamamlandı olarak işaretle' : 'Mark done today'}
                            >
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
                style={[styles.addHabitRow, { borderColor: theme.outline + '50' }]}
              >
                <Plus size={15} color={theme.onSurfaceVariant} />
                <Text style={[styles.addHabitText, { color: theme.onSurfaceVariant }]}>
                  {tr ? 'Alışkanlık Ekle' : 'Add Habit'}
                </Text>
              </Touchable>
            </View>
          )}

          {/* ── WEEKLY REVIEW ── */}
          <TourTarget id="weeklyReview">
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {tr ? 'Haftalık Özet' : 'Weekly Review'}
            </Text>
          </View>

          <BentoCard index={habits.length + 2} style={{ gap: S.md, marginBottom: S.lg }}>
            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {[
                {
                  icon: <Check size={15} color={theme.success} strokeWidth={3} />,
                  value: String(thisWeekCompleted),
                  label: tr ? 'Tamamlandı' : 'Completed',
                  accent: theme.success,
                },
                {
                  icon: <Clock size={15} color={theme.primary} />,
                  value: focusLabel,
                  label: tr ? 'Odak' : 'Focus',
                  accent: theme.primary,
                },
                {
                  icon: <Flame size={15} color={theme.streak} />,
                  value: `${habitsThisWeekPct}%`,
                  label: tr ? 'Alışkanlık' : 'Habits',
                  accent: theme.streak,
                },
              ].map((stat, i) => (
                <View
                  key={i}
                  style={[
                    styles.statChip,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                      flex: 1,
                    },
                  ]}
                >
                  {stat.icon}
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statValue, { color: stat.accent }]}>
                    {stat.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Weekly goal chip */}
            {!!weeklyGoal && (
              <View style={[
                styles.goalChip,
                { backgroundColor: theme.primary + '12', borderColor: theme.primary + '25' },
              ]}>
                <Target size={13} color={theme.primary} />
                <Text style={[styles.goalText, { color: theme.primary }]} numberOfLines={2}>
                  {weeklyGoal}
                </Text>
                <Touchable accessibilityRole="button" accessibilityLabel={tr ? 'Haftalık planı aç' : 'Open weekly plan'} onPress={() => { setPlanGoal(weeklyGoal); preparePlan(); setPlanVisible(true); }}>
                  <ChevronRight size={15} color={theme.primary} />
                </Touchable>
              </View>
            )}

            {/* Plan / Goal button */}
            <Touchable
              onPress={() => {
                setPlanGoal(weeklyGoal);
                preparePlan();
                setPlanVisible(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={[
                styles.planBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' },
              ]}
            >
              <Sparkles size={15} color={theme.primary} />
              <Text style={[styles.planBtnText, { color: theme.onSurface, flex: 1 }]}>
                {showPlanButton
                  ? (tr ? 'Gelecek Haftayı Planla' : 'Plan Next Week')
                  : (tr ? 'Haftalık Hedefi Güncelle' : 'Update Weekly Goal')}
              </Text>
              <ChevronRight size={15} color={theme.onSurfaceVariant} />
            </Touchable>
          </BentoCard>
          </TourTarget>
        </ScrollView>
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
                backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface,
                paddingBottom: Math.max(insets.bottom, S.xl),
                maxHeight: screenHeight - insets.top - 16,
              },
            ]}
          >
            <View
              {...addPan.panHandlers}
              style={styles.handleArea}
            >
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface, marginBottom: 0 }]}>
                {tr ? 'Yeni Alışkanlık' : 'New Habit'}
              </Text>
              <View style={{ backgroundColor: newColor + '20', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {renderModeEmojiIcon('🔄', 10, newColor)}
                <Text style={{ fontSize: 10, fontWeight: '600', color: newColor, letterSpacing: 0.3 }}>
                  {tr ? 'Her gün takip edilir' : 'Tracked daily'}
                </Text>
              </View>
            </View>

            {/* Name input */}
            <View style={[
              styles.nameInput,
              {
                backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerLowest,
                borderColor: theme.outline + '40',
              },
            ]}>
              {renderModeEmojiIcon(newEmoji, 22, newColor)}
              <TextInput
                ref={nameInputRef}
                value={newName}
                onChangeText={setNewName}
                placeholder={tr ? 'Alışkanlık adı...' : 'Habit name...'}
                placeholderTextColor={theme.onSurfaceVariant + '80'}
                style={[styles.nameInputText, { color: theme.onSurface }]}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={handleAddHabit}
                underlineColorAndroid="transparent"
              />
            </View>

            {/* Emoji row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.md }}>
              <View style={{ flexDirection: 'row', gap: S.sm, paddingVertical: 2 }}>
                {HABIT_EMOJIS.map((e) => (
                  <Touchable
                    key={e}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: e === newEmoji }}
                    accessibilityLabel={tr ? `Simge ${e}` : `Icon ${e}`}
                    onPress={() => setNewEmoji(e)}
                    style={[
                      styles.emojiBtn,
                      {
                        backgroundColor: e === newEmoji ? theme.primary + '22' : 'transparent',
                        borderColor: e === newEmoji ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    {renderModeEmojiIcon(
                      e,
                      22,
                      e === newEmoji ? newColor : (isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.4)')
                    )}
                  </Touchable>
                ))}
              </View>
            </ScrollView>

            {/* Color row */}
            <View style={{ flexDirection: 'row', gap: S.md, marginBottom: S.xl }}>
              {habitColors.map((c) => (
                <Touchable
                  key={c}
                  onPress={() => setNewColor(c)}
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor: c,
                      transform: [{ scale: c === newColor ? 1.3 : 1 }],
                      borderWidth: c === newColor ? 2.5 : 0,
                      borderColor: isDark ? 'rgba(255,255,255,0.9)' : '#fff',
                    },
                  ]}
                />
              ))}
            </View>

            <Touchable
              onPress={handleAddHabit}
              disabled={!newName.trim()}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: newName.trim()
                    ? theme.primary
                    : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                },
              ]}
            >
              <Text style={[
                styles.saveBtnText,
                { color: newName.trim() ? theme.onPrimary : theme.onSurfaceVariant },
              ]}>
                {tr ? 'Ekle' : 'Add'}
              </Text>
            </Touchable>
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
                backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface,
                paddingBottom: Math.max(insets.bottom, S.xl),
                maxHeight: screenHeight - insets.top - 16,
              },
            ]}
          >
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
                  borderColor: theme.outline + '40',
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
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      <HelpTourModal 
        pageId="cockpit" 
        onStepChange={handleStepChange} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  floatingTopBar: { borderRadius: R.full, overflow: 'hidden', borderWidth: B.thin },
  topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.sm },
  headerIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
  headerSub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Week strip
  sectionLabel: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1.5, marginBottom: S.md },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  dayCell: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    borderRadius: 10, borderWidth: B.thin, gap: 4,
  },
  dayAbbr: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 13, fontWeight: '700' },
  taskDot: { width: 5, height: 5, borderRadius: 2.5 },

  // Day tasks card
  dayTasksCard: { borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden' },
  dayTasksHeading: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1, padding: S.md, paddingBottom: S.sm },
  dayTaskRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: 10 },
  miniCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: B.medium, alignItems: 'center', justifyContent: 'center' },
  dayTaskText: { flex: 1, fontSize: F.body, fontWeight: '600' },
  priorityPip: { width: 6, height: 6, borderRadius: 3 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: S.sm,
  },
  sectionTitle: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1.5 },
  sectionSub: { fontSize: 11, fontWeight: '600' },

  // Empty state
  emptyTitle: { fontSize: F.subhead, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: F.body, textAlign: 'center', marginBottom: S.lg, lineHeight: 20, paddingHorizontal: S.md },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: 12, borderRadius: R.full },
  emptyAddText: { fontSize: F.body, fontWeight: '600' },

  // Habit row
  habitCard: { borderRadius: R.lg, borderWidth: B.thin, padding: S.md, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 2 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  habitLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  habitIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  habitName: { fontSize: F.body, fontWeight: '600' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  streakText: { fontSize: 11, fontWeight: '600' },

  // Heatmap
  heatmapGrid: { gap: 2 },
  heatmapRow: { flexDirection: 'row', gap: 2 },
  heatCell: { width: 11, height: 11, borderRadius: 3 },

  // Check button
  checkBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: B.medium, alignItems: 'center', justifyContent: 'center' },
  deleteHabitBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  // Add habit row
  addHabitRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    borderWidth: B.thin, borderStyle: 'dashed', borderRadius: R.lg,
    padding: S.md, justifyContent: 'center',
  },
  addHabitText: { fontSize: F.body, fontWeight: '500' },

  // Weekly stats
  statChip: { alignItems: 'center', padding: S.md, borderRadius: R.md, gap: 4 },
  statValue: { fontSize: F.title, fontWeight: '600', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '500', opacity: 0.7 },
  goalChip: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md, borderWidth: B.thin },
  goalText: { flex: 1, fontSize: F.body, fontWeight: '500' },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md },
  planBtnText: { fontSize: F.body, fontWeight: '600' },

  // Sheets
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: S.xl, paddingTop: S.md, gap: S.md },
  handleArea: { paddingTop: 14, paddingBottom: 18, alignItems: 'center' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: F.title, fontWeight: '600', letterSpacing: -0.5 },
  sheetSub: { fontSize: F.body, marginTop: -S.sm },

  nameInput: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    borderRadius: R.md, borderWidth: B.thin, paddingHorizontal: S.md, paddingVertical: 12,
  },
  nameInputText: { flex: 1, fontSize: F.subhead, fontWeight: '500' },
  emojiBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: B.medium },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  goalInput: { borderRadius: R.md, borderWidth: B.thin, padding: S.md, fontSize: F.body, fontWeight: '600', minHeight: 88 },
  saveBtn: { paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
  saveBtnText: { fontSize: F.subhead, fontWeight: '600' },
});

