import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Platform, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Animated } from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { BentoCard } from '../components/BentoCard';
import { DynamicIsland } from '../components/DynamicIsland';
import { BottomNavBar } from '../components/BottomNavBar';
import { MotiView, MotiText } from 'moti';
import { Plus, FileText, Zap, Play, Rocket, ChevronRight, BrainCircuit, Target, TrendingUp, Flame, Check } from 'lucide-react-native';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { TaskService, FocusService, DailyFocusData } from '../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../hooks/useAppTheme';
import { TazqLogo } from '../components/TazqLogo';
import { useFocusStore } from '../store/useFocusStore';
import { StatusHub } from '../components/StatusHub';
import { LinearGradient } from 'expo-linear-gradient';
import { parseTaskHint } from '../utils/taskParser';
import { getSmartInsight } from '../utils/insights';
import { S, R, F } from '../constants/tokens';
import { getAvatarSource } from '../utils/avatars';
import { useToastStore } from '../store/useToastStore';
import { useMomentumStore } from '../store/useMomentumStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { TurkishModeBanner } from '../components/TurkishModeBanner';
import { MomentumPulse } from '../components/MomentumPulse';
import { detectTurkishMode, getCustomExamMode } from '../utils/turkishModes';
import { scheduleWeeklySummary } from '../utils/notifications';
import { useAchievementStore } from '../store/useAchievementStore';
import { checkStreakAchievement, checkMomentumAchievement, ACHIEVEMENTS } from '../utils/achievements';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { tasks, isLoading, setTasks, setLoading, addTask } = useTaskStore();
  const { user } = useAuthStore();
  const { t, language } = useLanguageStore();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show: showToast } = useToastStore();
  const { recordScore, getLastNDays } = useMomentumStore();
  const { trigger: triggerAchievement } = useAchievementStore();
  const { seasonal, weeklyNotification, examPlanHabitIds, examPlanTaskIds, ramazanPlanHabitIds, ramazanPlanTaskIds, tezPlanHabitIds, tezPlanTaskIds, mulakatPlanHabitIds, mulakatPlanTaskIds, setPlanIds } = usePrefsStore();

  // Focus Store
  const { isActive, seconds, setCurrentTask, setDuration, setIsActive, dailyFocusMinutes, dailyGoalMinutes, updateBestStreak } = useFocusStore();

  // State
  const [statusHubVisible, setStatusHubVisible] = useState(false);
  const [modeDismissed, setModeDismissed] = useState(false);
  const [quickDraftVisible, setQuickDraftVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [chipHighlights, setChipHighlights] = useState([false, false, false]);
  const [headerHighlight, setHeaderHighlight] = useState(false);
  const [todayHighlight, setTodayHighlight] = useState(false);
  const [momentumHighlight, setMomentumHighlight] = useState(false);
  const [todayBurstKey, setTodayBurstKey] = useState(0);
  const [momentumBurstKey, setMomentumBurstKey] = useState(0);
  const chipTapTimes = useRef([0, 0, 0]);
  const headerTapTime = useRef(0);
  const todayTapTime = useRef(0);
  const momentumTapTime = useRef(0);
  const chipScales = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const headerScale = useRef(new Animated.Value(1)).current;

  const { panResponder: draftPan, animatedStyle: draftSlide, prepare: prepareDraft, slideIn: draftSlideIn } = useSwipeToDismiss({
    onDismiss: () => setQuickDraftVisible(false),
  });

  const { panResponder: hubPan, animatedStyle: hubSlide, prepare: prepareHub, slideIn: hubSlideIn } = useSwipeToDismiss({
    onDismiss: () => setStatusHubVisible(false),
  });
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [weeklyFocus, setWeeklyFocus] = useState<DailyFocusData[]>([]);
  const [streak, setStreak] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  // Compute daily goal from real data
  const todayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate).toDateString() === new Date().toDateString();
  });
  const todayCompleted = todayTasks.filter(t => t.isCompleted).length;
  const dailyGoal = todayTasks.length || 1;

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.warn('fetchTasks error:', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const stats = await FocusService.getStats();
      setWeeklyFocus(stats.weeklyFocus || []);
      const active = stats.activeStreak || 0;
      setStreak(active);
      updateBestStreak(active);
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.warn('fetchStats error:', e.message);
      }
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    const now = new Date();
    const msUntilNextHour = (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000;
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      setCurrentHour(new Date().getHours());
      interval = setInterval(() => setCurrentHour(new Date().getHours()), 3600000);
    }, msUntilNextHour);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, []);

  const handleQuickSave = async () => {
    if (!draftTitle.trim()) return;
    setIsSavingDraft(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
        const hint = parseTaskHint(draftTitle.trim());
        const isReminder = hint.tags?.includes('hatırlatıcı') || hint.tags?.includes('reminder');
        
        const payload = {
            title: draftTitle.trim(),
            description: '',
            priority: hint.priority || 'Medium',
            isCompleted: false,
            dueDate: hint.dueDate || (isReminder ? new Date().toISOString() : null),
            dueTime: hint.dueTime || null,
            tags: hint.tags?.length ? hint.tags : ['Draft']
        };

        const created = await TaskService.createTask(payload as any);
        addTask(created);

        // Schedule notification if it's a reminder
        if (created.id && isReminder) {
            const { scheduleTaskNotification } = require('../utils/notifications');
            await scheduleTaskNotification(created.id, payload.title, payload.dueDate, payload.dueTime, language);
        }

        setDraftTitle('');
        setQuickDraftVisible(false);
        showToast(`"${payload.title}" ${t.toastTaskAdded}`, 'success');
    } catch (error: any) {
        if (!error.response) {
          showToast(t.toastNoConnection, 'error');
        } else {
          showToast(t.saveError, 'error');
        }
    } finally {
        setIsSavingDraft(false);
    }
  };

  // Compute metrics
  const weeklyMinutes = weeklyFocus.reduce((s: number, d: any) => s + (d.minutes || 0), 0);

  // Trend: compare second half of week vs first half as a proxy for week-over-week direction
  const weekTrend = (() => {
    if (weeklyFocus.length < 4) return null;
    const half = Math.floor(weeklyFocus.length / 2);
    const firstHalf = weeklyFocus.slice(0, half).reduce((s: number, d: any) => s + (d.minutes || 0), 0);
    const secondHalf = weeklyFocus.slice(half).reduce((s: number, d: any) => s + (d.minutes || 0), 0);
    if (firstHalf === 0) return null;
    return Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  })();
  const completedCount = tasks.filter(t => t.isCompleted).length;
  const totalCount = tasks.length || 1;
  const completionRate = completedCount / totalCount;
  const focusScore = Math.min(weeklyMinutes / 300, 1);
  const streakScore = Math.min(streak / 14, 1);
  const momentum = Math.round(completionRate * 40 + focusScore * 35 + streakScore * 25);
  const warningColor = isDark ? '#FFB340' : '#FF9500';
  const momentumColor = momentum >= 75 ? theme.tertiary : momentum >= 40 ? warningColor : theme.primary;

  // Momentum history (last 7 days for sparkline)
  const momentumHistory = getLastNDays(7);

  // Daily target: how many tasks + minutes needed to hit 75
  const targetTasks = Math.max(0, Math.ceil(((75 - momentum) / 40) * totalCount));
  const targetFocusMin = Math.max(0, Math.ceil(((75 - momentum) / 35) * 300 - weeklyMinutes));
  const alreadyAt75 = momentum >= 75;

  // Turkish mode (only if user opted in)
  const detectedMode = detectTurkishMode();
  const activeMode = (() => {
    if (seasonal.examMode && seasonal.examName && seasonal.examDate) {
      return getCustomExamMode(seasonal.examName, seasonal.examDate);
    }
    if (!detectedMode) return null;
    if (detectedMode.type === 'ramazan' && seasonal.ramazan) return detectedMode;
    return null;
  })();

  const activePlanApplied = (() => {
    if (!activeMode) return false;
    const t = activeMode.type;
    if (t === 'exam' || t === 'yks' || t === 'kpss')
      return examPlanHabitIds.length > 0 || examPlanTaskIds.length > 0;
    if (t === 'ramazan')
      return ramazanPlanHabitIds.length > 0 || ramazanPlanTaskIds.length > 0;
    if (t === 'tez')
      return tezPlanHabitIds.length > 0 || tezPlanTaskIds.length > 0;
    if (t === 'mulakat')
      return mulakatPlanHabitIds.length > 0 || mulakatPlanTaskIds.length > 0;
    return false;
  })();

  // Track last scheduled values to avoid re-firing on every momentum change
  const lastScheduledNotifRef = useRef({ momentum: -1, streak: -1 });

  // Save daily momentum + reschedule weekly notification + check achievements
  useEffect(() => {
    if (statsLoading) return;
    recordScore(momentum);
    if (weeklyNotification &&
        (momentum !== lastScheduledNotifRef.current.momentum || streak !== lastScheduledNotifRef.current.streak)) {
      lastScheduledNotifRef.current = { momentum, streak };
      scheduleWeeklySummary(momentum, streak, language);
    }

    // Streak achievements
    const streakAch = checkStreakAchievement(streak);
    if (streakAch) triggerAchievement(streakAch);

    // Momentum achievements
    const momAch = checkMomentumAchievement(momentum);
    if (momAch) triggerAchievement(momAch);
  }, [momentum, streak, statsLoading]);

  // Daily perfect: all tasks completed
  useEffect(() => {
    if (statsLoading || tasks.length === 0) return;
    if (tasks.every(t => t.isCompleted)) {
      triggerAchievement(ACHIEVEMENTS.daily_perfect);
    }
  }, [tasks, statsLoading]);

  // Smart Logic: Prioritize Today's Tasks
  const todayDateString = new Date().toDateString();
  const todayTasksIncomplete = tasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate).toDateString() === todayDateString);
  const futureTasksIncomplete = tasks.filter(t => !t.isCompleted && (!t.dueDate || new Date(t.dueDate).toDateString() !== todayDateString));

  const topTaskToday = todayTasksIncomplete[0];
  const highPriorityToday = todayTasksIncomplete.find(t => t.priority === 'High');
  const topTask = topTaskToday || futureTasksIncomplete[0];

  const insight = getSmartInsight(language as 'tr' | 'en', isActive, momentum, highPriorityToday, topTaskToday, futureTasksIncomplete);

  const startQuickFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const target = topTaskToday || futureTasksIncomplete[0];
    // Pre-fill task name if available, otherwise let user set it on focus screen
    if (target) setCurrentTask(target.title);
    // setDuration resets isActive to false internally — set both together after
    const secs = 25 * 60;
    useFocusStore.setState({ totalSeconds: secs, seconds: secs, isActive: true, lastActiveAt: Date.now() });
    setStatusHubVisible(false);
    router.replace('/focus');
  };

  const momentumLabel = momentum >= 75 ? t.momentumHigh : momentum >= 40 ? t.momentumMid : t.momentumLow;
  const dayLabels: string[] = t.dayLabels;

  const chipSurprises = language === 'tr'
    ? [
        { icon: '🔥', label: 'YAKIYORSUN!' },
        { icon: '⚡', label: 'KONSANTRESSİN!' },
        { icon: '✅', label: 'HARIKA İŞ!' },
      ]
    : [
        { icon: '🔥', label: 'ON FIRE!' },
        { icon: '⚡', label: 'FOCUSED!' },
        { icon: '✅', label: 'GREAT JOB!' },
      ];

  const handleChipDoubleTap = (idx: number) => {
    const now = Date.now();
    if (now - chipTapTimes.current[idx] < 380) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.spring(chipScales[idx], { toValue: 1.2, useNativeDriver: true, damping: 4, stiffness: 400 } as any),
        Animated.spring(chipScales[idx], { toValue: 0.9, useNativeDriver: true, damping: 8, stiffness: 400 } as any),
        Animated.spring(chipScales[idx], { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 300 } as any),
      ]).start();
      setChipHighlights(prev => prev.map((v, i) => i === idx ? true : v));
      setTimeout(() => setChipHighlights(prev => prev.map((v, i) => i === idx ? false : v)), 1500);
    }
    chipTapTimes.current[idx] = now;
  };

  const todaySurprise = (() => {
    if (todayCompleted >= dailyGoal) return language === 'tr' ? '🏆 MÜKEMMEL GÜN!' : '🏆 PERFECT DAY!';
    const pct = todayCompleted / Math.max(dailyGoal, 1);
    if (pct >= 0.5) return language === 'tr' ? '📈 YARIYA GELDİN!' : '📈 HALFWAY THERE!';
    if (todayCompleted === 0) return language === 'tr' ? '💪 HAYDI BAKALIM!' : '💪 LET\'S GO!';
    return language === 'tr' ? '⚡ DEVAM ET!' : '⚡ KEEP GOING!';
  })();

  const momentumSurprise = (() => {
    if (momentum >= 75) return language === 'tr' ? '🚀 MUHTEŞEM!' : '🚀 INCREDIBLE!';
    if (momentum >= 40) return language === 'tr' ? '📈 İVME KAZANIYORSUN!' : '📈 GAINING SPEED!';
    return language === 'tr' ? '💡 HER GÜN BİR ADIM!' : '💡 ONE STEP AT A TIME!';
  })();

  const handleTodayDoubleTap = () => {
    const now = Date.now();
    if (now - todayTapTime.current < 380) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTodayBurstKey(k => k + 1);
      setTodayHighlight(true);
      setTimeout(() => setTodayHighlight(false), 1600);
    }
    todayTapTime.current = now;
  };

  const handleMomentumDoubleTap = () => {
    const now = Date.now();
    if (now - momentumTapTime.current < 380) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMomentumBurstKey(k => k + 1);
      setMomentumHighlight(true);
      setTimeout(() => setMomentumHighlight(false), 1600);
    }
    momentumTapTime.current = now;
  };

  const handleHeaderDoubleTap = () => {
    const now = Date.now();
    if (now - headerTapTime.current < 380) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.spring(headerScale, { toValue: 1.06, useNativeDriver: true, damping: 5, stiffness: 300 } as any),
        Animated.spring(headerScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 } as any),
      ]).start();
      setHeaderHighlight(true);
      setTimeout(() => setHeaderHighlight(false), 1800);
    }
    headerTapTime.current = now;
  };

  const getGreeting = () => {
    if (currentHour >= 5 && currentHour < 13) return t.greetingMorning;
    if (currentHour >= 13 && currentHour < 18) return t.greetingAfternoon;
    if (currentHour >= 18 && currentHour < 23) return t.greetingEvening;
    return t.greetingNight;
  };

  const getSubGreeting = (): string => {
    const incomplete = tasks.filter(x => !x.isCompleted).length;
    const tr = language === 'tr';
    if (isActive) {
      return tr ? 'Harika! Odak seansın devam ediyor. 🔥' : "You're crushing it! Focus session in progress. 🔥";
    }
    if (incomplete === 0) {
      return tr ? 'Temiz sayfa — yeni bir hedef eklemek ister misin?' : 'Clean slate — want to add a new goal?';
    }
    if (incomplete === 1) {
      return tr ? 'Sadece 1 görevin kaldı. Kolayca bitirebilirsin!' : 'Just 1 task left. You can finish this!';
    }
    if (incomplete <= 5) {
      return tr ? `${incomplete} görevin var. Hadi devam edelim!` : `${incomplete} tasks waiting. Let's keep going!`;
    }
    if (momentum >= 75) {
      return tr ? `${incomplete} görev var ama sen zirvedesin — durdurulamaz!` : `${incomplete} tasks, but you're at peak momentum!`;
    }
    return tr ? `${incomplete} görevin seni bekliyor.` : `${incomplete} tasks are waiting for you.`;
  };

  const priorityColor = (p: string) => {
    if (p === 'High') return '#ff3b30';
    if (p === 'Medium') return '#ff9f0a';
    return '#34c759';
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* TopBar */}
        <View style={[styles.topBarWrapper]}>
            <MotiView
                from={{ translateY: -20, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                style={[
                    styles.floatingTopBar,
                    {
                        backgroundColor: isDark ? 'rgba(14,14,14,0.6)' : 'rgba(255,255,255,0.7)',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    },
                    isDark ? styles.darkTopBarShadow : styles.lightTopBarShadow
                ]}
            >
                <BlurView
                    intensity={isDark ? 50 : 30}
                    tint={colorScheme}
                    style={StyleSheet.absoluteFill}
                />
                <View style={[styles.topBarContent, { paddingHorizontal: S.md }]}>
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <TazqLogo height={24} />
                        </View>
                    </View>

                    <TouchableOpacity onPress={() => router.push('/cockpit')} style={styles.avatarContainer}>
                        <Image
                            source={getAvatarSource(user?.avatar || null)}
                            style={styles.avatar}
                        />
                    </TouchableOpacity>

                    <StatusHub onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); prepareHub(); setStatusHubVisible(true); }} />
                </View>
            </MotiView>
        </View>

        {/* Smart Cockpit Modal — bottom sheet */}
        <Modal visible={statusHubVisible} transparent animationType="none" onRequestClose={() => setStatusHubVisible(false)} onShow={() => hubSlideIn()}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setStatusHubVisible(false)} />
                <Animated.View style={[hubSlide, styles.insightCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: theme.outlineVariant + '40', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                    <View {...hubPan.panHandlers} style={{ paddingTop: 12, paddingBottom: 8, alignItems: 'center' }}>
                        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }} />
                    </View>

                    <View style={styles.insightHeader}>
                        <View style={[styles.insightIcon, { backgroundColor: theme.primary + '15' }]}>
                            <BrainCircuit size={20} color={theme.primary} />
                        </View>
                        <Text style={[styles.insightHeaderTitle, { color: theme.onSurface }]}>TAZQ INSIGHTS</Text>
                    </View>

                    <View style={styles.insightBody}>
                        <View style={[styles.bentoMini, { backgroundColor: theme.surfaceContainerLow }]}>
                            <Text style={[styles.insightMainText, { color: theme.onSurface }]}>
                                {insight}
                            </Text>
                        </View>

                        <View style={styles.insightStats}>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                                    <Zap size={16} color={momentumColor} fill={momentumColor} />
                                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{momentum}%</Text>
                                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>Momentum</Text>
                                </View>
                                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                                    <Target size={16} color={theme.secondary} />
                                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{todayCompleted}/{dailyGoal}</Text>
                                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.cockpitTarget}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.cockpitActions}>
                        <TouchableOpacity
                            onPress={() => {
                                if (isActive) {
                                    setStatusHubVisible(false);
                                    router.replace('/focus');
                                } else {
                                    startQuickFocus();
                                }
                            }}
                            style={[styles.actionButtonMain, { backgroundColor: isActive ? theme.tertiary : theme.primary }]}
                        >
                            <Play size={20} color={theme.onPrimary} fill={theme.onPrimary} />
                            <Text style={[styles.actionButtonText, { color: theme.onPrimary }]}>
                                {isActive ? t.cockpitGoToFocus :
                                 (!topTaskToday && futureTasksIncomplete.length > 0 ? t.cockpitPrepTomorrow :
                                 t.cockpitFocusNow)}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setStatusHubVisible(false)}
                            style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceContainerHigh }]}
                        >
                            <Text style={[styles.actionButtonTextSecondary, { color: theme.onSurfaceVariant }]}>
                                {t.cockpitClose}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>

        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingTop: S.lg, paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTasks} tintColor={theme.primary} />}
        >
            {/* Welcome Hero */}
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={[styles.heroSection, { paddingHorizontal: S.lg }]}
            >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', flexShrink: 1, overflow: 'hidden' }}>
                    <Text style={[styles.greeting, { color: theme.onSurface, fontSize: 28, lineHeight: 34, flexShrink: 0 }]} numberOfLines={1}>
                        {getGreeting()},
                    </Text>
                    <Text
                        style={[styles.greeting, { color: theme.primary, fontSize: 28, lineHeight: 34, flexShrink: 1, maxWidth: 180 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {` ${user?.name?.split(' ')[0] || (language === 'tr' ? 'sen' : 'you')}`}
                    </Text>
                </View>
                <Text style={[styles.subGreeting, { color: theme.onSurfaceVariant, fontSize: F.subhead }]}>
                    {getSubGreeting()}
                </Text>
            </MotiView>

            {/* Focus Widget */}
            <DynamicIsland />

            {/* Next Mission Widget */}
            <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <MotiView
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', damping: 15 }}
                >
                    <BentoCard index={0} style={[styles.nextMissionCard, { minHeight: 180 }]}>
                        <LinearGradient
                            colors={!topTask
                                ? ['#8e8e93', 'transparent']
                                : topTask.priority === 'High'
                                ? ['#ff3b30', 'transparent']
                                : topTask.priority === 'Medium'
                                ? ['#ff9f0a', 'transparent']
                                : ['#34c759', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.25 : 0.12 }]}
                        />
                        <View style={styles.missionHeader}>
                            <View style={[styles.missionBadge, { backgroundColor: (topTask ? priorityColor(topTask.priority) : theme.primary) + '20' }]}>
                                <Rocket size={12} color={topTask ? priorityColor(topTask.priority) : theme.primary} />
                                <Text style={[styles.missionBadgeText, { color: topTask ? priorityColor(topTask.priority) : theme.primary }]}>{t.activeTask.toUpperCase()}</Text>
                            </View>
                            {topTask?.priority === 'High' && (
                                <View style={[styles.missionBadge, { backgroundColor: theme.error + '20' }]}>
                                    <Zap size={12} color={theme.error} fill={theme.error} />
                                    <Text style={[styles.missionBadgeText, { color: theme.error }]}>{language === 'tr' ? 'ACİL' : 'URGENT'}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.missionContent}>
                            <Text style={[styles.missionTitle, { color: theme.onSurface, fontSize: F.title }]} numberOfLines={1} ellipsizeMode="tail">
                                {topTask ? topTask.title : t.noTasksHint}
                            </Text>
                            <Text style={[styles.missionSub, { color: theme.onSurfaceVariant }]}>
                                {topTask ? (topTask.description || t.waitingForAction) : t.allTasksReady}
                            </Text>
                        </View>

                        <View style={[styles.missionFooter, { gap: S.sm }]}>
                            {topTask ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                        setCurrentTask(topTask.title);
                                        const secs = 25 * 60;
                                        useFocusStore.setState({ totalSeconds: secs, seconds: secs, isActive: false, lastActiveAt: null });
                                        router.replace('/focus');
                                    }}
                                    style={[styles.startBtn, { backgroundColor: theme.primary, flex: 2, height: 52, justifyContent: 'center' }]}
                                >
                                    <Play size={18} color={theme.onPrimary} fill={theme.onPrimary} />
                                    <Text style={[styles.startBtnText, { color: theme.onPrimary, fontSize: F.subhead, fontWeight: '900' }]}>{t.deepFocus.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    onPress={() => router.push('/tasks')}
                                    style={[styles.startBtn, { backgroundColor: theme.surfaceContainerHigh, flex: 2, height: 52, justifyContent: 'center' }]}
                                >
                                    <Plus size={18} color={theme.onSurface} />
                                    <Text style={[styles.startBtnText, { color: theme.onSurface, fontSize: F.subhead, fontWeight: '900' }]}>{t.addTask.toUpperCase()}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                onPress={() => router.push('/tasks')} 
                                style={[styles.seeAllBtn, { flex: 1, height: 52, justifyContent: 'flex-end', paddingRight: 4 }]}
                            >
                                <Text style={[styles.seeAllText, { color: theme.onSurfaceVariant, fontSize: F.body }]}>{t.filterAll}</Text>
                                <ChevronRight size={16} color={theme.onSurfaceVariant} />
                            </TouchableOpacity>
                        </View>
                    </BentoCard>
                </MotiView>
            </View>

            {/* ── Momentum Pulse ── */}
            <MomentumPulse
              score={momentum}
              history={momentumHistory}
              language={language}
              loading={statsLoading}
            />

            {/* ── Turkish Mode Banner (opt-in) ── */}
            {activeMode && !modeDismissed && (
              <View style={{ paddingHorizontal: S.lg }}>
                <TurkishModeBanner
                mode={activeMode}
                onDismiss={() => setModeDismissed(true)}
                planApplied={activePlanApplied}
                planHabitIds={(() => {
                  const t = activeMode.type;
                  if (t === 'exam' || t === 'yks' || t === 'kpss') return examPlanHabitIds;
                  if (t === 'ramazan') return ramazanPlanHabitIds;
                  if (t === 'tez') return tezPlanHabitIds;
                  if (t === 'mulakat') return mulakatPlanHabitIds;
                  return [];
                })()}
                planTaskIds={(() => {
                  const t = activeMode.type;
                  if (t === 'exam' || t === 'yks' || t === 'kpss') return examPlanTaskIds;
                  if (t === 'ramazan') return ramazanPlanTaskIds;
                  if (t === 'tez') return tezPlanTaskIds;
                  if (t === 'mulakat') return mulakatPlanTaskIds;
                  return [];
                })()}
                onApplied={(habitIds, taskIds) => {
                  const t = activeMode.type;
                  if (t === 'exam' || t === 'yks' || t === 'kpss') setPlanIds('exam', habitIds, taskIds);
                  else if (t === 'ramazan') setPlanIds('ramazan', habitIds, taskIds);
                  else if (t === 'tez') setPlanIds('tez', habitIds, taskIds);
                  else if (t === 'mulakat') setPlanIds('mulakat', habitIds, taskIds);
                }}
              />
              </View>
            )}

            {/* ── Section Header ── */}
            <TouchableOpacity onPress={handleHeaderDoubleTap} activeOpacity={1} style={{ paddingHorizontal: S.lg, marginBottom: S.sm }}>
                <Animated.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', transform: [{ scale: headerScale }] }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.8, color: headerHighlight ? theme.primary : theme.onSurfaceVariant, opacity: headerHighlight ? 1 : 0.45 }}>
                        {headerHighlight
                            ? (language === 'tr' ? '✦ İYİ GİDİYOR' : '✦ LOOKING GOOD')
                            : (language === 'tr' ? 'GENEL BAKIŞ' : 'OVERVIEW')}
                    </Text>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: headerHighlight ? theme.primary : theme.onSurfaceVariant, opacity: headerHighlight ? 0.7 : 0.3 }}>
                        {headerHighlight ? (language === 'tr' ? 'devam et →' : 'keep going →') : (language === 'tr' ? 'Bu Hafta' : 'This Week')}
                    </Text>
                </Animated.View>
            </TouchableOpacity>

            {/* Metrics Grid */}
            <View style={{ paddingHorizontal: S.lg, gap: S.md }}>

                {/* ── QUICK STATS STRIP ── */}
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                    {[
                        {
                            icon: <Flame size={16} color="#FF6B35" />,
                            value: statsLoading ? '--' : `${streak}`,
                            label: language === 'tr' ? 'günlük seri' : 'day streak',
                            color: '#FF6B35',
                        },
                        {
                            icon: <Zap size={16} color={theme.primary} fill={theme.primary} />,
                            value: statsLoading ? '--' : weeklyMinutes >= 60
                                ? `${Math.floor(weeklyMinutes / 60)}${language === 'tr' ? 'sa' : 'h'}`
                                : `${weeklyMinutes}${language === 'tr' ? 'dk' : 'm'}`,
                            label: language === 'tr' ? 'haftalık odak' : 'weekly focus',
                            color: theme.primary,
                        },
                        {
                            icon: <Check size={16} color="#34C759" strokeWidth={3} />,
                            value: `${Math.round(completionRate * 100)}%`,
                            label: language === 'tr' ? 'tamamlanma' : 'completion',
                            color: '#34C759',
                        },
                    ].map((stat, i) => {
                        const isHighlighted = chipHighlights[i];
                        return (
                            <TouchableOpacity key={i} onPress={() => handleChipDoubleTap(i)} activeOpacity={0.85} style={{ flex: 1 }}>
                                <MotiView
                                    from={{ opacity: 0, translateY: 10 }}
                                    animate={{ opacity: 1, translateY: 0 }}
                                    transition={{ type: 'spring', damping: 18, delay: i * 70 }}
                                >
                                    <Animated.View style={{
                                        transform: [{ scale: chipScales[i] }],
                                        backgroundColor: isHighlighted
                                            ? stat.color + '1C'
                                            : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                                        borderRadius: R.md,
                                        padding: S.md,
                                        alignItems: 'center',
                                        gap: 5,
                                        borderWidth: 1,
                                        borderColor: isHighlighted
                                            ? stat.color + '55'
                                            : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                                    }}>
                                        {isHighlighted
                                            ? <Text style={{ fontSize: 18, lineHeight: 20 }}>{chipSurprises[i].icon}</Text>
                                            : stat.icon}
                                        <Text style={{ fontSize: F.title, fontWeight: '900', letterSpacing: -1, color: stat.color, lineHeight: 26 }}>
                                            {stat.value}
                                        </Text>
                                        <Text style={{
                                            fontSize: 8, fontWeight: '800', letterSpacing: 0.4, textAlign: 'center',
                                            color: isHighlighted ? stat.color : theme.onSurfaceVariant,
                                            opacity: isHighlighted ? 1 : 0.55,
                                        }}>
                                            {isHighlighted ? chipSurprises[i].label : stat.label.toUpperCase()}
                                        </Text>
                                    </Animated.View>
                                </MotiView>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── WEEKLY FOCUS CHART ── */}
                <BentoCard index={1} style={{ padding: S.md, overflow: 'hidden' }}>
                    <LinearGradient
                        colors={isDark
                            ? [theme.primary + '12', 'transparent']
                            : [theme.primary + '0C', 'transparent']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Header row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: S.md }}>
                        <View>
                            <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: theme.onSurfaceVariant, opacity: 0.5, marginBottom: 3 }}>
                                {t.weeklyFocusLabel?.toUpperCase() ?? 'HAFTALIK ODAK'}
                            </Text>
                            <Text style={{ fontSize: F.title, fontWeight: '900', letterSpacing: -1.2, color: theme.onSurface, lineHeight: 26 }}>
                                {statsLoading ? '--' : weeklyMinutes >= 60
                                    ? `${Math.floor(weeklyMinutes / 60)}sa ${weeklyMinutes % 60 > 0 ? weeklyMinutes % 60 + 'dk' : ''}`
                                    : `${weeklyMinutes}dk`}
                            </Text>
                        </View>
                        {weekTrend !== null && !statsLoading && (
                            <View style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                backgroundColor: weekTrend >= 0 ? theme.tertiary + '1C' : theme.error + '1C',
                                borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 5,
                            }}>
                                <Text style={{ fontSize: 13, fontWeight: '900', color: weekTrend >= 0 ? theme.tertiary : theme.error }}>
                                    {weekTrend >= 0 ? '↑' : '↓'} {Math.abs(weekTrend)}%
                                </Text>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.55 }}>
                                    {language === 'tr' ? 'geçen hf' : 'vs last wk'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Bars */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 5 }}>
                        {(statsLoading
                            ? Array(7).fill({ minutes: 0 })
                            : weeklyFocus.length > 0 ? weeklyFocus : Array(7).fill({ minutes: 0 })
                        ).map((d: any, i: number) => {
                            const maxMin = Math.max(...(weeklyFocus.map((w: any) => w.minutes)), 1);
                            const pct = statsLoading ? (8 + i * 9) : Math.max((d.minutes / maxMin) * 100, 4);
                            const isToday = !statsLoading && i === weeklyFocus.length - 1;
                            const hasData = d.minutes > 0;
                            return (
                                <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    {isToday && hasData && (
                                        <Text style={{ fontSize: 8, fontWeight: '900', color: theme.primary, marginBottom: 3, letterSpacing: 0.1 }}>
                                            {d.minutes}dk
                                        </Text>
                                    )}
                                    <MotiView
                                        from={{ height: '0%' }}
                                        animate={{ height: `${pct}%`, opacity: statsLoading ? [0.2, 0.5, 0.2] : 1 }}
                                        transition={{ type: 'timing', duration: 600, delay: i * 55, loop: statsLoading }}
                                        style={{ width: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5, overflow: 'hidden' }}
                                    >
                                        {isToday ? (
                                            <LinearGradient
                                                colors={isDark
                                                    ? [theme.secondary, theme.primary]
                                                    : [theme.primary, theme.secondary]}
                                                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                                                style={{ flex: 1 }}
                                            />
                                        ) : (
                                            <View style={{
                                                flex: 1,
                                                backgroundColor: hasData
                                                    ? (isDark ? theme.primary + '35' : theme.primary + '28')
                                                    : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                                            }} />
                                        )}
                                    </MotiView>
                                </View>
                            );
                        })}
                    </View>

                    {/* Day labels */}
                    <View style={{ flexDirection: 'row', marginTop: S.sm }}>
                        {dayLabels.map((day, i) => {
                            const isToday = !statsLoading && i === (weeklyFocus.length - 1);
                            return (
                                <Text key={i} style={{
                                    flex: 1, textAlign: 'center', fontSize: 9,
                                    color: isToday ? theme.primary : theme.onSurfaceVariant,
                                    fontWeight: isToday ? '900' : '700',
                                    opacity: isToday ? 1 : 0.38,
                                    letterSpacing: 0.3,
                                }}>
                                    {day}
                                </Text>
                            );
                        })}
                    </View>
                </BentoCard>

                {/* ── TODAY CARD — full width, horizontal ── */}
                <TouchableOpacity onPress={handleTodayDoubleTap} activeOpacity={1}>
                <BentoCard index={2} style={{ overflow: 'hidden', padding: S.md }}>
                    <LinearGradient
                        colors={todayHighlight
                            ? (isDark ? [theme.tertiary + '45', 'transparent'] : [theme.tertiary + '30', 'transparent'])
                            : todayCompleted >= dailyGoal
                            ? (isDark ? [theme.tertiary + '30', 'transparent'] : [theme.tertiary + '20', 'transparent'])
                            : (isDark ? [theme.primary + '28', 'transparent'] : [theme.primary + '18', 'transparent'])}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.lg }}>
                        {/* Left: text stats */}
                        <View style={{ flex: 1, gap: 6 }}>
                            <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>{t.todayLabel}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                                <Text style={{ fontSize: 44, fontWeight: '900', letterSpacing: -2.5, color: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary, lineHeight: 48 }}>
                                    {todayCompleted}
                                </Text>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.45, letterSpacing: -0.5 }}>
                                    /{dailyGoal}
                                </Text>
                            </View>
                            <MotiView
                                key={`today-sub-${todayBurstKey}`}
                                from={{ scale: todayBurstKey > 0 ? 1.22 : 1, opacity: todayBurstKey > 0 ? 0 : 1 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', damping: 11, stiffness: 220 }}
                            >
                                <Text style={{ fontSize: F.caption, fontWeight: '800', letterSpacing: 0.3,
                                    color: todayHighlight ? (todayCompleted >= dailyGoal ? theme.tertiary : theme.primary) : theme.onSurfaceVariant,
                                    opacity: todayHighlight ? 1 : 0.55 }}>
                                    {todayHighlight
                                        ? todaySurprise
                                        : todayCompleted >= dailyGoal
                                        ? (language === 'tr' ? 'Tümü tamamlandı 🎉' : 'All done 🎉')
                                        : (language === 'tr' ? 'görev tamamlandı' : 'tasks completed')}
                                </Text>
                            </MotiView>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                <Zap size={10} color={theme.primary} fill={theme.primary} />
                                <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                    <MotiView
                                        animate={{ width: `${Math.min((dailyFocusMinutes / Math.max(dailyGoalMinutes, 1)) * 100, 100)}%` as any }}
                                        transition={{ type: 'timing', duration: 900 }}
                                        style={{ height: '100%', borderRadius: 2, backgroundColor: theme.primary }}
                                    />
                                </View>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: theme.onSurfaceVariant, opacity: 0.4 }}>
                                    {dailyFocusMinutes}{language === 'tr' ? 'dk' : 'm'}
                                </Text>
                            </View>
                        </View>
                        {/* Right: ring */}
                        <View style={{ width: 90, height: 90 }}>
                            <Svg width={90} height={90}>
                                <Defs>
                                    <SvgLinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                                        <Stop offset="0%" stopColor={todayCompleted >= dailyGoal ? theme.tertiary : theme.primary} stopOpacity="1" />
                                        <Stop offset="100%" stopColor={todayCompleted >= dailyGoal
                                            ? (isDark ? '#FB923C' : '#059669')
                                            : theme.secondary} stopOpacity="1" />
                                    </SvgLinearGradient>
                                </Defs>
                                <G rotation="-90" origin="45,45">
                                    <Circle cx="45" cy="45" r="37" fill="none"
                                        stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}
                                        strokeWidth={9} />
                                    <Circle cx="45" cy="45" r="37" fill="none"
                                        stroke="url(#ringGrad)"
                                        strokeWidth={9}
                                        strokeLinecap="round"
                                        strokeDasharray={`${2 * Math.PI * 37}`}
                                        strokeDashoffset={`${2 * Math.PI * 37 * (1 - Math.min(dailyGoal > 0 ? todayCompleted / dailyGoal : 0, 1))}`}
                                    />
                                </G>
                            </Svg>
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 22, fontWeight: '900', letterSpacing: -1.2, color: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary, lineHeight: 24 }}>
                                    {Math.round((todayCompleted / Math.max(dailyGoal, 1)) * 100)}
                                </Text>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: theme.onSurfaceVariant, opacity: 0.45 }}>%</Text>
                            </View>
                        </View>
                    </View>
                </BentoCard>
                </TouchableOpacity>


            </View>
        </ScrollView>

        {/* Quick Draft Modal */}
        <Modal visible={quickDraftVisible} transparent animationType="none" onRequestClose={() => setQuickDraftVisible(false)} onShow={() => draftSlideIn()}>
          <View style={styles.draftOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setQuickDraftVisible(false)} />
                <View style={[styles.bottomSheetWrapper, { marginBottom: keyboardHeight }]}>
                    <Animated.View style={[draftSlide, styles.quickDraftSheet, {
                          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                          paddingBottom: keyboardHeight > 0 ? S.md : S.xl,
                          borderBottomLeftRadius: keyboardHeight > 0 ? R.lg : 0,
                          borderBottomRightRadius: keyboardHeight > 0 ? R.lg : 0,
                        }]}>
                        <View {...draftPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
                          <View style={styles.sheetHandle} />
                        </View>
                        <View style={styles.sheetHeader}>
                            <View style={[styles.sheetIcon, { backgroundColor: theme.primaryContainer }]}>
                                <FileText size={20} color={theme.primary} />
                            </View>
                            <Text style={[styles.quickDraftTitle, { color: theme.onSurface }]}>{t.draftNote}</Text>
                        </View>

                        <View style={[styles.quickInputGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', marginTop: S.md }]}>
                            <TextInput 
                                style={[styles.quickInput, { color: theme.onSurface, height: 60 }]}
                                placeholder={t.draftPlaceholder}
                                placeholderTextColor={theme.onSurfaceVariant + '99'}
                                value={draftTitle}
                                onChangeText={setDraftTitle}
                                returnKeyType="done"
                                onSubmitEditing={handleQuickSave}
                            />
                        </View>

                        <View style={styles.quickActions}>
                            <TouchableOpacity 
                                onPress={handleQuickSave} 
                                disabled={isSavingDraft || !draftTitle.trim()} 
                                style={[styles.quickSave, { backgroundColor: draftTitle.trim() ? theme.primary : theme.surfaceContainerHigh, flex: 1 }]}
                            >
                                {isSavingDraft ? <ActivityIndicator color="white" /> : (
                                    <Text style={{ color: draftTitle.trim() ? 'white' : theme.onSurfaceVariant, fontWeight: '900' }}>{t.save}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
          </View>
        </Modal>

      </SafeAreaView>

      {/* Quick Draft FAB */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); prepareDraft(); setQuickDraftVisible(true); }}
        style={[styles.fab, { backgroundColor: isDark ? '#F4F4F5' : '#0F0F0F', shadowColor: '#000', bottom: Math.max(insets.bottom, 16) + 88 }]}
      >
        <Plus size={32} color={isDark ? '#09090B' : '#FFFFFF'} strokeWidth={3} />
      </TouchableOpacity>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBarWrapper: { paddingHorizontal: S.lg, paddingVertical: S.sm, alignItems: 'center' },
  floatingTopBar: { width: '100%', borderRadius: R.full, overflow: 'hidden', borderWidth: 1.2 },
  lightTopBarShadow: { shadowColor: '#2d2f31', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 8 },
  darkTopBarShadow: { shadowColor: '#3367ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.sm },
  avatarContainer: { width: 34, height: 34, borderRadius: R.full, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: '100%', height: '100%' },
  scrollContent: { flexGrow: 1 },
  heroSection: { marginBottom: S.lg },
  greeting: { fontWeight: '900', letterSpacing: -1.5 },
  subGreeting: { fontWeight: '500', marginTop: S.xs, opacity: 0.7 },
  metricLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, opacity: 0.45, marginBottom: S.xs },
  metricValue: { fontSize: F.title, fontWeight: '900', letterSpacing: -1 },
  metricSub: { fontSize: F.caption, fontWeight: '600', opacity: 0.6, marginTop: 2 },
  nextMissionCard: { padding: S.lg, justifyContent: 'space-between', overflow: 'hidden' },
  missionHeader: { flexDirection: 'row', gap: S.sm },
  missionBadge: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.md },
  missionBadgeText: { fontSize: F.caption, fontWeight: '900', letterSpacing: 0.5 },
  missionContent: { marginTop: S.sm },
  missionTitle: { fontWeight: '900', letterSpacing: -0.5 },
  missionSub: { fontSize: F.body, fontWeight: '500', marginTop: S.xs, opacity: 0.8 },
  missionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.md },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  startBtnText: { color: 'white', fontWeight: '900', fontSize: F.body },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  seeAllText: { fontSize: F.body, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  insightCard: { width: '100%', borderRadius: 32, padding: 24, borderWidth: 1, gap: 24 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightHeaderTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1, opacity: 0.6 },
  insightBody: { gap: 16 },
  bentoMini: { padding: 16, borderRadius: 20 },
  insightMainText: { fontSize: 16, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  insightStats: { gap: 12 },
  statBento: { padding: 16, borderRadius: 20, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', opacity: 0.5, letterSpacing: 0.5 },
  cockpitActions: { gap: 12 },
  actionButtonMain: { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  actionButtonText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  actionButtonSecondary: { height: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionButtonTextSecondary: { fontSize: 14, fontWeight: '800' },
  draftOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheetWrapper: { width: '100%' },
  quickDraftSheet: {
    width: '100%',
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: R.sm, backgroundColor: 'rgba(128,128,128,0.2)', alignSelf: 'center', marginBottom: S.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  sheetIcon: { width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  quickDraftTitle: { fontSize: F.title, fontWeight: '900', letterSpacing: -0.5 },
  quickInputGroup: { borderRadius: R.lg, paddingHorizontal: S.md, height: 64, justifyContent: 'center' },
  quickInput: { fontWeight: '700', fontSize: F.subhead },
  quickActions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  quickSave: { flex: 1, height: 56, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', paddingHorizontal: S.lg, gap: S.md, marginTop: S.md },
  actionBtn: { flex: 1, borderRadius: R.lg, alignItems: 'center', gap: S.sm },
  actionLabel: { fontWeight: '800' },
  fab: { position: 'absolute', right: S.lg, width: 64, height: 64, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 100, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 },
});

