import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Platform, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Animated } from 'react-native';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { BentoCard } from '../components/BentoCard';
import { DynamicIsland } from '../components/DynamicIsland';
import { BottomNavBar } from '../components/BottomNavBar';
import { MotiView, MotiText } from 'moti';
import { Plus, FileText, Zap, Play, Rocket, ChevronRight, BrainCircuit, Target } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { TaskService, FocusService, DailyFocusData } from '../services/api';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../hooks/useAppTheme';
import { TazqLogo } from '../components/TazqLogo';
import { useFocusStore } from '../store/useFocusStore';
import { StatusHub } from '../components/StatusHub';
import { LinearGradient } from 'expo-linear-gradient';
import { parseTaskHint } from '../utils/taskParser';
import { getSmartInsight } from '../utils/insights';
import { S, R, F } from '../constants/tokens';
import { getAvatarSource } from '../utils/avatars';
import { useToastStore } from '../store/useToastStore';

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { tasks, isLoading, setTasks, setLoading, addTask } = useTaskStore();
  const { user } = useAuthStore();
  const { t, language } = useLanguageStore();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { show: showToast } = useToastStore();

  // Focus Store
  const { isActive, seconds, setCurrentTask, setDuration, setIsActive, dailyFocusMinutes, dailyGoalMinutes, updateBestStreak } = useFocusStore();

  // State
  const [statusHubVisible, setStatusHubVisible] = useState(false);
  const [quickDraftVisible, setQuickDraftVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  const { panResponder: draftPan, animatedStyle: draftSlide, resetPosition: resetDraftPos, slideIn: draftSlideIn } = useSwipeToDismiss({
    onDismiss: () => setQuickDraftVisible(false),
  });
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [weeklyFocus, setWeeklyFocus] = useState<DailyFocusData[]>([]);
  const [streak, setStreak] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

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
      const active = stats.activeStreak || 0;
      setStreak(active);
      updateBestStreak(active);
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.warn('fetchStats error:', e.message);
      }
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    const now = new Date();
    const msUntilNextHour = (60 - now.getMinutes()) * 60000 - now.getSeconds() * 1000;
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      setCurrentHour(new Date().getHours());
      interval = setInterval(() => setCurrentHour(new Date().getHours()), 3600000);
    }, msUntilNextHour);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, []);

  const handleQuickSave = async () => {
    if (!draftTitle.trim()) return;
    setIsSavingDraft(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
        const hint = parseTaskHint(draftTitle.trim());
        const isReminder = hint.tags?.includes('hatırlatıcı') || hint.tags?.includes('reminder');
        
        const payload = {
            title: draftTitle.trim(),
            description: '',
            priority: hint.priority || 'Medium',
            isCompleted: false,
            dueDate: hint.dueDate || (isReminder ? new Date().toISOString() : null),
            dueTime: hint.dueTime || null,
            tags: hint.tags?.length ? hint.tags : ['Draft']
        };

        const created = await TaskService.createTask(payload as any);
        addTask(created);

        // Schedule notification if it's a reminder
        if (created.id && isReminder) {
            const { scheduleTaskNotification } = require('../utils/notifications');
            await scheduleTaskNotification(created.id, payload.title, payload.dueDate, payload.dueTime, language);
        }

        setDraftTitle('');
        setQuickDraftVisible(false);
        showToast(`"${payload.title}" ${t.toastTaskAdded}`, 'success');
    } catch (error: any) {
        if (!error.response) {
          showToast(t.toastNoConnection, 'error');
        } else {
          showToast(t.saveError, 'error');
        }
    } finally {
        setIsSavingDraft(false);
    }
  };

  // Compute metrics
  const weeklyMinutes = weeklyFocus.reduce((s: number, d: any) => s + (d.minutes || 0), 0);

  // Trend: compare second half of week vs first half as a proxy for week-over-week direction
  const weekTrend = (() => {
    if (weeklyFocus.length < 4) return null;
    const half = Math.floor(weeklyFocus.length / 2);
    const firstHalf = weeklyFocus.slice(0, half).reduce((s: number, d: any) => s + (d.minutes || 0), 0);
    const secondHalf = weeklyFocus.slice(half).reduce((s: number, d: any) => s + (d.minutes || 0), 0);
    if (firstHalf === 0) return null;
    return Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  })();
  const completedCount = tasks.filter(t => t.isCompleted).length;
  const totalCount = tasks.length || 1;
  const completionRate = completedCount / totalCount;
  const focusScore = Math.min(weeklyMinutes / 300, 1);
  const streakScore = Math.min(streak / 14, 1);
  const momentum = Math.round(completionRate * 40 + focusScore * 35 + streakScore * 25);
  const momentumColor = momentum >= 75 ? theme.tertiary : momentum >= 40 ? '#ff9f0a' : theme.primary;
  
  // Smart Logic: Prioritize Today's Tasks
  const todayDateString = new Date().toDateString();
  const todayTasksIncomplete = tasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate).toDateString() === todayDateString);
  const futureTasksIncomplete = tasks.filter(t => !t.isCompleted && (!t.dueDate || new Date(t.dueDate).toDateString() !== todayDateString));

  const topTaskToday = todayTasksIncomplete[0];
  const highPriorityToday = todayTasksIncomplete.find(t => t.priority === 'High');
  const topTask = topTaskToday || futureTasksIncomplete[0];

  const insight = getSmartInsight(language as 'tr' | 'en', isActive, momentum, highPriorityToday, topTaskToday, futureTasksIncomplete);

  const startQuickFocus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const target = topTaskToday || futureTasksIncomplete[0];
    // Pre-fill task name if available, otherwise let user set it on focus screen
    if (target) setCurrentTask(target.title);
    // setDuration resets isActive to false internally — set both together after
    const secs = 25 * 60;
    useFocusStore.setState({ totalSeconds: secs, seconds: secs, isActive: true, lastActiveAt: Date.now() });
    setStatusHubVisible(false);
    router.replace('/focus');
  };

  const momentumLabel = momentum >= 75 ? t.momentumHigh : momentum >= 40 ? t.momentumMid : t.momentumLow;
  const dayLabels: string[] = t.dayLabels;

  const getGreeting = () => {
    if (currentHour >= 5 && currentHour < 13) return t.greetingMorning;
    if (currentHour >= 13 && currentHour < 18) return t.greetingAfternoon;
    if (currentHour >= 18 && currentHour < 23) return t.greetingEvening;
    return t.greetingNight;
  };

  const priorityColor = (p: string) => {
    if (p === 'High') return '#ff3b30';
    if (p === 'Medium') return '#ff9f0a';
    return '#34c759';
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* TopBar */}
        <View style={[styles.topBarWrapper]}>
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
                <View style={[styles.topBarContent, { paddingHorizontal: S.md }]}>
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <TazqLogo height={24} />
                        </View>
                    </View>

                    <TouchableOpacity onPress={() => router.push('/cockpit')} style={styles.avatarContainer}>
                        <Image
                            source={getAvatarSource(user?.avatar || null)}
                            style={styles.avatar}
                        />
                    </TouchableOpacity>

                    <StatusHub onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStatusHubVisible(true); }} />
                </View>
            </MotiView>
        </View>

        {/* Smart Cockpit Modal */}
        <Modal visible={statusHubVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setStatusHubVisible(false)} />
                <MotiView 
                    from={{ translateY: 100, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    style={[styles.insightCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: theme.outlineVariant + '40' }]}
                >
                    <View style={styles.insightHeader}>
                        <View style={[styles.insightIcon, { backgroundColor: theme.primary + '15' }]}>
                            <BrainCircuit size={20} color={theme.primary} />
                        </View>
                        <Text style={[styles.insightHeaderTitle, { color: theme.onSurface }]}>TAZQ INSIGHTS</Text>
                    </View>
                    
                    <View style={styles.insightBody}>
                        <View style={[styles.bentoMini, { backgroundColor: theme.surfaceContainerLow }]}>
                            <Text style={[styles.insightMainText, { color: theme.onSurface }]}>
                                {insight}
                            </Text>
                        </View>

                        <View style={styles.insightStats}>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                                    <Zap size={16} color={momentumColor} fill={momentumColor} />
                                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{momentum}%</Text>
                                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>Momentum</Text>
                                </View>
                                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                                    <Target size={16} color={theme.secondary} />
                                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{todayCompleted}/{dailyGoal}</Text>
                                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.cockpitTarget}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.cockpitActions}>
                        <TouchableOpacity
                            onPress={() => {
                                if (isActive) {
                                    setStatusHubVisible(false);
                                    router.replace('/focus');
                                } else {
                                    startQuickFocus();
                                }
                            }}
                            style={[styles.actionButtonMain, { backgroundColor: isActive ? theme.tertiary : theme.primary }]}
                        >
                            <Play size={20} color={theme.onPrimary} fill={theme.onPrimary} />
                            <Text style={[styles.actionButtonText, { color: theme.onPrimary }]}>
                                {isActive ? t.cockpitGoToFocus :
                                 (!topTaskToday && futureTasksIncomplete.length > 0 ? t.cockpitPrepTomorrow :
                                 t.cockpitFocusNow)}
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => setStatusHubVisible(false)}
                            style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceContainerHigh }]}
                        >
                            <Text style={[styles.actionButtonTextSecondary, { color: theme.onSurfaceVariant }]}>
                                {t.cockpitClose}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </MotiView>
            </View>
        </Modal>

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
                    {isActive ? t.executiveSummaryActive : tasks.filter(x => !x.isCompleted).length > 0 ? t.executiveSummaryTasks : t.executiveSummaryEmpty}
                </Text>
            </MotiView>

            {/* Focus Widget */}
            <DynamicIsland />

            {/* Next Mission Widget */}
            <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
                <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                >
                    <BentoCard index={0} style={[styles.nextMissionCard, { minHeight: 180 }]}>
                        <LinearGradient
                            colors={!topTask
                                ? ['#8e8e93', '#1a1a1a']
                                : topTask.priority === 'High'
                                ? ['#ff3b30', '#1a1a1a']
                                : topTask.priority === 'Medium'
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
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                        setCurrentTask(topTask.title);
                                        const secs = 25 * 60;
                                        useFocusStore.setState({ totalSeconds: secs, seconds: secs, isActive: false, lastActiveAt: null });
                                        router.replace('/focus');
                                    }}
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
                {/* Weekly Focus Chart */}
                <BentoCard index={1}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
                        <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>
                            {t.weeklyFocusLabel}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {weekTrend !== null && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: weekTrend >= 0 ? theme.tertiary + '18' : '#ff3b3018', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ fontSize: 10, fontWeight: '900', color: weekTrend >= 0 ? theme.tertiary : '#ff3b30' }}>
                                        {weekTrend >= 0 ? '↑' : '↓'}{Math.abs(weekTrend)}%
                                    </Text>
                                </View>
                            )}
                            <Text style={{ fontSize: F.caption, fontWeight: '900', color: theme.primary }}>
                                {weeklyMinutes >= 60
                                    ? `${Math.floor(weeklyMinutes / 60)}sa ${weeklyMinutes % 60}dk`
                                    : `${weeklyMinutes}dk`}
                            </Text>
                        </View>
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

                <View style={{ flexDirection: 'row', gap: S.md }}>
                    <BentoCard index={2} style={{ flex: 1, minHeight: 144 }}>
                        <Text style={[styles.metricLabel, { color: theme.onSurfaceVariant }]}>
                            {t.todayLabel}
                        </Text>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={[styles.metricValue, { color: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary }]}>
                                {todayCompleted}
                                <Text style={{ fontSize: F.subhead, color: theme.onSurfaceVariant, fontWeight: '600' }}>/{dailyGoal}</Text>
                            </Text>
                            <Text style={[styles.metricSub, { color: theme.onSurfaceVariant }]}>{t.tasks}</Text>
                        </View>
                        <View style={{ width: '100%', height: 3, borderRadius: R.sm, backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerHigh, overflow: 'hidden', marginBottom: 4 }}>
                            <MotiView
                                animate={{ width: `${Math.min((todayCompleted / dailyGoal) * 100, 100)}%` as any }}
                                transition={{ type: 'timing', duration: 800 }}
                                style={{ height: '100%', borderRadius: R.sm, backgroundColor: todayCompleted >= dailyGoal ? theme.tertiary : theme.primary }}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ flex: 1, height: 2, borderRadius: R.sm, backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerHigh, overflow: 'hidden' }}>
                                <MotiView
                                    animate={{ width: `${Math.min((dailyFocusMinutes / Math.max(dailyGoalMinutes, 1)) * 100, 100)}%` as any }}
                                    transition={{ type: 'timing', duration: 900 }}
                                    style={{ height: '100%', borderRadius: R.sm, backgroundColor: theme.primary }}
                                />
                            </View>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: theme.onSurfaceVariant, opacity: 0.45, letterSpacing: 0.3 }}>
                                {dailyFocusMinutes}/{dailyGoalMinutes}dk
                            </Text>
                        </View>
                    </BentoCard>

                    <BentoCard index={3} style={{ flex: 1, minHeight: 144 }} onPress={() => Alert.alert('Momentum', t.momentumTooltip)}>
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
            </View>
        </ScrollView>

        {/* Quick Draft Modal */}
        <Modal visible={quickDraftVisible} transparent animationType="none" onShow={() => draftSlideIn()}>
          <View style={styles.draftOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setQuickDraftVisible(false)} />
                <View style={[styles.bottomSheetWrapper, { marginBottom: keyboardHeight }]}>
                    <Animated.View style={[draftSlide, styles.quickDraftSheet, {
                          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                          paddingBottom: keyboardHeight > 0 ? S.md : S.xl,
                          borderBottomLeftRadius: keyboardHeight > 0 ? R.lg : 0,
                          borderBottomRightRadius: keyboardHeight > 0 ? R.lg : 0,
                        }]}>
                        <View {...draftPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
                          <View style={styles.sheetHandle} />
                        </View>
                        <View style={styles.sheetHeader}>
                            <View style={[styles.sheetIcon, { backgroundColor: theme.primaryContainer }]}>
                                <FileText size={20} color={theme.primary} />
                            </View>
                            <Text style={[styles.quickDraftTitle, { color: theme.onSurface }]}>{t.draftNote}</Text>
                        </View>

                        <View style={[styles.quickInputGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', marginTop: S.md }]}>
                            <TextInput 
                                style={[styles.quickInput, { color: theme.onSurface, height: 60 }]}
                                placeholder={t.draftPlaceholder}
                                placeholderTextColor={theme.onSurfaceVariant + '99'}
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
                                style={[styles.quickSave, { backgroundColor: draftTitle.trim() ? theme.primary : theme.surfaceContainerHigh, flex: 1 }]}
                            >
                                {isSavingDraft ? <ActivityIndicator color="white" /> : (
                                    <Text style={{ color: draftTitle.trim() ? 'white' : theme.onSurfaceVariant, fontWeight: '900' }}>{t.save}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
          </View>
        </Modal>

      </SafeAreaView>

      {/* Quick Draft FAB */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setQuickDraftVisible(true); }}
        style={[styles.fab, { backgroundColor: theme.primary, shadowColor: isDark ? theme.primary : '#000' }]}
      >
        <Plus size={32} color={theme.onPrimary} strokeWidth={3} />
      </TouchableOpacity>

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
  scrollContent: { flexGrow: 1 },
  heroSection: { marginBottom: S.lg },
  greeting: { fontWeight: '900', letterSpacing: -1.5 },
  subGreeting: { fontWeight: '500', marginTop: S.xs, opacity: 0.7 },
  metricLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, opacity: 0.45, marginBottom: S.xs },
  metricValue: { fontSize: F.title, fontWeight: '900', letterSpacing: -1 },
  metricSub: { fontSize: F.caption, fontWeight: '600', opacity: 0.6, marginTop: 2 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  insightCard: { width: '100%', borderRadius: 32, padding: 24, borderWidth: 1, gap: 24 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  insightIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  insightHeaderTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1, opacity: 0.6 },
  insightBody: { gap: 16 },
  bentoMini: { padding: 16, borderRadius: 20 },
  insightMainText: { fontSize: 16, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  insightStats: { gap: 12 },
  statBento: { padding: 16, borderRadius: 20, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', opacity: 0.5, letterSpacing: 0.5 },
  cockpitActions: { gap: 12 },
  actionButtonMain: { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  actionButtonText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  actionButtonSecondary: { height: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionButtonTextSecondary: { fontSize: 14, fontWeight: '800' },
  draftOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheetWrapper: { width: '100%' },
  quickDraftSheet: {
    width: '100%',
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: R.sm, backgroundColor: 'rgba(128,128,128,0.2)', alignSelf: 'center', marginBottom: S.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  sheetIcon: { width: 40, height: 40, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  quickDraftTitle: { fontSize: F.title, fontWeight: '900', letterSpacing: -0.5 },
  quickInputGroup: { borderRadius: R.lg, paddingHorizontal: S.md, height: 64, justifyContent: 'center' },
  quickInput: { fontWeight: '700', fontSize: F.subhead },
  quickActions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  quickSave: { flex: 1, height: 56, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', paddingHorizontal: S.lg, gap: S.md, marginTop: S.md },
  actionBtn: { flex: 1, borderRadius: R.lg, alignItems: 'center', gap: S.sm },
  actionLabel: { fontWeight: '800' },
  fab: { position: 'absolute', bottom: 120, right: S.lg, width: 64, height: 64, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 100, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 },
});

