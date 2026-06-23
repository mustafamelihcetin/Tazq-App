import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform, TextInput, Keyboard, Switch, Dimensions, KeyboardAvoidingView, FlatList } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, ChevronRight, CalendarDays, X } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { BottomNavBar } from '../components/BottomNavBar';
import { useLanguageStore } from '../store/useLanguageStore';
import { useHabitStore, fmtDateKey } from '../store/useHabitStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { useTaskStore } from '../store/useTaskStore';
import { useCompletionStore } from '../store/useCompletionStore';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import {
  cancelExamCountdownNotifs,
  scheduleExamCountdownNotifs,
  scheduleRamadanStartNotification,
  cancelRamadanStartNotification,
} from '../utils/notifications';
import { S, R, F, B } from '../constants/tokens';
import { useToastStore } from '../store/useToastStore';
import { getModePreview, ModeType, RAMAZAN_HABIT_NAMES, detectSporType, RAMAZAN } from '../utils/turkishModes';
import { renderModeEmojiIcon } from '../utils/modeIcons';
import { useSporStore, getThisWeekEntry } from '../store/useSporStore';
import { getCurrentRamadanStatus, formatRamadanDate } from '../utils/ramadanDates';
import { matchExamName, detectExamFromInput, recommendTemplateId, HOURS_OPTIONS, type ExamPreset } from '../utils/examPresets';
import { TurkishModeBanner } from '../components/TurkishModeBanner';
import { TaskService } from '../services/api';
import { usePlanAdaptations } from '../hooks/usePlanAdaptations';
import { Touchable } from '@/components/Touchable';

const stripEmojiPrefix = (str: string): string => {
  if (!str) return '';
  const emojis = ['🏃', '💪', '⚖️', '✨', '🏆'];
  let clean = str;
  for (const e of emojis) {
    if (clean.startsWith(e)) {
      clean = clean.substring(e.length).trim();
    }
  }
  return clean;
};

const getEmojiFromLabel = (str: string): string => {
  if (!str) return '';
  const emojis = ['🏃', '💪', '⚖️', '✨', '🏆'];
  for (const e of emojis) {
    if (str.startsWith(e)) {
      return e;
    }
  }
  return '';
};

export default function ModlarScreen() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const screenWidth = Dimensions.get('window').width;
  const availableWidth = screenWidth - 84; // screen padding S.lg (24*2) + card padding S.md (16*2) = 80px + 4px safety buffer
  const BASE_CALENDAR_WIDTH = 340;
  const calendarScale = availableWidth < BASE_CALENDAR_WIDTH ? (availableWidth / BASE_CALENDAR_WIDTH) : 1;
  const { language } = useLanguageStore();
  const ramadanStatus = useMemo(() => getCurrentRamadanStatus(), []);
  const { runAdaptations } = usePlanAdaptations();
  const ramazanAccent = isDark ? '#A5B4FC' : '#6366F1';
  const { show: showToast } = useToastStore();

  const {
    seasonal, setSeasonalPref,
    examPlanHabitIds, examPlanTaskIds,
    exam2PlanHabitIds, exam2PlanTaskIds,
    exam3PlanHabitIds, exam3PlanTaskIds,
    ramazanPlanHabitIds, ramazanPlanTaskIds,
    tezPlanHabitIds, tezPlanTaskIds,
    mulakatPlanHabitIds, mulakatPlanTaskIds,
    examReviewShown, setExamReviewShown,
    mulakat2PlanHabitIds, mulakat2PlanTaskIds,
    mulakat3PlanHabitIds, mulakat3PlanTaskIds,
    sporPlanHabitIds, sporPlanTaskIds,
    spor2PlanHabitIds, spor2PlanTaskIds,
    spor3PlanHabitIds, spor3PlanTaskIds,
    setPlanIds, clearPlanIds, setPlanSpec,
  } = usePrefsStore();
  const { habits, removeHabit } = useHabitStore();
  const { removeTask } = useTaskStore();
  const { record: recordCompletion } = useCompletionStore();

  const retirePlanTask = useCallback((taskId: number, planMode?: string) => {
    const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
    if (task?.isCompleted) {
      recordCompletion(task.id, task.title, task.completedAt ?? undefined, planMode);
    }
    removeTask(taskId);
    TaskService.deleteTask(taskId).catch(() => {});
  }, [removeTask, recordCompletion]);

  const [modePreview, setModePreview] = useState<{ type: ModeType; key: number; templateId?: string; examTipTr?: string; examTipEn?: string; examName?: string; examDate?: string; examSlot?: 'exam' | 'exam2' | 'exam3'; mulakatSlot?: 'mulakat' | 'mulakat2' | 'mulakat3'; sporSlot?: 'spor' | 'spor2' | 'spor3' } | null>(null);
  const [examNameInput, setExamNameInput] = useState(seasonal.examName || '');
  const [examSuggestions, setExamSuggestions] = useState<ExamPreset[]>([]);
  const [selectedExamPreset, setSelectedExamPreset] = useState<ExamPreset | null>(() => detectExamFromInput(seasonal.examName || ''));
  const [examDailyMinutes, setExamDailyMinutes] = useState<number | null>(null);
  const [exam2Suggestions, setExam2Suggestions] = useState<ExamPreset[]>([]);
  const [selectedExam2Preset, setSelectedExam2Preset] = useState<ExamPreset | null>(() => detectExamFromInput(seasonal.exam2Name || ''));
  const [exam2DailyMinutes, setExam2DailyMinutes] = useState<number | null>(null);
  const [exam3Suggestions, setExam3Suggestions] = useState<ExamPreset[]>([]);
  const [selectedExam3Preset, setSelectedExam3Preset] = useState<ExamPreset | null>(() => detectExamFromInput(seasonal.exam3Name || ''));
  const [exam3DailyMinutes, setExam3DailyMinutes] = useState<number | null>(null);
  const [examDateInput, setExamDateInput] = useState(seasonal.examDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [examExpanded, setExamExpanded] = useState(false);
  const [exam2NameInput, setExam2NameInput] = useState(seasonal.exam2Name || '');
  const [exam2DateInput, setExam2DateInput] = useState(seasonal.exam2Date || '');
  const [exam2Expanded, setExam2Expanded] = useState(false);
  const [showExam2DatePicker, setShowExam2DatePicker] = useState(false);
  const [exam3NameInput, setExam3NameInput] = useState(seasonal.exam3Name || '');
  const [exam3DateInput, setExam3DateInput] = useState(seasonal.exam3Date || '');
  const [exam3Expanded, setExam3Expanded] = useState(false);
  const [showExam3DatePicker, setShowExam3DatePicker] = useState(false);
  const [tezNameInput, setTezNameInput] = useState(seasonal.tezName || '');
  const [tezDateInput, setTezDateInput] = useState(seasonal.tezDate || '');
  const [tezExpanded, setTezExpanded] = useState(false);
  const [showTezDatePicker, setShowTezDatePicker] = useState(false);
  const [mulakatNameInput, setMulakatNameInput] = useState(seasonal.mulakatName || '');
  const [mulakatDateInput, setMulakatDateInput] = useState(seasonal.mulakatDate || '');
  const [mulakatExpanded, setMulakatExpanded] = useState(false);
  const [showMulakatDatePicker, setShowMulakatDatePicker] = useState(false);
  const [mulakat2NameInput, setMulakat2NameInput] = useState(seasonal.mulakat2Name || '');
  const [mulakat2DateInput, setMulakat2DateInput] = useState(seasonal.mulakat2Date || '');
  const [mulakat2Expanded, setMulakat2Expanded] = useState(false);
  const [showMulakat2DatePicker, setShowMulakat2DatePicker] = useState(false);
  const [mulakat3NameInput, setMulakat3NameInput] = useState(seasonal.mulakat3Name || '');
  const [mulakat3DateInput, setMulakat3DateInput] = useState(seasonal.mulakat3Date || '');
  const [mulakat3Expanded, setMulakat3Expanded] = useState(false);
  const [showMulakat3DatePicker, setShowMulakat3DatePicker] = useState(false);
  const [sporGoalInput, setSporGoalInput] = useState(seasonal.sporGoal || '');
  const [sporDateInput, setSporDateInput] = useState(seasonal.sporDate || '');
  const [sporExpanded, setSporExpanded] = useState(false);
  const [showSporDatePicker, setShowSporDatePicker] = useState(false);
  const [spor2GoalInput, setSpor2GoalInput] = useState(seasonal.spor2Goal || '');
  const [spor2DateInput, setSpor2DateInput] = useState(seasonal.spor2Date || '');
  const [spor2Expanded, setSpor2Expanded] = useState(false);
  const [showSpor2DatePicker, setShowSpor2DatePicker] = useState(false);
  const [spor3GoalInput, setSpor3GoalInput] = useState(seasonal.spor3Goal || '');
  const [spor3DateInput, setSpor3DateInput] = useState(seasonal.spor3Date || '');
  const [spor3Expanded, setSpor3Expanded] = useState(false);
  const [showSpor3DatePicker, setShowSpor3DatePicker] = useState(false);
  const [weightEntryInput, setWeightEntryInput] = useState('');
  const [showWeightEntry, setShowWeightEntry] = useState(false);

  const {
    currentWeight, setCurrentWeight,
    targetWeight, setTargetWeight,
    heightCm, setHeightCm,
    ageYears, setAgeYears,
    gender, setGender,
    weeklyKm, setWeeklyKm,
    targetEvent, setTargetEvent,
    trainingDays, setTrainingDays,
    weightLog, addWeightEntry,
    resetInputs: resetSporInputs,
  } = useSporStore();

  const saveWeightEntry = useCallback((kg: number) => {
    addWeightEntry(kg);
    setWeightEntryInput('');
    setShowWeightEntry(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Kilo girişinden hemen sonra adaptasyon motorunu zorla çalıştır
    setTimeout(() => runAdaptations(true), 300);

    const allTasks = useTaskStore.getState().tasks;
    const allSporTaskIds = [...sporPlanTaskIds, ...spor2PlanTaskIds, ...spor3PlanTaskIds];

    // mevcut açık weight_entry görevini tamamla
    const wTaskId = allSporTaskIds.find(id => {
      const tk = allTasks.find(t => t.id === id);
      return tk && !tk.isCompleted && (tk.tags?.includes('weight_entry') || tk.title === 'Güncel kilonu gir' || tk.title === 'Log current weight');
    });
    if (wTaskId) {
      useTaskStore.getState().toggleTaskCompletion(wTaskId);
      TaskService.updateTask(wTaskId, { isCompleted: true }).catch(() => {});
    }

    // bir sonraki Pazartesi için yeni kilo görevi oluştur (spor slot aktifse)
    if (sporPlanTaskIds.length > 0 || sporPlanHabitIds.length > 0) {
      const now = new Date();
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + 7);
      nextMonday.setHours(8, 0, 0, 0);
      const title = language === 'tr' ? 'Güncel kilonu gir' : 'Log current weight';
      TaskService.createTask({
        title,
        description: '',
        priority: 'Medium',
        dueDate: nextMonday.toISOString(),
        isCompleted: false,
        tags: ['weight_entry'],
      }).then(newTask => {
        if (newTask?.id) {
          useTaskStore.getState().addTask(newTask);
          const prev = usePrefsStore.getState();
          // sporPlanTaskIds güncellemek için setPlanIds'i çağıramayız (hook dışı),
          // doğrudan store'a yazıyoruz
          const updated = [...sporPlanTaskIds, newTask.id];
          usePrefsStore.getState().setPlanIds('spor', sporPlanHabitIds, updated);
        }
      }).catch(() => {});
    }
  }, [addWeightEntry, runAdaptations, sporPlanTaskIds, spor2PlanTaskIds, spor3PlanTaskIds, sporPlanHabitIds, language]);

  const sporType = sporGoalInput ? detectSporType(sporGoalInput) : null;
  const cwNum = parseFloat(currentWeight);
  const twNum = parseFloat(targetWeight);
  const hnNum = parseFloat(heightCm); // boy cm
  const ayNum = parseFloat(ageYears); // yaş

  // BMI tabanlı sağlıklı kilo aralığı (boy girilmişse)
  const heightM = hnNum >= 100 && hnNum <= 250 ? hnNum / 100 : 0;
  const minHealthyKg = heightM > 0 ? parseFloat((18.5 * heightM * heightM).toFixed(1)) : 0;
  const maxHealthyKg = heightM > 0 ? parseFloat((27.5 * heightM * heightM).toFixed(1)) : 0;

  // Kilo: tarih girişi yok — hedef ağırlıktan otomatik hesaplanır
  // Kilo verme: 0.5 kg/hafta, kilo alma: 0.25 kg/hafta (sağlıklı tempo)
  const kiloGaining = cwNum > 0 && twNum > 0 && twNum > cwNum;
  const kiloWeeklyRate = kiloGaining ? 0.25 : 0.5;
  const kiloAutoWeeks = cwNum > 0 && twNum > 0 && cwNum !== twNum
    ? Math.ceil(Math.abs(cwNum - twNum) / kiloWeeklyRate)
    : null;
  const kiloAutoDate = kiloAutoWeeks
    ? new Date(Date.now() + kiloAutoWeeks * 7 * 86400000).toISOString().split('T')[0]
    : null;

  // Effective date: kilo → hesaplanmış, diğerleri → kullanıcı girişi
  const effectiveSporDate = sporType === 'kilo'
    ? (kiloAutoDate ?? sporDateInput)
    : sporDateInput;

  const sporDateObj = effectiveSporDate ? new Date(effectiveSporDate) : new Date(Date.now() + 90 * 86400000);

  // Input completeness per goal type
  const kiloWeightValid = cwNum >= 30 && cwNum <= 300 && twNum >= 30 && twNum <= 300;
  const kiloWeightRealistic = Math.abs(cwNum - twNum) <= 100;
  // BMI kontrolü: boy girilmişse hedef kilonun sağlıklı aralıkta olup olmadığını kontrol et
  const kiloBmiTargetTooLow = minHealthyKg > 0 && twNum > 0 && twNum < minHealthyKg;
  const kiloBmiCurrentUnderweight = minHealthyKg > 0 && cwNum > 0 && cwNum < minHealthyKg;
  const kiloBmiValid = !kiloBmiTargetTooLow; // hedef kilo BMI < 18.5 ise blokla

  const sporInputsComplete = sporType === 'kilo'
    ? currentWeight.trim() !== '' && targetWeight.trim() !== '' && cwNum > 0 && twNum > 0 && cwNum !== twNum && kiloWeightValid && kiloWeightRealistic && kiloBmiValid
    : sporType === 'maraton'
    ? weeklyKm.trim() !== '' && targetEvent !== ''
    : sporType === 'guc' || sporType === 'genel' || sporType === 'yaris'
    ? trainingDays !== null
    : false;

  // Kilo için date gerekmez (otomatik), diğerleri için date zorunlu
  const sporIsComplete = sporGoalInput.trim() !== '' && sporInputsComplete &&
    (sporType === 'kilo' ? kiloAutoDate !== null : sporDateInput !== '');

  const thisWeekWeight = getThisWeekEntry(weightLog);
  const latestWeight = weightLog.length > 0 ? weightLog[0].weight : null;

  const SPOR_GOALS = language === 'tr'
    ? [{ key: 'maraton', label: '🏃 Maraton / Koşu' }, { key: 'guc', label: '💪 Güç & Kas' }, { key: 'kilo', label: '⚖️ Kilo Yönetimi' }, { key: 'genel', label: '✨ Genel Form' }, { key: 'yaris', label: '🏆 Spor Yarışması' }]
    : [{ key: 'maraton', label: '🏃 Marathon / Running' }, { key: 'guc', label: '💪 Strength & Muscle' }, { key: 'kilo', label: '⚖️ Weight Management' }, { key: 'genel', label: '✨ General Fitness' }, { key: 'yaris', label: '🏆 Sport Competition' }];

  const TARGET_EVENTS = ['5K', '10K', 'Yarı', 'Tam'] as const;

  // YKS / KPSS auto-mode active check — warn if user enters same exam in custom exam mode
  const yksAutoActive = useMemo(() => {
    const YKS_DATES = [{ start: '2025-06-14', end: '2025-06-15' }, { start: '2026-06-13', end: '2026-06-14' }, { start: '2027-06-12', end: '2027-06-13' }];
    return YKS_DATES.some(r => { const s = new Date(r.start); s.setDate(s.getDate() - 35); return Date.now() >= s.getTime() && Date.now() <= new Date(r.end).setHours(23,59,59,999); });
  }, []);
  const kpssAutoActive = useMemo(() => {
    const KPSS_DATES = [{ start: '2025-10-26', end: '2025-10-26' }, { start: '2026-10-25', end: '2026-10-25' }, { start: '2027-10-24', end: '2027-10-24' }];
    return KPSS_DATES.some(r => { const s = new Date(r.start); s.setDate(s.getDate() - 45); return Date.now() >= s.getTime() && Date.now() <= new Date(r.end).setHours(23,59,59,999); });
  }, []);
  const examNameConflict = useMemo(() => {
    const n = examNameInput.toUpperCase();
    if (yksAutoActive && ['YKS', 'TYT', 'AYT'].some(k => n.includes(k))) return language === 'tr' ? '⚠️ YKS modu zaten otomatik aktif — bu plan onunla çakışabilir' : '⚠️ YKS mode is already auto-active — this plan may overlap';
    if (kpssAutoActive && n.includes('KPSS')) return language === 'tr' ? '⚠️ KPSS modu zaten otomatik aktif — bu plan onunla çakışabilir' : '⚠️ KPSS mode is already auto-active — this plan may overlap';
    return null;
  }, [examNameInput, yksAutoActive, kpssAutoActive, language]);
  const sporDatePast = effectiveSporDate ? new Date(effectiveSporDate).setHours(23, 59, 59, 999) < Date.now() : false;
  const sporDaysLeft = effectiveSporDate && !sporDatePast ? Math.max(0, Math.ceil((new Date(effectiveSporDate).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const sporColor = '#F97316';
  const spor2IsComplete = spor2GoalInput.trim() !== '' && spor2DateInput !== '';
  const spor2DatePast = spor2DateInput ? new Date(spor2DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const spor2DaysLeft = spor2DateInput && !spor2DatePast ? Math.max(0, Math.ceil((new Date(spor2DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const spor2DateObj = spor2DateInput ? new Date(spor2DateInput) : new Date(Date.now() + 60 * 86400000);
  const spor3IsComplete = spor3GoalInput.trim() !== '' && spor3DateInput !== '';
  const spor3DatePast = spor3DateInput ? new Date(spor3DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const spor3DaysLeft = spor3DateInput && !spor3DatePast ? Math.max(0, Math.ceil((new Date(spor3DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const spor3DateObj = spor3DateInput ? new Date(spor3DateInput) : new Date(Date.now() + 90 * 86400000);
  const examDateObj = examDateInput ? new Date(examDateInput) : new Date(Date.now() + 30 * 86400000);
  const exam2DateObj = exam2DateInput ? new Date(exam2DateInput) : new Date(Date.now() + 60 * 86400000);
  const exam3DateObj = exam3DateInput ? new Date(exam3DateInput) : new Date(Date.now() + 90 * 86400000);
  const tezDateObj = tezDateInput ? new Date(tezDateInput) : new Date(Date.now() + 90 * 86400000);
  const mulakatDateObj = mulakatDateInput ? new Date(mulakatDateInput) : new Date(Date.now() + 14 * 86400000);

  const scrollViewRef = useRef<ScrollView>(null);
  const examInputViewRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);

  const formatExamDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (language === 'tr') {
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const examIsComplete = examNameInput.trim() !== '' && examDateInput !== '';
  const examDatePast = examDateInput ? new Date(examDateInput).setHours(23, 59, 59, 999) < Date.now() : false;

  const thisWeekKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keys.add(fmtDateKey(d));
    }
    return keys;
  }, []);

  const examPlanHabits = useMemo(() => habits.filter(h => examPlanHabitIds.includes(h.id)), [habits, examPlanHabitIds]);
  const examHabitsActiveThisWeek = examPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const examWeekPct = examPlanHabits.length > 0 ? Math.round(examHabitsActiveThisWeek / examPlanHabits.length * 100) : 0;

  const ramazanPlanHabits = useMemo(() => habits.filter(h => ramazanPlanHabitIds.includes(h.id)), [habits, ramazanPlanHabitIds]);
  const ramazanHabitsActiveThisWeek = ramazanPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const ramazanWeekPct = ramazanPlanHabits.length > 0 ? Math.round(ramazanHabitsActiveThisWeek / ramazanPlanHabits.length * 100) : 0;

  const examDaysLeft = examDateInput && !examDatePast ? Math.max(0, Math.ceil((new Date(examDateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const urgencyColor = '#3B82F6';

  const exam2IsComplete = exam2NameInput.trim() !== '' && exam2DateInput !== '';
  const exam2DatePast = exam2DateInput ? new Date(exam2DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const exam2DaysLeft = exam2DateInput && !exam2DatePast ? Math.max(0, Math.ceil((new Date(exam2DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const exam2UrgencyColor = '#3B82F6';

  const exam3IsComplete = exam3NameInput.trim() !== '' && exam3DateInput !== '';
  const exam3DatePast = exam3DateInput ? new Date(exam3DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const exam3DaysLeft = exam3DateInput && !exam3DatePast ? Math.max(0, Math.ceil((new Date(exam3DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const exam3UrgencyColor = '#3B82F6';

  const tezIsComplete = tezNameInput.trim() !== '' && tezDateInput !== '';
  const tezDatePast = tezDateInput ? new Date(tezDateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const tezDaysLeft = tezDateInput && !tezDatePast ? Math.max(0, Math.ceil((new Date(tezDateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const tezUrgencyColor = '#8B5CF6';

  const mulakatIsComplete = mulakatNameInput.trim() !== '' && mulakatDateInput !== '';
  const mulakatDatePast = mulakatDateInput ? new Date(mulakatDateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const mulakatDaysLeft = mulakatDateInput && !mulakatDatePast ? Math.max(0, Math.ceil((new Date(mulakatDateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const mulakatUrgencyColor = '#10B981';
  const mulakat2IsComplete = mulakat2NameInput.trim() !== '' && mulakat2DateInput !== '';
  const mulakat2DatePast = mulakat2DateInput ? new Date(mulakat2DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const mulakat2DaysLeft = mulakat2DateInput && !mulakat2DatePast ? Math.max(0, Math.ceil((new Date(mulakat2DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const mulakat2UrgencyColor = '#10B981';
  const mulakat2DateObj = mulakat2DateInput ? new Date(mulakat2DateInput) : new Date(Date.now() + 14 * 86400000);
  const mulakat3IsComplete = mulakat3NameInput.trim() !== '' && mulakat3DateInput !== '';
  const mulakat3DatePast = mulakat3DateInput ? new Date(mulakat3DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const mulakat3DaysLeft = mulakat3DateInput && !mulakat3DatePast ? Math.max(0, Math.ceil((new Date(mulakat3DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const mulakat3UrgencyColor = '#10B981';
  const mulakat3DateObj = mulakat3DateInput ? new Date(mulakat3DateInput) : new Date(Date.now() + 21 * 86400000);

  const tezPlanHabits = useMemo(() => habits.filter(h => tezPlanHabitIds.includes(h.id)), [habits, tezPlanHabitIds]);
  const tezHabitsActiveThisWeek = tezPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const tezWeekPct = tezPlanHabits.length > 0 ? Math.round(tezHabitsActiveThisWeek / tezPlanHabits.length * 100) : 0;

  const mulakatPlanHabits = useMemo(() => habits.filter(h => mulakatPlanHabitIds.includes(h.id)), [habits, mulakatPlanHabitIds]);
  const mulakatHabitsActiveThisWeek = mulakatPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const mulakatWeekPct = mulakatPlanHabits.length > 0 ? Math.round(mulakatHabitsActiveThisWeek / mulakatPlanHabits.length * 100) : 0;

  const sporPlanHabits = useMemo(() => habits.filter(h => sporPlanHabitIds.includes(h.id)), [habits, sporPlanHabitIds]);
  const sporHabitsActiveThisWeek = sporPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const sporWeekPct = sporPlanHabits.length > 0 ? Math.round(sporHabitsActiveThisWeek / sporPlanHabits.length * 100) : 0;

  const closeExamModeWithReview = useCallback(() => {
    cancelExamCountdownNotifs();
    examPlanHabitIds.forEach(id => removeHabit(id));
    examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
    exam2PlanHabitIds.forEach(id => removeHabit(id));
    exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2'));
    exam3PlanHabitIds.forEach(id => removeHabit(id));
    exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3'));
    clearPlanIds('exam'); clearPlanIds('exam2'); clearPlanIds('exam3');
    setExamNameInput(''); setExamDateInput('');
    setExam2NameInput(''); setExam2DateInput('');
    setExam3NameInput(''); setExam3DateInput('');
    setExamExpanded(false); setExam2Expanded(false); setExam3Expanded(false);
    setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null);
    setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null);
    setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null);
    setExamReviewShown(false);
    showToast(language === 'tr' ? '🎓 Sınav modu kapatıldı' : '🎓 Exam mode closed', 'success');
  }, [examPlanHabitIds, examPlanTaskIds, exam2PlanHabitIds, exam2PlanTaskIds, exam3PlanHabitIds, exam3PlanTaskIds, language, retirePlanTask]);

  const seasonalRef = useRef(seasonal);
  useEffect(() => { seasonalRef.current = seasonal; }, [seasonal]);

  useFocusEffect(
    useCallback(() => {
      const s = seasonalRef.current;
      if (s.examMode && s.examDate && !examReviewShown) {
        const past = new Date(s.examDate).setHours(23, 59, 59, 999) < Date.now();
        if (past) {
          setExamReviewShown(true);
          const name = s.examName || (language === 'tr' ? 'Sınav' : 'Exam');
          setTimeout(() => {
            Alert.alert(
              language === 'tr' ? `🎓 ${name} tamamlandı!` : `🎓 ${name} is over!`,
              language === 'tr' ? 'Nasıl geçti?' : 'How did it go?',
              [
                { text: language === 'tr' ? 'Harika geçti 🎉' : 'It went great 🎉', onPress: closeExamModeWithReview },
                { text: language === 'tr' ? 'Orta geçti 😅' : 'So-so 😅', onPress: closeExamModeWithReview },
                { text: language === 'tr' ? 'Zor geçti 😢' : 'It was tough 😢', onPress: closeExamModeWithReview },
              ],
              { cancelable: false }
            );
          }, 600);
        }
      }
      return () => {
        const s = seasonalRef.current;
        if (s.examMode && (!s.examName?.trim() || !s.examDate)) {
          setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null);
        }
        if (s.tezMode && (!s.tezName?.trim() || !s.tezDate)) {
          setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null);
        }
        if (s.mulakatMode && (!s.mulakatName?.trim() || !s.mulakatDate)) {
          setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null);
        }
        if (s.sporMode) {
          const sGoal = s.sporGoal?.trim() ?? '';
          const sType = sGoal ? detectSporType(sGoal) : null;
          // kilo tipi için tarih otomatik hesaplanır, store'da olmayabilir — sadece hedef seçilmişse geçerli say
          const incomplete = !sGoal || (sType !== 'kilo' && !s.sporDate);
          if (incomplete) {
            setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null);
          }
        }
      };
    }, [examReviewShown, language, closeExamModeWithReview])
  );

  useEffect(() => {
    if (seasonal.examMode && seasonal.examDate && seasonal.examName) {
      scheduleExamCountdownNotifs(seasonal.examName, seasonal.examDate, language);
    }
  }, [seasonal.examDate, seasonal.examName, seasonal.examMode, language]);

  // Ramazan period ended while app was closed — clean up habits automatically
  useEffect(() => {
    if (!seasonal.ramazan) return;
    const now = Date.now();
    const stillActive = RAMAZAN.some(r => {
      const s = new Date(r.start);
      s.setDate(s.getDate() - 7);
      s.setHours(0, 0, 0, 0);
      const e = new Date(r.end);
      e.setHours(23, 59, 59, 999);
      return now >= s.getTime() && now <= e.getTime();
    });
    if (!stillActive) {
      ramazanPlanHabitIds.forEach(id => removeHabit(id));
      ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
      clearPlanIds('ramazan');
      setSeasonalPref('ramazan', false);
    }
  }, [seasonal.ramazan]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      if (Platform.OS === 'ios') {
        examInputViewRef.current?.measureInWindow((x, y, w, h) => {
          const screenH = Dimensions.get('screen').height;
          const kbTop = screenH - e.endCoordinates.height;
          const targetY = kbTop * 0.38;
          const inputCenterY = y + h / 2;
          const scrollDelta = inputCenterY - targetY;
          if (scrollDelta > 0) {
            scrollViewRef.current?.scrollTo({ y: scrollOffsetRef.current + scrollDelta, animated: true });
          }
        });
      }
    });
    const hide = Keyboard.addListener(hideEvent, () => {});
    return () => { show.remove(); hide.remove(); };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: S.lg, paddingTop: S.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        >
          {/* Screen Header */}
          <View style={{ marginBottom: S.lg }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: F.hero, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}>
              {language === 'tr' ? 'Dönemsel Modlar' : 'Seasonal Modes'}
            </Text>
            <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant, marginTop: S.xs, opacity: 0.6 }}>
              {language === 'tr' ? 'Hedefine özel plan & alışkanlık paketleri' : 'Curated plan & habit bundles for your goals'}
            </Text>
          </View>

          {/* Info row */}
          <Touchable
            onPress={() => Alert.alert(
              language === 'tr' ? 'Dönemsel Modlar Nedir?' : 'What are Seasonal Modes?',
              language === 'tr'
                ? 'Dönemsel modlar belirli bir hedef veya dönem için hazırlanmış alışkanlık ve görev paketleridir. Aktif ettiğinde ilgili plan otomatik olarak Haftalık Merkez\'e ve görevlerine eklenir. Mod kapatıldığında eklenen içerikler kaldırılır.'
                : 'Seasonal modes are curated habit and task bundles for specific goals or periods. When activated, the plan is automatically added to your Weekly Hub and tasks. Disabling the mode removes the added content.',
              [{ text: language === 'tr' ? 'Anladım' : 'Got it' }]
            )}
            style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.lg, alignSelf: 'flex-start' }}
            activeOpacity={0.7}
          >
            <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
              <Text style={{ fontSize: 11, fontWeight: '900', color: theme.onSurfaceVariant, lineHeight: 20 }}>i</Text>
            </View>
            <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, opacity: 0.6, fontWeight: '600' }}>
              {language === 'tr' ? 'Modlar nasıl çalışır?' : 'How do modes work?'}
            </Text>
          </Touchable>

          <View style={{ gap: S.md }}>
            {/* ── Ramazan Modu ── only show within 30 days of start or when user has it enabled */}
            {(seasonal.ramazan || ramadanStatus.daysUntilStart <= 7 || ramadanStatus.isActive) && <View style={[styles.modeCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.ramazan ? (isDark ? 'rgba(99,102,241,0.30)' : 'rgba(99,102,241,0.20)') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }]}>
              <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.ramazan ? S.sm : S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: seasonal.ramazan ? '#6366F122' : '#6366F115', alignItems: 'center', justifyContent: 'center' }}>
                    {renderModeEmojiIcon('🌙', 18, seasonal.ramazan ? '#6366F1' : '#6366F1aa')}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                      {language === 'tr' ? 'Ramazan Modu' : 'Ramadan Mode'}
                    </Text>
                    <Text style={{ fontSize: F.caption, fontWeight: '500', marginTop: 1,
                      color: ramadanStatus.isActive ? ramazanAccent : seasonal.ramazan && ramadanStatus.period ? ramazanAccent : theme.onSurfaceVariant,
                      opacity: ramadanStatus.isActive ? 0.9 : seasonal.ramazan && ramadanStatus.period ? 0.75 : 0.55,
                    }}>
                      {ramadanStatus.isActive && ramadanStatus.period
                        ? (language === 'tr'
                            ? `🌙 ${formatRamadanDate(ramadanStatus.period.start, 'tr')} – ${formatRamadanDate(ramadanStatus.period.end, 'tr')} · ${ramadanStatus.daysRemaining} gün kaldı`
                            : `🌙 ${formatRamadanDate(ramadanStatus.period.start, 'en')} – ${formatRamadanDate(ramadanStatus.period.end, 'en')} · ${ramadanStatus.daysRemaining} days left`)
                        : seasonal.ramazan && ramadanStatus.period
                        ? (language === 'tr'
                            ? `${formatRamadanDate(ramadanStatus.period.start, 'tr', ramadanStatus.period.year !== new Date().getFullYear())} · ${ramadanStatus.daysUntilStart} gün`
                            : `${formatRamadanDate(ramadanStatus.period.start, 'en', ramadanStatus.period.year !== new Date().getFullYear())} · ${ramadanStatus.daysUntilStart} days`)
                        : (language === 'tr' ? 'Oruç dönemine özel alışkanlık ve görevler' : 'Habits & tasks tailored for the fasting month')}
                    </Text>
                  </View>
                  <Switch
                    value={seasonal.ramazan}
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      if (!v && seasonal.ramazan) {
                        const hasItems = ramazanPlanHabitIds.length > 0 || ramazanPlanTaskIds.length > 0;
                        const doClose = () => {
                          ramazanPlanHabitIds.forEach(id => removeHabit(id));
                          habits.filter(h => RAMAZAN_HABIT_NAMES.some(n => n.toLowerCase() === h.name.toLowerCase())).forEach(h => removeHabit(h.id));
                          ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
                          clearPlanIds('ramazan');
                          setSeasonalPref('ramazan', false);
                          cancelRamadanStartNotification();
                        };
                        if (!hasItems) { doClose(); return; }
                        Alert.alert(
                          language === 'tr' ? 'Ramazan Modu Kapatılıyor' : 'Turning off Ramadan Mode',
                          language === 'tr' ? 'Eklenen tüm alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'All added habits and tasks will be removed. Are you sure?',
                          [
                            { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                            { text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: doClose },
                          ]
                        );
                      } else {
                        setSeasonalPref('ramazan', v);
                        if (v) {
                          setModePreview({ type: 'ramazan', key: Date.now() });
                          if (ramadanStatus.period && !ramadanStatus.isActive) {
                            scheduleRamadanStartNotification(ramadanStatus.period.start, language);
                          }
                        }
                      }
                    }}
                    trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#6366F180' }}
                    thumbColor={seasonal.ramazan ? '#6366F1' : (isDark ? '#636366' : '#fff')}
                  />
                </View>
              </View>
              {seasonal.ramazan && (
                <View style={{ paddingHorizontal: S.md, paddingBottom: S.md }}>
                  <View style={{ height: 1, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)', marginBottom: S.md }} />
                  {!ramadanStatus.isActive && ramadanStatus.period ? (
                    <Touchable onPress={() => setModePreview({ type: 'ramazan', key: Date.now() })} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }} activeOpacity={0.7}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ramazanAccent }} />
                      <Text style={{ color: ramazanAccent, fontSize: F.caption, fontWeight: '600', flex: 1 }}>{language === 'tr' ? 'Planı şimdiden hazırla' : 'Set up your plan in advance'}</Text>
                      <ChevronRight size={12} color={ramazanAccent} />
                    </Touchable>
                  ) : ramazanPlanHabits.length > 0 ? (
                    <View style={{ gap: S.sm }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text>
                        <Text style={{ color: ramazanAccent, fontSize: F.caption, fontWeight: '800' }}>{ramazanHabitsActiveThisWeek}/{ramazanPlanHabits.length} · {ramazanWeekPct}%</Text>
                      </View>
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)', overflow: 'hidden' }}>
                        <View style={{ height: 5, borderRadius: 3, backgroundColor: ramazanAccent, width: `${ramazanWeekPct}%` as any }} />
                      </View>
                    </View>
                  ) : (
                    <Touchable onPress={() => setModePreview({ type: 'ramazan', key: Date.now() })} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }} activeOpacity={0.7}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ramazanAccent }} />
                      <Text style={{ color: ramazanAccent, fontSize: F.caption, fontWeight: '700', flex: 1 }}>{language === 'tr' ? 'Plan henüz oluşturulmadı — Oluştur' : 'No plan yet — Create one'}</Text>
                      <ChevronRight size={12} color={ramazanAccent} />
                    </Touchable>
                  )}
                </View>
              )}
            </View>}

            {/* ── Sınav Takibi ── */}
            <View style={[styles.modeCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.examMode && examIsComplete ? (examDatePast ? theme.error + '40' : urgencyColor + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }]}>
              <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.examMode ? S.sm : S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (seasonal.examMode && examIsComplete ? (examDatePast ? theme.error : urgencyColor) : '#3B82F6') + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={18} color={seasonal.examMode && examIsComplete ? (examDatePast ? theme.error : urgencyColor) : '#3B82F6'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Sınav Takibi' : 'Exam Mode'}</Text>
                    {seasonal.examMode && examIsComplete ? (
                      <Text style={{ color: examDatePast ? theme.error : urgencyColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>
                        {examDatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date has passed') : (language === 'tr' ? `${examDaysLeft} gün kaldı` : `${examDaysLeft} days left`)}
                      </Text>
                    ) : (
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{language === 'tr' ? 'Herhangi bir sınav için çalışma planı' : 'Study plan for any exam'}</Text>
                    )}
                  </View>
                  <Switch
                    value={seasonal.examMode}
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      if (!v && seasonal.examMode) {
                        const hasItems = examPlanHabitIds.length > 0 || examPlanTaskIds.length > 0;
                        const doClose = () => {
                          cancelExamCountdownNotifs();
                          examPlanHabitIds.forEach(id => removeHabit(id));
                          examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
                          exam2PlanHabitIds.forEach(id => removeHabit(id));
                          exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2'));
                          exam3PlanHabitIds.forEach(id => removeHabit(id));
                          exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3'));
                          clearPlanIds('exam'); clearPlanIds('exam2'); clearPlanIds('exam3');
                          setExamNameInput(''); setExamDateInput('');
                          setExam2NameInput(''); setExam2DateInput('');
                          setExam3NameInput(''); setExam3DateInput('');
                          setExamExpanded(false); setExam2Expanded(false); setExam3Expanded(false);
                          setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null);
                          setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null);
                          setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null);
                          setExamReviewShown(false);
                        };
                        if (!hasItems) { doClose(); return; }
                        Alert.alert(
                          language === 'tr' ? 'Sınav Takibi Kapatılıyor' : 'Turning off Exam Mode',
                          language === 'tr' ? 'Eklenen tüm alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'All added habits and tasks will be removed. Are you sure?',
                          [
                            { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                            { text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: doClose },
                          ]
                        );
                      } else if (v) {
                        setSeasonalPref('examMode', true);
                      }
                    }}
                    trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (examIsComplete ? (examDatePast ? theme.error : urgencyColor) : '#3B82F6') + '80' }}
                    thumbColor={seasonal.examMode ? (examIsComplete ? (examDatePast ? theme.error : urgencyColor) : '#3B82F6') : (isDark ? '#636366' : '#fff')}
                  />
                </View>
              </View>

              {seasonal.examMode && (
                <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                  <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />

                  {!examIsComplete && !examExpanded && (
                    <Touchable onPress={() => { Haptics.selectionAsync(); setExamExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
                      {renderModeEmojiIcon('🎯', 16, theme.onSurfaceVariant)}
                      <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Sınav ekle' : 'Add exam'}</Text>
                      <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
                    </Touchable>
                  )}

                  {examIsComplete && !examExpanded && (
                    <View style={{ gap: S.sm }}>
                      <Touchable onPress={() => { Haptics.selectionAsync(); setExamExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: (examDatePast ? theme.error : urgencyColor) + '30', backgroundColor: (examDatePast ? theme.error : urgencyColor) + '08' }} activeOpacity={0.85}>
                        <View style={{ height: 3, backgroundColor: examDatePast ? theme.error : urgencyColor }} />
                        <View style={{ padding: S.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
                            {renderModeEmojiIcon('🎯', 16, urgencyColor)}
                            <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{examNameInput}</Text>
                            <Text style={{ color: examDatePast ? theme.error : urgencyColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                            <Touchable
                              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(language === 'tr' ? 'Sınavı Sil' : 'Delete Exam', language === 'tr' ? `"${examNameInput}" silinecek. Emin misin?` : `"${examNameInput}" will be deleted. Are you sure?`, [{ text: language === 'tr' ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: () => { examPlanHabitIds.forEach(id => removeHabit(id)); examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam')); clearPlanIds('exam'); setExamNameInput(''); setExamDateInput(''); setSelectedExamPreset(null); setExamExpanded(false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null); if (!exam2IsComplete && !exam3IsComplete) { setSeasonalPref('examMode', false); } } }]); }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                              style={{ marginLeft: S.sm }}
                            >
                              <X size={14} color={theme.onSurfaceVariant} strokeWidth={2.5} />
                            </Touchable>
                          </View>
                          {examDatePast ? (
                            <View style={{ gap: S.sm }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                                {renderModeEmojiIcon('📅', 15, theme.error)}
                                <Text style={{ color: theme.error, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Tarih geçti' : 'Date has passed'}</Text>
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>· {formatExamDate(examDateInput)}</Text>
                              </View>
                              <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); closeExamModeWithReview(); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: theme.error + '12', borderRadius: R.md, paddingVertical: S.sm, borderWidth: B.thin, borderColor: theme.error + '25' }} activeOpacity={0.75}>
                                <Text style={{ color: theme.error, fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Sınavı Tamamla & Kapat' : 'Complete & Close Exam'}</Text>
                              </Touchable>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                              <View style={{ alignItems: 'center', minWidth: 52 }}>
                                <Text style={{ color: urgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{examDaysLeft}</Text>
                                <Text style={{ color: urgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text>
                              </View>
                              <View style={{ flex: 1, paddingTop: 2 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  {renderModeEmojiIcon('📅', 13, theme.onSurfaceVariant)}
                                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{formatExamDate(examDateInput)}</Text>
                                </View>
                                {examPlanHabits.length > 0 && (
                                  <View style={{ marginTop: S.sm, gap: 4 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text>
                                      <Text style={{ color: urgencyColor, fontSize: 11, fontWeight: '800' }}>{examHabitsActiveThisWeek}/{examPlanHabits.length} · {examWeekPct}%</Text>
                                    </View>
                                    <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                      <View style={{ height: 5, borderRadius: 3, backgroundColor: urgencyColor, width: `${examWeekPct}%` as any }} />
                                    </View>
                                  </View>
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      </Touchable>

                      {!examDatePast && (
                        <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); const templateId = examPlanHabits.length === 0 ? recommendTemplateId(examDaysLeft, selectedExamPreset?.category ?? 'other', selectedExamPreset?.preferredTemplates ?? [], examDailyMinutes ?? selectedExamPreset?.defaultDailyMinutes ?? 90) : undefined; setModePreview({ type: 'exam', key: Date.now(), templateId, examSlot: 'exam', examTipTr: selectedExamPreset?.tipTr, examTipEn: selectedExamPreset?.tipEn, examName: examNameInput, examDate: examDateInput }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: urgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: urgencyColor + '22' }} activeOpacity={0.75}>
                          <BookOpen size={14} color={urgencyColor} />
                          <Text style={{ color: urgencyColor, fontWeight: '800', fontSize: F.caption }}>{examPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Çalışma Planı Oluştur' : 'Create Study Plan')}</Text>
                        </Touchable>
                      )}

                      {/* İkinci Sınav */}
                      <View style={{ marginTop: S.xs }}>
                        <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                        {exam2IsComplete && !exam2Expanded ? (
                          <Touchable onPress={() => { Haptics.selectionAsync(); setExam2Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (exam2DatePast ? theme.error : exam2UrgencyColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
                            {renderModeEmojiIcon('🎯', 14, exam2UrgencyColor)}
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{exam2NameInput}</Text>
                              <Text style={{ color: exam2DatePast ? theme.error : exam2UrgencyColor, fontSize: 11, fontWeight: '700' }}>{exam2DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${exam2DaysLeft} gün kaldı` : `${exam2DaysLeft} days left`)}</Text>
                            </View>
                            <Text style={{ color: exam2UrgencyColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                            <Touchable
                              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(language === 'tr' ? 'Sınavı Sil' : 'Delete Exam', language === 'tr' ? `"${exam2NameInput}" silinecek. Emin misin?` : `"${exam2NameInput}" will be deleted. Are you sure?`, [{ text: language === 'tr' ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: () => { exam2PlanHabitIds.forEach(id => removeHabit(id)); exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2')); clearPlanIds('exam2'); setExam2NameInput(''); setExam2DateInput(''); setSelectedExam2Preset(null); setExam2Expanded(false); setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null); } }]); }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                            >
                              <X size={13} color={theme.onSurfaceVariant} strokeWidth={2.5} />
                            </Touchable>
                          </Touchable>
                        ) : !exam2IsComplete && !exam2Expanded ? (
                          <Touchable onPress={() => { Haptics.selectionAsync(); setExam2Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                            <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{language === 'tr' ? 'İkinci sınav ekle (YKS + TYT gibi)' : 'Add second exam (e.g. SAT + ACT)'}</Text>
                          </Touchable>
                        ) : null}
                        {exam2Expanded && (
                          <View style={{ gap: S.sm }}>
                            <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                              <TextInput value={exam2NameInput} onChangeText={(v) => { setExam2NameInput(v); setSeasonalPref('exam2Name', v); if (!v.trim()) { setExam2Suggestions([]); setSelectedExam2Preset(null); setExam2DailyMinutes(null); return; } const detected = detectExamFromInput(v); if (detected) { setSelectedExam2Preset(detected); setExam2Suggestions([]); } else { setSelectedExam2Preset(null); setExam2Suggestions(matchExamName(v)); } }} placeholder={language === 'tr' ? 'İkinci sınav adı (örn: YDS, ALES...)' : 'Second exam name (e.g. IELTS, GRE...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" onSubmitEditing={() => { if (exam2Suggestions.length > 0) { const top = exam2Suggestions[0]; setExam2NameInput(top.shortName); setSeasonalPref('exam2Name', top.shortName); setSelectedExam2Preset(top); setExam2Suggestions([]); } }} />
                            </View>
                            {exam2Suggestions.length > 0 && (
                              <View style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                                {exam2Suggestions.map((preset, idx) => (
                                  <Touchable key={preset.id} onPress={() => { Haptics.selectionAsync(); setExam2NameInput(preset.shortName); setSeasonalPref('exam2Name', preset.shortName); setSelectedExam2Preset(preset); setExam2Suggestions([]); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} activeOpacity={0.7}>
                                    <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text>
                                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text>
                                  </Touchable>
                                ))}
                              </View>
                            )}
                            <Touchable onPress={() => { Haptics.selectionAsync(); setShowExam2DatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                              <Text style={{ color: exam2DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{exam2DateInput ? formatExamDate(exam2DateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select date')}</Text>
                              <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                            </Touchable>
                            {showExam2DatePicker && (
                              <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                                <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                                  <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={exam2DateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setMonth(d.getMonth() + 18); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowExam2DatePicker(false); if (event.type === 'dismissed') { setShowExam2DatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setExam2DateInput(iso); setSeasonalPref('exam2Date', iso); if (Platform.OS === 'ios') setShowExam2DatePicker(false); } }} />
                                </View>
                              </View>
                            )}
                            {selectedExam2Preset && (
                              <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}</Text>
                                <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                                  {HOURS_OPTIONS.map((opt) => { const active = exam2DailyMinutes === opt.minutes; return (<Touchable key={opt.minutes} onPress={() => { Haptics.selectionAsync(); setExam2DailyMinutes(active ? null : opt.minutes); }} style={{ paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? exam2UrgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? exam2UrgencyColor + '18' : 'transparent' }} activeOpacity={0.7}><Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? exam2UrgencyColor : theme.onSurfaceVariant }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text></Touchable>); })}
                                </View>
                                {selectedExam2Preset.tipTr && (<Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>{language === 'tr' ? selectedExam2Preset.tipTr : selectedExam2Preset.tipEn}</Text>)}
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', gap: S.sm }}>
                              <Touchable onPress={() => { if (exam2NameInput || exam2DateInput) { exam2PlanHabitIds.forEach(id => removeHabit(id)); exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2')); clearPlanIds('exam2'); setExam2NameInput(''); setExam2DateInput(''); setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null); setSelectedExam2Preset(null); setExam2DailyMinutes(null); } setExam2Expanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                              </Touchable>
                              {exam2IsComplete && (
                                <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExam2Expanded(false); const templateId = selectedExam2Preset ? recommendTemplateId(exam2DaysLeft, selectedExam2Preset.category, selectedExam2Preset.preferredTemplates, exam2DailyMinutes ?? selectedExam2Preset.defaultDailyMinutes) : undefined; setModePreview({ type: 'exam', key: Date.now(), templateId, examSlot: 'exam2', examTipTr: selectedExam2Preset?.tipTr, examTipEn: selectedExam2Preset?.tipEn, examName: exam2NameInput, examDate: exam2DateInput }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: exam2UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}>
                                  <BookOpen size={13} color="#fff" />
                                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                                </Touchable>
                              )}
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Üçüncü Sınav */}
                      {exam2IsComplete && (
                        <View style={{ marginTop: S.xs }}>
                          <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                          {exam3IsComplete && !exam3Expanded ? (
                            <Touchable onPress={() => { Haptics.selectionAsync(); setExam3Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (exam3DatePast ? theme.error : exam3UrgencyColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
                              {renderModeEmojiIcon('🎯', 14, exam3UrgencyColor)}
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{exam3NameInput}</Text>
                                <Text style={{ color: exam3DatePast ? theme.error : exam3UrgencyColor, fontSize: 11, fontWeight: '700' }}>{exam3DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${exam3DaysLeft} gün kaldı` : `${exam3DaysLeft} days left`)}</Text>
                              </View>
                              <Text style={{ color: exam3UrgencyColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                              <Touchable
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(language === 'tr' ? 'Sınavı Sil' : 'Delete Exam', language === 'tr' ? `"${exam3NameInput}" silinecek. Emin misin?` : `"${exam3NameInput}" will be deleted. Are you sure?`, [{ text: language === 'tr' ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: () => { exam3PlanHabitIds.forEach(id => removeHabit(id)); exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3')); clearPlanIds('exam3'); setExam3NameInput(''); setExam3DateInput(''); setSelectedExam3Preset(null); setExam3Expanded(false); setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null); } }]); }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                              >
                                <X size={13} color={theme.onSurfaceVariant} strokeWidth={2.5} />
                              </Touchable>
                            </Touchable>
                          ) : !exam3IsComplete && !exam3Expanded ? (
                            <Touchable onPress={() => { Haptics.selectionAsync(); setExam3Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
                              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{language === 'tr' ? 'Üçüncü sınav ekle' : 'Add third exam'}</Text>
                            </Touchable>
                          ) : null}
                          {exam3Expanded && (
                            <View style={{ gap: S.sm }}>
                              <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                                <TextInput value={exam3NameInput} onChangeText={(v) => { setExam3NameInput(v); setSeasonalPref('exam3Name', v); if (!v.trim()) { setExam3Suggestions([]); setSelectedExam3Preset(null); setExam3DailyMinutes(null); return; } const detected = detectExamFromInput(v); if (detected) { setSelectedExam3Preset(detected); setExam3Suggestions([]); } else { setSelectedExam3Preset(null); setExam3Suggestions(matchExamName(v)); } }} placeholder={language === 'tr' ? 'Üçüncü sınav adı (örn: YDS, DGS...)' : 'Third exam name (e.g. TOEFL, GMAT...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" onSubmitEditing={() => { if (exam3Suggestions.length > 0) { const top = exam3Suggestions[0]; setExam3NameInput(top.shortName); setSeasonalPref('exam3Name', top.shortName); setSelectedExam3Preset(top); setExam3Suggestions([]); } }} />
                              </View>
                              {exam3Suggestions.length > 0 && (
                                <View style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                                  {exam3Suggestions.map((preset, idx) => (<Touchable key={preset.id} onPress={() => { Haptics.selectionAsync(); setExam3NameInput(preset.shortName); setSeasonalPref('exam3Name', preset.shortName); setSelectedExam3Preset(preset); setExam3Suggestions([]); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} activeOpacity={0.7}><Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text><Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text></Touchable>))}
                                </View>
                              )}
                              <Touchable onPress={() => { Haptics.selectionAsync(); setShowExam3DatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                                <Text style={{ color: exam3DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{exam3DateInput ? formatExamDate(exam3DateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select date')}</Text>
                                <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                              </Touchable>
                              {showExam3DatePicker && (
                                <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                                  <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                                    <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={exam3DateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setMonth(d.getMonth() + 18); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowExam3DatePicker(false); if (event.type === 'dismissed') { setShowExam3DatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setExam3DateInput(iso); setSeasonalPref('exam3Date', iso); if (Platform.OS === 'ios') setShowExam3DatePicker(false); } }} />
                                  </View>
                                </View>
                              )}
                              {selectedExam3Preset && (
                                <View style={{ gap: 6 }}>
                                  <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}</Text>
                                  <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                                    {HOURS_OPTIONS.map((opt) => { const active = exam3DailyMinutes === opt.minutes; return (<Touchable key={opt.minutes} onPress={() => { Haptics.selectionAsync(); setExam3DailyMinutes(active ? null : opt.minutes); }} style={{ paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? exam3UrgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? exam3UrgencyColor + '18' : 'transparent' }} activeOpacity={0.7}><Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? exam3UrgencyColor : theme.onSurfaceVariant }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text></Touchable>); })}
                                  </View>
                                  {selectedExam3Preset.tipTr && (<Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>{language === 'tr' ? selectedExam3Preset.tipTr : selectedExam3Preset.tipEn}</Text>)}
                                </View>
                              )}
                              <View style={{ flexDirection: 'row', gap: S.sm }}>
                                <Touchable onPress={() => { if (exam3NameInput || exam3DateInput) { exam3PlanHabitIds.forEach(id => removeHabit(id)); exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3')); clearPlanIds('exam3'); setExam3NameInput(''); setExam3DateInput(''); setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null); setSelectedExam3Preset(null); setExam3DailyMinutes(null); } setExam3Expanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                                </Touchable>
                                {exam3IsComplete && (
                                  <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExam3Expanded(false); const templateId = selectedExam3Preset ? recommendTemplateId(exam3DaysLeft, selectedExam3Preset.category, selectedExam3Preset.preferredTemplates, exam3DailyMinutes ?? selectedExam3Preset.defaultDailyMinutes) : undefined; setModePreview({ type: 'exam', key: Date.now(), templateId, examSlot: 'exam3', examTipTr: selectedExam3Preset?.tipTr, examTipEn: selectedExam3Preset?.tipEn, examName: exam3NameInput, examDate: exam3DateInput }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: exam3UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}>
                                    <BookOpen size={13} color="#fff" />
                                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                                  </Touchable>
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {examExpanded && (
                    <View style={{ gap: S.sm }}>
                      <View ref={examInputViewRef} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                        <TextInput value={examNameInput} onChangeText={(v) => { setExamNameInput(v); setSeasonalPref('examName', v); if (!v.trim()) { setExamSuggestions([]); setSelectedExamPreset(null); setExamDailyMinutes(null); return; } const detected = detectExamFromInput(v); if (detected) { setSelectedExamPreset(detected); setExamSuggestions([]); } else { setSelectedExamPreset(null); setExamSuggestions(matchExamName(v)); } }} placeholder={language === 'tr' ? 'Sınav adı (örn: ALES, DGS, KPSS...)' : 'Exam name (e.g. SAT, GRE, IELTS...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" maxLength={60} onSubmitEditing={() => { if (examSuggestions.length > 0) { const top = examSuggestions[0]; setExamNameInput(top.shortName); setSeasonalPref('examName', top.shortName); setSelectedExamPreset(top); setExamSuggestions([]); } }} />
                      </View>
                      {examNameConflict && (
                        <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700', paddingHorizontal: 2 }}>{examNameConflict}</Text>
                      )}
                      {examSuggestions.length > 0 && (
                        <View style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                          {examSuggestions.map((preset, idx) => (<Touchable key={preset.id} onPress={() => { Haptics.selectionAsync(); setExamNameInput(preset.shortName); setSeasonalPref('examName', preset.shortName); setSelectedExamPreset(preset); setExamSuggestions([]); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} activeOpacity={0.7}><Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text><Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text></Touchable>))}
                        </View>
                      )}
                      <Touchable onPress={() => { Haptics.selectionAsync(); setShowDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                        <Text style={{ color: examDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{examDateInput ? formatExamDate(examDateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select exam date')}</Text>
                        <CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} />
                      </Touchable>
                      {showDatePicker && (
                        <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                          <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                            <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={examDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setMonth(d.getMonth() + 18); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowDatePicker(false); if (event.type === 'dismissed') { setShowDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setExamDateInput(iso); setSeasonalPref('examDate', iso); if (Platform.OS === 'ios') setShowDatePicker(false); } }} />
                          </View>
                        </View>
                      )}
                      {selectedExamPreset && (
                        <View style={{ gap: 6 }}>
                          <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}</Text>
                          <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                            {HOURS_OPTIONS.map((opt) => {
                              const active = examDailyMinutes === opt.minutes;
                              const levelLabel = opt.minutes <= 60
                                ? (language === 'tr' ? '🌱 Temel' : '🌱 Foundation')
                                : opt.minutes <= 120
                                  ? (language === 'tr' ? '📈 Standart' : '📈 Standard')
                                  : (language === 'tr' ? '🔥 Yoğun' : '🔥 Intensive');
                              return (
                                <Touchable key={opt.minutes} onPress={() => { Haptics.selectionAsync(); setExamDailyMinutes(active ? null : opt.minutes); }} style={{ paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.md, borderWidth: B.medium, borderColor: active ? urgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? urgencyColor + '18' : 'transparent' }} activeOpacity={0.7}>
                                  <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? urgencyColor : theme.onSurfaceVariant }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text>
                                  {active && <Text style={{ fontSize: 10, fontWeight: '600', color: urgencyColor, opacity: 0.8, marginTop: 2 }}>{levelLabel}</Text>}
                                </Touchable>
                              );
                            })}
                          </View>
                          {selectedExamPreset.tipTr && (<Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>{language === 'tr' ? selectedExamPreset.tipTr : selectedExamPreset.tipEn}</Text>)}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: S.sm }}>
                        <Touchable onPress={() => { setExamExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                        </Touchable>
                        {examIsComplete && (
                          <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExamExpanded(false); const templateId = recommendTemplateId(examDaysLeft, selectedExamPreset?.category ?? 'other', selectedExamPreset?.preferredTemplates ?? [], examDailyMinutes ?? selectedExamPreset?.defaultDailyMinutes ?? 90); setModePreview({ type: 'exam', key: Date.now(), templateId, examSlot: 'exam', examTipTr: selectedExamPreset?.tipTr, examTipEn: selectedExamPreset?.tipEn, examName: examNameInput, examDate: examDateInput }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: urgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}>
                            <BookOpen size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                          </Touchable>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ── Tez / Proje ── */}
            <View style={[styles.modeCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.tezMode && tezIsComplete ? (tezDatePast ? theme.error + '40' : tezUrgencyColor + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }]}>
              <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.tezMode ? S.sm : S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (seasonal.tezMode && tezIsComplete ? (tezDatePast ? theme.error : tezUrgencyColor) : '#8B5CF6') + '18', alignItems: 'center', justifyContent: 'center' }}>
                    {renderModeEmojiIcon('📝', 18, seasonal.tezMode && tezIsComplete ? (tezDatePast ? theme.error : tezUrgencyColor) : '#8B5CF6')}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Tez / Proje' : 'Thesis / Project'}</Text>
                    {seasonal.tezMode && tezIsComplete ? (
                      <Text style={{ color: tezDatePast ? theme.error : tezUrgencyColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>{tezDatePast ? (language === 'tr' ? 'Teslim tarihi geçti' : 'Deadline passed') : (language === 'tr' ? `${tezDaysLeft} gün kaldı` : `${tezDaysLeft} days left`)}</Text>
                    ) : (
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{language === 'tr' ? 'Deadline odaklı akademik / proje planı' : 'Deadline-driven thesis or project plan'}</Text>
                    )}
                  </View>
                  <Switch value={seasonal.tezMode} onValueChange={(v) => { Haptics.selectionAsync(); if (!v && seasonal.tezMode) { const hasItems = tezPlanHabitIds.length > 0 || tezPlanTaskIds.length > 0; const doClose = () => { tezPlanHabitIds.forEach(id => removeHabit(id)); tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez')); clearPlanIds('tez'); setTezNameInput(''); setTezDateInput(''); setTezExpanded(false); setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); }; if (!hasItems) { doClose(); return; } Alert.alert(language === 'tr' ? 'Tez Modu Kapatılıyor' : 'Turning off Thesis Mode', language === 'tr' ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?', [{ text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: doClose }]); } else if (v) { setSeasonalPref('tezMode', true); } }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (tezIsComplete ? tezUrgencyColor : '#8B5CF6') + '80' }} thumbColor={seasonal.tezMode ? (tezIsComplete ? tezUrgencyColor : '#8B5CF6') : (isDark ? '#636366' : '#fff')} />
                </View>
              </View>
              {seasonal.tezMode && (
                <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                  <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
                  {!tezIsComplete && !tezExpanded && (<Touchable onPress={() => { Haptics.selectionAsync(); setTezExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>{renderModeEmojiIcon('📝', 16, theme.onSurfaceVariant)}<Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Proje ekle' : 'Add project'}</Text><ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} /></Touchable>)}
                  {tezIsComplete && !tezExpanded && (
                    <View style={{ gap: S.sm }}>
                      <Touchable onPress={() => { Haptics.selectionAsync(); setTezExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: (tezDatePast ? theme.error : tezUrgencyColor) + '30', backgroundColor: (tezDatePast ? theme.error : tezUrgencyColor) + '08' }} activeOpacity={0.85}>
                        <View style={{ height: 3, backgroundColor: tezDatePast ? theme.error : tezUrgencyColor }} />
                        <View style={{ padding: S.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>{renderModeEmojiIcon('📝', 16, tezUrgencyColor)}<Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{tezNameInput}</Text><Text style={{ color: tezDatePast ? theme.error : tezUrgencyColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text></View>
                          {tezDatePast ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {renderModeEmojiIcon('📅', 14, theme.error)}
                              <Text style={{ color: theme.error, fontWeight: '700' }}>
                                {language === 'tr' ? 'Teslim tarihi geçti' : 'Deadline passed'} · {formatExamDate(tezDateInput)}
                              </Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                              <View style={{ alignItems: 'center', minWidth: 52 }}><Text style={{ color: tezUrgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{tezDaysLeft}</Text><Text style={{ color: tezUrgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text></View>
                              <View style={{ flex: 1, paddingTop: 2 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  {renderModeEmojiIcon('📅', 13, theme.onSurfaceVariant)}
                                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{formatExamDate(tezDateInput)}</Text>
                                </View>
                                {tezPlanHabits.length > 0 && (<View style={{ marginTop: S.sm, gap: 4 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text><Text style={{ color: tezUrgencyColor, fontSize: 11, fontWeight: '800' }}>{tezHabitsActiveThisWeek}/{tezPlanHabits.length} · {tezWeekPct}%</Text></View><View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: tezUrgencyColor, width: `${tezWeekPct}%` as any }} /></View></View>)}
                              </View>
                            </View>
                          )}
                        </View>
                      </Touchable>
                      <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'tez', key: Date.now() }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: tezUrgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: tezUrgencyColor + '22' }} activeOpacity={0.75}>
                        <BookOpen size={14} color={tezUrgencyColor} />
                        <Text style={{ color: tezUrgencyColor, fontWeight: '800', fontSize: F.caption }}>{tezPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Çalışma Planı Oluştur' : 'Create Work Plan')}</Text>
                      </Touchable>

                    </View>
                  )}
                  {tezExpanded && (
                    <View style={{ gap: S.sm }}>
                      <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}><TextInput value={tezNameInput} onChangeText={(v) => { setTezNameInput(v); setSeasonalPref('tezName', v); }} placeholder={language === 'tr' ? 'Proje adı (Yüksek Lisans Tezi...)' : "Project name (Master's Thesis...)"} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" /></View>
                      <Touchable onPress={() => { Haptics.selectionAsync(); setShowTezDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}><Text style={{ color: tezDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{tezDateInput ? formatExamDate(tezDateInput) : (language === 'tr' ? 'Teslim tarihi seç' : 'Select deadline')}</Text><CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} /></Touchable>
                      {showTezDatePicker && (
                        <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                          <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                            <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={tezDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 3); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowTezDatePicker(false); if (event.type === 'dismissed') { setShowTezDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setTezDateInput(iso); setSeasonalPref('tezDate', iso); if (Platform.OS === 'ios') setShowTezDatePicker(false); } }} />
                          </View>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: S.sm }}>
                        <Touchable onPress={() => { setTezExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}><Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text></Touchable>
                        {tezIsComplete && (<Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTezExpanded(false); setModePreview({ type: 'tez', key: Date.now() }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: tezUrgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}><BookOpen size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></Touchable>)}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ── İş Mülakatı ── */}
            <View style={[styles.modeCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.mulakatMode && mulakatIsComplete ? (mulakatDatePast ? theme.error + '40' : mulakatUrgencyColor + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }]}>
              <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.mulakatMode ? S.sm : S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (seasonal.mulakatMode && mulakatIsComplete ? (mulakatDatePast ? theme.error : mulakatUrgencyColor) : '#10B981') + '18', alignItems: 'center', justifyContent: 'center' }}>
                    {renderModeEmojiIcon('💼', 18, seasonal.mulakatMode && mulakatIsComplete ? (mulakatDatePast ? theme.error : mulakatUrgencyColor) : '#10B981')}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'İş Mülakatı' : 'Job Interview'}</Text>
                    {seasonal.mulakatMode && mulakatIsComplete ? (
                      <Text style={{ color: mulakatDatePast ? theme.error : mulakatUrgencyColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>{mulakatDatePast ? (language === 'tr' ? 'Mülakat tarihi geçti' : 'Interview passed') : (language === 'tr' ? `${mulakatDaysLeft} gün kaldı` : `${mulakatDaysLeft} days left`)}</Text>
                    ) : (
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{language === 'tr' ? 'Mülakat tarihine kadar hazırlık planı' : 'Prep plan until your interview date'}</Text>
                    )}
                  </View>
                  <Switch value={seasonal.mulakatMode} onValueChange={(v) => { Haptics.selectionAsync(); if (!v && seasonal.mulakatMode) { const hasItems = mulakatPlanHabitIds.length > 0 || mulakatPlanTaskIds.length > 0; const doClose = () => { mulakatPlanHabitIds.forEach(id => removeHabit(id)); mulakatPlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat')); clearPlanIds('mulakat'); setMulakatNameInput(''); setMulakatDateInput(''); setMulakatExpanded(false); setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); }; if (!hasItems) { doClose(); return; } Alert.alert(language === 'tr' ? 'Mülakat Modu Kapatılıyor' : 'Turning off Interview Mode', language === 'tr' ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?', [{ text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: doClose }]); } else if (v) { setSeasonalPref('mulakatMode', true); } }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (mulakatIsComplete ? mulakatUrgencyColor : '#10B981') + '80' }} thumbColor={seasonal.mulakatMode ? (mulakatIsComplete ? mulakatUrgencyColor : '#10B981') : (isDark ? '#636366' : '#fff')} />
                </View>
              </View>
              {seasonal.mulakatMode && (
                <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                  <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
                  {!mulakatIsComplete && !mulakatExpanded && (<Touchable onPress={() => { Haptics.selectionAsync(); setMulakatExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>{renderModeEmojiIcon('💼', 16, theme.onSurfaceVariant)}<Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Mülakat ekle' : 'Add interview'}</Text><ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} /></Touchable>)}
                  {mulakatIsComplete && !mulakatExpanded && (
                    <View style={{ gap: S.sm }}>
                      <Touchable onPress={() => { Haptics.selectionAsync(); setMulakatExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: (mulakatDatePast ? theme.error : mulakatUrgencyColor) + '30', backgroundColor: (mulakatDatePast ? theme.error : mulakatUrgencyColor) + '08' }} activeOpacity={0.85}>
                        <View style={{ height: 3, backgroundColor: mulakatDatePast ? theme.error : mulakatUrgencyColor }} />
                        <View style={{ padding: S.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>{renderModeEmojiIcon('💼', 16, mulakatUrgencyColor)}<Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{mulakatNameInput}</Text><Text style={{ color: mulakatDatePast ? theme.error : mulakatUrgencyColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text></View>
                          {mulakatDatePast ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {renderModeEmojiIcon('📅', 14, theme.error)}
                              <Text style={{ color: theme.error, fontWeight: '700' }}>
                                {language === 'tr' ? 'Mülakat tarihi geçti' : 'Interview date passed'} · {formatExamDate(mulakatDateInput)}
                              </Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                              <View style={{ alignItems: 'center', minWidth: 52 }}><Text style={{ color: mulakatUrgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{mulakatDaysLeft}</Text><Text style={{ color: mulakatUrgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text></View>
                              <View style={{ flex: 1, paddingTop: 2 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  {renderModeEmojiIcon('📅', 13, theme.onSurfaceVariant)}
                                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{formatExamDate(mulakatDateInput)}</Text>
                                </View>
                                {mulakatPlanHabits.length > 0 && (<View style={{ marginTop: S.sm, gap: 4 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text><Text style={{ color: mulakatUrgencyColor, fontSize: 11, fontWeight: '800' }}>{mulakatHabitsActiveThisWeek}/{mulakatPlanHabits.length} · {mulakatWeekPct}%</Text></View><View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: mulakatUrgencyColor, width: `${mulakatWeekPct}%` as any }} /></View></View>)}
                              </View>
                            </View>
                          )}
                        </View>
                      </Touchable>
                      <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'mulakat', key: Date.now(), mulakatSlot: 'mulakat' }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: mulakatUrgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: mulakatUrgencyColor + '22' }} activeOpacity={0.75}>
                        <BookOpen size={14} color={mulakatUrgencyColor} />
                        <Text style={{ color: mulakatUrgencyColor, fontWeight: '800', fontSize: F.caption }}>{mulakatPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Hazırlık Planı Oluştur' : 'Create Prep Plan')}</Text>
                      </Touchable>

                      {/* İkinci Mülakat */}
                      <View style={{ marginTop: S.xs }}>
                        <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                        {mulakat2IsComplete && !mulakat2Expanded ? (
                          <Touchable onPress={() => { Haptics.selectionAsync(); setMulakat2Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (mulakat2DatePast ? theme.error : mulakat2UrgencyColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
                            {renderModeEmojiIcon('💼', 14, mulakat2UrgencyColor)}
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{mulakat2NameInput}</Text>
                              <Text style={{ color: mulakat2DatePast ? theme.error : mulakat2UrgencyColor, fontSize: 11, fontWeight: '700' }}>{mulakat2DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${mulakat2DaysLeft} gün kaldı` : `${mulakat2DaysLeft} days left`)}</Text>
                            </View>
                            <Text style={{ color: mulakat2UrgencyColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                            <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(language === 'tr' ? 'Mülakatı Sil' : 'Delete Interview', language === 'tr' ? `"${mulakat2NameInput}" silinecek. Emin misin?` : `"${mulakat2NameInput}" will be deleted. Are you sure?`, [{ text: language === 'tr' ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: () => { mulakat2PlanHabitIds.forEach(id => removeHabit(id)); mulakat2PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat2')); clearPlanIds('mulakat2'); setMulakat2NameInput(''); setMulakat2DateInput(''); setMulakat2Expanded(false); setSeasonalPref('mulakat2Name', ''); setSeasonalPref('mulakat2Date', null); } }]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}>
                              <X size={13} color={theme.onSurfaceVariant} strokeWidth={2.5} />
                            </Touchable>
                          </Touchable>
                        ) : !mulakat2IsComplete && !mulakat2Expanded ? (
                          <Touchable onPress={() => { Haptics.selectionAsync(); setMulakat2Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                            <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{language === 'tr' ? 'İkinci mülakat ekle' : 'Add second interview'}</Text>
                          </Touchable>
                        ) : null}
                        {mulakat2Expanded && (
                          <View style={{ gap: S.sm }}>
                            <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}><TextInput value={mulakat2NameInput} onChangeText={(v) => { setMulakat2NameInput(v); setSeasonalPref('mulakat2Name', v); }} placeholder={language === 'tr' ? 'Şirket / Pozisyon (Apple - iOS Dev...)' : 'Company / Role (Apple - iOS Dev...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" /></View>
                            <Touchable onPress={() => { Haptics.selectionAsync(); setShowMulakat2DatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                              <Text style={{ color: mulakat2DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{mulakat2DateInput ? formatExamDate(mulakat2DateInput) : (language === 'tr' ? 'Mülakat tarihi seç' : 'Select interview date')}</Text>
                              <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                            </Touchable>
                            {showMulakat2DatePicker && (
                              <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                                <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                                  <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={mulakat2DateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowMulakat2DatePicker(false); if (event.type === 'dismissed') { setShowMulakat2DatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setMulakat2DateInput(iso); setSeasonalPref('mulakat2Date', iso); if (Platform.OS === 'ios') setShowMulakat2DatePicker(false); } }} />
                                </View>
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', gap: S.sm }}>
                              <Touchable onPress={() => { if (mulakat2NameInput || mulakat2DateInput) { mulakat2PlanHabitIds.forEach(id => removeHabit(id)); mulakat2PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat2')); clearPlanIds('mulakat2'); setMulakat2NameInput(''); setMulakat2DateInput(''); setSeasonalPref('mulakat2Name', ''); setSeasonalPref('mulakat2Date', null); } setMulakat2Expanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                              </Touchable>
                              {mulakat2IsComplete && (<Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setMulakat2Expanded(false); setModePreview({ type: 'mulakat', key: Date.now(), mulakatSlot: 'mulakat2' }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: mulakat2UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}><BookOpen size={13} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></Touchable>)}
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Üçüncü Mülakat */}
                      {mulakat2IsComplete && (
                        <View style={{ marginTop: S.xs }}>
                          <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                          {mulakat3IsComplete && !mulakat3Expanded ? (
                            <Touchable onPress={() => { Haptics.selectionAsync(); setMulakat3Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (mulakat3DatePast ? theme.error : mulakat3UrgencyColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
                              {renderModeEmojiIcon('💼', 14, mulakat3UrgencyColor)}
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{mulakat3NameInput}</Text>
                                <Text style={{ color: mulakat3DatePast ? theme.error : mulakat3UrgencyColor, fontSize: 11, fontWeight: '700' }}>{mulakat3DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${mulakat3DaysLeft} gün kaldı` : `${mulakat3DaysLeft} days left`)}</Text>
                              </View>
                              <Text style={{ color: mulakat3UrgencyColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                              <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(language === 'tr' ? 'Mülakatı Sil' : 'Delete Interview', language === 'tr' ? `"${mulakat3NameInput}" silinecek. Emin misin?` : `"${mulakat3NameInput}" will be deleted. Are you sure?`, [{ text: language === 'tr' ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: () => { mulakat3PlanHabitIds.forEach(id => removeHabit(id)); mulakat3PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat3')); clearPlanIds('mulakat3'); setMulakat3NameInput(''); setMulakat3DateInput(''); setMulakat3Expanded(false); setSeasonalPref('mulakat3Name', ''); setSeasonalPref('mulakat3Date', null); } }]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}>
                                <X size={13} color={theme.onSurfaceVariant} strokeWidth={2.5} />
                              </Touchable>
                            </Touchable>
                          ) : !mulakat3IsComplete && !mulakat3Expanded ? (
                            <Touchable onPress={() => { Haptics.selectionAsync(); setMulakat3Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
                              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{language === 'tr' ? 'Üçüncü mülakat ekle' : 'Add third interview'}</Text>
                            </Touchable>
                          ) : null}
                          {mulakat3Expanded && (
                            <View style={{ gap: S.sm }}>
                              <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}><TextInput value={mulakat3NameInput} onChangeText={(v) => { setMulakat3NameInput(v); setSeasonalPref('mulakat3Name', v); }} placeholder={language === 'tr' ? 'Şirket / Pozisyon (Meta - PM...)' : 'Company / Role (Meta - PM...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" /></View>
                              <Touchable onPress={() => { Haptics.selectionAsync(); setShowMulakat3DatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                                <Text style={{ color: mulakat3DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{mulakat3DateInput ? formatExamDate(mulakat3DateInput) : (language === 'tr' ? 'Mülakat tarihi seç' : 'Select interview date')}</Text>
                                <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                              </Touchable>
                              {showMulakat3DatePicker && (
                                <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                                  <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                                    <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={mulakat3DateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowMulakat3DatePicker(false); if (event.type === 'dismissed') { setShowMulakat3DatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setMulakat3DateInput(iso); setSeasonalPref('mulakat3Date', iso); if (Platform.OS === 'ios') setShowMulakat3DatePicker(false); } }} />
                                  </View>
                                </View>
                              )}
                              <View style={{ flexDirection: 'row', gap: S.sm }}>
                                <Touchable onPress={() => { if (mulakat3NameInput || mulakat3DateInput) { mulakat3PlanHabitIds.forEach(id => removeHabit(id)); mulakat3PlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat3')); clearPlanIds('mulakat3'); setMulakat3NameInput(''); setMulakat3DateInput(''); setSeasonalPref('mulakat3Name', ''); setSeasonalPref('mulakat3Date', null); } setMulakat3Expanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                                </Touchable>
                                {mulakat3IsComplete && (<Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setMulakat3Expanded(false); setModePreview({ type: 'mulakat', key: Date.now(), mulakatSlot: 'mulakat3' }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: mulakat3UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}><BookOpen size={13} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></Touchable>)}
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                  {mulakatExpanded && (
                    <View style={{ gap: S.sm }}>
                      <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}><TextInput value={mulakatNameInput} onChangeText={(v) => { setMulakatNameInput(v); setSeasonalPref('mulakatName', v); }} placeholder={language === 'tr' ? 'Şirket / Pozisyon (Google - SWE...)' : 'Company / Role (Google - SWE...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" /></View>
                      <Touchable onPress={() => { Haptics.selectionAsync(); setShowMulakatDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}><Text style={{ color: mulakatDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{mulakatDateInput ? formatExamDate(mulakatDateInput) : (language === 'tr' ? 'Mülakat tarihi seç' : 'Select interview date')}</Text><CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} /></Touchable>
                      {showMulakatDatePicker && (
                        <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                          <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                            <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={mulakatDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowMulakatDatePicker(false); if (event.type === 'dismissed') { setShowMulakatDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setMulakatDateInput(iso); setSeasonalPref('mulakatDate', iso); if (Platform.OS === 'ios') setShowMulakatDatePicker(false); } }} />
                          </View>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: S.sm }}>
                        <Touchable onPress={() => { setMulakatExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}><Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text></Touchable>
                        {mulakatIsComplete && (<Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setMulakatExpanded(false); setModePreview({ type: 'mulakat', key: Date.now(), mulakatSlot: 'mulakat' }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: mulakatUrgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}><BookOpen size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></Touchable>)}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* ── Spor / Fiziksel Hedef ── */}
            <View style={[styles.modeCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.sporMode && sporIsComplete ? (sporDatePast ? theme.error + '40' : sporColor + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }]}>
              <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.sporMode ? S.sm : S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: sporColor + '18', alignItems: 'center', justifyContent: 'center' }}>
                    {renderModeEmojiIcon('🏋️', 18, sporColor)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Spor / Fiziksel Hedef' : 'Sport / Physical Goal'}</Text>
                    {seasonal.sporMode && sporIsComplete ? (
                      <Text style={{ color: sporDatePast ? theme.error : sporColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>{sporDatePast ? (language === 'tr' ? 'Hedef tarihi geçti' : 'Goal date passed') : (language === 'tr' ? `${sporDaysLeft} gün kaldı` : `${sporDaysLeft} days left`)}</Text>
                    ) : (
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{language === 'tr' ? 'Uzman destekli antrenman & beslenme planı' : 'Expert-backed training & nutrition plan'}</Text>
                    )}
                  </View>
                  <Switch
                    value={seasonal.sporMode}
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      if (!v && seasonal.sporMode) {
                        const hasItems = sporPlanHabitIds.length > 0 || sporPlanTaskIds.length > 0;
                        const doClose = () => {
                          sporPlanHabitIds.forEach(id => removeHabit(id));
                          sporPlanTaskIds.forEach(id => retirePlanTask(id, 'spor'));
                          clearPlanIds('spor');
                          setSporGoalInput(''); setSporDateInput('');
                          setSporExpanded(false);
                          resetSporInputs();
                          setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null);
                        };
                        if (!hasItems) { doClose(); return; }
                        Alert.alert(
                          language === 'tr' ? 'Spor Modu Kapatılıyor' : 'Turning off Sport Mode',
                          language === 'tr' ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?',
                          [
                            { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                            { text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: doClose },
                          ]
                        );
                      } else if (v) {
                        setSeasonalPref('sporMode', true);
                      }
                    }}
                    trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: sporColor + '80' }}
                    thumbColor={seasonal.sporMode ? sporColor : (isDark ? '#636366' : '#fff')}
                  />
                </View>
              </View>

              {seasonal.sporMode && (
                <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                  <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />

                  {!sporIsComplete && !sporExpanded && (
                    <Touchable onPress={() => { Haptics.selectionAsync(); setSporExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
                      {renderModeEmojiIcon('🏋️', 16, theme.onSurfaceVariant)}
                      <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Hedef ekle' : 'Add goal'}</Text>
                      <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
                    </Touchable>
                  )}

                  {sporIsComplete && !sporExpanded && (
                    <View style={{ gap: S.sm }}>
                      <Touchable onPress={() => { Haptics.selectionAsync(); setSporExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: (sporDatePast ? theme.error : sporColor) + '30', backgroundColor: (sporDatePast ? theme.error : sporColor) + '08' }} activeOpacity={0.85}>
                        <View style={{ height: 3, backgroundColor: sporDatePast ? theme.error : sporColor }} />
                        <View style={{ padding: S.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
                            {renderModeEmojiIcon(sporType === 'kilo' ? '⚖️' : sporType === 'maraton' ? '🏃' : sporType === 'yaris' ? '🏆' : sporType === 'genel' ? '✨' : '💪', 16, sporColor)}
                            <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{stripEmojiPrefix(sporGoalInput)}</Text>
                            <Text style={{ color: sporDatePast ? theme.error : sporColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                          </View>
                          {sporDatePast ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {renderModeEmojiIcon('📅', 14, theme.error)}
                              <Text style={{ color: theme.error, fontWeight: '700' }}>
                                {language === 'tr' ? 'Hedef tarihi geçti' : 'Goal date passed'} · {formatExamDate(sporDateInput)}
                              </Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                              <View style={{ alignItems: 'center', minWidth: 52 }}>
                                <Text style={{ color: sporColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{sporDaysLeft}</Text>
                                <Text style={{ color: sporColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text>
                              </View>
                              <View style={{ flex: 1, paddingTop: 2 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  {renderModeEmojiIcon('📅', 13, theme.onSurfaceVariant)}
                                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{formatExamDate(sporDateInput)}</Text>
                                </View>
                                {sporPlanHabits.length > 0 && (
                                  <View style={{ marginTop: S.sm, gap: 4 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text>
                                      <Text style={{ color: sporColor, fontSize: 11, fontWeight: '800' }}>{sporHabitsActiveThisWeek}/{sporPlanHabits.length} · {sporWeekPct}%</Text>
                                    </View>
                                    <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                      <View style={{ height: 5, borderRadius: 3, backgroundColor: sporColor, width: `${sporWeekPct}%` as any }} />
                                    </View>
                                  </View>
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      </Touchable>

                      {/* ── Weight log (kilo modu) ── */}
                      {sporType === 'kilo' && !sporDatePast && (
                        <View style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                          {/* Header + progress bar */}
                          <View style={{ paddingHorizontal: S.md, paddingTop: S.sm + 2, paddingBottom: S.sm, gap: S.xs }}>
                            {cwNum > 0 && twNum > 0 && (
                              <View style={{ gap: 6 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.onSurfaceVariant }}>{language === 'tr' ? 'Başlangıç' : 'Start'}: {cwNum} kg</Text>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: sporColor }}>
                                    {latestWeight ? `${latestWeight} kg` : '—'}
                                  </Text>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.onSurfaceVariant }}>{language === 'tr' ? 'Hedef' : 'Goal'}: {twNum} kg</Text>
                                </View>
                                {latestWeight && cwNum !== twNum && (
                                  <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                    <View style={{ height: 5, borderRadius: 3, backgroundColor: sporColor, width: `${Math.min(100, Math.round(Math.abs(cwNum - latestWeight) / Math.abs(cwNum - twNum) * 100))}%` as any }} />
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                          {/* Log entries */}
                          {weightLog.slice(0, 4).map((entry, idx) => {
                            const prev = weightLog[idx + 1];
                            const diff = prev ? Math.round((entry.weight - prev.weight) * 10) / 10 : null;
                            const diffStr = diff === null ? (language === 'tr' ? 'başlangıç' : 'start') : diff > 0 ? `+${diff}` : `${diff}`;
                            const diffColor = diff === null ? theme.onSurfaceVariant : (twNum < cwNum ? (diff < 0 ? '#10B981' : '#EF4444') : (diff > 0 ? '#10B981' : '#EF4444'));
                            const d = new Date(entry.date);
                            const dateStr = d.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' });
                            return (
                              <View key={entry.date} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 7, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: idx === 0 ? sporColor : theme.onSurfaceVariant, opacity: idx === 0 ? 1 : 0.3, marginRight: S.sm }} />
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: 12, fontWeight: '600', width: 56 }}>{dateStr}</Text>
                                <Text style={{ color: theme.onSurface, fontSize: 13, fontWeight: '800', flex: 1 }}>{entry.weight} kg</Text>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: diffColor }}>{diffStr}</Text>
                              </View>
                            );
                          })}
                          {/* Weekly prompt or add entry */}
                          {showWeightEntry ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', gap: S.sm }}>
                              <TextInput
                                value={weightEntryInput}
                                onChangeText={setWeightEntryInput}
                                placeholder={language === 'tr' ? 'Kg gir (örn: 70.5)' : 'Enter kg (e.g. 70.5)'}
                                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'}
                                keyboardType="decimal-pad"
                                style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '700', height: 36, paddingVertical: 0 }}
                                autoFocus
                                returnKeyType="done"
                                underlineColorAndroid="transparent"
                                onSubmitEditing={() => {
                                  const v = parseFloat(weightEntryInput.replace(',', '.'));
                                  if (!isNaN(v) && v > 20 && v < 300) saveWeightEntry(v);
                                }}
                              />
                              <Touchable onPress={() => { const v = parseFloat(weightEntryInput.replace(',', '.')); if (!isNaN(v) && v > 20 && v < 300) saveWeightEntry(v); }} style={{ backgroundColor: sporColor, borderRadius: R.full, paddingHorizontal: S.md, height: 32, alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.8}>
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Kaydet' : 'Save'}</Text>
                              </Touchable>
                              <Touchable onPress={() => { setShowWeightEntry(false); setWeightEntryInput(''); }} style={{ padding: 4 }} activeOpacity={0.7}>
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{language === 'tr' ? 'İptal' : 'Cancel'}</Text>
                              </Touchable>
                            </View>
                          ) : (
                            <Touchable onPress={() => { Haptics.selectionAsync(); setShowWeightEntry(true); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm + 2, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', backgroundColor: thisWeekWeight ? 'transparent' : sporColor + '08' }} activeOpacity={0.7}>
                              {renderModeEmojiIcon('⚖️', 14, thisWeekWeight ? theme.onSurfaceVariant : sporColor)}
                              <Text style={{ fontSize: F.caption, fontWeight: '800', color: thisWeekWeight ? theme.onSurfaceVariant : sporColor }}>
                                {thisWeekWeight ? (language === 'tr' ? `Bu hafta kaydedildi · ${thisWeekWeight.weight} kg` : `Logged this week · ${thisWeekWeight.weight} kg`) : (language === 'tr' ? 'Bu haftaki tartımı gir' : 'Log this week\'s weight')}
                              </Text>
                            </Touchable>
                          )}
                        </View>
                      )}

                      {!sporDatePast && (
                        <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'spor', key: Date.now(), sporSlot: 'spor' }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: sporColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: sporColor + '22' }} activeOpacity={0.75}>
                          {renderModeEmojiIcon(sporType === 'kilo' ? '⚖️' : sporType === 'maraton' ? '🏃' : sporType === 'genel' ? '✨' : '💪', 14, sporColor)}
                          <Text style={{ color: sporColor, fontWeight: '800', fontSize: F.caption }}>{sporPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Antrenman Planı Oluştur' : 'Create Training Plan')}</Text>
                        </Touchable>
                      )}

                      {/* İkinci Spor Hedefi */}
                      <View style={{ marginTop: S.xs }}>
                        <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                        {spor2IsComplete && !spor2Expanded ? (
                          <Touchable onPress={() => { Haptics.selectionAsync(); setSpor2Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (spor2DatePast ? theme.error : sporColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
                            {renderModeEmojiIcon(getEmojiFromLabel(spor2GoalInput) || '🏋️', 14, sporColor)}
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{stripEmojiPrefix(spor2GoalInput)}</Text>
                              <Text style={{ color: spor2DatePast ? theme.error : sporColor, fontSize: 11, fontWeight: '700' }}>{spor2DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${spor2DaysLeft} gün kaldı` : `${spor2DaysLeft} days left`)}</Text>
                            </View>
                            <Text style={{ color: sporColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                            <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(language === 'tr' ? 'Hedefi Sil' : 'Delete Goal', language === 'tr' ? `"${spor2GoalInput}" silinecek. Emin misin?` : `"${spor2GoalInput}" will be deleted. Are you sure?`, [{ text: language === 'tr' ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: () => { spor2PlanHabitIds.forEach(id => removeHabit(id)); spor2PlanTaskIds.forEach(id => retirePlanTask(id, 'spor2')); clearPlanIds('spor2'); setSpor2GoalInput(''); setSpor2DateInput(''); setSpor2Expanded(false); setSeasonalPref('spor2Goal', ''); setSeasonalPref('spor2Date', null); } }]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}>
                              <X size={13} color={theme.onSurfaceVariant} strokeWidth={2.5} />
                            </Touchable>
                          </Touchable>
                        ) : !spor2IsComplete && !spor2Expanded ? (
                          <Touchable onPress={() => { Haptics.selectionAsync(); setSpor2Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                            <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{language === 'tr' ? 'İkinci fiziksel hedef ekle' : 'Add second physical goal'}</Text>
                          </Touchable>
                        ) : null}
                        {spor2Expanded && (
                          <View style={{ gap: S.sm }}>
                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Hedef türünü seç' : 'Select goal type'}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
                              {SPOR_GOALS.map((g) => {
                                const active = spor2GoalInput === g.label;
                                return (
                                  <Touchable
                                    key={g.key}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      const val = active ? '' : g.label;
                                      setSpor2GoalInput(val);
                                      setSeasonalPref('spor2Goal', val);
                                    }}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                      paddingHorizontal: S.sm + 2,
                                      paddingVertical: 8,
                                      borderRadius: R.full,
                                      borderWidth: B.medium,
                                      borderColor: active ? sporColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                                      backgroundColor: active ? sporColor + '18' : 'transparent'
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    {renderModeEmojiIcon(getEmojiFromLabel(g.label), 14, active ? sporColor : theme.onSurfaceVariant)}
                                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? sporColor : theme.onSurfaceVariant }}>
                                      {stripEmojiPrefix(g.label)}
                                    </Text>
                                  </Touchable>
                                );
                              })}
                            </View>
                            <Touchable onPress={() => { Haptics.selectionAsync(); setShowSpor2DatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                              <Text style={{ color: spor2DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{spor2DateInput ? formatExamDate(spor2DateInput) : (language === 'tr' ? 'Hedef tarihi seç' : 'Select target date')}</Text>
                              <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                            </Touchable>
                            {showSpor2DatePicker && (
                              <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                                <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                                  <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={spor2DateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowSpor2DatePicker(false); if (event.type === 'dismissed') { setShowSpor2DatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setSpor2DateInput(iso); setSeasonalPref('spor2Date', iso); if (Platform.OS === 'ios') setShowSpor2DatePicker(false); } }} />
                                </View>
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', gap: S.sm }}>
                              <Touchable onPress={() => { if (spor2GoalInput || spor2DateInput) { spor2PlanHabitIds.forEach(id => removeHabit(id)); spor2PlanTaskIds.forEach(id => retirePlanTask(id, 'spor2')); clearPlanIds('spor2'); setSpor2GoalInput(''); setSpor2DateInput(''); setSeasonalPref('spor2Goal', ''); setSeasonalPref('spor2Date', null); } setSpor2Expanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                              </Touchable>
                              {spor2IsComplete && (
                                <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSpor2Expanded(false); setModePreview({ type: 'spor', key: Date.now(), sporSlot: 'spor2' }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: sporColor, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}>
                                  {renderModeEmojiIcon('🏋️', 13, '#fff')}
                                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                                </Touchable>
                              )}
                            </View>
                          </View>
                        )}
                      </View>

                      {/* Üçüncü Spor Hedefi */}
                      {spor2IsComplete && (
                        <View style={{ marginTop: S.xs }}>
                          <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                          {spor3IsComplete && !spor3Expanded ? (
                            <Touchable onPress={() => { Haptics.selectionAsync(); setSpor3Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (spor3DatePast ? theme.error : sporColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
                              {renderModeEmojiIcon(getEmojiFromLabel(spor3GoalInput) || '🏋️', 14, sporColor)}
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{stripEmojiPrefix(spor3GoalInput)}</Text>
                                <Text style={{ color: spor3DatePast ? theme.error : sporColor, fontSize: 11, fontWeight: '700' }}>{spor3DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${spor3DaysLeft} gün kaldı` : `${spor3DaysLeft} days left`)}</Text>
                              </View>
                              <Text style={{ color: sporColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                              <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(language === 'tr' ? 'Hedefi Sil' : 'Delete Goal', language === 'tr' ? `"${spor3GoalInput}" silinecek. Emin misin?` : `"${spor3GoalInput}" will be deleted. Are you sure?`, [{ text: language === 'tr' ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: () => { spor3PlanHabitIds.forEach(id => removeHabit(id)); spor3PlanTaskIds.forEach(id => retirePlanTask(id, 'spor3')); clearPlanIds('spor3'); setSpor3GoalInput(''); setSpor3DateInput(''); setSpor3Expanded(false); setSeasonalPref('spor3Goal', ''); setSeasonalPref('spor3Date', null); } }]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}>
                                <X size={13} color={theme.onSurfaceVariant} strokeWidth={2.5} />
                              </Touchable>
                            </Touchable>
                          ) : !spor3IsComplete && !spor3Expanded ? (
                            <Touchable onPress={() => { Haptics.selectionAsync(); setSpor3Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
                              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{language === 'tr' ? 'Üçüncü fiziksel hedef ekle' : 'Add third physical goal'}</Text>
                            </Touchable>
                          ) : null}
                          {spor3Expanded && (
                            <View style={{ gap: S.sm }}>
                              <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Hedef türünü seç' : 'Select goal type'}</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
                                {SPOR_GOALS.map((g) => {
                                  const active = spor3GoalInput === g.label;
                                  return (
                                    <Touchable
                                      key={g.key}
                                      onPress={() => {
                                        Haptics.selectionAsync();
                                        const val = active ? '' : g.label;
                                        setSpor3GoalInput(val);
                                        setSeasonalPref('spor3Goal', val);
                                      }}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        paddingHorizontal: S.sm + 2,
                                        paddingVertical: 8,
                                        borderRadius: R.full,
                                        borderWidth: B.medium,
                                        borderColor: active ? sporColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                                        backgroundColor: active ? sporColor + '18' : 'transparent'
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      {renderModeEmojiIcon(getEmojiFromLabel(g.label), 14, active ? sporColor : theme.onSurfaceVariant)}
                                      <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? sporColor : theme.onSurfaceVariant }}>
                                        {stripEmojiPrefix(g.label)}
                                      </Text>
                                    </Touchable>
                                  );
                                })}
                              </View>
                              <Touchable onPress={() => { Haptics.selectionAsync(); setShowSpor3DatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                                <Text style={{ color: spor3DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{spor3DateInput ? formatExamDate(spor3DateInput) : (language === 'tr' ? 'Hedef tarihi seç' : 'Select target date')}</Text>
                                <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                              </Touchable>
                              {showSpor3DatePicker && (
                                <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                                  <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                                    <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={spor3DateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowSpor3DatePicker(false); if (event.type === 'dismissed') { setShowSpor3DatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setSpor3DateInput(iso); setSeasonalPref('spor3Date', iso); if (Platform.OS === 'ios') setShowSpor3DatePicker(false); } }} />
                                  </View>
                                </View>
                              )}
                              <View style={{ flexDirection: 'row', gap: S.sm }}>
                                <Touchable onPress={() => { if (spor3GoalInput || spor3DateInput) { spor3PlanHabitIds.forEach(id => removeHabit(id)); spor3PlanTaskIds.forEach(id => retirePlanTask(id, 'spor3')); clearPlanIds('spor3'); setSpor3GoalInput(''); setSpor3DateInput(''); setSeasonalPref('spor3Goal', ''); setSeasonalPref('spor3Date', null); } setSpor3Expanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                                </Touchable>
                                {spor3IsComplete && (
                                  <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSpor3Expanded(false); setModePreview({ type: 'spor', key: Date.now(), sporSlot: 'spor3' }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: sporColor, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}>
                                    {renderModeEmojiIcon('🏋️', 13, '#fff')}
                                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                                  </Touchable>
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── Expanded setup form ── */}
                  {sporExpanded && (
                    <View style={{ gap: S.sm }}>
                      {/* Goal type chips */}
                      <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Hedef türünü seç' : 'Select goal type'}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
                        {SPOR_GOALS.map((g) => {
                          const active = sporGoalInput === g.label;
                          return (
                            <Touchable
                              key={g.key}
                              onPress={() => {
                                Haptics.selectionAsync();
                                const val = active ? '' : g.label;
                                const newType = val ? detectSporType(val) : null;
                                const hasActivePlan = sporPlanHabitIds.length > 0 || sporPlanTaskIds.length > 0;
                                const typeChanged = newType !== sporType && hasActivePlan;
                                const apply = () => {
                                  setSporGoalInput(val);
                                  setSeasonalPref('sporGoal', val);
                                  if (newType === 'kilo') {
                                    if (!currentWeight || parseFloat(currentWeight) <= 0) {
                                      setCurrentWeight('75');
                                    }
                                    if (!targetWeight || parseFloat(targetWeight) <= 0) {
                                      setTargetWeight('70');
                                    }
                                  }
                                };
                                if (typeChanged) {
                                  Alert.alert(
                                    language === 'tr' ? 'Hedef Türü Değişiyor' : 'Goal Type Changing',
                                    language === 'tr' ? 'Mevcut plan alışkanlık ve görevleri kaldırılacak. Devam et?' : 'Existing plan habits and tasks will be removed. Continue?',
                                    [
                                      { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                                      { text: language === 'tr' ? 'Devam Et' : 'Continue', style: 'destructive', onPress: () => {
                                        sporPlanHabitIds.forEach(id => removeHabit(id));
                                        sporPlanTaskIds.forEach(id => retirePlanTask(id, 'spor'));
                                        clearPlanIds('spor');
                                        apply();
                                      }},
                                    ]
                                  );
                                } else { apply(); }
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: S.sm + 2,
                                paddingVertical: 8,
                                borderRadius: R.full,
                                borderWidth: B.medium,
                                borderColor: active ? sporColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                                backgroundColor: active ? sporColor + '18' : 'transparent'
                              }}
                              activeOpacity={0.7}
                            >
                              {renderModeEmojiIcon(getEmojiFromLabel(g.label), 14, active ? sporColor : theme.onSurfaceVariant)}
                              <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? sporColor : theme.onSurfaceVariant }}>
                                {stripEmojiPrefix(g.label)}
                              </Text>
                            </Touchable>
                          );
                        })}
                      </View>

                      {/* Kilo: current + target weight wheel pickers */}
                      {sporType === 'kilo' && (
                        <View style={{ gap: S.sm }}>
                          {/* Boy + Yaş */}
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.8 }}>
                            {language === 'tr' ? 'Beden bilgileri' : 'Body info'}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: S.sm }}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: R.md, paddingHorizontal: S.md, height: 44, borderWidth: B.thin, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', gap: S.xs }}>
                              <TextInput
                                value={heightCm}
                                onChangeText={setHeightCm}
                                placeholder={language === 'tr' ? 'Boy (cm)' : 'Height (cm)'}
                                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'}
                                keyboardType="number-pad"
                                style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '700', paddingVertical: 0 }}
                                returnKeyType="next"
                                underlineColorAndroid="transparent"
                              />
                              <Text style={{ color: theme.onSurfaceVariant, fontSize: 12, fontWeight: '600', opacity: 0.6 }}>cm</Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: R.md, paddingHorizontal: S.md, height: 44, borderWidth: B.thin, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', gap: S.xs }}>
                              <TextInput
                                value={ageYears}
                                onChangeText={setAgeYears}
                                placeholder={language === 'tr' ? 'Yaş' : 'Age'}
                                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'}
                                keyboardType="number-pad"
                                style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '700', paddingVertical: 0 }}
                                returnKeyType="done"
                                underlineColorAndroid="transparent"
                              />
                              <Text style={{ color: theme.onSurfaceVariant, fontSize: 12, fontWeight: '600', opacity: 0.6 }}>{language === 'tr' ? 'yaş' : 'yrs'}</Text>
                            </View>
                          </View>

                          {/* Cinsiyet seçici */}
                          <View style={{ flexDirection: 'row', gap: S.sm }}>
                            {(['male', 'female'] as const).map((g) => (
                              <Touchable
                                key={g}
                                onPress={() => setGender(gender === g ? '' : g)}
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, borderRadius: R.md, height: 40, borderWidth: B.medium, backgroundColor: gender === g ? (sporColor + '20') : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow), borderColor: gender === g ? sporColor : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }}
                                activeOpacity={0.75}
                              >
                                <Text style={{ fontSize: 15 }}>{g === 'male' ? '👨' : '👩'}</Text>
                                <Text style={{ fontSize: F.caption, fontWeight: '800', color: gender === g ? sporColor : theme.onSurfaceVariant }}>
                                  {language === 'tr' ? (g === 'male' ? 'Erkek' : 'Kadın') : (g === 'male' ? 'Male' : 'Female')}
                                </Text>
                              </Touchable>
                            ))}
                          </View>

                          {/* Kilo wheel pickers */}
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.8, marginTop: S.xs }}>
                            {language === 'tr' ? 'Kilo bilgileri (kaydırarak seçin)' : 'Weight info (scroll to select)'}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: S.sm, justifyContent: 'center', alignItems: 'center' }}>
                            {/* Current Weight Wheel */}
                            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.onSurfaceVariant, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {language === 'tr' ? 'Şu Anki' : 'Current'}
                              </Text>
                              <WeightWheelPicker
                                value={cwNum > 0 ? Math.round(cwNum) : 75}
                                onChange={(val) => setCurrentWeight(val.toString())}
                                theme={theme}
                                isDark={isDark}
                                sporColor={sporColor}
                              />
                            </View>

                            {/* Divider line */}
                            <View style={{ width: 1, height: 80, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginTop: 15 }} />

                            {/* Target Weight Wheel */}
                            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: theme.onSurfaceVariant, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {language === 'tr' ? 'Hedef' : 'Target'}
                              </Text>
                              <WeightWheelPicker
                                value={twNum > 0 ? Math.round(twNum) : 70}
                                onChange={(val) => setTargetWeight(val.toString())}
                                theme={theme}
                                isDark={isDark}
                                sporColor={sporColor}
                              />
                            </View>
                          </View>

                          {/* Validasyon mesajları */}
                          {cwNum > 0 && !kiloWeightValid && (
                            <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700', lineHeight: 16 }}>
                              {language === 'tr'
                                ? '❌ Kilo değerleri 30–300 kg arasında olmalıdır.'
                                : '❌ Weight values must be between 30–300 kg.'}
                            </Text>
                          )}
                          {cwNum > 0 && twNum > 0 && kiloWeightValid && !kiloWeightRealistic && (
                            <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700', lineHeight: 16 }}>
                              {language === 'tr'
                                ? '❌ Mevcut ve hedef kilo arasındaki fark 100 kg\'ı geçemez. Lütfen gerçekçi bir hedef girin.'
                                : '❌ The difference between current and target weight cannot exceed 100 kg. Please set a realistic goal.'}
                            </Text>
                          )}
                          {kiloBmiCurrentUnderweight && (
                            <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '700', lineHeight: 16 }}>
                              {language === 'tr'
                                ? `⚠️ Mevcut kilonuz zaten sağlıklı aralığın altında (BMI < 18.5). Bir uzmana danışmanızı öneririz.`
                                : `⚠️ Your current weight is already below the healthy range (BMI < 18.5). We recommend consulting a specialist.`}
                            </Text>
                          )}
                          {kiloBmiTargetTooLow && (
                            <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700', lineHeight: 16 }}>
                              {language === 'tr'
                                ? `❌ ${twNum} kg, ${hnNum} cm boy için sağlıklı minimum kilonun (${minHealthyKg} kg, BMI 18.5) altında. Bu hedefi onaylamıyoruz.`
                                : `❌ ${twNum} kg is below the minimum healthy weight (${minHealthyKg} kg, BMI 18.5) for ${hnNum} cm height. We cannot approve this goal.`}
                            </Text>
                          )}
                          {cwNum > 0 && twNum > 0 && cwNum === twNum && (
                            <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '700' }}>
                              {language === 'tr' ? '🎯 Zaten hedef kilondasın! Koruma moduna geç.' : '🎯 Already at your goal weight! Switch to maintenance mode.'}
                            </Text>
                          )}
                          {cwNum > 0 && twNum > 0 && cwNum !== twNum && kiloWeightValid && kiloWeightRealistic && kiloBmiValid && (
                            <Text style={{ fontSize: 12, color: sporColor, fontWeight: '700', opacity: 0.9 }}>
                              {language === 'tr'
                                ? `${twNum > cwNum ? '📈' : '📉'} ${Math.abs(cwNum - twNum)} kg · haftada ${kiloWeeklyRate} kg ile ~${kiloAutoWeeks} hafta`
                                : `${twNum > cwNum ? '📈' : '📉'} ${Math.abs(cwNum - twNum)} kg · at ${kiloWeeklyRate} kg/week ~${kiloAutoWeeks} weeks`}
                            </Text>
                          )}
                          {cwNum > 0 && twNum > 0 && kiloWeightValid && kiloWeightRealistic && kiloBmiValid && Math.abs(cwNum - twNum) > 30 && (
                            <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700', lineHeight: 16 }}>
                              {language === 'tr'
                                ? '⚠️ 30 kg üzeri hedefler için bir doktor veya diyetisyen desteği önerilir.'
                                : '⚠️ For goals over 30 kg, consulting a doctor or dietitian is recommended.'}
                            </Text>
                          )}
                          {/* Sağlıklı kilo aralığı ipucu */}
                          {heightM > 0 && !kiloBmiTargetTooLow && twNum > 0 && (
                            <Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.55, lineHeight: 15 }}>
                              {language === 'tr'
                                ? `${hnNum} cm için sağlıklı aralık: ${minHealthyKg}–${maxHealthyKg} kg`
                                : `Healthy range for ${hnNum} cm: ${minHealthyKg}–${maxHealthyKg} kg`}
                            </Text>
                          )}
                        </View>
                      )}

                      {/* Maraton: weekly km + event */}
                      {sporType === 'maraton' && (
                        <View style={{ gap: S.xs }}>
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Mevcut haftalık km' : 'Current weekly km'}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: R.md, paddingHorizontal: S.md, height: 44, borderWidth: B.thin, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}>
                            <TextInput value={weeklyKm} onChangeText={setWeeklyKm} placeholder={language === 'tr' ? 'Örn: 15' : 'e.g. 15'} placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} keyboardType="numeric" style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '700', paddingVertical: 0 }} returnKeyType="done" underlineColorAndroid="transparent" />
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>km/hft</Text>
                          </View>
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.8, marginTop: 2 }}>{language === 'tr' ? 'Hedef mesafe' : 'Target distance'}</Text>
                          <View style={{ flexDirection: 'row', gap: S.xs }}>
                            {TARGET_EVENTS.map(ev => (
                              <Touchable key={ev} onPress={() => { Haptics.selectionAsync(); setTargetEvent(targetEvent === ev ? '' : ev); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: R.md, borderWidth: B.medium, borderColor: targetEvent === ev ? sporColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: targetEvent === ev ? sporColor + '18' : 'transparent' }} activeOpacity={0.7}>
                                <Text style={{ fontSize: F.caption, fontWeight: '700', color: targetEvent === ev ? sporColor : theme.onSurfaceVariant }}>{ev}</Text>
                              </Touchable>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Güç / Genel / Yarışma: training days */}
                      {(sporType === 'guc' || sporType === 'genel' || sporType === 'yaris') && (
                        <View style={{ gap: S.xs }}>
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Haftada kaç gün antrenman?' : 'How many days/week?'}</Text>
                          <View style={{ flexDirection: 'row', gap: S.sm }}>
                            {([3, 4, 5] as const).map(d => (
                              <Touchable key={d} onPress={() => { Haptics.selectionAsync(); setTrainingDays(trainingDays === d ? null : d); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.md, borderWidth: B.medium, borderColor: trainingDays === d ? sporColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: trainingDays === d ? sporColor + '18' : 'transparent' }} activeOpacity={0.7}>
                                <Text style={{ fontSize: F.body, fontWeight: '900', color: trainingDays === d ? sporColor : theme.onSurface }}>{d}</Text>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: trainingDays === d ? sporColor : theme.onSurfaceVariant, opacity: 0.7, marginTop: 1 }}>{language === 'tr' ? 'gün' : 'days'}</Text>
                              </Touchable>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Date picker — kilo için otomatik, diğerleri için manual */}
                      {sporType === 'kilo' ? (
                        kiloAutoDate && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: R.md, paddingHorizontal: S.md, height: 40, borderWidth: B.thin, backgroundColor: sporColor + '08', borderColor: sporColor + '30' }}>
                            {renderModeEmojiIcon('📅', 14, sporColor)}
                            <Text style={{ color: sporColor, fontSize: F.caption, fontWeight: '700', flex: 1 }}>
                              {language === 'tr' ? `Tahmini hedef: ${formatExamDate(kiloAutoDate)}` : `Estimated completion: ${formatExamDate(kiloAutoDate)}`}
                            </Text>
                          </View>
                        )
                      ) : (
                        <>
                          <Touchable onPress={() => { Haptics.selectionAsync(); setShowSporDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                            <Text style={{ color: sporDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{sporDateInput ? formatExamDate(sporDateInput) : (language === 'tr' ? 'Hedef tarihi seç' : 'Select target date')}</Text>
                            <CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} />
                          </Touchable>
                          {showSporDatePicker && (
                            <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                              <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : null}>
                                <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={sporDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowSporDatePicker(false); if (event.type === 'dismissed') { setShowSporDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setSporDateInput(iso); setSeasonalPref('sporDate', iso); if (Platform.OS === 'ios') setShowSporDatePicker(false); } }} />
                              </View>
                            </View>
                          )}
                        </>
                      )}

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: S.sm }}>
                        <Touchable onPress={() => { setSporExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                        </Touchable>
                        {sporIsComplete && (
                          <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSporExpanded(false); setModePreview({ type: 'spor', key: Date.now(), sporSlot: 'spor' }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: sporColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}>
                            {renderModeEmojiIcon(sporType === 'kilo' ? '⚖️' : sporType === 'maraton' ? '🏃' : sporType === 'yaris' ? '🏆' : sporType === 'genel' ? '✨' : '💪', 13, '#fff')}
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                          </Touchable>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <BottomNavBar />

      {modePreview && (
        <TurkishModeBanner
          key={modePreview.key}
          defaultTemplateId={modePreview.templateId}
          mode={getModePreview(modePreview.type, {
            examName: modePreview.examName ?? examNameInput,
            examDate: modePreview.examDate ?? examDateInput,
            examTipTr: modePreview.examTipTr,
            examTipEn: modePreview.examTipEn,
            tezName: tezNameInput,
            tezDate: tezDateInput,
            mulakatName: modePreview.mulakatSlot === 'mulakat2' ? mulakat2NameInput : modePreview.mulakatSlot === 'mulakat3' ? mulakat3NameInput : mulakatNameInput,
            mulakatDate: modePreview.mulakatSlot === 'mulakat2' ? mulakat2DateInput : modePreview.mulakatSlot === 'mulakat3' ? mulakat3DateInput : mulakatDateInput,
            sporGoal: modePreview.sporSlot === 'spor2' ? spor2GoalInput : modePreview.sporSlot === 'spor3' ? spor3GoalInput : sporGoalInput,
            sporDate: modePreview.sporSlot === 'spor2' ? spor2DateInput : modePreview.sporSlot === 'spor3' ? spor3DateInput : effectiveSporDate,
            sporInputs: modePreview.sporSlot === 'spor' ? {
              currentWeight: cwNum > 0 ? cwNum : undefined,
              targetWeight: twNum > 0 ? twNum : undefined,
              weeklyKm: weeklyKm ? parseFloat(weeklyKm) : undefined,
              targetEvent: targetEvent || undefined,
              trainingDays: trainingDays ?? undefined,
              gender: gender || undefined,
            } : undefined,
          })}
          onDismiss={() => {
            const t = modePreview.type;
            if (t === 'ramazan' && ramazanPlanHabitIds.length === 0) { setSeasonalPref('ramazan', false); }
            else if (t === 'tez' && tezPlanHabitIds.length === 0) { setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); setTezNameInput(''); setTezDateInput(''); }
            else if (t === 'mulakat') {
              const slot = modePreview.mulakatSlot ?? 'mulakat';
              if (slot === 'mulakat2' && mulakat2PlanHabitIds.length === 0) { setSeasonalPref('mulakat2Name', ''); setSeasonalPref('mulakat2Date', null); setMulakat2NameInput(''); setMulakat2DateInput(''); }
              else if (slot === 'mulakat3' && mulakat3PlanHabitIds.length === 0) { setSeasonalPref('mulakat3Name', ''); setSeasonalPref('mulakat3Date', null); setMulakat3NameInput(''); setMulakat3DateInput(''); }
              else if (slot === 'mulakat' && mulakatPlanHabitIds.length === 0) { setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); setMulakatNameInput(''); setMulakatDateInput(''); }
            }
            else if (t === 'spor') {
              const slot = modePreview.sporSlot ?? 'spor';
              if (slot === 'spor2' && spor2PlanHabitIds.length === 0) { setSeasonalPref('spor2Goal', ''); setSeasonalPref('spor2Date', null); setSpor2GoalInput(''); setSpor2DateInput(''); }
              else if (slot === 'spor3' && spor3PlanHabitIds.length === 0) { setSeasonalPref('spor3Goal', ''); setSeasonalPref('spor3Date', null); setSpor3GoalInput(''); setSpor3DateInput(''); }
              else if (slot === 'spor' && sporPlanHabitIds.length === 0) { setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null); setSporGoalInput(''); setSporDateInput(''); resetSporInputs(); }
            }
            setModePreview(null);
          }}
          onSheetClose={() => {
            const t = modePreview?.type;
            if (!t) return;
            if (t === 'ramazan' && ramazanPlanHabitIds.length === 0) { setSeasonalPref('ramazan', false); }
            else if (t === 'tez' && tezPlanHabitIds.length === 0) { setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); setTezNameInput(''); setTezDateInput(''); }
            else if (t === 'mulakat') {
              const slot = modePreview?.mulakatSlot ?? 'mulakat';
              if (slot === 'mulakat2' && mulakat2PlanHabitIds.length === 0) { setSeasonalPref('mulakat2Name', ''); setSeasonalPref('mulakat2Date', null); setMulakat2NameInput(''); setMulakat2DateInput(''); }
              else if (slot === 'mulakat3' && mulakat3PlanHabitIds.length === 0) { setSeasonalPref('mulakat3Name', ''); setSeasonalPref('mulakat3Date', null); setMulakat3NameInput(''); setMulakat3DateInput(''); }
              else if (slot === 'mulakat' && mulakatPlanHabitIds.length === 0) { setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); setMulakatNameInput(''); setMulakatDateInput(''); }
            }
            else if (t === 'spor') {
              const slot = modePreview?.sporSlot ?? 'spor';
              if (slot === 'spor2' && spor2PlanHabitIds.length === 0) { setSeasonalPref('spor2Goal', ''); setSeasonalPref('spor2Date', null); setSpor2GoalInput(''); setSpor2DateInput(''); }
              else if (slot === 'spor3' && spor3PlanHabitIds.length === 0) { setSeasonalPref('spor3Goal', ''); setSeasonalPref('spor3Date', null); setSpor3GoalInput(''); setSpor3DateInput(''); }
              else if (slot === 'spor' && sporPlanHabitIds.length === 0) { setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null); setSporGoalInput(''); setSporDateInput(''); resetSporInputs(); }
            }
            setModePreview(null);
          }}
          showSheetImmediately
          planApplied={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') {
              const slot = modePreview.examSlot ?? 'exam';
              const hIds = slot === 'exam2' ? exam2PlanHabitIds : slot === 'exam3' ? exam3PlanHabitIds : examPlanHabitIds;
              const tIds = slot === 'exam2' ? exam2PlanTaskIds  : slot === 'exam3' ? exam3PlanTaskIds  : examPlanTaskIds;
              return hIds.length > 0 || tIds.length > 0;
            }
            if (t === 'tez') return tezPlanHabitIds.length > 0 || tezPlanTaskIds.length > 0;
            if (t === 'mulakat') {
              const slot = modePreview.mulakatSlot ?? 'mulakat';
              const hIds = slot === 'mulakat2' ? mulakat2PlanHabitIds : slot === 'mulakat3' ? mulakat3PlanHabitIds : mulakatPlanHabitIds;
              const tIds = slot === 'mulakat2' ? mulakat2PlanTaskIds  : slot === 'mulakat3' ? mulakat3PlanTaskIds  : mulakatPlanTaskIds;
              return hIds.length > 0 || tIds.length > 0;
            }
            if (t === 'spor') {
              const slot = modePreview.sporSlot ?? 'spor';
              const hIds = slot === 'spor2' ? spor2PlanHabitIds : slot === 'spor3' ? spor3PlanHabitIds : sporPlanHabitIds;
              const tIds = slot === 'spor2' ? spor2PlanTaskIds  : slot === 'spor3' ? spor3PlanTaskIds  : sporPlanTaskIds;
              return hIds.length > 0 || tIds.length > 0;
            }
            return ramazanPlanHabitIds.length > 0 || ramazanPlanTaskIds.length > 0;
          })()}
          planHabitIds={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') {
              const slot = modePreview.examSlot ?? 'exam';
              return slot === 'exam2' ? exam2PlanHabitIds : slot === 'exam3' ? exam3PlanHabitIds : examPlanHabitIds;
            }
            if (t === 'tez') return tezPlanHabitIds;
            if (t === 'mulakat') {
              const slot = modePreview.mulakatSlot ?? 'mulakat';
              return slot === 'mulakat2' ? mulakat2PlanHabitIds : slot === 'mulakat3' ? mulakat3PlanHabitIds : mulakatPlanHabitIds;
            }
            if (t === 'spor') {
              const slot = modePreview.sporSlot ?? 'spor';
              return slot === 'spor2' ? spor2PlanHabitIds : slot === 'spor3' ? spor3PlanHabitIds : sporPlanHabitIds;
            }
            return ramazanPlanHabitIds;
          })()}
          planTaskIds={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') {
              const slot = modePreview.examSlot ?? 'exam';
              return slot === 'exam2' ? exam2PlanTaskIds : slot === 'exam3' ? exam3PlanTaskIds : examPlanTaskIds;
            }
            if (t === 'tez') return tezPlanTaskIds;
            if (t === 'mulakat') {
              const slot = modePreview.mulakatSlot ?? 'mulakat';
              return slot === 'mulakat2' ? mulakat2PlanTaskIds : slot === 'mulakat3' ? mulakat3PlanTaskIds : mulakatPlanTaskIds;
            }
            if (t === 'spor') {
              const slot = modePreview.sporSlot ?? 'spor';
              return slot === 'spor2' ? spor2PlanTaskIds : slot === 'spor3' ? spor3PlanTaskIds : sporPlanTaskIds;
            }
            return ramazanPlanTaskIds;
          })()}
          onClearPlan={() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') {
              const slot = modePreview.examSlot ?? 'exam';
              const hIds = slot === 'exam2' ? exam2PlanHabitIds : slot === 'exam3' ? exam3PlanHabitIds : examPlanHabitIds;
              const tIds = slot === 'exam2' ? exam2PlanTaskIds  : slot === 'exam3' ? exam3PlanTaskIds  : examPlanTaskIds;
              hIds.forEach(id => removeHabit(id));
              tIds.forEach(id => retirePlanTask(id, slot));
              clearPlanIds(slot);
              if (slot === 'exam2') { setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null); setExam2NameInput(''); setExam2DateInput(''); }
              else if (slot === 'exam3') { setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null); setExam3NameInput(''); setExam3DateInput(''); }
              else { setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null); setExamNameInput(''); setExamDateInput(''); }
            } else if (t === 'tez') {
              tezPlanHabitIds.forEach(id => removeHabit(id));
              tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez'));
              clearPlanIds('tez');
              setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); setTezNameInput(''); setTezDateInput('');
            } else if (t === 'mulakat') {
              const slot = modePreview.mulakatSlot ?? 'mulakat';
              const hIds = slot === 'mulakat2' ? mulakat2PlanHabitIds : slot === 'mulakat3' ? mulakat3PlanHabitIds : mulakatPlanHabitIds;
              const tIds = slot === 'mulakat2' ? mulakat2PlanTaskIds  : slot === 'mulakat3' ? mulakat3PlanTaskIds  : mulakatPlanTaskIds;
              hIds.forEach(id => removeHabit(id));
              tIds.forEach(id => retirePlanTask(id, slot));
              clearPlanIds(slot);
              if (slot === 'mulakat2') { setSeasonalPref('mulakat2Name', ''); setSeasonalPref('mulakat2Date', null); setMulakat2NameInput(''); setMulakat2DateInput(''); }
              else if (slot === 'mulakat3') { setSeasonalPref('mulakat3Name', ''); setSeasonalPref('mulakat3Date', null); setMulakat3NameInput(''); setMulakat3DateInput(''); }
              else { setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); setMulakatNameInput(''); setMulakatDateInput(''); }
            } else if (t === 'spor') {
              const slot = modePreview.sporSlot ?? 'spor';
              const hIds = slot === 'spor2' ? spor2PlanHabitIds : slot === 'spor3' ? spor3PlanHabitIds : sporPlanHabitIds;
              const tIds = slot === 'spor2' ? spor2PlanTaskIds  : slot === 'spor3' ? spor3PlanTaskIds  : sporPlanTaskIds;
              hIds.forEach(id => removeHabit(id));
              tIds.forEach(id => retirePlanTask(id, slot));
              clearPlanIds(slot);
              if (slot === 'spor2') { setSeasonalPref('spor2Goal', ''); setSeasonalPref('spor2Date', null); setSpor2GoalInput(''); setSpor2DateInput(''); }
              else if (slot === 'spor3') { setSeasonalPref('spor3Goal', ''); setSeasonalPref('spor3Date', null); setSpor3GoalInput(''); setSpor3DateInput(''); }
              else { setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null); setSporGoalInput(''); setSporDateInput(''); resetSporInputs(); }
            } else {
              ramazanPlanHabitIds.forEach(id => removeHabit(id));
              habits.filter(h => RAMAZAN_HABIT_NAMES.some(n => n.toLowerCase() === h.name.toLowerCase())).forEach(h => removeHabit(h.id));
              ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
              clearPlanIds('ramazan');
              setSeasonalPref('ramazan', false);
            }
            setModePreview(null);
          }}
          onApplied={(habitIds, taskIds, meta) => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') {
              const slot = modePreview.examSlot ?? 'exam';
              const prevHabits = slot === 'exam2' ? exam2PlanHabitIds : slot === 'exam3' ? exam3PlanHabitIds : examPlanHabitIds;
              const prevTasks  = slot === 'exam2' ? exam2PlanTaskIds  : slot === 'exam3' ? exam3PlanTaskIds  : examPlanTaskIds;
              setPlanIds(slot, [...new Set([...prevHabits, ...habitIds])], [...new Set([...prevTasks, ...taskIds])]);
              // Günlük plan motoru için spec: kullanıcının seçtiği saat öncelikli
              const dm = (slot === 'exam2' ? exam2DailyMinutes : slot === 'exam3' ? exam3DailyMinutes : examDailyMinutes) ?? meta?.dailyMinutes;
              setPlanSpec(slot, { templateId: meta?.templateId, dailyMinutes: dm ?? undefined });
            } else if (t === 'tez') {
              setPlanIds('tez', [...new Set([...tezPlanHabitIds, ...habitIds])], [...new Set([...tezPlanTaskIds, ...taskIds])]);
              setPlanSpec('tez', { templateId: meta?.templateId, dailyMinutes: meta?.dailyMinutes });
            } else if (t === 'mulakat') {
              const slot = modePreview.mulakatSlot ?? 'mulakat';
              const prevH = slot === 'mulakat2' ? mulakat2PlanHabitIds : slot === 'mulakat3' ? mulakat3PlanHabitIds : mulakatPlanHabitIds;
              const prevT = slot === 'mulakat2' ? mulakat2PlanTaskIds  : slot === 'mulakat3' ? mulakat3PlanTaskIds  : mulakatPlanTaskIds;
              setPlanIds(slot, [...new Set([...prevH, ...habitIds])], [...new Set([...prevT, ...taskIds])]);
              setPlanSpec(slot, { templateId: meta?.templateId, dailyMinutes: meta?.dailyMinutes });
            } else if (t === 'spor') {
              const slot = modePreview.sporSlot ?? 'spor';
              const prevH = slot === 'spor2' ? spor2PlanHabitIds : slot === 'spor3' ? spor3PlanHabitIds : sporPlanHabitIds;
              const prevT = slot === 'spor2' ? spor2PlanTaskIds  : slot === 'spor3' ? spor3PlanTaskIds  : sporPlanTaskIds;
              setPlanIds(slot, [...new Set([...prevH, ...habitIds])], [...new Set([...prevT, ...taskIds])]);
              setPlanSpec(slot, { templateId: meta?.templateId, dailyMinutes: meta?.dailyMinutes });
              // kilo tipi için effectiveSporDate'i store'a kaydet (kiloAutoDate null olmayabilir)
              if (slot === 'spor' && effectiveSporDate) {
                setSeasonalPref('sporDate', effectiveSporDate);
                setSporDateInput(effectiveSporDate);
              }
            } else {
              setPlanIds('ramazan', [...new Set([...ramazanPlanHabitIds, ...habitIds])], [...new Set([...ramazanPlanTaskIds, ...taskIds])]);
              setPlanSpec('ramazan', { templateId: meta?.templateId, dailyMinutes: meta?.dailyMinutes });
            }
            // Plan uygulanır uygulanmaz bugünün görevlerini üret — boş aksiyon merkezi olmasın
            setTimeout(() => runAdaptations(true), 400);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modeCard: {
    borderWidth: B.thin,
    borderRadius: R.lg,
    overflow: 'hidden',
  },
});

interface WeightWheelPickerProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  theme: any;
  isDark: boolean;
  sporColor: string;
}

function WeightWheelPicker({ value, onChange, min = 30, max = 220, theme, isDark, sporColor }: WeightWheelPickerProps) {
  const itemHeight = 40;
  const visibleItems = 3;
  const containerHeight = itemHeight * visibleItems;

  const values = useMemo(() => {
    const arr = [];
    for (let i = min; i <= max; i++) {
      arr.push(i);
    }
    return arr;
  }, [min, max]);

  const initialIndex = values.indexOf(value);
  const scrollViewRef = useRef<ScrollView>(null);
  const isMounted = useRef(false);

  // Scroll to value
  useEffect(() => {
    if (initialIndex !== -1 && scrollViewRef.current) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: initialIndex * itemHeight,
          animated: isMounted.current,
        });
        isMounted.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [value, initialIndex]);

  const handleMomentumScrollEnd = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / itemHeight);
    if (index >= 0 && index < values.length) {
      const val = values[index];
      if (val !== value) {
        Haptics.selectionAsync();
        onChange(val);
      }
    }
  };

  return (
    <View style={{
      height: containerHeight,
      width: 100,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      borderRadius: R.md,
      overflow: 'hidden',
      borderWidth: B.thin,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      alignSelf: 'center',
    }}>
      {/* Selection highlight lines */}
      <View style={{
        position: 'absolute',
        top: itemHeight,
        left: 0,
        right: 0,
        height: itemHeight,
        borderTopWidth: 1.5,
        borderBottomWidth: 1.5,
        borderColor: sporColor + '40',
        backgroundColor: sporColor + '08',
      }} pointerEvents="none" />

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={{
          paddingVertical: itemHeight,
        }}
      >
        {values.map((item) => {
          const active = item === value;
          return (
            <View key={item} style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{
                fontSize: active ? 20 : 15,
                fontWeight: active ? '900' : '600',
                color: active ? sporColor : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'),
              }}>
                {item} <Text style={{ fontSize: active ? 12 : 9, fontWeight: '700' }}>kg</Text>
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
