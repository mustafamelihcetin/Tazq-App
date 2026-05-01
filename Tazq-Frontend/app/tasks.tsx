import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { Check, Timer, Plus, X, Pencil, Sparkles, TrendingUp, Bell } from 'lucide-react-native';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { TaskService } from '../services/api';
import { parseTaskHint } from '../utils/taskParser';
import { useAppTheme } from '../hooks/useAppTheme';

type Priority = 'Low' | 'Medium' | 'High';
type FilterType = 'all' | 'High' | 'Medium' | 'Low' | 'done';

interface TaskForm {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
}

const EMPTY_FORM: TaskForm = { title: '', description: '', priority: 'Medium', dueDate: '' };

export default function ActionCenter() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading } = useTaskStore();
  const { t } = useLanguageStore();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isSmallDevice = width < 380;
  const isShortDevice = height < 750;

  const [filter, setFilter] = useState<FilterType>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nlpHint, setNlpHint] = useState('');

  useEffect(() => { loadTasks(); }, []);

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

  const handleTitleChange = (text: string) => {
    setForm((f) => ({ ...f, title: text }));
    setTitleError(false);
    const hint = parseTaskHint(text);
    const parts: string[] = [];
    if (hint.priority) {
      setForm((f) => ({ ...f, priority: hint.priority! }));
      parts.push(hint.priority === 'High' ? '🔴 High' : hint.priority === 'Medium' ? '🟡 Medium' : '🟢 Low');
    }
    if (hint.dueDate) {
      setForm((f) => ({ ...f, dueDate: hint.dueDate! }));
      parts.push(`📅 ${hint.dueDate}`);
    }
    setNlpHint(parts.join('  '));
  };

  const handleToggle = async (id: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    toggleTaskCompletion(id);
    try {
      await TaskService.updateTask(id, {
        title: task.title, description: task.description,
        isCompleted: !task.isCompleted, priority: task.priority as Priority,
        tags: task.tags, dueDate: task.dueDate, dueTime: task.dueTime,
      });
    } catch {
      toggleTaskCompletion(id);
    }
  };

  const handleDelete = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(t.deleteTask, t.confirmDelete, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive', onPress: async () => {
          removeTask(id);
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
    setForm({ title: task.title, description: task.description, priority: task.priority as Priority, dueDate: task.dueDate?.split('T')[0] ?? '' });
    setNlpHint('');
    setTitleError(false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setTitleError(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setSaving(true);
    const existingTask = editingId !== null ? tasks.find(t => t.id === editingId) : null;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      isCompleted: existingTask ? existingTask.isCompleted : false,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      tags: existingTask ? existingTask.tags : [],
    };
    try {
      if (editingId !== null) {
        await TaskService.updateTask(editingId, payload);
        updateTask(editingId, payload);
      } else {
        const created = await TaskService.createTask(payload);
        addTask(created);
      }
      setModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const priorityColor = (p: string) => {
    if (p === 'High') return theme.error;
    if (p === 'Medium') return theme.secondary;
    return theme.tertiary;
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'done') return task.isCompleted;
    if (filter === 'all') return true;
    return task.priority === filter && !task.isCompleted;
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'High', label: t.filterHigh },
    { key: 'Medium', label: t.filterMedium },
    { key: 'Low', label: t.filterLow },
    { key: 'done', label: t.filterDone },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <MotiView from={{ opacity: 0, translateY: -10 }} animate={{ opacity: 1, translateY: 0 }} style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.surfaceContainerLow }]}>
                <X size={20} color={theme.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 14 : 16 }]}>{t.actionCenter}</Text>
            <TouchableOpacity style={[styles.aiBtn, { backgroundColor: theme.tertiary + '15' }]}>
                <Sparkles size={18} color={theme.tertiary} fill={theme.tertiary} />
            </TouchableOpacity>
        </MotiView>

        <ScrollView 
            style={{ flex: 1 }} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 140, paddingHorizontal: isSmallDevice ? 20 : 24 }}
        >
          <MotiView from={{ opacity: 0, translateX: -20 }} animate={{ opacity: 1, translateX: 0 }} style={{ marginBottom: isSmallDevice ? 16 : 24 }}>
            <Text style={[styles.headline, { color: theme.onSurface, fontSize: isSmallDevice ? 28 : 36, lineHeight: isSmallDevice ? 34 : 42 }]}>{t.actionCenter}</Text>
            <Text style={[styles.subHeadline, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 13 : 14 }]}>{t.allTasksReady}</Text>
          </MotiView>

          {/* Stats Bento Section */}
          <View style={[styles.statsGrid, { gap: isSmallDevice ? 12 : 16, marginBottom: isSmallDevice ? 20 : 24 }]}>
            <BentoCard index={0} style={{ flex: 1.4, padding: isSmallDevice ? 16 : 20 }}>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.completed}</Text>
                <View style={styles.statValueRow}>
                    <Text style={[styles.statValue, { color: theme.onSurface, fontSize: isSmallDevice ? 24 : 32 }]}>{tasks.filter(t => t.isCompleted).length}</Text>
                    <View style={[styles.trendBadge, { backgroundColor: theme.tertiary + '15' }]}>
                        <TrendingUp size={12} color={theme.tertiary} />
                    </View>
                </View>
                <Text style={[styles.statSub, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 9 : 10 }]}>{t.completedTasks}</Text>
            </BentoCard>

            <BentoCard index={1} style={{ flex: 1, padding: isSmallDevice ? 16 : 20 }}>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.pending}</Text>
                <Text style={[styles.statValue, { color: theme.primary, fontSize: isSmallDevice ? 24 : 32 }]}>{tasks.filter(t => !t.isCompleted).length}</Text>
                <Text style={[styles.statSub, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 9 : 10 }]}>{t.streak}</Text>
            </BentoCard>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: isSmallDevice ? 8 : 10 }}>
            {filters.map((f) => (
              <TouchableOpacity 
                key={f.key} 
                onPress={() => { setFilter(f.key); Haptics.selectionAsync(); }}
                style={[
                    styles.filterChip, 
                    { backgroundColor: filter === f.key ? theme.primary : theme.surfaceContainerLow, paddingVertical: isSmallDevice ? 8 : 10, paddingHorizontal: isSmallDevice ? 16 : 20 }
                ]}
              >
                <Text style={[styles.filterChipText, { color: filter === f.key ? 'white' : theme.onSurfaceVariant, fontSize: isSmallDevice ? 12 : 13 }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Task List */}
          <View style={styles.listSection}>
            <Text 
                style={[styles.sectionTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 16 : 18, flex: 1 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
            >
                {t.upcoming}
            </Text>
            
            <AnimatePresence>
                {filteredTasks.length === 0 ? (
                    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: theme.onSurfaceVariant }]}>{t.noTasksHint}</Text>
                    </MotiView>
                ) : (
                    filteredTasks.map((task, i) => (
                        <MotiView 
                            key={task.id} 
                            from={{ opacity: 0, translateY: 10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ delay: i * 50 }}
                            style={{ marginBottom: 12 }}
                        >
                            <TouchableOpacity 
                                activeOpacity={0.8} 
                                onPress={() => handleToggle(task.id)}
                                onLongPress={() => handleDelete(task.id)}
                                style={[
                                    styles.taskCard, 
                                    { 
                                        backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest,
                                        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                        padding: isSmallDevice ? 14 : 16
                                    }
                                ]}
                            >
                                <View style={[styles.priorityIndicator, { backgroundColor: priorityColor(task.priority), width: isSmallDevice ? 3 : 4 }]} />
                                <View style={styles.taskContent}>
                                    <Text style={[
                                        styles.taskTitleText, 
                                        { color: theme.onSurface, fontSize: isSmallDevice ? 14 : 15 },
                                        task.isCompleted && { textDecorationLine: 'line-through', opacity: 0.4 }
                                    ]} numberOfLines={1}>
                                        {task.title}
                                    </Text>
                                    <View style={styles.taskMetaRow}>
                                        <Text style={[styles.taskMetaText, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 10 : 11 }]}>
                                            {task.dueDate ? `📅 ${task.dueDate.split('T')[0]}` : t.waitingForAction}
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={[styles.taskActions, { gap: isSmallDevice ? 8 : 12 }]}>
                                    {!task.isCompleted && (
                                        <TouchableOpacity onPress={() => openEdit(task.id)} style={[styles.editBtn, { width: isSmallDevice ? 28 : 32, height: isSmallDevice ? 28 : 32 }]}>
                                            <Pencil size={isSmallDevice ? 12 : 14} color={theme.onSurfaceVariant} />
                                        </TouchableOpacity>
                                    )}
                                    <MotiView 
                                        animate={{ backgroundColor: task.isCompleted ? theme.tertiary : theme.surfaceContainerHigh }}
                                        style={[styles.checkIcon, { width: isSmallDevice ? 28 : 32, height: isSmallDevice ? 28 : 32 }]}
                                    >
                                        <Check size={isSmallDevice ? 12 : 14} color={task.isCompleted ? 'white' : theme.onSurfaceVariant} strokeWidth={3} />
                                    </MotiView>
                                </View>
                            </TouchableOpacity>
                        </MotiView>
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
                width: isSmallDevice ? 56 : 64,
                height: isSmallDevice ? 56 : 64,
                borderRadius: isSmallDevice ? 28 : 32,
                bottom: isShortDevice ? 100 : 120,
                right: isSmallDevice ? 20 : 24
            }
        ]}
      >
        <Plus size={isSmallDevice ? 28 : 32} color="white" />
      </TouchableOpacity>

      <BottomNavBar />

      {/* Modern Stitch Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !saving && setModalVisible(false)} />
          
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetContainer}>
            <MotiView 
                from={{ translateY: 300 }}
                animate={{ translateY: 0 }}
                style={[styles.sheet, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', padding: isSmallDevice ? 20 : 24 }]}
            >
                <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                
                <View style={[styles.sheetHeader, { marginBottom: isSmallDevice ? 16 : 24 }]}>
                    <Text style={[styles.sheetTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 20 : 24 }]}>
                        {editingId ? t.editTask : t.addTask}
                    </Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                        <X size={20} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isShortDevice ? 10 : 20 }}>
                    <View style={styles.section}>
                        <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: isSmallDevice ? 52 : 60 }]}>
                            <TextInput 
                                style={[styles.modalInput, { color: theme.onSurface, fontSize: isSmallDevice ? 14 : 16 }]}
                                placeholder={t.taskTitle}
                                placeholderTextColor={theme.onSurfaceVariant + '60'}
                                value={form.title}
                                onChangeText={handleTitleChange}
                            />
                            <Sparkles size={16} color={theme.primary} />
                        </View>

                        <View style={[styles.inputGroup, styles.modalTextArea, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, marginTop: 12, height: isSmallDevice ? 80 : 100 }]}>
                            <TextInput 
                                style={[styles.modalInput, { color: theme.onSurface, paddingTop: 12, fontSize: isSmallDevice ? 14 : 16 }]}
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
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.duration.toUpperCase()}</Text>
                        <View style={styles.dateTimeRow}>
                            <TouchableOpacity style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: isSmallDevice ? 48 : 52 }]}>
                                <Timer size={14} color={theme.primary} />
                                <TextInput 
                                    placeholder="Tarih"
                                    placeholderTextColor={theme.onSurfaceVariant + '60'}
                                    style={[styles.chipInput, { color: theme.onSurface, fontSize: 12 }]}
                                    value={form.dueDate}
                                    onChangeText={v => setForm(f => ({ ...f, dueDate: v }))}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, height: isSmallDevice ? 48 : 52 }]}>
                                <Sparkles size={14} color={theme.secondary} />
                                <TextInput placeholder="Saat" placeholderTextColor={theme.onSurfaceVariant + '60'} style={[styles.chipInput, { color: theme.onSurface, fontSize: 12 }]} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant, fontSize: 10 }]}>{t.priority.toUpperCase()}</Text>
                        <View style={[styles.priorityRow, { gap: isSmallDevice ? 8 : 10 }]}>
                            {([
                                { key: 'Low', label: t.filterLow },
                                { key: 'Medium', label: t.filterMedium },
                                { key: 'High', label: t.filterHigh }
                            ] as { key: Priority, label: string }[]).map((p) => (
                                <TouchableOpacity 
                                    key={p.key}
                                    onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, priority: p.key })); }}
                                    style={[styles.priorityTab, { backgroundColor: form.priority === p.key ? priorityColor(p.key) : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow), height: isSmallDevice ? 40 : 48 }]}
                                >
                                    <Text style={[styles.priorityTabText, { color: form.priority === p.key ? 'white' : theme.onSurfaceVariant, fontSize: isSmallDevice ? 11 : 13 }]}>{p.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.modalSaveBtn}>
                        <LinearGradient colors={isDark ? [theme.primary, '#3367ff'] : [theme.primary, theme.primaryContainer]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.modalSaveGradient, { paddingVertical: isSmallDevice ? 14 : 18 }]}>
                            {saving ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Check size={isSmallDevice ? 18 : 20} color="white" strokeWidth={3} />
                                    <Text style={[styles.modalSaveText, { fontSize: isSmallDevice ? 15 : 17 }]}>{t.save}</Text>
                                </>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '900', letterSpacing: -0.5 },
  aiBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headline: { fontWeight: '900', letterSpacing: -1.5 },
  subHeadline: { fontWeight: '600', opacity: 0.7, marginTop: 4 },
  statsGrid: { flexDirection: 'row' },
  statLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  statValue: { fontWeight: '900', letterSpacing: -1 },
  trendBadge: { padding: 4, borderRadius: 8 },
  statSub: { fontWeight: '700' },
  filterScroll: { marginBottom: 24 },
  filterChip: { borderRadius: 100 },
  filterChipText: { fontWeight: '800' },
  listSection: { flex: 1 },
  sectionTitle: { fontWeight: '900', marginBottom: 16 },
  taskCard: { borderRadius: 24, flexDirection: 'row', alignItems: 'center', borderWidth: 1.2 },
  priorityIndicator: { height: 32, borderRadius: 2, marginRight: 16 },
  taskContent: { flex: 1 },
  taskTitleText: { fontWeight: '700' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  taskMetaText: { fontWeight: '600' },
  taskActions: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 100 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { width: '100%' },
  sheet: { borderTopLeftRadius: 40, borderTopRightRadius: 40, borderWidth: 1, borderBottomWidth: 0 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontWeight: '900', letterSpacing: -0.5 },
  closeModalBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  formContainer: { paddingHorizontal: 10 },
  section: { marginBottom: 16 },
  inputGroup: { borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  modalInput: { flex: 1, fontWeight: '600' },
  modalTextArea: { alignItems: 'flex-start' },
  dateTimeRow: { flexDirection: 'row', gap: 12 },
  dateTimeChip: { flex: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  chipInput: { flex: 1, fontWeight: '700' },
  optionLabel: { fontWeight: '900', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4, opacity: 0.6 },
  priorityRow: { flexDirection: 'row' },
  priorityTab: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  priorityTabText: { fontWeight: '800' },
  modalSaveBtn: { borderRadius: 24, overflow: 'hidden', marginTop: 10 },
  modalSaveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  modalSaveText: { color: 'white', fontWeight: '900', letterSpacing: -0.5 },
});
