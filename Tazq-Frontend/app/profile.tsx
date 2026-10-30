import React, { useEffect, useState, useRef } from 'react';
import type { AppTheme } from '@/shared/constants/Colors';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Modal, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Keyboard, Linking, Animated, TouchableWithoutFeedback } from 'react-native';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { track } from '@/shared/utils/analytics';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, LogOut, Shield, CalendarDays, Star, Volume2, Sunrise, Sun, Sunset, FileText, MessageSquare, Send, Settings, Wallet, Palette, HeartPulse, ShieldCheck } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { AuthService, FocusService } from '@/shared/services/api';
import { SleepHealth } from '@/shared/services/sleepHealth';
import { SupportModal } from '@/shared/components/SupportModal';
import { useAuthStore, getAvatarSource, AVATAR_CONFIGS, AVATAR_MAP, useAchievementStore } from '@/features/user';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusStore } from '@/features/focus';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.
import { useRouter } from 'expo-router';
import { requestNotificationPermissions, cancelWeeklySummary, cancelMorningBrief, cancelEveningBrief } from '@/shared/utils/notifications';
import { requestCalendarPermissions, bulkExportTasksToCalendar } from '@/shared/utils/calendarSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ICON, S, R, F, B, MAX_W , sheetMaxHeight} from '@/shared/constants/tokens';
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
import { BackButton } from '@/shared/components/BackButton';
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
        ok ? (language === 'tr' ? 'Uyku takibi açık — sabahları otomatik işaretlenir' : 'Sleep tracking on — auto-marked each morning')
           : (language === 'tr' ? 'Sağlık izni verilmedi' : 'Health permission not granted'),
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
      setProfileError(language === 'tr' ? 'Görünen ad boş olamaz.' : 'Name cannot be empty.');
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
      // Update local state and close only on success — prevents unmounted-component reopen on error
      setUser({ ...user, avatar: selectedAvatar || user?.avatar, name: newName.trim() });
      setDailyGoal(selectedGoal);
      setMotto(newMotto.trim());
      setGender(newGender);
      useSporStore.getState().setGender(newGender);
      setProductivityHour(newProductivityHour);
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
        language === 'tr' ? 'Hiç kalkanınız kalmadı! Puan toplayarak kalkan kazanın.' : 'No shields left! Earn shields by collecting focus points.',
        'error'
      );
      return;
    }
    Alert.alert(
      language === 'tr' ? 'Streak Kalkanını Etkinleştir' : 'Activate Streak Shield',
      language === 'tr'
        ? 'Bir kalkan tüketerek bugünü tüm alışkanlıklar için mola günü yapmak istiyor musunuz? Serin bozulmaz.'
        : 'Use one shield to make today a break day for all habits? Your streak stays intact.',
      [
        { text: t.cancel, style: 'cancel' },
        { text: language === 'tr' ? 'Kullan' : 'Use', onPress: () => {
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
          showToast(language === 'tr' ? 'Kalkan başarıyla kullanıldı!' : 'Shield successfully used!', 'success');
        } }
      ]
    );
  };

  // Seri TEK kaynaktan (sunucunun sayısı VADE gününe dayalı: ana ekranla çelişiyordu).
  const currentStreak = useFocusStore(s => s.localStreak);
  const displayBestStreak = Math.max(bestStreak, currentStreak);
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />
      <View style={{ flex: 1 }}>
        {/* Profil bir SEKME değil (dashboard avatarından push edilir) → alt tab-bar göstermek
            "hiçbir sekme aktif değil" tuhaflığı yaratıyordu. iOS deseni: geri butonu + tam ekran. */}
        <BackButton
          onPress={() => router.back()}
          style={{ position: 'absolute', top: insets.top + S.xs, left: S.md, zIndex: 10 }}
        />
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + S.xl, paddingHorizontal: S.lg, paddingTop: S.xl + insets.top, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.header, { marginTop: S.md }]}>
            <MotiView from={{ scale: 0.92 }} animate={{ scale: 1 }} style={[styles.avatarLarge, { backgroundColor: theme.surfaceField, borderWidth: (!avatarBorderColor || avatarBorderColor === 'transparent') ? 2 : 4, borderColor: hasRing(avatarBorderColor) ? theme.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'), width: 88, height: 88, borderRadius: R.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
                {/*
                  Resim çerçevenin İÇ KENARINA oturur: dış çap − 2×kenarlık. Aradaki iç boşluk
                  kaldırıldı (2026-10-25, kullanıcı: "çerçeve ile resim arasında boşluk var") —
                  renkli halka resmi doğrudan sarıyor. Kap opaklık 0'dan başlamıyor: görünmezken
                  kurulan ekranda giriş animasyonu çalışmazsa avatar kaybolmasın.
                  (Eski not:) Resim dairenin İÇ alanına göre boyutlanır.
                  Sabit 110 yazılıydı; kap küçülünce (88) resim taşıp kırpılıyor, "yakınlaştırılmış"
                  görünüyordu (eskiden de kenarlık+boşluk kadar hafifçe taşıyordu).
                */}
                {(() => {
                  const inner = 88 - 2 * ((!avatarBorderColor || avatarBorderColor === 'transparent') ? 2 : 4);
                  // Resim kendi dairesini de taşır: kare köşeler iç boşluk halkasında görünmesin.
                  return <UserAvatar avatar={user?.avatar ?? guestAvatar} size={inner} iconSize={ICON.xxl} theme={theme} style={{ borderRadius: inner / 2, overflow: 'hidden' }} />;
                })()}
            </MotiView>
            <View style={{ alignItems: 'center', marginTop: S.md }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.name, { color: theme.onSurface, fontSize: F.display }]}>{isGuest ? (guestName || t.guest.badge) : (user?.name || '')}</Text>
                {isGuest ? (
                  <Text style={[styles.email, { color: theme.onSurfaceMuted, fontSize: F.body, textAlign: 'center' }]}>{t.guest.settingsRow}</Text>
                ) : !!user?.email && (
                  <Text style={[styles.email, { color: theme.onSurfaceMuted, fontSize: F.body }]}>{user.email}</Text>
                )}
                {!!motto && (
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, fontStyle: 'italic', marginTop: S.xs, textAlign: 'center', paddingHorizontal: S.lg }}>"{motto}"</Text>
                )}
                <Touchable
                  onPress={isGuest ? () => router.push('/register') : openEditModal}
                  accessibilityRole="button"
                  accessibilityLabel={isGuest ? t.guest.keepMyData : (t.editProfile || 'Edit Profile')}
                  style={[styles.editBtn, { backgroundColor: theme.primary, paddingVertical: S.sm }]}
                >
                    <Text style={[styles.editBtnText, { color: theme.onPrimary, fontWeight: '700', fontSize: F.caption }]}>{isGuest ? t.guest.keepMyData : (t.editProfile || 'Edit Profile')}</Text>
                </Touchable>
            </View>
          </View>

          {/* İLERLEME — istatistik + başarılar + seri kalkanı TEK kartta (bkz. ProgressCard). */}
          {(() => {
            const allIds = ['streak_3','streak_7','streak_14','streak_30','streak_100','momentum_50','momentum_75','momentum_90','momentum_100','focus_first','focus_5h','focus_25h','first_task','daily_perfect'];
            const earned = allIds.filter(id => unlockedAchievements.includes(id));
            // En son kazanılan önde: gururlanılacak şey o AN kazanılan.
            const preview = [...earned].sort((a, b) => (achievementsUnlockedAt[b] ?? 0) - (achievementsUnlockedAt[a] ?? 0)).slice(0, 4);
            return (
              <ProgressCard
                lang={language === 'en' ? 'en' : 'tr'}
                stats={{ focusHours: stats.totalFocusHours, tasks: stats.completedTasksCount, bestStreak: displayBestStreak }}
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
          <View style={[styles.settingsSection, { marginTop: S.lg }]}>
            <SectionHeader title={language === 'tr' ? 'AYARLAR' : 'SETTINGS'} theme={theme} tr={language === 'tr'} />
            <SettingsCard theme={theme} isDark={isDark}>
              <SettingItem
                icon={<Bell size={ICON.md} color="#FFFFFF" />}
                bg={A.notify}
                label={language === 'tr' ? 'Bildirimler' : 'Notifications'}
                sub={language === 'tr' ? 'Özetler, takvim, gizlilik' : 'Briefs, calendar, privacy'}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'notify' } })}
                theme={theme}
              />
              <RowDivider theme={theme} />
              <SettingItem
                icon={<Palette size={ICON.md} color="#FFFFFF" />}
                bg={A.system}
                label={language === 'tr' ? 'Görünüm & Dil' : 'Appearance & Language'}
                sub={language === 'tr' ? 'Tema, renk, dil, ses' : 'Theme, color, language, sound'}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'system' } })}
                theme={theme}
              />
              <RowDivider theme={theme} />
              <SettingItem
                icon={<HeartPulse size={ICON.md} color="#FFFFFF" />}
                bg={A.health}
                label={language === 'tr' ? 'Uyku & Sağlık' : 'Sleep & Health'}
                sub={`${healthSourceName(language)}, ${language === 'tr' ? 'uyku hedefi' : 'sleep goal'}`}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'health' } })}
                theme={theme}
              />
              <RowDivider theme={theme} />
              <SettingItem
                icon={<ShieldCheck size={ICON.md} color="#FFFFFF" />}
                bg={A.legal}
                label={language === 'tr' ? 'Hesap, Yasal & Destek' : 'Account, Legal & Support'}
                sub={language === 'tr' ? 'Gizlilik, koşullar, çıkış, destek' : 'Privacy, terms, logout, support'}
                onPress={() => router.push({ pathname: '/settings', params: { section: 'legal' } })}
                theme={theme}
              />
              {/*
                ÖDEMELER — bir AYAR değil, bir ÖZELLİK; yine de bu listenin dışında
                gerçek bir giriş noktası yoktu (eski yer: /settings'in kapsamsız
                görünümü — ulaşılamaz çıktı, bkz. app/settings.tsx'teki not). Buradaki
                dört kategori satırı Profil'den TEK tıkla erişilen ŞEY bu; en doğal yer.
                `/odemeler`e DİREKT gider — settings.tsx'in section mantığına girmez.
              */}
              <RowDivider theme={theme} />
              <SettingItem
                icon={<Wallet size={ICON.md} color="#FFFFFF" />}
                bg={A.payments}
                label={language === 'tr' ? 'Ödemeler' : 'Payments'}
                sub={language === 'tr' ? 'Faturalar ve ödeme hatırlatıcıları' : 'Bills and payment reminders'}
                onPress={() => router.push('/odemeler')}
                theme={theme}
              />
            </SettingsCard>
          </View>
        </ScrollView>
      </View>

      {/* Hesap Silme Onayı — "SİL" yazdıran, parolasız (Google/Apple) kullanıcılar dahil */}

      {/* Şifre Değiştir */}

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="none" onShow={() => editSlideIn()}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Touchable style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'} />
              <Animated.View style={[editSlide, styles.modalContent, { maxHeight: sheetMaxHeight(height, insets.top) }]}>
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
                  {/* Name input */}
                  <View style={{ width: '100%', marginBottom: S.md }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>
                      {upperFor(t.editName || 'Display Name', language)}
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
                      {upperFor(language === 'tr' ? 'Cinsiyet' : 'Gender', language)}
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
                              // ZATEN SEÇİLİYSE DOKUNMA — aksi halde kullanıcının seçtiği
                              // avatarı (ör. 'm5'), aynı cinsiyete yeniden dokununca
                              // sessizce cinsiyet varsayılanına ('m1') sıfırlıyordu.
                              if (isSelected) return;
                              haptic.select();
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
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>{upperFor('Avatar', language)}</Text>
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
                            onPress={() => { haptic.select(); setSelectedAvatar(config.key); }}
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
                              fontSize: F.caption, fontWeight: '700', letterSpacing: 0.3,
                              color: isSelected ? theme.primary : theme.onSurfaceVariant,
                              opacity: isSelected ? 1 : 0.5,
                            }}>
                              {upperFor(config.name, language)}
                            </Text>
                          </Touchable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Çerçeve ve renk artık TEK yerde: Ayarlar → Görünüm (bkz. AccentPicker). */}
                  {/* Motto */}
                  <View style={{ width: '100%', marginBottom: S.lg }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>
                      {upperFor(language === 'tr' ? 'Kişisel Motto' : 'Personal Motto', language)}
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
                      {upperFor(language === 'tr' ? 'En Verimli Olduğun Zaman' : 'Peak Productivity Time', language)}
                    </Text>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, marginBottom: S.sm }}>
                      {productivityHint(newProductivityHour, language === 'tr' ? 'tr' : 'en')}
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
                            onPress={() => { haptic.select(); setNewProductivityHour(opt.key); }}
                            style={{ flex: 1, alignItems: 'center', gap: S.sm, paddingVertical: S.sm, borderRadius: R.md, borderWidth: B.thin, borderColor: sel ? theme.primary + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), backgroundColor: sel ? theme.primary + '15' : 'transparent' }}
                          >
                            {opt.icon(itemColor)}
                            <Text style={{ fontSize: 10, fontWeight: '700', color: itemColor }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text>
                            <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{opt.hint}</Text>
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
                      /*
                        Koyu temada theme.primary PARLAK bir mavi (onPrimary bilerek koyu) —
                        sabit beyaz yazı orada düşük kontrastta kalırdı. Hemen üstündeki
                        "Düzenle" düğmesi zaten theme.onPrimary kullanıyordu; ikisi tutarsızdı.
                      */
                      ? <ActivityIndicator color={theme.onPrimary} />
                      : <Text style={{ color: theme.onPrimary, fontWeight: '700', fontSize: F.body }}>{t.save}</Text>
                    }
                  </Touchable>
                </View>
              </Animated.View>
        </KeyboardAvoidingView>
        <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
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
  editBtnText: { fontWeight: '700' },  // renk kullanım yerinde theme.onPrimary ile verilir
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderRadius: R.sheet, paddingTop: S.sm, overflow: 'hidden' },
  modalHandle: { width: 40, height: 4, borderRadius: R.sm, alignSelf: 'center', marginBottom: S.md },
  modalTitle: { fontWeight: '700', marginBottom: S.lg, textAlign: 'center', paddingHorizontal: S.lg },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  inputGroup: { borderRadius: R.md, paddingHorizontal: S.md, height: 48, justifyContent: 'center' },
  nameInput: { fontSize: F.body, fontWeight: '600' },
  goalChip: { flex: 1, paddingVertical: S.sm, borderRadius: R.md, alignItems: 'center' },
  saveBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
});


export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
