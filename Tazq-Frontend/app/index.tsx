import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { BentoCard } from '../components/BentoCard';
import { DynamicIsland } from '../components/DynamicIsland';
import { BottomNavBar } from '../components/BottomNavBar';
import { MotiView, MotiText } from 'moti';
import { TrendingUp, Calendar, Plus, FileText, Zap } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { TaskService } from '../services/api';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../hooks/useAppTheme';

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

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { tasks, isLoading, setTasks, setLoading } = useTaskStore();
  const { user } = useAuthStore();
  const { t } = useLanguageStore();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.warn('fetchTasks error:', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        
        {/* Floating TopBar (Stitch UI Style) */}
        <View style={[styles.topBarWrapper, { top: Math.max(insets.top, 20) }]}>
            <MotiView
                from={{ translateY: -20, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                style={[
                    styles.floatingTopBar,
                    {
                        backgroundColor: isDark ? 'rgba(14,14,14,0.6)' : 'rgba(255,255,255,0.7)',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    },
                    isDark ? styles.darkTopBarShadow : styles.lightTopBarShadow
                ]}
            >
                <BlurView 
                    intensity={isDark ? 50 : 30} 
                    tint={colorScheme} 
                    style={StyleSheet.absoluteFill} 
                />
                <View style={styles.topBarContent}>
                    <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatarContainer}>
                        <Image 
                            source={getAvatarSource(user?.avatar || null)} 
                            style={styles.avatar} 
                        />
                    </TouchableOpacity>
                    
                    <Text style={[styles.brandText, { color: isDark ? '#94aaff' : '#0058bb' }]}>TAZQ</Text>
                    
                    <TouchableOpacity style={styles.boltBtn}>
                        <Zap size={20} color={isDark ? theme.primary : theme.onSurfaceVariant} fill={isDark ? theme.primary : 'none'} />
                    </TouchableOpacity>
                </View>
            </MotiView>
        </View>

        <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingTop: 130, paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTasks} tintColor={theme.primary} />}
        >
            {/* Welcome Hero */}
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={styles.heroSection}
            >
                <Text style={[styles.greeting, { color: theme.onSurface }]}>
                    {isDark ? t.greetingEvening : t.greetingMorning}, 
                    <Text style={{ color: theme.primary }}>{user?.name?.split(' ')[0] || 'System'}</Text>
                </Text>
                <Text style={[styles.subGreeting, { color: theme.onSurfaceVariant }]}>
                    {isDark ? 'Odaklanma seansın seni bekliyor.' : t.executiveSummary}
                </Text>
            </MotiView>

            {/* Focus Widget */}
            <DynamicIsland />

            {/* Bento Grid */}
            <View style={styles.bentoGrid}>
                {/* Weekly Progress */}
                <BentoCard index={1} style={{ width: '100%', minHeight: 200 }}>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={[styles.cardTitle, { color: theme.onSurface }]}>{t.weeklyProgress}</Text>
                            <Text style={[styles.cardSub, { color: theme.onSurfaceVariant }]}>{t.aheadOfSchedule}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: theme.tertiary + '15' }]}>
                            <TrendingUp size={14} color={theme.tertiary} />
                            <Text style={[styles.badgeText, { color: theme.tertiary }]}>{t.onTrack}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.chartContainer}>
                        {[40, 60, 30, 80, 50, 20].map((h, i) => (
                            <View key={i} style={[styles.chartBar, { height: `${h}%`, backgroundColor: i === 3 ? theme.primary : theme.surfaceVariant }]} />
                        ))}
                    </View>
                </BentoCard>

                <View style={styles.bentoRow}>
                    {/* Upcoming */}
                    <BentoCard index={2} style={{ flex: 1.5 }}>
                        <View style={styles.sectionHeader}>
                            <Calendar size={18} color={theme.secondary} />
                            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>{t.upcoming}</Text>
                        </View>
                        <View style={styles.agendaItem}>
                            <View style={[styles.indicator, { backgroundColor: theme.secondary }]} />
                            <View>
                                <Text style={[styles.agendaName, { color: theme.onSurface }]}>Design Sync</Text>
                                <Text style={[styles.agendaTime, { color: theme.onSurfaceVariant }]}>10:00 - 11:30</Text>
                            </View>
                        </View>
                    </BentoCard>

                    {/* Stats Counter */}
                    <BentoCard index={3} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={[styles.countText, { color: theme.primary }]}>{tasks.length}</Text>
                        <Text style={[styles.countLabel, { color: theme.onSurfaceVariant }]}>{t.tasks}</Text>
                    </BentoCard>
                </View>

                {/* Quick Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/tasks'); }}
                        style={[styles.actionBtn, { backgroundColor: theme.surfaceContainerLow }]}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: theme.primaryContainer }]}>
                            <Plus size={24} color={isDark ? '#fff' : theme.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: theme.onSurface }]}>{t.newTask}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
                        style={[styles.actionBtn, { backgroundColor: theme.surfaceContainerLow }]}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: theme.secondaryContainer }]}>
                            <FileText size={22} color={isDark ? '#fff' : theme.secondary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: theme.onSurface }]}>{t.draftNote}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
      </SafeAreaView>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarWrapper: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 100,
    alignItems: 'center',
  },
  floatingTopBar: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1.2,
  },
  lightTopBarShadow: {
    shadowColor: '#2d2f31',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 8,
  },
  darkTopBarShadow: {
    shadowColor: '#3367ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -1.2,
    fontFamily: Platform.OS === 'ios' ? 'Plus Jakarta Sans' : 'sans-serif',
  },
  boltBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingHorizontal: 28,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 42,
    fontFamily: Platform.OS === 'ios' ? 'Plus Jakarta Sans' : 'sans-serif',
  },
  subGreeting: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 6,
    opacity: 0.7,
  },
  bentoGrid: {
    paddingHorizontal: 24,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    marginTop: 20,
    paddingHorizontal: 10,
  },
  chartBar: {
    width: 14,
    borderRadius: 7,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  indicator: {
    width: 3,
    height: 30,
    borderRadius: 2,
  },
  agendaName: {
    fontSize: 15,
    fontWeight: '700',
  },
  agendaTime: {
    fontSize: 11,
    opacity: 0.6,
  },
  countText: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
  },
  countLabel: {
    fontSize: 10,
    fontWeight: '900',
    opacity: 0.5,
    letterSpacing: 1,
    marginTop: -4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 24,
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '800',
  }
});
