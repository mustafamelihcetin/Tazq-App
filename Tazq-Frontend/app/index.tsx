import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Platform, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { BentoCard } from '../components/BentoCard';
import { DynamicIsland } from '../components/DynamicIsland';
import { BottomNavBar } from '../components/BottomNavBar';
import { MotiView, MotiText } from 'moti';
import { Plus, FileText, Zap, Play, Rocket, ChevronRight } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { TaskService, FocusService, DailyFocusData } from '../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../hooks/useAppTheme';
import { TazqLogo } from '../components/TazqLogo';
import { useFocusStore } from '../store/useFocusStore';
import { LinearGradient } from 'expo-linear-gradient';
import i18n from 'i18n-js';
import { parseTaskHint } from '../utils/taskParser';

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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { tasks, isLoading, setTasks, setLoading, addTask } = useTaskStore();
  const { user } = useAuthStore();
  const { t } = useLanguageStore();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const isSmallDevice = width < 380;
  const isShortDevice = height < 750;

  const { setCurrentTask, setDuration, setIsActive } = useFocusStore();

  const topTask = tasks.find(t => !t.isCompleted);

  const priorityColor = (p: string) => {
    if (p === 'High') return '#ff3b30';
    if (p === 'Medium') return '#ff9f0a';
    return '#34c759';
  };

  const startFocus = (taskTitle: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCurrentTask(taskTitle);
    setDuration(25); // Default 25m
    setIsActive(true); // Auto-start the mission
    router.push('/focus');
  };

  const [quickDraftVisible, setQuickDraftVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [weeklyFocus, setWeeklyFocus] = useState<DailyFocusData[]>([]);
  const [streak, setStreak] = useState(0);

  // Compute daily goal from real data
  const todayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate).toDateString() === new Date().toDateString();
  });
  const todayCompleted = todayTasks.filter(t => t.isCompleted).length;
  const dailyGoal = todayTasks.length || 1;

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

  const fetchStats = async () => {
    try {
      const stats = await FocusService.getStats();
      setWeeklyFocus(stats.weeklyFocus || []);
      setStreak(stats.activeStreak || 0);
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.warn('fetchStats error:', e.message);
      }
    }
  };

  const handleQuickSave = async () => {
    if (!draftTitle.trim()) return;
    setIsSavingDraft(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
        const hint = parseTaskHint(draftTitle.trim());
        const payload = {
            title: draftTitle.trim(),
            description: '',
            priority: hint.priority || 'Low',
            isCompleted: false,
            dueDate: hint.dueDate || new Date().toISOString(),
            dueTime: hint.dueTime || null,
            tags: hint.tags?.length ? hint.tags : ['Draft']
        };
        const created = await TaskService.createTask(payload as any);
        addTask(created);
        setDraftTitle('');
        setQuickDraftVisible(false);
        
        // Şık bir yönlendirme seçeneği
        Alert.alert(
            "✍️ " + t.taskAdded,
            `"${payload.title}" ${i18n.locale.startsWith('tr') ? 'taslaklara eklendi.' : 'added to drafts.'}`,
            [
                { text: t.cancel, style: 'cancel' },
                { text: i18n.locale.startsWith('tr') ? 'Listeyi Aç' : 'View List', onPress: () => router.push('/tasks') }
            ]
        );
    } catch (error) {
        Alert.alert(t.errorTitle, t.saveError);
    } finally {
        setIsSavingDraft(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return t.greetingMorning;
    if (hour >= 12 && hour < 18) return t.greetingAfternoon;
    if (hour >= 18 && hour < 23) return t.greetingEvening;
    return t.greetingNight;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        
        {/* Floating TopBar */}
        <View style={[styles.topBarWrapper, { top: Math.max(insets.top, 16) }]}>
            <MotiView
                from={{ translateY: -20, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                style={[
                    styles.floatingTopBar,
                    {
                        backgroundColor: isDark ? 'rgba(14,14,14,0.6)' : 'rgba(255,255,255,0.7)',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        maxWidth: width - 48
                    },
                    isDark ? styles.darkTopBarShadow : styles.lightTopBarShadow
                ]}
            >
                <BlurView 
                    intensity={isDark ? 50 : 30} 
                    tint={colorScheme} 
                    style={StyleSheet.absoluteFill} 
                />
                <View style={[styles.topBarContent, { paddingHorizontal: isSmallDevice ? 12 : 16 }]}>
                    <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatarContainer}>
                        <Image 
                            source={getAvatarSource(user?.avatar || null)} 
                            style={styles.avatar} 
                        />
                    </TouchableOpacity>
                    
                    <TazqLogo width={isSmallDevice ? 70 : 80} height={28} />
                    
                    <View style={styles.boltBtn} />
                </View>
            </MotiView>
        </View>

        <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingTop: isShortDevice ? 110 : 130, paddingBottom: 100 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTasks} tintColor={theme.primary} />}
        >
            {/* Welcome Hero */}
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={[styles.heroSection, { paddingHorizontal: isSmallDevice ? 20 : 28 }]}
            >
                <Text style={[styles.greeting, { color: theme.onSurface, fontSize: isSmallDevice ? 28 : 36, lineHeight: isSmallDevice ? 34 : 42 }]}>
                    {getGreeting()},
                    <Text style={{ color: theme.primary }}> {user?.name?.split(' ')[0] || 'System'}</Text>
                </Text>
                <Text style={[styles.subGreeting, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 14 : 16 }]}>
                    {t.executiveSummary}
                </Text>
            </MotiView>

            {/* Focus Widget */}
            <DynamicIsland />

            {/* Next Mission / Highway Widget */}
            <View style={{ paddingHorizontal: isSmallDevice ? 20 : 24, marginBottom: isSmallDevice ? 20 : 24 }}>
                <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                >
                    <BentoCard index={0} style={[styles.nextMissionCard, { minHeight: isShortDevice ? 160 : 180 }]}>
                        <LinearGradient
                            colors={topTask?.priority === 'High' 
                                ? ['#ff3b30', '#1a1a1a'] 
                                : topTask?.priority === 'Medium' 
                                ? ['#ff9f0a', '#1a1a1a'] 
                                : ['#34c759', '#1a1a1a']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.25 : 0.12 }]}
                        />
                        <View style={styles.missionHeader}>
                            <View style={[styles.missionBadge, { backgroundColor: (topTask ? priorityColor(topTask.priority) : theme.primary) + '20' }]}>
                                <Rocket size={12} color={topTask ? priorityColor(topTask.priority) : theme.primary} />
                                <Text style={[styles.missionBadgeText, { color: topTask ? priorityColor(topTask.priority) : theme.primary }]}>{t.activeTask.toUpperCase()}</Text>
                            </View>
                            {topTask?.priority === 'High' && (
                                <View style={[styles.missionBadge, { backgroundColor: theme.error + '20' }]}>
                                    <Zap size={12} color={theme.error} fill={theme.error} />
                                    <Text style={[styles.missionBadgeText, { color: theme.error }]}>URGENT</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.missionContent}>
                            <Text style={[styles.missionTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 20 : 24 }]} numberOfLines={2}>
                                {topTask ? topTask.title : t.noTasksHint}
                            </Text>
                            <Text style={[styles.missionSub, { color: theme.onSurfaceVariant }]}>
                                {topTask ? (topTask.description || t.waitingForAction) : t.allTasksReady}
                            </Text>
                        </View>

                        <View style={styles.missionFooter}>
                            {topTask ? (
                                <TouchableOpacity 
                                    onPress={() => startFocus(topTask.title)}
                                    style={[styles.startBtn, { backgroundColor: theme.primary }]}
                                >
                                    <Play size={18} color="white" fill="white" />
                                    <Text style={styles.startBtnText}>{t.deepFocus}</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    onPress={() => router.push('/tasks')}
                                    style={[styles.startBtn, { backgroundColor: theme.surfaceContainerHigh }]}
                                >
                                    <Plus size={18} color={theme.onSurface} />
                                    <Text style={[styles.startBtnText, { color: theme.onSurface }]}>{t.addTask}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => router.push('/tasks')} style={styles.seeAllBtn}>
                                <Text style={[styles.seeAllText, { color: theme.onSurfaceVariant }]}>{t.filterAll}</Text>
                                <ChevronRight size={14} color={theme.onSurfaceVariant} />
                            </TouchableOpacity>
                        </View>
                    </BentoCard>
                </MotiView>
            </View>

            {/* Bento Grid */}
            <View style={[styles.bentoGrid, { paddingHorizontal: isSmallDevice ? 20 : 24, gap: isSmallDevice ? 12 : 16 }]}>
                <View style={[styles.bentoRow, { gap: isSmallDevice ? 12 : 16 }]}>
                    {/* Weekly Progress */}
                    <BentoCard index={1} style={{ flex: 1.5, minHeight: isShortDevice ? 140 : 160 }}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.cardTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 14 : 16 }]}>{t.weeklyProgress}</Text>
                        </View>
                        <View style={[styles.chartContainer, { height: isShortDevice ? 60 : 80, marginTop: 10 }]}>
                            {(weeklyFocus.length > 0 ? weeklyFocus : [{minutes:0},{minutes:0},{minutes:0},{minutes:0},{minutes:0},{minutes:0},{minutes:0}]).map((d: any, i: number) => {
                                const maxMin = Math.max(...(weeklyFocus.length > 0 ? weeklyFocus.map(w => w.minutes) : [1]));
                                const pct = maxMin > 0 ? Math.max((d.minutes / maxMin) * 100, 5) : 5;
                                const isToday = i === (weeklyFocus.length > 0 ? weeklyFocus.length - 1 : 6);
                                return <View key={i} style={[styles.chartBar, { height: `${pct}%`, backgroundColor: isToday ? theme.primary : theme.surfaceContainerHigh, width: isSmallDevice ? 8 : 10 }]} />;
                            })}
                        </View>
                        {weeklyFocus.length > 0 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 10 }}>
                                {weeklyFocus.map((d, i) => (
                                    <Text key={i} style={{ fontSize: 8, color: theme.onSurfaceVariant, fontWeight: '700', opacity: 0.5 }}>{d.day}</Text>
                                ))}
                            </View>
                        )}
                    </BentoCard>

                    {/* Daily Goal */}
                    <BentoCard index={2} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1, color: theme.onSurfaceVariant, opacity: 0.5 }}>{t.dailyGoalTitle.toUpperCase()}</Text>
                        <Text style={[styles.countText, { color: theme.primary, fontSize: isSmallDevice ? 28 : 36 }]}>{todayCompleted}<Text style={{ fontSize: isSmallDevice ? 14 : 18, color: theme.onSurfaceVariant }}>/{dailyGoal}</Text></Text>
                        <Text style={[styles.countLabel, { color: theme.onSurfaceVariant }]}>{t.tasks}</Text>
                        {/* Mini progress bar */}
                        <View style={{ width: '80%', height: 4, borderRadius: 2, backgroundColor: theme.surfaceContainerHigh, marginTop: 8, overflow: 'hidden' }}>
                            <View style={{ width: `${Math.min((todayCompleted / dailyGoal) * 100, 100)}%`, height: '100%', borderRadius: 2, backgroundColor: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary }} />
                        </View>
                    </BentoCard>
                </View>

                <View style={[styles.bentoRow, { gap: isSmallDevice ? 12 : 16 }]}>
                     {/* Streak */}
                     <BentoCard index={3} style={{ flex: 1 }}>
                        <View style={[styles.sectionHeader, { marginBottom: isSmallDevice ? 8 : 12 }]}>
                            <Zap size={isSmallDevice ? 16 : 18} color={streak > 0 ? '#ff9f0a' : theme.onSurfaceVariant} fill={streak > 0 ? '#ff9f0a' : 'none'} />
                            <Text style={[styles.sectionTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 13 : 15 }]}>🔥 {streak > 0 ? `${streak} ${t.streakFire}` : t.streak}</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: theme.onSurfaceVariant, fontWeight: '600', opacity: 0.7 }}>
                            {streak > 0 ? t.streakMotivation : t.streakNone}
                        </Text>
                    </BentoCard>
                </View>

                {/* Quick Actions */}
                <View style={[styles.actionRow, { gap: isSmallDevice ? 12 : 16 }]}>
                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/tasks?action=add'); }}
                        style={[styles.actionBtn, { backgroundColor: theme.surfaceContainerLow, padding: isSmallDevice ? 12 : 16 }]}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: theme.primaryContainer, width: isSmallDevice ? 36 : 44, height: isSmallDevice ? 36 : 44 }]}>
                            <Plus size={isSmallDevice ? 20 : 24} color={isDark ? '#fff' : theme.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: theme.onSurface, fontSize: isSmallDevice ? 11 : 13 }]}>{t.newTask}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setQuickDraftVisible(true); }}
                        style={[styles.actionBtn, { backgroundColor: theme.surfaceContainerLow, padding: isSmallDevice ? 12 : 16 }]}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: theme.secondaryContainer, width: isSmallDevice ? 36 : 44, height: isSmallDevice ? 36 : 44 }]}>
                            <FileText size={isSmallDevice ? 18 : 22} color={isDark ? '#fff' : theme.secondary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: theme.onSurface, fontSize: isSmallDevice ? 11 : 13 }]}>{t.draftNote}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
      </SafeAreaView>

      {/* Quick Draft Bottom Sheet */}
      <Modal visible={quickDraftVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setQuickDraftVisible(false)} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottomSheetWrapper}>
                <MotiView 
                    from={{ translateY: 100, opacity: 0 }} 
                    animate={{ translateY: 0, opacity: 1 }} 
                    style={[styles.quickDraftSheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}
                >
                    <View style={styles.sheetHandle} />
                    <View style={styles.sheetHeader}>
                        <View style={[styles.sheetIcon, { backgroundColor: theme.primaryContainer }]}>
                            <FileText size={20} color={theme.primary} />
                        </View>
                        <Text style={[styles.quickDraftTitle, { color: theme.onSurface, marginBottom: 0 }]}>{t.draftNote}</Text>
                    </View>

                    <View style={[styles.quickInputGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', marginTop: 20 }]}>
                        <TextInput 
                            style={[styles.quickInput, { color: theme.onSurface, height: 60 }]}
                            placeholder={i18n.locale.startsWith('tr') ? "Ne planlıyorsun?" : "What's on your mind?"}
                            placeholderTextColor={theme.onSurfaceVariant + '60'}
                            value={draftTitle}
                            onChangeText={setDraftTitle}
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={handleQuickSave}
                        />
                    </View>

                    <View style={styles.quickActions}>
                        <TouchableOpacity 
                            onPress={handleQuickSave} 
                            disabled={isSavingDraft || !draftTitle.trim()} 
                            style={[styles.quickSave, { backgroundColor: draftTitle.trim() ? theme.primary : theme.surfaceContainerHigh, flex: 1, borderRadius: 20 }]}
                        >
                            {isSavingDraft ? <ActivityIndicator color="white" /> : (
                                <Text style={{ color: draftTitle.trim() ? 'white' : theme.onSurfaceVariant, fontWeight: '900', fontSize: 16 }}>
                                    {t.save}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </MotiView>
            </KeyboardAvoidingView>
        </View>
      </Modal>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBarWrapper: { position: 'absolute', left: 24, right: 24, zIndex: 100, alignItems: 'center' },
  floatingTopBar: { width: '100%', borderRadius: 99, overflow: 'hidden', borderWidth: 1.2 },
  lightTopBarShadow: { shadowColor: '#2d2f31', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 8 },
  darkTopBarShadow: { shadowColor: '#3367ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  avatarContainer: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  avatar: { width: '100%', height: '100%' },
  boltBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1 },
  heroSection: { marginBottom: 24 },
  greeting: { fontWeight: '900', letterSpacing: -1.5, fontFamily: Platform.OS === 'ios' ? 'Plus Jakarta Sans' : 'sans-serif' },
  subGreeting: { fontWeight: '500', marginTop: 4, opacity: 0.7 },
  bentoGrid: { },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontWeight: '800' },
  cardSub: { fontSize: 12, marginTop: 2, opacity: 0.6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 10 },
  chartBar: { borderRadius: 7 },
  bentoRow: { flexDirection: 'row' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontWeight: '800' },
  agendaItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  indicator: { width: 3, borderRadius: 2 },
  agendaName: { fontWeight: '700' },
  agendaTime: { opacity: 0.6 },
  countText: { fontWeight: '900', letterSpacing: -2 },
  countLabel: { fontSize: 10, fontWeight: '900', opacity: 0.5, letterSpacing: 1, marginTop: -4 },
  actionRow: { flexDirection: 'row' },
  actionBtn: { flex: 1, borderRadius: 24, alignItems: 'center', gap: 8 },
  actionIcon: { borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontWeight: '800' },
  nextMissionCard: { padding: 24, justifyContent: 'space-between', overflow: 'hidden' },
  missionHeader: { flexDirection: 'row', gap: 8 },
  missionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  missionBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  missionContent: { marginTop: 12 },
  missionTitle: { fontWeight: '900', letterSpacing: -0.5 },
  missionSub: { fontSize: 13, fontWeight: '500', marginTop: 4, opacity: 0.8 },
  missionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 },
  startBtnText: { color: 'white', fontWeight: '900', fontSize: 14 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheetWrapper: { width: '100%' },
  quickDraftSheet: { 
    width: '100%', 
    borderTopLeftRadius: 36, 
    borderTopRightRadius: 36, 
    padding: 24, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.2)', alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickDraftTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  quickInputGroup: { borderRadius: 24, paddingHorizontal: 20, height: 64, justifyContent: 'center' },
  quickInput: { fontWeight: '700', fontSize: 18 },
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  quickCancel: { flex: 1, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quickSave: { flex: 1.5, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
