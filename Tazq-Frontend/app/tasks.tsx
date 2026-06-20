import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions, Animated as RNAnimated, AppState, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import Animated, { Layout } from 'react-native-reanimated';
import { Check, Timer, Plus, X, Pencil, Sparkles, TrendingUp, Bell, Clock, Tag, Calendar, Trash2, Repeat, ListChecks, CheckCircle2, Circle, Mic, ArrowLeft, Search, SlidersHorizontal, CheckSquare } from 'lucide-react-native';
import { SubtaskProgressRing } from '../components/SubtaskProgressRing';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { TaskService, Priority, RecurrenceType, SubtaskItem } from '../services/api';
import { parseTaskHint } from '../utils/taskParser';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { SwipeableItem } from '../components/SwipeableItem';
import { useToastStore } from '../store/useToastStore';
import { categorizeTask } from '../utils/taskIntelligence';
import { useAppTheme } from '../hooks/useAppTheme';
import { usePrefsStore } from '../store/usePrefsStore';
import { scheduleTaskNotification, cancelTaskNotification, requestNotificationPermissions } from '../utils/notifications';
import { S, R, F } from '../constants/tokens';
import VoiceService from '../utils/voice';

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

export default function ActionCenter() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading, toggleSubtask } = useTaskStore();
  const { t, language } = useLanguageStore();
  const { show: showToast } = useToastStore();
  const { soundEffects } = usePrefsStore();
  const { setCurrentTask } = useFocusStore();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const navigation = useNavigation();
  const { action, highlightId, dateFilter } = useLocalSearchParams<{ action?: string; highlightId?: string; dateFilter?: string }>();
  const insets = useSafeAreaInsets();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const scrollViewRef = useRef<any>(null);

  // isSmallDevice / isShortDevice removed — design tokens used instead

  const [filter, setFilter] = useState<FilterType>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'creation'>('creation');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [nlpHint, setNlpHint] = useState('');
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
      onResults: (results: string[]) => {
        if (results.length > 0) {
          const text = results[0];
          // Use a special internal flag or just set the form directly to avoid trigger loop
          if (field === 'title') {
            const hint = parseTaskHint(text);
            const hasReminderWord = text.toLowerCase().includes('hatırlat') || text.toLowerCase().includes('remind');
            setForm(f => ({ 
                ...f, 
                title: text,
                dueDate: hint.dueDate || f.dueDate,
                dueTime: hint.dueTime || f.dueTime,
                priority: hint.priority || f.priority,
                reminderEnabled: hasReminderWord ? true : f.reminderEnabled
            }));
            if (hint.dueDate || hint.dueTime || hint.priority) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } else {
            setForm(f => ({ ...f, description: text }));
          }
        }
      },
      onError: (err: any) => {
        const msg = err.message || err;
        console.warn('Voice error:', msg);
        if (typeof msg === 'string' && msg.includes('not supported')) {
          Alert.alert(t.warningTitle || 'Uyarı', language === 'tr' ? 'Mikrofon özelliği bu ortamda (Expo Go) desteklenmiyor.' : 'Microphone feature is not supported in this environment (Expo Go).');
        }
        field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
      },
      onEnded: () => {
        field === 'title' ? setIsListeningTitle(false) : setIsListeningDesc(false);
      }
    });
  };
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

  // Mount/unmount only — voice cleanup must not run on every route-param change
  useEffect(() => {
    loadTasks();
    requestNotificationPermissions();
    return () => {
      VoiceService.destroy();
      Object.values(subtaskSaveTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Handle deep-link route params independently (no VoiceService side-effects)
  useEffect(() => {
    if (action === 'add') {
      setTimeout(() => openAdd(), 400);
    }
    if (highlightId) {
      const id = Number(highlightId);
      setHighlightedId(id);
      setExpandedId(id);
      setTimeout(() => setHighlightedId(null), 3000);
    }
  }, [action, highlightId]);

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
      setTasks(Array.isArray(data) ? data : []);
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

    const hint = parseTaskHint(text);
    const hasReminderWord = text.toLowerCase().includes('hatırlat') || text.toLowerCase().includes('remind');

    setForm(f => ({
        ...f,
        title: text,
        priority: hint.priority || f.priority,
        dueDate: hint.dueDate || f.dueDate,
        dueTime: hint.dueTime || f.dueTime,
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

    const isCompleting = !task.isCompleted;

    if (isCompleting) {
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

        try {
          await TaskService.updateTask(id, { ...task, priority: task.priority as any, isCompleted: true });
        } catch (error: any) {
          toggleTaskCompletion(id);
          setCompletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
          exitAnimMap.current.delete(id);
          const isNetwork = !error.response;
          showToast(isNetwork ? t.toastChangeReverted : t.toastUpdateFailed, 'error');
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

    try {
      await TaskService.updateTask(id, {
        ...task,
        priority: task.priority as any,
        isCompleted: isCompleting
      });
    } catch (error: any) {
      toggleTaskCompletion(id);
      const isNetwork = !error.response;
      showToast(isNetwork ? t.toastChangeReverted : t.toastUpdateFailed, 'error');
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

    const isTR = language === 'tr';
    const undoLabel = isTR ? 'Geri Al' : 'Undo';
    const deleteMsg = isTR ? `"${snapshot.title.slice(0, 28)}" silindi` : `"${snapshot.title.slice(0, 28)}" deleted`;

    // Cancel any existing pending delete for this task
    const existing = pendingDeleteRef.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      pendingDeleteRef.current.delete(id);
      try { await TaskService.deleteTask(id); }
      catch { loadTasks(); }
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

  const openAdd = () => {
    prepareTask();
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNlpHint('');
    setTitleError(false);
    setModalVisible(true);
  };

  const openEdit = (id: number) => {
    prepareTask();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
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
        
        // Past time check
        const target = new Date(form.dueDate || new Date());
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
        await TaskService.updateTask(editingId, payload);
        updateTask(editingId, { ...payload, id: editingId });
        
        if (form.reminderEnabled && !payload.isCompleted) {
            await scheduleTaskNotification(editingId, payload.title, payload.dueDate, payload.dueTime, language);
        } else {
            await cancelTaskNotification(editingId);
        }
      } else {
        const created = await TaskService.createTask(payload);
        addTask({ ...created, title: form.title.trim() });
        
        if (created.id && form.reminderEnabled) {
          await scheduleTaskNotification(created.id, payload.title, payload.dueDate, payload.dueTime, language);
        }
      }
      setModalVisible(false);
      setNewSubtaskText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      if (!err.response) {
        showToast(t.toastSaveFailed, 'error');
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
    if (p === 'High') return '#ff3b30';   // Signal Red
    if (p === 'Medium') return '#ff9f0a'; // Warning Orange
    return '#34c759';                    // Success Green
  };

  const getTagColor = getTagColorStatic;

  const filteredAndSortedTasks = useMemo(() => {
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
  }, [tasks, filter, tagFilter, searchQuery, sortBy, hideCompleted, completingIds]);

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
            try { await TaskService.deleteTask(id); removeTask(id); } catch {}
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
      try {
        await TaskService.updateTask(id, { isCompleted: true });
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
          for (const task of completedTasks) {
            try { await TaskService.deleteTask(task.id); removeTask(task.id); } catch {}
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }},
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          {isBulkMode ? (
            <>
              <TouchableOpacity onPress={() => { setIsBulkMode(false); setSelectedIds(new Set()); }} style={styles.backBtn}>
                <X size={22} color={theme.onSurface} />
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <Text style={[styles.headerTitle, { color: theme.onSurface }]}>
                  {language === 'tr' ? 'Seçim' : 'Select'}
                </Text>
                {selectedIds.size > 0 && (
                  <View style={[styles.selBadge, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: theme.onPrimary, fontSize: 11, fontWeight: '900' }}>{selectedIds.size}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  const allSelected = filteredTasks.every(task => selectedIds.has(task.id));
                  setSelectedIds(allSelected ? new Set() : new Set(filteredTasks.map(task => task.id)));
                  Haptics.selectionAsync();
                }}
                style={styles.headerIconBtn}
              >
                <CheckSquare size={20} color={filteredTasks.every(task => selectedIds.has(task.id)) ? theme.primary : theme.onSurface} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => navigation.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn}>
                <ArrowLeft size={24} color={theme.onSurface} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.onSurface }]}>{t.actionCenter}</Text>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                <TouchableOpacity onPress={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={styles.headerIconBtn}>
                  <Search size={20} color={showSearch ? theme.primary : theme.onSurface} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setHideCompleted(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[styles.headerIconBtn, hideCompleted && { backgroundColor: theme.primary + '18', borderRadius: 10 }]}
                  accessibilityLabel={hideCompleted ? (language === 'tr' ? 'Tamamlananları göster' : 'Show completed') : (language === 'tr' ? 'Tamamlananları gizle' : 'Hide completed')}
                >
                  <CheckCircle2 size={20} color={hideCompleted ? theme.primary : theme.onSurface} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowSortMenu(!showSortMenu); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={styles.headerIconBtn}>
                  <View>
                    <SlidersHorizontal size={20} color={(sortBy !== 'creation' || filter !== 'all' || !!tagFilter) ? theme.primary : theme.onSurface} />
                    {(sortBy !== 'creation' || filter !== 'all' || !!tagFilter) && (
                      <View style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary }} />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <MotiView
              from={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 52 }}
              exit={{ opacity: 0, height: 0 }}
              style={{ paddingHorizontal: S.lg, marginBottom: S.xs, overflow: 'hidden' }}
            >
              <View style={[styles.searchBar, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderColor: theme.outline }]}>
                <Search size={16} color={theme.onSurfaceVariant} />
                <TextInput
                  autoFocus
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t.searchPlaceholder}
                  placeholderTextColor={theme.onSurfaceVariant}
                  style={[styles.searchInput, { color: theme.onSurface }]}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={16} color={theme.onSurfaceVariant} />
                  </TouchableOpacity>
                )}
              </View>
            </MotiView>
          )}
        </AnimatePresence>

        {/* Sort Menu */}
        <AnimatePresence>
          {showSortMenu && (
            <MotiView
              from={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -8 }}
              style={[styles.sortMenu, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderColor: theme.outline }]}
            >
              {([['creation', t.sortByCreation], ['priority', t.sortByPriority], ['date', t.sortByDate]] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setSortBy(key); setShowSortMenu(false); Haptics.selectionAsync(); }}
                  style={[styles.sortOption, { borderBottomColor: theme.outline }]}
                >
                  <Text style={[{ color: sortBy === key ? theme.primary : theme.onSurface, fontSize: F.body, fontWeight: sortBy === key ? '700' : '400' }]}>
                    {label}
                  </Text>
                  {sortBy === key && <Check size={16} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </MotiView>
          )}
        </AnimatePresence>

        <ScrollView
            ref={scrollViewRef}
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
                <Text style={[styles.statSub, { color: theme.onSurfaceVariant, fontSize: F.caption }]}>{t.pendingTasks}</Text>
            </BentoCard>
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
                <TouchableOpacity 
                  key={f} 
                  onPress={() => { setFilter(f); Haptics.selectionAsync(); }}
                  style={[
                      styles.filterChip, 
                      { 
                          backgroundColor: filter === f ? (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)') : 'transparent',
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
                <Text
                    style={[styles.sectionTitle, { color: theme.onSurface, fontSize: F.subhead, flex: 1 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                >
                    {t.upcoming}
                </Text>
                <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); handleClearCompleted(); }}
                    style={{ padding: 4 }}
                >
                    <Trash2 size={16} color={theme.onSurfaceVariant + '80'} />
                </TouchableOpacity>
            </View>
            
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
                        <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>{searchQuery.trim() ? t.noResults : t.allTasksReady}</Text>
                        <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>{searchQuery.trim() ? (language === 'tr' ? `"${searchQuery}" için sonuç bulunamadı` : `No results for "${searchQuery}"`) : t.noTasksHint}</Text>
                    </MotiView>
                ) : (
                    visibleTasks.map((task, i) => {
                        const exitAnim = exitAnimMap.current.get(task.id);
                        return (
                        <RNAnimated.View
                            key={task.id}
                            style={exitAnim ? { opacity: exitAnim.opacity, transform: [{ translateY: exitAnim.translateY }] } : undefined}
                        >
                        <SwipeableItem
                            onDelete={() => handleDelete(task.id)}
                            disabled={isBulkMode}
                        >
                            <MotiView
                                from={{ opacity: 0, translateY: 10 }}
                                animate={{
                                    opacity: 1,
                                    translateY: 0,
                                    scale: task.isCompleted ? [1, 1.03, 1] : 1,
                                    borderColor: highlightedId === task.id ? theme.secondary : (isBulkMode && selectedIds.has(task.id) ? theme.primary : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)')),
                                    borderWidth: (highlightedId === task.id || (isBulkMode && selectedIds.has(task.id))) ? 2 : 1,
                                }}
                                transition={{
                                    type: 'spring',
                                    damping: 15,
                                    stiffness: 150,
                                    borderColor: { type: 'timing', duration: 200 },
                                    borderWidth: { type: 'timing', duration: 200 },
                                }}
                                style={[styles.taskCard, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, flexDirection: 'column', alignItems: 'stretch' }]}
                            >
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => {
                                      if (isBulkMode) {
                                        Haptics.selectionAsync();
                                        setSelectedIds(prev => {
                                          const next = new Set(prev);
                                          next.has(task.id) ? next.delete(task.id) : next.add(task.id);
                                          return next;
                                        });
                                      } else {
                                        handleToggleExpand(task.id);
                                      }
                                    }}
                                    onLongPress={() => {
                                      if (!isBulkMode) {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        setIsBulkMode(true);
                                        setSelectedIds(new Set([task.id]));
                                      }
                                    }}
                                    style={{ padding: S.md, flexDirection: 'column', alignItems: 'stretch' }}
                                >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {isBulkMode && (
                                      <View style={[{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selectedIds.has(task.id) ? theme.primary : theme.outline, backgroundColor: selectedIds.has(task.id) ? theme.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: S.sm }]}>
                                        {selectedIds.has(task.id) && <Check size={12} color={theme.onPrimary || '#fff'} />}
                                      </View>
                                    )}
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
                                            {(task.tags?.includes('hatırlatıcı') || task.tags?.includes('reminder')) && (
                                                <View style={[styles.categoryBadge, { backgroundColor: '#ff9f0a' + '20' }]}>
                                                    <Bell size={10} color="#ff9f0a" />
                                                </View>
                                            )}
                                            {(task.tags?.includes('etkinlik') || task.tags?.includes('event')) && (
                                                <View style={[styles.categoryBadge, { backgroundColor: theme.secondary + '20' }]}>
                                                    <Calendar size={10} color={theme.secondary} />
                                                </View>
                                            )}
                                            {(task.tags?.includes('not') || task.tags?.includes('note')) && (
                                                <View style={[styles.categoryBadge, { backgroundColor: '#4fc3f7' + '20' }]}>
                                                    <Tag size={10} color="#4fc3f7" />
                                                </View>
                                            )}
                                            {(() => {
                                                const ICON_TAGS = ['hatırlatıcı', 'reminder', 'etkinlik', 'event', 'not', 'note'];
                                                const textTags = (task.tags || []).filter(tag => !ICON_TAGS.includes(tag));
                                                const shown = textTags.slice(0, 2);
                                                const overflow = textTags.length - shown.length;
                                                return (
                                                    <>
                                                        {shown.map((tag, ti) => {
                                                            const tc = getTagColor(tag);
                                                            return (
                                                              <View key={ti} style={[styles.categoryBadge, { backgroundColor: tc + '25' }]}>
                                                                <Text style={[styles.categoryBadgeText, { color: tc, fontWeight: '900' }]}>
                                                                    #{tag.toUpperCase()}
                                                                </Text>
                                                              </View>
                                                            );
                                                        })}
                                                        {overflow > 0 && (
                                                            <View style={[styles.categoryBadge, { backgroundColor: theme.onSurfaceVariant + '20' }]}>
                                                                <Text style={[styles.categoryBadgeText, { color: theme.onSurfaceVariant }]}>+{overflow}</Text>
                                                            </View>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </View>
                                        <View style={styles.taskMetaRow}>
                                            <Text style={[styles.taskMetaText, { color: getDateColor(task.dueDate, theme), fontSize: F.caption }]}>
                                                {formatSmartDate(task.dueDate)}
                                            </Text>
                                            {!(task.tags?.includes('etkinlik') || task.tags?.includes('event') || task.tags?.includes('not') || task.tags?.includes('note')) && (
                                                <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, opacity: 0.6, marginLeft: 10, fontWeight: '600' }}>
                                                    ⏱️ {estimateDuration(task)}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    
                                    <View style={[styles.taskActions, { marginLeft: S.sm, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }]}>
                                        {!(task.tags?.includes('not') || task.tags?.includes('note')) && (
                                            <SubtaskProgressRing 
                                                total={(task.subtasks || []).length}
                                                completed={(task.subtasks || []).filter(s => s.done).length}
                                                size={44}
                                                strokeWidth={1.5}
                                                activeColor={theme.primary}
                                                inactiveColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                                            />
                                        )}
                                        <TouchableOpacity 
                                            onPress={() => handleToggle(task.id)} 
                                            style={[
                                                styles.checkIcon,
                                                {
                                                    width: 36,
                                                    height: 36,
                                                    backgroundColor: task.isCompleted ? theme.tertiary : (task.tags?.includes('not') || task.tags?.includes('note') ? '#4fc3f720' : theme.surfaceContainerHigh)
                                                }
                                            ]}
                                        >
                                            {task.tags?.includes('not') || task.tags?.includes('note') ? (
                                                <Tag size={18} color={task.isCompleted ? 'white' : '#4fc3f7'} strokeWidth={3} />
                                            ) : (
                                                <Check size={18} color={task.isCompleted ? 'white' : theme.onSurfaceVariant} strokeWidth={3} />
                                            )}
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
                                            style={{ overflow: 'hidden', marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)' }}
                                        >
                                            {task.description ? (
                                                <Text style={{ color: theme.onSurface, fontSize: F.body, lineHeight: 20, opacity: 0.8, marginBottom: S.sm }}>
                                                    {task.description}
                                                </Text>
                                            ) : (
                                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontStyle: 'italic', marginBottom: S.sm }}>
                                                    {t.noDescription}
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
                                                            {new Date(task.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Text>
                                                    </View>
                                                )}

                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                                                    <TrendingUp size={13} color={priorityColor(task.priority)} />
                                                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant }}>
                                                        {task.priority === 'High' ? t.priorityHigh :
                                                         task.priority === 'Medium' ? t.priorityMedium :
                                                         t.priorityLow}
                                                    </Text>
                                                </View>

                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                                                    <Timer size={13} color={theme.tertiary} />
                                                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.tertiary }}>
                                                        {estimateDuration(task)}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Action row: Edit + Focus */}
                                            <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                                                <TouchableOpacity
                                                    onPress={() => openEdit(task.id)}
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: 6, paddingHorizontal: S.md, borderRadius: R.full, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }}
                                                    accessibilityLabel={language === 'tr' ? 'Görevi düzenle' : 'Edit task'}
                                                >
                                                    <Pencil size={12} color={theme.onSurfaceVariant} />
                                                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant }}>
                                                        {language === 'tr' ? 'Düzenle' : 'Edit'}
                                                    </Text>
                                                </TouchableOpacity>
                                                {!task.isCompleted && (
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setCurrentTask(task.title);
                                                            const secs = 25 * 60;
                                                            useFocusStore.setState({ totalSeconds: secs, seconds: secs, isActive: true, lastActiveAt: Date.now() });
                                                            router.replace('/focus');
                                                        }}
                                                        style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: 6, paddingHorizontal: S.md, borderRadius: R.full, backgroundColor: theme.primary + '18' }}
                                                    >
                                                        <Sparkles size={12} color={theme.primary} />
                                                        <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.primary }}>
                                                            {language === 'tr' ? 'Odaklan' : 'Focus'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
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
                                                                }, 300);
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
                        </RNAnimated.View>
                        );
                    })
                )}
            </AnimatePresence>

            {remainingCount > 0 && (
              <TouchableOpacity
                onPress={() => { setVisibleCount(v => v + TASK_PAGE_SIZE); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={{ alignItems: 'center', paddingVertical: S.md, marginTop: S.sm }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '800', color: theme.primary, letterSpacing: 0.3 }}>
                    {language === 'tr' ? `${remainingCount} görev daha` : `${remainingCount} more`}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, opacity: 0.6 }}>▼</Text>
                </View>
              </TouchableOpacity>
            )}

            {filteredTasks.length > 0 && !isBulkMode && remainingCount === 0 && (
              <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, opacity: isDark ? 0.5 : 0.35, textAlign: 'center', marginTop: S.md, fontWeight: '600', letterSpacing: 0.3 }}>
                {t.swipeHint}
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Bulk Action Bar — floating pill */}
      <AnimatePresence>
        {isBulkMode && (
          <MotiView
            from={{ translateY: 80, opacity: 0, scale: 0.95 }}
            animate={{ translateY: 0, opacity: 1, scale: 1 }}
            exit={{ translateY: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            style={[
              styles.bulkPill,
              {
                bottom: 90 + insets.bottom,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
                shadowColor: isDark ? theme.primary : '#000',
              },
            ]}
          >
            <BlurView
              intensity={isDark ? 50 : 70}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />

            {/* Count */}
            <View style={styles.bulkCountRow}>
              <View style={[styles.bulkDot, { backgroundColor: selectedIds.size > 0 ? theme.primary : theme.onSurfaceVariant }]} />
              <Text style={[styles.bulkCountText, { color: theme.onSurface }]}>
                {selectedIds.size > 0
                  ? `${selectedIds.size} ${language === 'tr' ? 'seçildi' : 'selected'}`
                  : (language === 'tr' ? 'Seç' : 'Select')}
              </Text>
            </View>

            <View style={[styles.bulkSep, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }]} />

            {/* Edit — only active when exactly 1 selected */}
            <TouchableOpacity
              onPress={() => {
                if (selectedIds.size !== 1) {
                  showToast(language === 'tr' ? 'Düzenleme için tek görev seçin' : 'Select one task to edit', 'info');
                  return;
                }
                const id = Array.from(selectedIds)[0];
                setIsBulkMode(false);
                setSelectedIds(new Set());
                openEdit(id);
              }}
              style={[
                styles.bulkIconBtn,
                { backgroundColor: selectedIds.size === 1 ? theme.primary + '1A' : 'transparent' },
              ]}
            >
              <Pencil size={17} color={selectedIds.size === 1 ? theme.primary : theme.onSurfaceVariant + '55'} />
            </TouchableOpacity>

            {/* Complete */}
            <TouchableOpacity
              onPress={handleBulkComplete}
              disabled={selectedIds.size === 0}
              style={[
                styles.bulkIconBtn,
                { backgroundColor: selectedIds.size > 0 ? '#34C7591A' : 'transparent' },
              ]}
            >
              <CheckCircle2 size={17} color={selectedIds.size > 0 ? '#34C759' : theme.onSurfaceVariant + '55'} />
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0}
              style={[
                styles.bulkIconBtn,
                { backgroundColor: selectedIds.size > 0 ? '#FF3B301A' : 'transparent' },
              ]}
            >
              <Trash2 size={17} color={selectedIds.size > 0 ? '#FF3B30' : theme.onSurfaceVariant + '55'} />
            </TouchableOpacity>
          </MotiView>
        )}
      </AnimatePresence>

      {!isBulkMode && (
        <TouchableOpacity
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
        </TouchableOpacity>
      )}

      <BottomNavBar />

      {/* Modern Stitch Modal */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={() => !saving && setModalVisible(false)} onShow={() => taskSlideIn()}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !saving && setModalVisible(false)} />

          <View style={styles.sheetContainer}>
            <RNAnimated.View style={[styles.sheet, taskSlide, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', padding: S.lg, borderBottomLeftRadius: kbHeight > 0 ? S.xl : 0, borderBottomRightRadius: kbHeight > 0 ? S.xl : 0, maxHeight: height - insets.top - 16 }]}>
                <View {...taskPan.panHandlers} style={{ paddingTop: 14, paddingBottom: 18, alignItems: 'center' }}>
                  <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                </View>
                
                <View style={[styles.sheetHeader, { marginBottom: S.lg }]}>
                    <Text style={[styles.sheetTitle, { color: theme.onSurface, fontSize: F.title }]}>
                        {editingId ? t.editTask : t.addTask}
                    </Text>
                    <TouchableOpacity
                        onPress={() => !saving && setModalVisible(false)}
                        style={[styles.closeModalBtn, saving && { opacity: 0.35 }]}
                        disabled={saving}
                    >
                        <X size={20} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.formContainer}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: S.lg }}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets={true}
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
                                />
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                                    {nlpHint ? <Sparkles size={16} color={theme.primary} /> : null}
                                    <TouchableOpacity onPress={() => toggleVoice('title')} style={{ padding: S.xs, alignItems: 'center', justifyContent: 'center' }}>
                                        <VoiceWave active={isListeningTitle} theme={theme} />
                                        <Mic size={18} color={isListeningTitle ? theme.primary : theme.onSurfaceVariant} />
                                    </TouchableOpacity>
                                </View>
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
                                    placeholder={isListeningDesc ? t.listeningLabel : t.taskDescription + '...'}
                                    placeholderTextColor={theme.onSurfaceVariant + '99'}
                                    value={form.description}
                                    onChangeText={handleDescriptionChange}
                                    multiline
                                    numberOfLines={3}
                                    maxLength={500}
                                />
                                <TouchableOpacity onPress={() => toggleVoice('description')} style={{ position: 'absolute', right: S.md, top: 14, padding: S.xs, alignItems: 'center', justifyContent: 'center' }}>
                                    <VoiceWave active={isListeningDesc} theme={theme} />
                                    <Mic size={18} color={isListeningDesc ? theme.primary : theme.onSurfaceVariant} />
                                </TouchableOpacity>
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
                          <View style={[styles.inlinePicker, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
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
                          <View style={[styles.inlinePicker, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }]}>
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

                    {/* Reminder Toggle */}
                    <View style={styles.section}>
                        <TouchableOpacity
                            onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, reminderEnabled: !f.reminderEnabled })); }}
                            style={[styles.inputGroup, {
                                backgroundColor: form.reminderEnabled
                                    ? (isDark ? 'rgba(255,159,10,0.12)' : 'rgba(255,159,10,0.08)')
                                    : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow),
                                height: 52,
                            }]}
                        >
                            <Bell size={18} color={form.reminderEnabled ? '#ff9f0a' : theme.onSurfaceVariant} />
                            <Text style={{ flex: 1, fontSize: F.body, fontWeight: '700', color: form.reminderEnabled ? '#ff9f0a' : theme.onSurfaceVariant, marginLeft: S.sm }}>
                                {t.reminderLabel}
                            </Text>
                            <View style={{
                                width: 44, height: 26, borderRadius: 13,
                                backgroundColor: form.reminderEnabled ? '#ff9f0a' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
                                justifyContent: 'center', paddingHorizontal: 2,
                            }}>
                                <MotiView
                                    animate={{ translateX: form.reminderEnabled ? 18 : 0 }}
                                    transition={{ type: 'spring', damping: 15 }}
                                    style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'white' }}
                                />
                            </View>
                        </TouchableOpacity>
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
                                placeholderTextColor={theme.onSurfaceVariant + '99'}
                                value={newSubtaskText}
                                onChangeText={setNewSubtaskText}
                                returnKeyType="done"
                                maxLength={100}
                                onSubmitEditing={() => {
                                    if (newSubtaskText.trim() && form.subtasks.length < 15) {
                                        setForm(f => ({ ...f, subtasks: [...f.subtasks, { text: newSubtaskText.trim(), done: false }] }));
                                        setNewSubtaskText('');
                                    }
                                }}
                            />
                            <TouchableOpacity
                                onPress={() => {
                                    if (newSubtaskText.trim() && form.subtasks.length < 15) {
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

                </ScrollView>

                {/* Sticky save — always visible outside the scroll area */}
                <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.modalSaveBtn, { marginTop: S.sm, marginBottom: 0 }]}>
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
            </RNAnimated.View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.lg, paddingVertical: S.sm },
  backBtn: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '900', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  headerIconBtn: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  selBadge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  aiBtn: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: R.lg, borderWidth: 1, paddingHorizontal: S.md, gap: S.sm, height: 44 },
  searchInput: { flex: 1, fontWeight: '600', fontSize: F.body },
  sortMenu: { position: 'absolute', top: 56, right: S.lg, zIndex: 200, borderRadius: R.lg, borderWidth: 1, overflow: 'hidden', minWidth: 180, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  sortOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingVertical: S.md, borderBottomWidth: StyleSheet.hairlineWidth },
  bulkPill: {
    position: 'absolute', left: S.xl, right: S.xl,
    flexDirection: 'row', alignItems: 'center',
    borderRadius: R.full, overflow: 'hidden',
    paddingHorizontal: S.lg, paddingVertical: 10,
    borderWidth: 1, zIndex: 100,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 14,
  },
  bulkCountRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  bulkDot: { width: 7, height: 7, borderRadius: 4 },
  bulkCountText: { fontSize: F.body, fontWeight: '800' },
  bulkSep: { width: 1, height: 22, marginHorizontal: S.sm },
  bulkIconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
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
  inlinePicker: { borderRadius: R.lg, padding: S.md, alignItems: 'center', borderWidth: 1 },
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

