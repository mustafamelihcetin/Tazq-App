import React, { useEffect, useState, useRef } from 'react';
import type { AppTheme } from '@/shared/constants/Colors';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Modal, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Keyboard, Linking, Animated, TouchableWithoutFeedback } from 'react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { track } from '@/shared/utils/analytics';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, Languages, LogOut, ChevronRight, Zap, Target, Trophy, Shield, CalendarDays, Star, Volume2, Sunrise, Sun, Sunset, Trash2, FileText, MessageSquare, Send, Lock, Eye, EyeOff, Settings } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { AuthService, FocusService } from '@/shared/services/api';
import { SleepHealth } from '@/shared/services/sleepHealth';
import { SupportModal } from '@/shared/components/SupportModal';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { useAuthStore, getAvatarSource, AVATAR_CONFIGS, AVATAR_MAP, useAchievementStore, ACHIEVEMENTS } from '@/features/user';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusStore } from '@/features/focus';
import * as HapticsOriginal from 'expo-haptics';
const Haptics = {
  notificationAsync: (type: any) => HapticsOriginal.notificationAsync(type).catch(() => {}),
  impactAsync: (style: any) => HapticsOriginal.impactAsync(style).catch(() => {}),
  selectionAsync: () => HapticsOriginal.selectionAsync().catch(() => {}),
  NotificationFeedbackType: HapticsOriginal.NotificationFeedbackType,
  ImpactFeedbackStyle: HapticsOriginal.ImpactFeedbackStyle,
};
import { useRouter } from 'expo-router';
import { requestNotificationPermissions, cancelWeeklySummary, cancelMorningBrief, cancelEveningBrief } from '@/shared/utils/notifications';
import { requestCalendarPermissions, bulkExportTasksToCalendar } from '@/shared/utils/calendarSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ICON, S, R, F, B, MAX_W, navBarSpace } from '@/shared/constants/tokens';
import { useToastStore } from '@/shared/store/useToastStore';
import { Asset } from 'expo-asset';
import { usePrefsStore } from '@/features/modes';
import { useSporStore } from '@/shared/store/useSporStore';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useTaskStore } from '@/features/tasks';
import { renderAchievementIcon, ACHIEVEMENT_ICONS } from '@/shared/utils/achievementIcons';
import { Touchable } from '@/shared/components/Touchable';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { swallow } from '@/shared/utils/swallow';
import { playSoundEffect } from '@/shared/utils/soundEffects';
import { isNetworkError, httpDataOf } from '@/shared/utils/errors';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { SettingsCard, SettingItem, ToggleRow, RowDivider, settingsAccents } from '@/shared/components/SettingsRows';

const GOAL_OPTIONS = [30, 60, 90, 120];

// Kilitli rozetin "nasıl açılır" ipucu (id eşiği kodluyor: streak_3, momentum_50, focus_5h...).
function achievementHint(id: string, tr: boolean): string {
  if (id.startsWith('streak_')) { const n = id.split('_')[1]; return tr ? `${n} günlük seri yakala.` : `Reach a ${n}-day streak.`; }
  if (id.startsWith('momentum_')) { const n = id.split('_')[1]; return tr ? `Momentum'u %${n} seviyesine çıkar.` : `Get momentum to ${n}%.`; }
  if (id === 'focus_first') return tr ? 'İlk odak seansını başlat.' : 'Start your first focus session.';
  if (id === 'focus_5h') return tr ? 'Toplam 5 saat odaklan.' : 'Focus for 5 hours in total.';
  if (id === 'focus_25h') return tr ? 'Toplam 25 saat odaklan.' : 'Focus for 25 hours in total.';
  if (id === 'first_task') return tr ? 'İlk görevini tamamla.' : 'Complete your first task.';
  if (id === 'daily_perfect') return tr ? 'Bir günün tüm görevlerini bitir.' : "Complete all of a day's tasks.";
  return tr ? 'Uygulamayı kullanmaya devam et.' : 'Keep using the app.';
}

export default function ProfileScreen() {
  const { theme, colorScheme, setTheme, currentSetting } = useAppTheme();
  const { user, setUser, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const A = settingsAccents(theme);  // Apple tarzı çip renkleri (domain'e göre)
  const { show: showToast } = useToastStore();
  const insets = useSafeAreaInsets();

  const bestStreak = useFocusStore(s => s.bestStreak);
  const streakFreezeAvailable = useFocusStore(s => s.streakFreezeAvailable);
  const useStreakFreeze = useFocusStore(s => s.useStreakFreeze);
  const dailyGoalMinutes = useFocusStore(s => s.dailyGoalMinutes);
  const setDailyGoal = useFocusStore(s => s.setDailyGoal);
  const updateBestStreak = useFocusStore(s => s.updateBestStreak);
  const checkStreakFreezeReset = useFocusStore(s => s.checkStreakFreezeReset);
  const focusPoints = useFocusStore(s => s.focusPoints);
  const streakShields = useFocusStore(s => s.streakShields);
  const { habits, toggleDate } = useHabitStore();
  const { tasks } = useTaskStore();
  const { weeklyNotification, setWeeklyNotification, morningBrief, setMorningBrief, eveningBrief, setEveningBrief, soundEffects, setSoundEffects, motto, setMotto, productivityHour, setProductivityHour, avatarBorderColor, setAvatarBorderColor, uiMode, setUiMode, gender, setGender, sleepHealthOptIn, setSleepHealthOptIn, sleepGoalHours, setSleepGoalHours } = usePrefsStore();
  const [sleepSupported] = useState(() => SleepHealth.isSupported());
  const handleSleepToggle = async (v: boolean) => {
    Haptics.selectionAsync();
    if (v) {
      const ok = await SleepHealth.requestAuthorization();
      setSleepHealthOptIn(ok ? 'yes' : 'no');
      showToast(
        ok ? (language === 'tr' ? 'Uyku takibi açık — sabahları otomatik işaretlenir' : 'Sleep tracking on — auto-marked each morning')
           : (language === 'tr' ? 'Sağlık izni verilmedi' : 'Health permission not granted'),
        ok ? 'success' : 'info'
      );
    } else {
      setSleepHealthOptIn('no');
    }
  };
  const cycleSleepGoal = () => { Haptics.selectionAsync(); setSleepGoalHours(sleepGoalHours >= 9 ? 6 : sleepGoalHours + 1); };
  const { unlocked: unlockedAchievements } = useAchievementStore();

  const [editModalVisible, setEditModalVisible] = useState(false);
  useUiDepth(editModalVisible);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'm1');
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  useUiDepth(supportModalVisible);
  const [newName, setNewName] = useState(user?.name || '');
  const [selectedGoal, setSelectedGoal] = useState(dailyGoalMinutes);
  const [newMotto, setNewMotto] = useState(motto);
  const [newGender, setNewGender] = useState(gender);
  const [newProductivityHour, setNewProductivityHour] = useState(productivityHour);
  const [selectedBorderColor, setSelectedBorderColor] = useState(avatarBorderColor);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const { panResponder: editPan, animatedStyle: editSlide, prepare: prepareEdit, slideIn: editSlideIn } = useSwipeToDismiss({
    onDismiss: () => setEditModalVisible(false),
  });

  const [stats, setStats] = useState({ totalFocusHours: 0, completedTasksCount: 0, activeStreak: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [calendarSync, setCalendarSync] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    checkStreakFreezeReset();
    return () => { show.remove(); hide.remove(); };
  }, []);

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
    
    AsyncStorage.getItem('tazq_calendar_sync_enabled').then((val) => {
      setCalendarSync(val === 'true');
    }).catch(() => {});

    // Avatarları profil açılır açılmaz önceden çöz/cache'le → "Düzenle"ye girince
    // 12 PNG ilk kez decode olurken boş/beyaz görünmesin, anında çıksınlar.
    Asset.loadAsync(Object.values(AVATAR_MAP)).catch(() => {});
  }, []);

  const openEditModal = () => {
    prepareEdit();
    setSelectedAvatar(user?.avatar || 'm1');
    setNewName(user?.name || '');
    setSelectedGoal(dailyGoalMinutes);
    setNewMotto(motto);
    setNewGender(gender);
    setNewProductivityHour(productivityHour);
    setSelectedBorderColor(avatarBorderColor);
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
      await AuthService.updateProfile({
        avatar: selectedAvatar,
        name: newName.trim(),
        motto: newMotto.trim(),
        avatarBorderColor: selectedBorderColor,
      });
      // Update local state and close only on success — prevents unmounted-component reopen on error
      setUser({ ...user, avatar: selectedAvatar, name: newName.trim() });
      setDailyGoal(selectedGoal);
      setMotto(newMotto.trim());
      setGender(newGender);
      useSporStore.getState().setGender(newGender);
      setProductivityHour(newProductivityHour);
      setAvatarBorderColor(selectedBorderColor);
      await usePrefsStore.getState().syncToCloud();
      setEditModalVisible(false);
      showToast(t.toastProfileUpdated, 'success');
    } catch (e: unknown) {
      const msg = isNetworkError(e)
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

  const toggleCalendarSync = async (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (val) {
      const granted = await requestCalendarPermissions();
      if (granted) {
        await AsyncStorage.setItem('tazq_calendar_sync_enabled', 'true');
        setCalendarSync(true);
        showToast(language === 'tr' ? 'Takvim senkronizasyonu aktif! Görevler aktarılıyor...' : 'Calendar sync active! Exporting tasks...', 'info');
        
        const result = await bulkExportTasksToCalendar(tasks);
        if (result.success) {
          if (result.fallback) {
            showToast(
              language === 'tr'
                ? 'TAZQ takvimi oluşturulamadı. Görevler varsayılan sistem takviminize aktarıldı.'
                : 'Could not create TAZQ calendar. Tasks exported to your default calendar.',
              'success'
            );
          } else {
            showToast(
              language === 'tr'
                ? 'TAZQ takvimi oluşturuldu ve görevler aktarıldı.'
                : 'TAZQ calendar created and tasks exported.',
              'success'
            );
          }
        } else {
          showToast(
            language === 'tr' ? 'Takvim senkronizasyonu başlatılamadı.' : 'Could not initialize calendar sync.',
            'error'
          );
          await AsyncStorage.setItem('tazq_calendar_sync_enabled', 'false');
          setCalendarSync(false);
        }
      } else {
        Alert.alert(
          language === 'tr' ? 'Takvim İzni Gerekli' : 'Calendar Permission Required',
          language === 'tr'
            ? 'Lütfen uygulama ayarlarından takvim iznini etkinleştirin.'
            : 'Please enable calendar permission in your device settings.',
          [
            { text: t.cancel, style: 'cancel' },
            { text: t.openSettings, onPress: () => Linking.openSettings() }
          ]
        );
      }
    } else {
      await AsyncStorage.setItem('tazq_calendar_sync_enabled', 'false');
      setCalendarSync(false);
      showToast(language === 'tr' ? 'Takvim senkronizasyonu kapatıldı.' : 'Calendar sync disabled.', 'info');
    }
  };

  const handleLogout = () => {
    Alert.alert(t.logout, t.confirmLogout, [
      { text: t.cancel, style: "cancel" },
      { text: t.yes, style: "destructive", onPress: () => { logout(); router.replace('/login'); }}
    ]);
  };

  // Onay kelimesi — parolasız (Google/Apple) kullanıcılar dahil herkes için çalışır
  const DELETE_WORD = language === 'tr' ? 'SİL' : 'DELETE';
  const canConfirmDelete = deleteConfirmText.trim().toLocaleUpperCase(language === 'tr' ? 'tr-TR' : 'en-US') === DELETE_WORD;

  const openDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const openChangePassword = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurPw(''); setNewPw(''); setConfPw(''); setShowPw(false); setPwError(null);
    setPwModalVisible(true);
  };

  const performChangePassword = async () => {
    if (changingPw) return;
    setPwError(null);
    if (!curPw) { setPwError(language === 'tr' ? 'Mevcut şifreni gir.' : 'Enter your current password.'); return; }
    if (!(newPw.length >= 8 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(newPw) && /[0-9]/.test(newPw))) { setPwError(language === 'tr' ? 'Şifre en az 8 karakter olmalı ve en az bir harf ile bir rakam içermelidir.' : 'Password must be at least 8 characters and include a letter and a number.'); return; }
    if (newPw !== confPw) { setPwError(language === 'tr' ? 'Yeni şifreler eşleşmiyor.' : 'New passwords do not match.'); return; }
    setChangingPw(true);
    try {
      await AuthService.changePassword(curPw, newPw);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Keyboard.dismiss();
      setPwModalVisible(false);
      showToast(language === 'tr' ? 'Şifren güncellendi.' : 'Password updated.', 'success');
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = httpDataOf<{ message?: string }>(err).message;
      setPwError(msg || (language === 'tr' ? 'Şifre değiştirilemedi.' : 'Could not change password.'));
    } finally {
      setChangingPw(false);
    }
  };

  const performDeleteAccount = async () => {
    if (!canConfirmDelete || deleting) return;
    setDeleting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try { await AuthService.deleteAccount(); } catch (e) { swallow('profile.performDeleteAccount', e); }
    setDeleting(false);
    setDeleteModalVisible(false);
    logout();
    router.replace('/login');
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
    if (streakShields <= 0) {
      showToast(
        language === 'tr' ? 'Hiç kalkanınız kalmadı! Puan toplayarak kalkan kazanın.' : 'No shields left! Earn shields by collecting focus points.',
        'error'
      );
      return;
    }
    Alert.alert(
      language === 'tr' ? 'Streak Kalkanını Etkinleştir' : 'Activate Streak Shield',
      language === 'tr'
        ? 'Bir kalkan tüketerek bugünkü tüm alışkanlıkları yapıldı olarak işaretlemek istiyor musunuz?'
        : 'Do you want to consume one shield to mark all today\'s habits as completed?',
      [
        { text: t.cancel, style: 'cancel' },
        { text: language === 'tr' ? 'Kullan' : 'Use', onPress: () => {
          useStreakFreeze();
          const todayKey = fmtDateKey();
          habits.forEach(h => {
            if (!h.completedDates.includes(todayKey)) toggleDate(h.id, todayKey);
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (soundEffects) {
            playSoundEffect(require('../assets/sounds/freeze.mp3'), {
              context: 'profile.streakFreezeSound',
              volume: 0.75,
              releaseAfterMs: 3000,
            });
          }
          showToast(language === 'tr' ? 'Kalkan başarıyla kullanıldı!' : 'Shield successfully used!', 'success');
        } }
      ]
    );
  };

  const displayBestStreak = Math.max(bestStreak, stats.activeStreak);
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: navBarSpace(insets.bottom) + S.md, paddingHorizontal: S.lg, paddingTop: S.xl + insets.top, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.header, { marginTop: S.md }]}>
            <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={[styles.avatarLarge, { backgroundColor: '#ffffff', borderWidth: (!avatarBorderColor || avatarBorderColor === 'transparent') ? 2 : 4, borderColor: (!avatarBorderColor || avatarBorderColor === 'transparent') ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)') : avatarBorderColor, width: 110, height: 110, borderRadius: R.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
                <Image source={getAvatarSource(user?.avatar || null)} style={{ width: 110, height: 110 }} resizeMode="cover" />
            </MotiView>
            <View style={{ alignItems: 'center', marginTop: S.md }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.name, { color: theme.onSurface, fontSize: F.hero }]}>{user?.name || 'Alex'}</Text>
                <Text style={[styles.email, { color: theme.onSurfaceMuted, fontSize: F.body }]}>{user?.email || 'user@tazq.com'}</Text>
                {!!motto && (
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, fontStyle: 'italic', marginTop: S.xs, textAlign: 'center', paddingHorizontal: S.lg }}>"{motto}"</Text>
                )}
                <Touchable onPress={openEditModal} style={[styles.editBtn, { backgroundColor: theme.primary, paddingVertical: S.sm }]}>
                    <Text style={[styles.editBtnText, { color: theme.onPrimary, fontWeight: '700', fontSize: F.caption }]}>{t.editProfile || 'Edit Profile'}</Text>
                </Touchable>
            </View>
          </View>

          {statsLoading ? (
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
              {[0,1,2].map(i => (
                <MotiView key={i} animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ loop: true, duration: 1200, delay: i * 80 }} style={{ flex: 1, height: 52, borderRadius: R.md, backgroundColor: theme.surfaceContainerHigh }} />
              ))}
            </View>
          ) : statsError ? (
            <Touchable onPress={loadStats} style={{ marginTop: S.md, alignSelf: 'flex-start', paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: theme.surfaceContainerHigh }}>
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption }}>
                {language === 'tr' ? '↺ Yenile' : '↺ Retry'}
              </Text>
            </Touchable>
          ) : (
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
              {[
                { icon: <Zap size={ICON.sm} color={theme.primary} />, value: stats.totalFocusHours, label: language === 'tr' ? 'saat odak' : 'focus hrs' },
                { icon: <Target size={ICON.sm} color={theme.secondary} />, value: stats.completedTasksCount, label: language === 'tr' ? 'görev tamam' : 'tasks done' },
                { icon: <Trophy size={ICON.sm} color="#ff9f0a" />, value: displayBestStreak, label: language === 'tr' ? 'en uzun seri' : 'best streak' },
              ].map((s, i) => (
                <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.xs + 2, paddingVertical: S.sm + 2, paddingHorizontal: S.sm + 2, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: R.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  {s.icon}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, lineHeight: 20 }}>{s.value}</Text>
                    <Text style={{ fontSize: 10, color: theme.onSurfaceMuted, lineHeight: 13 }} numberOfLines={1}>{s.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Achievement Bölümü ── */}
          {(() => {
            const all = Object.values(ACHIEVEMENTS);
            const unlockedList = all.filter(a => unlockedAchievements.includes(a.id));
            const streakSeq = ['streak_3','streak_7','streak_14','streak_30','streak_100'];
            const momentumSeq = ['momentum_50','momentum_75','momentum_90','momentum_100'];
            const focusSeq = ['focus_first','focus_5h','focus_25h'];
            const dailySeq = ['daily_perfect'];
            const nextOf = (seq: string[]) => seq.find(id => !unlockedAchievements.includes(id));
            const nextIds = [nextOf(streakSeq), nextOf(momentumSeq), nextOf(focusSeq), nextOf(dailySeq)].filter(Boolean) as string[];
            const nextList = nextIds.map(id => ACHIEVEMENTS[id]).filter(Boolean);
            const tr = language === 'tr';
            const chips = [
              ...unlockedList.map(a => ({ ...a, locked: false })),
              ...nextList.map(a => ({ ...a, locked: true })),
            ];
            return (
              <View style={{ marginTop: S.md }}>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', marginBottom: S.md }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600', letterSpacing: 1.5 }}>
                    {tr ? 'BAŞARILAR' : 'ACHIEVEMENTS'}
                  </Text>
                  <View style={{ marginLeft: S.sm, backgroundColor: unlockedList.length > 0 ? theme.tertiary + '22' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xxs }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: unlockedList.length > 0 ? theme.tertiary : theme.onSurfaceVariant, opacity: unlockedList.length > 0 ? 1 : 0.5 }}>
                      {unlockedList.length}/{all.length}
                    </Text>
                  </View>
                </View>

                {chips.length === 0 ? (
                  <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>
                    {tr ? '3 günlük seri yap ya da odak seansı başlat.' : 'Build a 3-day streak or start a focus session.'}
                  </Text>
                ) : (
                  <View style={{ gap: S.xs }}>
                    {Array.from({ length: Math.ceil(chips.length / 3) }, (_, rowIdx) => (
                      <View key={rowIdx} style={{ flexDirection: 'row', gap: S.xs }}>
                        {chips.slice(rowIdx * 3, rowIdx * 3 + 3).map(ach => (
                          <Touchable
                            key={ach.id}
                            activeOpacity={0.7}
                            onPress={() => {
                              Haptics.selectionAsync();
                              Alert.alert(
                                tr ? ach.titleTr : ach.titleEn,
                                ach.locked
                                  ? (tr ? `🔒 Nasıl açılır: ${achievementHint(ach.id, true)}` : `🔒 How to unlock: ${achievementHint(ach.id, false)}`)
                                  : (tr ? `✓ Açıldı — ${ach.subtitleTr}` : `✓ Unlocked — ${ach.subtitleEn}`)
                              );
                            }}
                            style={{
                              flex: 1,
                              alignItems: 'center',
                              gap: S.xs,
                              paddingVertical: S.sm,
                              paddingHorizontal: S.xs,
                              borderRadius: R.md,
                              borderWidth: B.thin,
                              borderColor: ach.locked
                                ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)')
                                : (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.09)'),
                              backgroundColor: ach.locked
                                ? 'transparent'
                                : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                              opacity: ach.locked ? 0.45 : 1,
                            }}
                          >
                            <View style={{
                              width: 48,
                              height: 48,
                              borderRadius: R.full,
                              backgroundColor: ach.locked
                                ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)')
                                : (ACHIEVEMENT_ICONS[ach.id]?.color || theme.primary), // 7% opacity colored backdrop
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: S.sm,
                              borderWidth: ach.locked ? 0 : 1,
                              borderColor: (ACHIEVEMENT_ICONS[ach.id]?.color || theme.primary) + '22', // 13% opacity colored border
                            }}>
                              {renderAchievementIcon(ach.id, 22, ach.locked)}
                            </View>
                            <Text style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color: ach.locked ? theme.onSurfaceVariant : theme.onSurface,
                              opacity: ach.locked ? 0.65 : 1,
                              textAlign: 'center',
                              lineHeight: 13
                            }} numberOfLines={2}>
                              {tr ? ach.titleTr : ach.titleEn}
                            </Text>
                          </Touchable>
                        ))}
                        {chips.slice(rowIdx * 3, rowIdx * 3 + 3).length < 3 &&
                          Array.from({ length: 3 - chips.slice(rowIdx * 3, rowIdx * 3 + 3).length }, (_, i) => (
                            <View key={`placeholder-${i}`} style={{ flex: 1 }} />
                          ))
                        }
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })()}

          {/* AYARLAR — gruplu kategori satırları (Apple tarzı ikonlar). Her biri
              ayrıntı için ayarlar sayfasına götürür; profil yalnızca KİMLİK taşır. */}
          <View style={[styles.settingsSection, { marginTop: S.lg }]}>
            <SectionHeader title={language === 'tr' ? 'AYARLAR' : 'SETTINGS'} theme={theme} tr={language === 'tr'} />
            <SettingsCard theme={theme} isDark={isDark}>
              <SettingItem
                icon={<Bell size={ICON.md} color="#FFFFFF" />}
                bg={A.notify}
                label={language === 'tr' ? 'Bildirimler' : 'Notifications'}
                sub={language === 'tr' ? 'Hatırlatma, özet, takvim' : 'Reminders, briefs, calendar'}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'notify' } })}
                theme={theme}
              />
              <RowDivider theme={theme} />
              <SettingItem
                icon={<Languages size={ICON.md} color="#FFFFFF" />}
                bg={A.system}
                label={language === 'tr' ? 'Görünüm & Dil' : 'Appearance & Language'}
                sub={language === 'tr' ? 'Tema, dil, sade mod' : 'Theme, language, lite mode'}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'system' } })}
                theme={theme}
              />
              <RowDivider theme={theme} />
              <SettingItem
                icon={<Moon size={ICON.md} color="#FFFFFF" />}
                bg={A.health}
                label={language === 'tr' ? 'Uyku & Sağlık' : 'Sleep & Health'}
                sub={language === 'tr' ? 'Apple Sağlık, uyku hedefi' : 'Apple Health, sleep goal'}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'health' } })}
                theme={theme}
              />
              <RowDivider theme={theme} />
              <SettingItem
                icon={<Shield size={ICON.md} color="#FFFFFF" />}
                bg={A.legal}
                label={language === 'tr' ? 'Gizlilik & Yasal' : 'Privacy & Legal'}
                sub={language === 'tr' ? 'Hesap, gizlilik, destek' : 'Account, privacy, support'}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'legal' } })}
                theme={theme}
              />
            </SettingsCard>
          </View>
        </ScrollView>
      </View>

      <BottomNavBar />

      {/* Hesap Silme Onayı — "SİL" yazdıran, parolasız (Google/Apple) kullanıcılar dahil */}

      {/* Şifre Değiştir */}

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="none" onShow={() => editSlideIn()}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Touchable style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'} />
              <Animated.View style={[editSlide, styles.modalContent, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, maxHeight: height - insets.top - 16 }]}>
                <View {...editPan.panHandlers} style={{ paddingTop: S.md, paddingBottom: S.lmd, alignItems: 'center' }}>
                  <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.modalTitle, { color: theme.onSurface, fontSize: F.subhead }]}>
                  {t.editProfile || 'Edit Profile'}
                </Text>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: S.md }}
                >
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={StyleSheet.absoluteFill} />
                  </TouchableWithoutFeedback>
                  {/* Name input */}
                  <View style={{ width: '100%', marginBottom: S.md }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>
                      {t.editName || 'Display Name'}
                    </Text>
                    <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                      <TextInput
                        value={newName}
                        onChangeText={setNewName}
                        placeholder={t.namePlaceholder || 'Your name'}
                        placeholderTextColor={theme.onSurfaceVariant + '99'}
                        style={[styles.nameInput, { color: theme.onSurface, flex: 1, height: '100%', textAlignVertical: 'center' }]}
                        maxLength={50}
                        underlineColorAndroid="transparent"
                      />
                    </View>
                  </View>

                  {/* Gender selection */}
                  <View style={{ width: '100%', marginBottom: S.md }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>
                      {language === 'tr' ? 'Cinsiyet' : 'Gender'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: S.xs }}>
                      {([
                        { key: 'male', labelTr: 'Erkek', labelEn: 'Male' },
                        { key: 'female', labelTr: 'Kadın', labelEn: 'Female' },
                      ] as const).map((g) => {
                        const isSelected = newGender === g.key;
                        return (
                          <Touchable
                            key={g.key}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setNewGender(g.key);
                              if (g.key === 'male') {
                                setSelectedAvatar('m1');
                              } else {
                                setSelectedAvatar('f1');
                              }
                            }}
                            style={{
                              flex: 1,
                              paddingVertical: S.smd,
                              borderRadius: R.sm,
                              borderWidth: 1.5,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderColor: isSelected ? theme.primary : theme.outline,
                              backgroundColor: isSelected ? theme.primaryContainer : 'transparent',
                            }}
                          >
                            <Text style={{
                              fontSize: F.caption2,
                              fontFamily: 'Jakarta-Bold',
                              color: isSelected ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                            }}>
                              {language === 'tr' ? g.labelTr : g.labelEn}
                            </Text>
                          </Touchable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Avatar selection */}
                  <View style={{ width: '100%', marginBottom: S.md }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>Avatar</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg }}
                      style={{ marginTop: S.xs, marginHorizontal: -S.lg }}
                    >
                      {AVATAR_CONFIGS.filter(config => {
                        if (newGender === 'male') return config.key.startsWith('m');
                        if (newGender === 'female') return config.key.startsWith('f');
                        return true;
                      }).map((config) => {
                        const isSelected = selectedAvatar === config.key;
                        return (
                          <Touchable
                            key={config.id}
                            onPress={() => { Haptics.selectionAsync(); setSelectedAvatar(config.key); }}
                            activeOpacity={0.75}
                            accessibilityRole="imagebutton"
                            accessibilityLabel={(language === 'tr' ? 'Avatar ' : 'Avatar ') + config.key}
                            accessibilityState={{ selected: isSelected }}
                            style={{ alignItems: 'center', gap: S.xs }}
                          >
                            <View style={{
                              width: 64, height: 64, borderRadius: R.full,
                              borderWidth: isSelected ? 3 : 1.5,
                              borderColor: isSelected ? theme.primary : theme.outline,
                              overflow: 'hidden',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#ffffff',
                            }}>
                              <Image
                                source={config.image}
                                style={{ width: 64, height: 64 }}
                                resizeMode="cover"
                              />
                            </View>
                            <Text style={{
                              fontSize: 9, fontWeight: '700', letterSpacing: 0.3,
                              color: isSelected ? theme.primary : theme.onSurfaceVariant,
                              opacity: isSelected ? 1 : 0.5,
                            }}>
                              {config.name.toUpperCase()}
                            </Text>
                          </Touchable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Avatar Border Color */}
                  <View style={{ width: '100%', marginBottom: S.md }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>
                      {language === 'tr' ? 'Profil Çerçeve Rengi' : 'Profile Border Color'}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: S.sm,
                        paddingHorizontal: S.lg,
                      }}
                      style={{ marginTop: S.xs, marginHorizontal: -S.lg }}
                    >
                      {([
                        { key: 'transparent', color: 'transparent', labelTr: 'Yok', labelEn: 'None' },
                        { key: 'red', color: '#FF4D4D', labelTr: 'Kırmızı', labelEn: 'Red' },
                        { key: 'fuchsia', color: '#F43F5E', labelTr: 'Fuşya', labelEn: 'Fuchsia' },
                        { key: 'rose', color: '#F472B6', labelTr: 'Gül', labelEn: 'Rose' },
                        { key: 'orange', color: '#FB923C', labelTr: 'Turuncu', labelEn: 'Orange' },
                        { key: 'bronze', color: '#FDBA74', labelTr: 'Bronz', labelEn: 'Bronze' },
                        { key: 'gold', color: '#F59E0B', labelTr: 'Altın', labelEn: 'Gold' },
                        { key: 'yellow', color: '#FFFF00', labelTr: 'Sarı', labelEn: 'Yellow' },
                        { key: 'lime', color: '#A3E635', labelTr: 'Fıstık', labelEn: 'Lime' },
                        { key: 'green', color: '#4ADE80', labelTr: 'Yeşil', labelEn: 'Green' },
                        { key: 'mint', color: '#34D399', labelTr: 'Nane', labelEn: 'Mint' },
                        { key: 'teal', color: '#2DD4BF', labelTr: 'Turkuaz', labelEn: 'Teal' },
                        { key: 'sky', color: '#38BDF8', labelTr: 'Gök', labelEn: 'Sky Blue' },
                        { key: 'blue', color: '#60A5FA', labelTr: 'Mavi', labelEn: 'Blue' },
                        { key: 'violet', color: '#A78BFA', labelTr: 'Menekşe', labelEn: 'Violet' },
                        { key: 'lavender', color: '#C084FC', labelTr: 'Lavanta', labelEn: 'Lavender' },
                        { key: 'sakura', color: '#F472B6', labelTr: 'Gül', labelEn: 'Rose' },
                        { key: 'platinum', color: '#E2E8F0', labelTr: 'Gümüş', labelEn: 'Silver' },
                      ] as const).map((colorOpt) => {
                        const isSelected = selectedBorderColor === colorOpt.color;
                        const isNone = colorOpt.color === 'transparent';
                        return (
                          <Touchable
                            key={colorOpt.key}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: selectedBorderColor === colorOpt.key }}
                            accessibilityLabel={language === 'tr' ? `Çerçeve rengi: ${colorOpt.key}` : `Border color: ${colorOpt.key}`}
                            hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
                            onPress={() => { Haptics.selectionAsync(); setSelectedBorderColor(colorOpt.color); }}
                            activeOpacity={0.8}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: R.full,
                              borderWidth: isSelected ? 3 : 1.5,
                              borderColor: isSelected ? theme.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                            }}
                          >
                            <View style={{
                              width: 26,
                              height: 26,
                              borderRadius: R.full,
                              borderWidth: isNone ? 1.5 : 0,
                              borderStyle: isNone ? 'dashed' : 'solid',
                              borderColor: isNone ? (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)') : 'transparent',
                              backgroundColor: isNone ? 'transparent' : colorOpt.color,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {isSelected && (
                                <View style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: R.full,
                                  backgroundColor: isNone ? (isDark ? '#FFFFFF' : '#000000') : '#FFFFFF',
                                }} />
                              )}
                            </View>
                          </Touchable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Motto */}
                  <View style={{ width: '100%', marginBottom: S.lg }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>
                      {language === 'tr' ? 'Kişisel Motto' : 'Personal Motto'}
                    </Text>
                    <TextInput
                      value={newMotto}
                      onChangeText={setNewMotto}
                      placeholder={language === 'tr' ? 'Seni motive eden bir cümle…' : 'A sentence that motivates you…'}
                      placeholderTextColor={theme.onSurfaceVariant + '60'}
                      maxLength={60}
                      style={{ fontSize: F.body, color: theme.onSurface, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm, marginTop: S.xs }}
                    />
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, textAlign: 'right', marginTop: S.xs }}>{newMotto.length}/60</Text>
                  </View>

                  {/* Productivity hour */}
                  <View style={{ width: '100%', marginBottom: S.lg }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>
                      {language === 'tr' ? 'En Verimli Olduğun Zaman' : 'Peak Productivity Time'}
                    </Text>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, marginBottom: S.sm }}>
                      {language === 'tr' ? 'Sabah özeti bu saate planlanır.' : 'Morning brief is scheduled around this time.'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: S.xs }}>
                      {([
                        { key: 'morning',   labelTr: 'Sabah',   labelEn: 'Morning',   hint: '07:00', icon: (color: string) => <Sunrise size={ICON.md} color={color} /> },
                        { key: 'afternoon', labelTr: 'Öğlen',   labelEn: 'Afternoon', hint: '12:00', icon: (color: string) => <Sun size={ICON.md} color={color} /> },
                        { key: 'evening',   labelTr: 'Akşam',   labelEn: 'Evening',   hint: '17:00', icon: (color: string) => <Sunset size={ICON.md} color={color} /> },
                        { key: 'night',     labelTr: 'Gece',    labelEn: 'Night',     hint: '21:00', icon: (color: string) => <Moon size={ICON.md} color={color} /> },
                      ] as const).map(opt => {
                        const sel = newProductivityHour === opt.key;
                        const itemColor = sel ? theme.primary : theme.onSurfaceVariant;
                        return (
                          <Touchable
                            key={opt.key}
                            onPress={() => { Haptics.selectionAsync(); setNewProductivityHour(opt.key); }}
                            style={{ flex: 1, alignItems: 'center', gap: S.sm, paddingVertical: S.sm, borderRadius: R.md, borderWidth: B.thin, borderColor: sel ? theme.primary + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), backgroundColor: sel ? theme.primary + '15' : 'transparent' }}
                          >
                            {opt.icon(itemColor)}
                            <Text style={{ fontSize: 10, fontWeight: '700', color: itemColor }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text>
                            <Text style={{ fontSize: 9, color: theme.onSurfaceMuted }}>{opt.hint}</Text>
                          </Touchable>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>

                {/* Save button — fixed outside scroll, respects safe area */}
                <View style={{ paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: insets.bottom > 0 ? insets.bottom : S.xl }}>
                  {profileError && (
                    <Text style={{ color: theme.error, fontSize: F.caption, fontWeight: '700', textAlign: 'center', marginBottom: S.sm }}>
                      {profileError}
                    </Text>
                  )}
                  <Touchable
                    onPress={handleSaveProfile}
                    disabled={savingProfile}
                    style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  >
                    {savingProfile
                      ? <ActivityIndicator color="white" />
                      : <Text style={{ color: 'white', fontWeight: '700', fontSize: F.body }}>{t.save}</Text>
                    }
                  </Touchable>
                </View>
              </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Support Modal */}
    </View>
  );
}

// iOS tarzı bölüm başlığı (kartın üstünde küçük, harf aralıklı etiket)



const styles = StyleSheet.create({
  header: { alignItems: 'center' },
  avatarLarge: { borderWidth: 3, padding: S.xs },
  image: { width: '100%', height: '100%' },
  name: { fontWeight: '700', letterSpacing: -1 },
  email: { marginTop: S.xs },
  editBtn: { marginTop: S.md, paddingHorizontal: S.lg, borderRadius: R.full },
  editBtnText: { color: 'white', fontWeight: '700' },
  statsGrid: { flexDirection: 'row' },
  statValue: { fontWeight: '700', marginTop: S.sm },
  settingsSection: { },
  sectionTitle: { fontSize: F.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: S.md },
  sectionLabel: { fontSize: F.caption, fontWeight: '700', letterSpacing: 1, marginBottom: S.sm, textTransform: 'uppercase' },
  settingsCard: { borderRadius: R.lg, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontWeight: '700' },
  skeletonCircle: { width: 24, height: 24, borderRadius: R.full },
  skeletonLine: { height: 14, borderRadius: R.sm },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg },
  logoutText: { fontFamily: 'Jakarta-Bold', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: S.xl, borderTopRightRadius: S.xl, borderBottomLeftRadius: S.xl, borderBottomRightRadius: S.xl, paddingTop: S.sm, overflow: 'hidden' },
  modalHandle: { width: 40, height: 4, borderRadius: R.sm, alignSelf: 'center', marginBottom: S.md },
  modalTitle: { fontWeight: '700', marginBottom: S.lg, textAlign: 'center', paddingHorizontal: S.lg },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  inputGroup: { borderRadius: R.md, paddingHorizontal: S.md, height: 48, justifyContent: 'center' },
  nameInput: { fontSize: F.body, fontWeight: '600' },
  goalChip: { flex: 1, paddingVertical: S.sm, borderRadius: R.md, alignItems: 'center' },
  saveBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
});


