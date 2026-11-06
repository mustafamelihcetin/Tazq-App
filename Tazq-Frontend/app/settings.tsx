import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PRODUCTIVITY_HOURS } from '@/shared/utils/productivityHour';
import { settingsText } from '@/shared/constants/settingsCopy';
import type { AppTheme } from '@/shared/constants/Colors';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Modal, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Keyboard, Linking, Animated, TouchableWithoutFeedback } from 'react-native';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { track } from '@/shared/utils/analytics';
import { confirmUiMode } from '@/features/modes/utils/uiModeSwitch';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceOnlyNote } from '@/shared/components/DeviceOnlyNote';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { MotiView } from 'moti';
import { Bell, Moon, Languages, LogOut, Download, Upload, ChevronRight, Target, Trophy, Shield, CalendarDays, Star, Volume2, Sunrise, Sun, Sunset, Trash2, FileText, MessageSquare, Send, Lock, Eye, EyeOff, ArrowLeft, Vibrate, Footprints, UserPlus, MailCheck, Sparkles, CalendarRange, SunMoon, Leaf, ShieldCheck } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { AuthService, FocusService } from '@/shared/services/api';
import { SleepHealth } from '@/shared/services/sleepHealth';
import { ActivityHealth } from '@/shared/services/activityHealth';
import { SupportModal } from '@/shared/components/SupportModal';
import { useAuthStore, getAvatarSource, AVATAR_CONFIGS, AVATAR_MAP, useAchievementStore, ACHIEVEMENTS } from '@/features/user';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusStore } from '@/features/focus';
// Yerel Haptics shim KALDIRILDI — `.catch()` sarmalama artik
// shared/utils/haptics.ts icinde, anlamsal API ile birlikte tek yerde.
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { swallow } from '@/shared/utils/swallow';
import { rescheduleAllTaskNotifications } from '@/shared/utils/notifications';
import { requestNotificationPermissions, getNotificationPermissionStatus, cancelWeeklySummary, cancelMorningBrief, cancelEveningBrief } from '@/shared/utils/notifications';
import { requestCalendarPermissions, bulkExportTasksToCalendar } from '@/shared/utils/calendarSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ICON, S, R, F, B, W, MAX_W, MIN_TOUCH, trackingFor , topBarSpace, SCRIM } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useToastStore } from '@/shared/store/useToastStore';
import { healthSourceName } from '@/shared/utils/healthSource';
import { Asset } from 'expo-asset';
import { usePrefsStore } from '@/features/modes';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { useTaskStore } from '@/features/tasks';
import { renderAchievementIcon, ACHIEVEMENT_ICONS } from '@/shared/utils/achievementIcons';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { DeleteAccountModal } from '@/features/user/components/DeleteAccountModal';
import { httpDataOf } from '@/shared/utils/errors';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { SettingsCard, SettingItem, ToggleRow, RowDivider, SettingsActionRow, ChoiceRow, settingsAccents } from '@/shared/components/SettingsRows';
import { AppIcon } from '@/shared/components/AppIcon';
import { haptic } from '@/shared/utils/haptics';
import { canStaff, isAnalystOnly } from '@/shared/utils/staffRoles';
import { SplashAdminCard } from '@/features/admin/components/SplashAdminCard';
import { AccentPicker } from '@/features/user/components/AccentPicker';
import { goHome } from '@/shared/utils/authNavigation';
import { startDataExport } from '@/shared/utils/startDataExport';
import { startBackupRestore } from '@/features/user/utils/applyRestore';

/**
 * Ayarlar sayfası — profil'den AYRILDI. İçerik profile.tsx'ten BYTE-BYTE çıkarıldı;
 * hesap-silme ve parola-değiştirme mantığı/modalları birebir korundu.
 */
export default function SettingsScreen() {
  const { theme, colorScheme, setTheme, currentSetting } = useAppTheme();
  const { user, setUser, logout } = useAuthStore();
  const isGuest = useSessionStore(s => s.isGuest);
  const { t, language, setLanguage } = useLanguageStore();
  const router = useRouter();
  // Bölüme kaydırma: profil gruplu satırları ?section=<domain> ile gelir; ilgili
  // bölümün ölçülen y'sine atlarız. Böylece "her satır tüm sayfayı açıyor" biter.
  const scrollRef = useRef<ScrollView>(null);
  const { scrollY, onScroll } = useCollapsibleHeader();
  const sectionY = useRef<Record<string, number>>({});
  const mountedAt = useRef(Date.now());
  const { section, support } = useLocalSearchParams<{ section?: string; support?: string }>();
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
  const KNOWN = ['notify', 'system', 'health', 'legal'];
  // Bilinmeyen anahtar (eski bağlantı, yazım hatası) BOŞ sayfa açıyordu → hepsini göster.
  const show = (cat: string) => !section || !KNOWN.includes(section as string) || section === cat;
  const catTitle =
    section === 'notify' ? (settingsText(language).notifications)
    : section === 'system' ? (settingsText(language).appearanceLanguage)
    : section === 'health' ? (settingsText(language).sleepHealth)
    // Profildeki satırla aynı ad: başlık çubuğuna sığar (360 dp'de uzun ad kesiliyordu), ayrıntıyı satırın alt yazısı söyler.
    : section === 'legal' ? (settingsText(language).accountSupport)
    : (settingsText(language).settings);
  const { show: showToast } = useToastStore();
  const insets = useSafeAreaInsets();
  /* Tablette içerik 600pt'lik şeride sıkışmasın — üç kademeli genişlik. */
  const contentW = useContentMaxWidth();
  const bestStreak = useFocusStore(s => s.bestStreak);
  const streakFreezeAvailable = useFocusStore(s => s.streakFreezeAvailable);
  const dailyGoalMinutes = useFocusStore(s => s.dailyGoalMinutes);
  const setDailyGoal = useFocusStore(s => s.setDailyGoal);
  const updateBestStreak = useFocusStore(s => s.updateBestStreak);
  const checkStreakFreezeReset = useFocusStore(s => s.checkStreakFreezeReset);
  const { tasks } = useTaskStore();
  const { weeklyNotification, setWeeklyNotification, morningBrief, setMorningBrief, eveningBrief, setEveningBrief, soundEffects, setSoundEffects, hapticFeedback, setHapticFeedback, motto, setMotto, productivityHour, setProductivityHour, avatarBorderColor, setAvatarBorderColor, uiMode, setUiMode, gender, setGender, sleepHealthOptIn, setSleepHealthOptIn, sleepGoalHours, setSleepGoalHours, hideNotificationContent, setHideNotificationContent, activityHealthOptIn, setActivityHealthOptIn } = usePrefsStore();
  const [sleepSupported] = useState(() => SleepHealth.isSupported());
  const { unlocked: unlockedAchievements } = useAchievementStore();
  const isDark = colorScheme === 'dark';
  const A = settingsAccents(theme);
  // Gelen kutusundaki "destekten yanıt" satırı buraya `support=1` ile gelir: konuşma doğrudan açılır.
  const [supportModalVisible, setSupportModalVisible] = useState(support === '1');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [calendarSync, setCalendarSync] = useState(false);
  // Ortak hook (bkz. useKeyboardHeight).
  const kbHeight = useKeyboardHeight();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    checkStreakFreezeReset();
  }, []);

  /*
    ── EKRAN GERÇEK DURUMU OKUMAK ZORUNDA ──────────────────────────────────────
    İki anahtar da yalnız YAZILIYOR, hiç OKUNMUYORDU:

     · Bildirim izni `useState(false)` ile başlıyordu; izin verilmiş olsa bile ekran
       her açılışta "Kapalı" diyordu.
     · Takvim eşitlemesi `tazq_calendar_sync_enabled` anahtarına yazıyor ama geri
       yükleme effect'i profil ekranında kalmıştı. Sonuç yalnız yanlış bir etiket
       değil: kullanıcı "kapalı" gördüğü anahtarı açınca `bulkExportTasksToCalendar`
       yeniden çalışıyor ve görevler takvime İKİNCİ KEZ yazılıyordu.

    Bir ayar ekranının ilk görevi, o ayarın gerçekte ne olduğunu doğru söylemektir.
    Odaklanıldığında yeniden okunuyor: kullanıcı sistem ayarlarından izni değiştirip
    geri dönebilir.
  */
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getNotificationPermissionStatus().then((st) => { if (alive) setNotifEnabled(st === 'granted'); });
      AsyncStorage.getItem('tazq_calendar_sync_enabled')
        .then((v) => { if (alive) setCalendarSync(v === 'true'); })
        .catch((e) => swallow('settings.readCalendarSyncFlag', e));
      return () => { alive = false; };
    }, []),
  );


  /*
    Sabah özetinin GERÇEK saati — verimlilik saatinden türer, sabit değil. Tek yerde
    hesaplanıyor ki etiketle davranış bir daha ayrışmasın (bkz. PRODUCTIVITY_HOUR).
  */
  const briefHourLabel = (() => {
    const h = PRODUCTIVITY_HOURS[productivityHour as keyof typeof PRODUCTIVITY_HOURS]?.brief ?? 8;
    return settingsText(language).dailyPlanAt(`${String(h).padStart(2, '0')}:00`);
  })();

  /*
    ── GİZLİLİK AYARI GEÇMİŞE DE UYGULANIR ──────────────────────────────────────
    Bu anahtar yalnız BUNDAN SONRA kurulacak bildirimleri etkiliyordu: kullanıcı
    "içeriği gizle" diyor ama zaten zamanlanmış hatırlatıcıları görev adını kilit
    ekranında göstermeye devam ediyordu. Bir gizlilik ayarının en çok beklendiği an
    tam da açıldığı andır.

    Zamanlanmış bir bildirimin içeriği değiştirilemez; tek yol iptal edip yeniden
    kurmak. Sonucu kullanıcıya da söylüyoruz — sessizce yapılan bir gizlilik işlemi,
    yapılmamışla aynı güveni verir.
  */
  const applyHideNotificationContent = async (v: boolean) => {
    haptic.select();
    setHideNotificationContent(v);
    const n = await rescheduleAllTaskNotifications(tasks, language, v);
    if (n > 0) {
      showToast(
        language === 'tr' ? `${n} hatırlatıcı bu ayara göre yenilendi` : `${n} reminders updated to match`,
        'success',
      );
    }
  };

  const handleSleepToggle = async (v: boolean) => {
    haptic.select();
    if (v) {
      const ok = await SleepHealth.requestAuthorization();
      setSleepHealthOptIn(ok ? 'yes' : 'no');
      // İki dil yan yana: dörde bölünmüş dallanma yerine tek karar (bkz. i18nRatchet).
      const msg = language === 'tr'
        ? { ok: 'Uyku takibi açık — sabahları otomatik işaretlenir', no: 'Sağlık izni verilmedi' }
        : { ok: 'Sleep tracking on — auto-marked each morning', no: 'Health permission not granted' };
      showToast(ok ? msg.ok : msg.no, ok ? 'success' : 'info');
    } else {
      setSleepHealthOptIn('no');
    }
  };
  /**
   * Hareket izni UYKUDAN AYRI isteniyor.
   *
   * Tek anahtar olsaydı, uykusunu paylaşmaya razı olan kullanıcı koşularını da paylaşmak
   * zorunda kalırdı. Platformlar da izinleri ayrı veriyor: burada "hayır" demek uykuyu
   * bozmaz, tersi de geçerli.
   */
  const handleActivityToggle = async (v: boolean) => {
    haptic.select();
    if (v) {
      const ok = await ActivityHealth.requestAuthorization();
      setActivityHealthOptIn(ok ? 'yes' : 'no');
      const msg = language === 'tr'
        ? { ok: 'Hareket takibi açık — yürüyüş ve koşu görevlerin otomatik işaretlenir', no: 'Sağlık izni verilmedi' }
        : { ok: 'Activity tracking on — walking and running tasks auto-complete', no: 'Health permission not granted' };
      showToast(ok ? msg.ok : msg.no, ok ? 'success' : 'info');
    } else {
      setActivityHealthOptIn('no');
    }
  };

  const cycleSleepGoal = () => { haptic.select(); setSleepGoalHours(sleepGoalHours >= 9 ? 6 : sleepGoalHours + 1); };

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
      // Bekleyen alışkanlık değişikliği önce gönderilir (en çok 3 sn) — sonra yerel veri silinir.
      { text: t.yes, style: "destructive", onPress: async () => {
        await require('@/features/habits/sync/habitsSync').flushHabitsSync(user?.id);
        logout(); router.replace('/login');
      }}
    ]);
  };

  const openDeleteAccount = () => {
    haptic.commit();
    setDeleteModalVisible(true);
  };

  const openChangePassword = () => {
    haptic.surface();
    setCurPw(''); setNewPw(''); setConfPw(''); setShowPw(false); setPwError(null);
    setPwModalVisible(true);
  };

  const performChangePassword = async () => {
    if (changingPw) return;
    setPwError(null);
    if (!curPw) { setPwError(settingsText(language).enterYourCurrentPassword); return; }
    if (!(newPw.length >= 8 && /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(newPw) && /[0-9]/.test(newPw))) { setPwError(settingsText(language).passwordMustBeAtLeast8); return; }
    if (newPw !== confPw) { setPwError(settingsText(language).newPasswordsDoNotMatch); return; }
    setChangingPw(true);
    try {
      await AuthService.changePassword(curPw, newPw);
      haptic.success();
      Keyboard.dismiss();
      setPwModalVisible(false);
      showToast(settingsText(language).passwordUpdated, 'success');
    } catch (err: unknown) {
      haptic.error();
      const msg = httpDataOf<{ message?: string }>(err).message;
      setPwError(msg || (settingsText(language).couldNotChangePassword));
    } finally {
      setChangingPw(false);
    }
  };



  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Ortak başlık — ana ekranlarla aynı sistem. Kendi satırı 22pt başlık
          kullanıyordu: alt sayfaya inince başlık BÜYÜYORDU (hiyerarşi ters). */}
      <ScreenHeader onBack={() => router.back()} title={catTitle} scrollY={scrollY} />

      <Animated.ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} onContentSizeChange={tryScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xl, width: '100%', maxWidth: contentW, alignSelf: 'center' }}>
            {/*
              ÖDEMELER BURADAN KALDIRILDI (2026-10-19) — bu ekranın `/settings` yolu
              HER ZAMAN bir `section` parametresiyle çağrılıyor (Profil'deki 4 kategori
              satırı, bkz. app/profile.tsx). Kapsamsız (`!section`) tam sayfa görünümü
              UYGULAMANIN HİÇBİR YERİNDEN linklenmiyor — yani buraya konan her şey
              fiilen ulaşılamaz. Gerçek giriş noktası artık Profil ekranındaki
              "AYARLAR" listesinin 5. satırı (bkz. o dosyadaki not).
            */}
            {show('notify') && (<>
            {/* ── BİLDİRİMLER ── */}
            <View onLayout={e => markSection('notify', e.nativeEvent.layout.y)} />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<Bell size={ICON.md} color="#FFFFFF" />}
                    label={t.notifications}
                    sub={settingsText(language).systemPermission}
                    bg={A.notify}
                    value={notifEnabled ? t.notificationsEnabled : t.notificationsDisabled}
                    onPress={toggleNotifications}
                    theme={theme}
                />
                <RowDivider theme={theme} />
                {/* Sade modda özet gelmez: işe yaramayan anahtar gösterilmez. */}
                {uiMode !== 'lite' && <>
                <ToggleRow
                    icon={<Sunrise size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={settingsText(language).morningBrief}
                    /*
                      SAAT SABİT DEĞİL — kullanıcının verimlilik saatinden geliyor
                      (bkz. notifications.ts → PRODUCTIVITY_HOUR). Etiket 'Her sabah 08:00'
                      diyordu ve bu HİÇBİR durumda doğru değildi: varsayılanda 07:00,
                      'akşam' seçen kullanıcıda 17:00 — yani Sabah Özeti akşam geliyordu.
                    */
                    subtitle={briefHourLabel}
                    disabled={!notifEnabled}
                    value={morningBrief}
                    onValueChange={(v: boolean) => { haptic.select(); setMorningBrief(v); if (!v) cancelMorningBrief(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                <ToggleRow
                    icon={<Sunset size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={settingsText(language).eveningBrief}
                    subtitle={settingsText(language).eachEveningAt2100Day}
                    disabled={!notifEnabled}
                    value={eveningBrief}
                    onValueChange={(v: boolean) => { haptic.select(); setEveningBrief(v); if (!v) cancelEveningBrief(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                <ToggleRow
                    icon={<CalendarRange size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={settingsText(language).weeklySummary}
                    subtitle={settingsText(language).momentumRecapOnSundayEvening}
                    disabled={!notifEnabled}
                    value={weeklyNotification}
                    onValueChange={(v: boolean) => { haptic.select(); setWeeklyNotification(v); if (!v) cancelWeeklySummary(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                </>}
                <ToggleRow
                    icon={<CalendarDays size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={settingsText(language).calendarSync}
                    subtitle={settingsText(language).syncsTasksToSystemCalendar}
                    value={calendarSync}
                    onValueChange={toggleCalendarSync}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                {/*
                  MAHREMİYET — bildirim kilit ekranında çıkıyor ve gövdesinde görev adı
                  duruyor; yanındaki herkes okuyabiliyor. Kullanıcı o metni kendisi için
                  yazmıştı ("Doktor: test sonucu", "Ayrılık konuşması"…).

                  Bunu bir içerik SÜZGECİYLE çözmek yanlış olurdu: metin kullanıcının
                  kendi cihazında kendisine gösteriliyor, kimseyi rahatsız etmiyor.
                  Doğru olan kararı kullanıcıya bırakmak.
                */}
                <ToggleRow
                    icon={<EyeOff size={ICON.md} color="#FFFFFF" />}
                    bg={A.notify}
                    title={settingsText(language).hideContentInNotifications}
                    subtitle={language === 'tr'
                      ? 'Kilit ekranında görev adı yerine genel bir metin görünür'
                      : 'Shows a generic message instead of the task name'}
                    value={hideNotificationContent}
                    onValueChange={applyHideNotificationContent}
                    theme={theme} isDark={isDark}
                />
            </SettingsCard>

            </>)}
            {show('system') && (<>
            {/* ── GÖRÜNÜM & DİL (2026-10-31 düzeni): GÖRÜNÜM = ekran nasıl görünür (tema, renk, dil);
                 DENEYİM = uygulama nasıl davranır (ses, titreşim, sade mod). Bildirim gizliliği
                 Bildirimler'e, odak puanı/seri kalkanı (ayar değil, ödül) Profil'e taşındı. ── */}
            <SectionHeader onLayout={e => markSection('system', e.nativeEvent.layout.y)} title={settingsText(language).appearance} theme={theme} tr={language === 'tr'}  />
            <SettingsCard theme={theme} isDark={isDark}>
                <ChoiceRow
                    icon={<SunMoon size={ICON.md} color="#FFFFFF" />}
                    label={t.appearance}
                    bg={A.system}
                    options={[{ key: 'system', label: t.themeSystem }, { key: 'light', label: t.themeLight }, { key: 'dark', label: t.themeDark }]}
                    value={currentSetting as 'system' | 'light' | 'dark'}
                    onChange={(k) => { haptic.select(); setTheme(k); }}
                    theme={theme}
                    isDark={isDark}
                />
                <RowDivider theme={theme} />
                {/* Vurgu rengi: ölçülü aileden, canlı önizlemeyle (bkz. AccentPicker, Colors.ts → AccentPalettes). */}
                <AccentPicker lang={language === 'en' ? 'en' : 'tr'} />
                <RowDivider theme={theme} />
                {/* Dil adı kendi dilinde yazılır (iOS/Android dil seçicilerinin kuralı). */}
                <ChoiceRow
                    icon={<Languages size={ICON.md} color="#FFFFFF" />}
                    label={t.language}
                    bg={A.system}
                    options={[{ key: 'tr', label: 'Türkçe' }, { key: 'en', label: 'English' }]}
                    value={language === 'tr' ? 'tr' : 'en'}
                    onChange={(k) => { haptic.select(); setLanguage(k); }}
                    theme={theme}
                    isDark={isDark}
                />
            </SettingsCard>

            {/* ── DENEYİM ── */}
            <SectionHeader title={settingsText(language).experience} theme={theme} tr={language === 'tr'} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
                <ToggleRow
                    icon={<Volume2 size={ICON.md} color="#FFFFFF" />}
                    bg={A.core}
                    title={settingsText(language).soundEffects}
                    subtitle={settingsText(language).taskTimerCompletionSounds}
                    value={soundEffects}
                    onValueChange={(v: boolean) => { haptic.select(); setSoundEffects(v); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                {/* Ses kapatılabiliyordu ama TİTREŞİM kapatılamıyordu — oysa uygulamada
                    ~293 titreşim çağrısı var (her 1.4 dokunmada bir). Titreşimden
                    rahatsız olan kullanıcının hiçbir çıkışı yoktu. */}
                <ToggleRow
                    icon={<Vibrate size={ICON.md} color="#FFFFFF" />}
                    bg={A.core}
                    title={settingsText(language).haptics}
                    subtitle={settingsText(language).tapAndActionFeedback}
                    value={hapticFeedback}
                    onValueChange={(v: boolean) => { setHapticFeedback(v); if (v) haptic.select(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider theme={theme} />
                <ToggleRow
                    icon={<Leaf size={ICON.md} color="#FFFFFF" />}
                    bg={A.core}
                    title={settingsText(language).liteMode}
                    /* Sekme seti de daralıyor: Modlar VE Haftalık gizleniyor (bkz. BottomNavBar
                       → LITE_TAB_IDS). Etiket yalnız 'modlar' diyordu; Haftalık Merkez'in
                       kaybolması sürpriz oluyordu. */
                    subtitle={settingsText(language).hidesMomentumCelebrationsGoalsWeekTabs}
                    value={uiMode === 'lite'}
                    onValueChange={(v: boolean) => { haptic.select(); confirmUiMode(v ? 'lite' : 'pro', language === 'en' ? 'en' : 'tr'); }}
                    theme={theme} isDark={isDark}
                />
            </SettingsCard>

            </>)}
            {show('health') && (<>
            {/* ── UYKU (Apple Sağlık) — yalnız desteklenen cihazda ── */}
            {sleepSupported && (
              <>
                <View onLayout={e => markSection('health', e.nativeEvent.layout.y)} />
                <SettingsCard theme={theme} isDark={isDark}>
                    <ToggleRow
                        icon={<Moon size={ICON.md} color="#FFFFFF" />}
                        bg={A.health}
                        title={language === 'tr' ? `${healthSourceName('tr')} ile Uyku` : `Sleep via ${healthSourceName('en')}`}
                        subtitle={settingsText(language).yourSleepHabitIsAutoMarked}
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
                            label={settingsText(language).sleepGoal}
                            sub={settingsText(language).celebratedWhenYouHitIt}
                            bg={A.health}
                            value={`${sleepGoalHours}${settingsText(language).h}`}
                            onPress={cycleSleepGoal}
                            theme={theme}
                        />
                      </>
                    )}

                    {/*
                      HAREKET — uykuyla AYNI kartta ama AYRI anahtar.

                      Aynı kartta çünkü ikisi de "telefonun zaten bildiği şeyi bir daha
                      sorma" vaadinin parçası; kullanıcı kafasında bunlar tek bir konu.
                      Ayrı anahtar çünkü hassasiyetleri farklı: uykusunu paylaşan biri
                      koşu rotalarını paylaşmak istemeyebilir ve platformlar da izinleri
                      zaten ayrı veriyor.
                    */}
                    <RowDivider theme={theme} />
                    <ToggleRow
                        icon={<Footprints size={ICON.md} color="#FFFFFF" />}
                        bg={A.health}
                        title={settingsText(language).activityWorkouts}
                        subtitle={settingsText(language).walkingRunningAndTrainingTasksAuto}
                        value={activityHealthOptIn === 'yes'}
                        onValueChange={handleActivityToggle}
                        theme={theme} isDark={isDark}
                    />
                </SettingsCard>
                <DeviceOnlyNote kind="health" language={language === 'en' ? 'en' : 'tr'} theme={theme} />
              </>
            )}

            
            </>)}
            {show('legal') && (<>
            {/* ── YASAL & GİZLİLİK ── */}
            <SectionHeader onLayout={e => markSection('legal', e.nativeEvent.layout.y)} title={t.legalAndPrivacy || (settingsText(language).legalPrivacy)} theme={theme} tr={language === 'tr'}  />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<FileText size={ICON.md} color="#FFFFFF" />}
                    label={t.termsOfService || (settingsText(language).termsOfService)}
                    bg={A.legal}
                    onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
                    theme={theme}
                />
                <RowDivider theme={theme} />
                <SettingItem
                    icon={<ShieldCheck size={ICON.md} color="#FFFFFF" />}
                    label={t.privacyPolicy || (settingsText(language).privacyPolicy)}
                    bg={A.legal}
                    onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
                    theme={theme}
                />
                <RowDivider theme={theme} />
                <SettingItem
                    icon={<MessageSquare size={ICON.md} color="#FFFFFF" />}
                    label={(t as any).support?.title || (settingsText(language).supportContact)}
                    sub={(t as any).support?.sub || (settingsText(language).sendQuestionsFeedback)}
                    bg={A.legal}
                    onPress={() => setSupportModalVisible(true)}
                    theme={theme}
                />
                <RowDivider theme={theme} />
                {/* Turlar: balon 10 sn'de kaybolur ve bir daha gelmez — tek geri dönüş yolu burası. */}
                <SettingItem
                    icon={<Sparkles size={ICON.md} color="#FFFFFF" />}
                    label={t.tourReplay.title}
                    sub={t.tourReplay.sub}
                    bg={A.legal}
                    onPress={() => { usePrefsStore.setState({ completedTours: {} }); showToast(t.tourReplay.done, 'success'); goHome(router); }}
                    theme={theme}
                />
            </SettingsCard>

            {/* Ham indigo hex yerine A.system — settingsAccents zaten AYNI
                indigo'yu tema-duyarlı veriyor (bkz. 'Görünüm & Dil' satırı); burada
                sabit hex yazmak iki ayrı kopya demekti. */}
            {canStaff(user?.role, 'staff') && (
              <Touchable
                onPress={() => router.push('/admin')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: A.system + (isDark ? '1F' : '14'), borderRadius: R.md, paddingVertical: S.md, paddingHorizontal: S.md, marginTop: S.xl, borderWidth: B.thin, borderColor: A.system + (isDark ? '40' : '26') }}
              >
                <Shield size={ICON.md} color={A.system} />
                <Text style={{ color: A.system, fontWeight: '700', fontSize: F.body, flex: 1 }}>
                  {isAnalystOnly(user?.role) ? (settingsText(language).analytics) : (settingsText(language).adminPanel)}
                </Text>
                <ChevronRight size={ICON.sm} color={A.system} />
              </Touchable>
            )}

            {/* Açılış ekranı yönetimi — YALNIZ süper admin; kullanıcı hiç görmez (bkz. SplashAdminCard). */}
            {canStaff(user?.role, 'super') && <SplashAdminCard lang={language === 'en' ? 'en' : 'tr'} />}

            {__DEV__ && ( /* Bileşen galerisi — release'de çizilmez (bkz. app/dev-gallery.tsx). */
              <Touchable
                onPress={() => router.push('/dev-gallery')}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.md, paddingHorizontal: S.md, marginTop: S.sm }}
              >
                <Text style={{ color: theme.onSurfaceMuted, fontSize: F.footnote, flex: 1 }}>Bileşen galerisi (dev)</Text>
                <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
              </Touchable>
            )}

            {/*
              ── HESAP — TEK GRUPLU DİL (2026-10-25, cihazda görüldü) ───────────────────
              Bu bölüm sayfanın geri kalanıyla aynı dili konuşmuyordu: sarı uyarı kutusu,
              gri kutu (şifre), koyu gri büyük düğme (çıkış), iki çıplak metin (indir, sil)
              — dört ayrı stil, alt alta. iOS Ayarlar / M3 deseni: hesap eylemleri gruplu
              kartta ikonlu satırlar; çıkış ve silme KENDİ küçük gruplarında ortalanmış satır.

              E-POSTA DOĞRULAMA engel değil HATIRLATMA: özet e-postaları ve şifre sıfırlama o
              adrese dayanıyor. Uyarı tonu ikon çipinde (notify), satırın kendisi sakin.

              VERİ TAŞINABİLİRLİĞİ silmenin üstünde, bilinçli: hesabını silmeye giden
              kullanıcı verisini yanına alabileceğini tam o anda görmeli (KVKK/GDPR).
            */}
            <SectionHeader title={settingsText(language).account} theme={theme} tr={language === 'tr'} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
              {user && (user as any).isEmailVerified === false && (<>
                <SettingItem
                  icon={<MailCheck size={ICON.md} color="#FFFFFF" />}
                  label={t.verifyEmail.rowTitle}
                  sub={t.verifyEmail.rowSub}
                  bg={A.legal}
                  onPress={() => router.push({ pathname: '/verify-email', params: { email: user.email } })}
                  theme={theme}
                />
                <RowDivider theme={theme} />
              </>)}
              {(user as any)?.hasPassword && (<>
                <SettingItem
                  icon={<Lock size={ICON.md} color="#FFFFFF" />}
                  label={settingsText(language).changePassword}
                  bg={A.legal}
                  onPress={openChangePassword}
                  theme={theme}
                />
                <RowDivider theme={theme} />
              </>)}
              <SettingItem
                icon={<Download size={ICON.md} color="#FFFFFF" />}
                label={settingsText(language).downloadMyData}
                sub={exporting ? (settingsText(language).preparing) : (settingsText(language).aCopyOfAllYourRecords)}
                bg={A.legal}
                right={exporting ? <ActivityIndicator size="small" color={theme.onSurfaceVariant} /> : undefined}
                onPress={exporting ? undefined : () => {
                  // Biçim seçimi (madde 8): okunabilir özet ya da tam ayrıntılı JSON. Akış ortak (bkz. startDataExport).
                  startDataExport({ copy: t.exportFormat, onBusy: setExporting });
                }}
                theme={theme}
              />
              <RowDivider theme={theme} />
              <SettingItem
                icon={<Upload size={ICON.md} color="#FFFFFF" />}
                label={settingsText(language).restoreRow}
                sub={restoring ? settingsText(language).restoreBusy : settingsText(language).restoreRowSub}
                bg={A.legal}
                right={restoring ? <ActivityIndicator size="small" color={theme.onSurfaceVariant} /> : undefined}
                onPress={restoring ? undefined : () => {
                  void startBackupRestore({
                    copy: settingsText(language),
                    onBusy: setRestoring,
                    toast: (text, failed) => showToast(text, failed ? 'error' : 'success'),
                  });
                }}
                theme={theme}
              />
            </SettingsCard>

            {/*
              MİSAFİRE ÇIKIŞ DEĞİL, HESAP OLUŞTURMA — çıkacak hesap yok; ihtiyacı olan verisini
              kalıcı kılmak. Sayfanın TEK dolu düğmesi bu: misafir için asıl eylem.
              ÇIKIŞ nötr (rutin, geri alınabilir); SİLME kırmızı (kalıcı) — renk = tehlike seviyesi.
            */}
            {isGuest ? (
              <Touchable
                // Titreşim YOK: bu saf gezinme, bir işlem sonucu değil (bkz. haptics.test.ts).
                onPress={() => router.push('/register')}
                accessibilityRole="button"
                accessibilityLabel={t.guest.keepMyData}
                accessibilityHint={t.guest.settingsSub}
                style={[styles.logoutBtn, { backgroundColor: theme.primaryFill, marginTop: S.lg, paddingVertical: S.md, paddingHorizontal: S.md }]}
              >
                <UserPlus size={ICON.md} color={theme.onPrimaryFill} />
                <Text style={[styles.logoutText, { color: theme.onPrimaryFill, fontSize: F.body }]}>{t.guest.keepMyData}</Text>
              </Touchable>
            ) : (
              <SettingsCard theme={theme} isDark={isDark} style={{ marginTop: S.lg }}>
                <SettingsActionRow label={t.logout} onPress={handleLogout} theme={theme} />
              </SettingsCard>
            )}

            {/*
              MİSAFİRDE SİLİNECEK HESAP YOK — sahip olduğu şey CİHAZDAKİ veri: onu silmenin
              yolu yerel temizlik + çıkış. Asıl sürtünme onay modalında (yazarak doğrulama).
            */}
            <SettingsCard theme={theme} isDark={isDark} style={{ marginTop: S.md }}>
              <SettingsActionRow
                destructive
                label={isGuest ? t.guest.eraseLocal : (t.deleteAccount || (settingsText(language).deleteAccount))}
                onPress={isGuest
                  ? () => Alert.alert(t.guest.eraseLocalTitle, t.guest.eraseLocalBody, [
                      { text: t.cancel, style: 'cancel' },
                      { text: t.guest.eraseLocalConfirm, style: 'destructive', onPress: () => { logout(); router.replace('/login'); } },
                    ])
                  : openDeleteAccount}
                theme={theme}
              />
            </SettingsCard>
            </>)}
      </Animated.ScrollView>

      {/* Ayarlar bir SEKME değil (profilden push edilir, 2 kademe derin) → alt tab-bar
          "hiçbir sekme aktif değil" halinde görünüyordu. iOS deseni: geri butonu + tam ekran. */}

      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onDeleted={() => { setDeleteModalVisible(false); logout(); router.replace('/login'); }}
        theme={theme}
        isDark={isDark}
        language={language}
        kbHeight={kbHeight}
        insetTop={insets.top}
        insetBottom={insets.bottom}
      />
      <Modal supportedOrientations={['portrait', 'landscape']} visible={pwModalVisible} transparent animationType="fade" onRequestClose={() => { if (!changingPw) setPwModalVisible(false); }}>
        <View style={{ flex: 1, backgroundColor: SCRIM, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: S.lg, paddingTop: insets.top + S.lg, paddingBottom: (kbHeight > 0 ? kbHeight : insets.bottom) + S.lg }}>
          <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { if (!changingPw) { Keyboard.dismiss(); setPwModalVisible(false); } }} accessibilityRole="button" accessibilityLabel={settingsText(language).close} />
          <MotiView
            from={{ opacity: 0, scale: 0.96, translateY: 16 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={{ width: '100%', maxWidth: 420, borderRadius: R.sheet, padding: S.lg, gap: S.md }}
          >
            <GlassSurface radius={R.sheet} />
            <AppIcon Icon={Lock} color={theme.primary} size={52} radius={R.full} iconSize={ICON.lg} />
            <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, textAlign: 'center', letterSpacing: -0.3 }}>
              {settingsText(language).changePassword}
            </Text>

            {[
              { val: curPw, set: setCurPw, ph: settingsText(language).currentPassword, eye: false },
              { val: newPw, set: setNewPw, ph: settingsText(language).newPassword8CharsLetterNumber, eye: true },
              { val: confPw, set: setConfPw, ph: settingsText(language).confirmNewPassword, eye: false },
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
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPw ? (settingsText(language).hidePassword) : (settingsText(language).showPassword)} onPress={() => setShowPw((s) => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {showPw ? <EyeOff size={ICON.md} color={theme.onSurfaceVariant} /> : <Eye size={ICON.md} color={theme.onSurfaceVariant} />}
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {pwError && <Text style={{ color: theme.error, textAlign: 'center', fontSize: F.caption + 1, fontWeight: '600' }}>{pwError}</Text>}

            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xxs }}>
              <Touchable onPress={() => { if (!changingPw) { Keyboard.dismiss(); setPwModalVisible(false); } }} style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', alignItems: 'center' }}>
                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{settingsText(language).cancel}</Text>
              </Touchable>
              <Touchable onPress={performChangePassword} disabled={changingPw} style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: theme.primaryFill, alignItems: 'center', justifyContent: 'center', opacity: changingPw ? 0.6 : 1 }}>
                {changingPw ? <ActivityIndicator size="small" color={theme.onPrimaryFill} /> : <Text style={{ color: theme.onPrimaryFill, fontWeight: '700', fontSize: F.body }}>{settingsText(language).save}</Text>}
              </Touchable>
            </View>
          </MotiView>
        </View>
        <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
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
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
