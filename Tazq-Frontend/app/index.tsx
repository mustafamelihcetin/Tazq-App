import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Platform, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Animated, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore, parseTaskHint } from '@/features/tasks';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useAchievementStore, useMomentumStore, checkStreakAchievement, checkMomentumAchievement, ACHIEVEMENTS, getAvatarSource } from '@/features/user';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { BentoCard } from '@/shared/components/BentoCard';
import { DynamicIsland } from '@/features/focus';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { MotiView, MotiText } from 'moti';
import { Plus, Zap, Play, Rocket, ChevronRight, BrainCircuit, Target, TrendingUp, Flame, Check, Sparkles, CalendarDays, Trash2, ArrowLeft, BarChart3, Coffee } from 'lucide-react-native';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { TaskService, FocusService, DailyFocusData } from '@/shared/services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { PremiumStatChip } from '@/shared/components/PremiumStatChip';
import { useFocusStore } from '@/features/focus';
import { StatusHub } from '@/shared/components/StatusHub';
import { LinearGradient } from 'expo-linear-gradient';
import { getSmartInsight } from '@/shared/utils/insights';
import { computeMomentum } from '@/shared/utils/momentum';
import { S, R, F, scale, verticalScale, moderateScale, B, TRACKING, MAX_W, sideInset } from '@/shared/constants/tokens';
import { useToastStore } from '@/shared/store/useToastStore';
import { usePrefsStore, renderModeEmojiIcon, detectTurkishMode, getCustomExamMode, TurkishModeBanner } from '@/features/modes';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { MomentumPulse } from '@/shared/components/MomentumPulse';
import { WeightEntryModal } from '@/shared/components/WeightEntryModal';
import { scheduleWeeklySummary } from '@/shared/utils/notifications';
import { Touchable } from '@/shared/components/Touchable';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;
  // Küçük ekranlarda kart içi boşlukları bir kademe sık → dikey kaydırma azalır.
  const bentoPad = isSmallScreen ? S.sm : S.md;
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


  // Alışkanlıklar (dashboard hızlı giriş şeridi) — tek dokunuşla bugünü işaretle.
  const habits = useHabitStore(s => s.habits);
  const toggleHabitDate = useHabitStore(s => s.toggleDate);
  const toggleHabitSkipDate = useHabitStore(s => s.toggleSkipDate);
  const getHabitStreak = useHabitStore(s => s.getStreak);
  const habitTodayKey = fmtDateKey();
  const habitsDoneToday = habits.filter(h => (h.completedDates ?? []).includes(habitTodayKey)).length;

  // Focus Store
  const { isActive, seconds, setCurrentTask, setDuration, setIsActive, dailyFocusMinutes, dailyGoalMinutes, updateBestStreak } = useFocusStore();

  // State
  const [statusHubVisible, setStatusHubVisible] = useState(false);
  const [weightModalTaskId, setWeightModalTaskId] = useState<number | null>(null);
  const [quickDraftVisible, setQuickDraftVisible] = useState(false);
  useUiDepth(quickDraftVisible);
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

  // App Review Prompt & Performance Rating state
  const [todayRating, setTodayRating] = useState<number | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewFeedbackText, setReviewFeedbackText] = useState('');
  const [reviewFeedbackSending, setReviewFeedbackSending] = useState(false);

  useEffect(() => {
    const todayKey = fmtDateKey();
    if (activeMode) {
      const key = `tazq_eval_${activeMode.type}_${todayKey}`;
      AsyncStorage.getItem(key).then(val => {
        if (val) setTodayRating(parseInt(val, 10));
        else setTodayRating(null);
      }).catch(() => {});
    } else {
      setTodayRating(null);
    }
  }, [activeMode]);

  const initialCompletedCountRef = useRef<number | null>(null);
  const initialStreakRef = useRef<number | null>(null);
  const initialMomentumRef = useRef<number | null>(null);
  const initialTodayCompletedRef = useRef<number | null>(null);

  useEffect(() => {
    if (tasks.length > 0 && initialCompletedCountRef.current === null) {
      initialCompletedCountRef.current = tasks.filter(t => t && t.isCompleted).length;
    }
  }, [tasks]);


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
            const { scheduleTaskNotification } = require('@/shared/utils/notifications');
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
              const { scheduleTaskNotification } = require('@/shared/utils/notifications');
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
            const { scheduleTaskNotification } = require('@/shared/utils/notifications');
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
  // Hesap utils/momentum.ts'e taşındı (saf + test edilebilir). Habit bileşeni
  // BUGÜN HARİÇ verilir: bugünü dahil edersek recordScore(momentum) bugünü geçmişe
  // yazar → habitScore'u artırır → sonsuz 27↔28 salınımı. getLastNDays(8)'in ilk 7'si
  // dünden 7 gün öncesine denk gelir (bugün indeks 7'de, atılır).
  const completionHistory = getLastNDays(8).slice(0, 7);
  const habitActivityDays = completionHistory.filter(d => d.score >= 0).length;
  const { momentum: rawMomentum, totalCount, completedCount, focusVolumeScore } = computeMomentum({
    tasks,
    weeklyFocus,
    weeklyMinutes,
    streak,
    habitActivityDays,
  });
  const momentum = (() => {
    if (!todayRating) return rawMomentum;
    const modifier = todayRating === 5 ? 10 : todayRating === 4 ? 5 : todayRating === 2 ? -5 : todayRating === 1 ? -10 : 0;
    return Math.min(100, Math.max(0, rawMomentum + modifier));
  })();
  const momentumColor = momentum >= 75 ? theme.tertiary : momentum >= 40 ? theme.warning : theme.primary;

  // Momentum history (last 7 days for sparkline)
  const momentumHistory = getLastNDays(7);

  // Daily target coaching: reverse-compute what's needed to hit 75
  const targetTasks = totalCount === 0 ? 3 : Math.max(0, Math.ceil(3 - completedCount));
  const targetFocusMin = Math.max(0, Math.ceil(280 * (1 - focusVolumeScore) / 7)); // daily shortfall
  // Capture initial session values to evaluate transition milestones (Delight triggers)
  useEffect(() => {
    if (!statsLoading && streak !== undefined && initialStreakRef.current === null) {
      initialStreakRef.current = streak;
    }
  }, [statsLoading, streak]);

  useEffect(() => {
    if (!statsLoading && momentum !== undefined && initialMomentumRef.current === null) {
      initialMomentumRef.current = momentum;
    }
  }, [statsLoading, momentum]);

  useEffect(() => {
    if (!statsLoading && todayCompleted !== undefined && initialTodayCompletedRef.current === null) {
      initialTodayCompletedRef.current = todayCompleted;
    }
  }, [statsLoading, todayCompleted]);

  // Professional, scenario-based review prompt trigger
  useEffect(() => {
    if (statsLoading || streak === undefined || tasks.length === 0) return;

    const checkReviewPrompt = async () => {
      try {
        const completedCount = tasks.filter(t => t && t.isCompleted).length;
        // 1. Minimum Kullanım Sınırı (En az 15 tamamlanmış görev)
        if (completedCount < 15) return;

        // 2. Oturum Kontrolü (Kullanıcı bu oturumda en az 1 görev veya alışkanlık tamamlamış olmalı)
        if (initialCompletedCountRef.current !== null && completedCount <= initialCompletedCountRef.current) {
          return;
        }

        // 3. Stres/Hayal Kırıklığı Kontrolleri (Kötü zamanlama engelleme)
        if (overdueCount > 0) return; // Gecikmiş görev varsa sorma
        if (momentum < 70) return; // Momentum düşükse sorma
        if (todayRating === 1 || todayRating === 2) return; // Bugün kötü geçtiyse sorma

        // 4. Profesyonel Cooldown (60 Günlük Mağaza Kuralı)
        const lastPromptTimeStr = await AsyncStorage.getItem('tazq_last_review_prompt_time');
        const now = Date.now();
        const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
        if (lastPromptTimeStr && (now - parseInt(lastPromptTimeStr, 10)) <= sixtyDaysMs) {
          return;
        }

        // 5. Başarı Senaryoları (Moments of Delight - En az birisi gerçekleşmeli)
        // Yalnızca bu oturumda yeni ulaşılan durumları kontrol et (cold start'ta tetiklenmez)
        const isDailyGoalMet = todayCompleted >= dailyGoal && dailyGoal > 0 &&
          (initialTodayCompletedRef.current !== null && initialTodayCompletedRef.current < dailyGoal);
        const isStreakMilestone = streak > 0 && streak % 3 === 0 &&
          (initialStreakRef.current !== null && streak !== initialStreakRef.current);
        const isHighMomentum = momentum >= 90 &&
          (initialMomentumRef.current !== null && initialMomentumRef.current < 90);

        if (isDailyGoalMet || isStreakMilestone || isHighMomentum) {
          setReviewModalVisible(true);
        }
      } catch (err) {
        console.warn('Failed to check review prompt status', err);
      }
    };

    const timer = setTimeout(() => {
      checkReviewPrompt();
    }, 3000);

    return () => clearTimeout(timer);
  }, [statsLoading, tasks, streak, overdueCount, momentum, todayRating, todayCompleted, dailyGoal]);



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
    if (!t) return false;
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

  const insight = getSmartInsight(
    language as 'tr' | 'en',
    isActive,
    momentum,
    highPriorityToday,
    topTaskToday,
    undatedTasksIncomplete,
    seasonal,
    todayCompleted,
    dailyGoal,
    todayRating
  );

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
                  left: sideInset(width),
                  right: sideInset(width),
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

        {/* Periodic App Store Review & Feedback Prompt Modal */}
        <Modal
          visible={reviewModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: S.lg }}>
            <MotiView
              from={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              style={{
                width: '100%',
                maxWidth: 400,
                backgroundColor: theme.surface,
                borderColor: theme.outlineVariant + '40',
                borderWidth: B.thin,
                borderRadius: 24,
                padding: S.lg,
                gap: S.md,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 15,
                elevation: 10,
              }}
            >
              {/* Header */}
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 32 }}>✨</Text>
                <Text style={{ color: theme.onSurface, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }}>
                  {tr ? 'TAZQ\'ı Nasıl Buluyorsunuz?' : 'How do you rate TAZQ?'}
                </Text>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center', opacity: 0.8 }}>
                  {tr ? 'Görüşleriniz bizim için çok değerli.' : 'Your feedback is very valuable to us.'}
                </Text>
              </View>

              {!reviewSubmitted ? (
                <>
                  {/* Rating Stars Selection */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: S.md, marginVertical: S.sm }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = reviewRating !== null && star <= reviewRating;
                      return (
                        <TouchableOpacity
                          key={star}
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setReviewRating(star);
                          }}
                          style={{ padding: 4 }}
                        >
                          <Zap
                            size={32}
                            color={active ? '#F59E0B' : theme.onSurfaceVariant + '33'}
                            fill={active ? '#F59E0B' : 'transparent'}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Negative feedback textarea */}
                  {reviewRating !== null && reviewRating <= 3 && (
                    <MotiView
                      from={{ height: 0, opacity: 0 }}
                      animate={{ height: 130, opacity: 1 }}
                      style={{ gap: S.sm, overflow: 'hidden' }}
                    >
                      <Text style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '700' }}>
                        {tr ? 'Sizi ne memnun etmedi? Nasıl düzeltebiliriz?' : 'What went wrong? How can we improve?'}
                      </Text>
                      <TextInput
                        value={reviewFeedbackText}
                        onChangeText={setReviewFeedbackText}
                        placeholder={tr ? 'Görüşlerinizi yazın…' : 'Write your feedback…'}
                        placeholderTextColor={theme.onSurfaceVariant + '60'}
                        multiline
                        numberOfLines={3}
                        underlineColorAndroid="transparent"
                        style={{
                          backgroundColor: theme.surfaceContainerLow,
                          borderColor: theme.outlineVariant + '60',
                          borderWidth: B.thin,
                          borderRadius: R.md,
                          color: theme.onSurface,
                          fontSize: F.body,
                          padding: S.md,
                          textAlignVertical: 'top',
                          height: 80,
                        }}
                      />
                    </MotiView>
                  )}

                  {/* Action Buttons */}
                  <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                    <Touchable
                      onPress={async () => {
                        Haptics.selectionAsync();
                        setReviewModalVisible(false);
                        await AsyncStorage.setItem('tazq_last_review_prompt_time', Date.now().toString());
                      }}
                      style={{ flex: 1, height: 48, borderRadius: R.md, backgroundColor: theme.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body }}>
                        {tr ? 'Daha Sonra' : 'Later'}
                      </Text>
                    </Touchable>

                    {reviewRating !== null && (
                      <Touchable
                        disabled={reviewFeedbackSending}
                        onPress={async () => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          await AsyncStorage.setItem('tazq_last_review_prompt_time', Date.now().toString());
                          
                          if (reviewRating >= 4) {
                            // Redirect to app store write review
                            const storeUrl = Platform.OS === 'ios'
                              ? 'https://apps.apple.com/app/tazq-app/id123456789?action=write-review'
                              : 'market://details?id=com.tazqapp';
                            Linking.openURL(storeUrl).catch(() => {});
                            setReviewModalVisible(false);
                          } else {
                            // Negative rating -> send support message
                            const feedback = reviewFeedbackText.trim();
                            if (!feedback) {
                              setReviewModalVisible(false);
                              return;
                            }
                            setReviewFeedbackSending(true);
                            try {
                              const SupportService = require('@/shared/services/api').SupportService;
                              await SupportService.sendMessage(`[APP REVIEW feedback - Star rating: ${reviewRating}/5]\n${feedback}`);
                              setReviewSubmitted(true);
                              setTimeout(() => {
                                setReviewModalVisible(false);
                                setReviewSubmitted(false);
                                setReviewRating(null);
                                setReviewFeedbackText('');
                              }, 1800);
                            } catch (err) {
                              console.warn('Failed to send review feedback to support', err);
                              setReviewModalVisible(false);
                            } finally {
                              setReviewFeedbackSending(false);
                            }
                          }
                        }}
                        style={{ flex: 1, height: 48, borderRadius: R.md, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}
                      >
                        {reviewFeedbackSending ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: F.body }}>
                            {reviewRating >= 4 ? (tr ? 'Yorum Yap' : 'Rate App') : (tr ? 'Gönder' : 'Submit')}
                          </Text>
                        )}
                      </Touchable>
                    )}
                  </View>
                </>
              ) : (
                <MotiView
                  from={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{ alignItems: 'center', paddingVertical: S.lg, gap: S.md }}
                >
                  <Text style={{ fontSize: 44 }}>❤️</Text>
                  <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '800', textAlign: 'center' }}>
                    {tr ? 'Geri bildiriminiz için teşekkürler!' : 'Thank you for your feedback!'}
                  </Text>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, textAlign: 'center', opacity: 0.7 }}>
                    {tr ? 'TAZQ\'u geliştirmek için durmaksızın çalışıyoruz.' : 'We are constantly working to improve TAZQ.'}
                  </Text>
                </MotiView>
              )}
            </MotiView>
          </View>
        </Modal>

        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingTop: 82, /* SafeAreaView(edges=top) insets.top'u ekliyor; bu sadece floating bar açıklığı (bar alt kenarı). insets.top'u TEKRAR ekleme. Gap'i heroSection.marginTop verir. */ paddingBottom: 120, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchTasks(); fetchStats(); }} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={isDark ? '#1a1b1e' : '#ffffff'} progressViewOffset={insets.top + S.sm + 44 + S.sm} />}
        >
            {/* Welcome Hero */}
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={[styles.heroSection, { paddingHorizontal: S.lg }]}
            >
                {/* Selamlama + isim TEK blok (isim iç-span, primary): doğal sarar,
                    uzun isim alt satıra geçer; kesilmez. Altında subgreeting tutarlı boşlukla. */}
                <Text style={[styles.greeting, { color: theme.onSurface, fontSize: isSmallScreen ? 22 : 28, lineHeight: isSmallScreen ? 28 : 34 }]}>
                    {getGreeting()},{' '}
                    <Text style={{ color: theme.primary }}>
                        {user?.name?.split(' ')[0] || (language === 'tr' ? 'sen' : 'you')}
                    </Text>
                </Text>
                <Text style={[styles.subGreeting, { color: theme.onSurfaceVariant, fontSize: F.subhead }]}>
                    {getSubGreeting()}
                </Text>
            </MotiView>

            {/* ── Momentum Pulse — günün tek skoru; en üstte "kuzey yıldızı" konumu ── */}
            <MomentumPulse
              score={momentum}
              history={momentumHistory}
              language={language}
              loading={statsLoading}
            />

            {/* ── TODAY CARD ── */}
            <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
            <Touchable onPress={handleTodayDoubleTap} activeOpacity={1}>
            <BentoCard index={0} style={{ overflow: 'hidden', padding: bentoPad }}>
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
                    {todayTasksIncomplete.slice(0, 3).map((task, i) => {
                      if (!task || !task.id) return null;
                      return (
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
                      );
                    })}
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

            {/* İlk açılış — soğuk başlangıç kartı: görev ve alışkanlık yokken kullanıcıya net 3 giriş noktası sunar */}
            {tasks.length === 0 && habits.length === 0 && (
              <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <BentoCard index={1} style={{ padding: isSmallScreen ? S.md : S.lg, gap: S.sm }}>
                    <Text style={{ fontSize: F.subhead, fontWeight: '800', color: theme.onSurface, letterSpacing: -0.3, marginBottom: S.xs }}>
                        {tr ? 'Hoş geldin 👋 Nereden başlamak istersin?' : 'Welcome 👋 Where would you like to start?'}
                    </Text>
                    {[
                        { icon: <Plus size={18} color={theme.primary} />, label: tr ? 'İlk görevini ekle' : 'Add your first task', sub: tr ? 'Aklındakini yaz, gerisini TAZQ halletsin' : 'Jot it down, TAZQ handles the rest', onPress: () => router.push('/tasks') },
                        { icon: <Rocket size={18} color="#8b5cf6" />, label: tr ? 'Bir mod seç' : 'Choose a mode', sub: tr ? 'Sigara bırak, tasarruf, sınava hazırlık…' : 'Quit smoking, save, exam prep…', onPress: () => router.push('/modlar') },
                        { icon: <Flame size={18} color="#F59E0B" />, label: tr ? 'Bir alışkanlık başlat' : 'Start a habit', sub: tr ? 'Her gün tek dokunuşla işaretle' : 'Check in daily with one tap', onPress: () => router.push('/cockpit') },
                    ].map((row, i) => (
                        <Touchable key={i} onPress={row.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.xs + 2 }} accessibilityRole="button" accessibilityLabel={row.label}>
                            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}>{row.icon}</View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface }}>{row.label}</Text>
                                <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, opacity: 0.6 }}>{row.sub}</Text>
                            </View>
                            <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
                        </Touchable>
                    ))}
                </BentoCard>
              </View>
            )}

            {/* Next Mission Widget */}
            {!(tasks.length === 0 && habits.length === 0) && (
            <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <MotiView
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', damping: 15 }}
                >
                    <BentoCard index={1} style={[styles.nextMissionCard, { minHeight: isSmallScreen ? 120 : 140, padding: isSmallScreen ? S.md : S.lg }]}>
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
            )}

            {/* ── ALIŞKANLIK ŞERİDİ ── günlük aksiyon → öncelikli konumda (görev/görevlerin hemen altı).
                Yalnız alışkanlık varsa; tek dokunuş = bugün yaptım. */}
            {habits.length > 0 && (
              <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <BentoCard index={2} style={{ padding: bentoPad, overflow: 'hidden' }}>
                     <Touchable onPress={() => router.push('/cockpit')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md }} accessibilityRole="button" accessibilityLabel={tr ? 'Alışkanlıkları yönet' : 'Manage habits'}>
                        <View>
                            <Text style={{ fontSize: 9, fontWeight: '500', letterSpacing: 1.5, color: theme.onSurfaceVariant, opacity: 0.5 }}>
                                {tr ? 'BUGÜN · ALIŞKANLIKLAR' : 'TODAY · HABITS'}
                            </Text>
                            <Text style={{ fontSize: 8.5, color: theme.onSurfaceVariant, opacity: 0.45, marginTop: 1 }}>
                                {tr ? 'Mola için butona basılı tut' : 'Hold button to take break'}
                            </Text>
                        </View>
                        <Text style={{ fontSize: F.caption, fontWeight: '700', color: habitsDoneToday === habits.length ? '#10B981' : theme.onSurfaceVariant }}>
                            {habitsDoneToday}/{habits.length}{habitsDoneToday === habits.length ? '  ✓' : ''}
                        </Text>
                    </Touchable>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 4 }} keyboardShouldPersistTaps="handled">
                        {habits.map(h => {
                            const done = (h.completedDates ?? []).includes(habitTodayKey);
                            const skipped = (h.skippedDates ?? []).includes(habitTodayKey);
                            const streak = getHabitStreak(h);
                            return (
                                <Touchable
                                    key={h.id}
                                    onPress={() => { 
                                      Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium); 
                                      toggleHabitDate(h.id, habitTodayKey); 
                                    }}
                                    onLongPress={() => {
                                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                      toggleHabitSkipDate(h.id, habitTodayKey);
                                    }}
                                    style={{ alignItems: 'center', width: 58 }}
                                    accessibilityRole="button"
                                    accessibilityState={{ checked: done }}
                                    accessibilityLabel={`${h.name}${done ? (tr ? ', bugün yapıldı' : ', done today') : skipped ? (tr ? ', bugün pas geçildi' : ', skipped today') : (tr ? ', bugün işaretle' : ', mark today')}`}
                                >
                                    <View style={{
                                        width: 54, height: 54, borderRadius: 27,
                                        borderWidth: (done || skipped) ? 0 : 1.5,
                                        borderColor: h.color + '40',
                                        backgroundColor: done 
                                          ? h.color 
                                          : skipped
                                          ? '#d97706'
                                          : h.color + (isDark ? '1F' : '14'),
                                        alignItems: 'center', justifyContent: 'center',
                                        opacity: skipped ? 0.75 : 1,
                                    }}>
                                        {skipped ? (
                                            <Coffee size={24} color="#fff" />
                                        ) : done ? (
                                            renderModeEmojiIcon(h.emoji ?? '📌', 24, '#fff')
                                        ) : (
                                            renderModeEmojiIcon(h.emoji ?? '📌', 23, h.color)
                                        )}
                                    </View>
                                    {/* Seri — yalnız anlamlıyken: 3+ alev, 1-2 sade, 0 boş (hizalama korunur) */}
                                    <View style={{ height: 15, marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                        {skipped ? (
                                            <Text style={{ fontSize: 9, fontWeight: '600', color: '#d97706' }}>{tr ? 'MOLA' : 'SKIP'}</Text>
                                        ) : streak >= 3 ? (
                                            <>
                                                <Flame size={11} color="#F97316" fill="#F97316" />
                                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#F97316' }}>{streak}</Text>
                                            </>
                                        ) : streak >= 1 ? (
                                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.55 }}>{streak} {tr ? 'gün' : 'd'}</Text>
                                        ) : null}
                                    </View>
                                    <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '600', color: done ? h.color : skipped ? '#d97706' : theme.onSurfaceVariant, opacity: (done || skipped) ? 1 : 0.75, width: 58, textAlign: 'center', textDecorationLine: skipped ? 'line-through' : 'none' }}>{h.name}</Text>
                                </Touchable>
                            );
                        })}
                    </ScrollView>
                </BentoCard>
              </View>
            )}

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
                onRatingChange={setTodayRating}
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
                <BentoCard index={2} style={{ padding: bentoPad, overflow: 'hidden' }}>
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
  // Üst ve alt boşluk EŞİT (simetrik blok). Üst boşluk paddingTop'tan değil buradan gelir.
  heroSection: { marginTop: S.lg, marginBottom: S.lg },
  greeting: { fontWeight: '800', letterSpacing: TRACKING.hero, includeFontPadding: false },
  subGreeting: { fontWeight: '500', marginTop: S.xs, opacity: 0.7, includeFontPadding: false },
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

