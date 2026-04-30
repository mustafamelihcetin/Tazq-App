import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { BentoCard } from '../components/BentoCard';
import { DynamicIsland } from '../components/DynamicIsland';
import { BottomNavBar } from '../components/BottomNavBar';
import { MotiView, MotiText } from 'moti';
import { Settings, TrendingUp, Calendar, Plus, FileText, ChevronRight, LogOut, LayoutGrid, Clock, Sparkles, User as UserIcon } from 'lucide-react-native';
import { TaskService } from '../services/api';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { tasks, isLoading, setTasks, setLoading } = useTaskStore();
  const { logout, user } = useAuthStore();
  const { t } = useLanguageStore();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const router = useRouter();

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchTasks error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top Bar */}
        <MotiView 
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            style={styles.topBar}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.avatarContainer, { borderColor: theme.primary + '20' }]}>
                    <Image 
                        key={user?.id || 'guest'}
                        source={{ 
                            uri: user?.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${user?.name || 'Tazq'}` 
                        }} 
                        style={styles.avatar}
                        defaultSource={{ uri: 'https://ui-avatars.com/api/?name=T&background=0058bb&color=fff' }}
                    />
                </View>
                <MotiText 
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 200 }}
                    style={[styles.logoText, { color: theme.onSurface }]}
                >
                    TAZQ
                </MotiText>
            </View>
            <TouchableOpacity 
                onPress={() => router.push('/profile')}
                style={[styles.settingsBtn, { backgroundColor: theme.surfaceContainerLow }]}
            >
                <Settings size={20} color={theme.onSurfaceVariant} />
            </TouchableOpacity>
        </MotiView>

        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTasks} tintColor={theme.primary} />}
        >
          {/* Greeting */}
          <MotiView 
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            style={styles.greetingContainer}
          >
            <Text style={[styles.greetingTitle, { color: theme.onSurface }]}>{t.greeting}</Text>
            <MotiText 
                key={tasks.length}
                from={{ opacity: 0, translateY: 5 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={[styles.greetingSub, { color: theme.onSurfaceVariant }]}
            >
                {tasks.length > 0 ? t.summary.replace('{count}', tasks.length.toString()) : t.summary}
            </MotiText>
          </MotiView>

          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 300, type: 'spring' }}
            style={styles.islandWrapper}
          >
             <DynamicIsland />
          </MotiView>

          <View style={styles.bentoGrid}>
            
            {/* Weekly Progress */}
            <BentoCard index={1} style={{ width: '100%', minHeight: 220 }}>
              <View style={[styles.cardHeader, { backgroundColor: 'transparent' }]}>
                <View style={{ backgroundColor: 'transparent' }}>
                  <Text style={[styles.cardTitle, { color: theme.onSurface }]}>{t.weeklyProgress}</Text>
                  <Text style={[styles.cardSub, { color: theme.onSurfaceVariant }]}>{t.aheadOfSchedule}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: theme.tertiary + '20' }]}>
                    <TrendingUp size={12} color={theme.tertiary} />
                    <Text style={[styles.badgeText, { color: theme.tertiary }]}>{t.onTrack}</Text>
                </View>
              </View>
              
              <View style={styles.chartContainer}>
                 {[40, 65, 35, 85, 55, 30].map((h, i) => (
                    <View key={i} style={styles.chartBarWrapper}>
                        {i === 3 && (
                            <MotiView 
                                from={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 800 + (i * 100) }}
                                style={[styles.todayTooltip, { backgroundColor: theme.surfaceContainerHigh }]}
                            >
                                <Text style={[styles.todayText, { color: theme.onSurface }]}>Bugün</Text>
                            </MotiView>
                        )}
                        <MotiView 
                            from={{ height: 0 }}
                            animate={{ height: Math.max(h, 4) }} // Ensure at least 4px height
                            transition={{ type: 'timing', duration: 1000, delay: 500 + (i * 100) }}
                            style={[
                                styles.chartBar, 
                                { 
                                    backgroundColor: i === 3 ? theme.primary : theme.primaryContainer + (colorScheme === 'dark' ? '40' : '60'),
                                    width: 16,
                                    minHeight: 4,
                                }
                            ]} 
                        />
                    </View>
                 ))}
              </View>
            </BentoCard>

            <View style={styles.asymmetricRow}>
                {/* Upcoming */}
                <BentoCard index={2} style={{ flex: 1.5 }} glass={Platform.OS === 'ios'}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, backgroundColor: 'transparent' }}>
                        <Calendar size={18} color={theme.secondary} />
                        <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>{t.upcoming}</Text>
                    </View>
                    <View style={[styles.agendaItem, { backgroundColor: 'transparent' }]}>
                        <View style={[styles.agendaIndicator, { backgroundColor: theme.secondary }]} />
                        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                            <Text style={[styles.agendaName, { color: theme.onSurface }]} numberOfLines={1}>Design Sync</Text>
                            <Text style={[styles.agendaTime, { color: theme.onSurfaceVariant }]}>10:00 - 11:30</Text>
                        </View>
                    </View>
                </BentoCard>

                {/* Tasks Count */}
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
                    <View style={[styles.actionIconWrapper, { backgroundColor: theme.primaryContainer }]}>
                        <Plus size={24} color={colorScheme === 'dark' ? '#fff' : theme.primary} />
                    </View>
                    <Text style={[styles.actionText, { color: theme.onSurface }]}>{t.newTask}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    onPress={() => Alert.alert(t.draftNote, t.waitingForAction)}
                    style={[styles.actionBtn, { backgroundColor: theme.surfaceContainerLow }]}
                >
                    <View style={[styles.actionIconWrapper, { backgroundColor: theme.secondaryContainer }]}>
                        <FileText size={22} color={colorScheme === 'dark' ? '#fff' : theme.secondary} />
                    </View>
                    <Text style={[styles.actionText, { color: theme.onSurface }]}>{t.draftNote}</Text>
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
  topBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -1,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  greetingContainer: {
    paddingHorizontal: 28,
    marginTop: 24,
  },
  greetingTitle: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 52,
  },
  greetingSub: {
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
    opacity: 0.8,
  },
  islandWrapper: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  bentoGrid: {
    paddingHorizontal: 24,
    marginTop: 12,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 120,
    marginTop: 24,
    paddingHorizontal: 8,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderRadius: 12,
  },
  todayTooltip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 0, // ANDROID BEYAZ KUTU KATİLİ
  },
  todayText: {
    fontSize: 10,
    fontWeight: '800',
  },
  asymmetricRow: {
    flexDirection: 'row',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  agendaIndicator: {
    width: 3,
    height: 32,
    borderRadius: 3,
  },
  agendaName: {
    fontSize: 14,
    fontWeight: '700',
  },
  agendaTime: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.6,
  },
  countText: {
    fontSize: 42,
    fontWeight: '900',
  },
  countLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 40,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  }
});
