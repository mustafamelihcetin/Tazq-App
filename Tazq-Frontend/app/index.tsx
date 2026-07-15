import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Platform, Modal, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore, parseTaskHint, getLocalizedTaskTitle, getLocalizedTaskDescription } from '@/features/tasks';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useAchievementStore, useMomentumStore, checkStreakAchievement, checkMomentumAchievement, ACHIEVEMENTS, getAvatarSource, AVATAR_CONFIGS } from '@/features/user';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { BentoCard } from '@/shared/components/BentoCard';
import { DynamicIsland } from '@/features/focus';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { DashboardHero } from '@/features/dashboard/components/DashboardHero';
import { TodayCard } from '@/features/dashboard/components/TodayCard';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { NextMissionCard } from '@/features/dashboard/components/NextMissionCard';
import { MyDayHabits } from '@/features/dashboard/components/MyDayHabits';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { ArrowLeft, BarChart3, BrainCircuit, CalendarDays, Check, CheckCircle2, ChevronRight, Coffee, Flame, Play, Plus, Rocket, Sparkles, Target, Trash2, TrendingUp, X, Zap } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { TaskService, AuthService } from '@/shared/services/api';
import * as HapticsOriginal from 'expo-haptics';
const Haptics = {
  notificationAsync: (type: any) => HapticsOriginal.notificationAsync(type).catch(() => {}),
  impactAsync: (style: any) => HapticsOriginal.impactAsync(style).catch(() => {}),
  selectionAsync: () => HapticsOriginal.selectionAsync().catch(() => {}),
  NotificationFeedbackType: HapticsOriginal.NotificationFeedbackType,
  ImpactFeedbackStyle: HapticsOriginal.ImpactFeedbackStyle,
};
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { PremiumStatChip } from '@/shared/components/PremiumStatChip';
import { useFocusStore } from '@/features/focus';
import { useSporStore } from '@/shared/store/useSporStore';
import { StatusHub } from '@/shared/components/StatusHub';
import { LinearGradient } from 'expo-linear-gradient';
import { getSmartInsight, generateWeeklyTips } from '@/shared/utils/insights';
import { computeMomentum } from '@/shared/utils/momentum';
import { ICON, S, R, F, scale, verticalScale, moderateScale, B, TRACKING, MAX_W, sideInset, HAIRLINE, navBarSpace, topBarSpace, TOP_BAR_HEIGHT, TOP_BAR_LIFT, touchSlop } from '@/shared/constants/tokens';
import { useToastStore } from '@/shared/store/useToastStore';
import { usePrefsStore, renderModeEmojiIcon, detectTurkishMode, getCustomExamMode, TurkishModeBanner, getModeInfoForTask, getTaskRemainingTime } from '@/features/modes';
import { useHabitStore, fmtDateKey, useSleepHealthSync } from '@/features/habits';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { MomentumPulse } from '@/shared/components/MomentumPulse';
import { WeightEntryModal } from '@/shared/components/WeightEntryModal';
import { HelpTourModal } from '@/shared/components/HelpTourModal';
import { TourTarget, useTour } from '@/shared/components/TourContext';
import { scheduleWeeklySummary } from '@/shared/utils/notifications';
import { Touchable } from '@/shared/components/Touchable';
import { StatusHubModal } from '@/shared/components/StatusHubModal';
import { QuickDraftModal } from '@/shared/components/QuickDraftModal';
import { ProfileSetupModal } from '@/shared/components/ProfileSetupModal';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { MagneticFAB } from '@/shared/components/MagneticFAB';
import { MyDayTaskRow } from '@/shared/components/MyDayTaskRow';
import { HabitBubble } from '@/shared/components/HabitBubble';
import { swallow } from '@/shared/utils/swallow';
import { playSoundEffect } from '@/shared/utils/soundEffects';
import { evaluateReviewPrompt } from '@/features/user/utils/reviewPrompt';
import { useDoubleTapHighlight } from '@/features/user/hooks/useDoubleTapHighlight';
import { useWeeklyStats } from '@/features/user/hooks/useWeeklyStats';
import { ReviewPromptModal } from '@/features/user/components/ReviewPromptModal';
import { httpStatusOf, isNetworkError } from '@/shared/utils/errors';
import { Colors } from '@/shared/constants/Colors';
import { Separator } from '@/shared/components/Separator';


// Hoş geldin (profil kurulumu) oturum başına yalnızca bir kez — remount'ta sıfırlanmasın diye
// component ref yerine modül seviyesinde tutulur; kullanıcı çıkışında sıfırlanır.
let welcomeSetupShown = false;

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
  const { user, setUser, token, isFirstLogin, setIsFirstLogin } = useAuthStore();
  const { t, language } = useLanguageStore();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show: showToast } = useToastStore();
  const { recordScore, getLastNDays, momentumShieldActive } = useMomentumStore();
  const { trigger: triggerAchievement, baseline: baselineAchievements } = useAchievementStore();
  const achHydrated = useAchievementStore(s => s._hasHydrated);
  const uiMode = usePrefsStore(s => s.uiMode);
  const { seasonal, weeklyNotification, examPlanHabitIds, examPlanTaskIds, ramazanPlanHabitIds, ramazanPlanTaskIds, tezPlanHabitIds, tezPlanTaskIds, mulakatPlanHabitIds, mulakatPlanTaskIds, setPlanIds, dismissedBannerKey, setDismissedBannerKey, avatarBorderColor, soundEffects, helpTourShown, completedTours, onboardingCompleted, setOnboardingCompleted, _hasHydrated: prefsHydrated } = usePrefsStore();

  const [profileSetupVisible, setProfileSetupVisible] = useState(false);
  const isNamePlaceholder = user?.name === 'TAZQ Kullanıcısı' || !!(user?.email && user?.name && user?.name === user?.email.split('@')[0]);

  const scrollViewRef = useRef<ScrollView>(null);
  const { measureAll } = useTour();
  const handleStepChange = (step: number) => {
    try {
      if (step === 2) {
        // Scroll down to center the daily tasks card, keeping it clear of navigation bar overlays
        scrollViewRef.current?.scrollTo({ y: 140, animated: true });
      } else {
        // Scroll back up for top elements (Momentum score, habits card, cockpit)
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
      // Re-measure after scroll animation completes (320ms) to ensure exact positioning
      setTimeout(() => {
        measureAll();
      }, 350);
    } catch (e) {
      console.error('[Dashboard] Error during tour step scroll:', e);
    }
  };

  useEffect(() => {
    if (!profileSetupVisible && completedTours?.dashboard !== true) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [profileSetupVisible, completedTours]);

  useEffect(() => {
    // Kullanıcı çıkışında bayrağı sıfırla (yeni/başka ilk-giriş kullanıcısı için tekrar gösterilebilsin)
    if (!user) {
      welcomeSetupShown = false;
      return;
    }
    if (prefsHydrated && onboardingCompleted === false && isFirstLogin && !welcomeSetupShown) {
      welcomeSetupShown = true;
      setProfileSetupVisible(true);
      usePrefsStore.getState().setTourCompleted('dashboard', false);
      usePrefsStore.getState().setHelpTourShown(false);
    }
  }, [user, prefsHydrated, onboardingCompleted, isFirstLogin]);

  const handleProfileSetupSave = async (name: string, avatar: string, borderColor: string, motto: string, productivityHour: string, gender: 'male' | 'female' | '') => {
    try {
      await AuthService.updateProfile({
        name,
        avatar,
        avatarBorderColor: borderColor,
        motto
      });
      usePrefsStore.getState().setProductivityHour(productivityHour as any);
      usePrefsStore.getState().setGender(gender);
      useSporStore.getState().setGender(gender);
      setOnboardingCompleted(true);
      await usePrefsStore.getState().syncToCloud();
      // isFirstLogin BİLEREK temizlenmiyor: yardım turu bu ilk-giriş oturumu boyunca
      // (profil setup kapandıktan sonra) sayfa sayfa gösterilebilsin. Bayrak persist edilmez
      // (rehydrate'te sıfırlanır) → sonraki açılışlarda ve mevcut kullanıcılarda tur çıkmaz.
      if (token) {
        const updatedUser = await AuthService.getCurrentUser(token);
        setUser(updatedUser);
      }
      setProfileSetupVisible(false);
      showToast(
        language === 'tr' ? 'Profiliniz başarıyla oluşturuldu!' : 'Profile created successfully!',
        'success'
      );
    } catch (err) {
      console.error('[Profile Setup Save Error]', err);
      throw err;
    }
  };

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
  // Uyku sağlık senkronu — onaylı asistan (iOS HealthKit; desteklenmeyen yerde sessiz no-op).
  useSleepHealthSync();
  const toggleHabitDate = useHabitStore(s => s.toggleDate);
  const toggleHabitSkipDate = useHabitStore(s => s.toggleSkipDate);
  const getHabitStreak = useHabitStore(s => s.getStreak);
  const habitTodayKey = fmtDateKey();
  const habitsDoneToday = habits.filter(h => (h.completedDates ?? []).includes(habitTodayKey)).length;

  // Focus Store
  const isActive = useFocusStore(s => s.isActive);
  const setCurrentTask = useFocusStore(s => s.setCurrentTask);
  const setDuration = useFocusStore(s => s.setDuration);
  const setIsActive = useFocusStore(s => s.setIsActive);
  const dailyFocusMinutes = useFocusStore(s => s.dailyFocusMinutes);
  const dailyGoalMinutes = useFocusStore(s => s.dailyGoalMinutes);

  // State
  const [statusHubVisible, setStatusHubVisible] = useState(false);
  const [weightModalTaskId, setWeightModalTaskId] = useState<number | null>(null);
  const [quickDraftVisible, setQuickDraftVisible] = useState(false);
  useUiDepth(quickDraftVisible);
  const headerScale = useRef(new Animated.Value(1)).current;

  // Çift dokunma vurguları: durum + söndürme zamanlayıcısı useDoubleTapHighlight'ta
  // (zamanlayıcı unmount'ta iptal edilir; eskiden edilmiyordu).
  const headerTap = useDoubleTapHighlight(1800, useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(headerScale, { toValue: 1.06, useNativeDriver: true, damping: 5, stiffness: 200 }),
      Animated.spring(headerScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
  }, [headerScale]));

  const todayTap = useDoubleTapHighlight(1600, useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []));

  const headerHighlight = headerTap.active;
  const todayHighlight = todayTap.active;
  const todayBurstKey = todayTap.burstKey;
  // Haftalık istatistik durumu + fetch useWeeklyStats'ta (streak eşitlemesi dahil).
  const { weeklyFocus, lastWeekMinutes, loading: statsLoading, refresh: fetchStats } = useWeeklyStats();
  const [showAllIncomplete, setShowAllIncomplete] = useState(false);
  const [showCompletedSection, setShowCompletedSection] = useState(false);
  const [logoTick, setLogoTick] = useState(0);
  const [commandPortalVisible, setCommandPortalVisible] = useState(false);
  const [portalSearch, setPortalSearch] = useState('');
  const portalInputRef = useRef<TextInput>(null);
  const localStreak = useFocusStore(s => s.localStreak);
  const streak = localStreak;
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  // App Review Prompt & Performance Rating state
  const [todayRating, setTodayRating] = useState<number | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

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
  // Automatic Streak Shield Consumption Check
  useEffect(() => {
    if (isLoading || (habits.length === 0 && tasks.length === 0)) return;

    const checkStreakShield = async () => {
      const todayStr = new Date().toDateString();
      const store = useFocusStore.getState();
      const lastChecked = store.lastCheckedDate;

      if (lastChecked && lastChecked !== todayStr) {
        const lastCheckedDate = new Date(lastChecked);
        const todayDate = new Date(todayStr);
        
        // Calculate difference in calendar days
        const msPerDay = 24 * 60 * 60 * 1000;
        const diffDays = Math.floor((todayDate.getTime() - lastCheckedDate.getTime()) / msPerDay);
        
        if (diffDays > 0) {
          // If only 1 day missed, we check if they met the goal on that day
          let metGoal = false;
          if (diffDays === 1) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toDateString();
            const yesterdayKey = fmtDateKey(yesterday);
            const yesterdayCompletedTasksCount = tasks.filter(t => 
              t.isCompleted && t.completedAt && new Date(t.completedAt).toDateString() === yesterdayStr
            ).length;
            
            const yesterdayCompletedHabitsCount = habits.filter(h => 
              (h.completedDates ?? []).includes(yesterdayKey)
            ).length;

            const yesterdayFocusMins = store.dailyFocusDate === yesterdayStr ? store.dailyFocusMinutes : 0;
            metGoal = yesterdayCompletedTasksCount > 0 || yesterdayCompletedHabitsCount > 0 || yesterdayFocusMins >= store.dailyGoalMinutes;
          }

          if (!metGoal && store.localStreak > 0) {
            const remainingShields = store.streakShields;
            const shieldsNeeded = diffDays;

            if (remainingShields >= shieldsNeeded) {
              const nextShields = remainingShields - shieldsNeeded;
              useFocusStore.setState({
                streakShields: nextShields,
                streakFreezeAvailable: nextShields > 0
              });

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Play freeze SFX
              if (usePrefsStore.getState().soundEffects) {
                playSoundEffect(require('../assets/sounds/freeze.mp3'), {
                  context: 'index.streakFreezeSound',
                  volume: 0.75,
                  releaseAfterMs: 3000,
                });
              }

              Alert.alert(
                language === 'tr' ? 'Seri Korundu!' : 'Streak Protected!',
                language === 'tr'
                  ? `Son ${diffDays} gündür aktif değildiniz fakat ${diffDays} adet TAZQ Kalkanı kullanılarak seriniz başarıyla korundu.`
                  : `You were inactive for the last ${diffDays} days, but ${diffDays} TAZQ Shields successfully protected your streak.`
              );
            } else {
              useFocusStore.setState({ 
                localStreak: 0,
                streakShields: 0,
                streakFreezeAvailable: false
              });

              Alert.alert(
                language === 'tr' ? 'Seri Sıfırlandı' : 'Streak Reset',
                language === 'tr'
                  ? `Son ${diffDays} gündür aktif değildiniz. ${remainingShields} kalkanınız yetersiz kaldığı için seriniz sıfırlandı.`
                  : `You were inactive for the last ${diffDays} days. Since your ${remainingShields} shields were not enough, your streak was reset.`
              );
            }
          }
        }
      }

      useFocusStore.setState({ lastCheckedDate: todayStr });
    };

    checkStreakShield();
  }, [isLoading]);

  // Track today's first completion to increment streak
  const [streakIncrementedToday, setStreakIncrementedToday] = useState(false);
  useEffect(() => {
    if (isLoading || (tasks.length === 0 && habits.length === 0)) return;
    const store = useFocusStore.getState();
    const todayStr = new Date().toDateString();
    
    const completedToday = tasks.filter(t => t.isCompleted && t.dueDate && new Date(t.dueDate).toDateString() === todayStr).length;
    const habitsDone = habits.filter(h => (h.completedDates ?? []).includes(habitTodayKey)).length;
    const focusMins = store.dailyFocusDate === todayStr ? store.dailyFocusMinutes : 0;

    const activeProgress = completedToday > 0 || habitsDone > 0 || focusMins >= store.dailyGoalMinutes;

    if (activeProgress && store.localStreak >= 0 && !streakIncrementedToday) {
      AsyncStorage.getItem('tazq_last_streak_increment_date').then(val => {
        if (val !== todayStr) {
          store.incrementLocalStreak();
          AsyncStorage.setItem('tazq_last_streak_increment_date', todayStr);
          setStreakIncrementedToday(true);
        }
      });
    }
  }, [tasks, habits, isLoading]);
  // Compute daily goal from real data
  const todayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate).toDateString() === new Date().toDateString();
  });
  const todayCompleted = todayTasks.filter(t => t.isCompleted).length;
  // `|| 1` YAZILIYDI ve kullanıcıya YALAN söylüyordu: hiç görev yokken hedefi 1'e
  // çekip "0/1 görev tamamlandı" gösteriyordu. Sıfıra bölme korkusuyla konmuş bir
  // hileydi — ama koruma verinin değil, HESABIN işi (bkz. TodayCard: Math.max(goal, 1)).
  // Veri gerçeği söyler; "görev yok" ayrı bir durumdur, "1 görev var" değil.
  const dailyGoal = todayTasks.length;
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
    } catch (e: unknown) {
      if (httpStatusOf(e) !== 401) swallow('index.fetchTasks', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
      fetchStats();
    }, [])
  );



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

  const handleQuickSave = async (title: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const hint = parseTaskHint(title, language as 'tr' | 'en');
    const isReminder = hint.tags?.includes('hatırlatıcı') || hint.tags?.includes('reminder');
    
    const payload = {
        title: title,
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
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
        } else {
          const created = await TaskService.createTask(payload as any);
          addTask(created);

          // Schedule notification if it's a reminder
          if (created.id && isReminder) {
              const { scheduleTaskNotification } = require('@/shared/utils/notifications');
              await scheduleTaskNotification(created.id, payload.title, payload.dueDate, payload.dueTime, language);
          }
          showToast(`"${payload.title}" ${t.toastTaskAdded}`, 'success');
        }
    } catch (error: unknown) {
        if (isNetworkError(error)) {
          const tempId = -Date.now();
          useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
          addTask({ ...payload, id: tempId } as any);
          if (isReminder) {
            const { scheduleTaskNotification } = require('@/shared/utils/notifications');
            await scheduleTaskNotification(tempId, payload.title, payload.dueDate, payload.dueTime, language);
          }
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
        } else {
          showToast(t.saveError, 'error');
          throw error;
        }
    }
  };

  // Compute metrics
  const tr = language === 'tr';

  const dayLabels: string[] = t.dayLabels;

  const currentDayIndex = (() => {
    const logicalToday = new Date();
    logicalToday.setHours(logicalToday.getHours() - 3); // respect night owl buffer
    const day = logicalToday.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    return day === 0 ? 6 : day - 1; // convert to Monday-start (0 = Mon, ..., 6 = Sun)
  })();

  const localTodayMinutes = useFocusStore.getState().dailyFocusMinutes;

  const mergedWeeklyFocus = React.useMemo(() => {
    if (weeklyFocus.length === 0) {
      return Array(7).fill(null).map((_, i) => ({
        day: dayLabels[i],
        minutes: i === currentDayIndex ? localTodayMinutes : 0,
        tasksCompleted: 0
      }));
    }
    return weeklyFocus.map((d, i) => {
      if (i === currentDayIndex) {
        return {
          ...d,
          minutes: Math.max(d.minutes || 0, localTodayMinutes)
        };
      }
      return d;
    });
  }, [weeklyFocus, localTodayMinutes, dayLabels, currentDayIndex]);

  const weeklyMinutes = mergedWeeklyFocus.reduce((s: number, d: any) => s + (d.minutes || 0), 0);

  // Trend: compare current week's total focus minutes vs previous week's total focus minutes
  const weekTrend = (() => {
    if (lastWeekMinutes === 0) {
      return weeklyMinutes > 0 ? 100 : 0;
    }
    return Math.round(((weeklyMinutes - lastWeekMinutes) / lastWeekMinutes) * 100);
  })();

  // ── Professional Momentum Score ────────────────────────────────────────────
  // Hesap utils/momentum.ts'e taşındı (saf + test edilebilir). Habit bileşeni
  // BUGÜN HARİÇ verilir: bugünü dahil edersek recordScore(momentum) bugünü geçmişe
  // yazar → habitScore'u artırır → sonsuz 27↔28 salınımı. getLastNDays(8)'in ilk 7'si
  // dünden 7 gün öncesine denk gelir (bugün indeks 7'de, atılır).
  // getLastNDays(8) tek çağrı — eskiden aynı store taraması render başına 2 kez yapılıyordu.
  const last8Days = getLastNDays(8);
  const completionHistory = last8Days.slice(0, 7);
  const habitActivityDays = completionHistory.filter(d => d.score >= 0).length;
  // computeMomentum, girdileri (tasks, memoize mergedWeeklyFocus, primitive'ler) değişmedikçe
  // ilgisiz re-render'larda (prefs/saat/momentum) yeniden hesaplanmasın diye memoize edildi.
  const { momentum: rawMomentum, totalCount, completedCount, focusVolumeScore } = React.useMemo(
    () => computeMomentum({
      tasks,
      weeklyFocus: mergedWeeklyFocus,
      weeklyMinutes,
      streak,
      habitActivityDays,
    }),
    [tasks, mergedWeeklyFocus, weeklyMinutes, streak, habitActivityDays]
  );
  // Momentum history (last 8 days for sparkline delta)
  const momentumHistory = last8Days;

  const momentum = (() => {
    if (momentumShieldActive) {
      const hist = momentumHistory.filter(h => h.score >= 0);
      const lastActive = hist.length ? hist[hist.length - 1] : null;
      return lastActive ? Math.max(75, lastActive.score) : 75;
    }
    if (!todayRating) return rawMomentum;
    const modifier = todayRating === 5 ? 10 : todayRating === 4 ? 5 : todayRating === 2 ? -5 : todayRating === 1 ? -10 : 0;
    return Math.min(100, Math.max(0, rawMomentum + modifier));
  })();
  const momentumColor = momentum >= 75 ? theme.tertiary : momentum >= 40 ? theme.streak : theme.onSurfaceVariant;

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

  // Senaryo bazlı değerlendirme isteme tetikleyicisi.
  // Karar kuralları evaluateReviewPrompt'ta (saf ve test edilir); burada yalnızca
  // girdileri toplayıp sonucu uygularız.
  useEffect(() => {
    if (statsLoading || streak === undefined || tasks.length === 0) return;

    const checkReviewPrompt = async () => {
      try {
        const lastPromptTimeStr = await AsyncStorage.getItem('tazq_last_review_prompt_time');
        const parsedLastPrompt = lastPromptTimeStr ? parseInt(lastPromptTimeStr, 10) : NaN;

        const decision = evaluateReviewPrompt({
          completedCount: tasks.filter(t => t && t.isCompleted).length,
          initialCompletedCount: initialCompletedCountRef.current,
          initialStreak: initialStreakRef.current,
          initialMomentum: initialMomentumRef.current,
          initialTodayCompleted: initialTodayCompletedRef.current,
          overdueCount,
          momentum,
          todayRating,
          streak,
          todayCompleted,
          dailyGoal,
          lastPromptAt: Number.isNaN(parsedLastPrompt) ? null : parsedLastPrompt,
          now: Date.now(),
        });

        if (decision.shouldPrompt) setReviewModalVisible(true);
      } catch (err) {
        swallow('index.checkReviewPrompt', err);
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

  // Bugün tamamlanan görevler
  const todayTasksCompleted = tasks.filter(t => {
    if (!t) return false;
    if (!t.isCompleted) return false;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= todayStart && due <= new Date(todayStart.getTime() + 86400000);
  });

  // Unified My Day feed items (Tasks only)
  const myDayTasks = (() => {
    // Demo/mock veri YALNIZCA ilk kez onboarding yapan yeni kullanıcıya gösterilir.
    // Dönen/reaktive kullanıcı (onboardingCompleted=true) her zaman gerçek verisini görür.
    if (completedTours?.dashboard !== true && !onboardingCompleted) {
      return [
        {
          type: 'task' as const,
          id: 'mock-task-1',
          title: language === 'tr' ? 'Haftalık Raporu Hazırla' : 'Prepare Weekly Report',
          priority: 'High',
          isCompleted: false,
          original: {}
        },
        {
          type: 'task' as const,
          id: 'mock-task-2',
          title: language === 'tr' ? 'Kitap Oku (20 sayfa)' : 'Read Book (20 pages)',
          priority: 'Medium',
          isCompleted: false,
          original: {}
        },
        {
          type: 'task' as const,
          id: 'mock-task-3',
          title: language === 'tr' ? 'Spor Salonuna Git' : 'Go to Gym',
          priority: 'Low',
          isCompleted: true,
          original: {}
        }
      ];
    }

    const items: Array<{
      type: 'task';
      id: string | number;
      title: string;
      priority?: string;
      isCompleted: boolean;
      original: any;
    }> = [];

    // Add today's incomplete tasks
    todayTasksIncomplete.forEach(t => {
      items.push({
        type: 'task',
        id: t.id,
        title: t.title,
        priority: t.priority,
        isCompleted: false,
        original: t
      });
    });

    // Add today's undated incomplete tasks
    undatedTasksIncomplete.forEach(t => {
      items.push({
        type: 'task',
        id: t.id,
        title: t.title,
        priority: t.priority,
        isCompleted: false,
        original: t
      });
    });

    // Add today's completed tasks
    todayTasksCompleted.forEach(t => {
      items.push({
        type: 'task',
        id: t.id,
        title: t.title,
        priority: t.priority,
        isCompleted: true,
        original: t
      });
    });

    // Sort items:
    // 1. Incomplete first, completed last
    // 2. For incomplete: sorted by priority (High > Medium > Low)
    // 3. For completed: alphabetical
    return items.sort((a, b) => {
      const aDone = a.isCompleted;
      const bDone = b.isCompleted;
      if (aDone !== bDone) return aDone ? 1 : -1;

      if (!aDone) {
        const priorityMap: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
        const scoreA = priorityMap[a.priority || 'Medium'] || 2;
        const scoreB = priorityMap[b.priority || 'Medium'] || 2;
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      return a.title.localeCompare(b.title);
    });
  })();

  // Today's Habits
  const myDayHabits = (() => {
    if (completedTours?.dashboard !== true && !onboardingCompleted) {
      return [
        {
          id: 'mock-habit-1',
          title: language === 'tr' ? 'Kitap Oku' : 'Read Book',
          color: theme.streak,
          emoji: '📚',
          isCompleted: false,
          isSkipped: false,
          streak: 3,
          original: {}
        },
        {
          id: 'mock-habit-2',
          title: language === 'tr' ? 'Su İç' : 'Drink Water',
          color: theme.tertiary,
          emoji: '🥛',
          isCompleted: true,
          isSkipped: false,
          streak: 5,
          original: {}
        },
        {
          id: 'mock-habit-3',
          title: language === 'tr' ? 'Yürüyüş' : 'Walk',
          color: theme.primary,
          emoji: '👟',
          isCompleted: false,
          isSkipped: false,
          streak: 0,
          original: {}
        }
      ];
    }

    return habits.map(h => {
      const done = (h.completedDates ?? []).includes(habitTodayKey);
      const skipped = (h.skippedDates ?? []).includes(habitTodayKey);
      const streakVal = getHabitStreak(h);
      return {
        id: h.id,
        title: h.name,
        color: h.color,
        emoji: h.emoji,
        isCompleted: done,
        isSkipped: skipped,
        streak: streakVal,
        original: h
      };
    });
  })();

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

  const weeklyTips = React.useMemo(() => {
    return generateWeeklyTips({
      weeklyFocusMinutes: mergedWeeklyFocus.map(d => d.minutes || 0),
      completedTasksWeek: tasks.filter(t => t.isCompleted && (t.completedAt ? (Date.now() - new Date(t.completedAt).getTime() < 7 * 86400000) : true)).length,
      streak: streak,
      momentumLast7: [],
      productivityHour: 'afternoon',
      habits: habits.map(h => ({
        name: h.name,
        skippedDates: h.skippedDates || [],
        completedDates: h.completedDates || []
      })),
      tasks: tasks.map(t => ({
        id: t.id,
        priority: t.priority,
        isCompleted: t.isCompleted,
        dueDate: t.dueDate,
        completedAt: t.completedAt
      }))
    });
  }, [mergedWeeklyFocus, tasks, streak, habits]);

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
    
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    
    const pendingToday = tasks.filter(t => {
      if (!t) return false;
      if (t.id === taskId) return false;
      if (t.isCompleted) return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due <= todayEnd;
    });
    const allTasksDone = pendingToday.length === 0;

    if (soundEffects && !allTasksDone) {
      playSoundEffect(require('../assets/sounds/success.mp3'), {
        context: 'index.taskCompleteSound',
        volume: 0.15,
        reassertVolumeAfterMs: 150,
      });
    }

    const prefsState = usePrefsStore.getState();
    const isFirstWin = !prefsState.firstWinAt;

    if (isFirstWin) {
      require('@/shared/store/useConfettiStore').useConfettiStore.getState().trigger(
        language === 'tr' ? 'İlk Başarı!' : 'First Victory!',
        language === 'tr' ? 'Tebrikler, TAZQ\'daki ilk görevini tamamladın! 🎉' : 'Congratulations on completing your first task on TAZQ! 🎉',
        'high',
        'levelup'
      );
      prefsState.markFirstWin();
      useFocusStore.getState().addFocusPoints(10);
    } else if (allTasksDone) {
      require('@/shared/store/useConfettiStore').useConfettiStore.getState().trigger(
        language === 'tr' ? 'Günü Temizledin!' : 'Day Cleared!',
        language === 'tr' ? 'Bugünün tüm görevlerini başarıyla tamamladın! 🏆' : 'You completed all of today\'s tasks successfully! 🏆',
        'high',
        'day_cleared'
      );
      useFocusStore.getState().addFocusPoints(25);
    }
    toggleTaskCompletion(taskId);
    
    const modeInfo = getModeInfoForTask(task, prefsState, theme);
    if (modeInfo) {
      const planMode = task.tags?.find(tag => ['exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3', 'spor', 'spor2', 'spor3', 'ramazan', 'tasarruf', 'birakma'].includes(tag));
      useCompletionStore.getState().record(task.id, task.title, new Date().toISOString(), planMode);
    }
    // Offline-first: çevrimdışıysa tamamlamayı kuyruğa al (optimistik UI korunur);
    // yoksa kullanıcının tamamlaması kaybolur.
    const isOnline = useNetworkStore.getState().isOnline;
    if (!isOnline) {
      useOfflineQueue.getState().enqueue({ type: 'toggle-task', id: taskId, isCompleted: true, completedAt: new Date().toISOString() });
      return;
    }
    try {
      await TaskService.updateTask(taskId, { isCompleted: true });
    } catch (e: unknown) {
      if (isNetworkError(e)) {
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
    setCurrentTask('');
    // setDuration resets isActive to false internally — set both together after
    const secs = 25 * 60;
    useFocusStore.setState({ totalSeconds: secs, seconds: secs, isActive: true, lastActiveAt: Date.now() });
    setStatusHubVisible(false);
    router.replace('/focus');
  };

  const handleLogoPress = () => {
    // Biologically timed heartbeat haptic (lub-dub): soft click (1st beat) -> 130ms delay -> light impact (2nd beat)
    Haptics.selectionAsync();
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 130);

    setLogoTick(prev => prev + 1);
    
    // Smooth transition delay matching the clean 200ms logo pop
    setTimeout(() => {
      setCommandPortalVisible(true);
      setPortalSearch('');
    }, 220);
  };

  const momentumLabel = momentum >= 75 ? t.momentumHigh : momentum >= 40 ? t.momentumMid : t.momentumLow;

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

  const getGreeting = () => {
    if (currentHour >= 5 && currentHour < 13) return t.greetingMorning;
    if (currentHour >= 13 && currentHour < 18) return t.greetingAfternoon;
    if (currentHour >= 18 && currentHour < 23) return t.greetingEvening;
    return t.greetingNight;
  };

  const getSubGreeting = (): string => {
    // Ekranda GÖRÜNEN görevleri say — eskiden `tasks.filter(!isCompleted)` ile TÜM
    // tamamlanmamışlar sayılıyordu, gelecek tarihliler dahil. Ama aksiyon merkezi
    // gelecek tarihlileri göstermez (bkz. myDayTasks). Sonuç: kullanıcı gördüğü tüm
    // görevleri bitirse bile "5 görevin var" yazmaya devam ediyordu — göremediği
    // görevler sayıldığı için yazı "statik/bozuk" görünüyordu.
    const incomplete = todayTasksIncomplete.length + undatedTasksIncomplete.length;
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

  const renderMyDayItem = (item: any, isLast: boolean, index: number) => {
    return (
      <MyDayTaskRow
        key={`task-${item.id}`}
        item={item}
        isLast={isLast}
        theme={theme}
        isDark={isDark}
        tr={tr}
        onPress={() => {
          if (item.tags?.includes('weight_entry')) {
            Haptics.selectionAsync();
            setWeightModalTaskId(item.id);
          } else {
            router.push({ pathname: '/tasks', params: { highlightId: item.id } });
          }
        }}
        priorityColor={priorityColor}
        prefs={usePrefsStore.getState()}
      />
    );
  };

  const priorityColor = (p: string) => {
    if (p === 'High') return theme.priorityHigh;
    if (p === 'Medium') return theme.priorityMedium;
    return theme.priorityLow;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />
      {/* Yüzen başlık — dört sayfanın da kullandığı ortak bileşen (bkz. ScreenHeader).
          Eskiden bu blok her sayfada kopyalanmıştı; kopyalar ayrışıp boyları farklılaşmıştı. */}
      <ScreenHeader
        left={
          <Touchable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel={language === 'tr' ? 'Profil' : 'Profile'}
              // Avatar 34pt çiziliyor ama dokunma hedefi 44pt olmalı (Apple HIG).
              // Görsel boyut ≠ erişilebilir alan.
              hitSlop={touchSlop(scale(34))}
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
        }
        center={
          <Touchable
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={tr ? 'TAZQ' : 'TAZQ'}
              onPress={handleLogoPress}
              style={{ padding: S.smd, justifyContent: 'center', alignItems: 'center' }}
          >
              {/* Minimalist Focus Ripple Ring */}
              {logoTick > 0 && (
                <MotiView
                  key={`ripple-${logoTick}`}
                  from={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ type: 'timing', duration: 400 }}
                  style={{
                    position: 'absolute',
                    width: 44,
                    height: 24,
                    borderRadius: R.md,
                    borderWidth: 1.2,
                    borderColor: theme.primary,
                  }}
                />
              )}

              {/* Solid Minimal Logo Scale Heartbeat */}
              <MotiView
                  animate={{
                      scale: logoTick === 0 ? 1 : [1, 1.06, 1]
                  }}
                  transition={{
                      type: 'timing',
                      duration: 200
                  }}
              >
                  <TazqLogo height={30} />
              </MotiView>
          </Touchable>
        }
        right={
          <TourTarget id="cockpit">
            <StatusHub onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStatusHubVisible(true); }} />
          </TourTarget>
        }
      />

      <View style={{ flex: 1 }}>

        {/* Smart Cockpit Modal — bottom sheet */}
        <StatusHubModal
          visible={statusHubVisible}
          onClose={() => setStatusHubVisible(false)}
          theme={theme}
          isDark={isDark}
          language={language}
          t={t}
          insight={insight}
          momentum={momentum}
          momentumColor={momentumColor}
          todayCompleted={todayCompleted}
          dailyGoal={dailyGoal}
          isActive={isActive}
          startQuickFocus={startQuickFocus}
          weeklyTips={weeklyTips}
          weeklyFocusData={mergedWeeklyFocus}
          lastWeekMinutes={lastWeekMinutes}
          habits={habits}
          streak={streak}
        />

        {/* Değerlendirme / geri bildirim akışı — kendi bileşeninde (state'i de orada). */}
        <ReviewPromptModal
          visible={reviewModalVisible}
          onClose={() => setReviewModalVisible(false)}
          theme={theme}
          tr={tr}
        />

        <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            // Dip boşluğu navbar'ın GERÇEK yüksekliğinden gelir (bkz. navBarSpace).
            // Sabit S.xxl yazıyordu: navbar 106pt kaplarken 64pt bırakıyordu, yani son
            // 42pt barın arkasında kalıyor ve kullanıcı en alta inemiyordu.
            contentContainerStyle={[styles.scrollContent, { paddingTop: topBarSpace(insets.top) + S.lg, paddingBottom: navBarSpace(insets.bottom) + S.md, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchTasks(); fetchStats(); }} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={theme.surfaceContainer} progressViewOffset={insets.top + S.sm + 44 + S.sm} />}
        >
            <DashboardHero
              greeting={getGreeting()}
              name={user?.name?.split(' ')[0] || (language === 'tr' ? 'sen' : 'you')}
              subGreeting={getSubGreeting()}
              isSmallScreen={isSmallScreen}
              theme={theme}
            />

            <TourTarget id="momentum">
              <MomentumPulse
                score={momentum}
                history={momentumHistory}
                language={language}
                loading={statsLoading}
              />
            </TourTarget>

            <TodayCard
              completed={todayCompleted}
              goal={dailyGoal}
              focusMinutes={dailyFocusMinutes}
              focusGoalMinutes={dailyGoalMinutes}
              highlight={todayHighlight}
              surprise={todaySurprise}
              burstKey={todayBurstKey}
              onTap={todayTap.onTap}
              label={t.todayLabel}
              isSmallScreen={isSmallScreen}
              isDark={isDark}
              tr={language === 'tr'}
              theme={theme}
              padding={bentoPad}
            />

            {/* Unified My Day Bento Card */}
            {(myDayTasks.length > 0 || myDayHabits.length > 0) && (
              <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                {overdueCount > 0 && (
                  <Touchable
                    onPress={() => router.push('/tasks')}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm, paddingHorizontal: S.xxs }}
                  >
                    <View style={{ width: 5, height: 5, borderRadius: R.full, backgroundColor: theme.error }} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.error, flex: 1 }}>
                      {overdueCount} {language === 'tr' ? 'gecikmiş görev' : overdueCount === 1 ? 'overdue task' : 'overdue tasks'}
                    </Text>
                    <ChevronRight size={ICON.xs} color={theme.error} opacity={0.5} />
                  </Touchable>
                )}
                
                <BentoCard index={1} style={{ padding: 0, overflow: 'hidden' }}>
                  {/* BUGÜNKÜ RİTÜELLERİM (Daily Habits) */}
                  <TourTarget id="habits">
                    <MyDayHabits
                      habits={myDayHabits}
                      theme={theme}
                      isDark={isDark}
                      tr={tr}
                      onAddHabit={() => { Haptics.selectionAsync(); router.push('/cockpit'); }}
                      onSkip={(item) => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        toggleHabitSkipDate(item.id as string, habitTodayKey);
                      }}
                      onToggle={(item) => {
                          if (!item.isCompleted) {
                            const pendingHabits = habits.filter(h => h.id !== item.id && !h.completedDates?.includes(habitTodayKey));
                            const allHabitsDone = pendingHabits.length === 0;

                            if (soundEffects && !allHabitsDone) {
                              playSoundEffect(require('../assets/sounds/habit.mp3'), {
                                context: 'index.habitDoneSound',
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
                          }
                          Haptics.impactAsync(item.isCompleted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
                          toggleHabitDate(item.id as string, habitTodayKey);
}}
                    />
                  </TourTarget>

                  <Separator theme={theme} />
                  <TourTarget id="tasks">
                    {/* Dolgu YOK — SectionHeader kendi boşluğunu taşıyor. Sarmala da
                        vermek ikiye katlıyordu: bu başlık 32pt girintili çiziliyor ve
                        aynı karttaki alışkanlık başlığından (16pt) kaymış duruyordu. */}
                    <Touchable
                      onPress={() => router.push('/tasks')}
                      accessibilityRole="button"
                      accessibilityLabel={tr ? 'Günlük görevleri yönet' : 'Manage daily tasks'}
                    >
                    <SectionHeader
                      title={tr ? 'Günlük görevlerim' : 'My daily tasks'}
                      theme={theme}
                      tr={tr}
                      inset={S.md}
                    />
                  </Touchable>

                  {/* Render Incomplete Tasks */}
                  {(() => {
                    const incompleteTasks = myDayTasks.filter(item => !item.isCompleted);
                    const visibleIncomplete = showAllIncomplete ? incompleteTasks : incompleteTasks.slice(0, 4);
                    
                    if (incompleteTasks.length === 0) {
                      return (
                        <View style={{ padding: S.md, alignItems: 'center' }}>
                          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>
                            {tr ? 'Bugün için bekleyen görevin kalmadı 🎉' : 'No pending tasks for today 🎉'}
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <View>
                        {visibleIncomplete.map((item, idx) => {
                          const isLast = idx === visibleIncomplete.length - 1;
                          return renderMyDayItem(item, isLast, idx);
                        })}
                        
                        {incompleteTasks.length > 4 && (
                          <Touchable
                            onPress={() => { Haptics.selectionAsync(); setShowAllIncomplete(!showAllIncomplete); }}
                            style={{
                              paddingVertical: S.smd,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderTopWidth: HAIRLINE,
                              borderTopColor: theme.separator
                            }}
                          >
                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.primary }}>
                              {showAllIncomplete
                                ? (language === 'tr' ? 'Daha Az Göster' : 'Show Less')
                                : (language === 'tr' ? `Daha Fazla Göster (${incompleteTasks.length - 4} adet)` : `Show More (${incompleteTasks.length - 4})`)
                              }
                            </Text>
                          </Touchable>
                        )}
                      </View>
                    );
                  })()}

                  {/* Render Completed Tasks (Collapsible Section) */}
                  {(() => {
                    const completedTasks = myDayTasks.filter(item => item.isCompleted);
                    if (completedTasks.length === 0) return null;
                    
                    return (
                      <View style={{ borderTopWidth: HAIRLINE, borderTopColor: theme.separator }}>
                        <Touchable
                          onPress={() => { Haptics.selectionAsync(); setShowCompletedSection(!showCompletedSection); }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: S.md,
                            paddingVertical: S.smd,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
                          }}
                        >
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted }}>
                            {language === 'tr' ? `Tamamlananlar (${completedTasks.length})` : `Completed (${completedTasks.length})`}
                          </Text>
                          <ChevronRight
                            size={14}
                            color={theme.onSurfaceVariant}
                            opacity={0.4}
                            style={{ transform: [{ rotate: showCompletedSection ? '90deg' : '0deg' }] }}
                          />
                        </Touchable>
                        
                        {showCompletedSection && (
                          <View>
                            {completedTasks.map((item, idx) => {
                              const isLast = idx === completedTasks.length - 1;
                              return renderMyDayItem(item, isLast, idx);
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })()}
                  </TourTarget>
                </BentoCard>
              </View>
            )}

            {/* Focus Widget */}
            <DynamicIsland />

            {/* İlk açılış — soğuk başlangıç kartı: görev ve alışkanlık yokken kullanıcıya net 3 giriş noktası sunar */}
            {completedTours?.dashboard === true && tasks.length === 0 && habits.length === 0 && (
              <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <BentoCard index={1} style={{ padding: isSmallScreen ? S.md : S.lg, gap: S.sm }}>
                    <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.3, marginBottom: S.xs }}>
                        {tr ? 'Hoş geldin 👋 Nereden başlamak istersin?' : 'Welcome 👋 Where would you like to start?'}
                    </Text>
                    {[
                        { icon: <Plus size={ICON.md} color={theme.primary} />, label: tr ? 'İlk görevini ekle' : 'Add your first task', sub: tr ? 'Aklındakini yaz, gerisini TAZQ halletsin' : 'Jot it down, TAZQ handles the rest', onPress: () => router.push('/tasks') },
                        { icon: <Rocket size={ICON.md} color={theme.primary} />, label: tr ? 'Bir mod seç' : 'Choose a mode', sub: tr ? 'Sigara bırak, tasarruf, sınava hazırlık…' : 'Quit smoking, save, exam prep…', onPress: () => router.push('/modlar') },
                        { icon: <Flame size={ICON.md} color={theme.primary} />, label: tr ? 'Bir alışkanlık başlat' : 'Start a habit', sub: tr ? 'Her gün tek dokunuşla işaretle' : 'Check in daily with one tap', onPress: () => router.push('/cockpit') },
                    ].map((row, i) => (
                        <Touchable key={i} onPress={row.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.xs + 2 }} accessibilityRole="button" accessibilityLabel={row.label}>
                            <View style={{ width: 38, height: 38, borderRadius: R.md, backgroundColor: theme.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}>{row.icon}</View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface }}>{row.label}</Text>
                                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{row.sub}</Text>
                            </View>
                            <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.4} />
                        </Touchable>
                    ))}
                </BentoCard>
              </View>
            )}

            {/* Sonraki görev — dashboard'ın tek eylem çağrısı. Hiç görev/alışkanlık
                yoksa gösterilmez: orada soğuk başlangıç kartı zaten yönlendiriyor. */}
            {!(tasks.length === 0 && habits.length === 0) && (
              <NextMissionCard
                task={topTask ? { id: topTask.id, priority: topTask.priority } : null}
                title={topTask ? getLocalizedTaskTitle(topTask, tr) : t.noTasksHint}
                subtitle={topTask ? (getLocalizedTaskDescription(topTask, tr) || t.waitingForAction) : t.allTasksReady}
                badgeLabel={t.activeTask.toLocaleUpperCase(tr ? 'tr-TR' : 'en-US')}
                showUrgent={topTask?.priority === 'High' && !getModeInfoForTask(topTask, usePrefsStore.getState(), theme)}
                urgentLabel={tr ? 'ACİL' : 'URGENT'}
                primaryLabel={topTask ? (tr ? 'GÖREVE GİT' : 'GO TO TASK') : t.addTask.toLocaleUpperCase(tr ? 'tr-TR' : 'en-US')}
                seeAllLabel={t.filterAll}
                onOpenTask={() => router.push({ pathname: '/tasks', params: { highlightId: String(topTask?.id) } })}
                onSeeAll={() => router.push('/tasks')}
                priorityColor={priorityColor}
                isSmallScreen={isSmallScreen}
                isDark={isDark}
                theme={theme}
                padding={isSmallScreen ? S.md : S.lg}
              />
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
              <Touchable onPress={headerTap.onTap} activeOpacity={1} style={{ paddingHorizontal: S.lg, marginBottom: S.sm }}>
                <Animated.View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', transform: [{ scale: headerScale }] }}>
                  <Text style={{ fontSize: 9, fontWeight: '600', letterSpacing: 1.8, color: theme.onSurfaceVariant }}>
                    {language === 'tr' ? '✦ İYİ GİDİYOR' : '✦ LOOKING GOOD'}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: theme.primary }}>
                    {language === 'tr' ? 'devam et →' : 'keep going →'}
                  </Text>
                </Animated.View>
              </Touchable>
            )}


        </ScrollView>

        {/* Quick Draft Modal */}
        <QuickDraftModal
          visible={quickDraftVisible}
          onClose={() => setQuickDraftVisible(false)}
          onSave={handleQuickSave}
          theme={theme}
          isDark={isDark}
          language={language}
          t={t}
        />

        {/* Profile Onboarding/Setup Modal */}
        <ProfileSetupModal
          visible={profileSetupVisible}
          theme={theme}
          isDark={isDark}
          language={language}
          t={t}
          currentName={user?.name || ''}
          isNamePlaceholder={isNamePlaceholder}
          onSave={handleProfileSetupSave}
        />

      </View>

      {/* Hızlı taslak — görev listesine tek dokunuşla not düşer. */}
      <MagneticFAB
        onPress={() => setQuickDraftVisible(true)}
        storageKey={`@fab_dashboard_${user?.id ?? 'guest'}`}
        isDark={isDark}
        theme={theme}
        style={{
          backgroundColor: theme.primary,
          shadowColor: theme.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        buttonSize={54}
      >
        {/*
          İkon Zap (şimşek) idi: şimşek hız/enerji anlatır, bu buton ise "görev listene
          taslak EKLE" yapıyor — ikon eylemle ilgisizdi. Plus evrensel "ekle"dir ve
          uygulamanın geri kalanında da zaten bunu söylüyor.

          Renk: "#fff" sabit yazılıydı ve paleti atlıyordu. Koyu temada primary #0A84FF
          ve onPrimary BİLEREK koyu (beyaz, o mavinin üstünde 3.65:1 — AA'dan kalıyor).
          Sabit beyaz, tam da paletin kaçındığı şeyi geri getiriyordu.
        */}
        <Plus size={ICON.lg} color={theme.onPrimary} strokeWidth={2.5} />
      </MagneticFAB>

      <BottomNavBar />

      <Modal
        visible={commandPortalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCommandPortalVisible(false)}
        onShow={() => {
          setTimeout(() => {
            portalInputRef.current?.focus();
          }, 80);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <BlurView intensity={25} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setCommandPortalVisible(false); }}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          
          <SafeAreaView style={{ flex: 1, paddingHorizontal: S.lmd }} pointerEvents="box-none">
            <MotiView
              from={{ translateY: -30, opacity: 0, scale: 0.96 }}
              animate={{ translateY: 0, opacity: 1, scale: 1 }}
              exit={{ translateY: -30, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 180 }}
              style={{
                marginTop: S.xxl,
                backgroundColor: isDark ? 'rgba(28, 28, 35, 0.94)' : 'rgba(255, 255, 255, 0.94)',
                borderRadius: R.xl,
                borderWidth: 1.2,
                borderColor: theme.primary + '25',
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: isDark ? 0.35 : 0.12,
                shadowRadius: 28,
                elevation: 12,
                overflow: 'hidden',
                maxHeight: '65%'
              }}
            >
              {/* Search Input Area */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: S.md,
                paddingVertical: S.md,
                borderBottomWidth: HAIRLINE,
                borderBottomColor: theme.separator,
                gap: S.smd
              }}>
                <Sparkles size={ICON.md} color={theme.primary} />
                <TextInput
                  ref={portalInputRef}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: '600',
                    color: theme.onSurface,
                    padding: 0,
                    margin: 0
                  }}
                  placeholder={language === 'tr' ? 'Görev ara veya hızlı görev yaz...' : 'Search tasks or write a quick task...'}
                  placeholderTextColor={theme.onSurfaceVariant + '80'}
                  value={portalSearch}
                  onChangeText={setPortalSearch}
                  onSubmitEditing={() => {
                    if (portalSearch.trim()) {
                      const hint = parseTaskHint(portalSearch.trim(), language as 'tr' | 'en');
                      const isReminder = hint.tags?.includes('hatırlatıcı') || hint.tags?.includes('reminder');
                      const newTask = {
                        id: Date.now(),
                        title: portalSearch.trim(),
                        description: '',
                        priority: hint.priority || 'Medium',
                        isCompleted: false,
                        dueDate: hint.dueDate || (isReminder ? new Date().toISOString() : null),
                        dueTime: hint.dueTime || null,
                        tags: hint.tags?.length ? hint.tags : ['QuickAdd']
                      };
                      useTaskStore.getState().addTask(newTask);
                      setCommandPortalVisible(false);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      showToast(language === 'tr' ? 'Görev başarıyla eklendi!' : 'Task added successfully!', 'success');
                    }
                  }}
                  returnKeyType="done"
                />
                {portalSearch.length > 0 && (
                  <Touchable onPress={() => setPortalSearch('')} style={{ marginRight: S.xs }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.primary }}>
                      {language === 'tr' ? 'TEMİZLE' : 'CLEAR'}
                    </Text>
                  </Touchable>
                )}
                <Touchable
                  accessibilityRole="button"
                  accessibilityLabel={tr ? 'Kapat' : 'Close'}
                  onPress={() => setCommandPortalVisible(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={ICON.md} color={theme.onSurfaceVariant} opacity={0.6} />
                </Touchable>
              </View>

              {/* Results / Navigation shortcuts */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: S.smd, gap: S.xs }}
              >
                {portalSearch.trim() === '' ? (
                  // Shortcuts
                  <View style={{ gap: S.xs }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.onSurfaceMuted, paddingLeft: S.sm, paddingBottom: S.sm }}>
                      {language === 'tr' ? 'HIZLI KISAYOLLAR' : 'QUICK SHORTCUTS'}
                    </Text>
                    {[
                      {
                        icon: <Play size={ICON.sm} color={theme.tertiary} fill={theme.tertiary} />,
                        label: language === 'tr' ? 'Hızlı Odak Seansı Başlat' : 'Start Quick Focus Session',
                        desc: language === 'tr' ? '25 dakikalık odaklanma başlat' : 'Launch a 25 min focus timer',
                        onPress: () => {
                          setCommandPortalVisible(false);
                          startQuickFocus();
                        }
                      },
                      {
                        icon: <Target size={ICON.sm} color={theme.primary} />,
                        label: language === 'tr' ? 'Tüm Görevleri Listele' : 'Show All Tasks List',
                        desc: language === 'tr' ? 'Görevler sayfasına yönlendir' : 'Go to tasks management screen',
                        onPress: () => {
                          setCommandPortalVisible(false);
                          router.push('/tasks');
                        }
                      },
                      {
                        icon: <Rocket size={ICON.sm} color={theme.primary} />,
                        label: language === 'tr' ? 'Aktif Modları Yönet' : 'Manage Active Modes',
                        desc: language === 'tr' ? 'Alışkanlık planlarını keşfet' : 'Explore habits and life modes',
                        onPress: () => {
                          setCommandPortalVisible(false);
                          router.push('/modlar');
                        }
                      }
                    ].map((shortcut, idx) => (
                      <Touchable
                        key={idx}
                        onPress={shortcut.onPress}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: S.smd,
                          paddingVertical: S.smd,
                          borderRadius: R.md,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                          gap: S.smd
                        }}
                      >
                        <View style={{ width: 30, height: 30, borderRadius: R.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', alignItems: 'center', justifyContent: 'center' }}>
                          {shortcut.icon}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.onSurface }}>{shortcut.label}</Text>
                          <Text style={{ fontSize: 10, fontWeight: '500', color: theme.onSurfaceMuted }}>{shortcut.desc}</Text>
                        </View>
                        <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.3} />
                      </Touchable>
                    ))}
                  </View>
                ) : (
                  // Search Results
                  <View style={{ gap: S.xs }}>
                    {/* Quick Add Row */}
                    <Touchable
                      onPress={() => {
                        const hint = parseTaskHint(portalSearch.trim(), language as 'tr' | 'en');
                        const isReminder = hint.tags?.includes('hatırlatıcı') || hint.tags?.includes('reminder');
                        const newTask = {
                          id: Date.now(),
                          title: portalSearch.trim(),
                          description: '',
                          priority: hint.priority || 'Medium',
                          isCompleted: false,
                          dueDate: hint.dueDate || (isReminder ? new Date().toISOString() : null),
                          dueTime: hint.dueTime || null,
                          tags: hint.tags?.length ? hint.tags : ['QuickAdd']
                        };
                        useTaskStore.getState().addTask(newTask);
                        setCommandPortalVisible(false);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        showToast(language === 'tr' ? 'Görev başarıyla eklendi!' : 'Task added successfully!', 'success');
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: S.smd,
                        paddingVertical: S.smd,
                        borderRadius: R.md,
                        backgroundColor: theme.primary + '12',
                        borderWidth: 1,
                        borderColor: theme.primary + '30',
                        gap: S.smd,
                        marginBottom: S.sm
                      }}
                    >
                      <View style={{ width: 28, height: 28, borderRadius: R.sm, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={ICON.sm} color={theme.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary }} numberOfLines={1}>
                          {language === 'tr' ? `"${portalSearch}" görevini ekle` : `Add task "${portalSearch}"`}
                        </Text>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.onSurfaceMuted }}>
                          {language === 'tr' ? 'Otomatik zaman ve öncelik tespiti ile ekler' : 'Adds with automatic time & priority parsing'}
                        </Text>
                      </View>
                    </Touchable>

                    {/* Matching Tasks */}
                    {(() => {
                      const matchedTasks = tasks.filter(t => t.title.toLowerCase().includes(portalSearch.toLowerCase()));
                      if (matchedTasks.length === 0) return null;
                      return (
                        <View style={{ gap: S.xs }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.onSurfaceMuted, paddingLeft: S.sm, paddingBottom: S.xs }}>
                            {language === 'tr' ? 'GÖREVLER' : 'TASKS'}
                          </Text>
                          {matchedTasks.slice(0, 5).map(task => (
                            <Touchable
                              key={task.id}
                              onPress={() => {
                                setCommandPortalVisible(false);
                                router.push({ pathname: '/tasks', params: { highlightId: task.id } });
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: S.smd,
                                paddingVertical: S.smd,
                                borderRadius: R.md,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                gap: S.smd
                              }}
                            >
                              <View style={{ width: 6, height: 6, borderRadius: R.full, backgroundColor: priorityColor(task.priority) }} />
                              <View style={{ flex: 1 }}>
                                <Text style={{
                                  fontSize: 12,
                                  fontWeight: '600',
                                  color: task.isCompleted ? theme.onSurfaceVariant : theme.onSurface,
                                  textDecorationLine: task.isCompleted ? 'line-through' : 'none',
                                  opacity: task.isCompleted ? 0.5 : 1
                                }} numberOfLines={1}>
                                    {getLocalizedTaskTitle(task, language === 'tr')}
                                </Text>
                              </View>
                              <ChevronRight size={ICON.xs} color={theme.onSurfaceVariant} opacity={0.3} />
                            </Touchable>
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                )}
              </ScrollView>
            </MotiView>
          </SafeAreaView>
        </View>
      </Modal>

      <WeightEntryModal
        visible={weightModalTaskId !== null}
        taskId={weightModalTaskId}
        onClose={() => setWeightModalTaskId(null)}
      />

      {(!profileSetupVisible && completedTours?.dashboard !== true) && (
        <HelpTourModal
          pageId="dashboard"
          onStepChange={handleStepChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBarWrapper: { paddingHorizontal: S.lg, paddingVertical: S.sm, alignItems: 'center' },
  // Yükseklik SABİT (bkz. TOP_BAR_HEIGHT): eskiden paddingVertical + en yüksek çocuk
  // belirliyordu, yani başlığa bir öğe eklendiğinde bar sessizce uzayıp sayfaların
  // hesabını bozuyordu. Öğeler artık barın içinde ortalanır.
  avatarContainer: { width: scale(34), height: scale(34), borderRadius: R.full, overflow: 'hidden', borderWidth: B.thin, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.surfaceContainerLowest },
  avatar: { width: '100%', height: '100%' },
  scrollContent: { flexGrow: 1 },
  // Üst ve alt boşluk EŞİT (simetrik blok). Üst boşluk paddingTop'tan değil buradan gelir.
  // marginTop KALDIRILDI: baslikla arasindaki bosluk artik topBarSpace'ten geliyor.
  // Burada da vermek cift sayardi. marginBottom kaliyor -> ust/alt yine esit (S.lg).
  metricValue: { fontSize: F.title, fontWeight: '600', letterSpacing: -1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: scale(24) },
  insightCard: { width: '100%', borderRadius: R.lg + 8, padding: scale(24), borderWidth: B.thin, gap: scale(24) },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  insightIcon: { width: scale(36), height: scale(36), borderRadius: R.sm + 4, alignItems: 'center', justifyContent: 'center' },
  insightHeaderTitle: { fontSize: moderateScale(13), fontWeight: '600', letterSpacing: 1, opacity: 0.6 },
  insightBody: { gap: scale(16) },
  bentoMini: { padding: scale(16), borderRadius: R.md + 4 },
  insightMainText: { fontSize: moderateScale(16), fontWeight: '600', lineHeight: verticalScale(24), letterSpacing: -0.3 },
  insightStats: { gap: scale(12) },
  statBento: { padding: scale(16), borderRadius: R.md + 4, alignItems: 'center', gap: S.xs },
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

