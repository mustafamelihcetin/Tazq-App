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
import { S, R, F } from '../constants/tokens';

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

  const isTR = i18n.locale?.startsWith('tr') ?? true;
  const [quickDraftVisible, setQuickDraftVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [weeklyFocus, setWeeklyFocus] = useState<DailyFocusData[]>([]);
  const [streak, setStreak] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

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
    setStatsLoading(true);
    try {
      const stats = await FocusService.getStats();
      setWeeklyFocus(stats.weeklyFocus || []);
      setStreak(stats.activeStreak || 0);
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.warn('fetchStats error:', e.message);
      }
    } finally {
      setStatsLoading(false);
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

  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  useEffect(() => {
    const now = new Date();
    const msUntilNextHour = (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000;
    const timeout = setTimeout(() => {
      setCurrentHour(new Date().getHours());
      const interval = setInterval(() => setCurrentHour(new Date().getHours()), 3600000);
      return () => clearInterval(interval);
    }, msUntilNextHour);
    return () => clearTimeout(timeout);
  }, []);

  // Compute metrics at component level
  const weeklyMinutes = weeklyFocus.reduce((s: number, d: any) => s + (d.minutes || 0), 0);
  const completedCount = tasks.filter(t => t.isCompleted).length;
  const totalCount = tasks.length || 1;
  const completionRate = completedCount / totalCount;
  const focusScore = Math.min(weeklyMinutes / 300, 1);
  const streakScore = Math.min(streak / 14, 1);
  const momentum = Math.round(completionRate * 40 + focusScore * 35 + streakScore * 25);
  const momentumColor = momentum >= 75 ? theme.tertiary : momentum >= 40 ? '#ff9f0a' : theme.primary;
  const momentumLabel = isTR
    ? (momentum >= 75 ? 'Harika gidiyorsun' : momentum >= 40 ? 'İyi tempo' : 'Başlama vakti')
    : (momentum >= 75 ? 'On a roll!' : momentum >= 40 ? 'Good pace' : 'Get started');
  const DAY_LABELS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayLabels = isTR ? DAY_LABELS_TR : DAY_LABELS_EN;

  const getGreeting = () => {
    if (currentHour >= 5 && currentHour < 13) return t.greetingMorning;
    if (currentHour >= 13 && currentHour < 18) return t.greetingAfternoon;
    if (currentHour >= 18 && currentHour < 23) return t.greetingEvening;
    return t.greetingNight;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* TopBar — normal flow, ScrollView starts right below */}
        <View style={[styles.topBarWrapper]}>
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
                    isDark ? { shadowColor: theme.primaryDim, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 } : styles.lightTopBarShadow
                ]}
            >
                <BlurView
                    intensity={isDark ? 50 : 30}
                    tint={colorScheme}
                    style={StyleSheet.absoluteFill}
                />
                <View style={[styles.topBarContent, { paddingHorizontal: S.md }]}>
                    <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatarContainer}>
                        <Image
                            source={getAvatarSource(user?.avatar || null)}
                            style={styles.avatar}
                        />
                    </TouchableOpacity>

                    <TazqLogo width={80} height={28} />

                    <View style={styles.boltBtn} />
                </View>
            </MotiView>
        </View>

        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scrollContent, { paddingTop: S.lg, paddingBottom: 120 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTasks} tintColor={theme.primary} />}
        >
            {/* Welcome Hero */}
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={[styles.heroSection, { paddingHorizontal: S.lg }]}
            >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 }}>
                    <Text style={[styles.greeting, { color: theme.onSurface, fontSize: 28, lineHeight: 34 }]} numberOfLines={1}>
                        {getGreeting()},
                    </Text>
                    <Text
                        style={[styles.greeting, { color: theme.primary, fontSize: 28, lineHeight: 34, flexShrink: 1 }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {` ${user?.name?.split(' ')[0] || 'System'}`}
                    </Text>
                </View>
                <Text style={[styles.subGreeting, { color: theme.onSurfaceVariant, fontSize: F.subhead }]}>
                    {t.executiveSummary}
                </Text>
            </MotiView>

            {/* Focus Widget */}
            <DynamicIsland />

            {/* Next Mission / Highway Widget */}
            <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                >
                    <BentoCard index={0} style={[styles.nextMissionCard, { minHeight: 180 }]}>
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
                            <Text style={[styles.missionTitle, { color: theme.onSurface, fontSize: F.title }]} numberOfLines={1} ellipsizeMode="tail">
                                {topTask ? topTask.title : t.noTasksHint}
                            </Text>
                            <Text style={[styles.missionSub, { color: theme.onSurfaceVariant }]}>
                                {topTask ? (topTask.description || t.waitingForAction) : t.allTasksReady}
                            </Text>
                        </View>

                        <View style={[styles.missionFooter, { gap: S.sm }]}>
                            {topTask ? (
                                <TouchableOpacity 
                                    onPress={() => router.push({ pathname: '/tasks', params: { action: 'focus', taskId: topTask.id } })}
                                    style={[styles.startBtn, { backgroundColor: theme.primary, flex: 2, height: 52, justifyContent: 'center' }]}
                                >
                                    <Play size={18} color={theme.onPrimary} fill={theme.onPrimary} />
                                    <Text style={[styles.startBtnText, { color: theme.onPrimary, fontSize: F.subhead, fontWeight: '900' }]}>{t.deepFocus.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    onPress={() => router.push('/tasks')}
                                    style={[styles.startBtn, { backgroundColor: theme.surfaceContainerHigh, flex: 2, height: 52, justifyContent: 'center' }]}
                                >
                                    <Plus size={18} color={theme.onSurface} />
                                    <Text style={[styles.startBtnText, { color: theme.onSurface, fontSize: F.subhead, fontWeight: '900' }]}>{t.addTask.toUpperCase()}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                onPress={() => router.push('/tasks')} 
                                style={[styles.seeAllBtn, { flex: 1, height: 52, justifyContent: 'flex-end', paddingRight: 4 }]}
                            >
                                <Text style={[styles.seeAllText, { color: theme.onSurfaceVariant, fontSize: F.body }]}>{t.filterAll}</Text>
                                <ChevronRight size={16} color={theme.onSurfaceVariant} />
                            </TouchableOpacity>
                        </View>
                    </BentoCard>
                </MotiView>
            </View>

            {/* Metrics Grid */}
            <View style={{ paddingHorizontal: S.lg, gap: S.md }}>

                {/* Full-width Weekly Focus Chart */}
                <BentoCard index={1}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
                        <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>
                            {isTR ? 'HAFTALIK ODAK' : 'WEEKLY FOCUS'}
                        </Text>
                        <Text style={{ fontSize: F.caption, fontWeight: '900', color: theme.primary }}>
                            {weeklyMinutes >= 60
                                ? `${Math.floor(weeklyMinutes / 60)}sa ${weeklyMinutes % 60}dk`
                                : `${weeklyMinutes}dk`}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 52, gap: S.xs }}>
                        {(statsLoading
                            ? Array(7).fill({ minutes: 0 })
                            : weeklyFocus.length > 0 ? weeklyFocus : Array(7).fill({ minutes: 0 })
                        ).map((d: any, i: number) => {
                            const maxMin = Math.max(...(weeklyFocus.map(w => w.minutes)), 1);
                            const pct = statsLoading ? (10 + i * 8) : Math.max((d.minutes / maxMin) * 100, 6);
                            const isToday = !statsLoading && i === weeklyFocus.length - 1;
                            return (
                                <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                                    <MotiView
                                        animate={{ opacity: statsLoading ? [0.2, 0.5, 0.2] : 1 }}
                                        transition={{ loop: statsLoading, duration: 1000, delay: i * 80 }}
                                        style={{
                                            width: '100%',
                                            height: `${pct}%`,
                                            borderRadius: R.sm,
                                            backgroundColor: isToday ? theme.primary : (isDark ? theme.surfaceContainerHighest : theme.surfaceContainerHigh),
                                        }}
                                    />
                                </View>
                            );
                        })}
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: S.xs }}>
                        {dayLabels.map((day, i) => (
                            <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: theme.onSurfaceVariant, fontWeight: '800', opacity: 0.4, letterSpacing: 0.3 }}>
                                {day}
                            </Text>
                        ))}
                    </View>
                </BentoCard>

                {/* Row 1: Bugün + Momentum */}
                <View style={{ flexDirection: 'row', gap: S.md }}>
                    {/* Today */}
                    <BentoCard index={2} style={{ flex: 1, minHeight: 144 }}>
                        <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>
                            {isTR ? 'BUGÜN' : 'TODAY'}
                        </Text>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={[styles.metricValue, { color: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary }]}>
                                {todayCompleted}
                                <Text style={{ fontSize: F.subhead, color: theme.onSurfaceVariant, fontWeight: '600' }}>/{dailyGoal}</Text>
                            </Text>
                            <Text style={[styles.metricSub, { color: theme.onSurfaceVariant }]}>{t.tasks}</Text>
                        </View>
                        <View style={{ width: '100%', height: 3, borderRadius: R.sm, backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerHigh, overflow: 'hidden' }}>
                            <MotiView
                                animate={{ width: `${Math.min((todayCompleted / dailyGoal) * 100, 100)}%` as any }}
                                transition={{ type: 'timing', duration: 800 }}
                                style={{ height: '100%', borderRadius: R.sm, backgroundColor: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary }}
                            />
                        </View>
                    </BentoCard>

                    {/* Momentum */}
                    <BentoCard index={3} style={{ flex: 1, minHeight: 144 }}>
                        <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>MOMENTUM</Text>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <MotiView animate={{ opacity: statsLoading ? [0.4, 0.9, 0.4] : 1 }} transition={{ loop: statsLoading, duration: 1400 }}>
                                <Text style={[styles.metricValue, { color: momentumColor }]}>
                                    {statsLoading ? '--' : momentum}
                                </Text>
                            </MotiView>
                            <Text style={[styles.metricSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                                {momentumLabel}
                            </Text>
                        </View>
                        <View style={{ width: '100%', height: 3, borderRadius: R.sm, backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerHigh, overflow: 'hidden' }}>
                            <MotiView
                                animate={{ width: `${statsLoading ? 0 : momentum}%` as any }}
                                transition={{ type: 'timing', duration: 900 }}
                                style={{ height: '100%', borderRadius: R.sm, backgroundColor: momentumColor }}
                            />
                        </View>
                    </BentoCard>
                </View>

                {/* Row 2: Odak + Seri */}
                <View style={{ flexDirection: 'row', gap: S.md }}>
                    {/* Weekly Focus Hours */}
                    <BentoCard index={4} style={{ flex: 1, minHeight: 144 }}>
                        <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>
                            {isTR ? 'ODAK' : 'FOCUS'}
                        </Text>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={[styles.metricValue, { color: theme.secondary }]}>
                                {Math.floor(weeklyMinutes / 60)}
                                <Text style={{ fontSize: F.subhead, color: theme.onSurfaceVariant, fontWeight: '600' }}>
                                    {isTR ? 'sa' : 'h'}
                                </Text>
                            </Text>
                            <Text style={[styles.metricSub, { color: theme.onSurfaceVariant }]}>
                                {isTR ? 'bu hafta' : 'this week'}
                            </Text>
                        </View>
                        <View style={{ width: '100%', height: 3, borderRadius: R.sm, backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerHigh, overflow: 'hidden' }}>
                            <MotiView
                                animate={{ width: `${Math.min((weeklyMinutes / 300) * 100, 100)}%` as any }}
                                transition={{ type: 'timing', duration: 900 }}
                                style={{ height: '100%', borderRadius: R.sm, backgroundColor: theme.secondary }}
                            />
                        </View>
                    </BentoCard>

                    {/* Streak */}
                    <BentoCard index={5} style={{ flex: 1, minHeight: 144 }}>
                        <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>
                            {isTR ? 'SERİ' : 'STREAK'}
                        </Text>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={[styles.metricValue, { color: streak > 0 ? '#ff9f0a' : theme.onSurface }]}>
                                {streak}
                                <Text style={{ fontSize: F.subhead, color: theme.onSurfaceVariant, fontWeight: '600' }}>
                                    {isTR ? 'g' : 'd'}
                                </Text>
                            </Text>
                            <Text style={[styles.metricSub, { color: theme.onSurfaceVariant }]} numberOfLines={1}>
                                {streak > 0 ? t.streakMotivation : t.streakNone}
                            </Text>
                        </View>
                        {streak > 0 && (
                            <View style={{ flexDirection: 'row', gap: 3 }}>
                                {Array(Math.min(streak, 7)).fill(0).map((_, i) => (
                                    <View key={i} style={{ flex: 1, height: 3, borderRadius: R.sm, backgroundColor: '#ff9f0a', opacity: 0.4 + (i / 7) * 0.6 }} />
                                ))}
                                {streak < 7 && Array(7 - Math.min(streak, 7)).fill(0).map((_, i) => (
                                    <View key={`e${i}`} style={{ flex: 1, height: 3, borderRadius: R.sm, backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerHigh }} />
                                ))}
                            </View>
                        )}
                    </BentoCard>
                </View>

                {/* Quick Actions */}
                <View style={[styles.actionRow, { gap: S.md }]}>
                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/tasks?action=add'); }}
                        style={[styles.actionBtn, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, padding: S.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: theme.primaryContainer, width: 44, height: 44 }]}>
                            <Plus size={22} color={isDark ? theme.primary : theme.primary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: theme.onSurface, fontSize: F.body }]}>{t.newTask}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setQuickDraftVisible(true); }}
                        style={[styles.actionBtn, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, padding: S.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: theme.secondaryContainer, width: 44, height: 44 }]}>
                            <FileText size={22} color={isDark ? theme.secondary : theme.secondary} />
                        </View>
                        <Text style={[styles.actionLabel, { color: theme.onSurface, fontSize: F.body }]}>{t.draftNote}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
      </SafeAreaView>

      {/* Quick Draft Bottom Sheet */}
      <Modal visible={quickDraftVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
        <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setQuickDraftVisible(false)} />
            <View style={styles.bottomSheetWrapper}>
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

                    <View style={[styles.quickInputGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', marginTop: S.md }]}>
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
                            style={[styles.quickSave, { backgroundColor: draftTitle.trim() ? theme.primary : theme.surfaceContainerHigh, flex: 1, borderRadius: R.full }]}
                        >
                            {isSavingDraft ? <ActivityIndicator color="white" /> : (
                                <Text style={{ color: draftTitle.trim() ? 'white' : theme.onSurfaceVariant, fontWeight: '900', fontSize: F.subhead }}>
                                    {t.save}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </MotiView>
            </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBarWrapper: { paddingHorizontal: S.lg, paddingVertical: S.sm, alignItems: 'center' },
  floatingTopBar: { width: '100%', borderRadius: R.full, overflow: 'hidden', borderWidth: 1.2 },
  lightTopBarShadow: { shadowColor: '#2d2f31', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 8 },
  darkTopBarShadow: { shadowColor: '#3367ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.sm },
  avatarContainer: { width: 34, height: 34, borderRadius: R.full, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  avatar: { width: '100%', height: '100%' },
  boltBtn: { width: 34, height: 34, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flexGrow: 1 },
  heroSection: { marginBottom: S.lg },
  greeting: { fontWeight: '900', letterSpacing: -1.5, fontFamily: Platform.OS === 'ios' ? 'Plus Jakarta Sans' : 'sans-serif' },
  subGreeting: { fontWeight: '500', marginTop: S.xs, opacity: 0.7 },
  metricLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, opacity: 0.45, marginBottom: S.xs },
  metricValue: { fontSize: F.title, fontWeight: '900', letterSpacing: -1 },
  metricSub: { fontSize: F.caption, fontWeight: '600', opacity: 0.6, marginTop: 2 },
  bentoRow: { flexDirection: 'row' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  sectionTitle: { fontWeight: '800' },
  actionRow: { flexDirection: 'row' },
  actionBtn: { flex: 1, borderRadius: R.lg, alignItems: 'center', gap: S.sm },
  actionIcon: { borderRadius: R.lg, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontWeight: '800' },
  nextMissionCard: { padding: S.lg, justifyContent: 'space-between', overflow: 'hidden' },
  missionHeader: { flexDirection: 'row', gap: S.sm },
  missionBadge: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.md },
  missionBadgeText: { fontSize: F.caption, fontWeight: '900', letterSpacing: 0.5 },
  missionContent: { marginTop: S.sm },
  missionTitle: { fontWeight: '900', letterSpacing: -0.5 },
  missionSub: { fontSize: F.body, fontWeight: '500', marginTop: S.xs, opacity: 0.8 },
  missionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.md },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, paddingVertical: S.sm, borderRadius: R.full },
  startBtnText: { color: 'white', fontWeight: '900', fontSize: F.body },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  seeAllText: { fontSize: F.body, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheetWrapper: { width: '100%' },
  quickDraftSheet: {
    width: '100%',
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: S.lg,
    paddingBottom: Platform.OS === 'ios' ? S.xl : S.lg,
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20
  },
  sheetHandle: { width: 40, height: 4, borderRadius: R.sm, backgroundColor: 'rgba(128,128,128,0.2)', alignSelf: 'center', marginBottom: S.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  sheetIcon: { width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  quickDraftTitle: { fontSize: F.title, fontWeight: '900', letterSpacing: -0.5 },
  quickInputGroup: { borderRadius: R.lg, paddingHorizontal: S.md, height: 64, justifyContent: 'center' },
  quickInput: { fontWeight: '700', fontSize: F.subhead },
  quickActions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  quickCancel: { flex: 1, height: 56, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  quickSave: { flex: 1.5, height: 56, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
});
