import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Modal, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Keyboard, Linking, Animated, Switch } from 'react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useUiDepth } from '@/shared/hooks/useUiDepth';
import { track } from '@/shared/utils/analytics';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, Languages, LogOut, ChevronRight, Zap, Target, Trophy, Shield, CalendarDays, Star, Volume2, Sunrise, Sun, Sunset, Trash2, FileText, MessageSquare, Send } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { AuthService, FocusService } from '@/shared/services/api';
import { SupportModal } from '@/shared/components/SupportModal';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { useAuthStore, getAvatarSource, AVATAR_CONFIGS, AVATAR_MAP, useAchievementStore, ACHIEVEMENTS } from '@/features/user';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useFocusStore } from '@/features/focus';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { requestNotificationPermissions, cancelWeeklySummary, cancelMorningBrief, cancelEveningBrief } from '@/shared/utils/notifications';
import { requestCalendarPermissions, bulkExportTasksToCalendar } from '@/shared/utils/calendarSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { S, R, F, B, MAX_W } from '@/shared/constants/tokens';
import { useToastStore } from '@/shared/store/useToastStore';
import { Asset } from 'expo-asset';
import { usePrefsStore } from '@/features/modes';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useTaskStore } from '@/features/tasks';
import { renderAchievementIcon, ACHIEVEMENT_ICONS } from '@/shared/utils/achievementIcons';
import { Touchable } from '@/shared/components/Touchable';
import { DottedBackground } from '@/shared/components/DottedBackground';

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
  const { show: showToast } = useToastStore();
  const insets = useSafeAreaInsets();

  const { bestStreak, streakFreezeAvailable, useStreakFreeze, dailyGoalMinutes, setDailyGoal, updateBestStreak, checkStreakFreezeReset, focusPoints, streakShields } = useFocusStore();
  const { habits, toggleDate } = useHabitStore();
  const { tasks } = useTaskStore();
  const { weeklyNotification, setWeeklyNotification, morningBrief, setMorningBrief, eveningBrief, setEveningBrief, soundEffects, setSoundEffects, motto, setMotto, productivityHour, setProductivityHour, avatarBorderColor, setAvatarBorderColor, uiMode, setUiMode } = usePrefsStore();
  const { unlocked: unlockedAchievements } = useAchievementStore();

  const [editModalVisible, setEditModalVisible] = useState(false);
  useUiDepth(editModalVisible);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'm1');
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  useUiDepth(supportModalVisible);
  const [newName, setNewName] = useState(user?.name || '');
  const [selectedGoal, setSelectedGoal] = useState(dailyGoalMinutes);
  const [newMotto, setNewMotto] = useState(motto);
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
      setProductivityHour(newProductivityHour);
      setAvatarBorderColor(selectedBorderColor);
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

  const handleDeleteAccount = () => {
    Alert.alert(t.deleteAccount || (language === 'tr' ? 'Hesabımı Sil' : 'Delete Account'), t.confirmDeleteAccount || (language === 'tr' ? 'Hesabınızı ve tüm verilerinizi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' : 'Are you sure you want to permanently delete your account and all associated data? This action cannot be undone.'), [
      { text: t.cancel, style: "cancel" },
      { 
        text: t.yesDelete || (language === 'tr' ? 'Evet, Hesabımı Sil' : 'Yes, Delete Account'), 
        style: "destructive", 
        onPress: async () => { 
          try { await AuthService.deleteAccount(); } catch {} 
          logout(); 
          router.replace('/login'); 
        } 
      }
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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 190, paddingHorizontal: S.lg, paddingTop: S.xl, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.header, { marginTop: S.md }]}>
            <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={[styles.avatarLarge, { backgroundColor: '#ffffff', borderWidth: (!avatarBorderColor || avatarBorderColor === 'transparent') ? 2 : 4, borderColor: (!avatarBorderColor || avatarBorderColor === 'transparent') ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)') : avatarBorderColor, width: 110, height: 110, borderRadius: 55, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
                <Image source={getAvatarSource(user?.avatar || null)} style={{ width: 110, height: 110 }} resizeMode="cover" />
            </MotiView>
            <View style={{ alignItems: 'center', marginTop: S.md }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.name, { color: theme.onSurface, fontSize: F.hero }]}>{user?.name || 'Alex'}</Text>
                <Text style={[styles.email, { color: theme.onSurfaceVariant, fontSize: F.body }]}>{user?.email || 'user@tazq.com'}</Text>
                {!!motto && (
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, fontStyle: 'italic', marginTop: 4, textAlign: 'center', paddingHorizontal: S.lg }}>"{motto}"</Text>
                )}
                <Touchable onPress={openEditModal} style={[styles.editBtn, { backgroundColor: theme.primary, paddingVertical: S.sm }]}>
                    <Text style={[styles.editBtnText, { color: theme.onPrimary, fontWeight: '900', fontSize: F.caption }]}>{t.editProfile || 'Edit Profile'}</Text>
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
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>
                {language === 'tr' ? '↺ Yenile' : '↺ Retry'}
              </Text>
            </Touchable>
          ) : (
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
              {[
                { icon: <Zap size={15} color={theme.primary} />, value: stats.totalFocusHours, label: language === 'tr' ? 'saat odak' : 'focus hrs' },
                { icon: <Target size={15} color={theme.secondary} />, value: stats.completedTasksCount, label: language === 'tr' ? 'görev tamam' : 'tasks done' },
                { icon: <Trophy size={15} color="#ff9f0a" />, value: displayBestStreak, label: language === 'tr' ? 'en uzun seri' : 'best streak' },
              ].map((s, i) => (
                <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.xs + 2, paddingVertical: S.sm + 2, paddingHorizontal: S.sm + 2, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: R.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                  {s.icon}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: F.subhead, fontWeight: '800', color: theme.onSurface, lineHeight: 20 }}>{s.value}</Text>
                    <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, opacity: 0.6, lineHeight: 13 }} numberOfLines={1}>{s.label}</Text>
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
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '900', letterSpacing: 1.5 }}>
                    {tr ? 'BAŞARILAR' : 'ACHIEVEMENTS'}
                  </Text>
                  <View style={{ marginLeft: S.sm, backgroundColor: unlockedList.length > 0 ? theme.tertiary + '22' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), borderRadius: R.full, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: unlockedList.length > 0 ? theme.tertiary : theme.onSurfaceVariant, opacity: unlockedList.length > 0 ? 1 : 0.5 }}>
                      {unlockedList.length}/{all.length}
                    </Text>
                  </View>
                </View>

                {chips.length === 0 ? (
                  <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, opacity: 0.5 }}>
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
                              gap: 4,
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
                              borderRadius: 24,
                              backgroundColor: ach.locked
                                ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)')
                                : ((ACHIEVEMENT_ICONS[ach.id]?.color || theme.primary) + '12'), // 7% opacity colored backdrop
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: 6,
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

          <View style={[styles.settingsSection, { marginTop: S.lg }]}>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', marginBottom: S.lg }} />
            <Text style={[styles.sectionTitle, { color: theme.onSurface, fontSize: F.subhead, fontWeight: '900', letterSpacing: -0.5, marginBottom: S.lg, marginLeft: S.xs }]}>{t.settings}</Text>

            {/* ── BİLDİRİMLER ── */}
            <SectionHeader title={language === 'tr' ? 'BİLDİRİMLER' : 'NOTIFICATIONS'} theme={theme} />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<Bell size={18} color="#F59E0B" />}
                    label={t.notifications}
                    sub={language === 'tr' ? 'Sistem izinleri' : 'System permission'}
                    bg={isDark ? "rgba(245, 158, 11, 0.1)" : "#F59E0B15"}
                    right={<Text style={{ color: notifEnabled ? '#10B981' : theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{notifEnabled ? t.notificationsEnabled : t.notificationsDisabled}</Text>}
                    onPress={toggleNotifications}
                    theme={theme}
                />
                <RowDivider isDark={isDark} />
                <ToggleRow
                    icon={<Sunrise size={18} color={theme.primary} />}
                    bg={theme.primary + '15'}
                    title={language === 'tr' ? 'Sabah Özeti' : 'Morning Brief'}
                    subtitle={language === 'tr' ? 'Her sabah 08:00 — bugünkü görevler' : 'Daily at 08:00 — today\'s tasks'}
                    value={morningBrief}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setMorningBrief(v); if (!v) cancelMorningBrief(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider isDark={isDark} />
                <ToggleRow
                    icon={<Sunset size={18} color={theme.primary} />}
                    bg={theme.primary + '15'}
                    title={language === 'tr' ? 'Akşam Özeti' : 'Evening Brief'}
                    subtitle={language === 'tr' ? 'Her gün 21:00 — günlük tamamlanma' : 'Daily at 21:00 — day completion'}
                    value={eveningBrief}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setEveningBrief(v); if (!v) cancelEveningBrief(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider isDark={isDark} />
                <ToggleRow
                    icon={<CalendarDays size={18} color={theme.primary} />}
                    bg={theme.primary + '15'}
                    title={language === 'tr' ? 'Haftalık Özet' : 'Weekly Summary'}
                    subtitle={language === 'tr' ? 'Her Pazar akşamı momentum özeti' : 'Momentum recap every Sunday'}
                    value={weeklyNotification}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setWeeklyNotification(v); if (!v) cancelWeeklySummary(); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider isDark={isDark} />
                <ToggleRow
                    icon={<CalendarDays size={18} color={theme.primary} />}
                    bg={theme.primary + '15'}
                    title={language === 'tr' ? 'Takvim Senkronizasyonu' : 'Calendar Sync'}
                    subtitle={language === 'tr' ? 'Görevleri sistem takvimine kaydeder' : 'Syncs tasks to system calendar'}
                    value={calendarSync}
                    onValueChange={toggleCalendarSync}
                    theme={theme} isDark={isDark}
                />
            </SettingsCard>

            {/* ── GÖRÜNÜM & DİL ── */}
            <SectionHeader title={language === 'tr' ? 'GÖRÜNÜM & DİL' : 'APPEARANCE & LANGUAGE'} theme={theme} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<Moon size={18} color="#818CF8" />}
                    label={t.appearance}
                    bg={isDark ? "rgba(129, 140, 248, 0.1)" : "#818CF815"}
                    right={<Text style={{ color: theme.primary, fontWeight: '800', fontSize: F.caption }}>{((t as any)[`theme${currentSetting.charAt(0).toUpperCase() + currentSetting.slice(1)}`] || currentSetting).toUpperCase()}</Text>}
                    onPress={toggleTheme}
                    theme={theme}
                />
                <RowDivider isDark={isDark} />
                <SettingItem
                    icon={<Languages size={18} color="#10B981" />}
                    label={t.language}
                    bg={isDark ? "rgba(16, 185, 129, 0.1)" : "#10B98115"}
                    right={<Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.caption }}>{language.toUpperCase()}</Text>}
                    onPress={toggleLanguage}
                    theme={theme}
                />
                <RowDivider isDark={isDark} />
                <ToggleRow
                    icon={<Zap size={18} color={theme.primary} />}
                    bg={theme.primary + '15'}
                    title={language === 'tr' ? 'Sade Mod' : 'Lite Mode'}
                    subtitle={language === 'tr' ? 'Oyunlaştırma ve modları gizler — sadece görevler' : 'Hides gamification & modes — tasks only'}
                    value={uiMode === 'lite'}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setUiMode(v ? 'lite' : 'pro'); track('ui_mode_changed', { mode: v ? 'lite' : 'pro' }); }}
                    theme={theme} isDark={isDark}
                />
            </SettingsCard>

            {/* ── DENEYİM ── */}
            <SectionHeader title={language === 'tr' ? 'DENEYİM' : 'EXPERIENCE'} theme={theme} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
                <ToggleRow
                    icon={<Volume2 size={18} color={theme.primary} />}
                    bg={theme.primary + '15'}
                    title={language === 'tr' ? 'Ses Efektleri' : 'Sound Effects'}
                    subtitle={language === 'tr' ? 'Görev & timer tamamlama sesleri' : 'Task & timer completion sounds'}
                    value={soundEffects}
                    onValueChange={(v: boolean) => { Haptics.selectionAsync(); setSoundEffects(v); }}
                    theme={theme} isDark={isDark}
                />
                <RowDivider isDark={isDark} />
                <SettingItem
                    icon={<Zap size={18} color={theme.primary} />}
                    label={language === 'tr' ? 'Focus Puanları' : 'Focus Points'}
                    sub={language === 'tr' ? `${focusPoints} XP · Her 100 puanda 1 kalkan kazanırsın` : `${focusPoints} XP · Gain 1 shield every 100 points`}
                    bg={theme.primary + '15'}
                    right={<Text style={{ color: theme.primary, fontWeight: '800', fontSize: F.caption }}>{focusPoints}/100</Text>}
                    theme={theme}
                />
                <RowDivider isDark={isDark} />
                <SettingItem
                    icon={<Shield size={18} color={isDark ? "#2DD4BF" : "#0D9488"} />}
                    label={t.streakFreeze}
                    sub={language === 'tr' ? `${streakShields}/3 kalkan hazır — seriyi korur` : `${streakShields}/3 shields ready — protects streak`}
                    bg={isDark ? "rgba(45, 212, 191, 0.12)" : "rgba(13, 148, 136, 0.12)"}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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

            {/* ── MERKEZ ── */}
            <SectionHeader title={language === 'tr' ? 'MERKEZ' : 'HUB'} theme={theme} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<CalendarDays size={18} color={theme.primary} />}
                    label={language === 'tr' ? 'Haftalık Merkez' : 'Weekly Hub'}
                    sub={language === 'tr' ? 'Momentum, seri ve haftalık bakış' : 'Momentum, streak & weekly view'}
                    bg={theme.primary + '15'}
                    onPress={() => router.push('/cockpit')}
                    theme={theme}
                />
            </SettingsCard>

            {/* ── YASAL & GİZLİLİK ── */}
            <SectionHeader title={t.legalAndPrivacy || (language === 'tr' ? 'YASAL & GİZLİLİK' : 'LEGAL & PRIVACY')} theme={theme} style={{ marginTop: S.lg }} />
            <SettingsCard theme={theme} isDark={isDark}>
                <SettingItem
                    icon={<FileText size={18} color="#8B5CF6" />}
                    label={t.termsOfService || (language === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service')}
                    bg="#8B5CF615"
                    onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
                    theme={theme}
                />
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.outlineVariant }} />
                <SettingItem
                    icon={<Shield size={18} color="#10B981" />}
                    label={t.privacyPolicy || (language === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy')}
                    bg="#10B98115"
                    onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
                    theme={theme}
                />
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.outlineVariant }} />
                <SettingItem
                    icon={<MessageSquare size={18} color="#3B82F6" />}
                    label={(t as any).support?.title || (language === 'tr' ? 'Destek & İletişim' : 'Support & Contact')}
                    sub={(t as any).support?.sub || (language === 'tr' ? 'Soru ve önerilerini ilet' : 'Send questions & feedback')}
                    bg="#3B82F615"
                    onPress={() => setSupportModalVisible(true)}
                    theme={theme}
                />
            </SettingsCard>

            {user?.role === 'Admin' && (
              <Touchable
                onPress={() => router.push('/admin')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', borderRadius: R.md, paddingVertical: S.md, paddingHorizontal: S.md, marginTop: S.xl, borderWidth: B.thin, borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)' }}
              >
                <Shield size={18} color="#6366F1" />
                <Text style={{ color: '#6366F1', fontWeight: '800', fontSize: F.body, flex: 1 }}>
                  {language === 'tr' ? 'Admin Paneli' : 'Admin Panel'}
                </Text>
                <ChevronRight size={16} color="#6366F1" />
              </Touchable>
            )}

            <Touchable onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: theme.error + '10', marginTop: S.xl, paddingVertical: S.md, paddingHorizontal: S.md }]}>
                <LogOut size={18} color={theme.error} />
                <Text style={[styles.logoutText, { color: theme.error, fontSize: F.body }]}>{t.logout}</Text>
            </Touchable>

            <Touchable onPress={handleDeleteAccount} style={[styles.logoutBtn, { backgroundColor: 'transparent', marginTop: S.md, paddingVertical: S.md, paddingHorizontal: S.md }]}>
                <Trash2 size={16} color={theme.onSurfaceVariant} opacity={0.6} />
                <Text style={[styles.logoutText, { color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6 }]}>{t.deleteAccount || (language === 'tr' ? 'Hesabımı Sil' : 'Delete Account')}</Text>
            </Touchable>
          </View>
        </ScrollView>
      </SafeAreaView>

      <BottomNavBar />
      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="none" onShow={() => editSlideIn()}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Touchable style={StyleSheet.absoluteFill} onPress={() => setEditModalVisible(false)} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'} />
              <Animated.View style={[editSlide, styles.modalContent, { backgroundColor: isDark ? '#1C1C22' : '#FFFFFF', maxHeight: height - insets.top - 16 }]}>
                <View {...editPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
                  <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }]} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.modalTitle, { color: theme.onSurface, fontSize: F.subhead }]}>
                  {t.editProfile || 'Edit Profile'}
                </Text>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: S.md }}
                >
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
                        underlineColorAndroid="transparent"
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
                          <Touchable
                            key={config.id}
                            onPress={() => { Haptics.selectionAsync(); setSelectedAvatar(config.key); }}
                            activeOpacity={0.75}
                            accessibilityRole="imagebutton"
                            accessibilityLabel={(language === 'tr' ? 'Avatar ' : 'Avatar ') + config.key}
                            accessibilityState={{ selected: isSelected }}
                            style={{ alignItems: 'center', gap: 5 }}
                          >
                            <View style={{
                              width: 64, height: 64, borderRadius: 32,
                              borderWidth: isSelected ? 3 : 1.5,
                              borderColor: isSelected ? theme.primary : theme.outline + '40',
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
                              fontSize: 9, fontWeight: '800', letterSpacing: 0.3,
                              color: isSelected ? theme.primary : theme.onSurfaceVariant,
                              opacity: isSelected ? 1 : 0.5,
                            }}>
                              {config.name.toUpperCase()}
                            </Text>
                          </Touchable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Avatar Border Color */}
                  <View style={{ width: '100%', marginBottom: S.md }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                      {language === 'tr' ? 'Profil Çerçeve Rengi' : 'Profile Border Color'}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: S.sm,
                        paddingRight: S.lg,
                      }}
                      style={{ marginTop: S.xs }}
                    >
                      {([
                        { key: 'transparent', color: 'transparent', labelTr: 'Yok', labelEn: 'None' },
                        { key: 'blue', color: '#2563EB', labelTr: 'Mavi', labelEn: 'Blue' },
                        { key: 'orange', color: '#F97316', labelTr: 'Turuncu', labelEn: 'Orange' },
                        { key: 'indigo', color: '#6366F1', labelTr: 'İndigo', labelEn: 'Indigo' },
                        { key: 'emerald', color: '#10B981', labelTr: 'Zümrüt', labelEn: 'Emerald' },
                        { key: 'amber', color: '#F59E0B', labelTr: 'Kehribar', labelEn: 'Amber' },
                        { key: 'rose', color: '#EC4899', labelTr: 'Gül', labelEn: 'Rose' },
                        { key: 'violet', color: '#8B5CF6', labelTr: 'Menekşe', labelEn: 'Violet' },
                      ] as const).map((colorOpt) => {
                        const isSelected = selectedBorderColor === colorOpt.color;
                        const isNone = colorOpt.color === 'transparent';
                        return (
                          <Touchable
                            key={colorOpt.key}
                            onPress={() => { Haptics.selectionAsync(); setSelectedBorderColor(colorOpt.color); }}
                            activeOpacity={0.8}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 19,
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
                              borderRadius: 13,
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
                                  borderRadius: 4,
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
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
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
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, opacity: 0.4, textAlign: 'right', marginTop: 4 }}>{newMotto.length}/60</Text>
                  </View>

                  {/* Productivity hour */}
                  <View style={{ width: '100%', marginBottom: S.lg }}>
                    <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                      {language === 'tr' ? 'En Verimli Olduğun Zaman' : 'Peak Productivity Time'}
                    </Text>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, opacity: 0.5, marginBottom: S.sm }}>
                      {language === 'tr' ? 'Sabah özeti bu saate planlanır.' : 'Morning brief is scheduled around this time.'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: S.xs }}>
                      {([
                        { key: 'morning',   labelTr: 'Sabah',   labelEn: 'Morning',   hint: '07:00', icon: (color: string) => <Sunrise size={18} color={color} /> },
                        { key: 'afternoon', labelTr: 'Öğlen',   labelEn: 'Afternoon', hint: '12:00', icon: (color: string) => <Sun size={18} color={color} /> },
                        { key: 'evening',   labelTr: 'Akşam',   labelEn: 'Evening',   hint: '17:00', icon: (color: string) => <Sunset size={18} color={color} /> },
                        { key: 'night',     labelTr: 'Gece',    labelEn: 'Night',     hint: '21:00', icon: (color: string) => <Moon size={18} color={color} /> },
                      ] as const).map(opt => {
                        const sel = newProductivityHour === opt.key;
                        const itemColor = sel ? theme.primary : theme.onSurfaceVariant;
                        return (
                          <Touchable
                            key={opt.key}
                            onPress={() => { Haptics.selectionAsync(); setNewProductivityHour(opt.key); }}
                            style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: S.sm, borderRadius: R.md, borderWidth: B.thin, borderColor: sel ? theme.primary + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), backgroundColor: sel ? theme.primary + '15' : 'transparent' }}
                          >
                            {opt.icon(itemColor)}
                            <Text style={{ fontSize: 10, fontWeight: '800', color: itemColor }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text>
                            <Text style={{ fontSize: 9, color: theme.onSurfaceVariant, opacity: 0.5 }}>{opt.hint}</Text>
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
                      : <Text style={{ color: 'white', fontWeight: '900', fontSize: F.body }}>{t.save}</Text>
                    }
                  </Touchable>
                </View>
              </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Support Modal */}
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

// iOS tarzı bölüm başlığı (kartın üstünde küçük, harf aralıklı etiket)
function SectionHeader({ title, theme, style }: any) {
    return (
        <Text style={[{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '900', letterSpacing: 1.2, opacity: 0.6, marginLeft: S.md, marginBottom: S.sm, textTransform: 'uppercase' }, style]}>
            {title}
        </Text>
    );
}

// Gruplanmış ayar kartı sarmalayıcı
function SettingsCard({ children, theme, isDark, style }: any) {
    return (
        <View style={[{ backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', borderWidth: B.thin, borderRadius: R.lg, overflow: 'hidden' }, style]}>
            {children}
        </View>
    );
}

// Kart içi satır ayıracı
function RowDivider({ isDark }: any) {
    return <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: S.md }} />;
}

// İkon + başlık + alt açıklama + Switch satırı (tek aksan rengi)
function ToggleRow({ icon, bg, title, subtitle, value, onValueChange, theme, isDark }: any) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 14, gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
            <View style={{ flex: 1 }}>
                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body, lineHeight: 20 }}>{title}</Text>
                {!!subtitle && <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 2, lineHeight: 15 }}>{subtitle}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: theme.primary + '80' }}
                thumbColor={value ? theme.primary : (isDark ? '#636366' : '#fff')}
            />
        </View>
    );
}

function SettingItem({ icon, label, sub, right, onPress, theme, bg }: any) {
    return (
        <Touchable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingVertical: 14 }} onPress={onPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg || (theme.colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'), alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body, lineHeight: 20 }}>{label}</Text>
                    {!!sub && <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 2, lineHeight: 15 }}>{sub}</Text>}
                </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginLeft: 8 }}>
                {right}
                <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.3} />
            </View>
        </Touchable>
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
  logoutText: { fontFamily: 'Jakarta-Bold', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: S.xl, borderTopRightRadius: S.xl, borderBottomLeftRadius: S.xl, borderBottomRightRadius: S.xl, paddingTop: S.sm, overflow: 'hidden' },
  modalHandle: { width: 40, height: 4, borderRadius: R.sm, alignSelf: 'center', marginBottom: S.md },
  modalTitle: { fontWeight: '900', marginBottom: S.lg, textAlign: 'center', paddingHorizontal: S.lg },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  inputGroup: { borderRadius: R.md, paddingHorizontal: S.md, height: 48, justifyContent: 'center' },
  nameInput: { fontSize: F.body, fontWeight: '600' },
  goalChip: { flex: 1, paddingVertical: S.sm, borderRadius: R.md, alignItems: 'center' },
  saveBtn: { width: '100%', paddingVertical: S.md, borderRadius: R.full, alignItems: 'center' },
});


