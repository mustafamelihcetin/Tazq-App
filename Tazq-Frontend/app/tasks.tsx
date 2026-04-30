import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { Check, Timer, Trash2, Plus, X } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { BentoCard } from '../components/BentoCard';
import { BottomNavBar } from '../components/BottomNavBar';
import { useTaskStore } from '../store/useTaskStore';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useFocusStore } from '../store/useFocusStore';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { TaskService } from '../services/api';

type Priority = 'Low' | 'Medium' | 'High';

export default function ActionCenter() {
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { user } = useAuthStore();
  const { tasks, toggleTaskCompletion, addTask, removeTask, setTasks, setLoading, isLoading } = useTaskStore();
  const { t } = useLanguageStore();
  const { setCurrentTask } = useFocusStore();
  const router = useRouter();

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('loadTasks error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    // Optimistic update
    toggleTaskCompletion(id);
    try {
      await TaskService.updateTask(id, {
        title: task.title,
        description: task.description,
        isCompleted: !task.isCompleted,
        priority: task.priority as Priority,
        tags: task.tags,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
      });
    } catch (e) {
      // Revert on failure
      toggleTaskCompletion(id);
      console.error('toggle error:', e);
    }
  };

  const handleDelete = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(t.deleteTask, t.confirmDelete, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive', onPress: async () => {
          removeTask(id);
          try {
            await TaskService.deleteTask(id);
          } catch (e) {
            console.error('delete error:', e);
            loadTasks(); // re-sync on failure
          }
        }
      },
    ]);
  };

  const handleStartTimer = (taskName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCurrentTask(taskName);
    router.push('/focus');
  };

  const openModal = () => {
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setTitleError(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setTitleError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    try {
      const created = await TaskService.createTask({
        title: title.trim(),
        description: description.trim(),
        isCompleted: false,
        priority,
        tags: [],
      });
      addTask(created);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal();
    } catch (e) {
      console.error('createTask error:', e);
      Alert.alert('Hata', 'Görev oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  };

  const priorityColor = (p: string) => {
    if (p === 'High') return theme.error;
    if (p === 'Medium') return theme.secondary;
    return theme.tertiary;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={styles.headerContainer}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.avatarContainer, { borderColor: theme.primary + '20' }]}>
              <Image
                key={user?.id || 'tasks'}
                source={{ 
                    uri: user?.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${user?.name || 'Tazq'}` 
                }}
                style={styles.avatar}
              />
            </View>
            <Text style={[styles.logoText, { color: theme.onSurface }]}>TAZQ</Text>
          </View>
          <TouchableOpacity
            onPress={openModal}
            style={[styles.plusBtn, { backgroundColor: theme.primary }]}
          >
            <Plus size={22} color="white" />
          </TouchableOpacity>
        </MotiView>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 160, paddingHorizontal: 24 }}
        >
          {/* Headline */}
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            style={{ marginBottom: 32 }}
          >
            <Text style={[styles.headlineTitle, { color: theme.primary }]}>{t.actionCenter}</Text>
            <MotiText
              key={tasks.length}
              from={{ opacity: 0, translateY: 5 }}
              animate={{ opacity: 1, translateY: 0 }}
              style={[styles.headlineSub, { color: theme.onSurfaceVariant }]}
            >
              {tasks.length > 0
                ? t.allTasksReady.replace('{count}', tasks.length.toString())
                : t.allTasksReady}
            </MotiText>
          </MotiView>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 40 }}>
            <BentoCard style={{ flex: 2 }} index={1}>
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <View>
                  <Text style={[styles.statCategory, { color: theme.primary }]}>{t.activeStreak}</Text>
                  <Text style={[styles.statName, { color: theme.onSurface }]} numberOfLines={1}>
                    {tasks.find((t) => !t.isCompleted)?.title || '—'}
                  </Text>
                </View>
                {tasks.find((t) => !t.isCompleted) && (
                  <TouchableOpacity
                    onPress={() => handleStartTimer(tasks.find((t) => !t.isCompleted)!.title)}
                    style={[styles.timerBtn, { backgroundColor: theme.primary }]}
                  >
                    <Text style={styles.timerBtnText}>{t.startTimer}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </BentoCard>

            <BentoCard style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} index={2} glass>
              <View style={[styles.checkCircle, { backgroundColor: theme.tertiary + '15' }]}>
                <Check size={24} color={theme.tertiary} />
              </View>
              <MotiText
                key={tasks.filter((t) => t.isCompleted).length}
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={[styles.statValue, { color: theme.onSurface }]}
              >
                {tasks.filter((t) => t.isCompleted).length}
              </MotiText>
              <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>{t.completedTasks}</Text>
            </BentoCard>
          </View>

          {/* Task List */}
          <View>
            <Text style={[styles.listTitle, { color: theme.onSurface }]}>{t.upcoming}</Text>

            {tasks.length === 0 && !isLoading && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={[styles.emptyState, { backgroundColor: theme.surfaceContainerLow }]}
              >
                <Text style={[styles.emptyTitle, { color: theme.onSurface }]}>{t.noTasks}</Text>
                <Text style={[styles.emptyHint, { color: theme.onSurfaceVariant }]}>{t.noTasksHint}</Text>
              </MotiView>
            )}

            <AnimatePresence>
              {tasks.map((task, i) => (
                <MotiView
                  key={task.id}
                  from={{ opacity: 0, scale: 0.9, translateY: 10 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 50, type: 'spring', damping: 15 }}
                  style={{ marginBottom: 16 }}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handleToggle(task.id)}
                    onLongPress={() => handleDelete(task.id)}
                    style={[
                      styles.taskItem,
                      {
                        backgroundColor: theme.surfaceContainerLow,
                        borderColor: task.isCompleted ? theme.primary + '20' : theme.outlineVariant + '15',
                      },
                    ]}
                  >
                    <View style={[styles.priorityIndicator, { backgroundColor: priorityColor(task.priority) }]} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.taskTitle,
                          { color: theme.onSurface },
                          task.isCompleted && { textDecorationLine: 'line-through', opacity: 0.4 },
                        ]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                      <Text style={[styles.taskStatus, { color: theme.onSurfaceVariant }]}>
                        {task.isCompleted ? t.taskCompleted : t.waitingForAction}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {task.priority === 'High' && !task.isCompleted && (
                        <MotiView
                          from={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={[styles.highPriorityBadge, { backgroundColor: theme.error + '15' }]}
                        >
                          <Text style={[styles.highPriorityText, { color: theme.error }]}>HIGH</Text>
                        </MotiView>
                      )}
                      {!task.isCompleted && (
                        <TouchableOpacity
                          onPress={() => handleStartTimer(task.title)}
                          style={[styles.timerIcon, { backgroundColor: theme.surfaceContainerHigh }]}
                        >
                          <Timer size={16} color={theme.primary} />
                        </TouchableOpacity>
                      )}
                      <MotiView
                        animate={{
                          backgroundColor: task.isCompleted ? theme.tertiary : theme.surfaceContainerHigh,
                          scale: task.isCompleted ? [1, 1.2, 1] : 1,
                        }}
                        style={styles.checkContainer}
                      >
                        <Check size={16} color={task.isCompleted ? 'white' : theme.onSurfaceVariant} strokeWidth={3} />
                      </MotiView>
                    </View>
                  </TouchableOpacity>
                </MotiView>
              ))}
            </AnimatePresence>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* FAB */}
      <TouchableOpacity
        onPress={openModal}
        style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
      >
        <Plus size={32} color="white" />
      </TouchableOpacity>

      <BottomNavBar />

      {/* Add Task Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.modalSheet, { backgroundColor: theme.surfaceContainerLow }]}>
            {/* Handle */}
            <View style={[styles.sheetHandle, { backgroundColor: theme.outlineVariant + '40' }]} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>{t.addTask}</Text>
              <TouchableOpacity onPress={closeModal} style={[styles.modalClose, { backgroundColor: theme.surfaceContainerHigh }]}>
                <X size={18} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.surfaceContainerHigh,
                  color: theme.onSurface,
                  borderColor: titleError ? theme.error : 'transparent',
                  borderWidth: titleError ? 1 : 0,
                },
              ]}
              placeholder={t.taskTitle}
              placeholderTextColor={theme.onSurfaceVariant + '80'}
              value={title}
              onChangeText={(v) => { setTitle(v); setTitleError(false); }}
              autoFocus
              returnKeyType="next"
            />
            {titleError && (
              <Text style={[styles.errorText, { color: theme.error }]}>{t.titleRequired}</Text>
            )}

            {/* Description */}
            <TextInput
              style={[
                styles.input,
                styles.inputMulti,
                { backgroundColor: theme.surfaceContainerHigh, color: theme.onSurface },
              ]}
              placeholder={t.taskDescription}
              placeholderTextColor={theme.onSurfaceVariant + '80'}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {/* Priority */}
            <Text style={[styles.priorityLabel, { color: theme.onSurfaceVariant }]}>{t.priority}</Text>
            <View style={styles.priorityRow}>
              {(['Low', 'Medium', 'High'] as Priority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => { setPriority(p); Haptics.selectionAsync(); }}
                  style={[
                    styles.priorityChip,
                    {
                      backgroundColor: priority === p ? priorityColor(p) : theme.surfaceContainerHigh,
                    },
                  ]}
                >
                  <Text style={[
                    styles.priorityChipText,
                    { color: priority === p ? 'white' : theme.onSurfaceVariant },
                  ]}>
                    {p === 'Low' ? t.low : p === 'Medium' ? t.medium : t.high}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Save */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
            >
              <Text style={styles.saveBtnText}>{saving ? '...' : t.save}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 50,
  },
  avatarContainer: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  logoText: { fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  plusBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  headlineTitle: { fontSize: 48, fontWeight: '900', letterSpacing: -2, lineHeight: 52 },
  headlineSub: { fontSize: 14, marginTop: 8, fontWeight: '600', opacity: 0.6 },
  statCategory: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  statName: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  timerBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, alignSelf: 'flex-start', marginTop: 16 },
  timerBtnText: { color: 'white', fontSize: 12, fontWeight: '800' },
  checkCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  listTitle: { fontSize: 20, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5 },
  emptyState: { borderRadius: 24, padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyHint: { fontSize: 14, marginTop: 8, opacity: 0.6 },
  taskItem: {
    borderRadius: 24, padding: 20,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  priorityIndicator: { width: 3, height: 32, borderRadius: 3, marginRight: 16 },
  taskTitle: { fontSize: 16, fontWeight: '700' },
  taskStatus: { fontSize: 10, fontWeight: '600', marginTop: 2, opacity: 0.5 },
  highPriorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  highPriorityText: { fontSize: 8, fontWeight: '900' },
  timerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  checkContainer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20,
    elevation: 10, zIndex: 100,
  },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  modalClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderRadius: 16, padding: 16, fontSize: 16, fontWeight: '500',
    marginBottom: 12,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 8, marginLeft: 4 },
  priorityLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  priorityChip: { flex: 1, paddingVertical: 10, borderRadius: 100, alignItems: 'center' },
  priorityChipText: { fontSize: 13, fontWeight: '800' },
  saveBtn: { borderRadius: 100, padding: 18, alignItems: 'center' },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '900' },
});
