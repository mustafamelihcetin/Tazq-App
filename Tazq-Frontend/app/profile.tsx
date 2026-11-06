import React, { useEffect, useState, useRef } from 'react';
import { settingsText } from '@/shared/constants/settingsCopy';
import type { AppTheme } from '@/shared/constants/Colors';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Modal, ActivityIndicator, Platform, TextInput, Keyboard, Linking, Animated, TouchableWithoutFeedback } from 'react-native';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { track } from '@/shared/utils/analytics';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, LogOut, Shield, Star, Volume2, Sunrise, Sun, Sunset, FileText, MessageSquare, Send, Settings, Wallet, Palette, HeartPulse, ShieldCheck, Pencil, CircleSlash, ChevronRight, Target } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { AuthService, FocusService } from '@/shared/services/api';
import { SleepHealth } from '@/shared/services/sleepHealth';
import { SupportModal } from '@/shared/components/SupportModal';
import { useAuthStore, getAvatarSource, AVATAR_CONFIGS, AVATAR_MAP, useAchievementStore } from '@/features/user';
import { AuraAvatar } from '@/features/user/components/AuraAvatar';
import { useThemeStore } from '@/shared/store/useThemeStore';
import { accentOf } from '@/shared/constants/Colors';
import { useWeekAura } from '@/features/user/hooks/useWeekGlow';
import { LiteModeCard } from '@/features/modes/components/LiteModeCard';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusStore } from '@/features/focus';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.
import { useRouter } from 'expo-router';
import { requestNotificationPermissions, cancelWeeklySummary, cancelMorningBrief, cancelEveningBrief } from '@/shared/utils/notifications';
import { requestCalendarPermissions, bulkExportTasksToCalendar } from '@/shared/utils/calendarSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ICON, S, R, F, B, MAX_W , sheetMaxHeight, SCRIM, topBarSpace } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useToastStore } from '@/shared/store/useToastStore';
import { healthSourceName } from '@/shared/utils/healthSource';
import { Asset } from 'expo-asset';
import { usePrefsStore } from '@/features/modes';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useActiveTasks } from '@/features/tasks';
import { renderAchievementIcon, ACHIEVEMENT_ICONS } from '@/shared/utils/achievementIcons';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { swallow } from '@/shared/utils/swallow';
import { playSoundEffect } from '@/shared/utils/soundEffects';
import { isNetworkError } from '@/shared/utils/errors';
import { ProgressCard } from '@/features/user/components/ProgressCard';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { SettingsCard, SettingItem, ToggleRow, RowDivider, settingsAccents } from '@/shared/components/SettingsRows';
import { haptic } from '@/shared/utils/haptics';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { UserAvatar } from '@/features/user/components/UserAvatar';
import { upperFor } from '@/shared/utils/localeCase';
import { hasRing } from '@/features/user/utils/avatarRings';
import { productivityHint } from '@/shared/utils/productivityHour';
import { fitMaxLength } from '@/shared/utils/fitMaxLength';

const GOAL_OPTIONS = [30, 60, 90, 120];

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
  /* Tablette içerik 600pt'lik şeride sıkışmasın — üç kademeli genişlik. */
  const contentW = useContentMaxWidth();

  const bestStreak = useFocusStore(s => s.bestStreak);
  const streakFreezeAvailable = useFocusStore(s => s.streakFreezeAvailable);
  const useStreakFreeze = useFocusStore(s => s.useStreakFreeze);
  const dailyGoalMinutes = useFocusStore(s => s.dailyGoalMinutes);
  const setDailyGoal = useFocusStore(s => s.setDailyGoal);
  const updateBestStreak = useFocusStore(s => s.updateBestStreak);
  const checkStreakFreezeReset = useFocusStore(s => s.checkStreakFreezeReset);
  const focusPoints = useFocusStore(s => s.focusPoints);
  const streakShields = useFocusStore(s => s.streakShields);
  const { habits, toggleSkipDate } = useHabitStore();
  // Arşivlenmişler istatistiğe girmez: kullanıcı onları hayatından çıkardı.
  const tasks = useActiveTasks();
  const { weeklyNotification, setWeeklyNotification, morningBrief, setMorningBrief, eveningBrief, setEveningBrief, soundEffects, setSoundEffects, motto, setMotto, productivityHour, setProductivityHour, avatarBorderColor, uiMode, setUiMode, gender, setGender, sleepHealthOptIn, setSleepHealthOptIn, sleepGoalHours, setSleepGoalHours } = usePrefsStore();
  const [sleepSupported] = useState(() => SleepHealth.isSupported());
  const handleSleepToggle = async (v: boolean) => {
    haptic.select();
    if (v) {
      const ok = await SleepHealth.requestAuthorization();
      setSleepHealthOptIn(ok ? 'yes' : 'no');
      showToast(
        ok ? (settingsText(language).sleepTrackingOnAutoMarkedEach)
           : (settingsText(language).healthPermissionNotGranted),
        ok ? 'success' : 'info'
      );
    } else {
      setSleepHealthOptIn('no');
    }
  };
  const cycleSleepGoal = () => { haptic.select(); setSleepGoalHours(sleepGoalHours >= 9 ? 6 : sleepGoalHours + 1); };
  const { unlocked: unlockedAchievements, unlockedAt: achievementsUnlockedAt } = useAchievementStore();

  const [editModalVisible, setEditModalVisible] = useState(false);
  useUiDepth(editModalVisible);
  // Seçilmemişse BOŞ: eskiden 'm1' (erkek "Atlas") önceden seçiliydi ve yalnız adını
  // değiştirip kaydeden kullanıcının hesabına sessizce yazılıyordu (bkz. UserAvatar).
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '');
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  useUiDepth(supportModalVisible);
  const [newName, setNewName] = useState(user?.name || '');
  const [selectedGoal, setSelectedGoal] = useState(dailyGoalMinutes);
  const [newMotto, setNewMotto] = useState(motto);
  const [newGender, setNewGender] = useState(gender);
  const [newProductivityHour, setNewProductivityHour] = useState(productivityHour);
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
          swallow('profile.getStats', e);
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

  /*
    MİSAFİR PROFİLİ. Eskiden hesapsız kullanıcıya uydurma bir ad ("Alex") ve uydurma
    bir e-posta ("user@tazq.com") gösteriliyordu; "Profili Düzenle" ise kaydedecek bir
    hesap olmadığı için sessizce başarısız oluyordu. Misafir artık misafir olduğunu
    görüyor ve tek anlamlı eylemi — verisini kaybetmeden hesap açmak — öne çıkıyor.
  */
  const isGuest = useSessionStore(s => s.isGuest);
  const guestAvatar = useSessionStore(s => s.guestProfile?.avatar);
  // Misafir hoş geldinde adını verdiyse onu göster; vermediyse "Misafir" (uydurma ad yok).
  const guestName = useSessionStore(s => s.guestProfile?.name);

  const openEditModal = () => {
    prepareEdit();
    setSelectedAvatar(user?.avatar || '');
    setNewName(user?.name || '');
    setSelectedGoal(dailyGoalMinutes);
    setNewMotto(motto);
    setNewGender(gender);
    setNewProductivityHour(productivityHour);
    setProfileError(null);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!newName.trim()) {
      haptic.error();
      setProfileError(settingsText(language).nameCannotBeEmpty);
      return;
    }
    setProfileError(null);
    setSavingProfile(true);
    try {
      await AuthService.updateProfile({
        // Seçilmediyse gönderilmez — sunucudaki değer olduğu gibi kalır.
        avatar: selectedAvatar || undefined,
        name: newName.trim(),
        motto: newMotto.trim(),
      });
      setDailyGoal(selectedGoal);
      setMotto(newMotto.trim());
      setGender(newGender);
      useSporStore.getState().setGender(newGender);
      setProductivityHour(newProductivityHour);
      // SIRA ÖNEMLİ (2026-11-01): önce tercihler buluta (ve bellekteki kullanıcı kopyasına) yazılır, SONRA kullanıcı
      // güncellenir. Tersi, setUser'ın eski tercih metnini yeniden yükleyip az önceki seçimleri geri almasına yol açıyordu.
      await usePrefsStore.getState().syncToCloud();
      const fresh = useAuthStore.getState().user ?? user;
      setUser({ ...fresh, avatar: selectedAvatar || fresh?.avatar, name: newName.trim() });
      setEditModalVisible(false);
      showToast(t.toastProfileUpdated, 'success');
    } catch (e: unknown) {
      const msg = isNetworkError(e)
        ? (settingsText(language).connectionErrorTryAgain)
        : (settingsText(language).updateFailed);
      setProfileError(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleNotifications = async () => {
    haptic.surface();
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
    haptic.surface();
    if (val) {
      const granted = await requestCalendarPermissions();
      if (granted) {
        await AsyncStorage.setItem('tazq_calendar_sync_enabled', 'true');
        setCalendarSync(true);
        showToast(settingsText(language).calendarSyncActiveExportingTasks, 'info');
        
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
            settingsText(language).couldNotInitializeCalendarSync,
            'error'
          );
          await AsyncStorage.setItem('tazq_calendar_sync_enabled', 'false');
          setCalendarSync(false);
        }
      } else {
        Alert.alert(
          settingsText(language).calendarPermissionRequired,
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
      showToast(settingsText(language).calendarSyncDisabled, 'info');
    }
  };

  const handleLogout = () => {
    Alert.alert(t.logout, t.confirmLogout, [
      { text: t.cancel, style: "cancel" },
      { text: t.yes, style: "destructive", onPress: () => { logout(); router.replace('/login'); }}
    ]);
  };

  /*
    HESAP YÖNETİMİ BURADA DEĞİL — AYARLAR EKRANINDA.

    Hesap silme ve şifre değiştirme akışlarının tamamı (state, açıcılar, onay kelimesi,
    modallar) bir noktada app/settings.tsx'e taşındı ama BU dosyadaki kopya silinmedi:
    ~60 satır state ve iki tam handler geride kaldı, hiçbiri çağrılmıyordu — modal
    işaretlemesi taşınırken gitmişti, yani `setDeleteModalVisible(true)` hiçbir şey
    açmıyordu.

    Ölü kopya zararsız değildi: `deleteAccount`ın sonucu yutan hatalı sürümü İKİ
    dosyada birden duruyordu ve okuyan kişi hangisinin canlı olduğunu bilemiyordu.
    Canlı hâli için bkz. app/settings.tsx → performDeleteAccount / performChangePassword.
  */

  const toggleLanguage = () => {
    haptic.surface();
    setLanguage(language === 'tr' ? 'en' : 'tr');
  };

  const toggleTheme = () => {
    haptic.surface();
    const next = currentSetting === 'light' ? 'dark' : currentSetting === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const handleStreakFreeze = () => {
    if (streakShields <= 0) {
      showToast(
        settingsText(language).noShieldsLeftEarnShieldsBy,
        'error'
      );
      return;
    }
    Alert.alert(
      settingsText(language).activateStreakShield,
      language === 'tr'
        ? 'Bir kalkan tüketerek bugünü tüm alışkanlıklar için mola günü yapmak istiyor musunuz? Serin bozulmaz.'
        : 'Use one shield to make today a break day for all habits? Your streak stays intact.',
      [
        { text: t.cancel, style: 'cancel' },
        { text: settingsText(language).use, onPress: () => {
          useStreakFreeze();
          /*
            KALKAN = MOLA, "YAPILDI" DEĞİL (2026-10-30). Eskiden yapılmamış alışkanlıkları "yapıldı"
            işaretliyordu: seri korunuyordu ama kayıt yalan söylüyordu (rapor, tutarlılık, analiz
            hepsi yapılmayanı yapılmış sayıyordu). Mola zaten seriyi bozmuyor — aynı koruma, dürüst kayıt.
          */
          const todayKey = fmtDateKey();
          habits.forEach(h => {
            if (!(h.completedDates ?? []).includes(todayKey) && !(h.skippedDates ?? []).includes(todayKey)) toggleSkipDate(h.id, todayKey);
          });
          haptic.success();
          if (soundEffects) {
            playSoundEffect(require('../assets/sounds/freeze.mp3'), {
              context: 'profile.streakFreezeSound',
              volume: 0.75,
              releaseAfterMs: 3000,
            });
          }
          showToast(settingsText(language).shieldSuccessfullyUsed, 'success');
        } }
      ]
    );
  };

  // Seri TEK kaynaktan (sunucunun sayısı VADE gününe dayalı: ana ekranla çelişiyordu).
  const currentStreak = useFocusStore(s => s.localStreak);
  const displayBestStreak = Math.max(bestStreak, currentStreak);
  const scrollViewRef = useRef<ScrollView>(null);
  const { scrollY: profileScrollY, onScroll: onProfileScroll } = useCollapsibleHeader();
  const aura = useWeekAura();
  const ic = ID_COPY[language === 'en' ? 'en' : 'tr'];
  const auraMark = usePrefsStore(st => st.auraMark);
  const accentId = useThemeStore(st => st.accent);
  const setAuraMark = usePrefsStore(st => st.setAuraMark);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />
      <View style={{ flex: 1 }}>
        {/* Profil bir SEKME değil (dashboard avatarından push edilir) → alt tab-bar göstermek
            "hiçbir sekme aktif değil" tuhaflığı yaratıyordu. iOS deseni: geri butonu + tam ekran. */}
        <ScreenHeader onBack={() => router.back()} title={settingsText(language).profile} scrollY={profileScrollY} />
        <Animated.ScrollView
          ref={scrollViewRef}
          onScroll={onProfileScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + S.xl, paddingHorizontal: S.lg, paddingTop: topBarSpace(insets.top) + S.sm, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/*
            KİMLİK KARTI (2026-11-01, kullanıcı: "profil kısmı çok dağınık, yukarıdaki yuvarlak çok yer yiyor").
            Eskiden: 88'lik daire + altında ortalanmış ad, e-posta, motto ve ortada dolu bir düğme — ekranın üçte biri.
            Şimdi tek satır: solda aura, yanında ad · e-posta · motto, sağda ikincil "Düzenle". Ayarlar hemen görünür.
          */}
          {/* İLERLEME — istatistik + başarılar + seri kalkanı TEK kartta (bkz. ProgressCard). */}
          {(() => {
            const allIds = ['streak_3','streak_7','streak_14','streak_30','streak_100','momentum_50','momentum_75','momentum_90','momentum_100','focus_first','focus_5h','focus_25h','first_task','daily_perfect'];
            const earned = allIds.filter(id => unlockedAchievements.includes(id));
            // En son kazanılan önde: gururlanılacak şey o AN kazanılan.
            const preview = [...earned].sort((a, b) => (achievementsUnlockedAt[b] ?? 0) - (achievementsUnlockedAt[a] ?? 0)).slice(0, 4);
            const identity = (
            <>
          <View style={styles.idRow}>
            <View style={[styles.idAvatar, { borderColor: hasRing(avatarBorderColor) ? theme.primary : 'transparent' }]}>
              <UserAvatar avatar={user?.avatar ?? guestAvatar} size={ID_AVATAR} iconSize={ICON.lg} theme={theme} animated />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[styles.name, { color: theme.onSurface }]}>{isGuest ? (guestName || t.guest.badge) : (user?.name || '')}</Text>
              <Text numberOfLines={1} style={[styles.email, { color: theme.onSurfaceMuted }]}>
                {isGuest ? t.guest.settingsRow : (user?.email || '')}
              </Text>
              {!!motto && (
                <Text numberOfLines={1} style={[styles.motto, { color: theme.onSurfaceVariant }]}>“{motto}”</Text>
              )}
              {/* AURANIN ANLAMI — çekici ama dürüst: yalnız son 7 günün ölçülen etkinliği. */}
              {uiMode !== 'lite' && <View style={styles.auraLine}>
                <View style={[styles.auraDot, { backgroundColor: theme.primaryFill, opacity: 0.35 + 0.65 * (aura.activeDays / 7) }]} />
                <Text numberOfLines={2} style={[styles.auraText, { color: theme.onSurfaceMuted }]}>
                  {aura.activeDays === 0 ? ic.auraDim : aura.activeDays === 7 ? ic.auraFull : ic.auraDays(aura.activeDays)}
                </Text>
              </View>}
            </View>
            {!isGuest && (
              <Touchable
                onPress={openEditModal}
                accessibilityRole="button"
                accessibilityLabel={t.editProfile || 'Edit Profile'}
                hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}
                style={[styles.editBtn, { backgroundColor: theme.primaryFill + '14' }]}
              >
                <Pencil size={ICON.sm} color={theme.primary} />
              </Touchable>
            )}
          </View>
          {/* Misafirin asıl eylemi: dar düğmeye sıkışmaz, kimliğin altında tam genişlik. */}
          {isGuest && (
            <Touchable onPress={() => router.push('/register')} accessibilityRole="button" accessibilityLabel={t.guest.keepMyData} style={[styles.guestCta, { backgroundColor: theme.primaryFill + '14' }]}>
              <Text style={[styles.editBtnText, { color: theme.primary }]}>{t.guest.keepMyData}</Text>
            </Touchable>
          )}
            </>
          );
            return (
              <ProgressCard
                identity={identity}
                lite={uiMode === 'lite'}
                lang={language === 'en' ? 'en' : 'tr'}
                stats={{ focusHours: stats.totalFocusHours, tasks: stats.completedTasksCount, bestStreak: displayBestStreak, currentStreak }}
                statsState={statsLoading ? 'loading' : statsError && !isGuest ? 'error' : 'ok'}
                onRetry={loadStats}
                medals={preview.map(id => ({ id, earned: true, color: ACHIEVEMENT_ICONS[id]?.color || theme.primary }))}
                earnedCount={earned.length}
                totalMedals={allIds.length}
                onShowcase={() => router.push({ pathname: '/achievements', params: { streak: String(currentStreak), focusHours: String(Math.round(stats.totalFocusHours)) } })}
                renderMedal={renderAchievementIcon}
                shields={streakShields}
                points={focusPoints}
                onShield={handleStreakFreeze}
              />
            );
          })()}

          {/* AYARLAR — gruplu kategori satırları (Apple tarzı ikonlar). Her biri
              ayrıntı için ayarlar sayfasına götürür; profil yalnızca KİMLİK taşır. */}
          {/* Ödemeler bir ayar değil, bir özellik: ayarların başlığı altında durmaz. */}
          {uiMode === 'lite' && <LiteModeCard language={language === 'en' ? 'en' : 'tr'} />}
          {uiMode !== 'lite' && <View style={{ marginTop: S.lg }}>
            <SettingsCard theme={theme} isDark={isDark}>
              <SettingItem
                icon={<Wallet size={ICON.md} color="#FFFFFF" />}
                bg={A.payments}
                label={settingsText(language).payments}
                sub={settingsText(language).billsAndPaymentReminders}
                onPress={() => router.push('/odemeler')}
                theme={theme}
              />
            </SettingsCard>
          </View>}

          <View style={[styles.settingsSection, { marginTop: S.lg }]}>
            <SectionHeader title={settingsText(language).settings2} theme={theme} tr={language === 'tr'} />
            <SettingsCard theme={theme} isDark={isDark}>
              <SettingItem
                icon={<Bell size={ICON.md} color="#FFFFFF" />}
                bg={A.notify}
                label={settingsText(language).notifications}
                sub={uiMode === 'lite' ? settingsText(language).remindersCalendarPrivacy : settingsText(language).briefsCalendarPrivacy}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'notify' } })}
                theme={theme}
              />
              <RowDivider theme={theme} />
              <SettingItem
                icon={<Palette size={ICON.md} color="#FFFFFF" />}
                bg={A.system}
                label={settingsText(language).appearanceLanguage}
                sub={settingsText(language).themeColorLanguageSound}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'system' } })}
                theme={theme}
              />
              {uiMode !== 'lite' && (<>
              <RowDivider theme={theme} />
              <SettingItem
                icon={<HeartPulse size={ICON.md} color="#FFFFFF" />}
                bg={A.health}
                label={settingsText(language).sleepHealth}
                sub={`${healthSourceName(language)}, ${settingsText(language).sleepGoal2}`}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'health' } })}
                theme={theme}
              />
              </>)}
              <RowDivider theme={theme} />
              <SettingItem
                icon={<ShieldCheck size={ICON.md} color="#FFFFFF" />}
                bg={A.legal}
                label={settingsText(language).accountSupport}
                sub={settingsText(language).privacyTermsLogoutSupport}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'legal' } })}
                theme={theme}
              />
            </SettingsCard>
          </View>
        </Animated.ScrollView>
      </View>

      {/* Hesap Silme Onayı — "SİL" yazdıran, parolasız (Google/Apple) kullanıcılar dahil */}

      {/* Şifre Değiştir */}

      {/* Edit Profile Modal */}
      <Modal supportedOrientations={['portrait', 'landscape']} visible={editModalVisible} transparent animationType="none" onShow={() => editSlideIn()}>
        {/*
          KLAVYE (2026-11-01, kullanıcı: "kimlik kutusuna bastım, yukarıda kaldı"): KeyboardAvoidingView pencere içinde
          iOS'ta güvenilir değil — klavye kapanınca sayfa yukarıda takılıyordu. Ölçülen klavye yüksekliği kadar kalkar
          (hızlı ekleme ile aynı yol), kapanınca kesin olarak iner; tavan da klavye kadar düşer.
        */}
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: kbHeight }}>
            <Touchable style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} accessibilityRole="button" accessibilityLabel={settingsText(language).close} />
              <Animated.View style={[editSlide, styles.modalContent, { maxHeight: sheetMaxHeight(height, insets.top) - kbHeight }]}>
                <GlassSurface radius={R.sheet} />
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
                  {/*
                    PROFİLİ DÜZENLE (2026-11-01, kullanıcı: "çok dağınık ve uyumsuz, iyi toparla").
                    Eskiden dört ayrı stil: dolgulu ad alanı, çerçeveli motto, kalın kenarlı cinsiyet kutuları, dört
                    kutulu saat seçimi + ayrı "profil işareti" açıklaması. Şimdi tek dil: üstte canlı önizleme, sonra
                    gruplar — aynı dolgulu alan, aynı kayan seçici (kurulum ekranıyla bire bir).
                    Cinsiyet artık avatarı DEĞİŞTİRMEZ (eskiden 'm1'/'f1' atıyordu); yalnız spor hesabı için.
                  */}
                  <View style={styles.editPreview}>
                    <View style={{ width: 56, height: 56, borderRadius: R.full, overflow: 'hidden' }}>
                      <AuraAvatar name={newName || user?.name} accent={theme.primary} size={56} glow={0.8} animated mark={auraMark} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[styles.previewName, { color: theme.onSurface }]}>{newName.trim() || (t.namePlaceholder || 'Your name')}</Text>
                      <Text numberOfLines={1} style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, marginTop: S.xxs }}>
                        {newMotto.trim() ? `“${newMotto.trim()}”` : ic.previewSub}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>{upperFor(ic.identity, language)}</Text>
                  <View style={[styles.field, { backgroundColor: theme.surfaceField }]}>
                    <TextInput
                      value={newName}
                      onChangeText={setNewName}
                      placeholder={t.namePlaceholder || 'Your name'}
                      accessibilityLabel={t.editName || 'Display Name'}
                      placeholderTextColor={theme.onSurfaceMuted}
                      style={[styles.fieldInput, { color: theme.onSurface }]}
                      maxLength={fitMaxLength(50, newName)}
                      autoCapitalize="words"
                      textContentType="name"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                  <View style={[styles.field, { backgroundColor: theme.surfaceField, marginTop: S.sm }]}>
                    <TextInput
                      value={newMotto}
                      onChangeText={setNewMotto}
                      placeholder={ic.motto}
                      accessibilityLabel={ic.mottoA11y}
                      placeholderTextColor={theme.onSurfaceMuted}
                      maxLength={fitMaxLength(60, newMotto)}
                      style={[styles.fieldInput, { color: theme.onSurface }]}
                      underlineColorAndroid="transparent"
                    />
                    {newMotto.length > 40 && (
                      <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, fontVariant: ['tabular-nums'] }}>{newMotto.length}/60</Text>
                    )}
                  </View>

                  {/*
                    TERCİHLER — tek satırda simgeyle (2026-11-01, kullanıcı: "cinsiyet, en verimli zaman daha minimal ve
                    ikonlarla seçtirilebilir, bu kadar alan yemez"). Solda başlık + seçilenin adı, sağda simge düğmeleri.
                  */}
                  <View style={[styles.prefCard, { backgroundColor: theme.surfaceField, marginTop: S.lg }]}>
                    <IconChoiceRow
                      title={ic.peak}
                      hint={productivityHint(newProductivityHour, language === 'tr' ? 'tr' : 'en')}
                      value={newProductivityHour || 'morning'}
                      onChange={(k) => { haptic.select(); setNewProductivityHour(k as 'morning' | 'afternoon' | 'evening' | 'night'); }}
                      options={[
                        { key: 'morning', label: ic.morning, render: (c) => <Sunrise size={ICON.sm} color={c} /> },
                        { key: 'afternoon', label: ic.afternoon, render: (c) => <Sun size={ICON.sm} color={c} /> },
                        { key: 'evening', label: ic.evening, render: (c) => <Sunset size={ICON.sm} color={c} /> },
                        { key: 'night', label: ic.night, render: (c) => <Moon size={ICON.sm} color={c} /> },
                      ]}
                      theme={theme}
                    />
                    <View style={[styles.prefDivider, { backgroundColor: theme.separator }]} />
                    <IconChoiceRow
                      title={ic.gender}
                      hint={ic.genderHint}
                      value={newGender || 'unset'}
                      onChange={(k) => { haptic.select(); setNewGender(k === 'unset' ? '' : (k as 'male' | 'female')); }}
                      options={[
                        { key: 'female', label: ic.female, render: (c) => <Text style={{ color: c, fontSize: F.callout, fontWeight: '700', lineHeight: F.callout + 2 }}>♀</Text> },
                        { key: 'male', label: ic.male, render: (c) => <Text style={{ color: c, fontSize: F.callout, fontWeight: '700', lineHeight: F.callout + 2 }}>♂</Text> },
                        { key: 'unset', label: ic.unset, render: (c) => <CircleSlash size={ICON.sm} color={c} /> },
                      ]}
                      theme={theme}
                    />
                    <View style={[styles.prefDivider, { backgroundColor: theme.separator }]} />
                    {/* AURA İŞARETİ — harf, simge ya da boş (harfini istemeyen için alternatifler). Seçim anında kaydedilir. */}
                    <View style={styles.prefRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.prefTitle, { color: theme.onSurface }]}>{ic.auraLetter}</Text>
                        <Text style={[styles.prefHint, { color: theme.onSurfaceMuted }]}>{ic.auraLetterHint}</Text>
                      </View>
                    </View>
                    {/* 14 işaret = iki TAM satır (7 + 7): her hücre satırın 1/7'si (kullanıcı: "2 satır olacaksa dolacak"). */}
                    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: S.sm, paddingBottom: S.smd }}>
                      {(['initial', 'star', 'moon', 'sun', 'leaf', 'drop', 'spark', 'mountain', 'wave', 'heart', 'bolt', 'flame', 'arrow', 'none'] as const).map(k => {
                        const on = auraMark === k;
                        return (
                          <Touchable
                            key={k}
                            onPress={() => { if (!on) { haptic.select(); setAuraMark(k); } }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on, checked: on }}
                            accessibilityLabel={ic.marks[k]}
                            style={styles.markCell}
                          >
                            <View style={[styles.markChoice, { borderColor: on ? theme.primary : 'transparent' }]}>
                              <View style={{ width: 34, height: 34, borderRadius: R.full, overflow: 'hidden' }}>
                                <AuraAvatar name={newName || user?.name} accent={theme.primary} size={34} glow={0.8} mark={k} />
                              </View>
                            </View>
                          </Touchable>
                        );
                      })}
                    </View>
                    <View style={[styles.prefDivider, { backgroundColor: theme.separator }]} />
                    {/*
                      AURANIN RENGİ = UYGULAMANIN RENGİ — tek ayar, TEK yer (Ayarlar → Görünüm). Burada yalnız kısayol:
                      aynı seçici iki yerde karmaşa yaratırdı (kullanıcı: "2 yerde aynı ayar karmaşa olmaz mı").
                    */}
                    <Touchable
                      onPress={() => { setEditModalVisible(false); router.push({ pathname: '/settings', params: { section: 'system' } }); }}
                      accessibilityRole="button"
                      accessibilityLabel={`${ic.color}: ${accentOf(accentId).label[language === 'en' ? 'en' : 'tr']}`}
                      accessibilityHint={ic.colorHint}
                      style={styles.prefRow}
                    >
                      <View style={{ width: 14, height: 14, borderRadius: R.full, backgroundColor: theme.primaryFill }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.prefTitle, { color: theme.onSurface }]}>{ic.color} · {accentOf(accentId).label[language === 'en' ? 'en' : 'tr']}</Text>
                        <Text style={[styles.prefHint, { color: theme.onSurfaceMuted }]}>{ic.colorHint}</Text>
                      </View>
                      <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
                    </Touchable>
                  </View>
                </ScrollView>

                {/* Save button — fixed outside scroll, respects safe area */}
                <View style={{ paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: kbHeight > 0 ? S.md : (insets.bottom > 0 ? insets.bottom : S.xl) }}>
                  {profileError && (
                    <Text style={{ color: theme.error, fontSize: F.caption, fontWeight: '700', textAlign: 'center', marginBottom: S.sm }}>
                      {profileError}
                    </Text>
                  )}
                  <Touchable
                    onPress={handleSaveProfile}
                    disabled={savingProfile}
                    style={[styles.saveBtn, { backgroundColor: theme.primaryFill }]}
                  >
                    {savingProfile
                      /*
                        Koyu temada theme.primary PARLAK bir mavi (onPrimary bilerek koyu) —
                        sabit beyaz yazı orada düşük kontrastta kalırdı. Hemen üstündeki
                        "Düzenle" düğmesi zaten theme.onPrimaryFill kullanıyordu; ikisi tutarsızdı.
                      */
                      ? <ActivityIndicator color={theme.onPrimaryFill} />
                      : <Text style={{ color: theme.onPrimaryFill, fontWeight: '700', fontSize: F.body }}>{t.save}</Text>
                    }
                  </Touchable>
                </View>
              </Animated.View>
        </View>
        <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
      </Modal>

      {/* Support Modal */}
    </View>
  );
}

// iOS tarzı bölüm başlığı (kartın üstünde küçük, harf aralıklı etiket)



/** Kimlik kartı + Profili düzenle metinleri (2026-11-01) — iki dil tek yerde, satır içi ternary yerine. */
const ID_COPY = {
  tr: {
    auraDim: 'Auran sönük; bugün bir iş bitir, parlasın.',
    auraFull: 'Auran tam parlıyor: 7 günün 7’sinde buradaydın.',
    auraDays: (n: number) => `Auran bu hafta ${n} günde parladı.`,
    previewSub: 'Auran adından ve renginden doğar; her aktif gün parlatır.',
    identity: 'Kimlik', motto: 'Motto (isteğe bağlı)', mottoA11y: 'Kişisel motto',
    peak: 'En verimli olduğun zaman', morning: 'Sabah', afternoon: 'Öğlen', evening: 'Akşam', night: 'Gece',
    gender: 'Cinsiyet', female: 'Kadın', male: 'Erkek', unset: 'Belirtme',
    genderHint: 'Yalnız spor modundaki kalori ve kilo hesapları için.',
    auraLetter: 'Auranın işareti', auraLetterHint: 'Adının harfi, bir simge ya da boş.',
    color: 'Renk', colorHint: 'Uygulamanın rengi de bu; Görünüm’den değişir.',
    marks: { initial: 'Harf', star: 'Yıldız · odak', moon: 'Ay · gece', sun: 'Güneş · sabah', leaf: 'Yaprak · büyüme', drop: 'Damla · akış', spark: 'Parıltı · fikir', mountain: 'Dağ · hedef', wave: 'Dalga · sakinlik', heart: 'Kalp · özen', bolt: 'Şimşek · enerji', flame: 'Alev · seri', arrow: 'Ok · yön', none: 'Boş' },
  },
  en: {
    auraDim: 'Your aura is dim. Finish one thing today to light it.',
    auraFull: 'Your aura is at full glow: 7 of 7 days.',
    auraDays: (n: number) => `Your aura glowed on ${n} days this week.`,
    previewSub: 'Your aura comes from your name and colour; every active day makes it glow.',
    identity: 'Identity', motto: 'Motto (optional)', mottoA11y: 'Personal motto',
    peak: 'Your peak time', morning: 'Morning', afternoon: 'Midday', evening: 'Evening', night: 'Night',
    gender: 'Gender', female: 'Female', male: 'Male', unset: 'Skip',
    genderHint: 'Only used for calorie and weight estimates in fitness mode.',
    auraLetter: 'Aura mark', auraLetterHint: 'Your initial, a symbol, or nothing.',
    color: 'Colour', colorHint: 'The app uses this colour too; change it in Appearance.',
    marks: { initial: 'Initial', star: 'Star · focus', moon: 'Moon · night owl', sun: 'Sun · early bird', leaf: 'Leaf · growth', drop: 'Drop · flow', spark: 'Spark · ideas', mountain: 'Mountain · goals', wave: 'Wave · calm', heart: 'Heart · care', bolt: 'Bolt · energy', flame: 'Flame · streak', arrow: 'Arrow · direction', none: 'None' },
  },
};

/** Tek satırlık simge seçici: solda başlık + seçilenin açıklaması, sağda yuvarlak simge düğmeleri. */
function IconChoiceRow<K extends string>({ title, hint, value, onChange, options, theme }: {
  title: string; hint?: string; value: K; onChange: (k: K) => void; theme: AppTheme;
  options: { key: K; label: string; render: (color: string) => React.ReactNode }[];
}) {
  const sel = options.find(o => o.key === value);
  // Açıklama simgelerin yanındaki dar sütunda kesiliyordu ("saat verm…"): artık satırın ALTINDA, tam genişlikte.
  return (
    <View style={{ paddingVertical: S.smd }}>
    <View style={[styles.prefRow, { paddingVertical: 0 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.prefTitle, { color: theme.onSurface }]}>{title}</Text>
        {sel ? <Text numberOfLines={1} style={[styles.prefHint, { color: theme.primary, fontWeight: '600' }]}>{sel.label}</Text> : null}
      </View>
      <View accessibilityRole="radiogroup" style={styles.iconChoices}>
        {options.map(o => {
          const on = o.key === value;
          return (
            <Touchable
              key={o.key}
              onPress={() => { if (!on) onChange(o.key); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, checked: on }}
              accessibilityLabel={o.label}
              style={[styles.iconChoice, { backgroundColor: on ? theme.primaryFill : 'transparent', borderColor: on ? theme.primary : theme.outlineVariant }]}
            >
              {o.render(on ? theme.onPrimaryFill : theme.onSurfaceVariant)}
            </Touchable>
          );
        })}
      </View>
    </View>
    {!!hint && <Text style={[styles.prefHint, { color: theme.onSurfaceMuted, marginTop: S.sm }]}>{hint}</Text>}
    </View>
  );
}

/** Kimlik kartındaki avatar çapı (bkz. idCard). */
const ID_AVATAR = 60;

const styles = StyleSheet.create({
  idRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md },
  guestCta: { minHeight: 44, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginBottom: S.md, paddingHorizontal: S.md },
  idAvatar: { width: ID_AVATAR + 6, height: ID_AVATAR + 6, borderRadius: R.full, borderWidth: B.medium, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: F.title3, fontWeight: '700', letterSpacing: -0.4 },
  email: { fontSize: F.footnote, marginTop: S.xxs },
  motto: { fontSize: F.footnote, fontStyle: 'italic', marginTop: S.xs },
  editBtn: { minWidth: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.smd },
  editBtnText: { fontSize: F.footnote, fontWeight: '700' },
  auraLine: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.xs },
  auraDot: { width: 6, height: 6, borderRadius: R.full },
  auraText: { flex: 1, fontSize: F.caption, fontWeight: '600' },
  editPreview: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg },
  previewName: { fontSize: F.subhead, fontWeight: '700', letterSpacing: -0.3 },
  field: { flexDirection: 'row', alignItems: 'center', gap: S.sm, height: 48, borderRadius: R.md, paddingHorizontal: S.md },
  fieldInput: { flex: 1, height: '100%', fontSize: F.body, fontWeight: '500' },
  hint: { fontSize: F.caption, marginTop: S.sm, lineHeight: 16 },
  prefCard: { borderRadius: R.lg, paddingHorizontal: S.md },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.smd },
  prefTitle: { fontSize: F.body, fontWeight: '600' },
  prefHint: { fontSize: F.caption, marginTop: S.xxs, lineHeight: 16 },
  prefDivider: { height: StyleSheet.hairlineWidth },
  iconChoices: { flexDirection: 'row', gap: S.xs },
  markCell: { width: `${100 / 7}%`, alignItems: 'center' },
  markChoice: { padding: S.xxs, borderRadius: R.full, borderWidth: B.medium },
  iconChoice: { width: 36, height: 36, borderRadius: R.full, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row' },
  statValue: { fontWeight: '700', marginTop: S.sm },
  settingsSection: { },
  sectionTitle: { fontSize: F.caption, fontWeight: '700', letterSpacing: 1, marginBottom: S.md },
  // Büyük harf İÇERİKTE (upperFor): textTransform dili bilmez — "CINSIYET", "KIŞISEL" yazıyordu.
  sectionLabel: { fontSize: F.caption, fontWeight: '700', letterSpacing: 1, marginBottom: S.sm },
  settingsCard: { borderRadius: R.lg, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontWeight: '700' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.lg },
  logoutText: { fontFamily: 'Jakarta-Bold', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: SCRIM, justifyContent: 'flex-end' },
  modalContent: { borderRadius: R.sheet, paddingTop: S.sm, overflow: 'hidden' },
  modalHandle: { width: 40, height: 4, borderRadius: R.sm, alignSelf: 'center', marginBottom: S.md },
  modalTitle: { fontWeight: '700', marginBottom: S.md, textAlign: 'center', paddingHorizontal: S.lg },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  inputGroup: { borderRadius: R.md, paddingHorizontal: S.md, height: 48, justifyContent: 'center' },
  nameInput: { fontSize: F.body, fontWeight: '600' },
  goalChip: { flex: 1, paddingVertical: S.sm, borderRadius: R.md, alignItems: 'center' },
  saveBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
});


export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
