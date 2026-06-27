import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Platform, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Animated } from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/useTaskStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { BentoCard } from '../components/BentoCard';
import { DynamicIsland } from '../components/DynamicIsland';
import { BottomNavBar } from '../components/BottomNavBar';
import { MotiView, MotiText } from 'moti';
import { Plus, Zap, Play, Rocket, ChevronRight, BrainCircuit, Target, TrendingUp, Flame, Check } from 'lucide-react-native';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { TaskService, FocusService, DailyFocusData } from '../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../hooks/useAppTheme';
import { TazqLogo } from '../components/TazqLogo';
import { PremiumStatChip } from '../components/PremiumStatChip';
import { useFocusStore } from '../store/useFocusStore';
import { StatusHub } from '../components/StatusHub';
import { LinearGradient } from 'expo-linear-gradient';
import { parseTaskHint } from '../utils/taskParser';
import { getSmartInsight } from '../utils/insights';
import { S, R, F, scale, verticalScale, moderateScale, B } from '../constants/tokens';
import { getAvatarSource } from '../utils/avatars';
import { useToastStore } from '../store/useToastStore';
import { useMomentumStore } from '../store/useMomentumStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { TurkishModeBanner } from '../components/TurkishModeBanner';
import { MomentumPulse } from '../components/MomentumPulse';
import { WeightEntryModal } from '../components/WeightEntryModal';
import { detectTurkishMode, getCustomExamMode } from '../utils/turkishModes';
import { scheduleWeeklySummary } from '../utils/notifications';
import { useAchievementStore } from '../store/useAchievementStore';
import { checkStreakAchievement, checkMomentumAchievement, ACHIEVEMENTS } from '../utils/achievements';
import { Touchable } from '@/components/Touchable';
import { DottedBackground } from '../components/DottedBackground';
import { useNetworkStore } from '../store/useNetworkStore';
import { useOfflineQueue } from '../store/useOfflineQueue';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  const { tasks, isLoading, setTasks, setLoading, addTask, toggleTaskCompletion } = useTaskStore(useShallow(state => ({
    tasks: state.tasks,
    isLoading: state.isLoading,
    setTasks: state.setTasks,
    setLoading: state.setLoading,
    addTask: state.addTask,
    toggleTaskCompletion: state.toggleTaskCompletion
  })));
  const { user } = useAuthStore();
  const { t, language } = useLanguageStore();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show: showToast } = useToastStore();
  const { recordScore, getLastNDays } = useMomentumStore();
  const { trigger: triggerAchievement, baseline: baselineAchievements } = useAchievementStore();
  const achHydrated = useAchievementStore(s => s._hasHydrated);
  const uiMode = usePrefsStore(s => s.uiMode);
  const { seasonal, weeklyNotification, examPlanHabitIds, examPlanTaskIds, ramazanPlanHabitIds, ramazanPlanTaskIds, tezPlanHabitIds, tezPlanTaskIds, mulakatPlanHabitIds, mulakatPlanTaskIds, setPlanIds, dismissedBannerKey, setDismissedBannerKey, avatarBorderColor } = usePrefsStore();

  // Focus Store
  const { isActive, seconds, setCurrentTask, setDuration, setIsActive, dailyFocusMinutes, dailyGoalMinutes, updateBestStreak } = useFocusStore();

  // State
  const [statusHubVisible, setStatusHubVisible] = useState(false);
  const [weightModalTaskId, setWeightModalTaskId] = useState<number | null>(null);
  const [quickDraftVisible, setQuickDraftVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [headerHighlight, setHeaderHighlight] = useState(false);
  const [todayHighlight, setTodayHighlight] = useState(false);
  const [momentumHighlight, setMomentumHighlight] = useState(false);
  const [todayBurstKey, setTodayBurstKey] = useState(0);
  const [momentumBurstKey, setMomentumBurstKey] = useState(0);
  const headerTapTime = useRef(0);
  const todayTapTime = useRef(0);
  const momentumTapTime = useRef(0);
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
  const overdueCount = tasks.filter(t =>
    !t.isCompleted && t.dueDate &&
    new Date(t.dueDate).setHours(23, 59, 59, 999) < Date.now() &&
    new Date(t.dueDate).toDateString() !== new Date().toDateString()
  ).length;

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
    
    const hint = parseTaskHint(draftTitle.trim(), language as 'tr' | 'en');
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

    try {
        const isOnline = useNetworkStore.getState().isOnline;
        if (!isOnline) {
          const tempId = -Date.now();
          useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
          addTask({ ...payload, id: tempId } as any);
          if (isReminder) {
            const { scheduleTaskNotification } = require('../utils/notifications');
            await scheduleTaskNotification(tempId, payload.title, payload.dueDate, payload.dueTime, language);
          }
          setDraftTitle('');
          setQuickDraftVisible(false);
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
        } else {
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
        }
    } catch (error: any) {
        if (!error.response) {
          const tempId = -Date.now();
          useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
          addTask({ ...payload, id: tempId } as any);
          if (isReminder) {
            const { scheduleTaskNotification } = require('../utils/notifications');
            await scheduleTaskNotification(tempId, payload.title, payload.dueDate, payload.dueTime, language);
          }
          setDraftTitle('');
          setQuickDraftVisible(false);
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
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
  // ── Professional Momentum Score ────────────────────────────────────────────
  // Priority weights: High=3pts, Medium=2pts, Low=1pt (prevents gaming with 1 easy task)
  const PRIORITY_WEIGHTS: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  // Recency decay: tasks from today count 100%, yesterday 90%, 2d ago 80%... (10% per day)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const weeklyTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) >= sevenDaysAgo);
  const totalCount = weeklyTasks.length;
  const completedCount = weeklyTasks.filter(t => t.isCompleted).length;

  // Priority-weighted completion rate with recency decay
  const weightedCompletion = (() => {
    if (weeklyTasks.length === 0) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let earnedPts = 0;
    let totalPts = 0;
    for (const task of weeklyTasks) {
      const taskDate = task.dueDate ? new Date(task.dueDate) : new Date();
      const daysAgo = Math.floor((today.getTime() - taskDate.getTime()) / 86400000);
      const recency = Math.max(0.3, 1 - daysAgo * 0.1); // 100% today → 30% min at 7d
      const weight = (PRIORITY_WEIGHTS[task.priority] || 1) * recency;
      totalPts += weight;
      if (task.isCompleted) earnedPts += weight;
    }
    return totalPts > 0 ? earnedPts / totalPts : 0;
  })();

  // Focus consistency bonus: daily distribution matters, not just total minutes
  // Reward spreading sessions across more days (up to 7)
  const focusActiveDays = weeklyFocus.filter((d: any) => (d.minutes || 0) >= 10).length;
  const focusVolumeScore = Math.min(weeklyMinutes / 280, 1); // 280 min/week = full score (4hrs/day × 70% efficiency)
  const focusConsistencyScore = focusActiveDays / 7;
  const focusScore = focusVolumeScore * 0.6 + focusConsistencyScore * 0.4;

  // Streak score with diminishing returns above 14 days (prevents purely streak-gaming)
  const streakScore = streak <= 14
    ? Math.min(streak / 14, 1)
    : 1 + Math.min((streak - 14) / 28, 0.15); // small bonus up to 1.15x for long streaks, capped

  // Habit completion component (from completion journal: last 7 days)
  const completionHistory = getLastNDays(7);
  const habitActivityDays = completionHistory.filter(d => d.score >= 0).length;
  const habitScore = habitActivityDays / 7;

  // Final weighted score (0-100)
  // Completion 38% | Focus 32% | Streak 20% | Habit activity 10%
  const rawMomentum = weightedCompletion * 38 + focusScore * 32 + Math.min(streakScore, 1.15) * 20 + habitScore * 10;
  const momentum = Math.min(100, Math.round(rawMomentum));
  const momentumColor = momentum >= 75 ? theme.tertiary : momentum >= 40 ? theme.warning : theme.primary;

  // Momentum history (last 7 days for sparkline)
  const momentumHistory = getLastNDays(7);

  // Daily target coaching: reverse-compute what's needed to hit 75
  const targetTasks = totalCount === 0 ? 3 : Math.max(0, Math.ceil(3 - completedCount));
  const targetFocusMin = Math.max(0, Math.ceil(280 * (1 - focusVolumeScore) / 7)); // daily shortfall
  const alreadyAt75 = momentum >= 75;

  // Turkish mode (only if user opted in)
  const detectedMode = detectTurkishMode();
  const activeMode = (() => {
    if (seasonal.examMode && seasonal.examName && seasonal.examDate) {
      return getCustomExamMode(seasonal.examName, seasonal.examDate);
    }
    if (!detectedMode) return null;
    if (detectedMode.type === 'ramazan' && seasonal.ramazan) return detectedMode;
    if ((detectedMode.type === 'yks' || detectedMode.type === 'kpss') && seasonal.examMode) return detectedMode;
    return null;
  })();

  // A unique key per mode period — changes when mode type or exam date changes, resetting dismiss
  const activeBannerKey = activeMode
    ? `${activeMode.type}-${seasonal.examDate ?? seasonal.mulakatDate ?? seasonal.tezDate ?? `auto-${new Date().getFullYear()}`}`
    : '';
  const modeDismissed = !!activeBannerKey && dismissedBannerKey === activeBannerKey;

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

    // ── BAŞARIMLAR ────────────────────────────────────────────────────────────
    // Lite modda gamification kapalı — kutlama/baseline çalışmaz (Pro'ya geçince
    // ilk değerlendirmede sessiz baseline alınır, spam olmaz).
    if (uiMode === 'lite') return;
    // Hidrasyon tamamlanmadan değerlendirme YAPMA (unlocked yüklenmeden tetiklenirse
    // tekrar kutlama olur).
    if (!achHydrated) return;

    const streakAch = checkStreakAchievement(streak);
    const momAch = checkMomentumAchievement(momentum);

    // İlk gözlemde SESSİZ baseline: kullanıcının şu an zaten hak ettiği eşikleri
    // kutlamadan kilitle (eski kullanıcı / hafıza kaybı sonrası konfeti yağmuru olmasın).
    // baselined=true ise no-op.
    const earned: string[] = [];
    if (streakAch) earned.push(streakAch.id);
    if (momAch) earned.push(momAch.id);
    baselineAchievements(earned);

    // Yalnız GERÇEKTEN yeni açılan eşikler kutlanır (trigger içte unlocked'ı kontrol eder;
    // baseline ile kilitlenenler burada no-op olur → "durum" değil "geçiş" kutlanır).
    if (streakAch) triggerAchievement(streakAch);
    if (momAch) triggerAchievement(momAch);
  }, [momentum, streak, statsLoading, achHydrated, uiMode]);

  // Daily perfect: all of today's tasks completed
  useEffect(() => {
    if (uiMode === 'lite' || statsLoading || !achHydrated || todayTasks.length === 0) return;
    if (todayTasks.every(t => t.isCompleted)) {
      triggerAchievement(ACHIEVEMENTS.daily_perfect);
    }
  }, [todayTasks, statsLoading, achHydrated, uiMode]);

  // Smart Logic: Prioritize Today's Tasks
  const todayDateString = new Date().toDateString();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  // Bugün vadesi gelen veya geçmiş (overdue) görevler
  const todayTasksIncomplete = tasks.filter(t => {
    if (t.isCompleted) return false;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due <= new Date(todayStart.getTime() + 86400000); // bugün sonu dahil
  });
  // Tarihi olmayan görevler — her zaman görünür (plan hedef özeti, mutfak düzeni vs.)
  const undatedTasksIncomplete = tasks.filter(t => !t.isCompleted && !t.dueDate);
  // Gelecek tarihli görevler — aksiyon merkezinde GÖSTERILMEZ, sadece tasks listesinde
  // (futureTasksIncomplete insight için tutulur ama topTask'a girmez)
  const futureTasksIncomplete = tasks.filter(t => {
    if (t.isCompleted || !t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due > new Date(todayStart.getTime() + 86400000);
  });

  const topTaskToday = todayTasksIncomplete[0] ?? undatedTasksIncomplete[0];
  const highPriorityToday = todayTasksIncomplete.find(t => t.priority === 'High') ?? undatedTasksIncomplete.find(t => t.priority === 'High');
  const topTask = topTaskToday; // gelecek tarihli task aksiyon merkezine girmiyor

  const insight = getSmartInsight(language as 'tr' | 'en', isActive, momentum, highPriorityToday, topTaskToday, undatedTasksIncomplete);

  const handleCheckTask = async (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.tags?.includes('weight_entry')) {
      Haptics.selectionAsync();
      setWeightModalTaskId(task.id);
      return;
    }
    if (task.isCompleted) return; // aksiyon merkezi sadece tamamlar, hiç geri almaz
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTaskCompletion(taskId);
    // Offline-first: çevrimdışıysa tamamlamayı kuyruğa al (optimistik UI korunur);
    // yoksa kullanıcının tamamlaması kaybolur.
    const isOnline = useNetworkStore.getState().isOnline;
    if (!isOnline) {
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: true, completedAt: new Date().toISOString() });
      return;
    }
    try {
      await TaskService.updateTask(taskId, { isCompleted: true });
    } catch (e: any) {
      if (!e?.response) {
        // Ağ hatası → kuyruğa al, optimistik tamamlamayı KORU
        useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: true, completedAt: new Date().toISOString() });
      } else {
        // Gerçek sunucu hatası → geri al
        toggleTaskCompletion(taskId);
      }
    }
  };

  const startQuickFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const target = topTaskToday;
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

  const tr = language === 'tr';

  const getStreakSurprise = useCallback(() => {
    const n = streak || 0;
    if (n === 0)  return { icon: '🌱', label: tr ? 'HADI BAŞLA!'    : 'START TODAY!',    tier: 'nudge'     } as const;
    if (n <= 3)   return { icon: '🔥', label: tr ? 'ISINIYORSUN!'   : 'WARMING UP!',     tier: 'celebrate' } as const;
    if (n <= 7)   return { icon: '⚡', label: tr ? 'GEL-İYOR!'      : 'GETTING HOT!',    tier: 'celebrate' } as const;
    if (n <= 14)  return { icon: '🔥', label: tr ? 'YAKIYORSUN!'    : 'ON FIRE!',        tier: 'celebrate' } as const;
    if (n <= 30)  return { icon: '🏆', label: tr ? 'HARIKA SERİ!'   : 'GREAT STREAK!',   tier: 'celebrate' } as const;
    return              { icon: '👑', label: tr ? 'EFSANE SERİ!'   : 'LEGENDARY!',      tier: 'celebrate' } as const;
  }, [streak, tr]);

  const getFocusSurprise = useCallback(() => {
    if (weeklyMinutes === 0)  return { icon: '💤', label: tr ? 'BUGÜN BAŞLA!'    : 'START TODAY!',   tier: 'nudge'     } as const;
    if (weeklyMinutes < 60)   return { icon: '🌱', label: tr ? 'ISINIYOR!'       : 'WARMING UP!',    tier: 'celebrate' } as const;
    if (weeklyMinutes < 120)  return { icon: '⚡', label: tr ? 'ODAKLISIN!'      : 'FOCUSED!',       tier: 'celebrate' } as const;
    if (weeklyMinutes < 240)  return { icon: '🔥', label: tr ? 'KONSANTRESSİN!' : 'DIALED IN!',     tier: 'celebrate' } as const;
    return                          { icon: '🚀', label: tr ? 'SÜPER ODAK!'     : 'SUPER FOCUS!',   tier: 'celebrate' } as const;
  }, [weeklyMinutes, tr]);


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
    if (p === 'High') return theme.priorityHigh;
    if (p === 'Medium') return theme.priorityMedium;
    return theme.priorityLow;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />
      {/* TopBar — sibling of SafeAreaView, uses insets.top to clear status bar */}
      <MotiView
          from={{ translateY: -20, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          style={[
              styles.floatingTopBar,
              {
                  position: 'absolute',
                  top: insets.top + S.sm,
                  left: S.lg,
                  right: S.lg,
                  zIndex: 100,
                  backgroundColor: Platform.OS === 'android' ? (isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)') : 'transparent',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  elevation: Platform.OS === 'android' ? 4 : 0,
              },
              Platform.OS !== 'android' && (isDark ? styles.darkTopBarShadow : styles.lightTopBarShadow)
          ]}
      >
          {Platform.OS !== 'android' && (
            <BlurView
                intensity={isDark ? 50 : 30}
                tint={colorScheme}
                style={StyleSheet.absoluteFill}
            />
          )}
          <View style={[styles.topBarContent, { paddingHorizontal: S.md }]}>
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <TazqLogo height={30} />
                  </View>
              </View>

              <Touchable
                  onPress={() => router.push('/profile')}
                  accessibilityRole="button"
                  accessibilityLabel={language === 'tr' ? 'Profil' : 'Profile'}
                  style={[
                      styles.avatarContainer,
                      {
                          borderWidth: (!avatarBorderColor || avatarBorderColor === 'transparent') ? 1 : 2.5,
                          borderColor: (!avatarBorderColor || avatarBorderColor === 'transparent') ? 'rgba(255,255,255,0.1)' : avatarBorderColor
                      }
                  ]}
              >
                  <Image
                      source={getAvatarSource(user?.avatar || null)}
                      style={styles.avatar}
                  />
              </Touchable>

              <StatusHub onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); prepareHub(); setStatusHubVisible(true); }} />
          </View>
      </MotiView>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Smart Cockpit Modal — bottom sheet */}
        <Modal visible={statusHubVisible} transparent animationType="none" onRequestClose={() => setStatusHubVisible(false)} onShow={() => hubSlideIn()}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
                <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setStatusHubVisible(false)} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'} />
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
                                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statValue, { color: theme.onSurface }]}>{momentum}%</Text>
                                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>Momentum</Text>
                                </View>
                                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                                    <Target size={16} color={theme.secondary} />
                                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statValue, { color: theme.onSurface }]}>{todayCompleted}/{dailyGoal}</Text>
                                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.cockpitTarget}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.cockpitActions}>
                        <Touchable
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
                        </Touchable>

                        <Touchable
                            onPress={() => setStatusHubVisible(false)}
                            style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceContainerHigh }]}
                        >
                            <Text style={[styles.actionButtonTextSecondary, { color: theme.onSurfaceVariant }]}>
                                {t.cockpitClose}
                            </Text>
                        </Touchable>
                    </View>
                </Animated.View>
            </View>
        </Modal>

        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingTop: Platform.OS === 'android' ? insets.top + 68 + S.lg : S.sm + 68 + S.lg, paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchTasks(); fetchStats(); }} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={isDark ? '#1a1b1e' : '#ffffff'} progressViewOffset={insets.top + S.sm + 44 + S.sm} />}
        >
            {/* Welcome Hero */}
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={[styles.heroSection, { paddingHorizontal: S.lg }]}
            >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', flexShrink: 1, overflow: 'hidden' }}>
                    <Text style={[styles.greeting, { color: theme.onSurface, fontSize: isSmallScreen ? 22 : 28, lineHeight: isSmallScreen ? 28 : 34, flexShrink: 0 }]} numberOfLines={1}>
                        {getGreeting()},
                    </Text>
                    <Text
                        style={[styles.greeting, { color: theme.primary, fontSize: isSmallScreen ? 22 : 28, lineHeight: isSmallScreen ? 28 : 34, flexShrink: 1, maxWidth: width * 0.42 }]}
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

            {/* ── TODAY CARD ── */}
            <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
            <Touchable onPress={handleTodayDoubleTap} activeOpacity={1}>
            <BentoCard index={0} style={{ overflow: 'hidden', padding: S.md }}>
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
                            <Text style={{ fontSize: isSmallScreen ? 34 : 44, fontWeight: '600', letterSpacing: -2.5, color: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary, lineHeight: isSmallScreen ? 38 : 48 }}>
                                {todayCompleted}
                            </Text>
                            <Text style={{ fontSize: 18, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.45, letterSpacing: -0.5 }}>
                                /{dailyGoal}
                            </Text>
                        </View>
                        <MotiView
                            key={`today-sub-${todayBurstKey}`}
                            from={{ scale: todayBurstKey > 0 ? 1.22 : 1, opacity: todayBurstKey > 0 ? 0 : 1 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 11, stiffness: 220 }}
                        >
                            <Text style={{ fontSize: F.caption, fontWeight: '600', letterSpacing: 0.3,
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
                            <Text style={{ fontSize: 9, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.4 }}>
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
                            <Text style={{ fontSize: 22, fontWeight: '600', letterSpacing: -1.2, color: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary, lineHeight: 24 }}>
                                {Math.round((todayCompleted / Math.max(dailyGoal, 1)) * 100)}
                            </Text>
                            <Text style={{ fontSize: 9, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.45 }}>%</Text>
                        </View>
                    </View>
                </View>
            </BentoCard>
            </Touchable>
            </View>

            {/* Today Tasks Quick-Check */}
            {(todayTasksIncomplete.length > 0 || overdueCount > 0) && (
              <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                {overdueCount > 0 && (
                  <Touchable
                    onPress={() => router.push('/tasks')}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm, paddingHorizontal: 2 }}
                  >
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.error }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.error, opacity: 0.85, flex: 1 }}>
                      {overdueCount} {language === 'tr' ? 'gecikmiş görev' : overdueCount === 1 ? 'overdue task' : 'overdue tasks'}
                    </Text>
                    <ChevronRight size={12} color={theme.error} opacity={0.5} />
                  </Touchable>
                )}
                {todayTasksIncomplete.length > 0 && (
                  <BentoCard index={1} style={{ padding: 0, overflow: 'hidden' }}>
                    {todayTasksIncomplete.slice(0, 3).map((task, i) => (
                      <Touchable
                        key={task.id}
                        onPress={() => router.push({ pathname: '/tasks', params: { highlightId: task.id } })}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingHorizontal: S.md, paddingVertical: 13,
                          borderBottomWidth: i < Math.min(2, todayTasksIncomplete.length - 1) ? 1 : 0,
                          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        }}
                      >
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: priorityColor(task.priority), marginRight: S.md }} />
                        <Text style={{ flex: 1, fontSize: F.body, fontWeight: '600', color: theme.onSurface }} numberOfLines={1}>{task.title}</Text>
                        <ChevronRight size={14} color={theme.onSurfaceVariant} opacity={0.3} style={{ marginLeft: S.sm }} />
                      </Touchable>
                    ))}
                    {todayTasksIncomplete.length > 3 && (
                      <Touchable
                        onPress={() => router.push('/tasks')}
                        activeOpacity={0.7}
                        style={{ paddingHorizontal: S.md, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.4, flex: 1 }}>
                          {language === 'tr' ? `+${todayTasksIncomplete.length - 3} görev daha` : `+${todayTasksIncomplete.length - 3} more`}
                        </Text>
                        <ChevronRight size={14} color={theme.onSurfaceVariant} opacity={0.3} />
                      </Touchable>
                    )}
                  </BentoCard>
                )}
              </View>
            )}

            {/* Focus Widget */}
            <DynamicIsland />

            {/* Next Mission Widget */}
            <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <MotiView
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', damping: 15 }}
                >
                    <BentoCard index={1} style={[styles.nextMissionCard, { minHeight: 140 }]}>
                        <LinearGradient
                            colors={!topTask
                                ? ['#8e8e93', 'transparent']
                                : topTask.priority === 'High'
                                ? [theme.priorityHigh, 'transparent']
                                : topTask.priority === 'Medium'
                                ? [theme.priorityMedium, 'transparent']
                                : [theme.priorityLow, 'transparent']}
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
                            <Text adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.missionTitle, { color: theme.onSurface, fontSize: F.title }]} numberOfLines={1} ellipsizeMode="tail">
                                {topTask ? topTask.title : t.noTasksHint}
                            </Text>
                            <Text style={[styles.missionSub, { color: theme.onSurfaceVariant }]}>
                                {topTask ? (topTask.description || t.waitingForAction) : t.allTasksReady}
                            </Text>
                        </View>

                        <View style={[styles.missionFooter, { gap: S.sm }]}>
                            {topTask ? (
                                <Touchable
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
                                    <Text style={[styles.startBtnText, { color: theme.onPrimary, fontSize: F.subhead, fontWeight: '600' }]}>{t.deepFocus.toUpperCase()}</Text>
                                </Touchable>
                            ) : (
                                <Touchable 
                                    onPress={() => router.push('/tasks')}
                                    style={[styles.startBtn, { backgroundColor: theme.surfaceContainerHigh, flex: 2, height: 52, justifyContent: 'center' }]}
                                >
                                    <Plus size={18} color={theme.onSurface} />
                                    <Text style={[styles.startBtnText, { color: theme.onSurface, fontSize: F.subhead, fontWeight: '600' }]}>{t.addTask.toUpperCase()}</Text>
                                </Touchable>
                            )}
                            <Touchable 
                                onPress={() => router.push('/tasks')} 
                                style={[styles.seeAllBtn, { flex: 1, height: 52, justifyContent: 'flex-end', paddingRight: 4 }]}
                            >
                                <Text style={[styles.seeAllText, { color: theme.onSurfaceVariant, fontSize: F.body }]}>{t.filterAll}</Text>
                                <ChevronRight size={16} color={theme.onSurfaceVariant} />
                            </Touchable>
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
                onDismiss={() => setDismissedBannerKey(activeBannerKey)}
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

            {/* ── Section Header — easter egg sadece aktifken görünür ── */}
            {headerHighlight && (
              <Touchable onPress={handleHeaderDoubleTap} activeOpacity={1} style={{ paddingHorizontal: S.lg, marginBottom: S.sm }}>
                <Animated.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', transform: [{ scale: headerScale }] }}>
                  <Text style={{ fontSize: 9, fontWeight: '600', letterSpacing: 1.8, color: theme.primary }}>
                    {language === 'tr' ? '✦ İYİ GİDİYOR' : '✦ LOOKING GOOD'}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: theme.primary, opacity: 0.7 }}>
                    {language === 'tr' ? 'devam et →' : 'keep going →'}
                  </Text>
                </Animated.View>
              </Touchable>
            )}

            {/* Metrics Grid */}
            <View style={{ paddingHorizontal: S.lg, gap: S.md }}>

                {/* ── QUICK STATS STRIP ── */}
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                    <PremiumStatChip
                        icon={<Flame size={16} color={theme.streak} />}
                        value={statsLoading ? '--' : `${streak}`}
                        label={tr ? 'günlük seri' : 'day streak'}
                        color={theme.streak}
                        isDark={isDark}
                        theme={theme}
                        getSurprise={getStreakSurprise}
                    />
                    <PremiumStatChip
                        icon={<Zap size={16} color={theme.primary} fill={theme.primary} />}
                        value={statsLoading ? '--' : weeklyMinutes >= 60
                            ? `${Math.floor(weeklyMinutes / 60)}${tr ? 'sa' : 'h'}`
                            : `${weeklyMinutes}${tr ? 'dk' : 'm'}`}
                        label={tr ? 'haftalık odak' : 'weekly focus'}
                        color={theme.primary}
                        isDark={isDark}
                        theme={theme}
                        getSurprise={getFocusSurprise}
                    />
                </View>

                {/* ── WEEKLY FOCUS CHART ── */}
                <BentoCard index={2} style={{ padding: S.md, overflow: 'hidden' }}>
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
                            <Text style={{ fontSize: 9, fontWeight: '500', letterSpacing: 1.5, color: theme.onSurfaceVariant, opacity: 0.5, marginBottom: 3 }}>
                                {t.weeklyFocusLabel?.toUpperCase() ?? 'HAFTALIK ODAK'}
                            </Text>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: F.title, fontWeight: '600', letterSpacing: -1.2, color: theme.onSurface, lineHeight: 26 }}>
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
                                <Text style={{ fontSize: 13, fontWeight: '600', color: weekTrend >= 0 ? theme.tertiary : theme.error }}>
                                    {weekTrend >= 0 ? '↑' : '↓'} {Math.abs(weekTrend)}%
                                </Text>
                                <Text style={{ fontSize: 9, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.55 }}>
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
                                        <Text style={{ fontSize: 8, fontWeight: '600', color: theme.primary, marginBottom: 3, letterSpacing: 0.1 }}>
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


            </View>
        </ScrollView>

        {/* Quick Draft Modal */}
        <Modal visible={quickDraftVisible} transparent animationType="none" onRequestClose={() => setQuickDraftVisible(false)} onShow={() => draftSlideIn()}>
          <View style={styles.draftOverlay}>
            <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setQuickDraftVisible(false)} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'} />
                <View style={[styles.bottomSheetWrapper, { marginBottom: Platform.OS === 'ios' ? keyboardHeight : 0 }]}>
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
                            <View style={[styles.sheetIcon, { backgroundColor: '#F59E0B20' }]}>
                                <Zap size={20} color="#F59E0B" fill="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.quickDraftTitle, { color: theme.onSurface }]}>{t.draftNote}</Text>
                                <Text style={{ fontSize: F.caption, fontWeight: '600', color: '#F59E0B', opacity: 0.8, marginTop: 1 }}>
                                    {language === 'tr' ? 'Aklındakini yaz, sonra düzenlersin' : 'Capture now, refine later'}
                                </Text>
                            </View>
                        </View>
                        
                        <View style={[styles.quickInputGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', marginTop: S.md }]}>
                            <TextInput
                                style={[styles.quickInput, { color: theme.onSurface, height: 60 }]}
                                placeholder={language === 'tr' ? 'Aklına ne geldi?' : "What's on your mind?"}
                                placeholderTextColor={theme.onSurfaceVariant + '99'}
                                value={draftTitle}
                                onChangeText={setDraftTitle}
                                returnKeyType="done"
                                onSubmitEditing={handleQuickSave}
                                underlineColorAndroid="transparent"
                            />
                        </View>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#F59E0B', opacity: 0.55, marginTop: S.sm, letterSpacing: 0.2 }}>
                            {language === 'tr' ? '📌 Görevler ekranına taslak olarak eklenir' : '📌 Saved as a draft in your task list'}
                        </Text>
                        
                        <View style={styles.quickActions}>
                            <Touchable
                                onPress={handleQuickSave}
                                disabled={isSavingDraft || !draftTitle.trim()}
                                style={[styles.quickSave, { backgroundColor: draftTitle.trim() ? '#F59E0B' : theme.surfaceContainerHigh, flex: 1 }]}
                            >
                                {isSavingDraft ? <ActivityIndicator color="white" /> : (
                                    <Text style={{ color: draftTitle.trim() ? 'white' : theme.onSurfaceVariant, fontWeight: '600' }}>{t.save}</Text>
                                )}
                            </Touchable>
                        </View>
                    </Animated.View>
                </View>
          </View>
        </Modal>

      </SafeAreaView>

      {/* Quick Draft FAB */}
      {!(Platform.OS === 'android' && keyboardHeight > 0) && (
        <Touchable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); prepareDraft(); setQuickDraftVisible(true); }}
          accessibilityRole="button"
          accessibilityLabel={language === 'tr' ? 'Hızlı taslak ekle' : 'Quick add draft'}
          style={[styles.fab, { backgroundColor: isDark ? '#B45309' : '#D97706', shadowColor: isDark ? '#B45309' : '#D97706', bottom: Math.max(insets.bottom, 16) + 88, padding: 16, borderRadius: 100 }]}
        >
          <Zap size={22} color="#fff" fill="#fff" />
        </Touchable>
      )}

      <BottomNavBar />

      <WeightEntryModal
        visible={weightModalTaskId !== null}
        taskId={weightModalTaskId}
        onClose={() => setWeightModalTaskId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBarWrapper: { paddingHorizontal: S.lg, paddingVertical: S.sm, alignItems: 'center' },
  floatingTopBar: { borderRadius: R.full, overflow: 'hidden', borderWidth: B.thin },
  lightTopBarShadow: { shadowColor: '#2d2f31', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 8 },
  darkTopBarShadow: { shadowColor: '#3367ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.sm },
  avatarContainer: { width: scale(34), height: scale(34), borderRadius: R.full, overflow: 'hidden', borderWidth: B.thin, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  avatar: { width: '100%', height: '100%' },
  scrollContent: { flexGrow: 1 },
  heroSection: { marginBottom: S.lg },
  greeting: { fontWeight: '800', letterSpacing: -1.5 },
  subGreeting: { fontWeight: '500', marginTop: S.xs, opacity: 0.7 },
  metricLabel: { fontSize: moderateScale(9), fontWeight: '500', letterSpacing: 1.2, opacity: 0.45, marginBottom: S.xs },
  metricValue: { fontSize: F.title, fontWeight: '600', letterSpacing: -1 },
  metricSub: { fontSize: F.caption, fontWeight: '600', opacity: 0.6, marginTop: 2 },
  nextMissionCard: { padding: S.lg, justifyContent: 'space-between', overflow: 'hidden' },
  missionHeader: { flexDirection: 'row', gap: S.sm },
  missionBadge: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.md },
  missionBadgeText: { fontSize: F.caption, fontWeight: '500', letterSpacing: 0.5 },
  missionContent: { marginTop: 2 },
  missionTitle: { fontWeight: '500', letterSpacing: -0.5 },
  missionSub: { fontSize: F.body, fontWeight: '500', marginTop: S.xs, opacity: 0.8 },
  missionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.md },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  startBtnText: { color: 'white', fontWeight: '600', fontSize: F.body },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  seeAllText: { fontSize: F.body, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: scale(24) },
  insightCard: { width: '100%', borderRadius: R.lg + 8, padding: scale(24), borderWidth: B.thin, gap: scale(24) },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  insightIcon: { width: scale(36), height: scale(36), borderRadius: R.sm + 4, alignItems: 'center', justifyContent: 'center' },
  insightHeaderTitle: { fontSize: moderateScale(13), fontWeight: '600', letterSpacing: 1, opacity: 0.6 },
  insightBody: { gap: scale(16) },
  bentoMini: { padding: scale(16), borderRadius: R.md + 4 },
  insightMainText: { fontSize: moderateScale(16), fontWeight: '600', lineHeight: verticalScale(24), letterSpacing: -0.3 },
  insightStats: { gap: scale(12) },
  statBento: { padding: scale(16), borderRadius: R.md + 4, alignItems: 'center', gap: 4 },
  statValue: { fontSize: moderateScale(18), fontWeight: '600' },
  statLabel: { fontSize: moderateScale(10), fontWeight: '500', opacity: 0.5, letterSpacing: 0.5 },
  cockpitActions: { gap: scale(12) },
  actionButtonMain: { height: verticalScale(60), borderRadius: R.md + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(12) },
  actionButtonText: { fontSize: moderateScale(16), fontWeight: '500', letterSpacing: 0.5 },
  actionButtonSecondary: { height: verticalScale(52), borderRadius: R.md + 4, alignItems: 'center', justifyContent: 'center' },
  actionButtonTextSecondary: { fontSize: moderateScale(14), fontWeight: '600' },
  draftOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheetWrapper: { width: '100%' },
  quickDraftSheet: {
    width: '100%',
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: S.lg,
    borderWidth: B.thin,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHandle: { width: scale(40), height: scale(4), borderRadius: R.sm, backgroundColor: 'rgba(128,128,128,0.2)', alignSelf: 'center', marginBottom: S.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  sheetIcon: { width: scale(40), height: scale(40), borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  quickDraftTitle: { fontSize: F.title, fontWeight: '600', letterSpacing: -0.5 },
  quickInputGroup: { borderRadius: R.lg, paddingHorizontal: S.md, height: verticalScale(64), justifyContent: 'center' },
  quickInput: { fontWeight: '600', fontSize: F.subhead },
  quickActions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  quickSave: { flex: 1, height: verticalScale(56), borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', paddingHorizontal: S.lg, gap: S.md, marginTop: S.md },
  actionBtn: { flex: 1, borderRadius: R.lg, alignItems: 'center', gap: S.sm },
  actionLabel: { fontWeight: '600' },
  fab: { position: 'absolute', right: S.lg, minHeight: scale(50), elevation: 10, zIndex: 100, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 },
});

