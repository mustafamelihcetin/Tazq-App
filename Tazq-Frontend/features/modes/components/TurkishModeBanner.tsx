import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform, ActivityIndicator, Animated, useWindowDimensions, TextInput } from 'react-native';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MotiView } from 'moti';
import { PLAN_PURPOSE } from '@/features/modes/components/plan/planCopy';
import type { PlanType } from '@/features/modes/utils/planSlots';
import { X, ChevronRight, Check, Zap, ArrowLeft, Flame, Target, RefreshCw, Trash2, TrendingUp, CheckCircle2, Circle, Star, Shield, Lightbulb, Pencil, Sparkles, Layers } from 'lucide-react-native';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useTaskStore, translateTag } from '@/features/tasks';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { TaskService } from '@/shared/services/api';
import { TurkishMode, StudyTemplate, ModeHabit, ModeTask, localizeSporGoal } from '../utils/turkishModes';
import { ramadanStatusNow } from '@/features/modes/utils/ramadanPreview';
import { renderModeEmojiIcon } from '../utils/modeIcons';
import { draftsFromText, QUICK_EMOJIS, QUICK_COLORS, DraftHabit, DraftTask } from '@/features/modes/utils/customPlanDraft';
import { langOf } from '@/shared/utils/lang';
import { ICON, S, R, F, B, HAIRLINE , sheetMaxHeight, SCRIM } from '@/shared/constants/tokens';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { usePrefsStore, PlanMode, PlanSpec, SeasonalPrefs } from '../store/usePrefsStore';
import { usePlanAdaptations } from '../hooks/usePlanAdaptations';
import { modeAccent as resolveModeAccent, modeAccentOn } from '@/shared/constants/Colors';
import { useActiveModeSummary } from '@/features/modes/hooks/useActiveModeSummary';
import { haptic } from '@/shared/utils/haptics';
import { swallow } from '@/shared/utils/swallow';
import { splitForFirstDay, interleaveStaged } from '@/features/modes/utils/stagedRollout';
import { useStagedPlanStore } from '@/features/modes/store/useStagedPlanStore';
import { modeRoomLeft } from '@/features/habits/utils/habitLimit';

interface Props {
  mode: TurkishMode;
  onDismiss: () => void;
  showSheetImmediately?: boolean;
  onApplied?: (habitIds: string[], taskIds: number[], meta?: { templateId?: string; dailyMinutes?: number }) => void;
  onSheetClose?: () => void;
  /** Kurulum ekranı soruları sordu: burada ikinci kez sorulmaz, plan görünmeden uygulanır (bkz. SetupShell). */
  headless?: boolean;
  onHeadlessDone?: () => void;
  planApplied?: boolean;
  planHabitIds?: string[];
  planTaskIds?: number[];
  onClearPlan?: (preserveMeta?: boolean) => void;
  defaultTemplateId?: string;
  activeSlot?: string;
}


export const TurkishModeBanner: React.FC<Props> = ({
  mode, onDismiss, showSheetImmediately, onApplied, onSheetClose,
  planApplied, planHabitIds = [], planTaskIds = [], onClearPlan,
  defaultTemplateId, activeSlot, headless, onHeadlessDone,
}) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { habits, addHabit, getStreak } = useHabitStore();
  const { tasks, addTask } = useTaskStore();
  const setDailyGoal = useFocusStore(s => s.setDailyGoal);
  const ramazanStatus = useMemo(() => ramadanStatusNow(), []);
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
    const hasItems = habits.some(h => planHabitIds.includes(h.id)) || tasks.some(t => planTaskIds.includes(t.id));
    const reallyApplied = !!planApplied && hasItems;
    if (reallyApplied || !mode.templates?.length) return 'review';
    if (defaultTemplateId && mode.templates?.some(t => t.id === defaultTemplateId)) return 'review';
    return 'template';
  });

  // Custom plan state
  const [customHabits, setCustomHabits] = useState<DraftHabit[]>([]);
  const [customTasks,  setCustomTasks]  = useState<DraftTask[]>([]);
  const [customAiText, setCustomAiText] = useState('');
  const [customGoal,   setCustomGoal]   = useState(60);

  const seasonal = usePrefsStore(s => s.seasonal);
  const { runAdaptations: runPlanAdaptations } = usePlanAdaptations();
  const { show: showToast } = useToastStore();

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

  const keyboardHeight = useKeyboardHeight();
  const { panResponder, animatedStyle, prepare: prepareSheet, slideIn } = useSwipeToDismiss({
    onDismiss: () => setSheetVisible(false),
  });

  const hasTemplates = (mode.templates?.length ?? 0) > 0;
  const activeHabits = selectedTemplate?.habits ?? mode.habits;
  const activeTasks = selectedTemplate?.tasks ?? mode.tasks;

  const existingHabitNames = new Set(habits.map(h => h.name.toLowerCase()));
  const existingTaskTitles = new Set(tasks.map(t => t.title.toLowerCase()));

  const newHabits = activeHabits.filter(h => !existingHabitNames.has(h.name.toLowerCase()));
  const newTasksRaw = activeTasks.filter(t =>
    !existingTaskTitles.has(t.titleTr.toLowerCase()) &&
    !existingTaskTitles.has(t.titleEn.toLowerCase())
  );
  // Gelecek-tarihli (daysFromNow > 1) görevler artık günlük plan motoru tarafından üretiliyor;
  // plan uygulanırken materyalize edilmez. Yalnızca setup görevleri + kilo zincirini başlatan
  // tek bir weight_entry görevi gerçekten oluşturulur. Sayım/buton/uygula hepsi bunu yansıtır.
  let keptWeightEntry = false;
  const newTasks = newTasksRaw.filter(t => {
    const isFar = t.daysFromNow !== undefined && t.daysFromNow > 1;
    if (!isFar) return true;
    if (t.tags?.includes('weight_entry') && !keptWeightEntry) { keptWeightEntry = true; return true; }
    return false;
  });
  const allDone = newHabits.length === 0 && newTasks.length === 0;

  // Plan view data — active habits/tasks from this plan
  const todayKey = fmtDateKey();
  // İstatistik yalnız aktiflerden; "zaten eklendi mi" denetimi (yukarıda) TÜM listeyle.
  const planHabits = useMemo(
    () => habits.filter(h => planHabitIds.includes(h.id) && !h.pausedAt),
    [habits, planHabitIds]
  );
  const planTasks = useMemo(
    () => tasks.filter(t => planTaskIds.includes(t.id)),
    [tasks, planTaskIds]
  );

  // GERÇEK uygulanmış durum: id'ler var AMA karşılık gelen öğeler de mevcut.
  // Stale id (öğeler silinmiş) → uygulanmamış say → oluşturma/şablon akışı açılır.
  const effectiveApplied = !!planApplied && (planHabits.length + planTasks.length > 0);

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

  const bestStreak = planHabitStats.length > 0 ? Math.max(...planHabitStats.map(h => h.streak)) : 0;
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

  const applyingRef = React.useRef(false);
  const applyAll = async () => {
    /*
      REF KİLİDİ — `applying` state'i tek başına yetmiyordu. React'ın `setApplying(true)`
      güncellemesi commit edilmeden önce aynı tık/dokunuşun İKİ olayı JS thread'inde art
      arda işlenirse, ikisi de hâlâ `applying === false` okuyup kapıdan geçebiliyordu
      (hızlı çift dokunuş). Sonuç: alışkanlık/görev oluşturma döngüsü İKİ KEZ çalışıyordu.
      Ref senkron ve anında güncellendiği için bu yarışı kapatır; state yine arayüzün
      (buton devre dışı görünümü) kaynağı.
    */
    if (applyingRef.current || applying || allDone) return;
    applyingRef.current = true;
    setApplying(true);
    haptic.success();
    
    // Temiz bir sayfa açmak ve eski (çifte) hedefleri önlemek için önceki planı sil:
    onClearPlan?.(true);

    if (selectedTemplate?.dailyGoalMinutes) setDailyGoal(selectedTemplate.dailyGoalMinutes);

    /*
      KADEMELİ AÇILIM (madde 4): ilk gün 1 alışkanlık + en önemli görev; kalanlar sıraya
      girer ve ilerledikçe günde birer açılır (bkz. stagedRollout). Kilo girişi zinciri ve
      Ramazan öncesi tarihli görevler kendi akışlarında — sıraya girmez.
    */
    const isRamazanPreStart = mode.type === 'ramazan' && !isRamazanActive;
    const staged = splitForFirstDay(newHabits.filter(h => !deselectedHabits.has(h.name)), newTasks,
      { pinned: (t) => isRamazanPreStart || !!t.tags?.includes('weight_entry') });
    // Alışkanlık sınırı (madde 6): yer yoksa ilk günün alışkanlığı da sıraya girer.
    const room = modeRoomLeft(useHabitStore.getState().habits, mode.type);
    const habitsNow = staged.habitsNow.slice(0, room);
    const habitsWaiting = [...staged.habitsNow.slice(room), ...staged.habitsLater];
    const addedHabitIds: string[] = [];
    for (const h of habitsNow) {
      const hid = `habit_${mode.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const habitName = tr ? h.nameTr : h.name;
      addHabit(habitName, h.emoji, h.color, hid, mode.type, h.nameTr, h.name);
      addedHabitIds.push(hid);
    }

    // Smart scheduling: tasks drip in over multiple days, not all at once
    // High priority → today, Medium → +1/+2/... days, Low → +4 days, weight_entry → +7 days
    const localDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const today = new Date();
    let mediumOffset = 1;
    const dayOffset = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return localDateStr(d);
    };

    // Ramazan tasks created before Ramazan starts get the start date as dueDate
    const ramazanStartDate = mode.type === 'ramazan' && !isRamazanActive
      ? (ramazanStatus.period?.start ?? undefined)
      : undefined;

    const getTaskDueDate = (task: ModeTask): string | undefined => {
      if (ramazanStartDate) return ramazanStartDate;
      // weight_entry zinciri WeightEntryModal/saveWeightEntry tarafından sürdürülür — ilk görevi +7'ye sabitle
      if (task.tags?.includes('weight_entry')) return dayOffset(7);
      // Template'in belirlediği gün offseti varsa onu kullan (bugün/yarınki setup görevleri)
      if (task.daysFromNow !== undefined) return dayOffset(task.daysFromNow);
      // Fallback: priority bazlı sıralama
      if (task.priority === 'High') return dayOffset(0);
      if (task.priority === 'Medium') return dayOffset(mediumOffset++);
      return dayOffset(4); // Low
    };

    const getTaskPrefix = (): string => {
      const modeType = mode.type as string;
      if (modeType === 'exam') {
        const slot = activeSlot ?? 'exam';
        const nameMap: Record<string, string | null> = {
          exam: seasonal.examName,
          exam2: seasonal.exam2Name,
          exam3: seasonal.exam3Name,
        };
        const name = nameMap[slot] || seasonal.examName;
        if (name?.trim()) return name.trim();
      }
      if (modeType === 'tez') {
        if (seasonal.tezName?.trim()) return seasonal.tezName.trim();
      }
      if (modeType === 'mulakat') {
        const slot = activeSlot ?? 'mulakat';
        const nameMap: Record<string, string | null> = {
          mulakat: seasonal.mulakatName,
          mulakat2: seasonal.mulakat2Name,
          mulakat3: seasonal.mulakat3Name,
        };
        const name = nameMap[slot] || seasonal.mulakatName;
        if (name?.trim()) return name.trim();
      }
      if (modeType === 'spor') {
        const slot = activeSlot ?? 'spor';
        const nameMap: Record<string, string | null> = {
          spor: seasonal.sporGoal,
          spor2: seasonal.spor2Goal,
          spor3: seasonal.spor3Goal,
        };
        const name = nameMap[slot] || seasonal.sporGoal;
        if (name?.trim()) return localizeSporGoal(name.trim(), tr) || name.trim();
      }
      const fallback = tr ? mode.labelTr : mode.labelEn;
      return fallback ? fallback.replace(/\s*Hazırlığı$/i, '').trim() : '';
    };

    const taskPrefix = getTaskPrefix();

    const formatWithPrefix = (titleStr: string, prefixStr: string): string => {
      if (!prefixStr || !titleStr) return titleStr;
      const p = prefixStr.trim();
      const t = titleStr.trim();
      const pLower = p.toLowerCase();
      const tLower = t.toLowerCase();

      if (tLower.startsWith(pLower + ':') || tLower.startsWith(pLower + ' -')) {
        const rest = t.slice(p.length + 1).replace(/^[:\s-]+/, '').trim();
        return `${p}: ${rest}`;
      }
      if (tLower.startsWith(pLower + ' ')) {
        const rest = t.slice(p.length).trim();
        return `${p}: ${rest}`;
      }
      return `${p}: ${t}`;
    };

    // newTasks zaten gelecek-tarihli dökümü hariç tutuyor (bkz. tanımı) — doğrudan oluştur.
    const addedTaskIds: number[] = [];
    const visibleTagsMap: Record<string, string> = {
      exam: 'education',
      yks: 'education',
      kpss: 'education',
      tez: 'education',
      mulakat: 'work',
      spor: 'fitness',
      ramazan: 'ramazan',
      tasarruf: 'savings',
      birakma: 'quit'
    };
    const extraVisibleTag = visibleTagsMap[mode.type];

    const planSlot = activeSlot ?? (['exam', 'yks', 'kpss'].includes(mode.type) ? 'exam' : mode.type);
    const tagsFor = (task: ModeTask) => {
      const t = Array.from(new Set([mode.type, activeSlot ?? mode.type, ...(task.tags ?? [])]));
      if (extraVisibleTag && !t.includes(extraVisibleTag)) t.push(extraVisibleTag);
      return t;
    };
    useStagedPlanStore.getState().setQueue(planSlot, interleaveStaged(
      staged.tasksLater.map(task => ({
        titleTr: taskPrefix ? formatWithPrefix(task.titleTr, taskPrefix) : task.titleTr,
        titleEn: taskPrefix ? formatWithPrefix(task.titleEn, taskPrefix) : task.titleEn,
        descTr: task.descTr, descEn: task.descEn, priority: task.priority, tags: tagsFor(task),
      })),
      habitsWaiting.map(h => ({ nameTr: h.nameTr, nameEn: h.name, emoji: h.emoji, color: h.color, modeType: mode.type })),
    ));

    for (const task of staged.tasksNow) {
      let taskTitleTr = task.titleTr;
      let taskTitleEn = task.titleEn;

      if (taskPrefix) {
        taskTitleTr = formatWithPrefix(taskTitleTr, taskPrefix);
        taskTitleEn = formatWithPrefix(taskTitleEn, taskPrefix);
      }

      const title = tr ? taskTitleTr : taskTitleEn;
      const dueDate = getTaskDueDate(task);
      const description = JSON.stringify({ 
        tr: taskTitleTr, 
        en: taskTitleEn,
        ...(task.descTr && { descTr: task.descTr }),
        ...(task.descEn && { descEn: task.descEn }),
      });
      
      const translatedTags = tagsFor(task).map(tag => translateTag(tag, tr ? 'tr' : 'en'));

      try {
        const created = await TaskService.createTask({
          title, description, priority: task.priority,
          isCompleted: false, tags: translatedTags, subtasks: [],
          ...(dueDate && { dueDate }),
        } as any);
        addTask({ ...created, title, titleTr: taskTitleTr, titleEn: taskTitleEn } as any);
        addedTaskIds.push(created.id);
      } catch {
        const localId = Math.floor(Date.now() + Math.random() * 1000);
        addTask({
          id: localId, title, description, priority: task.priority,
          isCompleted: false, tags: translatedTags, subtasks: [],
          ...(dueDate && { dueDate }),
          titleTr: taskTitleTr, titleEn: taskTitleEn,
        } as any);
        addedTaskIds.push(localId);
      }
    }

    onApplied?.(addedHabitIds, addedTaskIds, {
      templateId: selectedTemplate?.id,
      dailyMinutes: selectedTemplate?.dailyGoalMinutes,
    });
    setApplying(false);
    applyingRef.current = false;
    appliedRef.current = true;
    setApplied(true);
    if (headless) onHeadlessDone?.();
  };

  const headlessStarted = React.useRef(false);
  useEffect(() => {
    if (!headless || headlessStarted.current) return;
    const wanted = defaultTemplateId ? mode.templates?.find(t => t.id === defaultTemplateId) : null;
    if (wanted && selectedTemplate?.id !== wanted.id) { setSelectedTemplate(wanted); return; }
    headlessStarted.current = true;
    if (allDone) { onApplied?.([], [], { templateId: selectedTemplate?.id, dailyMinutes: selectedTemplate?.dailyGoalMinutes }); onHeadlessDone?.(); return; }
    void applyAll();
  }, [headless, selectedTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mod vurgu paleti Colors.ts'te (ModeAccents) — eskiden burada ve modlar.tsx'te
  // ayrı ayrı elle yazılıydı, yani iki kopya vardı ve hiçbiri tanımlı değildi.
  const modeAccent = resolveModeAccent(mode.type, isDark);
  /*
    Koyu temada aksan pastele dönüyor; üstünde SABİT beyaz yazı 1.4:1 kalıyordu —
    yani "Planı Başlat" düğmesi okunmuyordu (bkz. modeAccentOn).
  */
  const onAccent = modeAccentOn(isDark, modeAccent);
  // Kurulum anında söylenecek MEVCUT yük — tek kaynaktan (bkz. useActiveModeSummary).
  const activeLoad = useActiveModeSummary();

  /* Kutu yok: planın ne yaptığı tek cümle (2026-11-05, kullanıcı: "daha minimalist, daha kaliteli"). */
  const renderAlgorithmInfo = () => {
    const desc = PLAN_PURPOSE[(mode.type === 'yks' || mode.type === 'kpss' ? 'exam' : mode.type) as PlanType];
    if (!desc) return null;
    return <Text style={[styles.planLine, { color: theme.onSurfaceVariant }]}>{tr ? desc.tr : desc.en}</Text>;
  };

  const selectTemplate = (tpl: StudyTemplate) => {
    haptic.surface();
    setSelectedTemplate(tpl);
    setDeselectedHabits(new Set());
    setApplied(false);
    appliedRef.current = false;
    setStep('review');
  };

  // ── Custom Plan Step ──
  const renderCustomStep = () => {
    // Yalnız DOLU öğeleri say (boş satırlar "3 öğe" gibi yanıltmasın).
    const totalItems = customHabits.filter(h => h.nameTr.trim()).length + customTasks.filter(t => t.titleTr.trim()).length;
    const canProceed = customHabits.some(h => h.nameTr.trim()) || customTasks.some(t => t.titleTr.trim());

    const cycleEmoji = (idx: number) => {
      setCustomHabits(prev => {
        const next = [...prev];
        const cur = QUICK_EMOJIS.indexOf(next[idx].emoji);
        next[idx] = { ...next[idx], emoji: QUICK_EMOJIS[(cur + 1) % QUICK_EMOJIS.length] };
        return next;
      });
    };


    const suggest = () => {
      const toast = useToastStore.getState().show;
      if (!customAiText.trim()) {
        toast(tr ? 'Önce planını birkaç cümleyle yaz' : 'Describe your plan first', 'info');
        return;
      }
      // Tek ayrıştırıcı (capture) — eski planExtractor kelime içinde arıyordu (bkz. customPlanDraft).
      const { habits: hs, tasks: ts } = draftsFromText(customAiText, langOf(language));
      if (hs.length) setCustomHabits(prev => [...prev, ...hs].slice(0, 5));
      if (ts.length) setCustomTasks(prev => [...prev, ...ts].slice(0, 7));
      if (hs.length + ts.length > 0) {
        haptic.success();
        // Net geri bildirim: kaç öğe eklendi → "çalışıyor mu" belirsizliği biter.
        toast(tr ? `${hs.length} alışkanlık · ${ts.length} görev eklendi` : `${hs.length} habits · ${ts.length} tasks added`, 'success');
      } else {
        toast(tr ? 'Bundan öneri çıkaramadık — aşağıdan elle ekleyebilirsin' : "Couldn't extract — add manually below", 'info');
      }
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
          <Touchable
            onPress={() => { haptic.select(); setStep('template'); }}
            accessibilityRole="button"
            accessibilityLabel={tr ? 'Geri' : 'Back'}
            style={{ marginRight: S.sm, padding: S.xs }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={ICON.md} color={theme.onSurfaceVariant} />
          </Touchable>
          {<Sparkles size={ICON.lg} color={modeAccent} />}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>
              {tr ? 'Kendi Planını Oluştur' : 'Build Your Own Plan'}
            </Text>
            <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
              {tr ? 'Alışkanlık ve görevleri kendin belirle' : 'Set your own habits & tasks'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.sm }}>
          {/* AI text suggest */}
          <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, padding: S.md, marginBottom: S.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
            <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, marginBottom: S.xs }}>
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
            <Touchable accessibilityRole="button"
              onPress={suggest}
              style={{ alignSelf: 'flex-end', backgroundColor: modeAccent, borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.xs + 1, marginTop: S.xs }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: F.caption, fontWeight: '500' }}>{tr ? 'Öner' : 'Suggest'}</Text>
            </Touchable>
          </View>

          {/* Habits */}
          <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant, marginBottom: S.sm }]}>
            {tr ? 'ALIŞKANLIKLAR' : 'HABITS'}
          </Text>
          {customHabits.map((h, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.xs + 1 }}>
              <Touchable
                onPress={() => cycleEmoji(idx)}
                accessibilityRole="button"
                accessibilityLabel={tr ? 'Simgeyi değiştir' : 'Change icon'}
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                style={{ width: 34, height: 34, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: modeAccent + '20', borderWidth: B.thin, borderColor: modeAccent + '40' }}
                activeOpacity={0.7}
              >
                {renderModeEmojiIcon(h.emoji, 16, modeAccent)}
              </Touchable>
              <TextInput
                value={h.nameTr}
                onChangeText={v => setCustomHabits(prev => { const n = [...prev]; n[idx] = { ...n[idx], nameTr: v, name: v }; return n; })}
                placeholder={tr ? 'Alışkanlık adı...' : 'Habit name...'}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'}
                style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '500', height: 34, paddingVertical: 0, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
                returnKeyType="next"
                underlineColorAndroid="transparent"
              />
              {/* Renk seçimi yok: mod alışkanlığı modunun rengini taşır (bkz. features/habits/utils/habitColor). */}
              <Touchable accessibilityRole="button" accessibilityLabel={tr ? 'Alışkanlığı kaldır' : 'Remove habit'} onPress={() => setCustomHabits(prev => prev.filter((_, i) => i !== idx))} style={{ padding: S.xs }} activeOpacity={0.7}>
                <X size={ICON.sm} color={theme.onSurfaceVariant} />
              </Touchable>
            </View>
          ))}
          {customHabits.length < 5 && (
            <Touchable accessibilityRole="button"
              onPress={() => setCustomHabits(prev => [...prev, { name: '', nameTr: '', emoji: QUICK_EMOJIS[prev.length % QUICK_EMOJIS.length], color: QUICK_COLORS[prev.length % QUICK_COLORS.length] }])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: S.sm }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: modeAccent, lineHeight: 22 }}>+</Text>
              <Text style={{ fontSize: F.caption, fontWeight: '600', color: modeAccent }}>{tr ? 'Alışkanlık Ekle' : 'Add Habit'}</Text>
            </Touchable>
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
                  style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '500', height: 34, paddingVertical: 0, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}
                  returnKeyType="next"
                  underlineColorAndroid="transparent"
                />
                <Touchable accessibilityRole="button" accessibilityLabel={tr ? 'Görevi kaldır' : 'Remove task'} onPress={() => setCustomTasks(prev => prev.filter((_, i) => i !== idx))} style={{ padding: S.xs }} activeOpacity={0.7}>
                  <X size={ICON.sm} color={theme.onSurfaceVariant} />
                </Touchable>
              </View>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {(['High', 'Medium', 'Low'] as const).map(p => {
                  const pColor = p === 'High' ? '#EF4444' : p === 'Medium' ? '#F59E0B' : (theme.onSurfaceVariant as string);
                  const pLabel = tr ? (p === 'High' ? 'Yüksek' : p === 'Medium' ? 'Orta' : 'Düşük') : p;
                  return (
                    <Touchable accessibilityRole="button"
                      key={p}
                      onPress={() => { haptic.select(); setCustomTasks(prev => { const n = [...prev]; n[idx] = { ...n[idx], priority: p }; return n; }); }}
                      style={{ paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.sm, backgroundColor: t.priority === p ? pColor + '20' : 'transparent', borderWidth: B.thin, borderColor: t.priority === p ? pColor + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '500', color: t.priority === p ? pColor : theme.onSurfaceVariant }}>{pLabel}</Text>
                    </Touchable>
                  );
                })}
              </View>
            </View>
          ))}
          {customTasks.length < 7 && (
            <Touchable accessibilityRole="button"
              onPress={() => setCustomTasks(prev => [...prev, { titleTr: '', titleEn: '', priority: 'Medium' }])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: S.sm }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: modeAccent, lineHeight: 22 }}>+</Text>
              <Text style={{ fontSize: F.caption, fontWeight: '600', color: modeAccent }}>{tr ? 'Görev Ekle' : 'Add Task'}</Text>
            </Touchable>
          )}

          {/* Daily goal picker */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.sm, paddingTop: S.sm, borderTopWidth: HAIRLINE, borderTopColor: theme.separator }}>
            <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, flex: 1 }}>
              {tr ? 'Günlük odak' : 'Daily focus'}
            </Text>
            {[30, 45, 60, 90, 120].map(m => (
              <Touchable accessibilityRole="button"
                key={m}
                onPress={() => setCustomGoal(m)}
                style={{ paddingHorizontal: S.xs + 2, paddingVertical: S.xs, borderRadius: R.sm, backgroundColor: customGoal === m ? modeAccent + '20' : 'transparent', borderWidth: B.thin, borderColor: customGoal === m ? modeAccent + '60' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 10, fontWeight: '500', color: customGoal === m ? modeAccent : theme.onSurfaceVariant }}>{m}dk</Text>
              </Touchable>
            ))}
          </View>
        </ScrollView>

        <Touchable accessibilityRole="button"
          onPress={canProceed ? proceed : undefined}
          activeOpacity={canProceed ? 0.85 : 1}
          style={[styles.applyBtn, { backgroundColor: canProceed ? modeAccent : theme.surfaceContainerHigh, opacity: canProceed ? 1 : 0.5, marginTop: S.lg }]}
        >
          <Zap size={ICON.sm} color={canProceed ? '#fff' : (theme.onSurfaceVariant as string)} strokeWidth={2.5} />
          <Text style={[styles.applyBtnText, { color: canProceed ? '#fff' : theme.onSurfaceVariant }]}>
            {tr ? `Devam Et${totalItems > 0 ? ` (${totalItems} öğe)` : ''}` : `Continue${totalItems > 0 ? ` (${totalItems} items)` : ''}`}
          </Text>
        </Touchable>
      </>
    );
  };

  // ── Plan View (when plan already applied) ──
  /* Plan başlamışsa yönetimi Planım'da (bkz. app/plan.tsx): tek giriş, burada ikinci bir görünüm yok. */
  const renderPlanView = () => (
    <View style={{ gap: S.md }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>{tr ? mode.labelTr : mode.labelEn}</Text>
      {renderAlgorithmInfo()}
      <Touchable accessibilityRole="link" onPress={() => { setSheetVisible(false); require('expo-router').router.push({ pathname: '/plan', params: { slot: activeSlot ?? mode.type } }); }} style={[styles.applyBtn, { backgroundColor: modeAccent }]}>
        <Text style={[styles.applyBtnText, { color: onAccent }]}>{tr ? 'Planıma git' : 'Go to my plan'}</Text>
      </Touchable>
    </View>
  );

  if (headless) return null;

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
            {renderModeEmojiIcon(mode.emoji, 22, modeAccent)}
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
            <Touchable accessibilityRole="button"
              onPress={openSheet}
              style={[styles.planBtn, { backgroundColor: planApplied ? modeAccent : modeAccent }]}
              activeOpacity={0.8}
            >
              {planApplied && <View style={{ width: 6, height: 6, borderRadius: R.full, backgroundColor: '#fff', opacity: 0.85, marginRight: S.xxs }} />}
              <Text style={styles.planBtnText}>
                {planApplied ? (tr ? 'Planı Gör' : 'View Plan') : (tr ? 'Planı Seç' : 'Pick Plan')}
              </Text>
              <ChevronRight size={ICON.xs} color="#fff" />
            </Touchable>
            <Touchable accessibilityRole="button" accessibilityLabel={tr ? 'Bildirimi kapat' : 'Dismiss'} onPress={onDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={ICON.sm} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)'} />
            </Touchable>
          </View>
        </MotiView>
      )}

      <Modal supportedOrientations={['portrait', 'landscape']} visible={sheetVisible} transparent animationType="none" onRequestClose={() => setSheetVisible(false)} onShow={() => slideIn()}>
        <View style={{ flex: 1, backgroundColor: SCRIM, justifyContent: 'flex-end' }}>
          {/* Sayfanın arka planı — ekran okuyucuda adsız bir kontrol olarak belirmesin. */}
          <Touchable accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSheetVisible(false)} />
          <Animated.View
            style={[
              animatedStyle,
              styles.sheet,
              {
                borderColor: theme.outlineVariant,
                maxHeight: sheetMaxHeight(screenHeight, insets.top),
                paddingBottom: Math.max(insets.bottom, S.lg) + S.md,
                /*
                  KLAVYE PAYI. Bu sayfa alta yapisik (`justifyContent: 'flex-end'`) ve
                  icinde dort metin girisi var (plan anlatimi, hedef, tarih, kilo).
                  iOS'ta klavye acilinca sayfa OLDUGU YERDE kaliyordu; kullanici
                  yazdigini goremiyordu.

                  Android'de deger UYGULANMIYOR cunku uygulama
                  `softwareKeyboardLayoutMode: "resize"` ile calisiyor (bkz. app.json):
                  pencere zaten kuculuyor, ikinci kez itmek sayfayi ekrandan tasirirdi.
                */
                marginBottom: keyboardHeight,
              },
            ]}
          >
            <GlassSurface corners="top" />
            <View {...panResponder.panHandlers} style={styles.dragHandle}>
              <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            </View>

            {/* Plan already applied (gerçek öğelerle) → show smart plan view */}
            {effectiveApplied && renderPlanView()}

            {/* Plan not applied → template selection or review to add */}
            {!effectiveApplied && step === 'template' && hasTemplates && (
              <>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>
                      {tr ? 'Çalışma Planı Seç' : 'Choose a Study Plan'}
                    </Text>
                    <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
                      {(tr ? mode.tipTr : mode.tipEn) || (tr ? 'Sana uygun seviyeyi seç, gerisini biz ayarlarız.' : 'Pick the level that fits you. We set up the rest.')}
                    </Text>
                  </View>
                </View>
                <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.sm, gap: S.sm }}>
                  {mode.templates!.map((tpl, i) => {
                    const isRecommended = defaultTemplateId === tpl.id;
                    return (
                      <MotiView key={tpl.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 50 }}>
                        <Touchable accessibilityRole="button" onPress={() => selectTemplate(tpl)} activeOpacity={0.75}
                          style={[styles.templateCard, { backgroundColor: isRecommended ? modeAccent + '10' : theme.surfaceContainerLow, borderColor: isRecommended ? modeAccent : 'transparent' }]}>
                          {renderModeEmojiIcon(tpl.emoji, 20, modeAccent)}
                          <View style={{ flex: 1, gap: S.xxs }}>
                            <Text numberOfLines={1} style={[styles.templateTitle, { color: theme.onSurface }]}>{tr ? tpl.titleTr : tpl.titleEn}</Text>
                            <Text numberOfLines={2} style={[styles.templateDesc, { color: theme.onSurfaceMuted }]}>{tr ? tpl.descTr : tpl.descEn}</Text>
                            {isRecommended && <Text style={{ fontSize: F.caption, fontWeight: '600', color: modeAccent }}>{tr ? 'Sana önerilen' : 'Recommended for you'}</Text>}
                          </View>
                          <Text style={[styles.templateMin, { color: theme.onSurfaceVariant }]}>{tpl.dailyGoalMinutes} {tr ? 'dk' : 'min'}</Text>
                          <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
                        </Touchable>
                      </MotiView>
                    );
                  })}
                  <Touchable accessibilityRole="button" onPress={() => { haptic.select(); setStep('custom'); }} activeOpacity={0.75} style={styles.customLink}>
                    <Pencil size={ICON.sm} color={theme.onSurfaceVariant} />
                    <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: '600', color: theme.onSurfaceVariant }}>{tr ? 'Kendi planını oluştur' : 'Build your own plan'}</Text>
                    <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
                  </Touchable>
                </ScrollView>
              </>
            )}

            {!effectiveApplied && step === 'custom' && renderCustomStep()}

            {!effectiveApplied && step === 'review' && (
              <>
                <View style={styles.sheetHeader}>
                  {hasTemplates && (
                    <Touchable
                      accessibilityRole="button"
                      accessibilityLabel={tr ? 'Geri' : 'Back'}
                      onPress={() => { haptic.select(); setStep('template'); setSelectedTemplate(null); }}
                      style={{ marginRight: S.sm, padding: S.xs }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ArrowLeft size={ICON.md} color={theme.onSurfaceVariant} />
                    </Touchable>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.sheetTitle, { color: theme.onSurface }]}>
                      {selectedTemplate ? (tr ? selectedTemplate.titleTr : selectedTemplate.titleEn) : (tr ? mode.labelTr : mode.labelEn)}
                    </Text>
                    <Text style={[styles.sheetSub, { color: theme.onSurfaceVariant }]}>
                      {selectedTemplate ? `${selectedTemplate.dailyGoalMinutes} ${tr ? 'dk/gün hedef' : 'min/day goal'}` : (tr ? mode.subtitleTr : mode.subtitleEn)}
                    </Text>
                  </View>
                </View>
                {renderAlgorithmInfo()}
                <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.sm }}>
                  {activeHabits.length > 0 && <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted }]}>{tr ? 'Her gün' : 'Every day'}</Text>}
                  {activeHabits.map((h, i) => {
                    const exists = existingHabitNames.has(h.name.toLowerCase());
                    const skipped = !exists && deselectedHabits.has(h.name);
                    const on = exists || !skipped;
                    return (
                      <MotiView key={h.name} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 45 }}>
                        <Touchable accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: exists }}
                          onPress={() => {
                            if (exists) return;
                            haptic.select();
                            setDeselectedHabits(prev => {
                              const next = new Set(prev);
                              if (next.has(h.name)) next.delete(h.name);
                              else next.add(h.name);
                              return next;
                            });
                          }}
                          style={styles.itemRow}
                          activeOpacity={exists ? 1 : 0.7}
                        >
                          {renderModeEmojiIcon(h.emoji, 20, on ? modeAccent : theme.onSurfaceMuted)}
                          <Text style={[styles.itemText, { color: on ? theme.onSurface : theme.onSurfaceMuted, flex: 1 }]}>{tr ? h.nameTr : h.name}</Text>
                          <MotiView animate={{ scale: on ? 1 : 0.85, backgroundColor: on ? (exists ? theme.onSurfaceMuted : modeAccent) : 'transparent', borderColor: on ? 'transparent' : theme.outlineVariant }} transition={{ type: 'timing', duration: 160 }} style={styles.checkDot}>
                            {on && <Check size={ICON.xs} color={onAccent} strokeWidth={3} />}
                          </MotiView>
                        </Touchable>
                      </MotiView>
                    );
                  })}
                  {activeTasks.length > 0 && <Text style={[styles.sectionLabel, { color: theme.onSurfaceMuted, marginTop: S.md }]}>{tr ? 'Başlarken' : 'To begin'}</Text>}
                  {activeTasks.map((task, i) => {
                    const title = tr ? task.titleTr : task.titleEn;
                    const exists = existingTaskTitles.has(task.titleTr.toLowerCase()) || existingTaskTitles.has(task.titleEn.toLowerCase());
                    return (
                      <MotiView key={title} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: exists ? 0.45 : 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: (activeHabits.length + i) * 45 }} style={styles.itemRow}>
                        <View style={[styles.priorityDot, { backgroundColor: modeAccent }]} />
                        <Text style={[styles.itemText, { color: theme.onSurface, flex: 1, fontSize: F.footnote }]}>{title}</Text>
                        {exists && <Check size={ICON.sm} color={theme.tertiary} strokeWidth={2.5} />}
                      </MotiView>
                    );
                  })}
                </ScrollView>
                {/*
                  MEVCUT YÜK, BAŞLATMADAN ÖNCE SÖYLENİR.

                  Kullanıcı toplam yükü ancak plan uygulandıktan SONRA öğreniyordu: aynı
                  anda on ikiye kadar plan kurulabiliyor ve her kart yalnız KENDİ yükünü
                  yazıyordu. İkinci, üçüncü hedefi açan kişi için görev listesi beklenmedik
                  şekilde şişiyordu. Burada eklenecek öğe sayısı zaten düğmenin üstünde
                  yazıyor; eksik olan, ÜSTÜNE ekleneceği mevcut yüktü.

                  Hiç aktif plan yoksa satır çizilmez — uyaracak bir şey yok.
                */}
                {!applied && activeLoad.activeCount > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.xs, marginBottom: S.sm }}>
                    <Layers size={ICON.xs} color={theme.onSurfaceVariant} />
                    <Text style={{ flex: 1, fontSize: F.caption, color: theme.onSurfaceVariant, fontWeight: '500' }}>
                      {(tr ? LOAD_HINT.tr : LOAD_HINT.en)(activeLoad.activeCount, activeLoad.todayTotalAll)}
                    </Text>
                  </View>
                )}
                {!applied && !allDone && (() => {
                  const sp = splitForFirstDay(newHabits.filter(h => !deselectedHabits.has(h.name)), newTasks, { pinned: (t) => !!t.tags?.includes('weight_entry') });
                  const later = sp.habitsLater.length + sp.tasksLater.length;
                  const full = modeRoomLeft(habits, mode.type) === 0 && sp.habitsNow.length > 0;
                  return later > 0 || full ? (
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, paddingHorizontal: S.xs, marginBottom: S.sm }}>
                      {(tr ? STAGED_HINT.tr : STAGED_HINT.en)(sp.habitsNow.length + sp.tasksNow.length, later)}
                      {full ? ` ${(tr ? STAGED_HINT.fullTr : STAGED_HINT.fullEn)}` : ''}
                    </Text>
                  ) : null;
                })()}
                <MotiView animate={{ scale: applied ? 1.02 : 1 }} transition={{ type: 'spring', damping: 14, stiffness: 220 }}>
                  <Touchable accessibilityRole="button"
                    onPress={applied ? () => setSheetVisible(false) : applyAll}
                    activeOpacity={0.85}
                    disabled={applying || allDone}
                    style={[styles.applyBtn, { backgroundColor: applied ? theme.tertiary : allDone ? theme.surfaceContainerHigh : modeAccent, opacity: applying ? 0.7 : 1 }]}
                  >
                    {applying ? (
                      <ActivityIndicator color={onAccent} size="small" />
                    ) : applied ? (
                      <><Check size={ICON.sm} color={onAccent} strokeWidth={2.5} /><Text style={[styles.applyBtnText, { color: onAccent }]}>{tr ? 'Başladı' : 'Started'}</Text></>
                    ) : allDone ? (
                      <Text style={[styles.applyBtnText, { color: theme.onSurfaceVariant }]}>{tr ? 'Tümü zaten mevcut' : 'All already added'}</Text>
                    ) : (
                      <Text style={[styles.applyBtnText, { color: onAccent }]}>{tr ? 'Planı Başlat' : 'Start Plan'}</Text>
                    )}
                  </Touchable>
                </MotiView>
              </>
            )}
          </Animated.View>
        </View>
        <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
      </Modal>
    </>
  );
};

/** Kurulum anındaki mevcut yük cümlesi — iki dil yan yana (satır içi dallanma yok). */
const LOAD_HINT = {
  tr: (goals: number, today: number) => `Şu an ${goals} aktif hedefin var · bugün ${today} plan işi`,
  en: (goals: number, today: number) => `You have ${goals} active goals · ${today} plan tasks today`,
};
// Kademeli açılım başlamadan söylenir: "7 öğe" görüp ilk gün 2 bulan kullanıcı şaşırmasın.
const STAGED_HINT = {
  tr: (now: number, later: number) => `Bugün ${now} öğeyle başlarsın; kalan ${later} öğe, ilerledikçe günde bir açılır.`,
  en: (now: number, later: number) => `You start with ${now} today; the other ${later} unlock one a day as you make progress.`,
  // Sınır dolu (madde 6): alışkanlıklar yer açılınca eklenir.
  fullTr: 'Alışkanlık sınırın (7) dolu: bu modun alışkanlıkları sen birini dinlendirince eklenir.',
  fullEn: 'Your habit limit (7) is full: this mode\'s habits are added once you rest one.',
};

const STREAK_HOT = '#FF6B35'; // seri vurgusu — mod rengine değil seriye ait
const styles = StyleSheet.create({
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: S.xxs },
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: R.lg, borderWidth: B.thin,
    paddingVertical: S.sm + 2, paddingHorizontal: S.md, marginBottom: S.md,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flex: 1 },
  bannerEmoji: { fontSize: F.title },
  bannerTitle: { fontSize: F.body, fontWeight: '600' },
  bannerSub: { fontSize: F.caption, fontWeight: '500', marginTop: S.xxs },
  bannerRight: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  planBtn: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.sm + 2, paddingVertical: S.xs + 1, borderRadius: R.full },
  planBtnText: { color: '#fff', fontSize: F.caption, fontWeight: '500' },
  dismissBtn: { padding: S.xxs },
  sheet: { borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, borderWidth: B.thin, paddingHorizontal: S.lg },
  dragHandle: { paddingTop: S.smd, paddingBottom: S.sm, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: R.xs },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg },
  sheetEmoji: { fontSize: 36 },
  sheetTitle: { fontSize: F.title, fontWeight: '500' },
  sheetSub: { fontSize: F.caption, fontWeight: '500', marginTop: S.xxs },
  // Progress summary
  progressRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: R.md,
    borderWidth: B.thin, marginBottom: S.lg, paddingVertical: S.md,
  },
  progressStat: { flex: 1, alignItems: 'center', gap: S.xxs },
  progressNum: { fontSize: F.title, fontWeight: '600' },
  progressLabel: { fontSize: F.caption, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },
  progressDivider: { width: 1, height: 32 },
  // Plan view rows
  planViewRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    borderRadius: R.md, borderWidth: B.thin, padding: S.sm + 2, marginBottom: S.xs + 1,
  },
  planViewName: { fontSize: F.body, fontWeight: '500' },
  habitIconSm: { width: 32, height: 32, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  habitMeta: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs },
  weekDots: { flexDirection: 'row', gap: S.xs },
  dot: { width: 6, height: 6, borderRadius: R.full },
  streakText: { fontSize: F.caption, fontWeight: '600' },
  doneBadge: { width: 26, height: 26, borderRadius: R.full, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  priorityChip: { borderRadius: R.sm, paddingHorizontal: S.xs + 1, paddingVertical: S.xxs },
  priorityChipText: { fontSize: F.caption, fontWeight: '600', letterSpacing: 0.3 },
  emptyPlan: { alignItems: 'center', paddingVertical: S.xl },
  emptyPlanText: { fontSize: F.body, textAlign: 'center' },
  // Plan view actions
  planViewActions: { gap: S.sm, marginTop: S.lg },
  updateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.full, paddingVertical: S.md },
  updateBtnText: { color: '#fff', fontSize: F.body, fontWeight: '500' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin },
  clearBtnText: { fontSize: F.caption, fontWeight: '600' },
  // Templates
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: S.smd, borderRadius: R.md, borderWidth: B.thin, padding: S.md },
  templateTop: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  templateEmoji: { fontSize: 26, lineHeight: 32 },
  templateTitle: { fontSize: F.body, fontWeight: '600' },
  templateMin: { fontSize: F.footnote, fontWeight: '600', fontVariant: ['tabular-nums'] },
  customLink: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 48, paddingHorizontal: S.xs },
  planLine: { fontSize: F.footnote, lineHeight: 19, marginBottom: S.md },
  checkDot: { width: 22, height: 22, borderRadius: R.full, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  templateDesc: { fontSize: F.caption, fontWeight: '500', lineHeight: 17 },
  templateMeta: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' },
  metaChip: { borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xs },
  metaChipText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  templateTarget: { fontSize: 10, fontWeight: '500', flex: 1 },
  // Review
  sectionLabel: { fontSize: F.caption2, fontWeight: '600', marginBottom: S.xs },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: 44 },
  itemDot: { width: 34, height: 34, borderRadius: R.sm, borderWidth: B.thin, alignItems: 'center', justifyContent: 'center' },
  priorityDot: { width: 6, height: 6, borderRadius: R.full, marginHorizontal: S.xs },
  itemText: { fontSize: F.body, fontWeight: '500' },
  goalNote: { borderRadius: R.md, borderWidth: B.thin, padding: S.md, marginTop: S.md },
  goalNoteText: { fontSize: F.caption, fontWeight: '600', lineHeight: 17 },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginTop: S.lg, borderRadius: R.full, paddingVertical: S.md, paddingHorizontal: S.lg },
  applyBtnText: { color: '#fff', fontSize: F.body, fontWeight: '500' },
  expertNote: { fontSize: 10, fontWeight: '500', letterSpacing: 0.3, marginBottom: S.md, marginTop: S.xs },
});

