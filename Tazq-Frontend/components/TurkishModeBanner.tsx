import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
  ActivityIndicator, Animated, useWindowDimensions,
} from 'react-native';
import { MotiView } from 'moti';
import { X, ChevronRight, Check, Zap, ArrowLeft, Flame, Target, RefreshCw, Trash2, TrendingUp, CheckCircle2, Circle, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHabitStore, fmtDateKey } from '../store/useHabitStore';
import { useTaskStore } from '../store/useTaskStore';
import { useFocusStore } from '../store/useFocusStore';
import { TaskService } from '../services/api';
import { TurkishMode, StudyTemplate, ModeHabit, ModeTask } from '../utils/turkishModes';
import { getCurrentRamadanStatus } from '../utils/ramadanDates';
import { extractPlanFromText, QUICK_EMOJIS, QUICK_COLORS, DraftHabit, DraftTask } from '../utils/planExtractor';
import { TextInput } from 'react-native';
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
  defaultTemplateId?: string;
}

export const TurkishModeBanner: React.FC<Props> = ({
  mode, onDismiss, showSheetImmediately, onApplied, onSheetClose,
  planApplied, planHabitIds = [], planTaskIds = [], onClearPlan,
  defaultTemplateId,
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
  const ramazanStatus = useMemo(() => getCurrentRamadanStatus(), []);
  const isRamazanActive = ramazanStatus.isActive;

  const [sheetVisible, setSheetVisible] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StudyTemplate | null>(() => {
    if (defaultTemplateId && mode.templates?.length) {
      return mode.templates.find(t => t.id === defaultTemplateId) ?? null;
    }
    return null;
  });
  const [deselectedHabits, setDeselectedHabits] = useState<Set<string>>(new Set());
  const sheetWasOpenRef = React.useRef(false);
  const appliedRef = React.useRef(false);
  const onSheetCloseRef = React.useRef(onSheetClose);
  onSheetCloseRef.current = onSheetClose;

  const [step, setStep] = useState<'template' | 'review' | 'custom'>(() => {
    if (planApplied || !mode.templates?.length) return 'review';
    if (defaultTemplateId && mode.templates?.some(t => t.id === defaultTemplateId)) return 'review';
    return 'template';
  });

  // Custom plan state
  const [customHabits, setCustomHabits] = useState<DraftHabit[]>([]);
  const [customTasks,  setCustomTasks]  = useState<DraftTask[]>([]);
  const [customAiText, setCustomAiText] = useState('');
  const [customGoal,   setCustomGoal]   = useState(60);

  useEffect(() => {
    if (sheetVisible) {
      sheetWasOpenRef.current = true;
      // Auto-select the recommended template when the sheet first opens
      if (defaultTemplateId && !selectedTemplate && mode.templates?.length) {
        const match = mode.templates.find(t => t.id === defaultTemplateId);
        if (match) setSelectedTemplate(match);
      }
    } else if (sheetWasOpenRef.current) {
      sheetWasOpenRef.current = false;
      if (!appliedRef.current) onSheetCloseRef.current?.();
    }
  }, [sheetVisible]);

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
    for (const h of newHabits.filter(h => !deselectedHabits.has(h.name))) {
      const hid = `habit_${mode.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      addHabit(h.name, h.emoji, h.color, hid);
      addedHabitIds.push(hid);
    }

    // Next Monday ISO date — used as dueDate for recurring weight_entry tasks
    const nextMonday = (() => {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() + ((8 - day) % 7 || 7));
      return d.toISOString().split('T')[0];
    })();

    // Ramazan tasks created before Ramazan starts get the start date as dueDate
    // so they don't clutter the task list until they're relevant
    const ramazanStartDate = mode.type === 'ramazan' && !isRamazanActive
      ? (ramazanStatus.period?.start ?? undefined)
      : undefined;

    const addedTaskIds: number[] = [];
    for (const task of newTasks) {
      const title = tr ? task.titleTr : task.titleEn;
      const isWeightEntry = task.tags?.includes('weight_entry');
      const dueDate = isWeightEntry ? nextMonday : ramazanStartDate;
      try {
        const created = await TaskService.createTask({
          title, description: '', priority: task.priority,
          isCompleted: false, tags: [mode.type, ...(task.tags ?? [])], subtasks: [],
          ...(dueDate && { dueDate }),
        } as any);
        addTask({ ...created, title });
        addedTaskIds.push(created.id);
      } catch {
        const localId = Math.floor(Date.now() + Math.random() * 1000);
        addTask({
          id: localId, title, description: '', priority: task.priority,
          isCompleted: false, tags: [mode.type, ...(task.tags ?? [])], subtasks: [],
          ...(dueDate && { dueDate }),
        } as any);
        addedTaskIds.push(localId);
      }
    }

    onApplied?.(addedHabitIds, addedTaskIds);
    setApplying(false);
    appliedRef.current = true;
    setApplied(true);
  };

  const modeAccent =
    mode.type === 'ramazan' ? (isDark ? '#A5B4FC' : '#6366F1')
    : mode.type === 'yks' ? (isDark ? '#93C5FD' : '#3B82F6')
    : mode.type === 'exam' ? (isDark ? '#93C5FD' : '#3B82F6')
    : mode.type === 'tez' ? (isDark ? '#C4B5FD' : '#8B5CF6')
    : mode.type === 'mulakat' ? (isDark ? '#6EE7B7' : '#10B981')
    : mode.type === 'spor' ? (isDark ? '#FCA5A1' : '#F97316')
    : (isDark ? '#F9A8D4' : '#EC4899');

  const selectTemplate = (tpl: StudyTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTemplate(tpl);
    setDeselectedHabits(new Set());
    setStep('review');
  };

  // ── Custom Plan Step ──
  const renderCustomStep = () => {
    const totalItems = customHabits.length + customTasks.length;
    const canProceed = customHabits.some(h => h.nameTr.trim()) || customTasks.some(t => t.titleTr.trim());

    const cycleEmoji = (idx: number) => {
      setCustomHabits(prev => {
        const next = [...prev];
        const cur = QUICK_EMOJIS.indexOf(next[idx].emoji);
        next[idx] = { ...next[idx], emoji: QUICK_EMOJIS[(cur + 1) % QUICK_EMOJIS.length] };
        return next;
      });
    };

    const cycleColor = (idx: number) => {
      setCustomHabits(prev => {
        const next = [...prev];
        const cur = QUICK_COLORS.indexOf(next[idx].color);
        next[idx] = { ...next[idx], color: QUICK_COLORS[(cur + 1) % QUICK_COLORS.length] };
        return next;
      });
    };

    const suggest = () => {
      if (!customAiText.trim()) return;
      const { habits: hs, tasks: ts } = extractPlanFromText(customAiText, tr);
      if (hs.length) setCustomHabits(prev => [...prev, ...hs].slice(0, 5));
      if (ts.length) setCustomTasks(prev => [...prev, ...ts].slice(0, 7));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const proceed = () => {
      const tpl: StudyTemplate = {
        id: `custom_${Date.now()}`,
        titleTr: 'Kişisel Planım',
        titleEn: 'My Custom Plan',
        descTr: 'Kendi oluşturduğum plan',
        descEn: 'My own plan',
        targetTr: '', targetEn: '',
        emoji: '✨',
        dailyGoalMinutes: customGoal,
        habits: customHabits
          .filter(h => h.nameTr.trim())
          .map(h => ({ name: h.name || h.nameTr, nameTr: h.nameTr, emoji: h.emoji, color: h.color })),
        tasks: customTasks
          .filter(t => t.titleTr.trim())
          .map(t => ({ titleTr: t.titleTr, titleEn: t.titleEn || t.titleTr, priority: t.priority })),
      };
      selectTemplate(tpl);
    };

    return (
      <>
        <View style={styles.sheetHeader}>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setStep('template'); }}
            style={{ marginRight: S.sm, padding: 4 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={20} color={theme.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={{ fontSize: 26, lineHeight: 32 }}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
              {tr ? 'Kendi Planını Oluştur' : 'Build Your Own Plan'}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
              {tr ? 'Alışkanlık ve görevleri kendin belirle' : 'Set your own habits & tasks'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
          {/* AI text suggest */}
          <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
            <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, marginBottom: S.xs }}>
              {tr ? '✦ Planını birkaç cümleyle anlat, önerelim' : '✦ Describe your plan, we\'ll suggest habits & tasks'}
            </Text>
            <TextInput
              value={customAiText}
              onChangeText={setCustomAiText}
              multiline
              numberOfLines={3}
              placeholder={tr ? 'Örn: Sabah koşusu, kilo vermek, daha sağlıklı beslenmek...' : 'E.g. Morning run, lose weight, eat healthier...'}
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
              style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '500', minHeight: 54, lineHeight: 20, textAlignVertical: 'top' }}
            />
            <TouchableOpacity
              onPress={suggest}
              style={{ alignSelf: 'flex-end', backgroundColor: modeAccent, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs + 1, marginTop: S.xs }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: F.caption, fontWeight: '800' }}>{tr ? 'Öner' : 'Suggest'}</Text>
            </TouchableOpacity>
          </View>

          {/* Habits */}
          <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginBottom: S.sm }]}>
            {tr ? 'ALIŞKANLIKLAR' : 'HABITS'}
          </Text>
          {customHabits.map((h, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs + 1 }}>
              <TouchableOpacity
                onPress={() => cycleEmoji(idx)}
                style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: h.color + '20', borderWidth: 1, borderColor: h.color + '40' }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16 }}>{h.emoji}</Text>
              </TouchableOpacity>
              <TextInput
                value={h.nameTr}
                onChangeText={v => setCustomHabits(prev => { const n = [...prev]; n[idx] = { ...n[idx], nameTr: v, name: v }; return n; })}
                placeholder={tr ? 'Alışkanlık adı...' : 'Habit name...'}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
                style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '600', height: 34, paddingVertical: 0, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
                returnKeyType="next"
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity onPress={() => cycleColor(idx)} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: h.color, borderWidth: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.4)' : '#fff' }} activeOpacity={0.7} />
              <TouchableOpacity onPress={() => setCustomHabits(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }} activeOpacity={0.7}>
                <X size={14} color={theme.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          ))}
          {customHabits.length < 5 && (
            <TouchableOpacity
              onPress={() => setCustomHabits(prev => [...prev, { name: '', nameTr: '', emoji: QUICK_EMOJIS[prev.length % QUICK_EMOJIS.length], color: QUICK_COLORS[prev.length % QUICK_COLORS.length] }])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: S.sm }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: modeAccent, lineHeight: 22 }}>+</Text>
              <Text style={{ fontSize: F.caption, fontWeight: '700', color: modeAccent }}>{tr ? 'Alışkanlık Ekle' : 'Add Habit'}</Text>
            </TouchableOpacity>
          )}

          {/* Tasks */}
          <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginTop: S.md, marginBottom: S.sm }]}>
            {tr ? 'GÖREVLER' : 'TASKS'}
          </Text>
          {customTasks.map((t, idx) => (
            <View key={idx} style={{ marginBottom: S.sm, gap: S.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                <TextInput
                  value={t.titleTr}
                  onChangeText={v => setCustomTasks(prev => { const n = [...prev]; n[idx] = { ...n[idx], titleTr: v, titleEn: v }; return n; })}
                  placeholder={tr ? 'Görev başlığı...' : 'Task title...'}
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
                  style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '600', height: 34, paddingVertical: 0, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
                  returnKeyType="next"
                  underlineColorAndroid="transparent"
                />
                <TouchableOpacity onPress={() => setCustomTasks(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 4 }} activeOpacity={0.7}>
                  <X size={14} color={theme.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {(['High', 'Medium', 'Low'] as const).map(p => {
                  const pColor = p === 'High' ? '#EF4444' : p === 'Medium' ? '#F59E0B' : (theme.onSurfaceVariant as string);
                  const pLabel = tr ? (p === 'High' ? 'Yüksek' : p === 'Medium' ? 'Orta' : 'Düşük') : p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => { Haptics.selectionAsync(); setCustomTasks(prev => { const n = [...prev]; n[idx] = { ...n[idx], priority: p }; return n; }); }}
                      style={{ paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.sm, backgroundColor: t.priority === p ? pColor + '20' : 'transparent', borderWidth: 1, borderColor: t.priority === p ? pColor + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: t.priority === p ? pColor : theme.onSurfaceVariant }}>{pLabel}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          {customTasks.length < 7 && (
            <TouchableOpacity
              onPress={() => setCustomTasks(prev => [...prev, { titleTr: '', titleEn: '', priority: 'Medium' }])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: S.sm }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: modeAccent, lineHeight: 22 }}>+</Text>
              <Text style={{ fontSize: F.caption, fontWeight: '700', color: modeAccent }}>{tr ? 'Görev Ekle' : 'Add Task'}</Text>
            </TouchableOpacity>
          )}

          {/* Daily goal picker */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, paddingTop: S.sm, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
            <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, flex: 1 }}>
              {tr ? 'Günlük odak' : 'Daily focus'}
            </Text>
            {[30, 45, 60, 90, 120].map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setCustomGoal(m)}
                style={{ paddingHorizontal: S.xs + 2, paddingVertical: 3, borderRadius: R.sm, backgroundColor: customGoal === m ? modeAccent + '20' : 'transparent', borderWidth: 1, borderColor: customGoal === m ? modeAccent + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: customGoal === m ? modeAccent : theme.onSurfaceVariant }}>{m}dk</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={canProceed ? proceed : undefined}
          activeOpacity={canProceed ? 0.85 : 1}
          style={[styles.applyBtn, { backgroundColor: canProceed ? modeAccent : theme.surfaceContainerHigh, opacity: canProceed ? 1 : 0.5, marginTop: S.lg }]}
        >
          <Zap size={15} color={canProceed ? '#fff' : (theme.onSurfaceVariant as string)} strokeWidth={2.5} />
          <Text style={[styles.applyBtnText, { color: canProceed ? '#fff' : theme.onSurfaceVariant }]}>
            {tr ? `Devam Et${totalItems > 0 ? ` (${totalItems} öğe)` : ''}` : `Continue${totalItems > 0 ? ` (${totalItems} items)` : ''}`}
          </Text>
        </TouchableOpacity>
      </>
    );
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
              ? (mode.type === 'ramazan' && !isRamazanActive
                ? (tr ? `${mode.daysLeft} gün sonra başlıyor` : `Starts in ${mode.daysLeft} days`)
                : (tr ? `${mode.daysLeft} gün kaldı` : `${mode.daysLeft} days left`))
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
            {(() => {
              const best = planHabitStats.length > 0 ? Math.max(...planHabitStats.map(h => h.streak)) : 0;
              return best > 0 ? `${best}🔥` : '0';
            })()}
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
              {tr ? 'ALIŞKANLIKLARINIZ' : 'YOUR HABITS'}
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
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <TouchableOpacity
            onPress={() => setSheetVisible(false)}
            activeOpacity={0.8}
            style={[styles.clearBtn, { flex: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }]}
          >
            <Text style={[styles.clearBtnText, { color: theme.onSurfaceVariant }]}>
              {tr ? 'Kapat' : 'Close'}
            </Text>
          </TouchableOpacity>
          {onClearPlan && (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onClearPlan(); setSheetVisible(false); }}
              activeOpacity={0.8}
              style={[styles.clearBtn, { flex: 1, borderColor: theme.error + '40' }]}
            >
              <Trash2 size={13} color={theme.error} strokeWidth={2} />
              <Text style={[styles.clearBtnText, { color: theme.error }]}>
                {tr ? 'Planı Kaldır' : 'Remove Plan'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
              {planApplied ? (
                <Text style={[styles.bannerSub, { color: modeAccent }]}>
                  {tr
                    ? `${completedPlanTasks}/${totalPlanTasks} görev · ${avgHabitWeekPct}% alışkanlık`
                    : `${completedPlanTasks}/${totalPlanTasks} tasks · ${avgHabitWeekPct}% habits`}
                </Text>
              ) : (
                <Text style={[styles.bannerSub, { color: modeAccent }]}>
                  {mode.type === 'ramazan' && !isRamazanActive
                    ? (tr ? `${mode.daysLeft} gün sonra başlıyor` : `Starts in ${mode.daysLeft} days`)
                    : (tr ? `${mode.daysLeft} gün kaldı` : `${mode.daysLeft} days left`)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.bannerRight}>
            <TouchableOpacity
              onPress={openSheet}
              style={[styles.planBtn, { backgroundColor: planApplied ? modeAccent : modeAccent }]}
              activeOpacity={0.8}
            >
              {planApplied && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', opacity: 0.85, marginRight: 2 }} />}
              <Text style={styles.planBtnText}>
                {planApplied ? (tr ? 'Planı Gör' : 'View Plan') : (tr ? 'Planı Seç' : 'Pick Plan')}
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
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: theme.outlineVariant + '30', maxHeight: screenHeight - insets.top - 16, paddingBottom: Math.max(insets.bottom, S.lg) + S.md },
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetTitle, { color: theme.onSurface }]}>
                      {tr ? 'Çalışma Planı Seç' : 'Choose a Study Plan'}
                    </Text>
                    <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
                      {tr ? 'Sana uygun seviyeyi seç, gerisini biz ayarlarız.' : 'Pick the level that fits you — we set the rest up.'}
                    </Text>
                  </View>
                </View>
                {/* Exam-specific tip pill */}
                {(tr ? mode.tipTr : mode.tipEn) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, backgroundColor: modeAccent + '12', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm + 1, marginBottom: S.sm, borderWidth: 1, borderColor: modeAccent + '28' }}>
                    <Text style={{ fontSize: 13 }}>💡</Text>
                    <Text style={{ flex: 1, fontSize: F.caption, fontWeight: '600', color: modeAccent, lineHeight: 17, opacity: 0.95 }}>
                      {tr ? mode.tipTr : mode.tipEn}
                    </Text>
                  </View>
                ) : null}
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                  <Text style={[styles.expertNote, { color: theme.onSurfaceVariant }]}>
                    {tr ? '✦ Eğitim psikolojisi araştırmalarına dayalı metodlar' : '✦ Methods based on educational psychology research'}
                  </Text>
                  {mode.templates!.map((tpl) => {
                    const isRecommended = defaultTemplateId === tpl.id;
                    return (
                    <TouchableOpacity
                      key={tpl.id}
                      onPress={() => selectTemplate(tpl)}
                      style={[styles.templateCard, {
                        backgroundColor: isRecommended
                          ? (isDark ? modeAccent + '18' : modeAccent + '10')
                          : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                        borderColor: isRecommended ? modeAccent + '70' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'),
                        borderWidth: isRecommended ? 1.5 : 1,
                      }]}
                      activeOpacity={0.75}
                    >
                      {/* Recommended ribbon */}
                      {isRecommended && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: S.sm, backgroundColor: modeAccent + '20', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: 4, alignSelf: 'flex-start' }}>
                          <Star size={11} color={modeAccent} fill={modeAccent} strokeWidth={0} />
                          <Text style={{ fontSize: 10, fontWeight: '900', color: modeAccent, letterSpacing: 0.5 }}>
                            {tr ? `${mode.labelTr.split(' ')[0]} İÇİN ÖNERİLEN` : `RECOMMENDED FOR ${mode.labelEn.split(' ')[0].toUpperCase()}`}
                          </Text>
                        </View>
                      )}
                      <View style={styles.templateTop}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text style={{ fontSize: 18, lineHeight: 22 }}>{tpl.emoji}</Text>
                            <Text style={[styles.templateTitle, { color: theme.onSurface, flex: 1 }]}>{tr ? tpl.titleTr : tpl.titleEn}</Text>
                          </View>
                          <Text style={[styles.templateDesc, { color: theme.onSurfaceVariant, opacity: 0.9 }]}>{tr ? tpl.descTr : tpl.descEn}</Text>
                        </View>
                        <ChevronRight size={16} color={isRecommended ? modeAccent : theme.onSurfaceVariant} opacity={isRecommended ? 0.8 : 0.4} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                        {tpl.habits.slice(0, 4).map((h) => (
                          <View key={h.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: h.color + '18', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10 }}>{h.emoji}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: h.color, letterSpacing: 0.2 }}>{tr ? h.nameTr : h.name}</Text>
                          </View>
                        ))}
                        {tpl.tasks.length > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: modeAccent + '12', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10 }}>✓</Text>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: modeAccent, letterSpacing: 0.2 }}>{tpl.tasks.length} {tr ? 'görev' : 'tasks'}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.templateMeta}>
                        <View style={[styles.metaChip, { backgroundColor: modeAccent + '18' }]}>
                          <Text style={[styles.metaChipText, { color: modeAccent }]}>{tpl.dailyGoalMinutes} {tr ? 'dk/gün' : 'min/day'}</Text>
                        </View>
                        <Text style={[styles.templateTarget, { color: theme.onSurfaceVariant }]}>{tr ? tpl.targetTr : tpl.targetEn}</Text>
                      </View>
                    </TouchableOpacity>
                    );
                  })}
                  {/* Custom plan card */}
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setStep('custom'); }}
                    style={[styles.templateCard, {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      paddingVertical: S.lg,
                    }]}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 24, marginBottom: S.xs }}>✏️</Text>
                    <Text style={{ fontSize: F.body, fontWeight: '800', color: theme.onSurface }}>
                      {tr ? 'Kendi Planını Oluştur' : 'Build Your Own Plan'}
                    </Text>
                    <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, marginTop: 2, textAlign: 'center' }}>
                      {tr ? 'Alışkanlık ve görevleri kendin belirle' : 'Set your own habits and tasks'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}

            {!planApplied && step === 'custom' && renderCustomStep()}

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
                    const skipped = !exists && deselectedHabits.has(h.name);
                    return (
                      <TouchableOpacity
                        key={h.name}
                        onPress={() => {
                          if (exists) return;
                          Haptics.selectionAsync();
                          setDeselectedHabits(prev => {
                            const next = new Set(prev);
                            if (next.has(h.name)) next.delete(h.name);
                            else next.add(h.name);
                            return next;
                          });
                        }}
                        style={[styles.itemRow, { opacity: exists || skipped ? 0.4 : 1 }]}
                        activeOpacity={exists ? 1 : 0.7}
                      >
                        <View style={[styles.itemDot, { backgroundColor: (skipped ? '#94A3B8' : h.color) + '30', borderColor: (skipped ? '#94A3B8' : h.color) + '60' }]}>
                          <Text style={{ fontSize: 15 }}>{h.emoji}</Text>
                        </View>
                        <Text style={[styles.itemText, { color: theme.onSurface, flex: 1, textDecorationLine: skipped ? 'line-through' : 'none' }]}>{tr ? h.nameTr : h.name}</Text>
                        {exists
                          ? <Check size={15} color={theme.tertiary} strokeWidth={2.5} />
                          : skipped
                          ? <X size={15} color={theme.onSurfaceVariant} strokeWidth={2} />
                          : <Check size={15} color={h.color} strokeWidth={2.5} />}
                      </TouchableOpacity>
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
                  onPress={applied ? () => setSheetVisible(false) : applyAll}
                  activeOpacity={0.85}
                  disabled={applying || allDone}
                  style={[styles.applyBtn, { backgroundColor: applied ? theme.tertiary : allDone ? theme.surfaceContainerHigh : modeAccent, opacity: applying ? 0.7 : 1 }]}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : applied ? (
                    <><Check size={16} color="#fff" strokeWidth={2.5} /><Text style={styles.applyBtnText}>{tr ? 'Uygulandı! — Kapat' : 'Applied! — Close'}</Text></>
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
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: S.lg },
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
