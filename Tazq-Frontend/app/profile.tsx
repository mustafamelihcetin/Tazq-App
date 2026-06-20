import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Alert, Modal, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Keyboard, Linking, Animated, Switch, Dimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, Languages, LogOut, ChevronRight, Award, Zap, Target, Trophy, Shield, CalendarDays, BookOpen, Star } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { AuthService, FocusService } from '../services/api';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { requestNotificationPermissions, cancelWeeklySummary, scheduleExamCountdownNotifs, cancelExamCountdownNotifs } from '../utils/notifications';
import { S, R, F } from '../constants/tokens';
import { useToastStore } from '../store/useToastStore';
import { AVATAR_CONFIGS, getAvatarSource } from '../utils/avatars';
import { usePrefsStore } from '../store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '../store/useHabitStore';
import { useTaskStore } from '../store/useTaskStore';
import { TurkishModeBanner } from '../components/TurkishModeBanner';
import { getModePreview, getTezMode, getMulakatMode, ModeType } from '../utils/turkishModes';

const GOAL_OPTIONS = [30, 60, 90, 120];

export default function ProfileScreen() {
  const { theme, colorScheme, setTheme, currentSetting } = useAppTheme();
  const { user, setUser, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const { show: showToast } = useToastStore();
  const insets = useSafeAreaInsets();

  const { bestStreak, streakFreezeAvailable, useStreakFreeze, dailyGoalMinutes, setDailyGoal, updateBestStreak, checkStreakFreezeReset } = useFocusStore();
  const { seasonal, setSeasonalPref, weeklyNotification, setWeeklyNotification,
          examPlanHabitIds, examPlanTaskIds, exam2PlanHabitIds, exam2PlanTaskIds,
          ramazanPlanHabitIds, ramazanPlanTaskIds,
          tezPlanHabitIds, tezPlanTaskIds,
          mulakatPlanHabitIds, mulakatPlanTaskIds,
          examReviewShown, setExamReviewShown,
          setPlanIds, clearPlanIds } = usePrefsStore();
  const { habits, removeHabit } = useHabitStore();
  const { removeTask } = useTaskStore();
  const [modePreview, setModePreview] = useState<{ type: ModeType; key: number } | null>(null);
  const [examNameInput, setExamNameInput] = useState(seasonal.examName || '');
  const [examDateInput, setExamDateInput] = useState(seasonal.examDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [examExpanded, setExamExpanded] = useState(false);
  const [exam2NameInput, setExam2NameInput] = useState(seasonal.exam2Name || '');
  const [exam2DateInput, setExam2DateInput] = useState(seasonal.exam2Date || '');
  const [exam2Expanded, setExam2Expanded] = useState(false);
  const [showExam2DatePicker, setShowExam2DatePicker] = useState(false);
  const [tezNameInput, setTezNameInput] = useState(seasonal.tezName || '');
  const [tezDateInput, setTezDateInput] = useState(seasonal.tezDate || '');
  const [tezExpanded, setTezExpanded] = useState(false);
  const [showTezDatePicker, setShowTezDatePicker] = useState(false);
  const [mulakatNameInput, setMulakatNameInput] = useState(seasonal.mulakatName || '');
  const [mulakatDateInput, setMulakatDateInput] = useState(seasonal.mulakatDate || '');
  const [mulakatExpanded, setMulakatExpanded] = useState(false);
  const [showMulakatDatePicker, setShowMulakatDatePicker] = useState(false);
  const examDateObj = examDateInput ? new Date(examDateInput) : new Date(Date.now() + 30 * 86400000);
  const exam2DateObj = exam2DateInput ? new Date(exam2DateInput) : new Date(Date.now() + 60 * 86400000);
  const tezDateObj = tezDateInput ? new Date(tezDateInput) : new Date(Date.now() + 90 * 86400000);
  const mulakatDateObj = mulakatDateInput ? new Date(mulakatDateInput) : new Date(Date.now() + 14 * 86400000);

  const formatExamDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (language === 'tr') {
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const examIsComplete = examNameInput.trim() !== '' && examDateInput !== '';
  const examDatePast = examDateInput
    ? new Date(examDateInput).setHours(23, 59, 59, 999) < Date.now()
    : false;

  // Plan progress & countdown
  const thisWeekKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keys.add(fmtDateKey(d));
    }
    return keys;
  }, []);

  const examPlanHabits = useMemo(
    () => habits.filter(h => examPlanHabitIds.includes(h.id)),
    [habits, examPlanHabitIds]
  );
  const examHabitsActiveThisWeek = examPlanHabits.filter(h =>
    (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))
  ).length;
  const examWeekPct = examPlanHabits.length > 0
    ? Math.round(examHabitsActiveThisWeek / examPlanHabits.length * 100)
    : 0;

  const ramazanPlanHabits = useMemo(
    () => habits.filter(h => ramazanPlanHabitIds.includes(h.id)),
    [habits, ramazanPlanHabitIds]
  );
  const ramazanHabitsActiveThisWeek = ramazanPlanHabits.filter(h =>
    (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))
  ).length;
  const ramazanWeekPct = ramazanPlanHabits.length > 0
    ? Math.round(ramazanHabitsActiveThisWeek / ramazanPlanHabits.length * 100)
    : 0;

  const examDaysLeft = examDateInput && !examDatePast
    ? Math.max(0, Math.ceil((new Date(examDateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000))
    : 0;
  const urgencyColor = examDaysLeft <= 7 ? '#EF4444' : examDaysLeft <= 30 ? '#F59E0B' : '#3B82F6';

  // Exam 2
  const exam2IsComplete = exam2NameInput.trim() !== '' && exam2DateInput !== '';
  const exam2DatePast = exam2DateInput ? new Date(exam2DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const exam2DaysLeft = exam2DateInput && !exam2DatePast
    ? Math.max(0, Math.ceil((new Date(exam2DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000))
    : 0;
  const exam2UrgencyColor = exam2DaysLeft <= 7 ? '#EF4444' : exam2DaysLeft <= 30 ? '#F59E0B' : '#3B82F6';

  // Tez / Proje
  const tezIsComplete = tezNameInput.trim() !== '' && tezDateInput !== '';
  const tezDatePast = tezDateInput ? new Date(tezDateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const tezDaysLeft = tezDateInput && !tezDatePast
    ? Math.max(0, Math.ceil((new Date(tezDateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000))
    : 0;
  const tezUrgencyColor = tezDaysLeft <= 7 ? '#EF4444' : tezDaysLeft <= 30 ? '#F59E0B' : '#8B5CF6';

  // İş Mülakatı
  const mulakatIsComplete = mulakatNameInput.trim() !== '' && mulakatDateInput !== '';
  const mulakatDatePast = mulakatDateInput ? new Date(mulakatDateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const mulakatDaysLeft = mulakatDateInput && !mulakatDatePast
    ? Math.max(0, Math.ceil((new Date(mulakatDateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000))
    : 0;
  const mulakatUrgencyColor = mulakatDaysLeft <= 7 ? '#EF4444' : mulakatDaysLeft <= 30 ? '#F59E0B' : '#10B981';

  const tezPlanHabits = useMemo(
    () => habits.filter(h => tezPlanHabitIds.includes(h.id)),
    [habits, tezPlanHabitIds]
  );
  const tezHabitsActiveThisWeek = tezPlanHabits.filter(h =>
    (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))
  ).length;
  const tezWeekPct = tezPlanHabits.length > 0
    ? Math.round(tezHabitsActiveThisWeek / tezPlanHabits.length * 100)
    : 0;

  const mulakatPlanHabits = useMemo(
    () => habits.filter(h => mulakatPlanHabitIds.includes(h.id)),
    [habits, mulakatPlanHabitIds]
  );
  const mulakatHabitsActiveThisWeek = mulakatPlanHabits.filter(h =>
    (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))
  ).length;
  const mulakatWeekPct = mulakatPlanHabits.length > 0
    ? Math.round(mulakatHabitsActiveThisWeek / mulakatPlanHabits.length * 100)
    : 0;

  const closeExamModeWithReview = useCallback(() => {
    cancelExamCountdownNotifs();
    examPlanHabitIds.forEach(id => removeHabit(id));
    examPlanTaskIds.forEach(id => removeTask(id));
    exam2PlanHabitIds.forEach(id => removeHabit(id));
    exam2PlanTaskIds.forEach(id => removeTask(id));
    clearPlanIds('exam');
    clearPlanIds('exam2');
    setExamNameInput('');
    setExamDateInput('');
    setExam2NameInput('');
    setExam2DateInput('');
    setExamExpanded(false);
    setExam2Expanded(false);
    setSeasonalPref('examMode', false);
    setSeasonalPref('examName', '');
    setSeasonalPref('examDate', null);
    setSeasonalPref('exam2Name', '');
    setSeasonalPref('exam2Date', null);
    setExamReviewShown(false);
    showToast(language === 'tr' ? '🎓 Sınav modu kapatıldı' : '🎓 Exam mode closed', 'success');
  }, [examPlanHabitIds, examPlanTaskIds, exam2PlanHabitIds, exam2PlanTaskIds, language]);

  // Use a ref so the useFocusEffect cleanup always reads fresh seasonal values
  const seasonalRef = useRef(seasonal);
  useEffect(() => { seasonalRef.current = seasonal; }, [seasonal]);

  // On focus: show "Nasıl geçti?" if exam date has passed. On blur: disable incomplete modes.
  useFocusEffect(
    useCallback(() => {
      const s = seasonalRef.current;
      if (s.examMode && s.examDate && !examReviewShown) {
        const past = new Date(s.examDate).setHours(23, 59, 59, 999) < Date.now();
        if (past) {
          setExamReviewShown(true);
          const name = s.examName || (language === 'tr' ? 'Sınav' : 'Exam');
          setTimeout(() => {
            Alert.alert(
              language === 'tr' ? `🎓 ${name} tamamlandı!` : `🎓 ${name} is over!`,
              language === 'tr' ? 'Nasıl geçti?' : 'How did it go?',
              [
                { text: language === 'tr' ? 'Harika geçti 🎉' : 'It went great 🎉', onPress: closeExamModeWithReview },
                { text: language === 'tr' ? 'Orta geçti 😅' : 'So-so 😅', onPress: closeExamModeWithReview },
                { text: language === 'tr' ? 'Zor geçti 😢' : 'It was tough 😢', onPress: closeExamModeWithReview },
              ],
              { cancelable: false }
            );
          }, 600);
        }
      }
      return () => {
        const s = seasonalRef.current;
        if (s.examMode && (!s.examName?.trim() || !s.examDate)) {
          setSeasonalPref('examMode', false);
          setSeasonalPref('examName', '');
          setSeasonalPref('examDate', null);
        }
        if (s.tezMode && (!s.tezName?.trim() || !s.tezDate)) {
          setSeasonalPref('tezMode', false);
          setSeasonalPref('tezName', '');
          setSeasonalPref('tezDate', null);
        }
        if (s.mulakatMode && (!s.mulakatName?.trim() || !s.mulakatDate)) {
          setSeasonalPref('mulakatMode', false);
          setSeasonalPref('mulakatName', '');
          setSeasonalPref('mulakatDate', null);
        }
      };
    }, [examReviewShown, language, closeExamModeWithReview])
  );

  // isSmallDevice / isShortDevice removed — design tokens used instead

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'm1');
  const [newName, setNewName] = useState(user?.name || '');
  const [selectedGoal, setSelectedGoal] = useState(dailyGoalMinutes);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const { panResponder: editPan, animatedStyle: editSlide, prepare: prepareEdit, slideIn: editSlideIn } = useSwipeToDismiss({
    onDismiss: () => setEditModalVisible(false),
  });

  const [stats, setStats] = useState({ totalFocusHours: 0, completedTasksCount: 0, activeStreak: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      const kh = e.endCoordinates.height;
      setKbHeight(kh);
      if (Platform.OS === 'ios') {
        examInputViewRef.current?.measureInWindow((x, y, w, h) => {
          const screenH = Dimensions.get('screen').height;
          const kbTop = screenH - kh;
          const targetY = kbTop * 0.38;
          const inputCenterY = y + h / 2;
          const scrollDelta = inputCenterY - targetY;
          if (scrollDelta > 0) {
            scrollViewRef.current?.scrollTo({ y: scrollOffsetRef.current + scrollDelta, animated: true });
          }
        });
      }
    });
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    checkStreakFreezeReset();
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (seasonal.examMode && seasonal.examDate && seasonal.examName) {
      scheduleExamCountdownNotifs(seasonal.examName, seasonal.examDate, language);
    }
  }, [seasonal.examDate, seasonal.examName, seasonal.examMode]);

  const loadStats = () => {
    setStatsLoading(true);
    setStatsError(false);
    FocusService.getStats().then((s) => {
      const active = s.activeStreak ?? 0;
      setStats({ totalFocusHours: s.totalFocusHours ?? 0, completedTasksCount: s.completedTasksCount ?? 0, activeStreak: active });
      updateBestStreak(active);
    }).catch((e) => {
        if (e.response?.status !== 401) {
          console.warn('getStats error:', e.message);
          setStatsError(true);
        }
    }).finally(() => setStatsLoading(false));
  };

  useEffect(() => {
    loadStats();
    requestNotificationPermissions().then((granted) => setNotifEnabled(granted));
  }, []);

  const openEditModal = () => {
    prepareEdit();
    setSelectedAvatar(user?.avatar || 'm1');
    setNewName(user?.name || '');
    setSelectedGoal(dailyGoalMinutes);
    setProfileError(null);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!newName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setProfileError(language === 'tr' ? 'Görünen ad boş olamaz.' : 'Name cannot be empty.');
      return;
    }
    setProfileError(null);
    setSavingProfile(true);
    try {
      await AuthService.updateProfile({ avatar: selectedAvatar, name: newName.trim() });
      // Update local state and close only on success — prevents unmounted-component reopen on error
      setUser({ ...user, avatar: selectedAvatar, name: newName.trim() });
      setDailyGoal(selectedGoal);
      setEditModalVisible(false);
      showToast(t.toastProfileUpdated, 'success');
    } catch (e: any) {
      const msg = !e.response
        ? (language === 'tr' ? 'Bağlantı hatası. Tekrar dene.' : 'Connection error. Try again.')
        : (language === 'tr' ? 'Güncelleme başarısız.' : 'Update failed.');
      setProfileError(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleNotifications = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (notifEnabled) {
      Alert.alert(t.notifications, t.notifDisableHint, [
        { text: t.cancel, style: 'cancel' },
        { text: t.openSettings, onPress: () => Linking.openSettings() },
      ]);
    } else {
      const granted = await requestNotificationPermissions();
      if (granted) {
        setNotifEnabled(true);
      } else {
        Alert.alert(t.notifications, t.notifEnableHint, [
          { text: t.cancel, style: 'cancel' },
          { text: t.openSettings, onPress: () => Linking.openSettings() },
        ]);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(t.logout, t.confirmLogout, [
      { text: t.cancel, style: "cancel" },
      { text: t.yes, style: "destructive", onPress: () => { logout(); router.replace('/login'); }}
    ]);
  };

  const toggleLanguage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(language === 'tr' ? 'en' : 'tr');
  };

  const toggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = currentSetting === 'light' ? 'dark' : currentSetting === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const handleStreakFreeze = () => {
    if (!streakFreezeAvailable) return;
    Alert.alert(t.streakFreeze, t.streakFreezeConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.streakFreezeUse, onPress: () => { useStreakFreeze(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } }
    ]);
  };

  const displayBestStreak = Math.max(bestStreak, stats.activeStreak);
  const scrollViewRef = useRef<ScrollView>(null);
  const examInputViewRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: S.lg, paddingTop: S.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        >
          <View style={[styles.header, { marginTop: S.md }]}>
            <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={[styles.avatarLarge, { borderColor: isDark ? theme.primary + '40' : 'rgba(0,0,0,0.05)', width: 110, height: 110, borderRadius: 55, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
                <Image source={getAvatarSource(user?.avatar || null)} style={{ width: 110, height: 110 }} resizeMode="cover" />
            </MotiView>
            <View style={{ alignItems: 'center', marginTop: S.md }}>
                <Text style={[styles.name, { color: theme.onSurface, fontSize: F.hero }]}>{user?.name || 'Alex'}</Text>
                <Text style={[styles.email, { color: theme.onSurfaceVariant, fontSize: F.body }]}>{user?.email || 'user@tazq.com'}</Text>
                <TouchableOpacity onPress={openEditModal} style={[styles.editBtn, { backgroundColor: theme.primary, paddingVertical: S.sm }]}>
                    <Text style={[styles.editBtnText, { color: theme.onPrimary, fontWeight: '900', fontSize: F.caption }]}>{t.editProfile || 'Edit Profile'}</Text>
                </TouchableOpacity>
            </View>
          </View>

          {statsLoading ? (
            <View style={[styles.statsGrid, { gap: S.sm, marginTop: S.xl }]}>
                <MotiView animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ loop: true, duration: 1200 }} style={{ flex: 1, height: 100, borderRadius: R.lg, backgroundColor: theme.surfaceContainerHigh }} />
                <MotiView animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ loop: true, duration: 1200, delay: 100 }} style={{ flex: 1, height: 100, borderRadius: R.lg, backgroundColor: theme.surfaceContainerHigh }} />
                <MotiView animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ loop: true, duration: 1200, delay: 200 }} style={{ flex: 1, height: 100, borderRadius: R.lg, backgroundColor: theme.surfaceContainerHigh }} />
            </View>
          ) : statsError ? (
            <View style={{ marginTop: S.xl, alignItems: 'center', gap: S.md }}>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, fontWeight: '600', opacity: 0.6 }}>
                {language === 'tr' ? 'İstatistikler yüklenemedi' : 'Could not load stats'}
              </Text>
              <TouchableOpacity
                onPress={loadStats}
                style={{ paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.primary }}
              >
                <Text style={{ color: theme.onPrimary, fontWeight: '800', fontSize: F.body }}>
                  {language === 'tr' ? 'Tekrar dene' : 'Retry'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[styles.statsGrid, { gap: S.sm, marginTop: S.xl }]}>
                <BentoCard index={1} style={{ flex: 1, alignItems: 'center', padding: S.md }}>
                    <Zap size={22} color={theme.primary} fill={theme.primary + '30'} />
                    <Text style={[styles.statValue, { color: theme.onSurface, fontSize: F.title }]}>{stats.totalFocusHours}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: F.caption }]}>{t.hours}</Text>
                </BentoCard>
                <BentoCard index={2} style={{ flex: 1, alignItems: 'center', padding: S.md }}>
                    <Target size={22} color={theme.secondary} />
                    <Text style={[styles.statValue, { color: theme.onSurface, fontSize: F.title }]}>{stats.completedTasksCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: F.caption }]}>{t.tasks}</Text>
                </BentoCard>
                <BentoCard index={3} style={{ flex: 1, alignItems: 'center', padding: S.md }}>
                    <Trophy size={22} color={'#ff9f0a'} />
                    <Text style={[styles.statValue, { color: theme.onSurface, fontSize: F.title }]}>{displayBestStreak}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: F.caption }]}>{t.bestStreak || 'BEST STREAK'}</Text>
                </BentoCard>
              </View>
            </>
          )}

          <View style={[styles.settingsSection, { marginTop: S.xl }]}>
            <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '900', letterSpacing: 1.5, marginBottom: S.sm, marginLeft: S.xs }]}>{t.settings.toUpperCase()}</Text>
            <View style={[styles.settingsCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', borderWidth: 1, borderRadius: R.lg, overflow: 'hidden' }]}>
                <SettingItem 
                    icon={<Bell size={18} color="#F59E0B" />} 
                    label={t.notifications} 
                    bg={isDark ? "rgba(245, 158, 11, 0.1)" : "#F59E0B15"}
                    right={<Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{notifEnabled ? t.notificationsEnabled : t.notificationsDisabled}</Text>}
                    onPress={toggleNotifications} 
                    theme={theme} 
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: S.md }} />
                <SettingItem 
                    icon={<Moon size={18} color="#818CF8" />} 
                    label={t.appearance} 
                    bg={isDark ? "rgba(129, 140, 248, 0.1)" : "#818CF815"}
                    right={<Text style={{ color: theme.primary, fontWeight: '800', fontSize: F.body }}>{((t as any)[`theme${currentSetting.charAt(0).toUpperCase() + currentSetting.slice(1)}`] || currentSetting).toUpperCase()}</Text>} 
                    onPress={toggleTheme} 
                    theme={theme} 
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: S.md }} />
                <SettingItem 
                    icon={<Languages size={18} color="#10B981" />} 
                    label={t.language} 
                    bg={isDark ? "rgba(16, 185, 129, 0.1)" : "#10B98115"}
                    right={<Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body }}>{language.toUpperCase()}</Text>} 
                    onPress={toggleLanguage} 
                    theme={theme} 
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: S.md }} />
                <SettingItem
                    icon={<Shield size={18} color={isDark ? "#2DD4BF" : "#0D9488"} />}
                    label={t.streakFreeze || 'Streak Shield'}
                    bg={isDark ? "rgba(45, 212, 191, 0.12)" : "rgba(13, 148, 136, 0.12)"}
                    right={<Text style={{ color: streakFreezeAvailable ? (isDark ? '#2DD4BF' : '#0D9488') : theme.onSurface, fontWeight: '800', fontSize: F.body }}>{streakFreezeAvailable ? t.streakFreezeAvail || 'Ready' : t.streakFreezeUsed || 'Used'}</Text>}
                    onPress={handleStreakFreeze}
                    theme={theme}
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: S.md }} />
                <SettingItem
                    icon={<CalendarDays size={18} color={theme.primary} />}
                    label={language === 'tr' ? 'Haftalık Merkez' : 'Weekly Hub'}
                    bg={theme.primary + '15'}
                    onPress={() => router.push('/cockpit')}
                    theme={theme}
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: S.md }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.md, gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#F59E0B15', alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={18} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                      {language === 'tr' ? 'Haftalık Özet' : 'Weekly Summary'}
                    </Text>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>
                      {language === 'tr' ? 'Her Pazar akşamı momentum özeti' : 'Momentum recap every Sunday'}
                    </Text>
                  </View>
                  <Switch
                    value={weeklyNotification}
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      setWeeklyNotification(v);
                      if (!v) cancelWeeklySummary();
                    }}
                    trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: theme.primary + '80' }}
                    thumbColor={weeklyNotification ? theme.primary : (isDark ? '#636366' : '#fff')}
                  />
                </View>
            </View>
            {/* Dönemsel Modlar */}
            <View style={{ marginTop: S.xl }}>
              <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '900', letterSpacing: 1.5, marginBottom: S.md, marginLeft: S.xs }]}>
                {language === 'tr' ? 'DÖNEMSEL MODLAR' : 'SEASONAL MODES'}
              </Text>

              <View style={{ gap: S.md }}>
                {/* ── Ramazan Modu ── */}
                <View style={[styles.settingsCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.ramazan ? (isDark ? 'rgba(99,102,241,0.30)' : 'rgba(99,102,241,0.20)') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'), borderWidth: 1, borderRadius: R.lg, overflow: 'hidden' }]}>
                  <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.ramazan ? S.sm : S.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: seasonal.ramazan ? '#6366F122' : '#6366F115', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>🌙</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                          {language === 'tr' ? 'Ramazan Modu' : 'Ramadan Mode'}
                        </Text>
                        <Text style={{ color: seasonal.ramazan ? '#6366F1' : theme.onSurfaceVariant, fontSize: F.caption, fontWeight: seasonal.ramazan ? '700' : '400', opacity: seasonal.ramazan ? 1 : 0.6, marginTop: 1 }}>
                          {seasonal.ramazan
                            ? (language === 'tr' ? 'Aktif — özel plan devrede' : 'Active — custom plan running')
                            : (language === 'tr' ? 'Ramazan alışkanlıkları & görevleri' : 'Ramadan habits & tasks')}
                        </Text>
                      </View>
                      <Switch
                        value={seasonal.ramazan}
                        onValueChange={(v) => {
                          Haptics.selectionAsync();
                          if (!v && seasonal.ramazan) {
                            const hasItems = ramazanPlanHabitIds.length > 0 || ramazanPlanTaskIds.length > 0;
                            Alert.alert(
                              language === 'tr' ? 'Ramazan Modu Kapatılıyor' : 'Turning off Ramadan Mode',
                              hasItems
                                ? (language === 'tr'
                                    ? 'Eklenen tüm alışkanlıklar ve görevler kaldırılacak. Emin misin?'
                                    : 'All added habits and tasks will be removed. Are you sure?')
                                : (language === 'tr'
                                    ? 'Ramazan modunu kapatmak istiyor musun?'
                                    : 'Turn off Ramadan Mode?'),
                              [
                                { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                                {
                                  text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove',
                                  style: 'destructive',
                                  onPress: () => {
                                    ramazanPlanHabitIds.forEach(id => removeHabit(id));
                                    ramazanPlanTaskIds.forEach(id => removeTask(id));
                                    clearPlanIds('ramazan');
                                    setSeasonalPref('ramazan', false);
                                  }
                                },
                              ]
                            );
                          } else {
                            setSeasonalPref('ramazan', v);
                            if (v) setModePreview({ type: 'ramazan', key: Date.now() });
                          }
                        }}
                        trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#6366F180' }}
                        thumbColor={seasonal.ramazan ? '#6366F1' : (isDark ? '#636366' : '#fff')}
                      />
                    </View>
                  </View>

                  {seasonal.ramazan && (
                    <View style={{ paddingHorizontal: S.md, paddingBottom: S.md }}>
                      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)', marginBottom: S.md }} />
                      {ramazanPlanHabits.length > 0 ? (
                        <View style={{ gap: S.sm }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>
                              {language === 'tr' ? 'Bu hafta alışkanlık' : 'Habits this week'}
                            </Text>
                            <Text style={{ color: '#6366F1', fontSize: F.caption, fontWeight: '800' }}>
                              {ramazanHabitsActiveThisWeek}/{ramazanPlanHabits.length} · {ramazanWeekPct}%
                            </Text>
                          </View>
                          <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)', overflow: 'hidden' }}>
                            <View style={{ height: 5, borderRadius: 3, backgroundColor: '#6366F1', width: `${ramazanWeekPct}%` as any }} />
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setModePreview({ type: 'ramazan', key: Date.now() })}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' }} />
                          <Text style={{ color: '#6366F1', fontSize: F.caption, fontWeight: '700', flex: 1 }}>
                            {language === 'tr' ? 'Plan henüz oluşturulmadı — Oluştur' : 'No plan yet — Create one'}
                          </Text>
                          <ChevronRight size={12} color="#6366F1" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {/* ── Sınav Takibi ── */}
                <View style={[styles.settingsCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.examMode && examIsComplete ? (examDatePast ? theme.error + '40' : urgencyColor + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'), borderWidth: 1, borderRadius: R.lg, overflow: 'hidden' }]}>
                  <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.examMode ? S.sm : S.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (seasonal.examMode && examIsComplete ? (examDatePast ? theme.error : urgencyColor) : '#3B82F6') + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <BookOpen size={18} color={seasonal.examMode && examIsComplete ? (examDatePast ? theme.error : urgencyColor) : '#3B82F6'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                          {language === 'tr' ? 'Sınav Takibi' : 'Exam Mode'}
                        </Text>
                        {seasonal.examMode && examIsComplete ? (
                          <Text style={{ color: examDatePast ? theme.error : urgencyColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>
                            {examDatePast
                              ? (language === 'tr' ? 'Tarih geçti' : 'Date has passed')
                              : (language === 'tr' ? `${examDaysLeft} gün kaldı` : `${examDaysLeft} days left`)}
                          </Text>
                        ) : (
                          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>
                            {language === 'tr' ? 'Herhangi bir sınav için çalışma planı' : 'Study plan for any exam'}
                          </Text>
                        )}
                      </View>
                      <Switch
                        value={seasonal.examMode}
                        onValueChange={(v) => {
                          Haptics.selectionAsync();
                          if (!v && seasonal.examMode) {
                            const hasItems = examPlanHabitIds.length > 0 || examPlanTaskIds.length > 0;
                            Alert.alert(
                              language === 'tr' ? 'Sınav Takibi Kapatılıyor' : 'Turning off Exam Mode',
                              hasItems
                                ? (language === 'tr'
                                    ? 'Eklenen tüm alışkanlıklar ve görevler kaldırılacak. Emin misin?'
                                    : 'All added habits and tasks will be removed. Are you sure?')
                                : (language === 'tr'
                                    ? 'Sınav takibini kapatmak istiyor musun?'
                                    : 'Turn off Exam Mode?'),
                              [
                                { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                                {
                                  text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove',
                                  style: 'destructive',
                                  onPress: () => {
                                    cancelExamCountdownNotifs();
                                    examPlanHabitIds.forEach(id => removeHabit(id));
                                    examPlanTaskIds.forEach(id => removeTask(id));
                                    exam2PlanHabitIds.forEach(id => removeHabit(id));
                                    exam2PlanTaskIds.forEach(id => removeTask(id));
                                    clearPlanIds('exam');
                                    clearPlanIds('exam2');
                                    setExamNameInput('');
                                    setExamDateInput('');
                                    setExam2NameInput('');
                                    setExam2DateInput('');
                                    setExamExpanded(false);
                                    setExam2Expanded(false);
                                    setSeasonalPref('examMode', false);
                                    setSeasonalPref('examName', '');
                                    setSeasonalPref('examDate', null);
                                    setSeasonalPref('exam2Name', '');
                                    setSeasonalPref('exam2Date', null);
                                    setExamReviewShown(false);
                                  }
                                },
                              ]
                            );
                          } else if (v) {
                            setSeasonalPref('examMode', true);
                          }
                        }}
                        trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (examIsComplete ? (examDatePast ? theme.error : urgencyColor) : '#3B82F6') + '80' }}
                        thumbColor={seasonal.examMode ? (examIsComplete ? (examDatePast ? theme.error : urgencyColor) : '#3B82F6') : (isDark ? '#636366' : '#fff')}
                      />
                    </View>
                  </View>

                  {seasonal.examMode && (
                    <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />

                      {/* State: not configured, not editing */}
                      {!examIsComplete && !examExpanded && (
                        <TouchableOpacity
                          onPress={() => { Haptics.selectionAsync(); setExamExpanded(true); }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ fontSize: 16 }}>🎯</Text>
                          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>
                            {language === 'tr' ? 'Sınav ekle' : 'Add exam'}
                          </Text>
                          <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
                        </TouchableOpacity>
                      )}

                      {/* State: configured, not editing — COUNTDOWN CARD */}
                      {examIsComplete && !examExpanded && (
                        <View style={{ gap: S.sm }}>
                          <TouchableOpacity
                            onPress={() => { Haptics.selectionAsync(); setExamExpanded(true); }}
                            style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: 1, borderColor: (examDatePast ? theme.error : urgencyColor) + '30', backgroundColor: (examDatePast ? theme.error : urgencyColor) + '08' }}
                            activeOpacity={0.85}
                          >
                            <View style={{ height: 3, backgroundColor: examDatePast ? theme.error : urgencyColor }} />
                            <View style={{ padding: S.md }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
                                <Text style={{ fontSize: 16, marginRight: S.xs }}>🎯</Text>
                                <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>
                                  {examNameInput}
                                </Text>
                                <Text style={{ color: examDatePast ? theme.error : urgencyColor, fontSize: F.caption, fontWeight: '800' }}>
                                  {language === 'tr' ? 'Düzenle ›' : 'Edit ›'}
                                </Text>
                              </View>

                              {examDatePast ? (
                                <View style={{ gap: S.sm }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                                    <Text style={{ color: theme.error, fontWeight: '700', fontSize: F.body }}>
                                      {language === 'tr' ? '📅 Tarih geçti' : '📅 Date has passed'}
                                    </Text>
                                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>
                                      · {formatExamDate(examDateInput)}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); closeExamModeWithReview(); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: theme.error + '12', borderRadius: R.md, paddingVertical: S.sm, borderWidth: 1, borderColor: theme.error + '25' }}
                                    activeOpacity={0.75}
                                  >
                                    <Text style={{ color: theme.error, fontWeight: '800', fontSize: F.caption }}>
                                      {language === 'tr' ? 'Sınavı Tamamla & Kapat' : 'Complete & Close Exam'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                                  <View style={{ alignItems: 'center', minWidth: 52 }}>
                                    <Text style={{ color: urgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>
                                      {examDaysLeft}
                                    </Text>
                                    <Text style={{ color: urgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>
                                      {language === 'tr' ? 'GÜN' : 'DAYS'}
                                    </Text>
                                  </View>
                                  <View style={{ flex: 1, paddingTop: 2 }}>
                                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>
                                      📅 {formatExamDate(examDateInput)}
                                    </Text>
                                    {examPlanHabits.length > 0 && (
                                      <View style={{ marginTop: S.sm, gap: 4 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                          <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>
                                            {language === 'tr' ? 'Bu hafta alışkanlık' : 'Habits this week'}
                                          </Text>
                                          <Text style={{ color: urgencyColor, fontSize: 11, fontWeight: '800' }}>
                                            {examHabitsActiveThisWeek}/{examPlanHabits.length} · {examWeekPct}%
                                          </Text>
                                        </View>
                                        <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                          <View style={{ height: 5, borderRadius: 3, backgroundColor: urgencyColor, width: `${examWeekPct}%` as any }} />
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>

                          {!examDatePast && (
                            <TouchableOpacity
                              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'exam', key: Date.now() }); }}
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: urgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: urgencyColor + '22' }}
                              activeOpacity={0.75}
                            >
                              <BookOpen size={14} color={urgencyColor} />
                              <Text style={{ color: urgencyColor, fontWeight: '800', fontSize: F.caption }}>
                                {examPlanHabits.length > 0
                                  ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan')
                                  : (language === 'tr' ? 'Çalışma Planı Oluştur' : 'Create Study Plan')}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* İkinci Sınav */}
                          <View style={{ marginTop: S.xs }}>
                            <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                            {exam2IsComplete && !exam2Expanded ? (
                              <TouchableOpacity
                                onPress={() => { Haptics.selectionAsync(); setExam2Expanded(true); }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (exam2DatePast ? theme.error : exam2UrgencyColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }}
                                activeOpacity={0.8}
                              >
                                <Text style={{ fontSize: 14 }}>🎯</Text>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{exam2NameInput}</Text>
                                  <Text style={{ color: exam2DatePast ? theme.error : exam2UrgencyColor, fontSize: 11, fontWeight: '700' }}>
                                    {exam2DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${exam2DaysLeft} gün kaldı` : `${exam2DaysLeft} days left`)}
                                  </Text>
                                </View>
                                <Text style={{ color: exam2UrgencyColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                              </TouchableOpacity>
                            ) : !exam2IsComplete && !exam2Expanded ? (
                              <TouchableOpacity
                                onPress={() => { Haptics.selectionAsync(); setExam2Expanded(true); }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>
                                  {language === 'tr' ? 'İkinci sınav ekle (YKS + TYT gibi)' : 'Add second exam (e.g. SAT + ACT)'}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {exam2Expanded && (
                              <View style={{ gap: S.sm }}>
                                <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                                  <TextInput
                                    value={exam2NameInput}
                                    onChangeText={(v) => { setExam2NameInput(v); setSeasonalPref('exam2Name', v); }}
                                    placeholder={language === 'tr' ? 'İkinci sınav adı (TYT, YDT...)' : 'Second exam name (e.g. ACT...)'}
                                    placeholderTextColor={theme.onSurfaceVariant + '70'}
                                    style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }}
                                    returnKeyType="done"
                                  />
                                </View>
                                <TouchableOpacity
                                  onPress={() => { Haptics.selectionAsync(); setShowExam2DatePicker(true); }}
                                  style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}
                                  activeOpacity={0.7}
                                >
                                  <Text style={{ color: exam2DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>
                                    {exam2DateInput ? formatExamDate(exam2DateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select date')}
                                  </Text>
                                  <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                                </TouchableOpacity>
                                {showExam2DatePicker && (
                                  <DateTimePicker
                                    value={exam2DateObj}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                    locale={language === 'tr' ? 'tr-TR' : 'en-GB'}
                                    minimumDate={new Date()}
                                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                                      if (Platform.OS === 'android') setShowExam2DatePicker(false);
                                      if (event.type === 'dismissed') { setShowExam2DatePicker(false); return; }
                                      if (date) {
                                        const iso = date.toISOString().split('T')[0];
                                        setExam2DateInput(iso);
                                        setSeasonalPref('exam2Date', iso);
                                        if (Platform.OS === 'ios') setShowExam2DatePicker(false);
                                      }
                                    }}
                                  />
                                )}
                                <View style={{ flexDirection: 'row', gap: S.sm }}>
                                  <TouchableOpacity
                                    onPress={() => {
                                      if (exam2NameInput || exam2DateInput) {
                                        exam2PlanHabitIds.forEach(id => removeHabit(id));
                                        exam2PlanTaskIds.forEach(id => removeTask(id));
                                        clearPlanIds('exam2');
                                        setExam2NameInput('');
                                        setExam2DateInput('');
                                        setSeasonalPref('exam2Name', '');
                                        setSeasonalPref('exam2Date', null);
                                      }
                                      setExam2Expanded(false);
                                    }}
                                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>
                                      {language === 'tr' ? 'Kapat' : 'Close'}
                                    </Text>
                                  </TouchableOpacity>
                                  {exam2IsComplete && (
                                    <TouchableOpacity
                                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExam2Expanded(false); setModePreview({ type: 'exam', key: Date.now() }); }}
                                      style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: exam2UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }}
                                      activeOpacity={0.8}
                                    >
                                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>
                                        {language === 'tr' ? 'Planı Uygula' : 'Apply Plan'}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                      )}

                      {/* State: editing form */}
                      {examExpanded && (
                        <View style={{ gap: S.sm }}>
                          <View ref={examInputViewRef} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                            <TextInput
                              value={examNameInput}
                              onChangeText={(v) => { setExamNameInput(v); setSeasonalPref('examName', v); }}
                              placeholder={language === 'tr' ? 'Sınav adı (örn: ALES, DGS...)' : 'Exam name (e.g. SAT, GRE...)'}
                              placeholderTextColor={theme.onSurfaceVariant + '70'}
                              style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }}
                              returnKeyType="done"
                            />
                          </View>

                          <TouchableOpacity
                            onPress={() => { Haptics.selectionAsync(); setShowDatePicker(true); }}
                            style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: examDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>
                              {examDateInput ? formatExamDate(examDateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select exam date')}
                            </Text>
                            <CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} />
                          </TouchableOpacity>

                          {showDatePicker && (
                            <DateTimePicker
                              value={examDateObj}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'inline' : 'default'}
                              locale={language === 'tr' ? 'tr-TR' : 'en-GB'}
                              minimumDate={new Date()}
                              onChange={(event: DateTimePickerEvent, date?: Date) => {
                                if (Platform.OS === 'android') setShowDatePicker(false);
                                if (event.type === 'dismissed') { setShowDatePicker(false); return; }
                                if (date) {
                                  const iso = date.toISOString().split('T')[0];
                                  setExamDateInput(iso);
                                  setSeasonalPref('examDate', iso);
                                  if (Platform.OS === 'ios') setShowDatePicker(false);
                                }
                              }}
                            />
                          )}

                          <View style={{ flexDirection: 'row', gap: S.sm }}>
                            <TouchableOpacity
                              onPress={() => { setExamExpanded(false); }}
                              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>
                                {language === 'tr' ? 'Kapat' : 'Close'}
                              </Text>
                            </TouchableOpacity>
                            {examIsComplete && (
                              <TouchableOpacity
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExamExpanded(false); setModePreview({ type: 'exam', key: Date.now() }); }}
                                style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: urgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }}
                                activeOpacity={0.8}
                              >
                                <BookOpen size={14} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>
                                  {language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                {/* ── Tez / Proje ── */}
                <View style={[styles.settingsCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.tezMode && tezIsComplete ? (tezDatePast ? theme.error + '40' : tezUrgencyColor + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'), borderWidth: 1, borderRadius: R.lg, overflow: 'hidden' }]}>
                  <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.tezMode ? S.sm : S.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (seasonal.tezMode && tezIsComplete ? (tezDatePast ? theme.error : tezUrgencyColor) : '#8B5CF6') + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>📝</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                          {language === 'tr' ? 'Tez / Proje' : 'Thesis / Project'}
                        </Text>
                        {seasonal.tezMode && tezIsComplete ? (
                          <Text style={{ color: tezDatePast ? theme.error : tezUrgencyColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>
                            {tezDatePast ? (language === 'tr' ? 'Teslim tarihi geçti' : 'Deadline passed') : (language === 'tr' ? `${tezDaysLeft} gün kaldı` : `${tezDaysLeft} days left`)}
                          </Text>
                        ) : (
                          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>
                            {language === 'tr' ? 'Deadline odaklı akademik / proje planı' : 'Deadline-driven thesis or project plan'}
                          </Text>
                        )}
                      </View>
                      <Switch
                        value={seasonal.tezMode}
                        onValueChange={(v) => {
                          Haptics.selectionAsync();
                          if (!v && seasonal.tezMode) {
                            const hasItems = tezPlanHabitIds.length > 0 || tezPlanTaskIds.length > 0;
                            Alert.alert(
                              language === 'tr' ? 'Tez Modu Kapatılıyor' : 'Turning off Thesis Mode',
                              hasItems
                                ? (language === 'tr' ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?')
                                : (language === 'tr' ? 'Tez / Proje modunu kapatmak istiyor musun?' : 'Turn off Thesis mode?'),
                              [
                                { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                                {
                                  text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove',
                                  style: 'destructive',
                                  onPress: () => {
                                    tezPlanHabitIds.forEach(id => removeHabit(id));
                                    tezPlanTaskIds.forEach(id => removeTask(id));
                                    clearPlanIds('tez');
                                    setTezNameInput('');
                                    setTezDateInput('');
                                    setTezExpanded(false);
                                    setSeasonalPref('tezMode', false);
                                    setSeasonalPref('tezName', '');
                                    setSeasonalPref('tezDate', null);
                                  }
                                },
                              ]
                            );
                          } else if (v) {
                            setSeasonalPref('tezMode', true);
                          }
                        }}
                        trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (tezIsComplete ? tezUrgencyColor : '#8B5CF6') + '80' }}
                        thumbColor={seasonal.tezMode ? (tezIsComplete ? tezUrgencyColor : '#8B5CF6') : (isDark ? '#636366' : '#fff')}
                      />
                    </View>
                  </View>
                  {seasonal.tezMode && (
                    <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
                      {!tezIsComplete && !tezExpanded && (
                        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setTezExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
                          <Text style={{ fontSize: 16 }}>📝</Text>
                          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Proje ekle' : 'Add project'}</Text>
                          <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
                        </TouchableOpacity>
                      )}
                      {tezIsComplete && !tezExpanded && (
                        <View style={{ gap: S.sm }}>
                          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setTezExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: 1, borderColor: (tezDatePast ? theme.error : tezUrgencyColor) + '30', backgroundColor: (tezDatePast ? theme.error : tezUrgencyColor) + '08' }} activeOpacity={0.85}>
                            <View style={{ height: 3, backgroundColor: tezDatePast ? theme.error : tezUrgencyColor }} />
                            <View style={{ padding: S.md }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
                                <Text style={{ fontSize: 16, marginRight: S.xs }}>📝</Text>
                                <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{tezNameInput}</Text>
                                <Text style={{ color: tezDatePast ? theme.error : tezUrgencyColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                              </View>
                              {tezDatePast ? (
                                <Text style={{ color: theme.error, fontWeight: '700' }}>{language === 'tr' ? '📅 Teslim tarihi geçti' : '📅 Deadline passed'} · {formatExamDate(tezDateInput)}</Text>
                              ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                                  <View style={{ alignItems: 'center', minWidth: 52 }}>
                                    <Text style={{ color: tezUrgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{tezDaysLeft}</Text>
                                    <Text style={{ color: tezUrgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text>
                                  </View>
                                  <View style={{ flex: 1, paddingTop: 2 }}>
                                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>📅 {formatExamDate(tezDateInput)}</Text>
                                    {tezPlanHabits.length > 0 && (
                                      <View style={{ marginTop: S.sm, gap: 4 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                          <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu hafta' : 'This week'}</Text>
                                          <Text style={{ color: tezUrgencyColor, fontSize: 11, fontWeight: '800' }}>{tezHabitsActiveThisWeek}/{tezPlanHabits.length} · {tezWeekPct}%</Text>
                                        </View>
                                        <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                          <View style={{ height: 5, borderRadius: 3, backgroundColor: tezUrgencyColor, width: `${tezWeekPct}%` as any }} />
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'tez', key: Date.now() }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: tezUrgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: tezUrgencyColor + '22' }} activeOpacity={0.75}>
                            <BookOpen size={14} color={tezUrgencyColor} />
                            <Text style={{ color: tezUrgencyColor, fontWeight: '800', fontSize: F.caption }}>{tezPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Çalışma Planı Oluştur' : 'Create Work Plan')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {tezExpanded && (
                        <View style={{ gap: S.sm }}>
                          <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                            <TextInput value={tezNameInput} onChangeText={(v) => { setTezNameInput(v); setSeasonalPref('tezName', v); }} placeholder={language === 'tr' ? 'Proje adı (Yüksek Lisans Tezi...)' : 'Project name (Master\'s Thesis...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" />
                          </View>
                          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowTezDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                            <Text style={{ color: tezDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{tezDateInput ? formatExamDate(tezDateInput) : (language === 'tr' ? 'Teslim tarihi seç' : 'Select deadline')}</Text>
                            <CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} />
                          </TouchableOpacity>
                          {showTezDatePicker && (
                            <DateTimePicker value={tezDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowTezDatePicker(false); if (event.type === 'dismissed') { setShowTezDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setTezDateInput(iso); setSeasonalPref('tezDate', iso); if (Platform.OS === 'ios') setShowTezDatePicker(false); } }} />
                          )}
                          <View style={{ flexDirection: 'row', gap: S.sm }}>
                            <TouchableOpacity onPress={() => { setTezExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                            </TouchableOpacity>
                            {tezIsComplete && (
                              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTezExpanded(false); setModePreview({ type: 'tez', key: Date.now() }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: tezUrgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}>
                                <BookOpen size={14} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* ── İş Mülakatı ── */}
                <View style={[styles.settingsCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.mulakatMode && mulakatIsComplete ? (mulakatDatePast ? theme.error + '40' : mulakatUrgencyColor + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'), borderWidth: 1, borderRadius: R.lg, overflow: 'hidden' }]}>
                  <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.mulakatMode ? S.sm : S.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (seasonal.mulakatMode && mulakatIsComplete ? (mulakatDatePast ? theme.error : mulakatUrgencyColor) : '#10B981') + '18', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>💼</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                          {language === 'tr' ? 'İş Mülakatı' : 'Job Interview'}
                        </Text>
                        {seasonal.mulakatMode && mulakatIsComplete ? (
                          <Text style={{ color: mulakatDatePast ? theme.error : mulakatUrgencyColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>
                            {mulakatDatePast ? (language === 'tr' ? 'Mülakat tarihi geçti' : 'Interview passed') : (language === 'tr' ? `${mulakatDaysLeft} gün kaldı` : `${mulakatDaysLeft} days left`)}
                          </Text>
                        ) : (
                          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>
                            {language === 'tr' ? 'Mülakat tarihine kadar hazırlık planı' : 'Prep plan until your interview date'}
                          </Text>
                        )}
                      </View>
                      <Switch
                        value={seasonal.mulakatMode}
                        onValueChange={(v) => {
                          Haptics.selectionAsync();
                          if (!v && seasonal.mulakatMode) {
                            const hasItems = mulakatPlanHabitIds.length > 0 || mulakatPlanTaskIds.length > 0;
                            Alert.alert(
                              language === 'tr' ? 'Mülakat Modu Kapatılıyor' : 'Turning off Interview Mode',
                              hasItems
                                ? (language === 'tr' ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?')
                                : (language === 'tr' ? 'Mülakat modunu kapatmak istiyor musun?' : 'Turn off Interview mode?'),
                              [
                                { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                                {
                                  text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove',
                                  style: 'destructive',
                                  onPress: () => {
                                    mulakatPlanHabitIds.forEach(id => removeHabit(id));
                                    mulakatPlanTaskIds.forEach(id => removeTask(id));
                                    clearPlanIds('mulakat');
                                    setMulakatNameInput('');
                                    setMulakatDateInput('');
                                    setMulakatExpanded(false);
                                    setSeasonalPref('mulakatMode', false);
                                    setSeasonalPref('mulakatName', '');
                                    setSeasonalPref('mulakatDate', null);
                                  }
                                },
                              ]
                            );
                          } else if (v) {
                            setSeasonalPref('mulakatMode', true);
                          }
                        }}
                        trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (mulakatIsComplete ? mulakatUrgencyColor : '#10B981') + '80' }}
                        thumbColor={seasonal.mulakatMode ? (mulakatIsComplete ? mulakatUrgencyColor : '#10B981') : (isDark ? '#636366' : '#fff')}
                      />
                    </View>
                  </View>
                  {seasonal.mulakatMode && (
                    <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
                      {!mulakatIsComplete && !mulakatExpanded && (
                        <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setMulakatExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
                          <Text style={{ fontSize: 16 }}>💼</Text>
                          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Mülakat ekle' : 'Add interview'}</Text>
                          <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
                        </TouchableOpacity>
                      )}
                      {mulakatIsComplete && !mulakatExpanded && (
                        <View style={{ gap: S.sm }}>
                          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setMulakatExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: 1, borderColor: (mulakatDatePast ? theme.error : mulakatUrgencyColor) + '30', backgroundColor: (mulakatDatePast ? theme.error : mulakatUrgencyColor) + '08' }} activeOpacity={0.85}>
                            <View style={{ height: 3, backgroundColor: mulakatDatePast ? theme.error : mulakatUrgencyColor }} />
                            <View style={{ padding: S.md }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
                                <Text style={{ fontSize: 16, marginRight: S.xs }}>💼</Text>
                                <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{mulakatNameInput}</Text>
                                <Text style={{ color: mulakatDatePast ? theme.error : mulakatUrgencyColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                              </View>
                              {mulakatDatePast ? (
                                <Text style={{ color: theme.error, fontWeight: '700' }}>{language === 'tr' ? '📅 Mülakat tarihi geçti' : '📅 Interview date passed'} · {formatExamDate(mulakatDateInput)}</Text>
                              ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                                  <View style={{ alignItems: 'center', minWidth: 52 }}>
                                    <Text style={{ color: mulakatUrgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{mulakatDaysLeft}</Text>
                                    <Text style={{ color: mulakatUrgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text>
                                  </View>
                                  <View style={{ flex: 1, paddingTop: 2 }}>
                                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>📅 {formatExamDate(mulakatDateInput)}</Text>
                                    {mulakatPlanHabits.length > 0 && (
                                      <View style={{ marginTop: S.sm, gap: 4 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                          <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu hafta' : 'This week'}</Text>
                                          <Text style={{ color: mulakatUrgencyColor, fontSize: 11, fontWeight: '800' }}>{mulakatHabitsActiveThisWeek}/{mulakatPlanHabits.length} · {mulakatWeekPct}%</Text>
                                        </View>
                                        <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                          <View style={{ height: 5, borderRadius: 3, backgroundColor: mulakatUrgencyColor, width: `${mulakatWeekPct}%` as any }} />
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'mulakat', key: Date.now() }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: mulakatUrgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: mulakatUrgencyColor + '22' }} activeOpacity={0.75}>
                            <BookOpen size={14} color={mulakatUrgencyColor} />
                            <Text style={{ color: mulakatUrgencyColor, fontWeight: '800', fontSize: F.caption }}>{mulakatPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Hazırlık Planı Oluştur' : 'Create Prep Plan')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {mulakatExpanded && (
                        <View style={{ gap: S.sm }}>
                          <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                            <TextInput value={mulakatNameInput} onChangeText={(v) => { setMulakatNameInput(v); setSeasonalPref('mulakatName', v); }} placeholder={language === 'tr' ? 'Şirket / Pozisyon (Google - SWE...)' : 'Company / Role (Google - SWE...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" />
                          </View>
                          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowMulakatDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                            <Text style={{ color: mulakatDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{mulakatDateInput ? formatExamDate(mulakatDateInput) : (language === 'tr' ? 'Mülakat tarihi seç' : 'Select interview date')}</Text>
                            <CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} />
                          </TouchableOpacity>
                          {showMulakatDatePicker && (
                            <DateTimePicker value={mulakatDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowMulakatDatePicker(false); if (event.type === 'dismissed') { setShowMulakatDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setMulakatDateInput(iso); setSeasonalPref('mulakatDate', iso); if (Platform.OS === 'ios') setShowMulakatDatePicker(false); } }} />
                          )}
                          <View style={{ flexDirection: 'row', gap: S.sm }}>
                            <TouchableOpacity onPress={() => { setMulakatExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                            </TouchableOpacity>
                            {mulakatIsComplete && (
                              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setMulakatExpanded(false); setModePreview({ type: 'mulakat', key: Date.now() }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: mulakatUrgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}>
                                <BookOpen size={14} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: theme.error + '10', marginTop: S.xl, paddingVertical: S.md, paddingHorizontal: S.md }]}>
                <LogOut size={18} color={theme.error} />
                <Text style={[styles.logoutText, { color: theme.error, fontSize: F.body }]}>{t.logout}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <BottomNavBar />

      {modePreview && (
        <TurkishModeBanner
          key={modePreview.key}
          mode={getModePreview(modePreview.type, {
            examName: examNameInput,
            examDate: examDateInput,
            tezName: tezNameInput,
            tezDate: tezDateInput,
            mulakatName: mulakatNameInput,
            mulakatDate: mulakatDateInput,
          })}
          onDismiss={() => {
            const t = modePreview.type;
            if (t === 'ramazan' && ramazanPlanHabitIds.length === 0) {
              setSeasonalPref('ramazan', false);
            } else if (t === 'tez' && tezPlanHabitIds.length === 0) {
              setSeasonalPref('tezMode', false);
              setSeasonalPref('tezName', '');
              setSeasonalPref('tezDate', null);
              setTezNameInput('');
              setTezDateInput('');
            } else if (t === 'mulakat' && mulakatPlanHabitIds.length === 0) {
              setSeasonalPref('mulakatMode', false);
              setSeasonalPref('mulakatName', '');
              setSeasonalPref('mulakatDate', null);
              setMulakatNameInput('');
              setMulakatDateInput('');
            }
            setModePreview(null);
          }}
          onSheetClose={() => {
            const t = modePreview?.type;
            if (!t) return;
            if (t === 'ramazan' && ramazanPlanHabitIds.length === 0) {
              setSeasonalPref('ramazan', false);
            } else if (t === 'tez' && tezPlanHabitIds.length === 0) {
              setSeasonalPref('tezMode', false);
              setSeasonalPref('tezName', '');
              setSeasonalPref('tezDate', null);
              setTezNameInput('');
              setTezDateInput('');
            } else if (t === 'mulakat' && mulakatPlanHabitIds.length === 0) {
              setSeasonalPref('mulakatMode', false);
              setSeasonalPref('mulakatName', '');
              setSeasonalPref('mulakatDate', null);
              setMulakatNameInput('');
              setMulakatDateInput('');
            }
            setModePreview(null);
          }}
          showSheetImmediately
          planApplied={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') return examPlanHabitIds.length > 0 || examPlanTaskIds.length > 0;
            if (t === 'tez') return tezPlanHabitIds.length > 0 || tezPlanTaskIds.length > 0;
            if (t === 'mulakat') return mulakatPlanHabitIds.length > 0 || mulakatPlanTaskIds.length > 0;
            return ramazanPlanHabitIds.length > 0 || ramazanPlanTaskIds.length > 0;
          })()}
          planHabitIds={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') return examPlanHabitIds;
            if (t === 'tez') return tezPlanHabitIds;
            if (t === 'mulakat') return mulakatPlanHabitIds;
            return ramazanPlanHabitIds;
          })()}
          planTaskIds={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') return examPlanTaskIds;
            if (t === 'tez') return tezPlanTaskIds;
            if (t === 'mulakat') return mulakatPlanTaskIds;
            return ramazanPlanTaskIds;
          })()}
          onClearPlan={() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') {
              examPlanHabitIds.forEach(id => removeHabit(id));
              examPlanTaskIds.forEach(id => removeTask(id));
              clearPlanIds('exam');
            } else if (t === 'tez') {
              tezPlanHabitIds.forEach(id => removeHabit(id));
              tezPlanTaskIds.forEach(id => removeTask(id));
              clearPlanIds('tez');
            } else if (t === 'mulakat') {
              mulakatPlanHabitIds.forEach(id => removeHabit(id));
              mulakatPlanTaskIds.forEach(id => removeTask(id));
              clearPlanIds('mulakat');
            } else {
              ramazanPlanHabitIds.forEach(id => removeHabit(id));
              ramazanPlanTaskIds.forEach(id => removeTask(id));
              clearPlanIds('ramazan');
            }
            setModePreview(null);
          }}
          onApplied={(habitIds, taskIds) => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') setPlanIds('exam', habitIds, taskIds);
            else if (t === 'tez') setPlanIds('tez', habitIds, taskIds);
            else if (t === 'mulakat') setPlanIds('mulakat', habitIds, taskIds);
            else setPlanIds('ramazan', habitIds, taskIds);
          }}
        />
      )}

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="none" onShow={() => editSlideIn()}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} />
              <Animated.View style={[editSlide, styles.modalContent, { backgroundColor: isDark ? '#1C1C22' : '#FFFFFF', paddingBottom: kbHeight > 0 ? S.md : (insets.bottom > 0 ? insets.bottom + S.md : S.lg), maxHeight: height - insets.top - 16 }]}>
                <View {...editPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
                  <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]} />
                </View>
                <Text style={[styles.modalTitle, { color: theme.onSurface, fontSize: F.subhead }]}>
                  {t.editProfile || 'Edit Profile'}
                </Text>

                {/* Name input */}
                <View style={{ width: '100%', marginBottom: S.md }}>
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                    {t.editName || 'Display Name'}
                  </Text>
                  <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                    <TextInput
                      value={newName}
                      onChangeText={setNewName}
                      placeholder={t.namePlaceholder || 'Your name'}
                      placeholderTextColor={theme.onSurfaceVariant + '99'}
                      style={[styles.nameInput, { color: theme.onSurface }]}
                      maxLength={50}
                    />
                  </View>
                </View>

                {/* Avatar selection */}
                <View style={{ width: '100%', marginBottom: S.md }}>
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Avatar</Text>
                  <View style={[styles.avatarGrid, { gap: S.sm }]}>
                    {AVATAR_CONFIGS.map((config) => {
                      const isSelected = selectedAvatar === config.key;
                      return (
                        <TouchableOpacity
                          key={config.id}
                          onPress={() => { Haptics.selectionAsync(); setSelectedAvatar(config.key); }}
                          activeOpacity={0.75}
                          style={{ alignItems: 'center', gap: 5 }}
                        >
                          <View style={{
                            width: 64, height: 64, borderRadius: 32,
                            borderWidth: isSelected ? 3 : 1.5,
                            borderColor: isSelected ? theme.primary : theme.outline + '40',
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Image
                              source={config.image}
                              style={{ width: 64, height: 64 }}
                              resizeMode="cover"
                            />
                          </View>
                          <Text style={{
                            fontSize: 9, fontWeight: '800', letterSpacing: 0.3,
                            color: isSelected ? theme.primary : theme.onSurfaceVariant,
                            opacity: isSelected ? 1 : 0.5,
                          }}>
                            {config.name.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Daily focus goal */}
                <View style={{ width: '100%', marginBottom: S.lg }}>
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                    {t.dailyFocusGoal || 'Daily Focus Goal'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    {GOAL_OPTIONS.map((g) => (
                      <TouchableOpacity
                        key={g}
                        onPress={() => { Haptics.selectionAsync(); setSelectedGoal(g); }}
                        style={[
                          styles.goalChip,
                          { backgroundColor: selectedGoal === g ? theme.primary : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow) }
                        ]}
                      >
                        <Text style={{ color: selectedGoal === g ? 'white' : theme.onSurfaceVariant, fontWeight: '800', fontSize: F.body }}>
                          {g}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Inline error */}
                {profileError && (
                  <Text style={{ color: theme.error, fontSize: F.caption, fontWeight: '700', textAlign: 'center', marginBottom: S.sm }}>
                    {profileError}
                  </Text>
                )}

                {/* Save button */}
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                >
                  {savingProfile
                    ? <ActivityIndicator color="white" />
                    : <Text style={{ color: 'white', fontWeight: '900', fontSize: F.body }}>{t.save}</Text>
                  }
                </TouchableOpacity>
              </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SettingItem({ icon, label, right, onPress, theme, bg }: any) {
    return (
        <TouchableOpacity style={[styles.settingItem, { padding: S.md }]} onPress={onPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <View style={[styles.iconBox, { backgroundColor: bg || (theme.colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }]}>{icon}</View>
                <Text style={[styles.settingLabel, { color: theme.onSurface, fontSize: F.body }]}>{label}</Text>
            </View>
            {right || <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.3} />}
        </TouchableOpacity>
    );
}

function Divider({ theme }: any) {
    return <View style={{ height: 1, backgroundColor: theme.outlineVariant + '15', marginHorizontal: S.md }} />;
}

const styles = StyleSheet.create({
  header: { alignItems: 'center' },
  avatarLarge: { borderWidth: 3, padding: S.xs },
  image: { width: '100%', height: '100%' },
  name: { fontWeight: '900', letterSpacing: -1 },
  email: { opacity: 0.6, marginTop: S.xs },
  editBtn: { marginTop: S.md, paddingHorizontal: S.lg, borderRadius: R.full },
  editBtnText: { color: 'white', fontWeight: '800' },
  statsGrid: { flexDirection: 'row' },
  statValue: { fontWeight: '900', marginTop: S.sm },
  statLabel: { fontWeight: '800', opacity: 0.75, marginTop: S.xs },
  settingsSection: { },
  sectionTitle: { fontSize: F.caption, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: S.md },
  sectionLabel: { fontSize: F.caption, fontWeight: '900', letterSpacing: 1, marginBottom: S.sm, textTransform: 'uppercase', opacity: 0.75 },
  settingsCard: { borderRadius: R.lg, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontWeight: '700' },
  skeletonCircle: { width: 24, height: 24, borderRadius: R.full },
  skeletonLine: { height: 14, borderRadius: R.sm },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg },
  logoutText: { fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: S.xl, borderTopRightRadius: S.xl, borderBottomLeftRadius: S.xl, borderBottomRightRadius: S.xl, padding: S.lg },
  modalHandle: { width: 40, height: 4, borderRadius: R.sm, alignSelf: 'center', marginBottom: S.md },
  modalTitle: { fontWeight: '900', marginBottom: S.lg, textAlign: 'center' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  inputGroup: { borderRadius: R.md, paddingHorizontal: S.md, height: 48, justifyContent: 'center' },
  nameInput: { fontSize: F.body, fontWeight: '600' },
  goalChip: { flex: 1, paddingVertical: S.sm, borderRadius: R.md, alignItems: 'center' },
  saveBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
});

