import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, useColorScheme, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { Check, Timer, Plus, X, Pencil, Sparkles, TrendingUp, Bell } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { TaskService, AiService } from '../services/api';
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
  const { user } = useAuthStore();
  const { tasks, toggleTaskCompletion, addTask, removeTask, updateTask, setTasks, setLoading, isLoading } = useTaskStore();
  const { t } = useLanguageStore();
  const { setCurrentTask } = useFocusStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<FilterType>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nlpHint, setNlpHint] = useState('');
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);

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
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      isCompleted: false,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      tags: [], // Added missing tags property
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
            <Text style={[styles.headerTitle, { color: theme.onSurface }]}>{t.actionCenter}</Text>
            <TouchableOpacity onPress={() => setAiModalVisible(true)} style={[styles.aiBtn, { backgroundColor: theme.tertiary + '15' }]}>
                <Sparkles size={18} color={theme.tertiary} fill={theme.tertiary} />
            </TouchableOpacity>
        </MotiView>

        <ScrollView 
            style={{ flex: 1 }} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 140, paddingHorizontal: 24 }}
        >
          <MotiView from={{ opacity: 0, translateX: -20 }} animate={{ opacity: 1, translateX: 0 }} style={{ marginBottom: 24 }}>
            <Text style={[styles.headline, { color: theme.onSurface }]}>{t.actionCenter}</Text>
            <Text style={[styles.subHeadline, { color: theme.onSurfaceVariant }]}>{t.allTasksReady}</Text>
          </MotiView>

          {/* Stats Bento Section */}
          <View style={styles.statsGrid}>
            <BentoCard index={0} style={{ flex: 1.4 }}>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>COMPLETED</Text>
                <View style={styles.statValueRow}>
                    <Text style={[styles.statValue, { color: theme.onSurface }]}>{tasks.filter(t => t.isCompleted).length}</Text>
                    <View style={[styles.trendBadge, { backgroundColor: theme.tertiary + '15' }]}>
                        <TrendingUp size={12} color={theme.tertiary} />
                    </View>
                </View>
                <Text style={[styles.statSub, { color: theme.onSurfaceVariant }]}>{t.completedTasks}</Text>
            </BentoCard>

            <BentoCard index={1} style={{ flex: 1 }}>
                <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>PENDING</Text>
                <Text style={[styles.statValue, { color: theme.primary }]}>{tasks.filter(t => !t.isCompleted).length}</Text>
                <Text style={[styles.statSub, { color: theme.onSurfaceVariant }]}>{t.activeStreak}</Text>
            </BentoCard>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 10 }}>
            {filters.map((f) => (
              <TouchableOpacity 
                key={f.key} 
                onPress={() => { setFilter(f.key); Haptics.selectionAsync(); }}
                style={[
                    styles.filterChip, 
                    { backgroundColor: filter === f.key ? theme.primary : theme.surfaceContainerLow }
                ]}
              >
                <Text style={[styles.filterChipText, { color: filter === f.key ? 'white' : theme.onSurfaceVariant }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Task List */}
          <View style={styles.listSection}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>{t.upcoming}</Text>
            
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
                                    }
                                ]}
                            >
                                <View style={[styles.priorityIndicator, { backgroundColor: priorityColor(task.priority) }]} />
                                <View style={styles.taskContent}>
                                    <Text style={[
                                        styles.taskTitleText, 
                                        { color: theme.onSurface },
                                        task.isCompleted && { textDecorationLine: 'line-through', opacity: 0.4 }
                                    ]} numberOfLines={1}>
                                        {task.title}
                                    </Text>
                                    <View style={styles.taskMetaRow}>
                                        <Text style={[styles.taskMetaText, { color: theme.onSurfaceVariant }]}>
                                            {task.dueDate ? `📅 ${task.dueDate.split('T')[0]}` : t.waitingForAction}
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={styles.taskActions}>
                                    {!task.isCompleted && (
                                        <TouchableOpacity onPress={() => openEdit(task.id)} style={styles.editBtn}>
                                            <Pencil size={14} color={theme.onSurfaceVariant} />
                                        </TouchableOpacity>
                                    )}
                                    <MotiView 
                                        animate={{ 
                                            backgroundColor: task.isCompleted ? theme.tertiary : theme.surfaceContainerHigh 
                                        }}
                                        style={styles.checkIcon}
                                    >
                                        <Check size={14} color={task.isCompleted ? 'white' : theme.onSurfaceVariant} strokeWidth={3} />
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
            { backgroundColor: theme.primary, shadowColor: isDark ? theme.primary : '#000' }
        ]}
      >
        <Plus size={32} color="white" />
      </TouchableOpacity>

      <BottomNavBar />

      {/* Modern Stitch Modal - Deep Focus Edition */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !saving && setModalVisible(false)} />
          
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.sheetContainer}
          >
            <MotiView 
                from={{ translateY: 300 }}
                animate={{ translateY: 0 }}
                style={[styles.sheet, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
            >
                <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                
                <View style={styles.sheetHeader}>
                    <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
                        {editingId ? t.editTask : t.addTask}
                    </Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                        <X size={24} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    {/* Main Info */}
                    <View style={styles.section}>
                        <View style={[styles.inputGroup, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                            <TextInput 
                                style={[styles.modalInput, { color: theme.onSurface }]}
                                placeholder={t.taskTitle}
                                placeholderTextColor={theme.onSurfaceVariant + '60'}
                                value={form.title}
                                onChangeText={handleTitleChange}
                            />
                            <Sparkles size={18} color={theme.primary} />
                        </View>

                        <View style={[styles.inputGroup, styles.modalTextArea, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, marginTop: 12 }]}>
                            <TextInput 
                                style={[styles.modalInput, { color: theme.onSurface, paddingTop: 14 }]}
                                placeholder={t.taskDescription + '...'}
                                placeholderTextColor={theme.onSurfaceVariant + '60'}
                                value={form.description}
                                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                                multiline
                                numberOfLines={3}
                            />
                        </View>
                    </View>

                    {/* Date & Time Section */}
                    <View style={styles.section}>
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant }]}>{t.duration.toUpperCase()}</Text>
                        <View style={styles.dateTimeRow}>
                            <TouchableOpacity style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                                <Timer size={16} color={theme.primary} />
                                <TextInput 
                                    placeholder="Tarih"
                                    placeholderTextColor={theme.onSurfaceVariant + '60'}
                                    style={[styles.chipInput, { color: theme.onSurface }]}
                                    value={form.dueDate}
                                    onChangeText={v => setForm(f => ({ ...f, dueDate: v }))}
                                />
                            </TouchableOpacity>
                            
                            <TouchableOpacity style={[styles.dateTimeChip, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                                <Sparkles size={16} color={theme.secondary} />
                                <TextInput 
                                    placeholder="Saat"
                                    placeholderTextColor={theme.onSurfaceVariant + '60'}
                                    style={[styles.chipInput, { color: theme.onSurface }]}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Priority Selection */}
                    <View style={styles.section}>
                        <Text style={[styles.optionLabel, { color: theme.onSurfaceVariant }]}>{t.priority.toUpperCase()}</Text>
                        <View style={styles.priorityRow}>
                            {([
                                { key: 'Low', label: t.filterLow },
                                { key: 'Medium', label: t.filterMedium },
                                { key: 'High', label: t.filterHigh }
                            ] as { key: Priority, label: string }[]).map((p) => (
                                <TouchableOpacity 
                                    key={p.key}
                                    onPress={() => { Haptics.selectionAsync(); setForm(f => ({ ...f, priority: p.key })); }}
                                    style={[
                                        styles.priorityTab,
                                        { 
                                            backgroundColor: form.priority === p.key ? priorityColor(p.key) : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow),
                                        }
                                    ]}
                                >
                                    <Text style={[styles.priorityTabText, { color: form.priority === p.key ? 'white' : theme.onSurfaceVariant }]}>{p.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Reminder Bar */}
                    <View style={[styles.reminderBar, { backgroundColor: isDark ? theme.surfaceContainerHigh + '50' : theme.surfaceContainerLow }]}>
                        <View style={styles.reminderContent}>
                            <Bell size={18} color={theme.primary} />
                            <Text style={[styles.reminderText, { color: theme.onSurface }]}>Hatırlatıcı</Text>
                        </View>
                        <View style={[styles.toggleTrack, { backgroundColor: theme.primary }]}>
                            <View style={styles.toggleThumb} />
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={handleSave} 
                        disabled={saving}
                        style={[styles.modalSaveBtn, { shadowColor: theme.primary }]}
                    >
                        <LinearGradient
                            colors={isDark ? [theme.primary, '#3367ff'] : [theme.primary, theme.primaryContainer]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.modalSaveGradient}
                        >
                            {saving ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Check size={20} color="white" strokeWidth={3} />
                                    <Text style={styles.modalSaveText}>{t.save}</Text>
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
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  aiBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headline: { fontSize: 36, fontWeight: '900', letterSpacing: -1.5 },
  subHeadline: { fontSize: 14, fontWeight: '600', opacity: 0.7, marginTop: 4 },
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  statValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  trendBadge: { padding: 4, borderRadius: 8 },
  statSub: { fontSize: 10, fontWeight: '700' },
  filterScroll: { marginBottom: 24 },
  filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100 },
  filterChipText: { fontSize: 13, fontWeight: '800' },
  listSection: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 16 },
  taskCard: { borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.2 },
  priorityIndicator: { width: 4, height: 32, borderRadius: 2, marginRight: 16 },
  taskContent: { flex: 1 },
  taskTitleText: { fontSize: 15, fontWeight: '700' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  taskMetaText: { fontSize: 11, fontWeight: '600' },
  taskActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', bottom: 120, right: 24, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 10, zIndex: 100 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: { width: '100%' },
  sheet: { borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderWidth: 1, borderBottomWidth: 0 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  closeModalBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  formContainer: { paddingHorizontal: 24, paddingTop: 10 },
  section: { marginBottom: 20 },
  inputGroup: { borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60 },
  modalInput: { flex: 1, fontSize: 16, fontWeight: '600' },
  modalTextArea: { height: 100, alignItems: 'flex-start' },
  dateTimeRow: { flexDirection: 'row', gap: 12 },
  dateTimeChip: { flex: 1, height: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  chipInput: { flex: 1, fontSize: 13, fontWeight: '700' },
  optionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4, opacity: 0.6 },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityTab: { flex: 1, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  priorityTabText: { fontSize: 13, fontWeight: '800' },
  reminderBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  reminderContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderText: { fontSize: 14, fontWeight: '800' },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, padding: 2, alignItems: 'flex-end' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 },
  modalSaveBtn: { borderRadius: 24, overflow: 'hidden', marginTop: 10, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  modalSaveGradient: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  modalSaveText: { color: 'white', fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
});
