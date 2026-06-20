import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, KeyboardAvoidingView, Platform, Alert, Dimensions,
  Animated, useWindowDimensions,
} from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import {
  Plus, Check, Flame, Clock, Target,
  ChevronRight, Sparkles, CalendarDays, Trash2,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTaskStore } from '../store/useTaskStore';
import { useFocusStore } from '../store/useFocusStore';
import { useHabitStore, Habit, fmtDateKey } from '../store/useHabitStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { FocusService } from '../services/api';
import { S, R, F } from '../constants/tokens';

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

const DAY_LABELS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_LABELS_EN_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS_EN_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CockpitScreen() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { language } = useLanguageStore();
  const { tasks } = useTaskStore();
  const { habits, addHabit, removeHabit, toggleDate, weeklyGoal, setWeeklyGoal, getStreak } = useHabitStore();
  const { seasonal } = usePrefsStore();
  const hasActiveSeasonalMode = seasonal.ramazan || seasonal.examMode || seasonal.tezMode || seasonal.mulakatMode;

  const todayKey = fmtDateKey();
  const tr = language === 'tr';
  const weekStart: 0 | 1 = tr ? 1 : 0;
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const last28 = useMemo(() => getLast28Days(), []);

  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [addVisible, setAddVisible] = useState(false);
  const [showDayHint, setShowDayHint] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [completingHabitIds, setCompletingHabitIds] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('💪');
  const [newColor, setNewColor] = useState(HABIT_COLORS[0]);
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

  useEffect(() => {
    AsyncStorage.getItem('tazq-day-hint-shown').then(val => {
      if (!val) {
        setShowDayHint(true);
        setTimeout(() => setShowDayHint(false), 4000);
        AsyncStorage.setItem('tazq-day-hint-shown', 'true').catch(() => {});
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

  // Week strip data
  const weekData = useMemo(() => {
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    return weekDays.map((d) => {
      const key = fmtDateKey(d);
      const dayTasks = tasks.filter(
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
  }, [tasks, weekDays, todayKey]);

  // Tasks for selected day
  const selectedDayTasks = useMemo(() =>
    tasks.filter((t) => t.dueDate && fmtDateKey(new Date(t.dueDate)) === selectedDay),
    [tasks, selectedDay]
  );

  // Weekly stats
  const weekKeys = useMemo(() => new Set(weekDays.map(fmtDateKey)), [weekDays]);

  const thisWeekCompleted = useMemo(() =>
    tasks.filter(
      (t) => t.isCompleted && t.dueDate && weekKeys.has(fmtDateKey(new Date(t.dueDate)))
    ).length,
    [tasks, weekKeys]
  );

  const habitsThisWeekPct = useMemo(() => {
    const total = habits.length * 7;
    if (total === 0) return 0;
    const done = habits.reduce(
      (acc, h) => acc + (Array.isArray(h.completedDates) ? h.completedDates : []).filter((d) => weekKeys.has(d)).length,
      0
    );
    return Math.round((done / total) * 100);
  }, [habits, weekKeys]);

  const todayDow = new Date().getDay(); // 0 Sun … 6 Sat
  const showPlanButton = todayDow === 0 || todayDow >= 4;

  const handleAddHabit = () => {
    if (!newName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addHabit(newName.trim(), newEmoji, newColor);
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
        { text: tr ? 'Sil' : 'Delete', style: 'destructive', onPress: () => removeHabit(id) },
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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: theme.onSurface }]}>
              {tr ? 'HAFTALIK MERKEZ' : 'WEEKLY HUB'}
            </Text>
            <Text style={[styles.headerSub, { color: theme.onSurfaceVariant }]}>
              {`${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${weekDays[6].toLocaleString(
                tr ? 'tr-TR' : 'en-US', { month: 'long' }
              )}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { prepareAdd(); setAddVisible(true); }}
            style={[styles.addBtn, { backgroundColor: isDark ? '#F4F4F5' : '#0F0F0F' }]}
          >
            <Plus size={18} color={isDark ? '#09090B' : '#FFFFFF'} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── WEEK STRIP ── */}
          <BentoCard index={0} style={{ padding: S.md, marginBottom: S.md }}>
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
                    <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '800' }}>
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
                  <TouchableOpacity
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
                  </TouchableOpacity>
                );
              })}
            </View>
          </BentoCard>

          {/* ── SELECTED DAY TASKS ── */}
          <AnimatePresence>
            {selectedDayTasks.length === 0 && selectedDay !== todayKey ? (
              <MotiView
                key={`empty-${selectedDay}`}
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'timing', duration: 250 }}
                style={{ paddingVertical: S.sm, alignItems: 'center', marginBottom: S.md }}
              >
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.45 }}>
                  {tr ? 'Bu gün için planlanmış görev yok' : 'No tasks planned for this day'}
                </Text>
              </MotiView>
            ) : selectedDayTasks.length > 0 ? (
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
                    marginBottom: S.md,
                  },
                ]}
              >
                <Text style={[styles.dayTasksHeading, { color: theme.onSurfaceVariant }]}>
                  {selectedDayLabel}
                </Text>
                {selectedDayTasks.slice(0, 4).map((task, idx) => (
                  <TouchableOpacity
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
                      numberOfLines={1}
                    >
                      {task.title}
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
                  </TouchableOpacity>
                ))}
                {selectedDayTasks.length > 4 && (
                  <TouchableOpacity
                    onPress={() => router.push({
                      pathname: '/tasks',
                      params: selectedDay === todayKey
                        ? { filter: 'today' }
                        : { dateFilter: selectedDay },
                    })}
                    style={[styles.dayTaskRow, { borderTopColor: theme.outline + '20', borderTopWidth: 1, justifyContent: 'center' }]}
                  >
                    <Text style={{ fontSize: F.caption, fontWeight: '800', color: theme.primary }}>
                      +{selectedDayTasks.length - 4} {tr ? 'daha' : 'more'}
                    </Text>
                  </TouchableOpacity>
                )}
              </MotiView>
            ) : null}
          </AnimatePresence>

          {/* ── HABITS ── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {tr ? 'ALIŞKANLIKLAR' : 'HABITS'}
            </Text>
            <Text style={[styles.sectionSub, { color: theme.onSurfaceVariant }]}>
              {tr ? 'Son 28 gün' : 'Last 28 days'}
            </Text>
          </View>

          {habits.length === 0 ? (
            <BentoCard index={1} style={{ alignItems: 'center', paddingVertical: S.xl, marginBottom: S.md }}>
              <MotiView
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ loop: true, duration: 2800 }}
                style={{ marginBottom: S.md, opacity: 0.35 }}
              >
                <Flame size={40} color={theme.primary} />
              </MotiView>
              {hasActiveSeasonalMode ? (
                <>
                  <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>
                    {tr ? 'Planı Ana Ekrandan Uygula' : 'Apply Plan from Home'}
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>
                    {tr
                      ? 'Dönemsel modun aktif. Ana ekrandaki "Planı Uygula" butonuna bas.'
                      : 'Seasonal mode is active. Tap "Apply Plan" on the Home screen.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.replace('/')}
                    style={[styles.emptyAddBtn, { backgroundColor: theme.primary }]}
                  >
                    <Text style={[styles.emptyAddText, { color: theme.onPrimary }]}>
                      {tr ? 'Ana Ekrana Git' : 'Go to Home'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>
                    {tr ? 'İlk alışkanlığını ekle' : 'Add your first habit'}
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.onSurfaceVariant }]}>
                    {tr
                      ? 'Küçük alışkanlıklar büyük dönüşümler yaratır.'
                      : 'Small habits create big transformations.'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { prepareAdd(); setAddVisible(true); }}
                    style={[styles.emptyAddBtn, { backgroundColor: theme.primary }]}
                  >
                    <Plus size={15} color={theme.onPrimary} />
                    <Text style={[styles.emptyAddText, { color: theme.onPrimary }]}>
                      {tr ? 'Alışkanlık Ekle' : 'Add Habit'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </BentoCard>
          ) : (
            <View style={{ gap: S.sm, marginBottom: S.md }}>
              {/* Tamamlanan alışkanlıklar — tam liste */}
              {(() => {
                const doneHabits = habits.filter(h => {
                  if (!h || !h.id) return false;
                  const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
                  return dates.includes(todayKey) && !completingHabitIds.has(h.id);
                });
                if (doneHabits.length === 0) return null;
                return (
                  <View style={{ gap: S.xs, marginBottom: S.sm }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: theme.success, opacity: 0.7, letterSpacing: 1, paddingHorizontal: S.sm }}>
                      {tr ? `✓ BUGÜN TAMAMLANDI (${doneHabits.length})` : `✓ DONE TODAY (${doneHabits.length})`}
                    </Text>
                    {doneHabits.map(habit => (
                      <TouchableOpacity
                        key={habit.id}
                        onPress={() => handleToggleHabit(habit.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.md, paddingVertical: 10, borderRadius: R.lg,
                          backgroundColor: theme.success + (isDark ? '12' : '0D'),
                          borderWidth: 1, borderColor: theme.success + '18' }}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (habit.color ?? theme.success) + '22', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 16 }}>{habit.emoji ?? '📌'}</Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: F.body, fontWeight: '700', color: theme.onSurfaceVariant, textDecorationLine: 'line-through', opacity: 0.55 }} numberOfLines={1}>
                          {habit.name}
                        </Text>
                        <Check size={14} color={theme.success} strokeWidth={3} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })()}
              {[...habits]
                .filter((h) => {
                  if (!h || !h.id) return false;
                  const safeDates = Array.isArray(h.completedDates) ? h.completedDates : [];
                  const doneToday = safeDates.includes(todayKey);
                  // Show: not done today, OR currently in exit animation
                  return !doneToday || completingHabitIds.has(h.id);
                })
                .sort((a, b) => getStreak(b) - getStreak(a))
                .map((habit, hIdx) => {
                const safeColor = habit.color ?? '#6366F1';
                const safeDates = Array.isArray(habit.completedDates) ? habit.completedDates : [];
                const streak = getStreak({ ...habit, completedDates: safeDates });
                const doneToday = safeDates.includes(todayKey);
                const habitExitAnim = habitExitAnimMap.current.get(habit.id);
                return (
                  <Animated.View key={`${habit.id}-${hIdx}`} style={habitExitAnim ? { opacity: habitExitAnim.opacity, transform: [{ translateY: habitExitAnim.translateY }] } : undefined}>
                  <View style={[styles.habitCard, { backgroundColor: isDark ? '#1C1C22' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                    <View style={styles.habitRow}>
                      {/* Emoji + name + streak */}
                      <View style={styles.habitLeft}>
                        <View style={[styles.habitIcon, { backgroundColor: safeColor + '22' }]}>
                          <Text style={{ fontSize: 20 }}>{habit.emoji ?? '📌'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.habitName, { color: theme.onSurface }]} numberOfLines={1}>
                            {habit.name}
                          </Text>
                          <View style={styles.streakRow}>
                            <Flame
                              size={11}
                              color={streak > 0 ? theme.streak : theme.onSurfaceVariant}
                            />
                            <Text style={[
                              styles.streakText,
                              { color: streak > 0 ? theme.streak : theme.onSurfaceVariant },
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
                              const isToday = k === todayKey;
                              return (
                                <View
                                  key={k}
                                  style={[
                                    styles.heatCell,
                                    {
                                      backgroundColor: done
                                        ? safeColor
                                        : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                                      borderWidth: isToday ? 1.5 : 0,
                                      borderColor: safeColor,
                                    },
                                  ]}
                                />
                              );
                            })}
                          </View>
                        ))}
                      </View>

                      {/* Check button */}
                      <TouchableOpacity
                        onPress={() => handleToggleHabit(habit.id)}
                        style={[
                          styles.checkBtn,
                          {
                            backgroundColor: doneToday ? safeColor : 'transparent',
                            borderColor: doneToday
                              ? safeColor
                              : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                          },
                        ]}
                        accessibilityLabel={tr ? 'Bugün tamamlandı olarak işaretle' : 'Mark done today'}
                      >
                        <MotiView
                          animate={{ scale: doneToday ? 1 : 0.6, opacity: doneToday ? 1 : 0.45 }}
                          transition={{ type: 'spring', damping: 14 }}
                        >
                          <Check
                            size={15}
                            color={doneToday ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)')}
                            strokeWidth={3}
                          />
                        </MotiView>
                      </TouchableOpacity>

                      {/* Delete button */}
                      <TouchableOpacity
                        onPress={() => handleDeleteHabit(habit.id, habit.name)}
                        style={[styles.deleteHabitBtn]}
                        accessibilityLabel={tr ? 'Alışkanlığı sil' : 'Delete habit'}
                      >
                        <Trash2 size={14} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  </Animated.View>
                );
              })}

              <TouchableOpacity
                onPress={() => { prepareAdd(); setAddVisible(true); }}
                style={[styles.addHabitRow, { borderColor: theme.outline + '50' }]}
              >
                <Plus size={15} color={theme.onSurfaceVariant} />
                <Text style={[styles.addHabitText, { color: theme.onSurfaceVariant }]}>
                  {tr ? 'Alışkanlık Ekle' : 'Add Habit'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── WEEKLY REVIEW ── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>
              {tr ? 'HAFTALIK ÖZET' : 'WEEKLY REVIEW'}
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
                  <Text style={[styles.statValue, { color: stat.accent }]}>
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
                <TouchableOpacity onPress={() => { setPlanGoal(weeklyGoal); preparePlan(); setPlanVisible(true); }}>
                  <ChevronRight size={15} color={theme.primary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Plan / Goal button */}
            <TouchableOpacity
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
            </TouchableOpacity>
          </BentoCard>
        </ScrollView>
      </SafeAreaView>

      {/* ══ ADD HABIT SHEET ══ */}
      <Modal
        visible={addVisible}
        transparent
        animationType="none"
        onRequestClose={() => setAddVisible(false)}
        onShow={() => addSlideIn()}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddVisible(false)} />
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
              <Text style={[styles.sheetTitle, { color: theme.onSurface, marginBottom: 0 }]}>
                {tr ? 'Yeni Alışkanlık' : 'New Habit'}
              </Text>
              <View style={{ backgroundColor: newColor + '20', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 10 }}>🔄</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: newColor, letterSpacing: 0.3 }}>
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
              <Text style={{ fontSize: 22 }}>{newEmoji}</Text>
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
              />
            </View>

            {/* Emoji row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S.md }}>
              <View style={{ flexDirection: 'row', gap: S.sm, paddingVertical: 2 }}>
                {HABIT_EMOJIS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setNewEmoji(e)}
                    style={[
                      styles.emojiBtn,
                      {
                        backgroundColor: e === newEmoji ? theme.primary + '22' : 'transparent',
                        borderColor: e === newEmoji ? theme.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Color row */}
            <View style={{ flexDirection: 'row', gap: S.md, marginBottom: S.xl }}>
              {HABIT_COLORS.map((c) => (
                <TouchableOpacity
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

            <TouchableOpacity
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
            </TouchableOpacity>
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPlanVisible(false)} />
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
            <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
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
            />

            <TouchableOpacity
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
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    gap: S.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: F.caption, fontWeight: '900', letterSpacing: 1.5 },
  headerSub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Week strip
  sectionLabel: { fontSize: F.caption, fontWeight: '900', letterSpacing: 1.5, marginBottom: S.md },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCell: {
    flex: 1, alignItems: 'center', paddingVertical: S.sm,
    borderRadius: R.md, borderWidth: 1, gap: 3,
  },
  dayAbbr: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 13, fontWeight: '800' },
  taskDot: { width: 5, height: 5, borderRadius: 2.5 },

  // Day tasks card
  dayTasksCard: { borderRadius: R.lg, borderWidth: 1, overflow: 'hidden' },
  dayTasksHeading: { fontSize: F.caption, fontWeight: '900', letterSpacing: 1, padding: S.md, paddingBottom: S.sm },
  dayTaskRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: 10 },
  miniCheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayTaskText: { flex: 1, fontSize: F.body, fontWeight: '600' },
  priorityPip: { width: 6, height: 6, borderRadius: 3 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: S.sm,
  },
  sectionTitle: { fontSize: F.caption, fontWeight: '900', letterSpacing: 1.5 },
  sectionSub: { fontSize: 11, fontWeight: '600' },

  // Empty state
  emptyTitle: { fontSize: F.subhead, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  emptySub: { fontSize: F.body, textAlign: 'center', marginBottom: S.lg, lineHeight: 20, paddingHorizontal: S.md },
  emptyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: 12, borderRadius: R.full },
  emptyAddText: { fontSize: F.body, fontWeight: '800' },

  // Habit row
  habitCard: { borderRadius: R.lg, borderWidth: 1, padding: S.md, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 2 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  habitLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  habitIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  habitName: { fontSize: F.body, fontWeight: '800' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  streakText: { fontSize: 11, fontWeight: '800' },

  // Heatmap
  heatmapGrid: { gap: 2 },
  heatmapRow: { flexDirection: 'row', gap: 2 },
  heatCell: { width: 11, height: 11, borderRadius: 3 },

  // Check button
  checkBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  deleteHabitBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  // Add habit row
  addHabitRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: R.lg,
    padding: S.md, justifyContent: 'center',
  },
  addHabitText: { fontSize: F.body, fontWeight: '700' },

  // Weekly stats
  statChip: { alignItems: 'center', padding: S.md, borderRadius: R.md, gap: 4 },
  statValue: { fontSize: F.title, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '700', opacity: 0.7 },
  goalChip: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md, borderWidth: 1 },
  goalText: { flex: 1, fontSize: F.body, fontWeight: '700' },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md },
  planBtnText: { fontSize: F.body, fontWeight: '800' },

  // Sheets
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: S.xl, paddingTop: S.md, gap: S.md },
  handleArea: { paddingTop: 14, paddingBottom: 18, alignItems: 'center' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: F.title, fontWeight: '900', letterSpacing: -0.5 },
  sheetSub: { fontSize: F.body, marginTop: -S.sm },

  nameInput: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    borderRadius: R.md, borderWidth: 1, paddingHorizontal: S.md, paddingVertical: 12,
  },
  nameInputText: { flex: 1, fontSize: F.subhead, fontWeight: '700' },
  emojiBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  goalInput: { borderRadius: R.md, borderWidth: 1, padding: S.md, fontSize: F.body, fontWeight: '600', minHeight: 88 },
  saveBtn: { paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
  saveBtnText: { fontSize: F.subhead, fontWeight: '900' },
});
