import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  ActivityIndicator, Animated, useWindowDimensions,
} from 'react-native';
import { MotiView } from 'moti';
import { X, ChevronRight, Check, Zap, ArrowLeft, Flame, Target, RefreshCw, Trash2, TrendingUp, CheckCircle2, Circle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabitStore, fmtDateKey } from '../store/useHabitStore';
import { useTaskStore } from '../store/useTaskStore';
import { useFocusStore } from '../store/useFocusStore';
import { TaskService } from '../services/api';
import { TurkishMode, StudyTemplate } from '../utils/turkishModes';
import { S, R, F } from '../constants/tokens';
import { useLanguageStore } from '../store/useLanguageStore';

interface Props {
  mode: TurkishMode;
  onDismiss: () => void;
  showSheetImmediately?: boolean;
  onApplied?: (habitIds: string[], taskIds: number[]) => void;
  onSheetClose?: () => void;
  planApplied?: boolean;
  planHabitIds?: string[];
  planTaskIds?: number[];
  onClearPlan?: () => void;
}

export const TurkishModeBanner: React.FC<Props> = ({
  mode, onDismiss, showSheetImmediately, onApplied, onSheetClose,
  planApplied, planHabitIds = [], planTaskIds = [], onClearPlan,
}) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { habits, addHabit, getStreak } = useHabitStore();
  const { tasks, addTask } = useTaskStore();
  const { setDailyGoal } = useFocusStore();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StudyTemplate | null>(null);
  const sheetWasOpenRef = React.useRef(false);
  const appliedRef = React.useRef(false);
  const onSheetCloseRef = React.useRef(onSheetClose);
  onSheetCloseRef.current = onSheetClose;

  useEffect(() => {
    if (sheetVisible) {
      sheetWasOpenRef.current = true;
    } else if (sheetWasOpenRef.current) {
      sheetWasOpenRef.current = false;
      if (!appliedRef.current) onSheetCloseRef.current?.();
    }
  }, [sheetVisible]);

  const [step, setStep] = useState<'template' | 'review'>(
    (planApplied || !mode.templates?.length) ? 'review' : 'template'
  );

  const { panResponder, animatedStyle, prepare: prepareSheet, slideIn } = useSwipeToDismiss({
    onDismiss: () => setSheetVisible(false),
  });

  const hasTemplates = (mode.templates?.length ?? 0) > 0;
  const activeHabits = selectedTemplate?.habits ?? mode.habits;
  const activeTasks = selectedTemplate?.tasks ?? mode.tasks;

  const existingHabitNames = new Set(habits.map(h => h.name.toLowerCase()));
  const existingTaskTitles = new Set(tasks.map(t => t.title.toLowerCase()));

  const newHabits = activeHabits.filter(h => !existingHabitNames.has(h.name.toLowerCase()));
  const newTasks = activeTasks.filter(t =>
    !existingTaskTitles.has(t.titleTr.toLowerCase()) &&
    !existingTaskTitles.has(t.titleEn.toLowerCase())
  );
  const allDone = newHabits.length === 0 && newTasks.length === 0;

  // Plan view data — active habits/tasks from this plan
  const todayKey = fmtDateKey();
  const planHabits = useMemo(
    () => habits.filter(h => planHabitIds.includes(h.id)),
    [habits, planHabitIds]
  );
  const planTasks = useMemo(
    () => tasks.filter(t => planTaskIds.includes(t.id)),
    [tasks, planTaskIds]
  );

  // Last 7 days keys for weekly stats
  const last7Keys = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return fmtDateKey(d);
    });
  }, []);

  const planHabitStats = useMemo(() => planHabits.map(h => {
    const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
    const streak = getStreak(h);
    const doneToday = dates.includes(todayKey);
    const weekDone = last7Keys.filter(k => dates.includes(k)).length;
    return { ...h, streak, doneToday, weekDone };
  }), [planHabits, todayKey, last7Keys, getStreak]);

  const planTaskStats = useMemo(() => planTasks.map(t => ({
    ...t,
    done: !!t.isCompleted,
  })), [planTasks]);

  const completedPlanTasks = planTaskStats.filter(t => t.done).length;
  const totalPlanTasks = planTaskStats.length;
  const avgHabitWeekPct = planHabitStats.length > 0
    ? Math.round(planHabitStats.reduce((s, h) => s + h.weekDone / 7, 0) / planHabitStats.length * 100)
    : 0;

  const openSheet = () => {
    prepareSheet();
    setSheetVisible(true);
  };

  useEffect(() => {
    if (showSheetImmediately) {
      setTimeout(() => openSheet(), 150);
    }
  }, [showSheetImmediately]);

  const applyAll = async () => {
    if (applying || allDone) return;
    setApplying(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (selectedTemplate?.dailyGoalMinutes) setDailyGoal(selectedTemplate.dailyGoalMinutes);

    const addedHabitIds: string[] = [];
    for (const h of newHabits) {
      const hid = `habit_${mode.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      addHabit(h.name, h.emoji, h.color, hid);
      addedHabitIds.push(hid);
    }

    const addedTaskIds: number[] = [];
    for (const task of newTasks) {
      const title = tr ? task.titleTr : task.titleEn;
      try {
        const created = await TaskService.createTask({
          title, description: '', priority: task.priority,
          isCompleted: false, tags: [mode.type], subtasks: [],
        } as any);
        addTask({ ...created, title });
        addedTaskIds.push(created.id);
      } catch {
        const localId = Math.floor(Date.now() + Math.random() * 1000);
        addTask({
          id: localId, title, description: '', priority: task.priority,
          isCompleted: false, tags: [mode.type], subtasks: [],
        } as any);
        addedTaskIds.push(localId);
      }
    }

    onApplied?.(addedHabitIds, addedTaskIds);
    setApplying(false);
    appliedRef.current = true;
    setApplied(true);
    setTimeout(() => setSheetVisible(false), 1200);
  };

  const modeAccent =
    mode.type === 'ramazan' ? '#6366F1'
    : mode.type === 'yks' ? '#3B82F6'
    : mode.type === 'exam' ? '#3B82F6'
    : mode.type === 'tez' ? '#8B5CF6'
    : mode.type === 'mulakat' ? '#10B981'
    : '#EC4899';

  const selectTemplate = (tpl: StudyTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTemplate(tpl);
    setStep('review');
  };

  // ── Plan View (when plan already applied) ──
  const renderPlanView = () => (
    <>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetEmoji}>{mode.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
            {tr ? mode.labelTr : mode.labelEn}
          </Text>
          <Text style={[styles.sheetSub, { color: modeAccent }]}>
            {mode.daysLeft > 0
              ? (tr ? `${mode.daysLeft} gün kaldı` : `${mode.daysLeft} days left`)
              : (tr ? 'Süre doldu' : 'Time\'s up')}
          </Text>
        </View>
      </View>

      {/* Progress summary row */}
      <View style={[styles.progressRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <View style={styles.progressStat}>
          <Text style={[styles.progressNum, { color: modeAccent }]}>{avgHabitWeekPct}%</Text>
          <Text style={[styles.progressLabel, { color: theme.onSurfaceVariant }]}>
            {tr ? 'haftalık alışkanlık' : 'weekly habits'}
          </Text>
        </View>
        <View style={[styles.progressDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />
        <View style={styles.progressStat}>
          <Text style={[styles.progressNum, { color: modeAccent }]}>{completedPlanTasks}/{totalPlanTasks}</Text>
          <Text style={[styles.progressLabel, { color: theme.onSurfaceVariant }]}>
            {tr ? 'görev tamamlandı' : 'tasks done'}
          </Text>
        </View>
        <View style={[styles.progressDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />
        <View style={styles.progressStat}>
          <Text style={[styles.progressNum, { color: modeAccent }]}>
            {planHabitStats.length > 0
              ? Math.max(...planHabitStats.map(h => h.streak))
              : 0}🔥
          </Text>
          <Text style={[styles.progressLabel, { color: theme.onSurfaceVariant }]}>
            {tr ? 'en uzun seri' : 'best streak'}
          </Text>
        </View>
      </View>

      <ScrollView style={{ maxHeight: screenHeight * 0.45 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>

        {/* Habits */}
        {planHabitStats.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
              {tr ? 'ALIŞKANLIKLARINız' : 'YOUR HABITS'}
            </Text>
            {planHabitStats.map(h => (
              <View key={h.id} style={[styles.planViewRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={[styles.habitIconSm, { backgroundColor: (h.color ?? modeAccent) + '22' }]}>
                  <Text style={{ fontSize: 16 }}>{h.emoji ?? '📌'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planViewName, { color: theme.onSurface }]} numberOfLines={1}>{h.name}</Text>
                  <View style={styles.habitMeta}>
                    {/* 7-day dots */}
                    <View style={styles.weekDots}>
                      {last7Keys.slice().reverse().map((k, i) => {
                        const dates = Array.isArray(h.completedDates) ? h.completedDates : [];
                        const done = dates.includes(k);
                        return (
                          <View key={i} style={[styles.dot, { backgroundColor: done ? (h.color ?? modeAccent) : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)') }]} />
                        );
                      })}
                    </View>
                    <Text style={[styles.streakText, { color: h.streak > 0 ? '#FF6B35' : theme.onSurfaceVariant }]}>
                      {h.streak > 0 ? `🔥 ${h.streak}` : (tr ? 'seri yok' : 'no streak')}
                    </Text>
                  </View>
                </View>
                <View style={[styles.doneBadge, { backgroundColor: h.doneToday ? (h.color ?? modeAccent) + '22' : 'transparent', borderColor: h.doneToday ? (h.color ?? modeAccent) + '60' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') }]}>
                  {h.doneToday
                    ? <Check size={13} color={h.color ?? modeAccent} strokeWidth={3} />
                    : <Circle size={13} color={theme.onSurfaceVariant} strokeWidth={1.5} />}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Tasks */}
        {planTaskStats.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginTop: planHabitStats.length > 0 ? S.md : 0 }]}>
              {tr ? 'GÖREVLERİNİZ' : 'YOUR TASKS'}
            </Text>
            {planTaskStats.map(t => (
              <View key={t.id} style={[styles.planViewRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', opacity: t.done ? 0.55 : 1 }]}>
                {t.done
                  ? <CheckCircle2 size={18} color={theme.tertiary} strokeWidth={2} />
                  : <Circle size={18} color={theme.onSurfaceVariant} strokeWidth={1.5} />}
                <Text style={[styles.planViewName, { color: theme.onSurface, flex: 1, textDecorationLine: t.done ? 'line-through' : 'none' }]} numberOfLines={2}>
                  {t.title}
                </Text>
                <View style={[styles.priorityChip, { backgroundColor:
                  t.priority === 'High' ? '#EF444420' : t.priority === 'Medium' ? '#F59E0B20' : '#10B98120'
                }]}>
                  <Text style={[styles.priorityChipText, { color:
                    t.priority === 'High' ? '#EF4444' : t.priority === 'Medium' ? '#F59E0B' : '#10B981'
                  }]}>{t.priority}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {planHabits.length === 0 && planTasks.length === 0 && (
          <View style={styles.emptyPlan}>
            <Text style={[styles.emptyPlanText, { color: theme.onSurfaceVariant }]}>
              {tr
                ? 'Plan öğeleri bulunamadı. Silinmiş olabilirler.'
                : 'Plan items not found. They may have been deleted.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Actions */}
      <View style={styles.planViewActions}>
        {(newHabits.length > 0 || newTasks.length > 0) && (
          <TouchableOpacity
            onPress={applyAll}
            activeOpacity={0.85}
            disabled={applying}
            style={[styles.updateBtn, { backgroundColor: modeAccent, opacity: applying ? 0.7 : 1 }]}
          >
            {applying
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <RefreshCw size={14} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.updateBtnText}>
                    {tr ? `Eksikleri Tamamla (${newHabits.length + newTasks.length})` : `Fill Missing (${newHabits.length + newTasks.length})`}
                  </Text>
                </>}
          </TouchableOpacity>
        )}
        {onClearPlan && (
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onClearPlan(); setSheetVisible(false); }}
            activeOpacity={0.8}
            style={[styles.clearBtn, { borderColor: theme.error + '40' }]}
          >
            <Trash2 size={13} color={theme.error} strokeWidth={2} />
            <Text style={[styles.clearBtnText, { color: theme.error }]}>
              {tr ? 'Planı Kaldır' : 'Remove Plan'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  return (
    <>
      {/* Banner — hidden when opened programmatically */}
      {mode.daysLeft > 0 && !showSheetImmediately && (
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={[
            styles.banner,
            { backgroundColor: isDark ? modeAccent + '22' : modeAccent + '12', borderColor: modeAccent + '40' },
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
              <Text style={styles.planBtnText}>
                {planApplied ? (tr ? 'Planı Görüntüle' : 'View Plan') : (tr ? 'Planı Seç' : 'Pick Plan')}
              </Text>
              <ChevronRight size={13} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'} />
            </TouchableOpacity>
          </View>
        </MotiView>
      )}

      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={() => setSheetVisible(false)} onShow={() => slideIn()}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSheetVisible(false)} />
          <Animated.View
            style={[
              animatedStyle,
              styles.sheet,
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: theme.outlineVariant + '30', maxHeight: screenHeight - insets.top - 16 },
            ]}
          >
            <View {...panResponder.panHandlers} style={styles.dragHandle}>
              <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            </View>

            {/* Plan already applied → show smart plan view */}
            {planApplied && renderPlanView()}

            {/* Plan not applied → template selection or review to add */}
            {!planApplied && step === 'template' && hasTemplates && (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetEmoji}>{mode.emoji}</Text>
                  <View>
                    <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
                      {tr ? 'Çalışma Planı Seç' : 'Choose a Study Plan'}
                    </Text>
                    <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
                      {tr ? 'Sana uygun metodu seç, gerisini biz ayarlarız.' : 'Pick the method that fits you — we set the rest up.'}
                    </Text>
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  <Text style={[styles.expertNote, { color: theme.onSurfaceVariant }]}>
                    {tr ? '✦ Eğitim psikolojisi araştırmalarına dayalı metodlar' : '✦ Methods based on educational psychology research'}
                  </Text>
                  {mode.templates!.map((tpl) => (
                    <TouchableOpacity
                      key={tpl.id}
                      onPress={() => selectTemplate(tpl)}
                      style={[styles.templateCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}
                      activeOpacity={0.75}
                    >
                      <View style={styles.templateTop}>
                        <Text style={styles.templateEmoji}>{tpl.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.templateTitle, { color: theme.onSurface }]}>{tr ? tpl.titleTr : tpl.titleEn}</Text>
                          <Text style={[styles.templateDesc, { color: theme.onSurfaceVariant }]}>{tr ? tpl.descTr : tpl.descEn}</Text>
                        </View>
                        <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
                      </View>
                      <View style={styles.templateMeta}>
                        <View style={[styles.metaChip, { backgroundColor: modeAccent + '18' }]}>
                          <Text style={[styles.metaChipText, { color: modeAccent }]}>{tpl.dailyGoalMinutes} {tr ? 'dk/gün' : 'min/day'}</Text>
                        </View>
                        <Text style={[styles.templateTarget, { color: theme.onSurfaceVariant }]}>{tr ? tpl.targetTr : tpl.targetEn}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {!planApplied && step === 'review' && (
              <>
                <View style={styles.sheetHeader}>
                  {hasTemplates && (
                    <TouchableOpacity
                      onPress={() => { Haptics.selectionAsync(); setStep('template'); setSelectedTemplate(null); }}
                      style={{ marginRight: S.sm, padding: 4 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ArrowLeft size={20} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.sheetEmoji}>{selectedTemplate?.emoji ?? mode.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
                      {selectedTemplate ? (tr ? selectedTemplate.titleTr : selectedTemplate.titleEn) : (tr ? mode.labelTr : mode.labelEn)}
                    </Text>
                    <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
                      {selectedTemplate ? `${selectedTemplate.dailyGoalMinutes} ${tr ? 'dk/gün hedef' : 'min/day goal'}` : (tr ? mode.subtitleTr : mode.subtitleEn)}
                    </Text>
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>{tr ? 'EKLENECEK ALIŞKANLIKLAR' : 'HABITS TO ADD'}</Text>
                  {activeHabits.map((h) => {
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
                  <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginTop: S.md }]}>{tr ? 'EKLENECEK GÖREVLER' : 'TASKS TO ADD'}</Text>
                  {activeTasks.map((task) => {
                    const title = tr ? task.titleTr : task.titleEn;
                    const exists = existingTaskTitles.has(task.titleTr.toLowerCase()) || existingTaskTitles.has(task.titleEn.toLowerCase());
                    const pColor = task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : theme.onSurfaceVariant;
                    return (
                      <View key={title} style={[styles.itemRow, { opacity: exists ? 0.45 : 1 }]}>
                        <View style={[styles.priorityDot, { backgroundColor: pColor }]} />
                        <Text style={[styles.itemText, { color: theme.onSurface, flex: 1 }]}>{title}</Text>
                        {exists && <Check size={15} color={theme.tertiary} strokeWidth={2.5} />}
                      </View>
                    );
                  })}
                  {selectedTemplate && (
                    <View style={[styles.goalNote, { backgroundColor: modeAccent + '12', borderColor: modeAccent + '30' }]}>
                      <Text style={[styles.goalNoteText, { color: modeAccent }]}>
                        {tr ? `Günlük odak hedefin ${selectedTemplate.dailyGoalMinutes} dakikaya ayarlanacak` : `Daily focus goal will be set to ${selectedTemplate.dailyGoalMinutes} minutes`}
                      </Text>
                    </View>
                  )}
                </ScrollView>
                <TouchableOpacity
                  onPress={applyAll}
                  activeOpacity={0.85}
                  disabled={applying || allDone}
                  style={[styles.applyBtn, { backgroundColor: applied ? theme.tertiary : allDone ? theme.surfaceContainerHigh : modeAccent, opacity: applying ? 0.7 : 1 }]}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : applied ? (
                    <><Check size={16} color="#fff" strokeWidth={2.5} /><Text style={styles.applyBtnText}>{tr ? 'Uygulandı!' : 'Applied!'}</Text></>
                  ) : allDone ? (
                    <Text style={[styles.applyBtnText, { color: theme.onSurfaceVariant }]}>{tr ? 'Tümü zaten mevcut' : 'All already added'}</Text>
                  ) : (
                    <><Zap size={15} color="#fff" strokeWidth={2.5} /><Text style={styles.applyBtnText}>{tr ? `Uygula  (${newHabits.length + newTasks.length} öğe)` : `Apply  (${newHabits.length + newTasks.length} items)`}</Text></>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: R.lg, borderWidth: 1,
    paddingVertical: S.sm + 2, paddingHorizontal: S.md, marginBottom: S.md,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  bannerEmoji: { fontSize: 22 },
  bannerTitle: { fontSize: F.body, fontWeight: '700' },
  bannerSub: { fontSize: F.caption, fontWeight: '600', marginTop: 1 },
  bannerRight: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: S.sm + 2, paddingVertical: S.xs + 1, borderRadius: R.full },
  planBtnText: { color: '#fff', fontSize: F.caption, fontWeight: '800' },
  dismissBtn: { padding: 2 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: S.lg, paddingBottom: S.xl + S.lg },
  dragHandle: { paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg },
  sheetEmoji: { fontSize: 36 },
  sheetTitle: { fontSize: F.title, fontWeight: '800' },
  sheetSub: { fontSize: F.caption, fontWeight: '500', marginTop: 2 },
  // Progress summary
  progressRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: R.md,
    borderWidth: 1, marginBottom: S.lg, paddingVertical: S.md,
  },
  progressStat: { flex: 1, alignItems: 'center', gap: 2 },
  progressNum: { fontSize: F.title, fontWeight: '900' },
  progressLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center' },
  progressDivider: { width: 1, height: 32 },
  // Plan view rows
  planViewRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    borderRadius: R.md, borderWidth: 1, padding: S.sm + 2, marginBottom: S.xs + 1,
  },
  planViewName: { fontSize: F.body, fontWeight: '600' },
  habitIconSm: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  habitMeta: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: 3 },
  weekDots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  streakText: { fontSize: 11, fontWeight: '700' },
  doneBadge: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  priorityChip: { borderRadius: R.sm, paddingHorizontal: S.xs + 1, paddingVertical: 2 },
  priorityChipText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
  emptyPlan: { alignItems: 'center', paddingVertical: S.xl },
  emptyPlanText: { fontSize: F.body, textAlign: 'center', opacity: 0.6 },
  // Plan view actions
  planViewActions: { gap: S.sm, marginTop: S.lg },
  updateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.full, paddingVertical: S.md },
  updateBtnText: { color: '#fff', fontSize: F.body, fontWeight: '800' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: 1 },
  clearBtnText: { fontSize: F.caption, fontWeight: '700' },
  // Templates
  templateCard: { borderRadius: R.md, borderWidth: 1, padding: S.md, marginBottom: S.sm, gap: S.sm },
  templateTop: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  templateEmoji: { fontSize: 26, lineHeight: 32 },
  templateTitle: { fontSize: F.body, fontWeight: '800', marginBottom: 2 },
  templateDesc: { fontSize: F.caption, fontWeight: '500', lineHeight: 17, opacity: 0.75 },
  templateMeta: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' },
  metaChip: { borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 },
  metaChipText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  templateTarget: { fontSize: 10, fontWeight: '600', opacity: 0.55, flex: 1 },
  // Review
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: S.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.xs + 1 },
  itemDot: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  priorityDot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  itemText: { fontSize: F.body, fontWeight: '600' },
  goalNote: { borderRadius: R.md, borderWidth: 1, padding: S.md, marginTop: S.md },
  goalNoteText: { fontSize: F.caption, fontWeight: '700', lineHeight: 17 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginTop: S.lg, borderRadius: R.full, paddingVertical: S.md, paddingHorizontal: S.lg },
  applyBtnText: { color: '#fff', fontSize: F.body, fontWeight: '800' },
  expertNote: { fontSize: 10, fontWeight: '600', opacity: 0.4, letterSpacing: 0.3, marginBottom: S.md, marginTop: S.xs },
});
