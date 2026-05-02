import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Alert, Modal, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Moon, Languages, LogOut, ChevronRight, Award, Zap, Target } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { AuthService, FocusService } from '../services/api';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

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

export default function ProfileScreen() {
  const { theme, colorScheme, setTheme, currentSetting } = useAppTheme();
  const { user, setUser, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const isDark = colorScheme === 'dark';

  const isSmallDevice = width < 380;
  const isShortDevice = height < 750;

  const [avatarModalVisible, setAvatarModalVisible] = React.useState(false);
  const [stats, setStats] = useState({ totalFocusHours: 0, completedTasksCount: 0, activeStreak: 0 });

  useEffect(() => {
    FocusService.getStats().then((s) => {
      setStats({ totalFocusHours: s.totalFocusHours ?? 0, completedTasksCount: s.completedTasksCount ?? 0, activeStreak: s.activeStreak ?? 0 });
    }).catch((e) => {
        if (e.response?.status !== 401) console.warn('getStats error:', e.message);
    });
  }, []);

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

  const selectAvatar = async (name: string) => {
    if (!user) return;
    setUser({ ...user, avatar: name });
    setAvatarModalVisible(false);
    try {
        await AuthService.updateProfile({ avatar: name });
    } catch (e) {
        console.log('Avatar update failed:', e);
    }
  };

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
                <TouchableOpacity onPress={() => setAvatarModalVisible(true)} style={[styles.editBtn, { backgroundColor: theme.primary, paddingVertical: isSmallDevice ? 8 : 10 }]}>
                    <Text style={[styles.editBtnText, { fontSize: isSmallDevice ? 11 : 13 }]}>{t.chooseAvatar}</Text>
                </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.statsGrid, { gap: isSmallDevice ? 8 : 12, marginTop: isShortDevice ? 24 : 40 }]}>
            <BentoCard index={1} style={{ flex: 1, alignItems: 'center', padding: isSmallDevice ? 12 : 16 }}>
                <Award size={isSmallDevice ? 18 : 22} color={theme.primary} />
                <Text style={[styles.statValue, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 22 }]}>{stats.totalFocusHours}</Text>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 9 : 10 }]}>{t.hours}</Text>
            </BentoCard>
            <BentoCard index={2} style={{ flex: 1, alignItems: 'center', padding: isSmallDevice ? 12 : 16 }}>
                <Target size={isSmallDevice ? 18 : 22} color={theme.secondary} />
                <Text style={[styles.statValue, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 22 }]}>{stats.completedTasksCount}</Text>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 9 : 10 }]}>{t.tasks}</Text>
            </BentoCard>
            <BentoCard index={3} style={{ flex: 1, alignItems: 'center', padding: isSmallDevice ? 12 : 16 }}>
                <Zap size={isSmallDevice ? 18 : 22} color={stats.activeStreak > 0 ? '#ff9f0a' : theme.tertiary} fill={stats.activeStreak > 0 ? '#ff9f0a' : 'none'} />
                <Text style={[styles.statValue, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 22 }]}>{stats.activeStreak > 0 ? `🔥 ${stats.activeStreak}` : '0'}</Text>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 9 : 10 }]}>{t.streak}</Text>
            </BentoCard>
          </View>

          <View style={[styles.settingsSection, { marginTop: isShortDevice ? 24 : 40 }]}>
            <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant }]}>{t.settings}</Text>
            <View style={[styles.settingsCard, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderWidth: 1.2 }]}>
                <SettingItem icon={<Bell size={18} color={theme.onSurfaceVariant} />} label={t.notifications} theme={theme} isSmall={isSmallDevice} />
                <Divider theme={theme} />
                <SettingItem icon={<Moon size={18} color={theme.onSurfaceVariant} />} label={t.appearance} right={<Text style={{ color: theme.primary, fontWeight: '800', fontSize: isSmallDevice ? 11 : 13 }}>{currentSetting.toUpperCase()}</Text>} onPress={toggleTheme} theme={theme} isSmall={isSmallDevice} />
                <Divider theme={theme} />
                <SettingItem icon={<Languages size={18} color={theme.onSurfaceVariant} />} label={t.language} right={<Text style={{ color: theme.primary, fontWeight: '800', fontSize: isSmallDevice ? 11 : 13 }}>{language.toUpperCase()}</Text>} onPress={toggleLanguage} theme={theme} isSmall={isSmallDevice} />
            </View>
            <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: theme.error + '10', marginTop: isShortDevice ? 20 : 32, padding: isSmallDevice ? 16 : 20 }]}>
                <LogOut size={18} color={theme.error} />
                <Text style={[styles.logoutText, { color: theme.error, fontSize: isSmallDevice ? 14 : 15 }]}>{t.logout}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={avatarModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setAvatarModalVisible(false)} />
            <View style={[styles.modalContent, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', paddingBottom: Platform.OS === 'ios' ? 48 : 24 }]}>
                <View style={[styles.modalHandle, { backgroundColor: theme.outlineVariant + '40' }]} />
                <Text style={[styles.modalTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 20 }]}>{t.chooseAvatar}</Text>
                <View style={[styles.avatarGrid, { gap: isSmallDevice ? 12 : 16 }]}>
                    {AVATAR_CONFIGS.map((config) => (
                        <TouchableOpacity 
                            key={config.id} 
                            onPress={() => selectAvatar(config.key)} 
                            style={[styles.avatarOption, { borderColor: theme.primary + '30', width: isSmallDevice ? 60 : 70, height: isSmallDevice ? 60 : 70, borderRadius: isSmallDevice ? 30 : 35 }]}
                        >
                            <Image source={config.image} style={styles.image} />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>
      </Modal>
      <BottomNavBar />
    </View>
  );
}

function SettingItem({ icon, label, right, onPress, theme, isSmall }: any) {
    return (
        <TouchableOpacity style={[styles.settingItem, { padding: isSmall ? 14 : 18 }]} onPress={onPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: isSmall ? 10 : 12 }}>
                <View style={styles.iconBox}>{icon}</View>
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
  settingsCard: { borderRadius: 24, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontWeight: '700' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 24 },
  logoutText: { fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontWeight: '900', marginBottom: 24, textAlign: 'center' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  avatarOption: { borderWidth: 2, padding: 4 },
});
