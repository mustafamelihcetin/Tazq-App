import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, StyleSheet, useWindowDimensions, Platform, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, TouchableWithoutFeedback } from 'react-native';
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
  const { width } = useWindowDimensions();
  const { tasks, isLoading, setTasks, setLoading, addTask } = useTaskStore();
  const { user } = useAuthStore();
  const { t } = useLanguageStore();
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // Focus Store
  const { isActive, seconds, setCurrentTask, setDuration, setIsActive } = useFocusStore();

  // State
  const [statusHubVisible, setStatusHubVisible] = useState(false);
  const [quickDraftVisible, setQuickDraftVisible] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [weeklyFocus, setWeeklyFocus] = useState<DailyFocusData[]>([]);
  const [streak, setStreak] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  const isTR = i18n.locale?.startsWith('tr') ?? true;

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

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, []);

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
        
        Alert.alert(
            "✍️ " + t.taskAdded,
            `"${payload.title}" ${i18n.locale.startsWith('tr') ? 'başarıyla eklendi.' : 'added successfully.'}`,
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

  // Compute metrics
  const weeklyMinutes = weeklyFocus.reduce((s: number, d: any) => s + (d.minutes || 0), 0);
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

  const getSmartInsight = () => {
    if (isActive) return isTR ? "Odak modu aktif. Akışını bozma, harika gidiyorsun." : "Focus mode active. Stay in the zone, you're doing great.";
    
    // Sentiment Analysis (Local Heuristics)
    const getSentiment = (t: any) => {
        const title = t.title.toLowerCase();
        if (['cenaze', 'vefat', 'taziye', 'hastane', 'ameliyat', 'vefat', 'başsağlığı', 'mevlit', 'ilaç', 'tedavi', 'klinik'].some(kw => title.includes(kw))) return 'sensitive';
        if (['doğum günü', 'kutlama', 'parti', 'düğün', 'tatil', 'bayram', 'tebrik', 'yıl dönümü', 'nişan', 'eğlence'].some(kw => title.includes(kw))) return 'joyful';
        if (['sınav', 'mülakat', 'sunum', 'teslim', 'deadline', 'acil', 'vize', 'final', 'proje', 'toplantı'].some(kw => title.includes(kw))) return 'stressful';
        return 'normal';
    };

    const isActuallyToday = (t: any) => {
        const title = t.title.toLowerCase();
        const tomorrowKeywords = ['yarın', 'tomorrow', 'öbür gün', 'next day'];
        return !tomorrowKeywords.some(kw => title.includes(kw));
    };

    if (highPriorityToday && isActuallyToday(highPriorityToday)) {
        const sentiment = getSentiment(highPriorityToday);
        const title = highPriorityToday.title.toLowerCase();
        
        if (sentiment === 'sensitive') {
            if (['cenaze', 'vefat', 'taziye', 'başsağlığı', 'mevlit'].some(kw => title.includes(kw))) {
                return isTR ? `Başınız sağ olsun. "${highPriorityToday.title}" için metanet diliyorum. 🙏` : `My condolences. Stay strong for "${highPriorityToday.title}". 🙏`;
            }
            return isTR ? `Geçmiş olsun. "${highPriorityToday.title}" sürecinde kendine dikkat et. 🙏` : `Get well soon. Take care of yourself during "${highPriorityToday.title}". 🙏`;
        }
        if (sentiment === 'joyful') return isTR ? `Harika! "${highPriorityToday.title}" günü geldi. Tadını çıkar! 🎉` : `Awesome! "${highPriorityToday.title}" is today. Enjoy! 🎉`;
        
        return isTR 
            ? `Bugünün en kritik işi: "${highPriorityToday.title}". Hemen bitirip rahatlamaya ne dersin?` 
            : `Today's priority: "${highPriorityToday.title}". How about finishing it now to relax?`;
    }

    if (topTaskToday && isActuallyToday(topTaskToday)) {
        const sentiment = getSentiment(topTaskToday);
        const title = topTaskToday.title.toLowerCase();

        if (sentiment === 'sensitive') {
            if (['cenaze', 'vefat', 'taziye', 'başsağlığı', 'mevlit'].some(kw => title.includes(kw))) {
                return isTR ? `Zor bir görev: "${topTaskToday.title}". Sabır dilerim. 🙏` : `A difficult task: "${topTaskToday.title}". Wishing you patience. 🙏`;
            }
            return isTR ? `"${topTaskToday.title}" konusuna odaklanalım. Sağlık her şeyden önemli. 🙏` : `Let's focus on "${topTaskToday.title}". Health comes first. 🙏`;
        }
        if (sentiment === 'joyful') return isTR ? `Hadi "${topTaskToday.title}" hazırlıklarına başlayalım! ✨` : `Let's start prep for "${topTaskToday.title}"! ✨`;

        return isTR 
            ? `Sıradaki bugünün görevi: "${topTaskToday.title}". Küçük bir adımla başlamak ivmeni artırır.` 
            : `Next for today: "${topTaskToday.title}". A small step now will boost your momentum.`;
    }

    // If we have tomorrow's tasks or no tasks for today
    if (futureTasksIncomplete.length > 0 || (topTaskToday && !isActuallyToday(topTaskToday))) {
        const nextTask = (topTaskToday && !isActuallyToday(topTaskToday)) ? topTaskToday : futureTasksIncomplete[0];
        const title = nextTask.title.toLowerCase();
        const sentiment = getSentiment(nextTask);
        const isTomorrow = title.includes('yarın') || title.includes('tomorrow');
        
        if (isTomorrow) {
            if (sentiment === 'sensitive') {
                if (['cenaze', 'vefat', 'taziye', 'başsağlığı', 'mevlit'].some(kw => title.includes(kw))) {
                    return isTR ? `Yarın zor bir gün olacak. Metanetini koru, bugün sadece dinlen. 🙏` : `Tomorrow will be difficult. Stay strong, just rest today. 🙏`;
                }
                return isTR ? `Yarınki "${nextTask.title}" için şimdiden hazırlıklı ol. Geçmiş olsun. 🙏` : `Be prepared for tomorrow's "${nextTask.title}". Get well soon. 🙏`;
            }
            if (sentiment === 'joyful') return isTR ? `Yarın harika bir gün olacak! "${nextTask.title}" seni bekliyor. 🎈` : `Tomorrow will be great! "${nextTask.title}" awaits you. 🎈`;

            return isTR 
                ? `Bugünlük işler tamam gibi. Yarınki "${nextTask.title}" görevin için şimdiden plan yapabilirsin.` 
                : `Today seems clear. You can start planning for tomorrow's "${nextTask.title}" task.`;
        }
        
        return isTR 
            ? `Sıradaki hedefin: "${nextTask.title}". Zamanı geldiğinde seni uyaracağım.` 
            : `Next target: "${nextTask.title}". I'll alert you when the time comes.`;
    }

    if (momentum > 75) return isTR ? "Zirvedesin! Bugün durdurulamaz bir tempoya ulaştın." : "You're at peak performance! Unstoppable pace today.";
    
    return isTR ? "Tüm sistemler hazır. Yeni bir hedef belirleme vakti." : "All systems ready. Time to set a new target.";
  };

  const startQuickFocus = () => {
    const target = topTaskToday || futureTasksIncomplete[0];
    if (!target) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCurrentTask(target.title);
    setDuration(25);
    setIsActive(true);
    setStatusHubVisible(false);
    router.push('/focus');
  };

  const momentumLabel = isTR
    ? (momentum >= 75 ? 'Harika gidiyorsun' : momentum >= 40 ? 'İyi tempo' : 'Başlama vakti')
    : (momentum >= 75 ? 'On a roll!' : momentum >= 40 ? 'Good pace' : 'Get started');
  
  const dayLabels = isTR ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

                    <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatarContainer}>
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
                                {getSmartInsight()}
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
                                    <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{isTR ? 'Hedef' : 'Target'}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.cockpitActions}>
                        <TouchableOpacity 
                            onPress={startQuickFocus}
                            disabled={(!topTaskToday && futureTasksIncomplete.length === 0) || isActive}
                            style={[styles.actionButtonMain, { backgroundColor: theme.primary }]}
                        >
                            <Play size={20} color={theme.onPrimary} fill={theme.onPrimary} />
                            <Text style={[styles.actionButtonText, { color: theme.onPrimary }]}>
                                {isActive ? (isTR ? 'ODAK AKTİF' : 'FOCUS ACTIVE') : 
                                 (!topTaskToday && futureTasksIncomplete.length > 0 ? (isTR ? 'YARINA HAZIRLAN' : 'PREP FOR TOMORROW') : 
                                 (isTR ? 'ŞİMDİ ODAKLAN' : 'FOCUS NOW'))}
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => setStatusHubVisible(false)}
                            style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceContainerHigh }]}
                        >
                            <Text style={[styles.actionButtonTextSecondary, { color: theme.onSurfaceVariant }]}>
                                {isTR ? 'KAPAT' : 'CLOSE'}
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
                    {t.executiveSummary}
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
                {/* Weekly Focus Chart */}
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

                <View style={{ flexDirection: 'row', gap: S.md }}>
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
            </View>
        </ScrollView>

        {/* Quick Draft Modal */}
        <Modal visible={quickDraftVisible} transparent animationType="slide">
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                            <Text style={[styles.quickDraftTitle, { color: theme.onSurface }]}>{t.draftNote}</Text>
                        </View>

                        <View style={[styles.quickInputGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', marginTop: S.md }]}>
                            <TextInput 
                                style={[styles.quickInput, { color: theme.onSurface, height: 60 }]}
                                placeholder={isTR ? "Ne planlıyorsun?" : "What's on your mind?"}
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
                                style={[styles.quickSave, { backgroundColor: draftTitle.trim() ? theme.primary : theme.surfaceContainerHigh, flex: 1 }]}
                            >
                                {isSavingDraft ? <ActivityIndicator color="white" /> : (
                                    <Text style={{ color: draftTitle.trim() ? 'white' : theme.onSurfaceVariant, fontWeight: '900' }}>{t.save}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </MotiView>
                </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </SafeAreaView>
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
  bottomSheetWrapper: { width: '100%' },
  quickDraftSheet: {
    width: '100%',
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: S.lg,
    paddingBottom: Platform.OS === 'ios' ? S.xl : S.lg,
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
});
