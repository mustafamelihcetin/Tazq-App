import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Alert, Modal, ActivityIndicator, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, Languages, LogOut, ChevronRight, Award, Zap, Target, Trophy, Shield } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { AuthService, FocusService } from '../services/api';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { requestNotificationPermissions } from '../utils/notifications';

const AVATAR_CONFIGS = [
    { id: 1, key: 'm1', name: 'Oliver', image: require('../assets/avatars/m1.png') },
    { id: 2, key: 'm2', name: 'James', image: require('../assets/avatars/m2.png') },
    { id: 3, key: 'm3', name: 'George', image: require('../assets/avatars/m3.png') },
    { id: 4, key: 'm4', name: 'Jack', image: require('../assets/avatars/m4.png') },
    { id: 5, key: 'f1', name: 'Aneka', image: require('../assets/avatars/f1.png') },
    { id: 6, key: 'f2', name: 'Sasha', image: require('../assets/avatars/f2.png') },
    { id: 7, key: 'f3', name: 'Lily', image: require('../assets/avatars/f3.png') },
    { id: 8, key: 'f4', name: 'Sienna', image: require('../assets/avatars/f4.png') }
];

const AVATAR_MAP: Record<string, any> = {
    'm1': require('../assets/avatars/m1.png'),
    'm2': require('../assets/avatars/m2.png'),
    'm3': require('../assets/avatars/m3.png'),
    'm4': require('../assets/avatars/m4.png'),
    'f1': require('../assets/avatars/f1.png'),
    'f2': require('../assets/avatars/f2.png'),
    'f3': require('../assets/avatars/f3.png'),
    'f4': require('../assets/avatars/f4.png'),
};

const getAvatarSource = (avatar: string | null) => {
    if (!avatar) return require('../assets/avatars/m1.png');
    if (avatar.startsWith('http')) return { uri: avatar };
    return AVATAR_MAP[avatar] || require('../assets/avatars/m1.png');
};

const GOAL_OPTIONS = [30, 60, 90, 120];

export default function ProfileScreen() {
  const { theme, colorScheme, setTheme, currentSetting } = useAppTheme();
  const { user, setUser, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const isDark = colorScheme === 'dark';

  const { bestStreak, streakFreezeAvailable, useStreakFreeze, dailyGoalMinutes, setDailyGoal, updateBestStreak } = useFocusStore();

  const isSmallDevice = width < 380;
  const isShortDevice = height < 750;

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'm1');
  const [newName, setNewName] = useState(user?.name || '');
  const [selectedGoal, setSelectedGoal] = useState(dailyGoalMinutes);
  const [savingProfile, setSavingProfile] = useState(false);

  const [stats, setStats] = useState({ totalFocusHours: 0, completedTasksCount: 0, activeStreak: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    setStatsLoading(true);
    FocusService.getStats().then((s) => {
      const active = s.activeStreak ?? 0;
      setStats({ totalFocusHours: s.totalFocusHours ?? 0, completedTasksCount: s.completedTasksCount ?? 0, activeStreak: active });
      updateBestStreak(active);
    }).catch((e) => {
        if (e.response?.status !== 401) console.warn('getStats error:', e.message);
    }).finally(() => setStatsLoading(false));

    requestNotificationPermissions().then((granted) => setNotifEnabled(granted));
  }, []);

  const openEditModal = () => {
    setSelectedAvatar(user?.avatar || 'm1');
    setNewName(user?.name || '');
    setSelectedGoal(dailyGoalMinutes);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await AuthService.updateProfile({ avatar: selectedAvatar, name: newName });
      setUser({ ...user, avatar: selectedAvatar, name: newName });
      setDailyGoal(selectedGoal);
      setEditModalVisible(false);
    } catch (e) {
      console.log('Profile update failed:', e);
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleNotifications = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (notifEnabled) {
      Alert.alert(t.notifications, t.notificationsDisabled + ' — ' + (language === 'tr' ? 'Ayarlardan kapatabilirsin.' : 'Disable from device Settings.'));
    } else {
      const granted = await requestNotificationPermissions();
      setNotifEnabled(granted);
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
    Alert.alert(
      (t as any).streakFreeze || 'Streak Shield',
      language === 'tr' ? 'Serisini korumak için Seri Kalkanı kullan?' : 'Use streak freeze to protect your streak?',
      [
        { text: t.cancel, style: 'cancel' },
        { text: language === 'tr' ? 'Kullan' : 'Use', onPress: () => { useStreakFreeze(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } }
      ]
    );
  };

  const displayBestStreak = Math.max(bestStreak, stats.activeStreak);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: isSmallDevice ? 20 : 24 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { marginTop: isShortDevice ? 20 : 32 }]}>
            <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={[styles.avatarLarge, { borderColor: isDark ? theme.primary + '40' : 'rgba(0,0,0,0.05)', width: isSmallDevice ? 90 : 110, height: isSmallDevice ? 90 : 110, borderRadius: isSmallDevice ? 45 : 55 }]}>
                <Image key={user?.avatar} source={getAvatarSource(user?.avatar || null)} style={[styles.image, { borderRadius: isSmallDevice ? 40 : 50 }]} />
            </MotiView>
            <View style={{ alignItems: 'center', marginTop: isSmallDevice ? 12 : 16 }}>
                <Text style={[styles.name, { color: theme.onSurface, fontSize: isSmallDevice ? 22 : 28 }]}>{user?.name || 'Alex'}</Text>
                <Text style={[styles.email, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 12 : 14 }]}>{user?.email || 'user@tazq.com'}</Text>
                <TouchableOpacity onPress={openEditModal} style={[styles.editBtn, { backgroundColor: theme.primary, paddingVertical: isSmallDevice ? 8 : 10 }]}>
                    <Text style={[styles.editBtnText, { color: theme.onPrimary, fontWeight: '900', fontSize: isSmallDevice ? 11 : 13 }]}>{(t as any).editProfile || t.editProfile}</Text>
                </TouchableOpacity>
            </View>
          </View>

          {statsLoading ? (
            <View style={[styles.statsGrid, { gap: isSmallDevice ? 8 : 12, marginTop: isShortDevice ? 24 : 40 }]}>
                <MotiView animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ loop: true, duration: 1200 }} style={{ flex: 1, height: 100, borderRadius: 24, backgroundColor: theme.surfaceContainerHigh }} />
                <MotiView animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ loop: true, duration: 1200, delay: 100 }} style={{ flex: 1, height: 100, borderRadius: 24, backgroundColor: theme.surfaceContainerHigh }} />
                <MotiView animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ loop: true, duration: 1200, delay: 200 }} style={{ flex: 1, height: 100, borderRadius: 24, backgroundColor: theme.surfaceContainerHigh }} />
            </View>
          ) : (
            <>
              <View style={[styles.statsGrid, { gap: isSmallDevice ? 8 : 12, marginTop: isShortDevice ? 24 : 40 }]}>
                <BentoCard index={1} style={{ flex: 1, alignItems: 'center', padding: isSmallDevice ? 12 : 16 }}>
                    <Zap size={isSmallDevice ? 18 : 22} color={theme.primary} fill={theme.primary + '30'} />
                    <Text style={[styles.statValue, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 22 }]}>{stats.totalFocusHours}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 9 : 10 }]}>{t.hours}</Text>
                </BentoCard>
                <BentoCard index={2} style={{ flex: 1, alignItems: 'center', padding: isSmallDevice ? 12 : 16 }}>
                    <Target size={isSmallDevice ? 18 : 22} color={theme.secondary} />
                    <Text style={[styles.statValue, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 22 }]}>{stats.completedTasksCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 9 : 10 }]}>{t.tasks}</Text>
                </BentoCard>
                <BentoCard index={3} style={{ flex: 1, alignItems: 'center', padding: isSmallDevice ? 12 : 16 }}>
                    <Trophy size={isSmallDevice ? 18 : 22} color={'#ff9f0a'} />
                    <Text style={[styles.statValue, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 22 }]}>{displayBestStreak}</Text>
                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 9 : 10 }]}>{(t as any).bestStreak || 'BEST STREAK'}</Text>
                </BentoCard>
              </View>
            </>
          )}

          <View style={[styles.settingsSection, { marginTop: isShortDevice ? 24 : 40 }]}>
            <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 }]}>{t.settings.toUpperCase()}</Text>
            <View style={[styles.settingsCard, { backgroundColor: isDark ? '#18181B' : theme.surfaceContainerLowest, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderWidth: 1, borderRadius: 24, overflow: 'hidden' }]}>
                <SettingItem 
                    icon={<Bell size={18} color="#F59E0B" />} 
                    label={t.notifications} 
                    bg={isDark ? "rgba(245, 158, 11, 0.1)" : "#F59E0B15"}
                    right={<Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: 13 }}>{notifEnabled ? t.notificationsEnabled : t.notificationsDisabled}</Text>} 
                    onPress={toggleNotifications} 
                    theme={theme} 
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', marginHorizontal: 16 }} />
                <SettingItem 
                    icon={<Moon size={18} color="#818CF8" />} 
                    label={t.appearance} 
                    bg={isDark ? "rgba(129, 140, 248, 0.1)" : "#818CF815"}
                    right={<Text style={{ color: theme.primary, fontWeight: '800', fontSize: 13 }}>{((t as any)[`theme${currentSetting.charAt(0).toUpperCase() + currentSetting.slice(1)}`] || currentSetting).toUpperCase()}</Text>} 
                    onPress={toggleTheme} 
                    theme={theme} 
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', marginHorizontal: 16 }} />
                <SettingItem 
                    icon={<Languages size={18} color="#10B981" />} 
                    label={t.language} 
                    bg={isDark ? "rgba(16, 185, 129, 0.1)" : "#10B98115"}
                    right={<Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: 13 }}>{language.toUpperCase()}</Text>} 
                    onPress={toggleLanguage} 
                    theme={theme} 
                />
                <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', marginHorizontal: 16 }} />
                <SettingItem 
                    icon={<Shield size={18} color="#2DD4BF" />} 
                    label={(t as any).streakFreeze || 'Streak Shield'} 
                    bg={isDark ? "rgba(45, 212, 191, 0.1)" : "#2DD4BF15"}
                    right={<Text style={{ color: streakFreezeAvailable ? '#2DD4BF' : theme.onSurface, fontWeight: '800', fontSize: 13 }}>{streakFreezeAvailable ? (t as any).streakFreezeAvail || 'Ready' : (t as any).streakFreezeUsed || 'Used'}</Text>} 
                    onPress={handleStreakFreeze} 
                    theme={theme} 
                />
            </View>
            <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: theme.error + '10', marginTop: isShortDevice ? 20 : 32, padding: isSmallDevice ? 16 : 20 }]}>
                <LogOut size={18} color={theme.error} />
                <Text style={[styles.logoutText, { color: theme.error, fontSize: isSmallDevice ? 14 : 15 }]}>{t.logout}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <BottomNavBar />

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditModalVisible(false)} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', paddingBottom: Platform.OS === 'ios' ? 48 : 24 }]}>
                <View style={[styles.modalHandle, { backgroundColor: theme.outlineVariant + '40' }]} />
                <Text style={[styles.modalTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 20 }]}>
                  {(t as any).editProfile || 'Edit Profile'}
                </Text>

                {/* Name input */}
                <View style={{ width: '100%', marginBottom: 20 }}>
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                    {(t as any).editName || 'Display Name'}
                  </Text>
                  <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                    <TextInput
                      value={newName}
                      onChangeText={setNewName}
                      placeholder={(t as any).namePlaceholder || 'Your name'}
                      placeholderTextColor={theme.onSurfaceVariant + '60'}
                      style={[styles.nameInput, { color: theme.onSurface }]}
                    />
                  </View>
                </View>

                {/* Avatar selection */}
                <View style={{ width: '100%', marginBottom: 20 }}>
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>Avatar</Text>
                  <View style={[styles.avatarGrid, { gap: isSmallDevice ? 12 : 16 }]}>
                    {AVATAR_CONFIGS.map((config) => (
                      <TouchableOpacity
                        key={config.id}
                        onPress={() => { Haptics.selectionAsync(); setSelectedAvatar(config.key); }}
                        style={[
                          styles.avatarOption,
                          {
                            borderColor: selectedAvatar === config.key ? theme.primary : theme.primary + '30',
                            borderWidth: selectedAvatar === config.key ? 3 : 2,
                            width: isSmallDevice ? 56 : 64,
                            height: isSmallDevice ? 56 : 64,
                            borderRadius: isSmallDevice ? 28 : 32,
                          }
                        ]}
                      >
                        <Image source={config.image} style={styles.image} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Daily focus goal */}
                <View style={{ width: '100%', marginBottom: 24 }}>
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                    {(t as any).dailyFocusGoal || 'Daily Focus Goal'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {GOAL_OPTIONS.map((g) => (
                      <TouchableOpacity
                        key={g}
                        onPress={() => { Haptics.selectionAsync(); setSelectedGoal(g); }}
                        style={[
                          styles.goalChip,
                          { backgroundColor: selectedGoal === g ? theme.primary : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow) }
                        ]}
                      >
                        <Text style={{ color: selectedGoal === g ? 'white' : theme.onSurfaceVariant, fontWeight: '800', fontSize: 12 }}>
                          {g}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Save button */}
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                >
                  {savingProfile
                    ? <ActivityIndicator color="white" />
                    : <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>{t.save}</Text>
                  }
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function SettingItem({ icon, label, right, onPress, theme, isSmall, bg }: any) {
    return (
        <TouchableOpacity style={[styles.settingItem, { padding: isSmall ? 14 : 18 }]} onPress={onPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmall ? 10 : 12 }}>
                <View style={[styles.iconBox, { backgroundColor: bg || (theme.colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') }]}>{icon}</View>
                <Text style={[styles.settingLabel, { color: theme.onSurface, fontSize: isSmall ? 14 : 15 }]}>{label}</Text>
            </View>
            {right || <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.3} />}
        </TouchableOpacity>
    );
}

function Divider({ theme }: any) {
    return <View style={{ height: 1, backgroundColor: theme.outlineVariant + '15', marginHorizontal: 16 }} />;
}

const styles = StyleSheet.create({
  header: { alignItems: 'center' },
  avatarLarge: { borderWidth: 3, padding: 4 },
  image: { width: '100%', height: '100%' },
  name: { fontWeight: '900', letterSpacing: -1 },
  email: { opacity: 0.6, marginTop: 4 },
  editBtn: { marginTop: 20, paddingHorizontal: 24, borderRadius: 100 },
  editBtnText: { color: 'white', fontWeight: '800' },
  statsGrid: { flexDirection: 'row' },
  statValue: { fontWeight: '900', marginTop: 8 },
  statLabel: { fontWeight: '800', opacity: 0.6, marginTop: 2 },
  settingsSection: { },
  sectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase', opacity: 0.6 },
  settingsCard: { borderRadius: 24, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontWeight: '700' },
  skeletonCircle: { width: 24, height: 24, borderRadius: 12 },
  skeletonLine: { height: 14, borderRadius: 7 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 24 },
  logoutText: { fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontWeight: '900', marginBottom: 24, textAlign: 'center' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  avatarOption: { padding: 4, overflow: 'hidden' },
  inputGroup: { borderRadius: 16, paddingHorizontal: 16, height: 48, justifyContent: 'center' },
  nameInput: { fontSize: 15, fontWeight: '600' },
  goalChip: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  saveBtn: { width: '100%', paddingVertical: 16, borderRadius: 100, alignItems: 'center' },
});
