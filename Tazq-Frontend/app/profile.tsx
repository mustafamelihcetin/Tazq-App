import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { User, Bell, Moon, Languages, Shield, LogOut, ChevronRight, Award, Zap, Target } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { user, logout } = useAuthStore();
  const { t, language, setLanguage } = useLanguageStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      t.logout,
      t.confirmLogout,
      [
        { text: t.cancel, style: "cancel" },
        { text: t.yes, style: "destructive", onPress: () => {
             Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
             logout();
             router.replace('/login');
        }}
      ]
    );
  };

  const toggleLanguage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(language === 'tr' ? 'en' : 'tr');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View style={styles.header}>
            <MotiView 
                from={{ scale: 0.5, opacity: 0, rotate: '-10deg' }}
                animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
                transition={{ type: 'spring', damping: 15 }}
                style={[styles.avatarLarge, { borderColor: theme.primary + '30' }]}
            >
                <Image 
                    key={user?.id || 'profile'}
                    source={{ 
                        uri: user?.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${user?.name || 'Tazq'}` 
                    }} 
                    style={styles.image}
                />
            </MotiView>
            <MotiView 
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 200 }}
                style={{ alignItems: 'center', marginTop: 16 }}
            >
                <Text style={[styles.name, { color: theme.onSurface }]}>{user?.name || 'User'}</Text>
                <Text style={[styles.email, { color: theme.onSurfaceVariant }]}>{user?.email || 'user@tazq.com'}</Text>
                
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: theme.primary }]}>
                    <Text style={styles.editBtnText}>{t.editProfile}</Text>
                </TouchableOpacity>
            </MotiView>
          </View>

          {/* Stats Bento */}
          <View style={styles.statsGrid}>
            <BentoCard index={1} style={{ flex: 1, alignItems: 'center' }}>
                <Award size={24} color={theme.primary} />
                <MotiText 
                    key={user?.totalFocusHours}
                    from={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={[styles.statValue, { color: theme.onSurface }]}
                >
                    {user?.totalFocusHours || 0}
                </MotiText>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.hours} Focus</Text>
            </BentoCard>
            <BentoCard index={2} style={{ flex: 1, alignItems: 'center' }}>
                <Target size={24} color={theme.secondary} />
                <MotiText 
                    key={user?.completedTasksCount}
                    from={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={[styles.statValue, { color: theme.onSurface }]}
                >
                    {user?.completedTasksCount || 0}
                </MotiText>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.completedTasks}</Text>
            </BentoCard>
            <BentoCard index={3} style={{ flex: 1, alignItems: 'center' }}>
                <Zap size={24} color={theme.tertiary} />
                <MotiText 
                    key={user?.activeStreak}
                    from={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={[styles.statValue, { color: theme.onSurface }]}
                >
                    {user?.activeStreak || 0}
                </MotiText>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.activeStreak}</Text>
            </BentoCard>
          </View>

          {/* Settings List */}
          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.onSurfaceVariant }]}>{t.settings}</Text>
            
            <MotiView 
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 400 }}
                style={[styles.settingsCard, { backgroundColor: theme.surfaceContainerLow }]}
            >
                <SettingItem 
                    icon={<Bell size={20} color={theme.onSurfaceVariant} />} 
                    label={t.notifications} 
                    theme={theme}
                />
                <Divider theme={theme} />
                <SettingItem 
                    icon={<Languages size={20} color={theme.onSurfaceVariant} />} 
                    label={t.language} 
                    right={<Text style={{ color: theme.primary, fontWeight: '700' }}>{language.toUpperCase()}</Text>}
                    onPress={toggleLanguage}
                    theme={theme}
                />
                <Divider theme={theme} />
                <SettingItem 
                    icon={<Shield size={20} color={theme.onSurfaceVariant} />} 
                    label={t.security} 
                    theme={theme}
                />
            </MotiView>

            <TouchableOpacity 
                onPress={handleLogout}
                style={[styles.logoutBtn, { backgroundColor: theme.error + '15' }]}
            >
                <LogOut size={20} color={theme.error} />
                <Text style={[styles.logoutText, { color: theme.error }]}>{t.logout}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
      <BottomNavBar />
    </View>
  );
}

function SettingItem({ icon, label, right, onPress, theme }: any) {
    return (
        <TouchableOpacity style={styles.settingItem} onPress={onPress}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.iconBox}>{icon}</View>
                <Text style={[styles.settingLabel, { color: theme.onSurface }]}>{label}</Text>
            </View>
            {right || <ChevronRight size={18} color={theme.onSurfaceVariant} opacity={0.3} />}
        </TouchableOpacity>
    );
}

function Divider({ theme }: any) {
    return <View style={{ height: 1, backgroundColor: theme.outlineVariant + '15', marginHorizontal: 16 }} />;
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    padding: 4,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  email: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.6,
  },
  editBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 100,
  },
  editBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginTop: 40,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
    opacity: 0.6,
  },
  settingsSection: {
    marginTop: 40,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },
  settingsCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutBtn: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
    borderRadius: 24,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '800',
  }
});
