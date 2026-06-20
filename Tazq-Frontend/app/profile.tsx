import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Alert, Modal, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView, Keyboard, Linking, Animated, Switch } from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, Languages, LogOut, ChevronRight, Zap, Target, Trophy, Shield, CalendarDays, Star, Volume2 } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { AuthService, FocusService } from '../services/api';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { requestNotificationPermissions, cancelWeeklySummary, cancelMorningBrief, cancelEveningBrief } from '../utils/notifications';
import { S, R, F } from '../constants/tokens';
import { useToastStore } from '../store/useToastStore';
import { AVATAR_CONFIGS, getAvatarSource } from '../utils/avatars';
import { usePrefsStore } from '../store/usePrefsStore';
import { useAchievementStore } from '../store/useAchievementStore';
import { ACHIEVEMENTS } from '../utils/achievements';

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
  const { weeklyNotification, setWeeklyNotification, morningBrief, setMorningBrief, eveningBrief, setEveningBrief, soundEffects, setSoundEffects } = usePrefsStore();
  const { unlocked: unlockedAchievements } = useAchievementStore();

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
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
              {[0,1,2].map(i => (
                <MotiView key={i} animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ loop: true, duration: 1200, delay: i * 80 }} style={{ flex: 1, height: 52, borderRadius: R.md, backgroundColor: theme.surfaceContainerHigh }} />
              ))}
            </View>
          ) : statsError ? (
            <TouchableOpacity onPress={loadStats} style={{ marginTop: S.md, alignSelf: 'flex-start', paddingHorizontal: S.md, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: theme.surfaceContainerHigh }}>
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>
                {language === 'tr' ? '↺ Yenile' : '↺ Retry'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.lg }}>
              {[
                { icon: <Zap size={15} color={theme.primary} />, value: stats.totalFocusHours, label: language === 'tr' ? 'saat odak' : 'focus hrs' },
                { icon: <Target size={15} color={theme.secondary} />, value: stats.completedTasksCount, label: language === 'tr' ? 'görev tamam' : 'tasks done' },
                { icon: <Trophy size={15} color="#ff9f0a" />, value: displayBestStreak, label: language === 'tr' ? 'en uzun seri' : 'best streak' },
              ].map((s, i) => (
                <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.xs + 2, paddingVertical: S.sm + 2, paddingHorizontal: S.sm + 2, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: R.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
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
                          <View
                            key={ach.id}
                            style={{
                              flex: 1,
                              alignItems: 'center',
                              gap: 4,
                              paddingVertical: S.sm,
                              paddingHorizontal: S.xs,
                              borderRadius: R.md,
                              borderWidth: 1,
                              borderColor: ach.locked
                                ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)')
                                : (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.09)'),
                              backgroundColor: ach.locked
                                ? 'transparent'
                                : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                              opacity: ach.locked ? 0.45 : 1,
                            }}
                          >
                            <Text style={{ fontSize: 22 }}>{ach.emoji}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurface, textAlign: 'center', lineHeight: 13 }} numberOfLines={2}>
                              {tr ? ach.titleTr : ach.titleEn}
                            </Text>
                          </View>
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
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Bell size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                      {language === 'tr' ? 'Sabah Özeti' : 'Morning Brief'}
                    </Text>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>
                      {language === 'tr' ? 'Her sabah 08:00 — bugünkü görevler' : 'Daily at 08:00 — today\'s tasks'}
                    </Text>
                  </View>
                  <Switch
                    value={morningBrief}
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      setMorningBrief(v);
                      if (!v) cancelMorningBrief();
                    }}
                    trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: theme.primary + '80' }}
                    thumbColor={morningBrief ? theme.primary : (isDark ? '#636366' : '#fff')}
                  />
                </View>
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: S.md }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.md, gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.secondary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Bell size={18} color={theme.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                      {language === 'tr' ? 'Akşam Özeti' : 'Evening Brief'}
                    </Text>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>
                      {language === 'tr' ? 'Her gün 21:00 — günlük tamamlanma' : 'Daily at 21:00 — day completion'}
                    </Text>
                  </View>
                  <Switch
                    value={eveningBrief}
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      setEveningBrief(v);
                      if (!v) cancelEveningBrief();
                    }}
                    trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: theme.secondary + '80' }}
                    thumbColor={eveningBrief ? theme.secondary : (isDark ? '#636366' : '#fff')}
                  />
                </View>
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
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginHorizontal: S.md }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.md, gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#6366F115', alignItems: 'center', justifyContent: 'center' }}>
                    <Volume2 size={18} color="#6366F1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                      {language === 'tr' ? 'Ses Efektleri' : 'Sound Effects'}
                    </Text>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>
                      {language === 'tr' ? 'Görev & timer tamamlama sesleri' : 'Task & timer completion sounds'}
                    </Text>
                  </View>
                  <Switch
                    value={soundEffects}
                    onValueChange={(v) => { Haptics.selectionAsync(); setSoundEffects(v); }}
                    trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#6366F180' }}
                    thumbColor={soundEffects ? '#6366F1' : (isDark ? '#636366' : '#fff')}
                  />
                </View>
            </View>
            {/* Dönemsel Modlar */}
            <View style={{ marginTop: S.xl }}>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', marginBottom: S.md }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md, marginLeft: S.xs }}>
                <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '900', letterSpacing: 1.5, marginBottom: 0 }]}>
                  {language === 'tr' ? 'DÖNEMSEL MODLAR' : 'SEASONAL MODES'}
                </Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    language === 'tr' ? 'Dönemsel Modlar Nedir?' : 'What are Seasonal Modes?',
                    language === 'tr'
                      ? 'Dönemsel modlar belirli bir hedef veya dönem için hazırlanmış alışkanlık ve görev paketleridir. Aktif ettiğinde ilgili plan otomatik olarak Haftalık Merkez\'e ve görevlerine eklenir. Mod kapatıldığında eklenen içerikler kaldırılır.'
                      : 'Seasonal modes are curated habit and task bundles for specific goals or periods. When activated, the plan is automatically added to your Weekly Hub and tasks. Disabling the mode removes the added content.',
                    [{ text: language === 'tr' ? 'Anladım' : 'Got it' }]
                  )}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '900', color: theme.onSurfaceVariant, lineHeight: 18 }}>i</Text>
                </TouchableOpacity>
              </View>

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
                        <Text style={{ fontSize: F.caption, fontWeight: '500', marginTop: 1,
                          color: ramadanStatus.isActive ? '#6366F1' : seasonal.ramazan && ramadanStatus.period ? '#6366F1' : theme.onSurfaceVariant,
                          opacity: ramadanStatus.isActive ? 0.9 : seasonal.ramazan && ramadanStatus.period ? 0.75 : 0.55,
                        }}>
                          {ramadanStatus.isActive && ramadanStatus.period
                            ? (language === 'tr'
                                ? `🌙 ${formatRamadanDate(ramadanStatus.period.start, 'tr')} – ${formatRamadanDate(ramadanStatus.period.end, 'tr')} · ${ramadanStatus.daysRemaining} gün kaldı`
                                : `🌙 ${formatRamadanDate(ramadanStatus.period.start, 'en')} – ${formatRamadanDate(ramadanStatus.period.end, 'en')} · ${ramadanStatus.daysRemaining} days left`)
                            : seasonal.ramazan && ramadanStatus.period
                            ? (language === 'tr'
                                ? `${formatRamadanDate(ramadanStatus.period.start, 'tr', ramadanStatus.period.year !== new Date().getFullYear())} · ${ramadanStatus.daysUntilStart} gün`
                                : `${formatRamadanDate(ramadanStatus.period.start, 'en', ramadanStatus.period.year !== new Date().getFullYear())} · ${ramadanStatus.daysUntilStart} days`)
                            : (language === 'tr' ? 'Oruç dönemine özel alışkanlık ve görevler' : 'Habits & tasks tailored for the fasting month')}
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
                                    habits.filter(h => RAMAZAN_HABIT_NAMES.some(n => n.toLowerCase() === h.name.toLowerCase())).forEach(h => removeHabit(h.id));
                                    ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
                                    clearPlanIds('ramazan');
                                    setSeasonalPref('ramazan', false);
                                    cancelRamadanStartNotification();
                                  }
                                },
                              ]
                            );
                          } else {
                            setSeasonalPref('ramazan', v);
                            if (v) {
                              setModePreview({ type: 'ramazan', key: Date.now() });
                              if (ramadanStatus.period && !ramadanStatus.isActive) {
                                scheduleRamadanStartNotification(ramadanStatus.period.start, language);
                              }
                            }
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
                      {!ramadanStatus.isActive && ramadanStatus.period ? (
                        <TouchableOpacity
                          onPress={() => setModePreview({ type: 'ramazan', key: Date.now() })}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' }} />
                          <Text style={{ color: '#6366F1', fontSize: F.caption, fontWeight: '600', flex: 1 }}>
                            {language === 'tr' ? 'Planı şimdiden hazırla' : 'Set up your plan in advance'}
                          </Text>
                          <ChevronRight size={12} color="#6366F1" />
                        </TouchableOpacity>
                      ) : ramazanPlanHabits.length > 0 ? (
                        <View style={{ gap: S.sm }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>
                              {language === 'tr' ? 'Bu haftaki ilerleme' : 'This week\'s progress'}
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
                                    examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
                                    exam2PlanHabitIds.forEach(id => removeHabit(id));
                                    exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2'));
                                    exam3PlanHabitIds.forEach(id => removeHabit(id));
                                    exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3'));
                                    clearPlanIds('exam');
                                    clearPlanIds('exam2');
                                    clearPlanIds('exam3');
                                    setExamNameInput('');
                                    setExamDateInput('');
                                    setExam2NameInput('');
                                    setExam2DateInput('');
                                    setExam3NameInput('');
                                    setExam3DateInput('');
                                    setExamExpanded(false);
                                    setExam2Expanded(false);
                                    setExam3Expanded(false);
                                    setSeasonalPref('examMode', false);
                                    setSeasonalPref('examName', '');
                                    setSeasonalPref('examDate', null);
                                    setSeasonalPref('exam2Name', '');
                                    setSeasonalPref('exam2Date', null);
                                    setSeasonalPref('exam3Name', '');
                                    setSeasonalPref('exam3Date', null);
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
                                            {language === 'tr' ? 'Bu haftaki ilerleme' : 'This week\'s progress'}
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
                                    onChangeText={(v) => {
                                      setExam2NameInput(v);
                                      setSeasonalPref('exam2Name', v);
                                      if (!v.trim()) {
                                        setExam2Suggestions([]);
                                        setSelectedExam2Preset(null);
                                        setExam2DailyMinutes(null);
                                        return;
                                      }
                                      const detected = detectExamFromInput(v);
                                      if (detected) {
                                        setSelectedExam2Preset(detected);
                                        setExam2Suggestions([]);
                                      } else {
                                        setSelectedExam2Preset(null);
                                        setExam2Suggestions(matchExamName(v));
                                      }
                                    }}
                                    placeholder={language === 'tr' ? 'İkinci sınav adı (örn: YDS, ALES...)' : 'Second exam name (e.g. IELTS, GRE...)'}
                                    placeholderTextColor={theme.onSurfaceVariant + '70'}
                                    style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }}
                                    returnKeyType="done"
                                    onSubmitEditing={() => {
                                      if (exam2Suggestions.length > 0) {
                                        const top = exam2Suggestions[0];
                                        setExam2NameInput(top.shortName);
                                        setSeasonalPref('exam2Name', top.shortName);
                                        setSelectedExam2Preset(top);
                                        setExam2Suggestions([]);
                                      }
                                    }}
                                  />
                                </View>

                                {/* Autocomplete suggestions */}
                                {exam2Suggestions.length > 0 && (
                                  <View style={{ borderRadius: R.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                                    {exam2Suggestions.map((preset, idx) => (
                                      <TouchableOpacity
                                        key={preset.id}
                                        onPress={() => {
                                          Haptics.selectionAsync();
                                          setExam2NameInput(preset.shortName);
                                          setSeasonalPref('exam2Name', preset.shortName);
                                          setSelectedExam2Preset(preset);
                                          setExam2Suggestions([]);
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}
                                        activeOpacity={0.7}
                                      >
                                        <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text>
                                        <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                )}

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

                                {/* Daily hours mini-wizard for exam 2 */}
                                {selectedExam2Preset && (
                                  <View style={{ gap: 6 }}>
                                    <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>
                                      {language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                                      {HOURS_OPTIONS.map((opt) => {
                                        const active = exam2DailyMinutes === opt.minutes;
                                        return (
                                          <TouchableOpacity
                                            key={opt.minutes}
                                            onPress={() => { Haptics.selectionAsync(); setExam2DailyMinutes(active ? null : opt.minutes); }}
                                            style={{ paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.full, borderWidth: 1.5, borderColor: active ? exam2UrgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? exam2UrgencyColor + '18' : 'transparent' }}
                                            activeOpacity={0.7}
                                          >
                                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? exam2UrgencyColor : theme.onSurfaceVariant }}>
                                              {language === 'tr' ? opt.labelTr : opt.labelEn}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                    {selectedExam2Preset.tipTr && (
                                      <Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>
                                        {language === 'tr' ? selectedExam2Preset.tipTr : selectedExam2Preset.tipEn}
                                      </Text>
                                    )}
                                  </View>
                                )}

                                <View style={{ flexDirection: 'row', gap: S.sm }}>
                                  <TouchableOpacity
                                    onPress={() => {
                                      if (exam2NameInput || exam2DateInput) {
                                        exam2PlanHabitIds.forEach(id => removeHabit(id));
                                        exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2'));
                                        clearPlanIds('exam2');
                                        setExam2NameInput('');
                                        setExam2DateInput('');
                                        setSeasonalPref('exam2Name', '');
                                        setSeasonalPref('exam2Date', null);
                                        setSelectedExam2Preset(null);
                                        setExam2DailyMinutes(null);
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
                                      onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        setExam2Expanded(false);
                                        const templateId = selectedExam2Preset
                                          ? recommendTemplateId(
                                              exam2DaysLeft,
                                              selectedExam2Preset.category,
                                              selectedExam2Preset.preferredTemplates,
                                              exam2DailyMinutes ?? selectedExam2Preset.defaultDailyMinutes
                                            )
                                          : undefined;
                                        setModePreview({ type: 'exam', key: Date.now(), templateId, examTipTr: selectedExam2Preset?.tipTr, examTipEn: selectedExam2Preset?.tipEn, examName: exam2NameInput, examDate: exam2DateInput });
                                      }}
                                      style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: exam2UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }}
                                      activeOpacity={0.8}
                                    >
                                      <BookOpen size={13} color="#fff" />
                                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>
                                        {language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            )}
                          </View>

                          {/* Üçüncü Sınav */}
                          {exam2IsComplete && (
                            <View style={{ marginTop: S.xs }}>
                              <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                              {exam3IsComplete && !exam3Expanded ? (
                                <TouchableOpacity
                                  onPress={() => { Haptics.selectionAsync(); setExam3Expanded(true); }}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (exam3DatePast ? theme.error : exam3UrgencyColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }}
                                  activeOpacity={0.8}
                                >
                                  <Text style={{ fontSize: 14 }}>🎯</Text>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{exam3NameInput}</Text>
                                    <Text style={{ color: exam3DatePast ? theme.error : exam3UrgencyColor, fontSize: 11, fontWeight: '700' }}>
                                      {exam3DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${exam3DaysLeft} gün kaldı` : `${exam3DaysLeft} days left`)}
                                    </Text>
                                  </View>
                                  <Text style={{ color: exam3UrgencyColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                                </TouchableOpacity>
                              ) : !exam3IsComplete && !exam3Expanded ? (
                                <TouchableOpacity
                                  onPress={() => { Haptics.selectionAsync(); setExam3Expanded(true); }}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>
                                    {language === 'tr' ? 'Üçüncü sınav ekle' : 'Add third exam'}
                                  </Text>
                                </TouchableOpacity>
                              ) : null}
                              {exam3Expanded && (
                                <View style={{ gap: S.sm }}>
                                  <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                                    <TextInput
                                      value={exam3NameInput}
                                      onChangeText={(v) => {
                                        setExam3NameInput(v);
                                        setSeasonalPref('exam3Name', v);
                                        if (!v.trim()) {
                                          setExam3Suggestions([]);
                                          setSelectedExam3Preset(null);
                                          setExam3DailyMinutes(null);
                                          return;
                                        }
                                        const detected = detectExamFromInput(v);
                                        if (detected) {
                                          setSelectedExam3Preset(detected);
                                          setExam3Suggestions([]);
                                        } else {
                                          setSelectedExam3Preset(null);
                                          setExam3Suggestions(matchExamName(v));
                                        }
                                      }}
                                      placeholder={language === 'tr' ? 'Üçüncü sınav adı (örn: YDS, DGS...)' : 'Third exam name (e.g. TOEFL, GMAT...)'}
                                      placeholderTextColor={theme.onSurfaceVariant + '70'}
                                      style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }}
                                      returnKeyType="done"
                                      onSubmitEditing={() => {
                                        if (exam3Suggestions.length > 0) {
                                          const top = exam3Suggestions[0];
                                          setExam3NameInput(top.shortName);
                                          setSeasonalPref('exam3Name', top.shortName);
                                          setSelectedExam3Preset(top);
                                          setExam3Suggestions([]);
                                        }
                                      }}
                                    />
                                  </View>

                                  {exam3Suggestions.length > 0 && (
                                    <View style={{ borderRadius: R.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                                      {exam3Suggestions.map((preset, idx) => (
                                        <TouchableOpacity
                                          key={preset.id}
                                          onPress={() => {
                                            Haptics.selectionAsync();
                                            setExam3NameInput(preset.shortName);
                                            setSeasonalPref('exam3Name', preset.shortName);
                                            setSelectedExam3Preset(preset);
                                            setExam3Suggestions([]);
                                          }}
                                          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}
                                          activeOpacity={0.7}
                                        >
                                          <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text>
                                          <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  )}

                                  <TouchableOpacity
                                    onPress={() => { Haptics.selectionAsync(); setShowExam3DatePicker(true); }}
                                    style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ color: exam3DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>
                                      {exam3DateInput ? formatExamDate(exam3DateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select date')}
                                    </Text>
                                    <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                                  </TouchableOpacity>
                                  {showExam3DatePicker && (
                                    <DateTimePicker
                                      value={exam3DateObj}
                                      mode="date"
                                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                      locale={language === 'tr' ? 'tr-TR' : 'en-GB'}
                                      minimumDate={new Date()}
                                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                                        if (Platform.OS === 'android') setShowExam3DatePicker(false);
                                        if (event.type === 'dismissed') { setShowExam3DatePicker(false); return; }
                                        if (date) {
                                          const iso = date.toISOString().split('T')[0];
                                          setExam3DateInput(iso);
                                          setSeasonalPref('exam3Date', iso);
                                          if (Platform.OS === 'ios') setShowExam3DatePicker(false);
                                        }
                                      }}
                                    />
                                  )}

                                  {selectedExam3Preset && (
                                    <View style={{ gap: 6 }}>
                                      <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>
                                        {language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}
                                      </Text>
                                      <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                                        {HOURS_OPTIONS.map((opt) => {
                                          const active = exam3DailyMinutes === opt.minutes;
                                          return (
                                            <TouchableOpacity
                                              key={opt.minutes}
                                              onPress={() => { Haptics.selectionAsync(); setExam3DailyMinutes(active ? null : opt.minutes); }}
                                              style={{ paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.full, borderWidth: 1.5, borderColor: active ? exam3UrgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? exam3UrgencyColor + '18' : 'transparent' }}
                                              activeOpacity={0.7}
                                            >
                                              <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? exam3UrgencyColor : theme.onSurfaceVariant }}>
                                                {language === 'tr' ? opt.labelTr : opt.labelEn}
                                              </Text>
                                            </TouchableOpacity>
                                          );
                                        })}
                                      </View>
                                      {selectedExam3Preset.tipTr && (
                                        <Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>
                                          {language === 'tr' ? selectedExam3Preset.tipTr : selectedExam3Preset.tipEn}
                                        </Text>
                                      )}
                                    </View>
                                  )}

                                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                                    <TouchableOpacity
                                      onPress={() => {
                                        if (exam3NameInput || exam3DateInput) {
                                          exam3PlanHabitIds.forEach(id => removeHabit(id));
                                          exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3'));
                                          clearPlanIds('exam3');
                                          setExam3NameInput('');
                                          setExam3DateInput('');
                                          setSeasonalPref('exam3Name', '');
                                          setSeasonalPref('exam3Date', null);
                                          setSelectedExam3Preset(null);
                                          setExam3DailyMinutes(null);
                                        }
                                        setExam3Expanded(false);
                                      }}
                                      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>
                                        {language === 'tr' ? 'Kapat' : 'Close'}
                                      </Text>
                                    </TouchableOpacity>
                                    {exam3IsComplete && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                          setExam3Expanded(false);
                                          const templateId = selectedExam3Preset
                                            ? recommendTemplateId(
                                                exam3DaysLeft,
                                                selectedExam3Preset.category,
                                                selectedExam3Preset.preferredTemplates,
                                                exam3DailyMinutes ?? selectedExam3Preset.defaultDailyMinutes
                                              )
                                            : undefined;
                                          setModePreview({ type: 'exam', key: Date.now(), templateId, examTipTr: selectedExam3Preset?.tipTr, examTipEn: selectedExam3Preset?.tipEn, examName: exam3NameInput, examDate: exam3DateInput });
                                        }}
                                        style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: exam3UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }}
                                        activeOpacity={0.8}
                                      >
                                        <BookOpen size={13} color="#fff" />
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
                      )}

                      {/* State: editing form */}
                      {examExpanded && (
                        <View style={{ gap: S.sm }}>
                          <View ref={examInputViewRef} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                            <TextInput
                              value={examNameInput}
                              onChangeText={(v) => {
                                setExamNameInput(v);
                                setSeasonalPref('examName', v);
                                if (!v.trim()) {
                                  setExamSuggestions([]);
                                  setSelectedExamPreset(null);
                                  setExamDailyMinutes(null);
                                  return;
                                }
                                const detected = detectExamFromInput(v);
                                if (detected) {
                                  setSelectedExamPreset(detected);
                                  setExamSuggestions([]);
                                } else {
                                  setSelectedExamPreset(null);
                                  setExamSuggestions(matchExamName(v));
                                }
                              }}
                              placeholder={language === 'tr' ? 'Sınav adı (örn: ALES, DGS, KPSS...)' : 'Exam name (e.g. SAT, GRE, IELTS...)'}
                              placeholderTextColor={theme.onSurfaceVariant + '70'}
                              style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }}
                              returnKeyType="done"
                              onSubmitEditing={() => {
                                if (examSuggestions.length > 0) {
                                  const top = examSuggestions[0];
                                  setExamNameInput(top.shortName);
                                  setSeasonalPref('examName', top.shortName);
                                  setSelectedExamPreset(top);
                                  setExamSuggestions([]);
                                }
                              }}
                            />
                          </View>

                          {/* Autocomplete suggestions */}
                          {examSuggestions.length > 0 && (
                            <View style={{ borderRadius: R.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                              {examSuggestions.map((preset, idx) => (
                                <TouchableOpacity
                                  key={preset.id}
                                  onPress={() => {
                                    Haptics.selectionAsync();
                                    setExamNameInput(preset.shortName);
                                    setSeasonalPref('examName', preset.shortName);
                                    setSelectedExamPreset(preset);
                                    setExamSuggestions([]);
                                  }}
                                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text>
                                  <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}

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

                          {/* Daily hours mini-wizard — shown when a recognized exam is detected */}
                          {selectedExamPreset && (
                            <View style={{ gap: 6 }}>
                              <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>
                                {language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}
                              </Text>
                              <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                                {HOURS_OPTIONS.map((opt) => {
                                  const active = examDailyMinutes === opt.minutes;
                                  return (
                                    <TouchableOpacity
                                      key={opt.minutes}
                                      onPress={() => { Haptics.selectionAsync(); setExamDailyMinutes(active ? null : opt.minutes); }}
                                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.full, borderWidth: 1.5, borderColor: active ? urgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? urgencyColor + '18' : 'transparent' }}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? urgencyColor : theme.onSurfaceVariant }}>
                                        {language === 'tr' ? opt.labelTr : opt.labelEn}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                              {selectedExamPreset.tipTr && (
                                <Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>
                                  {language === 'tr' ? selectedExamPreset.tipTr : selectedExamPreset.tipEn}
                                </Text>
                              )}
                            </View>
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
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                  setExamExpanded(false);
                                  const templateId = selectedExamPreset
                                    ? recommendTemplateId(
                                        examDaysLeft,
                                        selectedExamPreset.category,
                                        selectedExamPreset.preferredTemplates,
                                        examDailyMinutes ?? selectedExamPreset.defaultDailyMinutes
                                      )
                                    : undefined;
                                  setModePreview({ type: 'exam', key: Date.now(), templateId, examTipTr: selectedExamPreset?.tipTr, examTipEn: selectedExamPreset?.tipEn, examName: examNameInput, examDate: examDateInput });
                                }}
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
                                    tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez'));
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
                                          <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text>
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
                                    mulakatPlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat'));
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
                                          <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text>
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
          defaultTemplateId={modePreview.templateId}
          mode={getModePreview(modePreview.type, {
            examName: modePreview.examName ?? examNameInput,
            examDate: modePreview.examDate ?? examDateInput,
            examTipTr: modePreview.examTipTr,
            examTipEn: modePreview.examTipEn,
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
              examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
              clearPlanIds('exam');
            } else if (t === 'tez') {
              tezPlanHabitIds.forEach(id => removeHabit(id));
              tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez'));
              clearPlanIds('tez');
            } else if (t === 'mulakat') {
              mulakatPlanHabitIds.forEach(id => removeHabit(id));
              mulakatPlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat'));
              clearPlanIds('mulakat');
            } else {
              ramazanPlanHabitIds.forEach(id => removeHabit(id));
              habits.filter(h => RAMAZAN_HABIT_NAMES.some(n => n.toLowerCase() === h.name.toLowerCase())).forEach(h => removeHabit(h.id));
              ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
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

