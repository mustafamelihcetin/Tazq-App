import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions, PanResponder, Animated as RNAnimated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import Animated, { Layout, useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Check, Timer, Plus, X, Pencil, Sparkles, TrendingUp, Bell, Clock, Tag, Calendar, Trash2, Repeat, ListChecks, CheckCircle2, Circle } from 'lucide-react-native';
import { SubtaskProgressRing } from '../components/SubtaskProgressRing';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TaskService, Priority, RecurrenceType, SubtaskItem } from '../services/api';
import { parseTaskHint } from '../utils/taskParser';
import { categorizeTask } from '../utils/taskIntelligence';
import { useAppTheme } from '../hooks/useAppTheme';
import { scheduleTaskNotification, cancelTaskNotification, requestNotificationPermissions } from '../utils/notifications';
import i18n from 'i18n-js';
import { S, R, F } from '../constants/tokens';

const SWIPE_THRESHOLD = -80;

const SwipeableItem = ({ children, onDelete, isDark, theme }: any) => {
// ... existing SwipeableItem ...
// I will just replace the import and add the effect inside ActionCenter
  const translateX = useSharedValue(0);
  const deleteOpacity = useSharedValue(0);
  const startTranslateX = useSharedValue(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        startTranslateX.value = translateX.value;
      },
      onPanResponderMove: (_, gestureState) => {
        const newX = Math.min(0, startTranslateX.value + gestureState.dx);
        translateX.value = newX;
        deleteOpacity.value = Math.min(Math.abs(newX) / 80, 1);
      },
      onPanResponderRelease: (_, gestureState) => {
        const totalTranslate = startTranslateX.value + gestureState.dx;
        const isFastSwipe = gestureState.vx < -0.5;
        const isOpening = totalTranslate < -40;

        if (isFastSwipe || isOpening) {
          translateX.value = withSpring(-80, { damping: 15, stiffness: 100 });
          deleteOpacity.value = withTiming(1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          translateX.value = withSpring(0, { damping: 20, stiffness: 120 });
          deleteOpacity.value = withTiming(0);
        }
      },
      onPanResponderTerminate: () => {
        translateX.value = withSpring(translateX.value < -40 ? -80 : 0);
      }
    })
  ).current;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: deleteOpacity.value,
    transform: [{ 
      scale: withSpring(deleteOpacity.value > 0.5 ? 1 : 0.8) 
    }],
  }));

  return (
    <View style={{ position: 'relative', marginBottom: S.sm }}>
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingRight: S.md }]}>
        <Animated.View style={[actionStyle]}>
          <TouchableOpacity
            onPress={onDelete}
            style={{ width: 48, height: 48, borderRadius: R.full, backgroundColor: '#ff3b30', justifyContent: 'center', alignItems: 'center' }}
          >
            <Trash2 size={22} color="white" />
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Animated.View {...panResponder.panHandlers} style={[animatedStyle]}>
        {children}
      </Animated.View>
    </View>
  );
};

type FilterType = 'all' | 'today' | 'High' | 'Medium' | 'Low' | 'done';

interface TaskForm {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  tags?: string[];
  subtasks: SubtaskItem[];
  recurrence: RecurrenceType;
}

const EMPTY_FORM: TaskForm = { title: '', description: '', priority: 'Medium', dueDate: '', dueTime: '', tags: [], subtasks: [], recurrence: 'None' };

const RECURRENCE_OPTIONS: { key: RecurrenceType; labelKey: string }[] = [
  { key: 'None', labelKey: 'recurrenceNone' },
  { key: 'Daily', labelKey: 'recurrenceDaily' },
  { key: 'Weekly', labelKey: 'recurrenceWeekly' },
  { key: 'Monthly', labelKey: 'recurrenceMonthly' },
];

export default function ActionCenter() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading, toggleSubtask } = useTaskStore();
  const { t, language } = useLanguageStore();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { action } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // isSmallDevice / isShortDevice removed — design tokens used instead

  const [filter, setFilter] = useState<FilterType>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nlpHint, setNlpHint] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() });
  const [pickerTime, setPickerTime] = useState({ hour: new Date().getHours(), minute: new Date().getMinutes() });
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [dateError, setDateError] = useState(false);
  const subtaskSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Collect unique tags from all tasks for tag filter
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach(t => (t.tags || []).forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet);
  }, [tasks]);

  const openDatePicker = () => {
    const base = form.dueDate ? new Date(form.dueDate) : new Date();
    setPickerDate({ year: base.getFullYear(), month: base.getMonth() + 1, day: base.getDate() });
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    const base = form.dueTime ? new Date(form.dueTime) : new Date();
    setPickerTime({ hour: base.getHours(), minute: base.getMinutes() });
    setShowTimePicker(true);
  };

  const confirmDate = () => {
    const { year, month, day } = pickerDate;
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    
    // Validation: Don't allow past dates
    const selected = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selected < today) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setDateError(true);
      setTimeout(() => setDateError(false), 2500);
      return;
    }

    setDateError(false);
    setForm(f => ({ ...f, dueDate: `${year}-${mm}-${dd}` }));
    setShowDatePicker(false);
  };

  const confirmTime = () => {
    const base = new Date();
    base.setHours(pickerTime.hour, pickerTime.minute, 0, 0);
    setForm(f => ({ ...f, dueTime: base.toISOString() }));
    setShowTimePicker(false);
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

  useEffect(() => { 
    loadTasks();
    requestNotificationPermissions();
    if (action === 'add') {
      setTimeout(() => openAdd(), 400);
    }
  }, [action]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getTasks();
      setTasks(Array.isArray(data) ? data : []);
      // Auto-upgrade tasks due within 24h that aren't High priority
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const toUpgrade = (Array.isArray(data) ? data : []).filter((task: any) =>
        !task.isCompleted &&
        task.priority !== 'High' &&
        task.dueDate &&
        !task.dueDate.startsWith('0001') &&
        new Date(task.dueDate) <= in24h &&
        new Date(task.dueDate) >= now
      );
      if (toUpgrade.length > 0) {
        toUpgrade.forEach((task: any) => {
          updateTask(task.id, { priority: 'High' });
          TaskService.updateTask(task.id, { ...task, priority: 'High' }).catch(() => {});
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.warn('loadTasks error:', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (text: string) => {
    const hint = parseTaskHint(text);
    
    setForm(f => ({ 
        ...f, 
        title: text,
        priority: hint.priority || f.priority,
        dueDate: hint.dueDate || f.dueDate,
        dueTime: hint.dueTime || f.dueTime,
    }));
    
    if (titleError) setTitleError(false);

    // UI Hint Parts
    const parts = [];
    if (hint.dueDate) {
      const dateStr = new Date(hint.dueDate).toLocaleDateString();
      parts.push(`📅 ${dateStr}`);
    }
    if (hint.dueTime) {
      const timeStr = new Date(hint.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      parts.push(`⏰ ${timeStr}`);
    }

    const fullHint = [
      hint.wittyMessage,
      parts.length > 0 ? `(${parts.join('  ')})` : ''
    ].filter(Boolean).join(' ');

    setNlpHint(fullHint);
  };

  const getDateColor = (dateStr: string | undefined | null, thm: typeof theme) => {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return thm.onSurfaceVariant;
    const date = new Date(dateStr);
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const dateStart = new Date(date); dateStart.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dateStart.getTime() - todayStart.getTime()) / 86400000);
    if (diffDays < 0) return '#ff3b30';
    if (diffDays === 0) return '#ff9f0a';
    return thm.onSurfaceVariant;
  };

  const estimateDuration = (task: any) => {
    const isTR = i18n.locale?.startsWith('tr');
    let base = task.priority === 'High' ? 45 : task.priority === 'Medium' ? 20 : 10;
    base += (task.subtasks || []).length * 5;
    return isTR ? `~${base} dk` : `~${base} min`;
  };

  const formatSmartDate = (dateStr?: string | null) => {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return t.waitingForAction;
    const date = new Date(dateStr);
    const now = new Date();
    const isTR = i18n.locale && i18n.locale.startsWith('tr');

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const dateStart = new Date(date); dateStart.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dateStart.getTime() - todayStart.getTime()) / 86400000);

    if (diffDays === 0) {
      const diffMin = Math.round((date.getTime() - now.getTime()) / 60000);
      if (diffMin > 0 && diffMin < 60) return isTR ? `⏰ ${diffMin} dk sonra` : `⏰ In ${diffMin}m`;
      if (diffMin >= 60 && diffMin < 1440) {
        const h = Math.round(diffMin / 60);
        return isTR ? `⏰ ${h} saat sonra` : `⏰ In ${h}h`;
      }
      return isTR ? '📅 Bugün' : '📅 Today';
    }
    if (diffDays === 1) return isTR ? '📅 Yarın' : '📅 Tomorrow';
    if (diffDays === -1) return isTR ? '📅 Dün' : '📅 Yesterday';
    if (diffDays > 1 && diffDays <= 6) return isTR ? `📅 ${diffDays} gün sonra` : `📅 In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -6) return isTR ? `📅 ${Math.abs(diffDays)} gün önce` : `📅 ${Math.abs(diffDays)} days ago`;
    if (diffDays === 7) return isTR ? '📅 Gelecek hafta' : '📅 Next week';

    const locale = isTR ? 'tr-TR' : 'en-US';
    const isCurrentYear = date.getFullYear() === now.getFullYear();
    const options: Intl.DateTimeFormatOptions = isCurrentYear
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' };
    return `📅 ${date.toLocaleDateString(locale, options)}`;
  };

  const handleToggle = async (id: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.isCompleted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    toggleTaskCompletion(id);

    try {
      await TaskService.updateTask(id, {
        ...task,
        priority: task.priority as any,
        isCompleted: !task.isCompleted
      });
    } catch (error) {
      // Rollback on failure
      toggleTaskCompletion(id);
      console.warn('Completion toggle failed:', error);
    }
  };

  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  const handleToggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(t.deleteTask, t.confirmDelete, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive', onPress: async () => {
          removeTask(id);
          cancelTaskNotification(id);
          try { await TaskService.deleteTask(id); }
          catch { loadTasks(); }
        }
      },
    ]);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNlpHint('');
    setTitleError(false);
    setModalVisible(true);
  };

  const openEdit = (id: number) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setEditingId(id);
    setForm({ 
      title: task.title, 
      description: task.description || '', 
      priority: task.priority as Priority, 
      dueDate: task.dueDate?.split('T')[0] ?? '',
      dueTime: task.dueTime || '',
      subtasks: task.subtasks || [],
      recurrence: (task.recurrence as RecurrenceType) || 'None',
    });
    setNlpHint('');
    setTitleError(false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { 
      setTitleError(true); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); 
      Alert.alert(t.errorTitle, t.titleRequired);
      return; 
    }
    setSaving(true);
    
    // Professional Enrichment: Run AI with a strict timeout
    let finalTags = form.tags || [];
    try {
      // Create a timeout promise (1.5 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI Timeout')), 1500)
      );

      const aiMatch = await Promise.race([
        categorizeTask(form.title.trim()),
        timeoutPromise
      ]) as any;

      if (aiMatch && !finalTags.includes(aiMatch.label)) {
        finalTags = [...finalTags, aiMatch.label];
      }
    } catch (e) { 
      console.log('[AI] Enrichment skipped or timed out'); 
    }

    const existingTask = editingId !== null ? tasks.find(t => t.id === editingId) : null;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      isCompleted: existingTask ? existingTask.isCompleted : false,
      priority: form.priority,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      dueTime: form.dueTime || null,
      tags: finalTags,
      subtasks: form.subtasks,
      recurrence: form.recurrence,
    };

    try {
      if (editingId !== null) {
        await TaskService.updateTask(editingId, payload);
        updateTask(editingId, { ...payload, id: editingId });
        // Reschedule notification
        await scheduleTaskNotification(editingId, payload.title, payload.dueDate, payload.dueTime, language);
      } else {
        const created = await TaskService.createTask(payload);
        addTask({ ...created, title: form.title.trim() });
        // Schedule notification for new task
        if (created.id) {
          await scheduleTaskNotification(created.id, payload.title, payload.dueDate, payload.dueTime, language);
        }
      }
      setModalVisible(false);
      setNewSubtaskText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const serverMsg = err.response?.data?.message || err.response?.data?.Message || err.message;
      Alert.alert(t.errorTitle, `${t.saveError}: ${serverMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const priorityColor = (p: string) => {
    if (p === 'High') return '#ff3b30';   // Signal Red
    if (p === 'Medium') return '#ff9f0a'; // Warning Orange
    return '#34c759';                    // Success Green
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'done') { if (!task.isCompleted) return false; }
    else if (filter === 'today') {
      if (task.isCompleted) return false;
      if (!task.dueDate || task.dueDate.startsWith('0001')) return false;
      const d = new Date(task.dueDate);
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
      if (d < todayStart || d > todayEnd) return false;
    }
    else if (filter !== 'all') { if (task.priority !== filter || task.isCompleted) return false; }
    if (tagFilter && !(task.tags || []).includes(tagFilter)) return false;
    return true;
  });
  const filters: FilterType[] = ['all', 'today', 'High', 'Medium', 'Low', 'done'];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <X size={24} color={theme.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.onSurface }]}>{t.actionCenter}</Text>
          <TouchableOpacity style={styles.aiBtn}>
            <Sparkles size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView 
            style={{ flex: 1 }} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 140, paddingHorizontal: S.lg }}
        >
          <Text style={[styles.subHeadline, { color: theme.onSurfaceVariant }]}>{t.allTasksReady}</Text>

          {/* Stats Bento Section */}
          <View style={[styles.statsGrid, { gap: S.md, marginTop: S.lg, marginBottom: S.lg }]}>
            <BentoCard index={0} style={{ flex: 1.4, padding: S.md }}>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.completed}</Text>
                <View style={styles.statValueRow}>
                    <Text style={[styles.statValue, { color: theme.onSurface, fontSize: F.hero }]}>{tasks.filter(t => t.isCompleted).length}</Text>
                    <View style={[styles.trendBadge, { backgroundColor: theme.tertiary + '15' }]}>
                        <TrendingUp size={12} color={theme.tertiary} />
                    </View>
                </View>
                <Text style={[styles.statSub, { color: theme.onSurfaceVariant, fontSize: F.caption }]}>{t.completedTasks}</Text>
            </BentoCard>

            <BentoCard index={1} style={{ flex: 1, padding: S.md }}>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.pending}</Text>
                <Text style={[styles.statValue, { color: theme.primary, fontSize: F.hero }]}>{tasks.filter(t => !t.isCompleted).length}</Text>
                <Text style={[styles.statSub, { color: theme.onSurfaceVariant, fontSize: F.caption }]}>{t.streak}</Text>
            </BentoCard>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 8 }}>
            {filters.map((f) => {
              const label = f === 'all' ? t.filterAll :
                            f === 'today' ? (t as any).filterToday || 'Today' :
                            f === 'High' ? t.filterHigh :
                            f === 'Medium' ? t.filterMedium :
                            f === 'Low' ? t.filterLow :
                            f === 'done' ? t.filterDone : f;
              return (
                <TouchableOpacity 
                  key={f} 
                  onPress={() => { setFilter(f); Haptics.selectionAsync(); }}
                  style={[
                      styles.filterChip, 
                      { 
                          backgroundColor: filter === f ? 'rgba(250, 250, 250, 0.05)' : 'transparent',
                          borderColor: filter === f ? theme.primary : theme.outline,
                          borderWidth: 1,
                          paddingVertical: S.xs,
                          paddingHorizontal: S.md
                      }
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: filter === f ? theme.primary : theme.onSurfaceVariant, fontSize: F.body, fontWeight: filter === f ? '900' : '600' }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tag Filter Pills */}
          {allTags.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity 
                onPress={() => { setTagFilter(null); Haptics.selectionAsync(); }}
                style={[styles.filterChip, { borderColor: !tagFilter ? theme.secondary : theme.outline, borderWidth: 1, paddingVertical: S.xs, paddingHorizontal: S.md }]}
              >
                <Text style={[styles.filterChipText, { color: !tagFilter ? theme.secondary : theme.onSurfaceVariant, fontSize: F.caption }]}>
                  {t.allTags}
                </Text>
              </TouchableOpacity>
              {allTags.map((tag) => (
                <TouchableOpacity 
                  key={tag}
                  onPress={() => { setTagFilter(tagFilter === tag ? null : tag); Haptics.selectionAsync(); }}
                  style={[styles.filterChip, { borderColor: tagFilter === tag ? theme.secondary : theme.outline, borderWidth: 1, paddingVertical: S.xs, paddingHorizontal: S.md }]}
                >
                  <Text style={[styles.filterChipText, { color: tagFilter === tag ? theme.secondary : theme.onSurfaceVariant, fontSize: F.caption }]}>
                    #{tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Task List */}
          <View style={styles.listSection}>
            <Text
                style={[styles.sectionTitle, { color: theme.onSurface, fontSize: F.subhead, flex: 1 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
            >
                {t.upcoming}
            </Text>
            
            <AnimatePresence>
                {filteredTasks.length === 0 ? (
                    <MotiView key="empty" from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={styles.emptyState}>
                        <MotiView
                            animate={{ rotate: ['0deg', '5deg', '-5deg', '0deg'] }}
                            transition={{ loop: true, duration: 4000 }}
                            style={{ marginBottom: 16, opacity: 0.25 }}
                        >
                            <Sparkles size={40} color={theme.primary} />
                        </MotiView>
                        <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>{t.allTasksReady}</Text>
                        <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>{t.noTasksHint}</Text>
                    </MotiView>
                ) : (
                    filteredTasks.map((task, i) => (
                        <SwipeableItem 
                            key={task.id} 
                            onDelete={() => handleDelete(task.id)}
                            isDark={isDark}
                            theme={theme}
                        >
                            <MotiView 
                                layout={Layout.duration(300)}
                                from={{ opacity: 0, translateY: 10 }}
                                animate={{ 
                                    opacity: 1, 
                                    translateY: 0,
                                    scale: task.isCompleted ? [1, 1.03, 1] : 1 
                                }}
                                transition={{ 
                                    type: 'spring',
                                    damping: 15,
                                    stiffness: 150,
                                }}
                            >
                                <TouchableOpacity 
                                    activeOpacity={0.9} 
                                    onPress={() => handleToggleExpand(task.id)}
                                    onLongPress={() => openEdit(task.id)}
                                    style={[
                                        styles.taskCard, 
                                        { 
                                            backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest,
                                            borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                            padding: S.md,
                                            flexDirection: 'column',
                                            alignItems: 'stretch'
                                        }
                                    ]}
                                >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={[styles.priorityIndicator, { backgroundColor: priorityColor(task.priority), width: S.xs, height: '100%', borderRadius: R.sm, marginRight: S.sm }]} />
                                    
                                    <View style={styles.taskContent}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <MotiView
                                                animate={{ opacity: task.isCompleted ? 0.4 : 1, scale: task.isCompleted ? 0.97 : 1 }}
                                                transition={{ type: 'timing', duration: 300 }}
                                                style={{ flexShrink: 1 }}
                                            >
                                                <Text style={[
                                                    styles.taskTitleText,
                                                    { color: theme.onSurface, fontSize: F.body, flexShrink: 1 },
                                                    task.isCompleted && { textDecorationLine: 'line-through' }
                                                ]} numberOfLines={expandedId === task.id ? 0 : 1}>
                                                    {task.title}
                                                </Text>
                                            </MotiView>
                                            {task.recurrence && task.recurrence !== 'None' && (
                                                <View style={[styles.categoryBadge, { backgroundColor: theme.secondary + '20' }]}>
                                                    <Repeat size={9} color={theme.secondary} />
                                                </View>
                                            )}
                                            {task.tags?.length > 0 && (
                                                <View style={[styles.categoryBadge, { backgroundColor: theme.primary + '20' }]}>
                                                    <Text style={[styles.categoryBadgeText, { color: theme.primary, fontWeight: '900' }]}>
                                                        #{task.tags[0].toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.taskMetaRow}>
                                            <Text style={[styles.taskMetaText, { color: getDateColor(task.dueDate, theme), fontSize: F.caption }]}>
                                                {formatSmartDate(task.dueDate)}
                                            </Text>
                                            <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, opacity: 0.5, marginLeft: 10 }}>
                                                {estimateDuration(task)}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <View style={[styles.taskActions, { marginLeft: S.sm, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }]}>
                                        <SubtaskProgressRing 
                                            total={(task.subtasks || []).length}
                                            completed={(task.subtasks || []).filter(s => s.done).length}
                                            size={44}
                                            strokeWidth={1.5}
                                            activeColor={theme.primary}
                                            inactiveColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                                        />
                                        <TouchableOpacity 
                                            onPress={() => handleToggle(task.id)} 
                                            style={[
                                                styles.checkIcon,
                                                {
                                                    width: 36,
                                                    height: 36,
                                                    backgroundColor: task.isCompleted ? theme.tertiary : theme.surfaceContainerHigh
                                                }
                                            ]}
                                        >
                                            <Check size={18} color={task.isCompleted ? 'white' : theme.onSurfaceVariant} strokeWidth={3} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Expanded Details */}
                                <AnimatePresence>
                                    {expandedId === task.id && (
                                        <MotiView
                                            from={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ type: 'timing', duration: 300 }}
                                            style={{ overflow: 'hidden', marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
                                        >
                                            {task.description ? (
                                                <Text style={{ color: theme.onSurface, fontSize: F.body, lineHeight: 20, opacity: 0.8, marginBottom: S.sm }}>
                                                    {task.description}
                                                </Text>
                                            ) : (
                                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontStyle: 'italic', marginBottom: S.sm }}>
                                                    {i18n.locale && i18n.locale.startsWith('tr') ? 'Açıklama eklenmemiş' : 'No description'}
                                                </Text>
                                            )}
                                            
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.md, opacity: 0.7 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                                                    <Calendar size={13} color={theme.onSurfaceVariant} />
                                                    <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>
                                                        {formatSmartDate(task.dueDate).replace('📅 ', '')}
                                                    </Text>
                                                </View>

                                                {task.dueTime && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                                                        <Clock size={13} color={theme.onSurfaceVariant} />
                                                        <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>
                                                            {task.dueTime.includes('T') 
                                                                ? task.dueTime.split('T')[1].substring(0, 5) 
                                                                : task.dueTime.substring(0, 5)}
                                                        </Text>
                                                    </View>
                                                )}

                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                                                    <TrendingUp size={13} color={priorityColor(task.priority)} />
                                                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant }}>
                                                        {task.priority === 'High' ? (i18n.locale.startsWith('tr') ? 'Yüksek' : 'High') :
                                                         task.priority === 'Medium' ? (i18n.locale.startsWith('tr') ? 'Orta' : 'Medium') :
                                                         (i18n.locale.startsWith('tr') ? 'Düşük' : 'Low')}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Subtasks Checklist */}
                                            {(task.subtasks || []).length > 0 && (
                                                <View style={{ marginTop: S.sm, gap: S.xs }}>
                                                    <Text style={{ fontSize: F.caption, fontWeight: '900', color: theme.onSurfaceVariant, letterSpacing: 1, opacity: 0.5 }}>{t.subtasks.toUpperCase()}</Text>
                                                    {(task.subtasks || []).map((sub, si) => (
                                                        <TouchableOpacity
                                                            key={si}
                                                            onPress={() => {
                                                                toggleSubtask(task.id, si);
                                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                                // Debounce: batch rapid subtask toggles into a single API call
                                                                if (subtaskSaveTimers.current[task.id]) {
                                                                    clearTimeout(subtaskSaveTimers.current[task.id]);
                                                                }
                                                                subtaskSaveTimers.current[task.id] = setTimeout(() => {
                                                                    const latest = useTaskStore.getState().tasks.find(t => t.id === task.id);
                                                                    if (latest) {
                                                                        TaskService.updateTask(task.id, { ...latest, priority: latest.priority as any, subtasks: latest.subtasks }).catch(() => {});
                                                                    }
                                                                }, 600);
                                                            }}
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs }}
                                                        >
                                                            {sub.done 
                                                                ? <CheckCircle2 size={16} color={theme.tertiary} />
                                                                : <Circle size={16} color={theme.onSurfaceVariant} />
                                                            }
                                                            <Text style={{
                                                                fontSize: F.body, fontWeight: '600', color: theme.onSurface,
                                                                textDecorationLine: sub.done ? 'line-through' : 'none',
                                                                opacity: sub.done ? 0.4 : 0.9
                                                            }}>
                                                                {sub.text}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            )}

                                            {/* Recurrence Info */}
                                            {task.recurrence && task.recurrence !== 'None' && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm }}>
                                                    <Repeat size={12} color={theme.secondary} />
                                                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.secondary }}>
                                                        {(t as any)[`recurrence${task.recurrence}`] || task.recurrence}
                                                    </Text>
                                                </View>
                                            )}
                                        </MotiView>
                                    )}
                                 </AnimatePresence>
                            </TouchableOpacity>
                        </MotiView>
                      </SwipeableItem>
                    ))
                )}
            </AnimatePresence>
          </View>
        </ScrollView>
      </SafeAreaView>

      <TouchableOpacity 
        onPress={openAdd}
        style={[
            styles.fab,
            {
                backgroundColor: theme.primary,
                shadowColor: isDark ? theme.primary : '#000',
                width: 64,
                height: 64,
                borderRadius: R.lg,
                bottom: 120,
                right: S.lg
            }
        ]}
      >
        <Plus size={32} color={theme.onPrimary} strokeWidth={3} />
      </TouchableOpacity>

      <BottomNavBar />

      {/* Modern Stitch Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !saving && setModalVisible(false)} />
          
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            style={styles.sheetContainer}
          >
            <MotiView 
                from={{ translateY: 300 }}
                animate={{ translateY: 0 }}
                style={[styles.sheet, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', padding: S.lg }]}
            >
                <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                
                <View style={[styles.sheetHeader, { marginBottom: S.lg }]}>
                    <Text style={[styles.sheetTitle, { color: theme.onSurface, fontSize: F.title }]}>
                        {editingId ? t.editTask : t.addTask}
                    </Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                        <X size={20} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>
                </View>

                <ScrollView 
                    style={styles.formContainer} 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: S.md }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.section}>
                        <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 60 }]}>
                            <TextInput
                                style={[styles.modalInput, { color: theme.onSurface, fontSize: F.body }]}
                                placeholder={t.taskTitle}
                                placeholderTextColor={theme.onSurfaceVariant + '60'}
                                value={form.title}
                                onChangeText={handleTitleChange}
                            />
                            <Sparkles size={16} color={theme.primary} />
                        </View>
                        {nlpHint ? (
                            <MotiText 
                                from={{ opacity: 0, translateY: -5 }} 
                                animate={{ opacity: 1, translateY: 0 }} 
                                style={{ color: theme.primary, fontSize: F.caption, marginTop: S.sm, marginLeft: S.md, fontWeight: '800', letterSpacing: 0.5 }}
                            >
                                {nlpHint}
                            </MotiText>
                        ) : null}

                        <View style={[styles.inputGroup, styles.modalTextArea, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, marginTop: S.sm, height: 100 }]}>
                            <TextInput
                                style={[styles.modalInput, { color: theme.onSurface, paddingTop: S.sm, fontSize: F.body }]}
                                placeholder={t.taskDescription + '...'}
                                placeholderTextColor={theme.onSurfaceVariant + '60'}
                                value={form.description}
                                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                                multiline
                                numberOfLines={3}
                            />
                        </View>
                    </View>

                    <View style={styles.section}>
                        {/* Date & Time Chips */}
                        {!showDatePicker && !showTimePicker && (
                          <View style={styles.dateTimeRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.xs }]}>{t.dueDate.toUpperCase()}</Text>
                                <TouchableOpacity
                                    onPress={openDatePicker}
                                    style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 52 }]}
                                >
                                    <Timer size={14} color={theme.primary} />
                                    <Text style={[styles.chipText, { color: form.dueDate ? theme.onSurface : theme.onSurfaceVariant + '60', fontSize: 12 }]}>
                                        {form.dueDate || t.selectDate}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.xs }]}>{t.dueTime.toUpperCase()}</Text>
                                <TouchableOpacity
                                    onPress={openTimePicker}
                                    style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 52 }]}
                                >
                                    <Sparkles size={14} color={theme.secondary} />
                                    <Text style={[styles.chipText, { color: form.dueTime ? theme.onSurface : theme.onSurfaceVariant + '60', fontSize: 12 }]}>
                                        {form.dueTime ? new Date(form.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t.selectTime}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {/* Inline Date Picker */}
                        {showDatePicker && (
                          <View style={[styles.inlinePicker, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                            <Text style={[styles.inlinePickerTitle, { color: theme.onSurface }]}>{t.dueDate}</Text>
                            <View style={styles.pickerRow}>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.day}</Text>
                                <TouchableOpacity onPress={() => setPickerDate(d => ({ ...d, day: Math.min(d.day + 1, daysInMonth(d.year, d.month)) }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></TouchableOpacity>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerDate.day).padStart(2, '0')}</Text>
                                <TouchableOpacity 
                                  onPress={() => setPickerDate(d => {
                                    const now = new Date();
                                    const minDay = (d.year === now.getFullYear() && d.month === (now.getMonth() + 1)) ? now.getDate() : 1;
                                    return { ...d, day: Math.max(d.day - 1, minDay) };
                                  })} 
                                  style={styles.pickerArrow}
                                >
                                  <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                                </TouchableOpacity>
                              </View>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.month}</Text>
                                <TouchableOpacity onPress={() => setPickerDate(d => ({ ...d, month: d.month === 12 ? 1 : d.month + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></TouchableOpacity>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerDate.month).padStart(2, '0')}</Text>
                                <TouchableOpacity 
                                  onPress={() => setPickerDate(d => {
                                    const now = new Date();
                                    const minMonth = d.year === now.getFullYear() ? (now.getMonth() + 1) : 1;
                                    return { ...d, month: Math.max(d.month - 1, minMonth) };
                                  })} 
                                  style={styles.pickerArrow}
                                >
                                  <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                                </TouchableOpacity>
                              </View>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.year}</Text>
                                <TouchableOpacity onPress={() => setPickerDate(d => ({ ...d, year: d.year + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></TouchableOpacity>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{pickerDate.year}</Text>
                                <TouchableOpacity 
                                  onPress={() => setPickerDate(d => ({ ...d, year: Math.max(d.year - 1, new Date().getFullYear()) }))} 
                                  style={styles.pickerArrow}
                                >
                                  <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                            {dateError && (
                              <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} style={[{ backgroundColor: theme.error + '15', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm, marginBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.sm }]}>
                                <Text style={{ color: theme.error, fontSize: F.caption, fontWeight: '700' }}>{t.invalidDate}</Text>
                              </MotiView>
                            )}
                            <View style={styles.pickerActions}>
                              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={[styles.pickerCancelBtn, { borderColor: theme.outline }]}><Text style={[styles.pickerBtnText, { color: theme.onSurfaceVariant }]}>{t.cancel}</Text></TouchableOpacity>
                              <TouchableOpacity onPress={confirmDate} style={[styles.pickerConfirmBtn, { backgroundColor: theme.primary }]}><Text style={[styles.pickerBtnText, { color: '#000', fontWeight: '900' }]}>{t.save}</Text></TouchableOpacity>
                            </View>
                          </View>
                        )}

                        {/* Inline Time Picker */}
                        {showTimePicker && (
                          <View style={[styles.inlinePicker, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                            <Text style={[styles.inlinePickerTitle, { color: theme.onSurface }]}>{t.dueTime}</Text>
                            <View style={styles.pickerRow}>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.hour}</Text>
                                <TouchableOpacity onPress={() => setPickerTime(pt => ({ ...pt, hour: pt.hour === 23 ? 0 : pt.hour + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></TouchableOpacity>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerTime.hour).padStart(2, '0')}</Text>
                                <TouchableOpacity onPress={() => setPickerTime(pt => ({ ...pt, hour: pt.hour === 0 ? 23 : pt.hour - 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text></TouchableOpacity>
                              </View>
                              <Text style={[styles.pickerColon, { color: theme.onSurface }]}>:</Text>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.minute}</Text>
                                <TouchableOpacity onPress={() => setPickerTime(pt => ({ ...pt, minute: pt.minute === 59 ? 0 : pt.minute + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></TouchableOpacity>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerTime.minute).padStart(2, '0')}</Text>
                                <TouchableOpacity onPress={() => setPickerTime(pt => ({ ...pt, minute: pt.minute === 0 ? 59 : pt.minute - 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text></TouchableOpacity>
                              </View>
                            </View>
                            <View style={styles.pickerActions}>
                              <TouchableOpacity onPress={() => setShowTimePicker(false)} style={[styles.pickerCancelBtn, { borderColor: theme.outline }]}><Text style={[styles.pickerBtnText, { color: theme.onSurfaceVariant }]}>{t.cancel}</Text></TouchableOpacity>
                              <TouchableOpacity onPress={confirmTime} style={[styles.pickerConfirmBtn, { backgroundColor: theme.primary }]}><Text style={[styles.pickerBtnText, { color: '#000', fontWeight: '900' }]}>{t.save}</Text></TouchableOpacity>
                            </View>
                          </View>
                        )}
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.priority.toUpperCase()}</Text>
                        <View style={[styles.priorityRow, { gap: S.sm }]}>
                            {([
                                { key: 'Low', label: t.filterLow },
                                { key: 'Medium', label: t.filterMedium },
                                { key: 'High', label: t.filterHigh }
                            ] as { key: Priority, label: string }[]).map((p) => (
                                <TouchableOpacity
                                    key={p.key}
                                    onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, priority: p.key })); }}
                                    style={[styles.priorityTab, { backgroundColor: form.priority === p.key ? priorityColor(p.key) : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow), height: 48 }]}
                                >
                                    <Text style={[
                                        styles.priorityTabText,
                                        {
                                            color: form.priority === p.key
                                                ? (p.key === 'Low' ? theme.onTertiary : p.key === 'High' ? 'white' : 'white')
                                                : theme.onSurfaceVariant,
                                            fontSize: F.body
                                        }
                                    ]}>
                                        {p.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Recurrence Picker */}
                    <View style={styles.section}>
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.recurrence.toUpperCase()}</Text>
                        <View style={[styles.priorityRow, { gap: S.sm }]}>
                            {RECURRENCE_OPTIONS.map((r) => (
                                <TouchableOpacity
                                    key={r.key}
                                    onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, recurrence: r.key })); }}
                                    style={[styles.priorityTab, { backgroundColor: form.recurrence === r.key ? theme.secondary : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow), height: 42 }]}
                                >
                                    {r.key !== 'None' && <Repeat size={12} color={form.recurrence === r.key ? 'white' : theme.onSurfaceVariant} />}
                                    <Text style={[styles.priorityTabText, { color: form.recurrence === r.key ? 'white' : theme.onSurfaceVariant, fontSize: F.caption }]}>
                                        {(t as any)[r.labelKey]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Subtasks Editor */}
                    <View style={styles.section}>
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.subtasks.toUpperCase()}</Text>
                        {form.subtasks.map((sub, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
                                <TouchableOpacity onPress={() => {
                                    const subs = [...form.subtasks];
                                    subs[i] = { ...subs[i], done: !subs[i].done };
                                    setForm(f => ({ ...f, subtasks: subs }));
                                }}>
                                    {sub.done 
                                        ? <CheckCircle2 size={18} color={theme.tertiary} />
                                        : <Circle size={18} color={theme.onSurfaceVariant} />
                                    }
                                </TouchableOpacity>
                                <Text style={{ flex: 1, fontSize: F.body, fontWeight: '600', color: theme.onSurface, textDecorationLine: sub.done ? 'line-through' : 'none', opacity: sub.done ? 0.4 : 1 }}>{sub.text}</Text>
                                <TouchableOpacity onPress={() => {
                                    setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, idx) => idx !== i) }));
                                }}>
                                    <X size={16} color={theme.onSurfaceVariant} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 44 }]}>
                            <TextInput
                                style={[styles.modalInput, { color: theme.onSurface, fontSize: F.body }]}
                                placeholder={t.addSubtask}
                                placeholderTextColor={theme.onSurfaceVariant + '60'}
                                value={newSubtaskText}
                                onChangeText={setNewSubtaskText}
                                returnKeyType="done"
                                onSubmitEditing={() => {
                                    if (newSubtaskText.trim()) {
                                        setForm(f => ({ ...f, subtasks: [...f.subtasks, { text: newSubtaskText.trim(), done: false }] }));
                                        setNewSubtaskText('');
                                    }
                                }}
                            />
                            <TouchableOpacity 
                                onPress={() => {
                                    if (newSubtaskText.trim()) {
                                        setForm(f => ({ ...f, subtasks: [...f.subtasks, { text: newSubtaskText.trim(), done: false }] }));
                                        setNewSubtaskText('');
                                    }
                                }}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Plus size={18} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.modalSaveBtn}>
                        <LinearGradient colors={isDark ? [theme.primary, theme.primaryDim] : [theme.primary, theme.primaryContainer]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalSaveGradient}>
                            {saving ? <ActivityIndicator color="white" /> : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md }}>
                                    <Check size={20} color={theme.onPrimary} strokeWidth={3} />
                                    <Text
                                        style={[styles.modalSaveText, { color: theme.onPrimary, fontSize: F.subhead, flexShrink: 1 }]}
                                        numberOfLines={1}
                                        adjustsFontSizeToFit
                                    >
                                        {t.save}
                                    </Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </MotiView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.sm },
  backBtn: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '900', letterSpacing: -0.5 },
  aiBtn: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  headline: { fontWeight: '900', letterSpacing: -1.5 },
  subHeadline: { fontWeight: '600', opacity: 0.7, marginTop: S.xs },
  statsGrid: { flexDirection: 'row' },
  statLabel: { fontSize: F.caption, fontWeight: '900', letterSpacing: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginVertical: S.xs },
  statValue: { fontWeight: '900', letterSpacing: -1 },
  trendBadge: { padding: S.xs, borderRadius: R.sm },
  statSub: { fontWeight: '700' },
  filterScroll: { marginBottom: S.lg },
  filterChip: { borderRadius: 100 },
  filterChipText: { fontWeight: '800' },
  listSection: { flex: 1 },
  sectionTitle: { fontWeight: '900', marginBottom: S.md },
  taskCard: { borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1.2 },
  priorityIndicator: { height: 32, borderRadius: R.sm, marginRight: S.md },
  taskContent: { flex: 1 },
  taskTitleText: { fontWeight: '700' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  taskMetaText: { fontWeight: '600' },
  taskActions: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 100 },
  emptyState: { padding: S.xl, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: F.subhead, fontWeight: '800', letterSpacing: -0.3 },
  emptyText: { fontSize: F.body, fontWeight: '500', opacity: 0.6, textAlign: 'center' },
  deleteAction: {
    width: 80,
    marginBottom: S.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: R.lg,
    marginLeft: -24,
    paddingLeft: S.sm,
  },
  categoryBadge: { paddingHorizontal: S.sm, paddingVertical: 2, borderRadius: R.sm },
  categoryBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'lowercase' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { width: '100%' },
  sheet: { borderTopLeftRadius: S.xl, borderTopRightRadius: S.xl, borderWidth: 1, borderBottomWidth: 0 },
  handle: { width: 40, height: 4, borderRadius: R.sm, alignSelf: 'center', marginBottom: S.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontWeight: '900', letterSpacing: -0.5 },
  closeModalBtn: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  formContainer: { paddingHorizontal: 4 },
  section: { marginBottom: S.md },
  inputGroup: { borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md },
  modalInput: { flex: 1, fontWeight: '600' },
  modalTextArea: { alignItems: 'flex-start' },
  dateTimeRow: { flexDirection: 'row', gap: S.sm },
  dateTimeChip: { flex: 1, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, gap: 10 },
  chipText: { flex: 1, fontWeight: '700' },
  optionLabel: { fontWeight: '900', letterSpacing: 1.2, marginBottom: S.sm, marginLeft: S.xs, opacity: 0.6 },
  priorityRow: { flexDirection: 'row' },
  priorityTab: { flex: 1, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  priorityTabText: { fontWeight: '800' },
  modalSaveBtn: { borderRadius: R.lg, overflow: 'hidden', marginTop: S.lg, marginBottom: S.xl },
  modalSaveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, height: 56 },
  modalSaveText: { color: 'white', fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', paddingTop: Platform.OS === 'ios' ? 2 : 0 },
  inlinePicker: { borderRadius: R.lg, padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  inlinePickerTitle: { fontSize: F.body, fontWeight: '900', marginBottom: S.md, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.7 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md },
  pickerCol: { alignItems: 'center', minWidth: 60 },
  pickerColLabel: { fontSize: F.caption, fontWeight: '900', letterSpacing: 1, marginBottom: S.sm, opacity: 0.5 },
  pickerArrow: { padding: S.sm },
  pickerArrowText: { fontSize: F.body, fontWeight: '900' },
  pickerValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 40 },
  pickerColon: { fontSize: 28, fontWeight: '900', marginTop: S.sm },
  pickerActions: { flexDirection: 'row', gap: S.sm, width: '100%', marginTop: S.sm },
  pickerCancelBtn: { flex: 1, borderRadius: R.md, borderWidth: 1.5, height: 48, alignItems: 'center', justifyContent: 'center' },
  pickerConfirmBtn: { flex: 1, borderRadius: R.md, height: 48, alignItems: 'center', justifyContent: 'center' },
  pickerBtnText: { fontWeight: '700', paddingTop: Platform.OS === 'ios' ? 2 : 0 },
});
