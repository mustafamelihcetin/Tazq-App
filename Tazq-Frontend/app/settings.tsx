import React, { useEffect, useState, useRef } from 'react';
import type { AppTheme } from '@/shared/constants/Colors';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Modal, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Keyboard, Linking, Animated, TouchableWithoutFeedback } from 'react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { track } from '@/shared/utils/analytics';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, Languages, LogOut, ChevronRight, Zap, Target, Trophy, Shield, CalendarDays, Star, Volume2, Sunrise, Sun, Sunset, Trash2, FileText, MessageSquare, Send, Lock, Eye, EyeOff, ChevronLeft } from 'lucide-react-native';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { requestNotificationPermissions, cancelWeeklySummary, cancelMorningBrief, cancelEveningBrief } from '@/shared/utils/notifications';
import { requestCalendarPermissions, bulkExportTasksToCalendar } from '@/shared/utils/calendarSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ICON, S, R, F, B, W, MAX_W, MIN_TOUCH, navBarSpace, trackingFor } from '@/shared/constants/tokens';
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
import { AppIcon } from '@/shared/components/AppIcon';

/**
 * Ayarlar sayfası — profil'den AYRILDI. İçerik profile.tsx'ten BYTE-BYTE çıkarıldı;
 * hesap-silme ve parola-değiştirme mantığı/modalları birebir korundu.
 */
export default function SettingsScreen() {
  const { theme, colorScheme, setTheme, currentSetting } = useAppTheme();
  const { user, setUser, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  const router = useRouter();
  // Bölüme kaydırma: profil gruplu satırları ?section=<domain> ile gelir; ilgili
  // bölümün ölçülen y'sine atlarız. Böylece "her satır tüm sayfayı açıyor" biter.
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const mountedAt = useRef(Date.now());
  const { section } = useLocalSearchParams<{ section?: string }>();
  // Bölüme kaydırma — ZAMAN PENCERELİ. Kademeli yerleşimde hedef ölçülürken altındaki
  // içerik daha yerleşmemiş olur; ScrollView kısadır ve scrollTo en alta KIRPILIR (hep
  // sayfa başı görünür). Bu yüzden ilk 800ms boyunca hem her bölüm ölçümünde hem içerik
  // boyutu değiştikçe TEKRAR deneriz — içerik büyüdükçe doğru konuma yakınsar. Pencere
  // dolunca durur, kullanıcının kaydırmasına karışmaz.
  const tryScroll = () => {
    if (!section || Date.now() - mountedAt.current > 800) return;
    const y = sectionY.current[section as string];
    if (y == null) return;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false }));
  };
  const markSection = (dom: string, y: number) => { sectionY.current[dom] = y; tryScroll(); };
  // AYRI SAYFA: her kategori tek başına. show() yalnızca istenen bölümü gösterir;
  // param yoksa (doğrudan /settings) hepsi görünür (geriye dönük).
  const show = (cat: string) => !section || section === cat;
  const catTitle =
    section === 'notify' ? (language === 'tr' ? 'Bildirimler' : 'Notifications')
    : section === 'system' ? (language === 'tr' ? 'Görünüm & Dil' : 'Appearance & Language')
    : section === 'health' ? (language === 'tr' ? 'Uyku & Sağlık' : 'Sleep & Health')
    : section === 'legal' ? (language === 'tr' ? 'Gizlilik & Yasal' : 'Privacy & Legal')
    : (language === 'tr' ? 'Ayarlar' : 'Settings');
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
  const { unlocked: unlockedAchievements } = useAchievementStore();
  const isDark = colorScheme === 'dark';
  const A = settingsAccents(theme);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
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

  const DELETE_WORD = language === 'tr' ? 'SİL' : 'DELETE';
  const canConfirmDelete = deleteConfirmText.trim().toLocaleUpperCase(language === 'tr' ? 'tr-TR' : 'en-US') === DELETE_WORD;

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

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.md, paddingBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <Touchable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Geri' : 'Back'} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginLeft: -S.sm }}>
          <ChevronLeft size={ICON.lg} color={theme.onSurface} />
        </Touchable>
        <Text style={{ fontSize: F.title, fontWeight: W.bold, color: theme.onSurface, letterSpacing: trackingFor(F.title) }}>
          {catTitle}
        </Text>
      </View>

      <ScrollView ref={scrollRef} onContentSizeChange={tryScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: navBarSpace(insets.bottom) + S.md }}>
            {show('notify') && (<>
            {/* ── BİLDİRİMLER ── */}
            <SectionHeader onLayout={e => markSection('notify', e.nativeEvent.layout.y)} title={language === 'tr' ? 'BİLDİRİMLER' : 'NOTIFICATIONS'} theme={theme} tr={language === 'tr'} />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<Bell size={ICON.md} color="#FFFFFF" />}
                    label={t.notifications}
                    sub={language === 'tr' ? 'Sistem izinleri' : 'System permission'}
                    bg={A.notify}
                    right={<Text style={{ color: notifEnabled ? theme.success : theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{notifEnabled ? t.notificationsEnabled : t.notificationsDisabled}</Text>}
                    onPress={toggleNotifications}
                    theme={theme}
                />
                <RowDivider theme={theme} />
                <ToggleRow
                    icon={<Sunrise size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={language === 'tr' ? 'Sabah Özeti' : 'Morning Brief'}
                    subtitle={language === 'tr' ? 'Her sabah 08:00 — bugünkü görevler' : 'Daily at 08:00 — today\'s tasks'}
                    value={morningBrief}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setMorningBrief(v); if (!v) cancelMorningBrief(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                <ToggleRow
                    icon={<Sunset size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={language === 'tr' ? 'Akşam Özeti' : 'Evening Brief'}
                    subtitle={language === 'tr' ? 'Her gün 21:00 — günlük tamamlanma' : 'Daily at 21:00 — day completion'}
                    value={eveningBrief}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setEveningBrief(v); if (!v) cancelEveningBrief(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                <ToggleRow
                    icon={<CalendarDays size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={language === 'tr' ? 'Haftalık Özet' : 'Weekly Summary'}
                    subtitle={language === 'tr' ? 'Her Pazar akşamı momentum özeti' : 'Momentum recap every Sunday'}
                    value={weeklyNotification}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setWeeklyNotification(v); if (!v) cancelWeeklySummary(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                <ToggleRow
                    icon={<CalendarDays size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={language === 'tr' ? 'Takvim Senkronizasyonu' : 'Calendar Sync'}
                    subtitle={language === 'tr' ? 'Görevleri sistem takvimine kaydeder' : 'Syncs tasks to system calendar'}
                    value={calendarSync}
                    onValueChange={toggleCalendarSync}
                    theme={theme} isDark={isDark}
                />
            </SettingsCard>

            </>)}
            {show('system') && (<>
            {/* ── GÖRÜNÜM & DİL ── */}
            <SectionHeader onLayout={e => markSection('system', e.nativeEvent.layout.y)} title={language === 'tr' ? 'GÖRÜNÜM & DİL' : 'APPEARANCE & LANGUAGE'} theme={theme} tr={language === 'tr'} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<Moon size={ICON.md} color="#FFFFFF" />}
                    label={t.appearance}
                    bg={A.system}
                    right={<Text style={{ color: theme.primary, fontWeight: '700', fontSize: F.caption }}>{((t as any)[`theme${currentSetting.charAt(0).toUpperCase() + currentSetting.slice(1)}`] || currentSetting).toUpperCase()}</Text>}
                    onPress={toggleTheme}
                    theme={theme}
                />
                <RowDivider theme={theme} />
                <SettingItem
                    icon={<Languages size={ICON.md} color="#FFFFFF" />}
                    label={t.language}
                    bg={A.system}
                    right={<Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{language.toUpperCase()}</Text>}
                    onPress={toggleLanguage}
                    theme={theme}
                />
                <RowDivider theme={theme} />
                <ToggleRow
                    icon={<Zap size={ICON.md} color="#FFFFFF" />}
                    bg={A.system}
                    title={language === 'tr' ? 'Sade Mod' : 'Lite Mode'}
                    subtitle={language === 'tr' ? 'Oyunlaştırma ve modları gizler — sadece görevler' : 'Hides gamification & modes — tasks only'}
                    value={uiMode === 'lite'}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setUiMode(v ? 'lite' : 'pro'); track('ui_mode_changed', { mode: v ? 'lite' : 'pro' }); }}
                    theme={theme} isDark={isDark}
                />
            </SettingsCard>

            {/* ── DENEYİM ── */}
            <SectionHeader title={language === 'tr' ? 'DENEYİM' : 'EXPERIENCE'} theme={theme} tr={language === 'tr'} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
                <ToggleRow
                    icon={<Volume2 size={ICON.md} color="#FFFFFF" />}
                    bg={A.core}
                    title={language === 'tr' ? 'Ses Efektleri' : 'Sound Effects'}
                    subtitle={language === 'tr' ? 'Görev & timer tamamlama sesleri' : 'Task & timer completion sounds'}
                    value={soundEffects}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setSoundEffects(v); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                <SettingItem
                    icon={<Zap size={ICON.md} color="#FFFFFF" />}
                    label={language === 'tr' ? 'Focus Puanları' : 'Focus Points'}
                    sub={language === 'tr' ? `${focusPoints} XP · Her 100 puanda 1 kalkan kazanırsın` : `${focusPoints} XP · Gain 1 shield every 100 points`}
                    bg={A.core}
                    right={<Text style={{ color: theme.primary, fontWeight: '700', fontSize: F.caption }}>{focusPoints}/100</Text>}
                    theme={theme}
                />
                <RowDivider theme={theme} />
                <SettingItem
                    icon={<Shield size={ICON.md} color="#FFFFFF" />}
                    label={t.streakFreeze}
                    sub={language === 'tr' ? `${streakShields}/3 kalkan hazır — seriyi korur` : `${streakShields}/3 shields ready — protects streak`}
                    bg={A.streak}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                        {[1, 2, 3].map((num) => (
                          <Shield
                            key={num}
                            size={12}
                            color={num <= streakShields ? (isDark ? '#2DD4BF' : '#0D9488') : theme.onSurfaceVariant}
                            fill={num <= streakShields ? (isDark ? '#2DD4BF' : '#0D9488') : 'transparent'}
                            opacity={num <= streakShields ? 1 : 0.25}
                          />
                        ))}
                      </View>
                    }
                    onPress={handleStreakFreeze}
                    theme={theme}
                />
            </SettingsCard>

            </>)}
            {show('health') && (<>
            {/* ── UYKU (Apple Sağlık) — yalnız desteklenen cihazda ── */}
            {sleepSupported && (
              <>
                <SectionHeader onLayout={e => markSection('health', e.nativeEvent.layout.y)} title={language === 'tr' ? 'UYKU' : 'SLEEP'} theme={theme} tr={language === 'tr'} style={{ marginTop: S.lg }} />
                <SettingsCard theme={theme} isDark={isDark}>
                    <ToggleRow
                        icon={<Moon size={ICON.md} color="#FFFFFF" />}
                        bg={A.health}
                        title={language === 'tr' ? 'Apple Sağlık ile Uyku' : 'Sleep via Apple Health'}
                        subtitle={language === 'tr' ? 'Uyku alışkanlığın her sabah otomatik işaretlenir' : 'Your sleep habit is auto-marked each morning'}
                        value={sleepHealthOptIn === 'yes'}
                        onValueChange={handleSleepToggle}
                        theme={theme} isDark={isDark}
                    />
                    {/* Uyku hedefi YALNIZCA Apple Sağlık uyku açıkken görünür — hedef,
                        senkron olmadan anlamsız. Kapalıyken satır (ve ayıracı) tümden gizli. */}
                    {sleepHealthOptIn === 'yes' && (
                      <>
                        <RowDivider theme={theme} />
                        <SettingItem
                            icon={<Target size={ICON.md} color="#FFFFFF" />}
                            label={language === 'tr' ? 'Uyku Hedefi' : 'Sleep Goal'}
                            sub={language === 'tr' ? 'Hedefi tuttuğunda kutlanır' : 'Celebrated when you hit it'}
                            bg={A.health}
                            right={<Text style={{ color: theme.onSurfaceVariant, fontWeight: W.semibold, fontSize: F.caption }}>{sleepGoalHours}{language === 'tr' ? ' saat' : 'h'}</Text>}
                            onPress={cycleSleepGoal}
                            theme={theme}
                        />
                      </>
                    )}
                </SettingsCard>
              </>
            )}

            {/*
              MERKEZ — YALNIZCA Sade modda.

              /cockpit zaten alt navigasyonda bir sekme, yani Pro modda bu satır bir
              dokunuş uzaktaki şeyi ikinci kez sunuyordu: koca bir bölüm başlığı + satır,
              sıfır yeni yetenek. Ayarlar sayfasının "kalabalık" hissinin bir parçası buydu.

              Ama körlemesine silinemez: Sade mod sekmeleri home/tasks/focus ile sınırlıyor
              (bkz. BottomNavBar.LITE_TAB_IDS), yani orada bu satır cockpit'e TEK erişim yolu.
              Koşullu olunca ikisi de doğru: Pro'da yok, Sade'de var.
            */}
            {uiMode === 'lite' && (
              <>
              <SectionHeader title={language === 'tr' ? 'MERKEZ' : 'HUB'} theme={theme} tr={language === 'tr'} style={{ marginTop: S.lg }} />
              <SettingsCard theme={theme} isDark={isDark}>
                  <SettingItem
                      icon={<CalendarDays size={ICON.md} color="#FFFFFF" />}
                      label={language === 'tr' ? 'Haftalık Merkez' : 'Weekly Hub'}
                      sub={language === 'tr' ? 'Momentum, seri ve haftalık bakış' : 'Momentum, streak & weekly view'}
                      bg={A.core}
                      onPress={() => router.push('/cockpit')}
                      theme={theme}
                  />
              </SettingsCard>
              </>
            )}

            </>)}
            {show('legal') && (<>
            {/* ── YASAL & GİZLİLİK ── */}
            <SectionHeader onLayout={e => markSection('legal', e.nativeEvent.layout.y)} title={t.legalAndPrivacy || (language === 'tr' ? 'YASAL & GİZLİLİK' : 'LEGAL & PRIVACY')} theme={theme} tr={language === 'tr'} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<FileText size={ICON.md} color="#FFFFFF" />}
                    label={t.termsOfService || (language === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service')}
                    bg={A.legal}
                    onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
                    theme={theme}
                />
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.outlineVariant }} />
                <SettingItem
                    icon={<Shield size={ICON.md} color="#FFFFFF" />}
                    label={t.privacyPolicy || (language === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy')}
                    bg={A.legal}
                    onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
                    theme={theme}
                />
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.outlineVariant }} />
                <SettingItem
                    icon={<MessageSquare size={ICON.md} color="#FFFFFF" />}
                    label={(t as any).support?.title || (language === 'tr' ? 'Destek & İletişim' : 'Support & Contact')}
                    sub={(t as any).support?.sub || (language === 'tr' ? 'Soru ve önerilerini ilet' : 'Send questions & feedback')}
                    bg={A.core}
                    onPress={() => setSupportModalVisible(true)}
                    theme={theme}
                />
            </SettingsCard>

            {user?.role === 'Admin' && (
              <Touchable
                onPress={() => router.push('/admin')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', borderRadius: R.md, paddingVertical: S.md, paddingHorizontal: S.md, marginTop: S.xl, borderWidth: B.thin, borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)' }}
              >
                <Shield size={ICON.md} color="#6366F1" />
                <Text style={{ color: '#6366F1', fontWeight: '700', fontSize: F.body, flex: 1 }}>
                  {language === 'tr' ? 'Admin Paneli' : 'Admin Panel'}
                </Text>
                <ChevronRight size={ICON.sm} color="#6366F1" />
              </Touchable>
            )}

            {(user as any)?.hasPassword && (
              <Touchable
                onPress={openChangePassword}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, paddingVertical: S.md, paddingHorizontal: S.md, marginTop: S.xl }}
              >
                <Lock size={ICON.md} color={theme.onSurfaceVariant} />
                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Şifre Değiştir' : 'Change Password'}</Text>
                <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.5} />
              </Touchable>
            )}

            {/*
              TEHLİKE HİYERARŞİSİ — algıya göre. Eskiden tersti: geri alınabilir ÇIKIŞ
              alarm kırmızısıyla, geri dönüşü olmayan HESAP SİLME soluk gri dipnotla
              çiziliyordu. Yani kullanıcı güvenli eylem için uyarılıyor, yıkıcı eylem için
              uyarılmıyordu. Renk = tehlike seviyesi olmalı:
                Çıkış  → nötr/sakin (rutin, geri alınabilir). Kırmızı değil.
                Silme  → kırmızı (kalıcı). Küçük tutulur (kaza önleme) ama rengi tehlikeyi
                         söyler; asıl sürtünme onay modalında (yazarak doğrulama).
            */}
            <Touchable onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: theme.surfaceContainerHigh, marginTop: (user as any)?.hasPassword ? S.md : S.xl, paddingVertical: S.md, paddingHorizontal: S.md }]}>
                <LogOut size={ICON.md} color={theme.onSurfaceVariant} />
                <Text style={[styles.logoutText, { color: theme.onSurface, fontSize: F.body }]}>{t.logout}</Text>
            </Touchable>

            <Touchable onPress={openDeleteAccount} style={[styles.logoutBtn, { backgroundColor: 'transparent', marginTop: S.md, paddingVertical: S.md, paddingHorizontal: S.md }]}>
                <Trash2 size={ICON.sm} color={theme.error} />
                <Text style={[styles.logoutText, { color: theme.error, fontSize: F.caption }]}>{t.deleteAccount || (language === 'tr' ? 'Hesabımı Sil' : 'Delete Account')}</Text>
            </Touchable>
            </>)}
      </ScrollView>

      <BottomNavBar />

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => { if (!deleting) setDeleteModalVisible(false); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: S.lg, paddingTop: insets.top + S.lg, paddingBottom: (kbHeight > 0 ? kbHeight : insets.bottom) + S.lg }}>
          <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { if (!deleting) { Keyboard.dismiss(); setDeleteModalVisible(false); } }} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'} />
          <MotiView
            from={{ opacity: 0, scale: 0.96, translateY: 16 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={{ width: '100%', maxWidth: 420, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderRadius: R.lg, padding: S.lg, gap: S.md }}
          >
            <View style={{ width: 52, height: 52, borderRadius: R.full, backgroundColor: theme.error + '18', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
              <Trash2 size={ICON.lg} color={theme.error} strokeWidth={2.2} />
            </View>

            <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, textAlign: 'center', letterSpacing: -0.3 }}>
              {language === 'tr' ? 'Hesabını sil' : 'Delete account'}
            </Text>

            {/* Açıklama + kayıp listesi yalnızca klavye kapalıyken (yazarken kompakt kalır, scroll gerekmez) */}
            {kbHeight === 0 && (
              <>
                <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant, textAlign: 'center', lineHeight: 20 }}>
                  {language === 'tr'
                    ? 'Hesabın hemen devre dışı kalır. 30 gün içinde tekrar giriş yaparsan her şey geri gelir. Süre dolunca şunlar kalıcı olarak silinir:'
                    : 'Your account is deactivated right away. Log back in within 30 days to restore everything. After that, the following is permanently deleted:'}
                </Text>
                <View style={{ gap: S.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, paddingVertical: S.md, paddingHorizontal: S.md }}>
                  {(language === 'tr'
                    ? ['Profilin ve tüm ayarların', 'Tüm görev ve alışkanlıkların', 'Odak geçmişin ve istatistiklerin', 'Aktif modların ve planların']
                    : ['Your profile & all settings', 'All tasks & habits', 'Focus history & stats', 'Active modes & plans']
                  ).map((li, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                      <View style={{ width: 5, height: 5, borderRadius: R.full, backgroundColor: theme.error, opacity: 0.7 }} />
                      <Text style={{ flex: 1, fontSize: F.caption + 1, color: theme.onSurfaceVariant, fontWeight: '500' }}>{li}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, textAlign: 'center', marginTop: S.xxs }}>
              {language === 'tr' ? 'Onaylamak için ' : 'Type '}
              <Text style={{ fontWeight: '700', color: theme.error, letterSpacing: 1 }}>{DELETE_WORD}</Text>
              {language === 'tr' ? ' yazın' : ' to confirm'}
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={DELETE_WORD}
              placeholderTextColor={theme.onSurfaceVariant + '66'}
              editable={!deleting}
              style={{ borderWidth: B.medium, borderColor: canConfirmDelete ? theme.error : theme.outline, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm, color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', letterSpacing: 2, textAlign: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
            />

            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xs }}>
              <Touchable onPress={() => { if (!deleting) { Keyboard.dismiss(); setDeleteModalVisible(false); } }} style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', alignItems: 'center' }}>
                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Vazgeç' : 'Cancel'}</Text>
              </Touchable>
              <Touchable disabled={!canConfirmDelete || deleting} onPress={performDeleteAccount} style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: theme.error, alignItems: 'center', justifyContent: 'center', opacity: (canConfirmDelete && !deleting) ? 1 : 0.4 }}>
                {deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Hesabı Sil' : 'Delete'}</Text>}
              </Touchable>
            </View>
          </MotiView>
        </View>
      </Modal>

      <Modal visible={pwModalVisible} transparent animationType="fade" onRequestClose={() => { if (!changingPw) setPwModalVisible(false); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: S.lg, paddingTop: insets.top + S.lg, paddingBottom: (kbHeight > 0 ? kbHeight : insets.bottom) + S.lg }}>
          <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { if (!changingPw) { Keyboard.dismiss(); setPwModalVisible(false); } }} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'} />
          <MotiView
            from={{ opacity: 0, scale: 0.96, translateY: 16 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={{ width: '100%', maxWidth: 420, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderRadius: R.lg, padding: S.lg, gap: S.md }}
          >
            <AppIcon Icon={Lock} color={theme.primary} size={52} radius={R.full} iconSize={ICON.lg} />
            <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, textAlign: 'center', letterSpacing: -0.3 }}>
              {language === 'tr' ? 'Şifre Değiştir' : 'Change Password'}
            </Text>

            {[
              { val: curPw, set: setCurPw, ph: language === 'tr' ? 'Mevcut şifren' : 'Current password', eye: false },
              { val: newPw, set: setNewPw, ph: language === 'tr' ? 'Yeni şifre (8+ karakter, harf ve rakam)' : 'New password (8+ chars, letter & number)', eye: true },
              { val: confPw, set: setConfPw, ph: language === 'tr' ? 'Yeni şifre (tekrar)' : 'Confirm new password', eye: false },
            ].map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: B.medium, borderColor: theme.outline, borderRadius: R.md, paddingHorizontal: S.md, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                <TextInput
                  value={f.val}
                  onChangeText={(v) => { f.set(v); if (pwError) setPwError(null); }}
                  secureTextEntry={!showPw}
                  placeholder={f.ph}
                  placeholderTextColor={theme.onSurfaceVariant + '80'}
                  autoCapitalize="none"
                  editable={!changingPw}
                  style={{ flex: 1, paddingVertical: S.sm, color: theme.onSurface, fontSize: F.body }}
                />
                {f.eye && (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPw ? (language === 'tr' ? 'Şifreyi gizle' : 'Hide password') : (language === 'tr' ? 'Şifreyi göster' : 'Show password')} onPress={() => setShowPw((s) => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {showPw ? <EyeOff size={ICON.md} color={theme.onSurfaceVariant} /> : <Eye size={ICON.md} color={theme.onSurfaceVariant} />}
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {pwError && <Text style={{ color: theme.error, textAlign: 'center', fontSize: F.caption + 1, fontWeight: '600' }}>{pwError}</Text>}

            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xxs }}>
              <Touchable onPress={() => { if (!changingPw) { Keyboard.dismiss(); setPwModalVisible(false); } }} style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', alignItems: 'center' }}>
                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Vazgeç' : 'Cancel'}</Text>
              </Touchable>
              <Touchable onPress={performChangePassword} disabled={changingPw} style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', opacity: changingPw ? 0.6 : 1 }}>
                {changingPw ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Kaydet' : 'Save'}</Text>}
              </Touchable>
            </View>
          </MotiView>
        </View>
      </Modal>

      <SupportModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
        theme={theme}
        isDark={isDark}
        language={language}
        t={t}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg },
  logoutText: { fontFamily: 'Jakarta-Bold', fontWeight: '700' },
});
