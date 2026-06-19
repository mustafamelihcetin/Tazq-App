import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  ActivityIndicator, Animated,
} from 'react-native';
import { MotiView } from 'moti';
import { X, ChevronRight, Check, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabitStore } from '../store/useHabitStore';
import { useTaskStore } from '../store/useTaskStore';
import { TaskService } from '../services/api';
import { TurkishMode } from '../utils/turkishModes';
import { S, R, F } from '../constants/tokens';
import { useLanguageStore } from '../store/useLanguageStore';

interface Props {
  mode: TurkishMode;
  onDismiss: () => void;
}

export const TurkishModeBanner: React.FC<Props> = ({ mode, onDismiss }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();
  const tr = language === 'tr';

  const { habits, addHabit } = useHabitStore();
  const { tasks, addTask } = useTaskStore();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const { panResponder, animatedStyle, slideIn } = useSwipeToDismiss({
    onDismiss: () => setSheetVisible(false),
  });

  const existingHabitNames = new Set(habits.map(h => h.name.toLowerCase()));
  const existingTaskTitles = new Set(tasks.map(t => t.title.toLowerCase()));

  const newHabits = mode.habits.filter(h => !existingHabitNames.has(h.name.toLowerCase()));
  const newTasks = mode.tasks.filter(t =>
    !existingTaskTitles.has(t.titleTr.toLowerCase()) &&
    !existingTaskTitles.has(t.titleEn.toLowerCase())
  );

  const alreadyHabits = mode.habits.filter(h => existingHabitNames.has(h.name.toLowerCase()));
  const alreadyTasks = mode.tasks.filter(t =>
    existingTaskTitles.has(t.titleTr.toLowerCase()) ||
    existingTaskTitles.has(t.titleEn.toLowerCase())
  );

  const allDone = newHabits.length === 0 && newTasks.length === 0;

  const openSheet = () => {
    setSheetVisible(true);
    setTimeout(() => slideIn(), 50);
  };

  const applyAll = async () => {
    if (applying || allDone) return;
    setApplying(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    for (const h of newHabits) {
      addHabit(h.name, h.emoji, h.color);
    }

    for (const task of newTasks) {
      const title = tr ? task.titleTr : task.titleEn;
      try {
        const created = await TaskService.createTask({
          title,
          description: '',
          priority: task.priority,
          isCompleted: false,
          tags: [mode.type],
          subtasks: [],
        } as any);
        addTask({ ...created, title });
      } catch {
        addTask({
          id: Date.now() + Math.random(),
          title,
          description: '',
          priority: task.priority,
          isCompleted: false,
          tags: [mode.type],
          subtasks: [],
        } as any);
      }
    }

    setApplying(false);
    setApplied(true);
    setTimeout(() => setSheetVisible(false), 1200);
  };

  const modeAccent =
    mode.type === 'ramazan' ? '#6366F1'
    : mode.type === 'yks' ? '#3B82F6'
    : '#EC4899';

  return (
    <>
      <MotiView
        from={{ opacity: 0, translateY: -8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18 }}
        style={[
          styles.banner,
          {
            backgroundColor: isDark ? modeAccent + '22' : modeAccent + '12',
            borderColor: modeAccent + '40',
          },
        ]}
      >
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerEmoji}>{mode.emoji}</Text>
          <View>
            <Text style={[styles.bannerTitle, { color: isDark ? '#fff' : '#111' }]}>
              {tr ? mode.labelTr : mode.labelEn}
            </Text>
            <Text style={[styles.bannerSub, { color: modeAccent }]}>
              {tr ? `${mode.daysLeft} gün kaldı` : `${mode.daysLeft} days left`}
            </Text>
          </View>
        </View>
        <View style={styles.bannerRight}>
          <TouchableOpacity
            onPress={openSheet}
            style={[styles.planBtn, { backgroundColor: modeAccent }]}
            activeOpacity={0.8}
          >
            <Text style={styles.planBtnText}>{tr ? 'Planı Uygula' : 'Apply Plan'}</Text>
            <ChevronRight size={13} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'} />
          </TouchableOpacity>
        </View>
      </MotiView>

      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={() => setSheetVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSheetVisible(false)} />
          <Animated.View
            style={[
              animatedStyle,
              styles.sheet,
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: theme.outlineVariant + '30' },
            ]}
          >
            <View {...panResponder.panHandlers} style={styles.dragHandle}>
              <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            </View>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetEmoji}>{mode.emoji}</Text>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
                  {tr ? mode.labelTr : mode.labelEn}
                </Text>
                <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
                  {tr ? mode.subtitleTr : mode.subtitleEn}
                </Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {/* Habits */}
              <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                {tr ? 'EKLENECEK ALIŞKANLIKLAR' : 'HABITS TO ADD'}
              </Text>
              {mode.habits.map((h) => {
                const exists = existingHabitNames.has(h.name.toLowerCase());
                return (
                  <View key={h.name} style={[styles.itemRow, { opacity: exists ? 0.45 : 1 }]}>
                    <View style={[styles.itemDot, { backgroundColor: h.color + '30', borderColor: h.color + '60' }]}>
                      <Text style={{ fontSize: 15 }}>{h.emoji}</Text>
                    </View>
                    <Text style={[styles.itemText, { color: theme.onSurface }]}>{h.name}</Text>
                    {exists && <Check size={15} color={theme.tertiary} strokeWidth={2.5} />}
                  </View>
                );
              })}

              {/* Tasks */}
              <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginTop: S.md }]}>
                {tr ? 'EKLENECEK GÖREVLER' : 'TASKS TO ADD'}
              </Text>
              {mode.tasks.map((task) => {
                const title = tr ? task.titleTr : task.titleEn;
                const exists =
                  existingTaskTitles.has(task.titleTr.toLowerCase()) ||
                  existingTaskTitles.has(task.titleEn.toLowerCase());
                const priorityColor =
                  task.priority === 'High' ? theme.error
                  : task.priority === 'Medium' ? '#F59E0B'
                  : theme.onSurfaceVariant;
                return (
                  <View key={title} style={[styles.itemRow, { opacity: exists ? 0.45 : 1 }]}>
                    <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                    <Text style={[styles.itemText, { color: theme.onSurface, flex: 1 }]}>{title}</Text>
                    {exists && <Check size={15} color={theme.tertiary} strokeWidth={2.5} />}
                  </View>
                );
              })}
            </ScrollView>

            {/* Apply button */}
            <TouchableOpacity
              onPress={applyAll}
              activeOpacity={0.85}
              disabled={applying || allDone}
              style={[
                styles.applyBtn,
                {
                  backgroundColor: applied ? theme.tertiary : allDone ? theme.surfaceContainerHigh : modeAccent,
                  opacity: applying ? 0.7 : 1,
                },
              ]}
            >
              {applying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : applied ? (
                <>
                  <Check size={16} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.applyBtnText}>{tr ? 'Uygulandı!' : 'Applied!'}</Text>
                </>
              ) : allDone ? (
                <Text style={[styles.applyBtnText, { color: theme.onSurfaceVariant }]}>
                  {tr ? 'Tümü zaten mevcut' : 'All already added'}
                </Text>
              ) : (
                <>
                  <Zap size={15} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.applyBtnText}>
                    {tr
                      ? `Tümünü Uygula  (${newHabits.length + newTasks.length} öğe)`
                      : `Apply All  (${newHabits.length + newTasks.length} items)`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: R.lg,
    borderWidth: 1,
    paddingVertical: S.sm + 2,
    paddingHorizontal: S.md,
    marginBottom: S.md,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  bannerEmoji: { fontSize: 22 },
  bannerTitle: { fontSize: F.body, fontWeight: '700' },
  bannerSub: { fontSize: F.caption, fontWeight: '600', marginTop: 1 },
  bannerRight: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: S.sm + 2, paddingVertical: S.xs + 1,
    borderRadius: R.full,
  },
  planBtnText: { color: '#fff', fontSize: F.caption, fontWeight: '800' },
  dismissBtn: { padding: 2 },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, paddingHorizontal: S.lg, paddingBottom: S.xl + S.lg,
  },
  dragHandle: { paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg },
  sheetEmoji: { fontSize: 36 },
  sheetTitle: { fontSize: F.title, fontWeight: '800' },
  sheetSub: { fontSize: F.caption, fontWeight: '500', marginTop: 2 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: S.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs + 1 },
  itemDot: {
    width: 34, height: 34, borderRadius: 10,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  priorityDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  itemText: { fontSize: F.body, fontWeight: '600' },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: S.sm, marginTop: S.lg, borderRadius: R.full,
    paddingVertical: S.md, paddingHorizontal: S.lg,
  },
  applyBtnText: { color: '#fff', fontSize: F.body, fontWeight: '800' },
});
