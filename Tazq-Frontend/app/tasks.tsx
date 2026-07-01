import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions, Animated as RNAnimated, AppState, Keyboard, FlatList } from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useUiDepth } from '../hooks/useUiDepth';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import Animated, { Layout, LinearTransition, useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Check, Timer, Plus, X, Pencil, Sparkles, TrendingUp, Bell, Clock, Tag, Calendar, Trash2, Repeat, ListChecks, CheckCircle2, Circle, Mic, Search, SlidersHorizontal, CheckSquare, Scale, Target, Archive } from 'lucide-react-native';
import { SubtaskProgressRing } from '../components/SubtaskProgressRing';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { WeightEntryModal } from '../components/WeightEntryModal';
import { useTaskStore } from '../store/useTaskStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { useAchievementStore } from '../store/useAchievementStore';
import { ACHIEVEMENTS } from '../utils/achievements';
import { track } from '../utils/analytics';
import { getModeInfoForTask } from '../utils/modeHelpers';

import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TaskService, Priority, RecurrenceType, SubtaskItem } from '../services/api';
import { parseTaskHint } from '../utils/taskParser';
import { visibleTextTags } from '../utils/taskTags';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SwipeableItem } from '../components/SwipeableItem';
import { useToastStore } from '../store/useToastStore';
import { categorizeTask } from '../utils/taskIntelligence';
import { useAppTheme } from '../hooks/useAppTheme';
import { useCompletionStore } from '../store/useCompletionStore';
import { scheduleTaskNotification, cancelTaskNotification, requestNotificationPermissions } from '../utils/notifications';
import { S, R, F, scale, verticalScale, moderateScale, B, TRACKING, MAX_W, sideInset } from '../constants/tokens';
import VoiceService from '../utils/voice';
import { useNetworkStore } from '../store/useNetworkStore';
import { useOfflineQueue } from '../store/useOfflineQueue';
import { Touchable } from '@/components/Touchable';

const SWIPE_THRESHOLD = -80;
const TAG_COLORS_PALETTE = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#EF4444','#06B6D4','#F97316'];
const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const getTagColorStatic = (tag: string): string => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS_PALETTE[Math.abs(hash) % TAG_COLORS_PALETTE.length];
};

const VoiceWave = ({ active, theme }: { active: boolean; theme: any }) => (
    <MotiView
        from={{ scale: 1, opacity: 0 }}
        animate={active ? { scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] } : { scale: 1, opacity: 0 }}
        transition={{ loop: true, duration: 1500 }}
        style={{
            position: 'absolute',
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.primary,
            zIndex: -1,
        }}
    />
);


type FilterType = 'all' | 'today' | 'High' | 'Medium' | 'Low' | 'done';

interface TaskForm {
  title: string;
  description: string;
  dueDate: string;
  dueTime: string | null;
  priority: 'Low' | 'Medium' | 'High';
  tags: string[];
  subtasks: SubtaskItem[];
  recurrence: RecurrenceType;
  reminderEnabled: boolean;
}

const EMPTY_FORM: TaskForm = { 
  title: '', 
  description: '', 
  priority: 'Medium', 
  dueDate: '', 
  dueTime: null, 
  tags: [], 
  subtasks: [], 
  recurrence: 'None',
  reminderEnabled: false 
};

const RECURRENCE_OPTIONS: { key: RecurrenceType; labelKey: string }[] = [
  { key: 'None', labelKey: 'recurrenceNone' },
  { key: 'Daily', labelKey: 'recurrenceDaily' },
  { key: 'Weekly', labelKey: 'recurrenceWeekly' },
  { key: 'Monthly', labelKey: 'recurrenceMonthly' },
];

/** Returns a human-readable "Next: ..." label for the next task recurrence date */
function getNextOccurrenceLabel(dueDateStr: string | null | undefined, recurrence: RecurrenceType, lang: string): string {
  if (!dueDateStr || recurrence === 'None') return '';
  const base = new Date(dueDateStr);
  if (isNaN(base.getTime())) return '';
  const next = new Date(base);
  if (recurrence === 'Daily') next.setDate(base.getDate() + 1);
  else if (recurrence === 'Weekly') next.setDate(base.getDate() + 7);
  else if (recurrence === 'Monthly') next.setMonth(base.getMonth() + 1);
  next.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tr = lang === 'tr';
  const prefix = tr ? 'Sonraki: ' : 'Next: ';
  if (next.getTime() === today.getTime()) return prefix + (tr ? 'Bugün' : 'Today');
  if (next.getTime() === tomorrow.getTime()) return prefix + (tr ? 'Yarın' : 'Tomorrow');
  return prefix + next.toLocaleDateString(tr ? 'tr-TR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}


const MemoizedTaskItem = React.memo((props: any) => {
    const { task, i, theme, isDark, highlightedId, isBulkMode, isSelected, language, t, showSwipePeek, priorityColor, handleDelete, handleToggleExpand, handleLongPress, handleBulkSelect, handleToggle, toggleSubtask, completingIds, expandedId, subtaskSaveTimers } = props;
    
    const prefs = usePrefsStore();
    const modeInfo = useMemo(() => {
        return getModeInfoForTask(task, prefs, theme);
    }, [task.id, theme, prefs]);

    const finalLeftColor = modeInfo?.color || priorityColor(task.priority);

    return (
        <Animated.View>
            <SwipeableItem
                onDelete={() => handleDelete(task.id)}
                disabled={isBulkMode}
                showPeekHint={showSwipePeek && i === 0}
            >
                <View style={{ transform: [{ scale: isBulkMode && !isSelected ? 0.96 : 1 }] }}>
                    <Touchable
                        activeOpacity={0.9}
                        onPress={() => {
                            if (isBulkMode) {
                                handleBulkSelect(task.id);
                            } else {
                                handleToggleExpand(task.id);
                            }
                        }}
                        onLongPress={() => handleLongPress(task.id)}
                        style={[[styles.taskCard, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, flexDirection: 'column', alignItems: 'stretch' }], {
                            borderColor: highlightedId === task.id ? theme.secondary : (isBulkMode && isSelected ? theme.primary : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)')),
                            borderWidth: (highlightedId === task.id || (isBulkMode && isSelected)) ? 2 : 1,
                        }]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: S.md }}>
                            {isBulkMode && (
                                <View style={[{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? theme.primary : theme.outline, backgroundColor: isSelected ? theme.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: S.sm }]}>
                                    {isSelected && <Check size={12} color={theme.onPrimary || '#fff'} />}
                                </View>
                            )}
                            <View style={[styles.priorityIndicator, { backgroundColor: finalLeftColor, width: S.xs, height: '100%', borderRadius: R.sm, marginRight: S.sm, opacity: task.isCompleted || completingIds.has(task.id) ? 0.3 : 1 }]} />
                            
                            <View style={styles.taskContent}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <MotiView
                                        animate={{ opacity: task.isCompleted || completingIds.has(task.id) ? 0.4 : 1, scale: task.isCompleted || completingIds.has(task.id) ? 0.97 : 1 }}
                                        transition={{ type: 'timing', duration: 300 }}
                                        style={{ flexShrink: 1 }}
                                    >
                                        <Text style={[
                                            styles.taskTitleText,
                                            { color: theme.onSurface, fontSize: F.body, flexShrink: 1 },
                                            (task.isCompleted || completingIds.has(task.id)) && { textDecorationLine: 'line-through' }
                                        ]} numberOfLines={expandedId === task.id ? 0 : 1}>
                                            {task.title}
                                        </Text>
                                    </MotiView>
                                    {task.tags && task.tags.includes('weight_entry') && (
                                        <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.primary }}>{language === 'tr' ? 'KİLO' : 'WEIGHT'}</Text>
                                        </View>
                                    )}
                                    {task.tags && task.tags.includes('auto_generated') && (
                                        <View style={{ backgroundColor: theme.tertiary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.tertiary }}>{language === 'tr' ? 'OTO' : 'AUTO'}</Text>
                                        </View>
                                    )}
                                </View>

                                {(task.description || task.dueDate || task.dueTime || modeInfo) && (
                                    <MotiView
                                        animate={{ opacity: task.isCompleted || completingIds.has(task.id) ? 0.4 : 1 }}
                                        transition={{ type: 'timing', duration: 300 }}
                                        style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}
                                    >
                                        {modeInfo && (
                                            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, { backgroundColor: modeInfo.color + '1A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}>
                                                <Sparkles size={12} color={modeInfo.color} opacity={0.9} />
                                                <Text style={[{ fontSize: 11 }, { color: modeInfo.color, fontWeight: '600' }]}>
                                                    {language === 'tr' ? modeInfo.labelTr : modeInfo.labelEn}
                                                </Text>
                                            </View>
                                        )}
                                        {task.dueDate && (
                                            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}>
                                                <Calendar size={12} color={theme.onSurfaceVariant} opacity={0.7} />
                                                <Text style={[{ fontSize: 11 }, { color: theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                    {new Date(task.dueDate).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })}
                                                </Text>
                                            </View>
                                        )}
                                        {task.dueTime && (
                                            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4 }, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }]}>
                                                <Clock size={12} color={theme.onSurfaceVariant} opacity={0.7} />
                                                <Text style={[{ fontSize: 11 }, { color: theme.onSurfaceVariant, fontWeight: '600' }]}>
                                                    {task.dueTime}
                                                </Text>
                                            </View>
                                        )}
                                    </MotiView>
                                )}
                            </View>

                            <Touchable
                                onPress={() => handleToggle(task.id)}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                style={[
                                    // Yuvarlatılmış KARE kutu = "görev" (listeden tikle, biter). Alışkanlıklar
                                    // DAİRE/halka kullanır (günlük tekrarlayan ritim) → şekil grameri farkı betimsel anlatır.
                                    { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: S.sm },
                                    {
                                        backgroundColor: (task.isCompleted || completingIds.has(task.id)) ? theme.success : 'transparent',
                                        borderColor: (task.isCompleted || completingIds.has(task.id)) ? theme.success : (isDark ? theme.outline : 'rgba(0,0,0,0.2)'),
                                    }
                                ]}
                            >
                                {(task.isCompleted || completingIds.has(task.id)) && <Check size={16} color="white" />}
                            </Touchable>
                        </View>

                        {/* Expanded Content */}
                        <AnimatePresence>
                            {expandedId === task.id && (
                                <MotiView
                                    from={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: 'timing', duration: 250 }}
                                    style={{ overflow: 'hidden', paddingHorizontal: S.md, paddingBottom: S.md }}
                                >
                                    <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginBottom: S.md }} />
                                    
                                    {task.description && (
                                        <Text style={{ fontSize: F.subhead, color: theme.onSurfaceVariant, lineHeight: 20, marginBottom: S.sm }}>
                                            {task.description}
                                        </Text>
                                    )}

                                    {/* Subtasks */}
                                    {task.subtasks && task.subtasks.length > 0 && (
                                        <View style={{ gap: 4, marginTop: S.xs }}>
                                            {task.subtasks.map((sub: any, sIndex: number) => (
                                                <Touchable
                                                    key={sIndex}
                                                    onPress={() => {
                                                        toggleSubtask(task.id, sIndex);
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
                                                </Touchable>
                                            ))}
                                        </View>
                                    )}

                                    {/* Recurrence Info */}
                                    {task.recurrence && task.recurrence !== 'None' && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm }}>
                                            <Repeat size={12} color={theme.secondary} />
                                            <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.secondary }}>
                                                {(t as any)[`recurrence${task.recurrence}`] || task.recurrence}
                                            </Text>
                                        </View>
                                    )}
                                </MotiView>
                            )}
                        </AnimatePresence>
                    </Touchable>
                </View>
            </SwipeableItem>
        </Animated.View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.task === nextProps.task &&
        prevProps.isDark === nextProps.isDark &&
        prevProps.highlightedId === nextProps.highlightedId &&
        prevProps.isBulkMode === nextProps.isBulkMode &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.completingIds === nextProps.completingIds &&
        prevProps.language === nextProps.language &&
        (prevProps.expandedId === prevProps.task.id) === (nextProps.expandedId === nextProps.task.id)
    );
});

export default function ActionCenter() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const scrollY = useSharedValue(0);
  const scrollDir = useSharedValue(0); // 0 = up, 1 = down
  
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event: any) => {
      const currentScrollY = event.contentOffset.y;
      if (currentScrollY > scrollY.value + 5 && currentScrollY > 50) {
        scrollDir.value = 1; // scrolling down
      } else if (currentScrollY < scrollY.value - 5) {
        scrollDir.value = 0; // scrolling up
      }
      scrollY.value = currentScrollY;
    }
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: withTiming(scrollDir.value === 1 ? -300 : 0, { duration: 300 }) }],
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: theme.background
    };
  });
  const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading, toggleSubtask } = useTaskStore(useShallow(state => ({
    tasks: state.tasks,
    toggleTaskCompletion: state.toggleTaskCompletion,
    addTask: state.addTask,
    removeTask: state.removeTask,
    updateTask: state.updateTask,
    setTasks: state.setTasks,
    setLoading: state.setLoading,
    isLoading: state.isLoading,
    toggleSubtask: state.toggleSubtask
  })));
  const { t, language } = useLanguageStore();
  const { show: showToast } = useToastStore();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { enqueue: enqueueOffline } = useOfflineQueue();
  const { soundEffects } = usePrefsStore();
  const { record: recordCompletion } = useCompletionStore();
  const { setCurrentTask } = useFocusStore();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { action, highlightId, dateFilter } = useLocalSearchParams<{ action?: string; highlightId?: string; dateFilter?: string }>();
  const insets = useSafeAreaInsets();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const scrollViewRef = useRef<any>(null);
  const [weightModalTaskId, setWeightModalTaskId] = useState<number | null>(null);

  // isSmallDevice / isShortDevice removed — design tokens used instead

  const [filter, setFilter] = useState<FilterType>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [showSearch]);
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'creation'>('creation');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showFutureManualTasks, setShowFutureManualTasks] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  useUiDepth(modalVisible || weightModalTaskId !== null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [nlpHint, setNlpHint] = useState('');
  const [showSmartHint, setShowSmartHint] = useState(false);
  const [showSwipePeek, setShowSwipePeek] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() });
  const [pickerTime, setPickerTime] = useState({ hour: new Date().getHours(), minute: new Date().getMinutes() });
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [dateError, setDateError] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isListeningTitle, setIsListeningTitle] = useState(false);
  const [isListeningDesc, setIsListeningDesc] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());
  const exitAnimMap = useRef<Map<number, { opacity: RNAnimated.Value; translateY: RNAnimated.Value }>>(new Map());
  const TASK_PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(TASK_PAGE_SIZE);

  const { panResponder: taskPan, animatedStyle: taskSlide, prepare: prepareTask, slideIn: taskSlideIn } = useSwipeToDismiss({
    onDismiss: () => !saving && setModalVisible(false),
  });

  // Stop voice recognition whenever the modal is hidden
  useEffect(() => {
    if (!modalVisible && (isListeningTitle || isListeningDesc)) {
      VoiceService.stop().catch(() => {});
      setIsListeningTitle(false);
      setIsListeningDesc(false);
    }
  }, [modalVisible]);

  // Auto-exit bulk mode when all items are deselected
  useEffect(() => {
    if (isBulkMode && selectedIds.size === 0) {
      setIsBulkMode(false);
    }
  }, [selectedIds, isBulkMode]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(TASK_PAGE_SIZE);
  }, [filter, tagFilter, searchQuery, sortBy, hideCompleted]);

  const toggleVoice = async (field: 'title' | 'description') => {
    const isActive = field === 'title' ? isListeningTitle : isListeningDesc;
    
    if (isActive) {
      await VoiceService.stop();
      field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
      return;
    }

    if (isListeningTitle || isListeningDesc) {
      await VoiceService.stop();
      setIsListeningTitle(false);
      setIsListeningDesc(false);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    field === 'title' ? setIsListeningTitle(true) : setIsListeningDesc(true);

    await VoiceService.start({
      language: language === 'tr' ? 'tr-TR' : 'en-US',
      initialText: field === 'title' ? form.title : form.description,
      onResults: (results: string[]) => {
        if (results.length > 0) {
          const text = results[0];
          // Use a special internal flag or just set the form directly to avoid trigger loop
          if (field === 'title') {
            const hint = parseTaskHint(text, language as 'tr' | 'en');
            const hasReminderWord = text.toLowerCase().includes('hatırlat') || text.toLowerCase().includes('remind');
            setForm(f => ({
                ...f,
                title: text,
                dueDate: hint.dueDate || f.dueDate,
                dueTime: hint.dueTime || f.dueTime,
                priority: hint.priority || f.priority,
                recurrence: hint.recurrence || f.recurrence,
                reminderEnabled: hasReminderWord ? true : f.reminderEnabled
            }));
            if (hint.dueDate || hint.dueTime || hint.priority || hint.recurrence) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } else {
            setForm(f => ({ ...f, description: text }));
          }
        }
      },
      onError: (err: any) => {
        const msg = err?.message ?? String(err);
        field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
        if (msg === 'permission-denied') {
          Alert.alert(
            language === 'tr' ? 'Mikrofon İzni Gerekli' : 'Microphone Permission Required',
            language === 'tr'
              ? 'Lütfen uygulama ayarlarından mikrofon iznini etkinleştirin.'
              : 'Please enable microphone permission in your device settings.'
          );
        } else if (msg === 'not-available') {
          Alert.alert(
            language === 'tr' ? 'Desteklenmiyor' : 'Not Supported',
            language === 'tr'
              ? 'Ses tanıma bu ortamda desteklenmiyor.'
              : 'Voice recognition is not supported in this environment.'
          );
        }
      },
      onEnded: () => {
        field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
      }
    });
  };
  const subtaskSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Collect unique tags from all tasks for tag filter — içsel/sistem etiketleri hariç
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach(t => visibleTextTags(t.tags).forEach(tag => tagSet.add(tag)));
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

  // Mount/unmount only — voice cleanup must not run on every route-param change
  useEffect(() => {
    loadTasks();
    requestNotificationPermissions();

    AsyncStorage.getItem('tazq-swipe-peek-shown').then(val => {
      if (!val) {
        setShowSwipePeek(true);
        AsyncStorage.setItem('tazq-swipe-peek-shown', 'true').catch(() => {});
      }
    }).catch(() => {});

    return () => {
      VoiceService.destroy();
      Object.values(subtaskSaveTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Handle deep-link route params independently (no VoiceService side-effects)
  useEffect(() => {
    if (action === 'add') {
      setTimeout(() => {
        openAdd();
        // If a specific date was passed from cockpit, prefill it
        if (dateFilter) {
          setForm(f => ({ ...f, dueDate: dateFilter }));
        }
      }, 400);
    }
    if (highlightId) {
      const id = Number(highlightId);
      setHighlightedId(id);
      setExpandedId(id);
      setTimeout(() => setHighlightedId(null), 3000);
    }
  }, [action, highlightId, dateFilter]);

  // Refresh tasks when returning from background (keeps "today" filter accurate after midnight)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') loadTasks();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getTasks();
      const safeData = Array.isArray(data) ? data : [];
      setTasks(safeData);

      // Auto-cleanup: completed tasks whose journal entry is older than 7 days → delete from server
      const journal = useCompletionStore.getState();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const toDelete = safeData.filter(task => {
        if (!task.isCompleted) return false;
        const entry = journal.events.find(e => e.taskId === task.id);
        return entry && new Date(entry.completedAt) < cutoff;
      });
      if (toDelete.length > 0) {
        toDelete.forEach(task => {
          removeTask(task.id);
          TaskService.deleteTask(task.id).catch(() => {});
        });
      }
    } catch (e: any) {
      if (e.response?.status !== 401) {
        console.warn('loadTasks error:', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDescriptionChange = (text: string) => {
    // If user is manually typing, stop voice recognition
    if (isListeningDesc) {
      VoiceService.stop().catch(() => {});
      setIsListeningDesc(false);
    }
    setForm(f => ({ ...f, description: text }));
  };

  const handleTitleChange = (text: string) => {
    // If user is manually typing, stop voice recognition to prevent conflicts
    if (isListeningTitle) {
      VoiceService.stop().catch(() => {});
      setIsListeningTitle(false);
    }

    // When title is fully cleared on a new task, reset all NLP-derived state
    if (!text.trim() && editingId === null) {
      setForm(f => ({ ...f, title: '', priority: 'Medium', tags: [], dueDate: '', dueTime: null }));
      setNlpHint('');
      if (titleError) setTitleError(false);
      return;
    }

    const hint = parseTaskHint(text, language as 'tr' | 'en');
    const hasReminderWord = text.toLowerCase().includes('hatırlat') || text.toLowerCase().includes('remind');

    setForm(f => ({
        ...f,
        title: text,
        priority: hint.priority || f.priority,
        dueDate: hint.dueDate || f.dueDate,
        dueTime: hint.dueTime || f.dueTime,
        recurrence: hint.recurrence || f.recurrence,
        reminderEnabled: hasReminderWord ? true : f.reminderEnabled,
        tags: hasReminderWord ? (f.tags.includes('hatırlatıcı') ? f.tags : [...f.tags, 'hatırlatıcı']) : f.tags
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
    if (hint.recurrence && hint.recurrence !== 'None') {
      const isTR = language === 'tr';
      const recurrenceLabel: Record<string, string> = {
        Daily: isTR ? 'Her gün' : 'Daily',
        Weekly: isTR ? 'Her hafta' : 'Weekly',
        Monthly: isTR ? 'Her ay' : 'Monthly',
      };
      const label = hint.recurrenceDayLabel
        ? `Her ${hint.recurrenceDayLabel}`
        : recurrenceLabel[hint.recurrence];
      parts.push(`🔁 ${label}`);
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
    if (diffDays < 0) return thm.priorityHigh;
    if (diffDays === 0) return thm.priorityMedium;
    return thm.onSurfaceVariant;
  };

  const estimateDuration = (task: any) => {
    let base = task.priority === 'High' ? 45 : task.priority === 'Medium' ? 20 : 10;
    base += (task.subtasks || []).length * 5;
    return language === 'tr' ? `~${base} dk` : `~${base} min`;
  };

  const formatSmartDate = (dateStr?: string | null) => {
    if (!dateStr || dateStr.startsWith('0001-01-01')) return t.waitingForAction;
    const date = new Date(dateStr);
    const now = new Date();
    const isTR = language === 'tr';

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const dateStart = new Date(date); dateStart.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dateStart.getTime() - todayStart.getTime()) / 86400000);

    if (diffDays === 0) {
      const diffMin = Math.round((date.getTime() - now.getTime()) / 60000);
      if (diffMin > 0 && diffMin < 60) return isTR ? `${diffMin} dk sonra` : `In ${diffMin}m`;
      if (diffMin >= 60 && diffMin < 1440) {
        const h = Math.round(diffMin / 60);
        return isTR ? `${h} saat sonra` : `In ${h}h`;
      }
      return isTR ? 'Bugün' : 'Today';
    }
    if (diffDays === 1) return isTR ? 'Yarın' : 'Tomorrow';
    if (diffDays === -1) return isTR ? 'Dün' : 'Yesterday';
    if (diffDays > 1 && diffDays <= 6) return isTR ? `${diffDays} gün sonra` : `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -6) return isTR ? `${Math.abs(diffDays)} gün önce` : `${Math.abs(diffDays)} days ago`;
    if (diffDays === 7) return isTR ? 'Gelecek hafta' : 'Next week';

    const locale = isTR ? 'tr-TR' : 'en-US';
    const isCurrentYear = date.getFullYear() === now.getFullYear();
    const options: Intl.DateTimeFormatOptions = isCurrentYear
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString(locale, options);
  };

  const handleToggle = async (id: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.tags?.includes('weight_entry')) {
      Haptics.selectionAsync();
      setWeightModalTaskId(task.id);
      return;
    }

    const isCompleting = !task.isCompleted;

    if (isCompleting) {
      recordCompletion(task.id, task.title);
      // İlk-zafer: kullanıcının HAYATTAKİ ilk görev tamamlaması → milestone + (Pro'da)
      // ilk kutlama. Onboarding'in "anında değer" vaadini gerçek bir aksiyona bağlar.
      const prefsState = usePrefsStore.getState();
      if (!prefsState.firstWinAt) {
        prefsState.markFirstWin();
        track('first_task_completed');
        track('first_win');
        if (prefsState.uiMode !== 'lite') {
          useAchievementStore.getState().trigger(ACHIEVEMENTS.first_task);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (soundEffects) try {
        const p = createAudioPlayer(require('../assets/sounds/success.mp3'));
        p.volume = 0.6;
        p.play();
        setTimeout(() => { try { p.remove(); } catch {} }, 3000);
      } catch {}
      await cancelTaskNotification(id);

      if (hideCompleted) {
        // Optimistically mark as completing so it shows ✓ immediately
        toggleTaskCompletion(id);
        setCompletingIds(prev => new Set([...prev, id]));

        const opacity = new RNAnimated.Value(1);
        const translateY = new RNAnimated.Value(0);
        exitAnimMap.current.set(id, { opacity, translateY });

        RNAnimated.sequence([
          RNAnimated.delay(380),
          RNAnimated.parallel([
            RNAnimated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            RNAnimated.timing(translateY, { toValue: 50, duration: 300, useNativeDriver: true }),
          ]),
        ]).start(() => {
          exitAnimMap.current.delete(id);
          setCompletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        });

        if (!isOnline) {
          // Offline: queue the toggle and keep optimistic UI
          enqueueOffline({ type: 'toggle-task', id, isCompleted: true, completedAt: new Date().toISOString() });
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
          setCompletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        } else {
          try {
            await TaskService.updateTask(id, { ...task, priority: task.priority as any, isCompleted: true });
          } catch (error: any) {
            const isNetwork = !error.response;
            if (isNetwork) {
              enqueueOffline({ type: 'toggle-task', id, isCompleted: true, completedAt: new Date().toISOString() });
              showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
            } else {
              toggleTaskCompletion(id);
              setCompletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
              exitAnimMap.current.delete(id);
              showToast(t.toastUpdateFailed, 'error');
            }
          }
        }
        return;
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // In-flight guard: prevent double-tap desync
    if (completingIds.has(id)) return;
    setCompletingIds(prev => new Set([...prev, id]));
    toggleTaskCompletion(id);

    if (!isOnline) {
      enqueueOffline({ type: 'toggle-task', id, isCompleted: isCompleting, completedAt: isCompleting ? new Date().toISOString() : null });
      showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
      setCompletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      return;
    }

    try {
      await TaskService.updateTask(id, {
        ...task,
        priority: task.priority as any,
        isCompleted: isCompleting
      });
    } catch (error: any) {
      const isNetwork = !error.response;
      if (isNetwork) {
        enqueueOffline({ type: 'toggle-task', id, isCompleted: isCompleting, completedAt: isCompleting ? new Date().toISOString() : null });
        showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
      } else {
        toggleTaskCompletion(id);
        showToast(t.toastUpdateFailed, 'error');
      }
    } finally {
      setCompletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };



  const handleToggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pendingDeleteRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const handleDelete = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const snapshot = tasks.find((t) => t.id === id);
    if (!snapshot) return;
    removeTask(id);
    cancelTaskNotification(id);

    // Clean deleted task from any plan task ID arrays
    const ps = usePrefsStore.getState();
    const planSlots = [
      { mode: 'exam' as const, hIds: ps.examPlanHabitIds, tIds: ps.examPlanTaskIds },
      { mode: 'exam2' as const, hIds: ps.exam2PlanHabitIds, tIds: ps.exam2PlanTaskIds },
      { mode: 'exam3' as const, hIds: ps.exam3PlanHabitIds, tIds: ps.exam3PlanTaskIds },
      { mode: 'tez' as const, hIds: ps.tezPlanHabitIds, tIds: ps.tezPlanTaskIds },
      { mode: 'mulakat' as const, hIds: ps.mulakatPlanHabitIds, tIds: ps.mulakatPlanTaskIds },
      { mode: 'mulakat2' as const, hIds: ps.mulakat2PlanHabitIds, tIds: ps.mulakat2PlanTaskIds },
      { mode: 'mulakat3' as const, hIds: ps.mulakat3PlanHabitIds, tIds: ps.mulakat3PlanTaskIds },
      { mode: 'spor' as const, hIds: ps.sporPlanHabitIds, tIds: ps.sporPlanTaskIds },
      { mode: 'spor2' as const, hIds: ps.spor2PlanHabitIds, tIds: ps.spor2PlanTaskIds },
      { mode: 'spor3' as const, hIds: ps.spor3PlanHabitIds, tIds: ps.spor3PlanTaskIds },
      { mode: 'ramazan' as const, hIds: ps.ramazanPlanHabitIds, tIds: ps.ramazanPlanTaskIds },
    ];
    for (const { mode, hIds, tIds } of planSlots) {
      if (tIds.includes(id)) ps.setPlanIds(mode, hIds, tIds.filter(tid => tid !== id));
    }

    const isTR = language === 'tr';
    const undoLabel = isTR ? 'Geri Al' : 'Undo';
    const deleteMsg = isTR ? `"${snapshot.title.slice(0, 28)}" silindi` : `"${snapshot.title.slice(0, 28)}" deleted`;

    // Cancel any existing pending delete for this task
    const existing = pendingDeleteRef.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      pendingDeleteRef.current.delete(id);
      if (!isOnline) {
        enqueueOffline({ type: 'delete-task', id });
        return;
      }
      try { await TaskService.deleteTask(id); }
      catch (err: any) {
        if (!err.response) {
          enqueueOffline({ type: 'delete-task', id });
        } else {
          loadTasks();
        }
      }
    }, 4200);
    pendingDeleteRef.current.set(id, timer);

    showToast(deleteMsg, 'info', {
      label: undoLabel,
      onAction: () => {
        const t = pendingDeleteRef.current.get(id);
        if (t) { clearTimeout(t); pendingDeleteRef.current.delete(id); }
        addTask(snapshot);
      },
    });
  };

  const openAdd = async () => {
    prepareTask();
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNlpHint('');
    setTitleError(false);
    setModalVisible(true);

    try {
      const raw = await AsyncStorage.getItem('tazq-smart-hint-count');
      const count = raw ? parseInt(raw, 10) : 0;
      if (count < 6) {
        setShowSmartHint(true);
        await AsyncStorage.setItem('tazq-smart-hint-count', String(count + 1));
      } else {
        setShowSmartHint(false);
      }
    } catch {
      setShowSmartHint(false);
    }
  };

  const openEdit = (id: number) => {
    prepareTask();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const modeInfo = getModeInfoForTask(task, usePrefsStore.getState(), theme);
    if (modeInfo) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        language === 'tr' ? 'Otomatik Plan Görevi' : 'Automated Plan Task',
        language === 'tr' 
          ? `Bu görev "${modeInfo.labelTr}" tarafından otomatik yönetildiği için manuel düzenlenemez. Ayarlarını değiştirmek için Modlar sayfasından hedef kartını kullanabilirsin.` 
          : `This task is automatically managed by "${modeInfo.labelEn}". To adjust its behavior, please modify your settings in the Modes overview.`
      );
      return;
    }
    setEditingId(id);
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority as Priority,
      dueDate: task.dueDate?.split('T')[0] ?? '',
      dueTime: task.dueTime || '',
      tags: task.tags || [],
      subtasks: task.subtasks || [],
      recurrence: (task.recurrence as RecurrenceType) || 'None',
      reminderEnabled: task.tags?.includes('hatırlatıcı') || task.tags?.includes('reminder') || false
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

    const isTR = language === 'tr';
    const existingTask = editingId !== null ? tasks.find(t => t.id === editingId) : null;

    // Sync reminder tag with toggle
    let finalTagsWithReminder = [...finalTags];
    if (form.reminderEnabled && !finalTagsWithReminder.includes('hatırlatıcı')) {
        finalTagsWithReminder.push('hatırlatıcı');
    } else if (!form.reminderEnabled) {
        finalTagsWithReminder = finalTagsWithReminder.filter(t => t !== 'hatırlatıcı' && t !== 'reminder');
    }

    // Smart Validation: Reminder without time or past time
    if (form.reminderEnabled) {
        if (!form.dueTime) {
            Alert.alert(t.warningTitle || 'Warning', isTR ? "Hatırlatıcı için saat seçmelisiniz." : "Please select a time for the reminder.");
            setSaving(false);
            return;
        }
        if (!form.dueDate) {
            Alert.alert(t.warningTitle || 'Warning', isTR ? "Hatırlatıcı için tarih seçmelisiniz." : "Please select a date for the reminder.");
            setSaving(false);
            return;
        }

        // Past time check
        const target = new Date(form.dueDate);
        const timeParts = new Date(form.dueTime);
        target.setHours(timeParts.getHours(), timeParts.getMinutes(), 0, 0);
        
        if (target < new Date()) {
            Alert.alert(t.warningTitle || 'Warning', isTR ? "Geçmiş bir saate hatırlatıcı kurulamaz." : "Cannot set a reminder for a past time.");
            setSaving(false);
            return;
        }
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      isCompleted: existingTask ? existingTask.isCompleted : false,
      priority: form.priority,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      dueTime: form.dueTime || null,
      tags: finalTagsWithReminder,
      subtasks: form.subtasks,
      recurrence: form.recurrence,
    };

    try {
      if (editingId !== null) {
        if (!isOnline) {
          enqueueOffline({ type: 'update-task', id: editingId, payload });
          updateTask(editingId, { ...payload, id: editingId } as any);
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
          if (form.reminderEnabled && !payload.isCompleted) {
              scheduleTaskNotification(editingId, payload.title, payload.dueDate, payload.dueTime, language);
          } else {
              cancelTaskNotification(editingId);
          }
        } else {
          await TaskService.updateTask(editingId, payload);
          updateTask(editingId, { ...payload, id: editingId } as any);
          if (form.reminderEnabled && !payload.isCompleted) {
              scheduleTaskNotification(editingId, payload.title, payload.dueDate, payload.dueTime, language);
          } else {
              cancelTaskNotification(editingId);
          }
        }
      } else {
        if (!isOnline) {
          const tempId = -Date.now();
          enqueueOffline({ type: 'create-task', tempId, payload });
          addTask({ ...payload, id: tempId, title: form.title.trim() } as any);
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
          if (form.reminderEnabled) {
            scheduleTaskNotification(tempId, payload.title, payload.dueDate, payload.dueTime, language);
          }
        } else {
          const created = await TaskService.createTask(payload);
          addTask({ ...created, title: form.title.trim() } as any);
          if (created.id && form.reminderEnabled) {
            scheduleTaskNotification(created.id, payload.title, payload.dueDate, payload.dueTime, language);
          }
        }
      }
      setModalVisible(false);
      setNewSubtaskText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      if (!err.response) {
        if (editingId !== null) {
          enqueueOffline({ type: 'update-task', id: editingId, payload });
          updateTask(editingId, { ...payload, id: editingId } as any);
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
          setModalVisible(false);
        } else {
          const tempId = -Date.now();
          enqueueOffline({ type: 'create-task', tempId, payload });
          addTask({ ...payload, id: tempId, title: form.title.trim() } as any);
          showToast(language === 'tr' ? 'Çevrimdışı kaydedildi' : 'Saved offline', 'success');
          setModalVisible(false);
        }
      } else if (err.response?.status === 429) {
        const msg = language === 'tr' ? 'Maksimum görev sayısına ulaştın (200). Eski görevleri tamamla veya sil.' : 'Task limit reached (200). Complete or delete existing tasks.';
        Alert.alert(language === 'tr' ? 'Limit Doldu' : 'Limit Reached', msg);
      } else {
        const serverMsg = err.response?.data?.message || err.response?.data?.Message || err.message;
        Alert.alert(t.errorTitle, `${t.saveError}: ${serverMsg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const priorityColor = (p: string) => {
    if (p === 'High') return theme.priorityHigh;
    if (p === 'Medium') return theme.priorityMedium;
    return theme.priorityLow;
  };

  const getTagColor = getTagColorStatic;

  const filteredAndSortedTasks = useMemo(() => {
    const todayEndMs = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();

    let result = tasks.filter((task) => {
      // Global hide-completed toggle (skip when "done" filter is active, or task is mid-exit animation)
      if (hideCompleted && filter !== 'done' && task.isCompleted && !completingIds.has(task.id)) return false;
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
      // Tarihi gelmemiş görevleri gizle — dönemsel mod görevleri günü gelene kadar gizlenir, manuel görevler seçeneğe bağlı
      else if (filter === 'all' && !task.isCompleted && task.dueDate && !task.dueDate.startsWith('0001')) {
        const isFuture = new Date(task.dueDate).getTime() > todayEndMs;
        if (isFuture) {
          const modeInfo = getModeInfoForTask(task, usePrefsStore.getState(), theme);
          if (modeInfo) return false;
          if (!showFutureManualTasks) return false;
        }
      }
      // dateFilter from cockpit "+N more" button (YYYY-MM-DD)
      if (dateFilter && task.dueDate) {
        const taskDay = task.dueDate.slice(0, 10);
        if (taskDay !== dateFilter) return false;
      }
      if (tagFilter && !(task.tags || []).includes(tagFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(q);
        const inDesc = (task.description || '').toLowerCase().includes(q);
        const inTags = (task.tags || []).some(tag => tag.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inTags) return false;
      }
      return true;
    });

    if (sortBy === 'priority') {
      result = [...result].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));
    } else if (sortBy === 'date') {
      result = [...result].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    }
    return result;
  }, [tasks, filter, tagFilter, searchQuery, sortBy, hideCompleted, completingIds, showFutureManualTasks, theme]);

  const filteredTasks = filteredAndSortedTasks;
  const visibleTasks = useMemo(() => filteredTasks.slice(0, visibleCount), [filteredTasks, visibleCount]);
  const remainingCount = filteredTasks.length - visibleCount;
  const filters: FilterType[] = ['all', 'today', 'High', 'Medium', 'Low', 'done'];

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t.deleteTask,
      `${selectedIds.size} ${t.bulkDeleteConfirm}`,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.delete, style: 'destructive', onPress: async () => {
          for (const id of Array.from(selectedIds)) {
            const task = tasks.find(tk => tk.id === id);
            if (task?.isCompleted) recordCompletion(task.id, task.title, task.completedAt ?? undefined);
            removeTask(id);
            if (!isOnline) {
              enqueueOffline({ type: 'delete-task', id });
            } else {
              try { await TaskService.deleteTask(id); }
              catch (err: any) {
                if (!err.response) {
                  enqueueOffline({ type: 'delete-task', id });
                }
              }
            }
          }
          setSelectedIds(new Set());
          setIsBulkMode(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }},
      ]
    );
  };

  const handleBulkComplete = async () => {
    const ids = Array.from(selectedIds);
    // Optimistic update
    ids.forEach(id => toggleTaskCompletion(id));
    setSelectedIds(new Set());
    setIsBulkMode(false);

    const failed: number[] = [];
    for (const id of ids) {
      const task = tasks.find(tk => tk.id === id);
      if (!task) continue;
      try {
        await TaskService.updateTask(id, { ...task, priority: task.priority as any, isCompleted: true });
      } catch {
        failed.push(id);
        toggleTaskCompletion(id); // revert
      }
    }

    if (failed.length > 0) {
      showToast(t.toastUpdateFailed, 'error');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleClearCompleted = () => {
    const completedTasks = tasks.filter(t => t.isCompleted);
    if (completedTasks.length === 0) return;
    Alert.alert(
      t.clearCompleted,
      `${completedTasks.length} ${t.clearCompletedConfirm}`,
      [
        { text: t.cancel, style: 'cancel' },
        { text: t.delete, style: 'destructive', onPress: async () => {
          completedTasks.forEach(task => recordCompletion(task.id, task.title, task.completedAt ?? undefined));
          for (const task of completedTasks) {
            removeTask(task.id);
            if (!isOnline) {
              enqueueOffline({ type: 'delete-task', id: task.id });
            } else {
              try { await TaskService.deleteTask(task.id); }
              catch (err: any) {
                if (!err.response) {
                  enqueueOffline({ type: 'delete-task', id: task.id });
                }
              }
            }
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }},
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      
        {/* Floating TopBar */}
        <MotiView
            from={{ translateY: -20, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            style={[
                styles.floatingTopBar,
                {
                    position: 'absolute',
                    top: insets.top + S.sm,
                    left: sideInset(width),
                    right: sideInset(width),
                    zIndex: 100,
                    backgroundColor: Platform.OS === 'android' ? (isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)') : 'transparent',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    elevation: Platform.OS === 'android' ? 4 : 0,
                },
                Platform.OS !== 'android' && (isDark ? styles.darkTopBarShadow : styles.lightTopBarShadow)
            ]}
        >
            {Platform.OS !== 'android' && (
              <BlurView
                  intensity={isDark ? 50 : 30}
                  tint={colorScheme}
                  style={StyleSheet.absoluteFill}
              />
            )}
            <View style={[styles.topBarContent, { paddingHorizontal: S.sm, minHeight: 48 }]}>
              {/* Left Side (Fixed Width for Perfect Centering) */}
              <View style={{ width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                  {isBulkMode ? (
                      <Touchable onPress={() => { setIsBulkMode(false); setSelectedIds(new Set()); }} hitSlop={{top:10, bottom:10, left:10, right:10}} style={styles.headerIconBtn} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Seçimi iptal et' : 'Cancel selection'}>
                          <X size={24} color={theme.onSurface} />
                      </Touchable>
                  ) : (
                      // Sol: Sırala & Filtrele. Sağ: Ara (büyüteç). Back butonu YOK — alt navigasyondan gezilir.
                      <Touchable onPress={() => { setShowSortMenu(!showSortMenu); import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); }} style={styles.headerIconBtn} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Sırala ve filtrele' : 'Sort and filter'}>
                          <View>
                              <SlidersHorizontal size={22} color={(sortBy !== 'creation' || filter !== 'all' || !!tagFilter || hideCompleted) ? theme.primary : theme.onSurface} />
                              {(sortBy !== 'creation' || filter !== 'all' || !!tagFilter || hideCompleted) && (
                                  <View style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
                              )}
                          </View>
                      </Touchable>
                  )}
              </View>

              {/* Center Title (Takes remaining space, perfectly centered) */}
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
                  <Text 
                    numberOfLines={1} 
                    adjustsFontSizeToFit
                    style={{ fontSize: 20, fontWeight: '600', color: theme.onSurface, letterSpacing: TRACKING.title, textAlign: 'center' }}
                  >
                      {isBulkMode ? (language === 'tr' ? 'Seçim' : 'Selection') : t.actionCenter}
                  </Text>
              </View>

              {/* Right Side Buttons (Fixed Width for Perfect Centering) */}
              <View style={{ width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                  {isBulkMode ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                          {selectedIds.size > 0 && (
                              <View style={[styles.selBadge, { backgroundColor: theme.primary }]}>
                                  <Text style={{ color: theme.onPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>{selectedIds.size}</Text>
                              </View>
                          )}
                      </View>
                  ) : (
                      <Touchable onPress={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); }} style={styles.headerIconBtn} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Ara' : 'Search'}>
                          <Search size={22} color={showSearch ? theme.primary : theme.onSurface} />
                      </Touchable>
                  )}
              </View>
            </View>
        </MotiView>

        {showSortMenu && (
            <Touchable
              style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
              onPress={() => setShowSortMenu(false)}
              activeOpacity={1}
            />
        )}
        <AnimatePresence>
            {showSortMenu && (
              <MotiView
                from={{ opacity: 0, translateY: -8, scale: 0.95 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                exit={{ opacity: 0, translateY: -8, scale: 0.95 }}
                style={[styles.sortMenu, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderColor: theme.outline, top: insets.top + 70, right: S.lg }]}
              >
                {/* Hide Completed Toggle */}
                <Touchable
                    onPress={() => { setHideCompleted(v => !v); import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); }}
                    style={[styles.sortOption, { borderBottomColor: theme.outline, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                    <Text style={[{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }]}>
                        {language === 'tr' ? 'Tamamlananları Gizle' : 'Hide Completed'}
                    </Text>
                    {hideCompleted && <Check size={18} color={theme.primary} />}
                </Touchable>

                {/* Show Future Manual Tasks Toggle */}
                <Touchable
                    onPress={() => { setShowFutureManualTasks(v => !v); import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); }}
                    style={[styles.sortOption, { borderBottomColor: theme.outline, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                    <Text style={[{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }]}>
                        {language === 'tr' ? 'İleri Tarihli Eklenenleri Göster' : 'Show Future Manual Tasks'}
                    </Text>
                    {showFutureManualTasks && <Check size={18} color={theme.primary} />}
                </Touchable>

                {/* Archive Button */}
                <Touchable
                    onPress={() => { setShowSortMenu(false); router.push('/archive'); }}
                    style={[styles.sortOption, { borderBottomColor: theme.outline, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                    <Text style={[{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }]}>
                        {language === 'tr' ? 'Arşiv Klasörü' : 'Archive Folder'}
                    </Text>
                    <Archive size={18} color={theme.onSurfaceVariant} />
                </Touchable>

                {/* Sorting Options */}
                <View style={{ paddingHorizontal: S.lg, paddingVertical: S.xs, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                   <Text style={{ fontSize: 11, fontWeight: '600', opacity: 0.5, letterSpacing: 1 }}>{language === 'tr' ? 'SIRALAMA' : 'SORTING'}</Text>
                </View>

                {([['creation', t.sortByCreation], ['priority', t.sortByPriority], ['date', t.sortByDate]] as const).map(([key, label]) => (
                  <Touchable
                    key={key}
                    onPress={() => { setSortBy(key); setShowSortMenu(false); import('expo-haptics').then(Haptics => Haptics.selectionAsync()); }}
                    style={[styles.sortOption, { borderBottomColor: theme.outline, borderBottomWidth: key === 'date' ? 0 : StyleSheet.hairlineWidth }]}
                  >
                    <Text style={[{ color: sortBy === key ? theme.primary : theme.onSurface, fontSize: F.body, fontWeight: sortBy === key ? '700' : '400' }]}>
                      {label}
                    </Text>
                    {sortBy === key && <Check size={18} color={theme.primary} />}
                  </Touchable>
                ))}
              </MotiView>
            )}
        </AnimatePresence>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>



        
        <AnimatePresence>
          {showSearch && (
            <MotiView
              from={{ opacity: 0, translateY: -8, scale: 0.95 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={{ opacity: 0, translateY: -8, scale: 0.95 }}
              style={{ 
                  position: 'absolute', top: insets.top + 70, left: sideInset(width), right: sideInset(width), zIndex: 90,
                  shadowColor: isDark ? '#000' : theme.onSurface,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isDark ? 0.3 : 0.08,
                  shadowRadius: 16,
                  elevation: 8
              }}
            >
              <View style={[styles.searchBar, { 
                  overflow: 'hidden', 
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
                  backgroundColor: Platform.OS === 'android' ? (isDark ? theme.surfaceContainerHighest : '#FFFFFF') : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)') 
                }]}>
                {Platform.OS !== 'android' && (
                  <BlurView
                      intensity={isDark ? 40 : 20}
                      tint={isDark ? 'dark' : 'light'}
                      style={StyleSheet.absoluteFill}
                  />
                )}
                <Search size={18} color={theme.onSurfaceVariant} opacity={0.6} />
                <TextInput
                  ref={searchInputRef}
                  style={[styles.searchInput, { color: theme.onSurface }]}
                  placeholder={t.searchPlaceholder}
                  placeholderTextColor={theme.onSurfaceVariant + '80'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Touchable onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Aramayı temizle' : 'Clear search'}>
                    <X size={16} color={theme.onSurfaceVariant} />
                  </Touchable>
                )}
              </View>
            </MotiView>
          )}
        </AnimatePresence>
        
        <MotiView 
          key="list" 
          from={{ opacity: 0, translateY: 20 }} 
          animate={{ opacity: 1, translateY: 0 }} 
          style={{ flex: 1 }}
          transition={{ type: 'timing', duration: 400 }}
        >
          
        <Animated.FlatList itemLayoutAnimation={LinearTransition.springify().damping(18).stiffness(90)}

            style={{ flex: 1 }}
            data={filteredTasks}
            keyExtractor={(item: any) => item.id.toString()}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={false} // Must be false for itemLayoutAnimation to work when items jump large distances
            contentContainerStyle={{ gap: S.sm, paddingBottom: 100, paddingTop: 80, paddingHorizontal: S.lg, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
            extraData={{ highlightedId, isBulkMode, selectedIds, completingIds, language, expandedId }}
            ListHeaderComponent={() => (
        <React.Fragment>
            <MotiView animate={{ height: showSearch ? 52 : 0 }} transition={{ type: 'timing', duration: 250 }} />
            <View style={{ paddingBottom: S.md }}>
<Text style={[styles.subHeadline, { color: theme.onSurfaceVariant }]}>{t.allTasksReady}</Text>

          {/* Stats Row */}
          <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.md, marginBottom: S.md }}>
            <Touchable
              onPress={() => { setFilter(filter === 'done' ? 'all' : 'done'); Haptics.selectionAsync(); }}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm,
                paddingVertical: S.sm + 2, paddingHorizontal: S.md, borderRadius: R.md,
                backgroundColor: filter === 'done' ? theme.tertiary + '15' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderWidth: B.thin,
                borderColor: filter === 'done' ? theme.tertiary + '35' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}
              activeOpacity={0.7}
            >
              <TrendingUp size={13} color={filter === 'done' ? theme.tertiary : theme.onSurfaceVariant} opacity={0.7} />
              <Text style={{ fontSize: F.subhead, fontWeight: '600', color: filter === 'done' ? theme.tertiary : theme.onSurface }}>
                {tasks.filter(tk => tk.isCompleted).length}
              </Text>
              <Text style={{ fontSize: F.caption, fontWeight: '600', color: filter === 'done' ? theme.tertiary : theme.onSurfaceVariant, opacity: 0.75, flex: 1 }} numberOfLines={1}>
                {t.completedTasks}
              </Text>
            </Touchable>
            <Touchable
              onPress={() => { setFilter('all'); Haptics.selectionAsync(); }}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm,
                paddingVertical: S.sm + 2, paddingHorizontal: S.md, borderRadius: R.md,
                backgroundColor: filter === 'all' ? theme.primary + '12' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderWidth: B.thin,
                borderColor: filter === 'all' ? theme.primary + '30' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}
              activeOpacity={0.7}
            >
              <Clock size={13} color={filter === 'all' ? theme.primary : theme.onSurfaceVariant} opacity={0.7} />
              <Text style={{ fontSize: F.subhead, fontWeight: '600', color: filter === 'all' ? theme.primary : theme.onSurface }}>
                {tasks.filter(tk => !tk.isCompleted).length}
              </Text>
              <Text style={{ fontSize: F.caption, fontWeight: '600', color: filter === 'all' ? theme.primary : theme.onSurfaceVariant, opacity: 0.75, flex: 1 }} numberOfLines={1}>
                {t.pendingTasks}
              </Text>
            </Touchable>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 8 }}>
            {filters.map((f) => {
              const label = f === 'all' ? t.filterAll :
                            f === 'today' ? t.filterToday :
                            f === 'High' ? t.filterHigh :
                            f === 'Medium' ? t.filterMedium :
                            f === 'Low' ? t.filterLow :
                            f === 'done' ? t.filterDone : f;
              return (
                <Touchable 
                  key={f} 
                  onPress={() => { setFilter(f); Haptics.selectionAsync(); }}
                  style={[
                      styles.filterChip, 
                      { 
                          backgroundColor: filter === f ? (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)') : (Platform.OS === 'android' ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent'),
                          borderColor: filter === f ? theme.primary : theme.outline,
                          borderWidth: B.thin,
                          paddingVertical: S.xs,
                          paddingHorizontal: S.md
                      }
                  ]}
                >
                  <Text style={[styles.filterChipText, { color: filter === f ? theme.primary : theme.onSurfaceVariant, fontSize: F.body, fontWeight: filter === f ? '900' : '600' }]}>
                    {label}
                  </Text>
                </Touchable>
              );
            })}
          </ScrollView>

          {/* Tag Filter Pills */}
          {allTags.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
              <Touchable 
                onPress={() => { setTagFilter(null); Haptics.selectionAsync(); }}
                style={[styles.filterChip, { borderColor: !tagFilter ? theme.secondary : theme.outline, borderWidth: B.thin, paddingVertical: S.xs, paddingHorizontal: S.md }]}
              >
                <Text style={[styles.filterChipText, { color: !tagFilter ? theme.secondary : theme.onSurfaceVariant, fontSize: F.caption }]}>
                  {t.allTags}
                </Text>
              </Touchable>
              {allTags.map((tag) => (
                <Touchable 
                  key={tag}
                  onPress={() => { setTagFilter(tagFilter === tag ? null : tag); Haptics.selectionAsync(); }}
                  style={[styles.filterChip, { borderColor: tagFilter === tag ? theme.secondary : theme.outline, borderWidth: B.thin, paddingVertical: S.xs, paddingHorizontal: S.md }]}
                >
                  <Text style={[styles.filterChipText, { color: tagFilter === tag ? theme.secondary : theme.onSurfaceVariant, fontSize: F.caption }]}>
                    #{tag}
                  </Text>
                </Touchable>
              ))}
            </ScrollView>
          )}

          {/* Task List */}
          
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text
                    style={[styles.sectionTitle, { color: theme.onSurface, fontSize: F.subhead, flex: 1 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                >
                    {t.upcoming}
                </Text>
                <Touchable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleClearCompleted(); }}
                    style={{ padding: 4 }}
                >
                    <Trash2 size={16} color={theme.onSurfaceVariant + '80'} />
                </Touchable>
            </View>
            
            
                </View>
        </React.Fragment>
    )}
            ListEmptyComponent={() => {
                const isSearch = !!searchQuery.trim();
                const hasCompletedTasks = tasks.some(t => t.isCompleted);
                const titleText = isSearch
                  ? t.noResults
                  : hasCompletedTasks
                  ? (language === 'tr' ? 'Bugün Dünyayı Kurtardın! ✨' : 'You Saved the Day! ✨')
                  : (language === 'tr' ? 'Huzurlu bir boşluk 🌿' : 'Peaceful Canvas 🌿');
                const bodyText = isSearch
                  ? (language === 'tr' ? `"${searchQuery}" için sonuç bulunamadı` : `No results for "${searchQuery}"`)
                  : hasCompletedTasks
                  ? (language === 'tr' ? 'Tüm görevleri tertemiz bitirdin. Şimdi en sevdiğin kahveyi koy ve hiçbir şey düşünmeden dinlen ☕' : 'All cleared up! Time to grab your favorite coffee and relax your mind ☕')
                  : (language === 'tr' ? 'Henüz planlanmış bir işin yok. Aklına gelen bir fikri sesle veya yazarak ekleyebilirsin.' : 'No tasks scheduled yet. Tap + or use your voice to capture your thoughts.');

                return (
                  <MotiView key="empty" from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={styles.emptyState}>
                      <MotiView
                          animate={{ scale: [1, 1.15, 1], rotate: ['0deg', '8deg', '-8deg', '0deg'] }}
                          transition={{ loop: true, duration: 3500 }}
                          style={{ marginBottom: 16, opacity: hasCompletedTasks ? 0.9 : 0.4 }}
                      >
                          <Sparkles size={44} color={hasCompletedTasks ? '#F59E0B' : theme.primary} />
                      </MotiView>
                      <Text style={[styles.emptyTitle, { color: theme.onSurface, textAlign: 'center' }]}>{titleText}</Text>
                      <Text style={[styles.emptyText, { color: theme.onSurfaceVariant, textAlign: 'center', marginTop: 6, maxWidth: 280, lineHeight: 20 }]}>{bodyText}</Text>
                      {!isSearch && !hasCompletedTasks && (
                        <Touchable
                          onPress={openAdd}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: S.lg, paddingVertical: S.sm + 2, borderRadius: R.full, marginTop: S.lg }}
                          accessibilityRole="button"
                          accessibilityLabel={language === 'tr' ? 'İlk görevini ekle' : 'Add your first task'}
                        >
                          <Plus size={18} color={theme.onPrimary} strokeWidth={2.5} />
                          <Text style={{ color: theme.onPrimary, fontWeight: '800', fontSize: F.body }}>
                            {language === 'tr' ? 'İlk görevini ekle' : 'Add your first task'}
                          </Text>
                        </Touchable>
                      )}
                  </MotiView>
                );
            }}
            renderItem={({ item: task, index: i }: any) => (
                <MemoizedTaskItem
                    task={task}
                    i={i}
                    theme={theme}
                    isDark={isDark}
                    highlightedId={highlightedId}
                    isBulkMode={isBulkMode}
                    isSelected={selectedIds.has(task.id)}
                    language={language}
                    t={t}
                    showSwipePeek={showSwipePeek}
                    priorityColor={priorityColor}
                    handleDelete={handleDelete}
                    handleToggleExpand={handleToggleExpand}
                    handleLongPress={(id: number) => {
                        if (!isBulkMode) {
                            import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
                            setIsBulkMode(true);
                            setSelectedIds(new Set([id]));
                        }
                    }}
                    handleBulkSelect={(id: number) => {
                        import('expo-haptics').then(Haptics => Haptics.selectionAsync());
                        setSelectedIds(prev => {
                            const next = new Set(prev);
                            next.has(id) ? next.delete(id) : next.add(id);
                            return next;
                        });
                    }}
                    handleToggle={handleToggle}
                    toggleSubtask={toggleSubtask}
                    completingIds={completingIds}
                    expandedId={expandedId}
                    subtaskSaveTimers={subtaskSaveTimers}
                />
            )}
            ListFooterComponent={() => (
                filteredTasks.length > 0 && !isBulkMode ? (
                    <Text style={{ fontSize: 12, color: theme.onSurfaceVariant, opacity: isDark ? 0.5 : 0.35, textAlign: 'center', marginTop: 16, fontWeight: '600', letterSpacing: 0.3 }}>
                        {t.swipeHint}
                    </Text>
                ) : null
            )}
        />
        </MotiView>
      </SafeAreaView>

            {/* Minimalist Premium Bulk Action Pill */}
      <AnimatePresence>
        {isBulkMode && (
          <MotiView
            from={{ translateY: 80, opacity: 0, scale: 0.9 }}
            animate={{ translateY: 0, opacity: 1, scale: 1 }}
            exit={{ translateY: 80, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            style={[
              {
                position: 'absolute',
                bottom: 90 + insets.bottom,
                alignSelf: 'center',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 999,
                backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.15,
                shadowRadius: 20,
                elevation: 10,
                zIndex: 100
              }
            ]}
          >
            {Platform.OS !== 'android' && (
              <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            )}
            
            {/* Edit (only if 1 selected and not mode task) */}
            <Touchable
              onPress={() => {
                if (selectedIds.size !== 1) return;
                const id = Array.from(selectedIds)[0];
                const modeInfo = getModeInfoForTask(id, usePrefsStore.getState(), theme);
                if (modeInfo) {
                    import('expo-haptics').then(Haptics => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
                    Alert.alert(
                      language === 'tr' ? 'Otomatik Plan Görevi' : 'Automated Plan Task',
                      language === 'tr' 
                        ? `Bu görev "${modeInfo.labelTr}" tarafından otomatik yönetildiği için manuel düzenlenemez. Ayarlarını değiştirmek için Modlar sayfasından hedef kartını kullanabilirsin.` 
                        : `This task is automatically managed by "${modeInfo.labelEn}". To adjust its behavior, please modify your settings in the Modes overview.`
                    );
                    return;
                }
                setIsBulkMode(false);
                setSelectedIds(new Set());
                openEdit(id);
              }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: selectedIds.size === 1 && !getModeInfoForTask(Array.from(selectedIds)[0], usePrefsStore.getState(), theme) ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              <Pencil size={20} color={selectedIds.size === 1 && !getModeInfoForTask(Array.from(selectedIds)[0], usePrefsStore.getState(), theme) ? theme.onSurface : theme.onSurfaceVariant + '40'} />
            </Touchable>

            {/* Complete */}
            <Touchable
              onPress={handleBulkComplete}
              disabled={selectedIds.size === 0}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: selectedIds.size > 0 ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              <CheckCircle2 size={22} color={selectedIds.size > 0 ? theme.success : theme.onSurfaceVariant + '40'} />
            </Touchable>

            {/* Delete */}
            <Touchable
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: selectedIds.size > 0 ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              <Trash2 size={20} color={selectedIds.size > 0 ? theme.priorityHigh : theme.onSurfaceVariant + '40'} />
            </Touchable>
          </MotiView>
        )}
      </AnimatePresence>

      {!isBulkMode && !(Platform.OS === 'android' && kbHeight > 0) && (
        <Touchable
          onPress={openAdd}
          style={[
              styles.fab,
              {
                  backgroundColor: isDark ? '#F4F4F5' : '#0F0F0F',
                  shadowColor: '#000',
                  width: 64,
                  height: 64,
                  borderRadius: R.lg,
                  bottom: Math.max(insets.bottom, 16) + 88,
                  right: S.lg
              }
          ]}
        >
          <Plus size={32} color={isDark ? '#09090B' : '#FFFFFF'} strokeWidth={3} />
        </Touchable>
      )}

      <BottomNavBar />

      <WeightEntryModal
        visible={weightModalTaskId !== null}
        taskId={weightModalTaskId}
        onClose={() => setWeightModalTaskId(null)}
      />

      {/* Modern Stitch Modal */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={() => !saving && setModalVisible(false)} onShow={() => taskSlideIn()}>
        <View style={styles.overlay}>
          <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !saving && setModalVisible(false)} />

          <View style={styles.sheetContainer}>
            <RNAnimated.View style={[styles.sheet, taskSlide, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', padding: S.lg, borderBottomLeftRadius: kbHeight > 0 ? S.xl : 0, borderBottomRightRadius: kbHeight > 0 ? S.xl : 0, maxHeight: height - insets.top - 16 }]}>
                <View {...taskPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
                  <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                </View>
                
                <View style={[styles.sheetHeader, { marginBottom: !editingId ? S.sm : S.lg }]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface, fontSize: F.title }]}>
                        {editingId ? t.editTask : t.addTask}
                    </Text>
                    <Touchable
                        onPress={() => !saving && setModalVisible(false)}
                        style={[styles.closeModalBtn, saving && { opacity: 0.35 }]}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'}
                    >
                        <X size={20} color={theme.onSurfaceVariant} />
                    </Touchable>
                </View>
                {!editingId && (
                    <View style={{ flexDirection: 'row', gap: S.xs, marginBottom: S.lg, flexWrap: 'wrap' }}>
                        {[
                            { text: language === 'tr' ? 'Tarih' : 'Due date', icon: <Calendar size={10} color={theme.primary} /> },
                            { text: language === 'tr' ? 'Öncelik' : 'Priority', icon: <Target size={10} color={theme.primary} /> },
                            { text: language === 'tr' ? 'Hatırlatıcı' : 'Reminder', icon: <Bell size={10} color={theme.primary} /> }
                        ].map((chip) => (
                            <View key={chip.text} style={{ backgroundColor: theme.primary + '14', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                {chip.icon}
                                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.primary, letterSpacing: 0.3 }}>{chip.text}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <ScrollView
                    style={styles.formContainer}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: S.lg }}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                >
                    <View style={styles.section}>
                        <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 60 }]}>
                                <TextInput
                                    style={[styles.modalInput, { color: theme.onSurface, fontSize: F.body }]}
                                    placeholder={isListeningTitle ? t.listeningLabel : t.taskTitle}
                                    placeholderTextColor={theme.onSurfaceVariant + '99'}
                                    value={form.title}
                                    onChangeText={handleTitleChange}
                                    maxLength={150}
                                    underlineColorAndroid="transparent"
                                />
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                                    {nlpHint ? <Sparkles size={16} color={theme.primary} /> : null}
                                    <Touchable onPress={() => toggleVoice('title')} style={{ padding: S.xs, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={isListeningTitle ? (language === 'tr' ? 'Dinlemeyi durdur' : 'Stop listening') : (language === 'tr' ? 'Sesle yaz' : 'Voice input')} accessibilityState={{ busy: isListeningTitle }}>
                                        <VoiceWave active={isListeningTitle} theme={theme} />
                                        <Mic size={18} color={isListeningTitle ? theme.primary : theme.onSurfaceVariant} />
                                    </Touchable>
                                </View>
                            </View>
                            {nlpHint ? (
                                <MotiText
                                    from={{ opacity: 0, translateY: -5 }}
                                    animate={{ opacity: 1, translateY: 0 }}
                                    style={{ color: theme.primary, fontSize: F.caption, marginTop: S.sm, marginLeft: S.md, fontWeight: '600', letterSpacing: 0.5 }}
                                >
                                    {nlpHint}
                                </MotiText>
                            ) : showSmartHint && !editingId ? (
                                <MotiView
                                    from={{ opacity: 0, translateY: -4 }}
                                    animate={{ opacity: 1, translateY: 0 }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, marginLeft: S.md }}
                                >
                                    <Sparkles size={11} color={theme.primary} />
                                    <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '600', opacity: 0.75 }}>
                                        {language === 'tr'
                                            ? '"yarın", "acil", "hatırlatıcı" gibi kelimeler otomatik algılanır'
                                            : '"tomorrow", "urgent", "reminder" are auto-detected'}
                                    </Text>
                                </MotiView>
                            ) : null}

                            <View style={[styles.inputGroup, styles.modalTextArea, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, marginTop: S.sm, height: 100 }]}>
                                <TextInput
                                    style={[styles.modalInput, { color: theme.onSurface, paddingTop: S.sm, fontSize: F.body }]}
                                    placeholder={isListeningDesc ? t.listeningLabel : t.taskDescription + '...'}
                                    placeholderTextColor={theme.onSurfaceVariant + '99'}
                                    value={form.description}
                                    onChangeText={handleDescriptionChange}
                                    multiline
                                    numberOfLines={3}
                                    maxLength={500}
                                    underlineColorAndroid="transparent"
                                />
                                <Touchable onPress={() => toggleVoice('description')} style={{ position: 'absolute', right: S.md, top: 14, padding: S.xs, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={isListeningDesc ? (language === 'tr' ? 'Dinlemeyi durdur' : 'Stop listening') : (language === 'tr' ? 'Sesle yaz' : 'Voice input')} accessibilityState={{ busy: isListeningDesc }}>
                                    <VoiceWave active={isListeningDesc} theme={theme} />
                                    <Mic size={18} color={isListeningDesc ? theme.primary : theme.onSurfaceVariant} />
                                </Touchable>
                            </View>
                    </View>

                    <View style={styles.section}>
                        {/* Date & Time Chips */}
                        {!showDatePicker && !showTimePicker && (
                          <View style={styles.dateTimeRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.md }]}>{t.dueDate.toUpperCase()}</Text>
                                <Touchable
                                    onPress={openDatePicker}
                                    style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 52 }]}
                                >
                                    <Timer size={14} color={theme.primary} />
                                    <Text style={[styles.chipText, { color: form.dueDate ? theme.onSurface : theme.onSurfaceVariant + '60', fontSize: 12 }]}>
                                        {form.dueDate || t.selectDate}
                                    </Text>
                                </Touchable>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: F.caption, marginBottom: S.md }]}>{t.dueTime.toUpperCase()}</Text>
                                <Touchable
                                    onPress={openTimePicker}
                                    style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: 52 }]}
                                >
                                    <Sparkles size={14} color={theme.secondary} />
                                    <Text style={[styles.chipText, { color: form.dueTime ? theme.onSurface : theme.onSurfaceVariant + '60', fontSize: 12 }]}>
                                        {form.dueTime ? new Date(form.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t.selectTime}
                                    </Text>
                                </Touchable>
                            </View>
                          </View>
                        )}

                        {/* Inline Date Picker */}
                        {showDatePicker && (
                          <View style={[styles.inlinePicker, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
                            <Text style={[styles.inlinePickerTitle, { color: theme.onSurface }]}>{t.dueDate}</Text>
                            <View style={styles.pickerRow}>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.day}</Text>
                                <Touchable onPress={() => setPickerDate(d => ({ ...d, day: Math.min(d.day + 1, daysInMonth(d.year, d.month)) }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerDate.day).padStart(2, '0')}</Text>
                                <Touchable 
                                  onPress={() => setPickerDate(d => {
                                    const now = new Date();
                                    const minDay = (d.year === now.getFullYear() && d.month === (now.getMonth() + 1)) ? now.getDate() : 1;
                                    return { ...d, day: Math.max(d.day - 1, minDay) };
                                  })} 
                                  style={styles.pickerArrow}
                                >
                                  <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                                </Touchable>
                              </View>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.month}</Text>
                                <Touchable onPress={() => setPickerDate(d => ({ ...d, month: d.month === 12 ? 1 : d.month + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerDate.month).padStart(2, '0')}</Text>
                                <Touchable 
                                  onPress={() => setPickerDate(d => {
                                    const now = new Date();
                                    const minMonth = d.year === now.getFullYear() ? (now.getMonth() + 1) : 1;
                                    return { ...d, month: Math.max(d.month - 1, minMonth) };
                                  })} 
                                  style={styles.pickerArrow}
                                >
                                  <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                                </Touchable>
                              </View>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.year}</Text>
                                <Touchable onPress={() => setPickerDate(d => ({ ...d, year: d.year + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{pickerDate.year}</Text>
                                <Touchable 
                                  onPress={() => setPickerDate(d => ({ ...d, year: Math.max(d.year - 1, new Date().getFullYear()) }))} 
                                  style={styles.pickerArrow}
                                >
                                  <Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text>
                                </Touchable>
                              </View>
                            </View>
                            {dateError && (
                              <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} style={[{ backgroundColor: theme.error + '15', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm, marginBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.sm }]}>
                                <Text style={{ color: theme.error, fontSize: F.caption, fontWeight: '600' }}>{t.invalidDate}</Text>
                              </MotiView>
                            )}
                            <View style={styles.pickerActions}>
                              <Touchable onPress={() => setShowDatePicker(false)} style={[styles.pickerCancelBtn, { borderColor: theme.outline }]}><Text style={[styles.pickerBtnText, { color: theme.onSurfaceVariant }]}>{t.cancel}</Text></Touchable>
                              <Touchable onPress={confirmDate} style={[styles.pickerConfirmBtn, { backgroundColor: theme.primary }]}><Text style={[styles.pickerBtnText, { color: '#000', fontWeight: '600' }]}>{t.save}</Text></Touchable>
                            </View>
                          </View>
                        )}

                        {/* Inline Time Picker */}
                        {showTimePicker && (
                          <View style={[styles.inlinePicker, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
                            <Text style={[styles.inlinePickerTitle, { color: theme.onSurface }]}>{t.dueTime}</Text>
                            <View style={styles.pickerRow}>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.hour}</Text>
                                <Touchable onPress={() => setPickerTime(pt => ({ ...pt, hour: pt.hour === 23 ? 0 : pt.hour + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerTime.hour).padStart(2, '0')}</Text>
                                <Touchable onPress={() => setPickerTime(pt => ({ ...pt, hour: pt.hour === 0 ? 23 : pt.hour - 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text></Touchable>
                              </View>
                              <Text style={[styles.pickerColon, { color: theme.onSurface }]}>:</Text>
                              <View style={styles.pickerCol}>
                                <Text style={[styles.pickerColLabel, { color: theme.onSurfaceVariant }]}>{t.minute}</Text>
                                <Touchable onPress={() => setPickerTime(pt => ({ ...pt, minute: pt.minute === 59 ? 0 : pt.minute + 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▲</Text></Touchable>
                                <Text style={[styles.pickerValue, { color: theme.onSurface }]}>{String(pickerTime.minute).padStart(2, '0')}</Text>
                                <Touchable onPress={() => setPickerTime(pt => ({ ...pt, minute: pt.minute === 0 ? 59 : pt.minute - 1 }))} style={styles.pickerArrow}><Text style={[styles.pickerArrowText, { color: theme.primary }]}>▼</Text></Touchable>
                              </View>
                            </View>
                            <View style={styles.pickerActions}>
                              <Touchable onPress={() => setShowTimePicker(false)} style={[styles.pickerCancelBtn, { borderColor: theme.outline }]}><Text style={[styles.pickerBtnText, { color: theme.onSurfaceVariant }]}>{t.cancel}</Text></Touchable>
                              <Touchable onPress={confirmTime} style={[styles.pickerConfirmBtn, { backgroundColor: theme.primary }]}><Text style={[styles.pickerBtnText, { color: '#000', fontWeight: '600' }]}>{t.save}</Text></Touchable>
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
                                <Touchable
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
                                </Touchable>
                            ))}
                        </View>
                    </View>

                    {/* Recurrence Picker */}
                    <View style={styles.section}>
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.recurrence.toUpperCase()}</Text>
                        <View style={[styles.priorityRow, { gap: S.sm }]}>
                            {RECURRENCE_OPTIONS.map((r) => (
                                <Touchable
                                    key={r.key}
                                    onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, recurrence: r.key })); }}
                                    style={[styles.priorityTab, { backgroundColor: form.recurrence === r.key ? theme.secondary : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow), height: 42 }]}
                                >
                                    {r.key !== 'None' && <Repeat size={12} color={form.recurrence === r.key ? 'white' : theme.onSurfaceVariant} />}
                                    <Text style={[styles.priorityTabText, { color: form.recurrence === r.key ? 'white' : theme.onSurfaceVariant, fontSize: F.caption }]}>
                                        {(t as any)[r.labelKey]}
                                    </Text>
                                </Touchable>
                            ))}
                        </View>
                        {/* Next occurrence hint */}
                        {form.recurrence !== 'None' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm }}>
                                <Repeat size={11} color={theme.secondary} />
                                {form.dueDate ? (
                                    <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.secondary }}>
                                        {getNextOccurrenceLabel(form.dueDate, form.recurrence, language)}
                                    </Text>
                                ) : (
                                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant }}>
                                        {language === 'tr' ? 'Tekrar için tarih seçin' : 'Set a due date to track recurrence'}
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Reminder Toggle */}
                    <View style={styles.section}>
                        <Touchable
                            onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, reminderEnabled: !f.reminderEnabled })); }}
                            style={[styles.inputGroup, {
                                backgroundColor: form.reminderEnabled
                                    ? theme.priorityMedium + (isDark ? '1F' : '14')
                                    : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow),
                                height: 52,
                            }]}
                        >
                            <Bell size={18} color={form.reminderEnabled ? theme.priorityMedium : theme.onSurfaceVariant} />
                            <Text style={{ flex: 1, fontSize: F.body, fontWeight: '600', color: form.reminderEnabled ? theme.priorityMedium : theme.onSurfaceVariant, marginLeft: S.sm }}>
                                {t.reminderLabel}
                            </Text>
                            <View style={{
                                width: 44, height: 26, borderRadius: 13,
                                backgroundColor: form.reminderEnabled ? theme.priorityMedium : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
                                justifyContent: 'center', paddingHorizontal: 2,
                            }}>
                                <MotiView
                                    animate={{ translateX: form.reminderEnabled ? 18 : 0 }}
                                    transition={{ type: 'spring', damping: 15 }}
                                    style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'white' }}
                                />
                            </View>
                        </Touchable>
                    </View>

                    {/* Subtasks Editor */}
                    <View style={styles.section}>
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.subtasks.toUpperCase()}</Text>
                        {form.subtasks.map((sub, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
                                <Touchable onPress={() => {
                                    const subs = [...form.subtasks];
                                    subs[i] = { ...subs[i], done: !subs[i].done };
                                    setForm(f => ({ ...f, subtasks: subs }));
                                }}>
                                    {sub.done 
                                        ? <CheckCircle2 size={18} color={theme.tertiary} />
                                        : <Circle size={18} color={theme.onSurfaceVariant} />
                                    }
                                </Touchable>
                                <Text style={{ flex: 1, fontSize: F.body, fontWeight: '600', color: theme.onSurface, textDecorationLine: sub.done ? 'line-through' : 'none', opacity: sub.done ? 0.4 : 1 }}>{sub.text}</Text>
                                <Touchable onPress={() => {
                                    setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, idx) => idx !== i) }));
                                }} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Alt görevi kaldır' : 'Remove subtask'}>
                                    <X size={16} color={theme.onSurfaceVariant} />
                                </Touchable>
                            </View>
                        ))}
                        <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: verticalScale(44) }]}>
                            <TextInput
                                style={[styles.modalInput, { color: theme.onSurface, fontSize: F.body }]}
                                placeholder={t.addSubtask}
                                placeholderTextColor={theme.onSurfaceVariant + '99'}
                                value={newSubtaskText}
                                onChangeText={setNewSubtaskText}
                                returnKeyType="done"
                                maxLength={100}
                                underlineColorAndroid="transparent"
                                onSubmitEditing={() => {
                                    if (newSubtaskText.trim() && form.subtasks.length < 15) {
                                        setForm(f => ({ ...f, subtasks: [...f.subtasks, { text: newSubtaskText.trim(), done: false }] }));
                                        setNewSubtaskText('');
                                    }
                                }}
                            />
                            <Touchable
                                onPress={() => {
                                    if (newSubtaskText.trim() && form.subtasks.length < 15) {
                                        setForm(f => ({ ...f, subtasks: [...f.subtasks, { text: newSubtaskText.trim(), done: false }] }));
                                        setNewSubtaskText('');
                                    }
                                }}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <Plus size={18} color={theme.primary} />
                            </Touchable>
                        </View>
                    </View>

                </ScrollView>

                {/* Sticky save — always visible outside the scroll area */}
                <Touchable onPress={handleSave} disabled={saving} style={[styles.modalSaveBtn, { marginTop: S.sm, marginBottom: 0 }]}>
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
                </Touchable>
            </RNAnimated.View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.sm },
  backBtn: { width: scale(40), height: scale(40), borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '600', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  headerIconBtn: { width: scale(40), height: scale(40), borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  selBadge: { minWidth: scale(22), height: scale(22), borderRadius: scale(11), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  aiBtn: { width: scale(40), height: scale(40), borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: S.lg, gap: S.sm, height: verticalScale(46) },
  searchInput: { flex: 1, fontWeight: '400', fontSize: F.body, letterSpacing: -0.2 },
  sortMenu: { position: 'absolute', top: verticalScale(56), right: S.lg, zIndex: 200, borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden', minWidth: scale(180), shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  sortOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingVertical: S.md, borderBottomWidth: StyleSheet.hairlineWidth },
  bulkPill: {
    paddingHorizontal: S.lg, paddingVertical: verticalScale(10),
    borderWidth: B.thin, zIndex: 100,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 14,
  },
  bulkCountRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  bulkDot: { width: scale(7), height: scale(7), borderRadius: scale(4) },
  bulkCountText: { fontSize: F.body, fontWeight: '600' },
  bulkSep: { width: 1, height: verticalScale(22), marginHorizontal: S.sm },
  bulkIconBtn: { width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center' },
  headline: { fontWeight: '600', letterSpacing: -1.5 },
  subHeadline: { fontWeight: '600', opacity: 0.7, marginTop: S.xs },
  statsGrid: { flexDirection: 'row' },
  statLabel: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginVertical: S.xs },
  statValue: { fontWeight: '600', letterSpacing: -1 },
  trendBadge: { padding: S.xs, borderRadius: R.sm },
  statSub: { fontWeight: '600' },
  filterScroll: { marginBottom: S.lg },
  filterChip: { borderRadius: 100 },
  filterChipText: { fontWeight: '600' },
  listSection: { flex: 1 },
  sectionTitle: { fontWeight: '600', marginBottom: S.md },
  taskCard: { borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 0 },
  priorityIndicator: { height: verticalScale(32), borderRadius: R.sm, marginRight: S.md },
  taskContent: { flex: 1 },
  taskTitleText: { fontWeight: '600' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  taskMetaText: { fontWeight: '600' },
  taskActions: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 100 },
  emptyState: { padding: S.xl, alignItems: 'center', gap: 16 },
  emptyTitle: { fontSize: F.subhead, fontWeight: '600', letterSpacing: -0.3 },
  emptyText: { fontSize: F.body, fontWeight: '500', opacity: 0.6, textAlign: 'center' },
  deleteAction: {
    width: scale(80),
    marginBottom: S.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: R.lg,
    marginLeft: scale(-24),
    paddingLeft: S.sm,
  },
  categoryBadge: { paddingHorizontal: S.sm, paddingVertical: 2, borderRadius: R.sm },
  categoryBadgeText: { fontSize: moderateScale(10), fontWeight: '600', textTransform: 'lowercase' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { width: '100%' },
  sheet: { borderTopLeftRadius: S.xl, borderTopRightRadius: S.xl, borderWidth: B.thin, borderBottomWidth: 0 },
  handle: { width: scale(40), height: scale(4), borderRadius: R.sm, alignSelf: 'center', marginBottom: S.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontWeight: '600', letterSpacing: -0.5 },
  closeModalBtn: { width: scale(40), height: scale(40), borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  formContainer: { paddingHorizontal: 4 },
  section: { marginBottom: S.md },
  inputGroup: { borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md },
  modalInput: { flex: 1, fontWeight: '600' },
  modalTextArea: { alignItems: 'flex-start' },
  dateTimeRow: { flexDirection: 'row', gap: S.sm },
  dateTimeChip: { flex: 1, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, gap: scale(10) },
  chipText: { flex: 1, fontWeight: '600' },
  optionLabel: { fontWeight: '600', letterSpacing: 1.2, marginBottom: S.sm, marginLeft: S.xs, opacity: 0.6 },
  priorityRow: { flexDirection: 'row' },
  priorityTab: { flex: 1, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  priorityTabText: { fontWeight: '600' },
  modalSaveBtn: { borderRadius: R.lg, overflow: 'hidden', marginTop: S.lg, marginBottom: S.xl },
  modalSaveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, height: verticalScale(56) },
  modalSaveText: { color: 'white', fontWeight: '600', letterSpacing: -0.5, textAlign: 'center', paddingTop: Platform.OS === 'ios' ? 2 : 0 },
  inlinePicker: { borderRadius: R.lg, padding: S.md, alignItems: 'center', borderWidth: B.thin },
  inlinePickerTitle: { fontSize: F.body, fontWeight: '600', marginBottom: S.md, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.7 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.md },
  pickerCol: { alignItems: 'center', minWidth: scale(60) },
  pickerColLabel: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1, marginBottom: S.sm, opacity: 0.5 },
  pickerArrow: { padding: S.sm },
  pickerArrowText: { fontSize: F.body, fontWeight: '600' },
  pickerValue: { fontSize: moderateScale(32), fontWeight: '600', letterSpacing: -1, lineHeight: verticalScale(40) },
  pickerColon: { fontSize: moderateScale(28), fontWeight: '600', marginTop: S.sm },
  pickerActions: { flexDirection: 'row', gap: S.sm, width: '100%', marginTop: S.sm },
  pickerCancelBtn: { flex: 1, borderRadius: R.md, borderWidth: B.medium, height: verticalScale(48), alignItems: 'center', justifyContent: 'center' },
  pickerConfirmBtn: { flex: 1, borderRadius: R.md, height: verticalScale(48), alignItems: 'center', justifyContent: 'center' },
  pickerBtnText: { fontWeight: '600', paddingTop: Platform.OS === 'ios' ? 2 : 0 },

    floatingTopBar: { borderRadius: R.full, overflow: 'hidden', borderWidth: B.thin },
    lightTopBarShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
    darkTopBarShadow: { shadowColor: '#3367ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
    topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.sm },
});

