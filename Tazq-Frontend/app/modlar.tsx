import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, TextInput, Keyboard, Switch, Dimensions, KeyboardAvoidingView, FlatList } from 'react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, ChevronRight, CalendarDays, X, Info, BarChart3, Flame, Zap, Sparkles, Target, CheckCircle2, Dumbbell, Activity } from 'lucide-react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { BottomNavBar } from '@/shared/components/BottomNavBar';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { usePrefsStore, getModePreview, ModeType, RAMAZAN_HABIT_NAMES, detectSporType, localizeSporGoal, RAMAZAN, renderModeEmojiIcon, deriveDateSlot } from '@/features/modes';
import { track } from '@/shared/utils/analytics';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useTaskStore } from '@/features/tasks';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  cancelExamCountdownNotifs,
  scheduleExamCountdownNotifs,
  scheduleRamadanStartNotification,
  cancelRamadanStartNotification,
} from '@/shared/utils/notifications';
import { S, R, F, B, TRACKING, SPRING, MAX_W, sideInset } from '@/shared/constants/tokens';
import { useToastStore } from '@/shared/store/useToastStore';
import { useSporStore, getThisWeekEntry } from '@/shared/store/useSporStore';
import { recordWeeklyWeight, canLogWeight, daysUntilNextWeight, ensureWeeklyWeightTask } from '@/shared/utils/weightCheckin';
import { getCurrentRamadanStatus, formatRamadanDate } from '@/shared/utils/ramadanDates';
import { matchExamName, detectExamFromInput, recommendTemplateId, HOURS_OPTIONS, type ExamPreset } from '@/shared/utils/examPresets';

// Kullanıcının seçtiği günlük süreyi, eşleşen SEVİYE şablonuna (Temel/Standart/Yoğun)
// bağlar. Böylece "1 saat seçtim ama plan 2+ saat Yoğun çıkıyor" çelişkisi olmaz —
// önerilen/önseçili şablon her zaman seçilen saatle tutarlıdır.
function levelTemplateIdFromMinutes(min?: number): string {
  const m = min ?? 90;
  if (m <= 60) return 'level-temel';   // 30–60 dk
  if (m <= 120) return 'level-orta';   // 60–120 dk
  return 'level-ileri';                 // 2+ saat
}
import { TurkishModeBanner } from '@/features/modes';
import { TasarrufCard } from '@/shared/components/TasarrufCard';
import { BirakmaCard } from '@/shared/components/BirakmaCard';
import { TezCard } from '@/features/modes/components/modes/TezCard';
import { MulakatCard } from '@/features/modes/components/modes/MulakatCard';
import { RamazanCard } from '@/features/modes/components/modes/RamazanCard';
import { ExamCard } from '@/features/modes/components/modes/ExamCard';
import { SporCard } from '@/features/modes/components/modes/SporCard';
import { TaskService } from '@/shared/services/api';
import { usePlanAdaptations } from '@/features/modes';
import { Touchable } from '@/shared/components/Touchable';

const MarsIcon = ({ size = 16, color = 'currentColor', strokeWidth = 2.5 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M16 3h5v5" />
    <Path d="M21 3 14.5 9.5" />
    <Circle cx="11" cy="17" r="5" />
  </Svg>
);

const VenusIcon = ({ size = 16, color = 'currentColor', strokeWidth = 2.5 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="9" r="5" />
    <Line x1="12" x2="12" y1="14" y2="22" />
    <Line x1="9" x2="15" y1="18" y2="18" />
  </Svg>
);

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    // Offline-first: çevrimdışıysa silmeyi kuyruğa al, yoksa sunucudaki görev silinmeden
    // kalır ve bir sonraki sync'te geri gelir (artık-görev bug'ı). Ağ hatasında da kuyruğa al.
    const isOnline = useNetworkStore.getState().isOnline;
    if (!isOnline) {
      useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
    } else {
      TaskService.deleteTask(taskId).catch(err => {
        if (!err?.response) useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
      });
    }
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

  // ── AKILLI VARSAYILANLAR ───────────────────────────────────────────────────
  // Bir sınav preset'i belirlenince (yazarken/öneriden), o sınavın önerilen günlük
  // süresini saat seçicide otomatik önseç → kullanıcı tahmin etmesin, sadece onaylasın.
  // Tüm seçim noktalarını (input/öneri/submit) tek yerden kapsar.
  useEffect(() => { if (selectedExamPreset) setExamDailyMinutes(selectedExamPreset.defaultDailyMinutes); }, [selectedExamPreset?.id]);
  useEffect(() => { if (selectedExam2Preset) setExam2DailyMinutes(selectedExam2Preset.defaultDailyMinutes); }, [selectedExam2Preset?.id]);
  useEffect(() => { if (selectedExam3Preset) setExam3DailyMinutes(selectedExam3Preset.defaultDailyMinutes); }, [selectedExam3Preset?.id]);

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
  const [sporGoalInput, setSporGoalInput] = useState(() => localizeSporGoal(seasonal.sporGoal || '', language === 'tr'));
  const [sporDateInput, setSporDateInput] = useState(seasonal.sporDate || '');
  const [sporExpanded, setSporExpanded] = useState(false);
  const [showSporDatePicker, setShowSporDatePicker] = useState(false);
  const [spor2GoalInput, setSpor2GoalInput] = useState(() => localizeSporGoal(seasonal.spor2Goal || '', language === 'tr'));
  const [spor2DateInput, setSpor2DateInput] = useState(seasonal.spor2Date || '');
  const [spor2Expanded, setSpor2Expanded] = useState(false);
  const [showSpor2DatePicker, setShowSpor2DatePicker] = useState(false);
  const [spor3GoalInput, setSpor3GoalInput] = useState(() => localizeSporGoal(seasonal.spor3Goal || '', language === 'tr'));
  const [spor3DateInput, setSpor3DateInput] = useState(seasonal.spor3Date || '');
  const [spor3Expanded, setSpor3Expanded] = useState(false);
  const [showSpor3DatePicker, setShowSpor3DatePicker] = useState(false);
  const [weightEntryInput, setWeightEntryInput] = useState('');
  const [showWeightEntry, setShowWeightEntry] = useState(false);

  useEffect(() => {
    setSporGoalInput(localizeSporGoal(seasonal.sporGoal || '', language === 'tr'));
    setSpor2GoalInput(localizeSporGoal(seasonal.spor2Goal || '', language === 'tr'));
    setSpor3GoalInput(localizeSporGoal(seasonal.spor3Goal || '', language === 'tr'));
  }, [language, seasonal.sporGoal, seasonal.spor2Goal, seasonal.spor3Goal]);

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
    // 7-gün kadansı + görev tamamlama + bir sonraki haftalık görev → tek kaynak.
    recordWeeklyWeight(kg, language as 'tr' | 'en').then(ok => {
      if (!ok) {
        // 7 gün dolmadı — kullanıcıyı bilgilendir, girişi geri al.
        setShowWeightEntry(false);
        setWeightEntryInput('');
        const left = daysUntilNextWeight(useSporStore.getState().weightLog);
        Alert.alert(
          language === 'tr' ? 'Tartım zaten alındı' : 'Already logged',
          language === 'tr' ? `Kilo 7 günde bir girilir. ${left} gün sonra tekrar gir.` : `Weight is logged every 7 days. Try again in ${left} day(s).`,
        );
        return;
      }
      setWeightEntryInput('');
      setShowWeightEntry(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Kilo girişinden hemen sonra adaptasyon motorunu zorla çalıştır
      setTimeout(() => runAdaptations(true), 300);
    });
  }, [runAdaptations, language]);

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

  // Aynı tür birden çok spor slotunda olamaz (ör. iki "Kilo Yönetimi" mantıksız).
  // Bir slot için, DİĞER slotlarda zaten seçili türleri çiplerden gizle (kendi seçili
  // türü kalır ki vurgulu görünsün).
  const sporGoalsForSlot = (selfLabel: string, otherLabels: string[]) => {
    const otherKeys = new Set(otherLabels.filter(Boolean).map(l => detectSporType(l)));
    const selfKey = selfLabel ? detectSporType(selfLabel) : null;
    return SPOR_GOALS.filter(g => g.key === selfKey || !otherKeys.has(g.key as any));
  };

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
  // Tarih türevleri tek kaynaktan (deriveDateSlot) — slot başına kopyalanan gün-sonu/
  // geçti-mi/kaç-gün/dateObj matematiği yerine. Değişken adları korunur (JSX'e dokunulmaz).
  const spor2Slot = deriveDateSlot(spor2GoalInput, spor2DateInput, 60);
  const spor2IsComplete = spor2Slot.isComplete;
  const spor2DatePast = spor2Slot.datePast;
  const spor2DaysLeft = spor2Slot.daysLeft;
  const spor2DateObj = spor2Slot.dateObj;
  const spor3Slot = deriveDateSlot(spor3GoalInput, spor3DateInput, 90);
  const spor3IsComplete = spor3Slot.isComplete;
  const spor3DatePast = spor3Slot.datePast;
  const spor3DaysLeft = spor3Slot.daysLeft;
  const spor3DateObj = spor3Slot.dateObj;
  // Sınav/tez/mülakat slotlarının tarih türevleri — tek kaynak (deriveDateSlot).
  // Değişken adları korunur ki aşağıdaki JSX ve hesaplar aynen çalışsın.
  const examSlot = deriveDateSlot(examNameInput, examDateInput, 30);
  const exam2Slot = deriveDateSlot(exam2NameInput, exam2DateInput, 60);
  const exam3Slot = deriveDateSlot(exam3NameInput, exam3DateInput, 90);
  const tezSlot = deriveDateSlot(tezNameInput, tezDateInput, 90);
  const mulakatSlot = deriveDateSlot(mulakatNameInput, mulakatDateInput, 14);
  const mulakat2Slot = deriveDateSlot(mulakat2NameInput, mulakat2DateInput, 14);
  const mulakat3Slot = deriveDateSlot(mulakat3NameInput, mulakat3DateInput, 21);
  const examDateObj = examSlot.dateObj;
  const exam2DateObj = exam2Slot.dateObj;
  const exam3DateObj = exam3Slot.dateObj;
  const tezDateObj = tezSlot.dateObj;
  const mulakatDateObj = mulakatSlot.dateObj;

  const scrollViewRef = useRef<ScrollView>(null);
  const examInputViewRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  // Bir mod kartı "Düzenle/genişlet"e geçince o karta yumuşakça kaydır (odak netliği).
  // onLayout y'si gap-container'a göre; offset 0'da ilk kart header altına denk geldiğinden
  // scrollTo(y=cardY) açılan kartı tam o konuma getirir.
  const cardY = useRef<Record<string, number>>({});
  const focusCard = useCallback((key: string) => {
    const scroll = () => {
      const y = cardY.current[key];
      if (y != null) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      } else {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    };
    setTimeout(scroll, 100);
    setTimeout(scroll, 300);
    setTimeout(scroll, 600);
  }, []);

  const formatExamDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (language === 'tr') {
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const examIsComplete = examSlot.isComplete;
  const examDatePast = examSlot.datePast;

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

  const examDaysLeft = examSlot.daysLeft;
  const urgencyColor = '#3B82F6';

  const exam2IsComplete = exam2Slot.isComplete;
  const exam2DatePast = exam2Slot.datePast;
  const exam2DaysLeft = exam2Slot.daysLeft;
  const exam2UrgencyColor = '#3B82F6';

  const exam3IsComplete = exam3Slot.isComplete;
  const exam3DatePast = exam3Slot.datePast;
  const exam3DaysLeft = exam3Slot.daysLeft;
  const exam3UrgencyColor = '#3B82F6';

  const tezIsComplete = tezSlot.isComplete;
  const tezDatePast = tezSlot.datePast;
  const tezDaysLeft = tezSlot.daysLeft;
  const tezUrgencyColor = '#8B5CF6';

  const mulakatIsComplete = mulakatSlot.isComplete;
  const mulakatDatePast = mulakatSlot.datePast;
  const mulakatDaysLeft = mulakatSlot.daysLeft;
  const mulakatUrgencyColor = '#10B981';
  const mulakat2IsComplete = mulakat2Slot.isComplete;
  const mulakat2DatePast = mulakat2Slot.datePast;
  const mulakat2DaysLeft = mulakat2Slot.daysLeft;
  const mulakat2UrgencyColor = '#10B981';
  const mulakat2DateObj = mulakat2Slot.dateObj;
  const mulakat3IsComplete = mulakat3Slot.isComplete;
  const mulakat3DatePast = mulakat3Slot.datePast;
  const mulakat3DaysLeft = mulakat3Slot.daysLeft;
  const mulakat3UrgencyColor = '#10B981';
  const mulakat3DateObj = mulakat3Slot.dateObj;

  const tezPlanHabits = useMemo(() => habits.filter(h => tezPlanHabitIds.includes(h.id)), [habits, tezPlanHabitIds]);
  const tezHabitsActiveThisWeek = tezPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const tezWeekPct = tezPlanHabits.length > 0 ? Math.round(tezHabitsActiveThisWeek / tezPlanHabits.length * 100) : 0;

  const mulakatPlanHabits = useMemo(() => habits.filter(h => mulakatPlanHabitIds.includes(h.id)), [habits, mulakatPlanHabitIds]);
  const mulakatHabitsActiveThisWeek = mulakatPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const mulakatWeekPct = mulakatPlanHabits.length > 0 ? Math.round(mulakatHabitsActiveThisWeek / mulakatPlanHabits.length * 100) : 0;

  const sporPlanHabits = useMemo(() => habits.filter(h => sporPlanHabitIds.includes(h.id)), [habits, sporPlanHabitIds]);
  const sporHabitsActiveThisWeek = sporPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const sporWeekPct = sporPlanHabits.length > 0 ? Math.round(sporHabitsActiveThisWeek / sporPlanHabits.length * 100) : 0;

  // ── BUGÜN (o modun bugünkü görev + alışkanlık tamamlanması) ────────────
  // Kullanıcı perspektifi: "bugün bu mod için işimi yaptım mı?" Sabit ve anlaşılır;
  // bir görevi/alışkanlığı işaretleyince ANINDA dolar. Bugün planlı iş yoksa
  // (total=0) çubuk gizlenir — kafa karıştıran "0/1" yerine hiç gösterilmez.
  const todayKey = fmtDateKey();
  const todayTaskStat = (taskIds: number[]) => {
    if (!taskIds || taskIds.length === 0) return { done: 0, total: 0 };
    const isToday = (d?: string | null) => !!d && !d.startsWith('0001') && fmtDateKey(new Date(d)) === todayKey;
    // Bugün vadeli VEYA bugün tamamlanan plan görevleri.
    const wk = useTaskStore.getState().tasks.filter(t =>
      taskIds.includes(t.id) && (isToday(t.dueDate) || (t.isCompleted && isToday(t.completedAt)))
    );
    return { done: wk.filter(t => t.isCompleted).length, total: wk.length };
  };
  const mkToday = (planHabits: any[], taskIds: number[]) => {
    const tk = todayTaskStat(taskIds);
    const hDone = planHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).includes(todayKey)).length;
    const total = planHabits.length + tk.total;
    const done = hDone + tk.done;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };
  const examProg = mkToday(examPlanHabits, examPlanTaskIds);
  const ramazanProg = mkToday(ramazanPlanHabits, ramazanPlanTaskIds);
  const tezProg = mkToday(tezPlanHabits, tezPlanTaskIds);
  const mulakatProg = mkToday(mulakatPlanHabits, mulakatPlanTaskIds);
  const sporProg = mkToday(sporPlanHabits, sporPlanTaskIds);

  // KILO: gerçek ilerleme görev sayısı DEĞİL, kilodaki yol (başlangıç→şu an / başlangıç→hedef).
  // "0/1" gibi anlamsız bir kesir yerine "Hedefe %X · 2.0/5.0 kg" gösterilir.
  const kiloLatest = weightLog.length ? weightLog.reduce((a, b) => (a.date > b.date ? a : b)).weight : cwNum;
  const kiloGoalKg = Math.abs(cwNum - twNum);
  const kiloDoneKg = Math.max(0, cwNum > twNum ? (cwNum - kiloLatest) : (kiloLatest - cwNum));
  const kiloPct = kiloGoalKg > 0 ? Math.min(100, Math.round((kiloDoneKg / kiloGoalKg) * 100)) : 0;

  // MARATON/GÜÇ/GENEL: domaine uygun = haftalık ANTRENMAN günü (bugünkü görev sayısı değil).
  // Bu hafta spor planı görevini tamamladığın farklı gün sayısı / haftalık hedef.
  const sporTrainTarget = useSporStore.getState().trainingDays ?? 3;
  const sporWeekDays = (() => {
    const days = new Set<string>();
    useTaskStore.getState().tasks.forEach(t => {
      if (sporPlanTaskIds.includes(t.id) && t.isCompleted && t.completedAt && !t.completedAt.startsWith('0001')) {
        const k = fmtDateKey(new Date(t.completedAt));
        if (thisWeekKeys.has(k)) days.add(k);
      }
    });
    return days.size;
  })();
  const sporTrainPct = sporTrainTarget > 0 ? Math.min(100, Math.round((sporWeekDays / sporTrainTarget) * 100)) : 0;

  // ── DURUM ÖZETİ (sayfa başı dinamik kart) ──────────────────────────────
  // Aktif mod sayısı + en yakın hedef geri sayımı + bugünkü plan ilerlemesi.
  // Ucuz hesap; her render'da tazelenir (görev tamamlamada da güncel kalır).
  // Bir slot "aktif" sayılır: yalnızca PLAN UYGULANMIŞSA (plan id'leri varsa).
  // Sadece toggle açık + config giriliyorken (henüz "Uygula" basılmadan) SAYILMAZ —
  // aksi halde plan seçilmeden kart "Planın hazır" diye yukarıda çıkıyordu.
  const applied = (h?: any[], t?: any[]) => ((h?.length ?? 0) > 0 || (t?.length ?? 0) > 0);
  const examApplied = applied(examPlanHabitIds, examPlanTaskIds);
  const exam2Applied = applied(exam2PlanHabitIds, exam2PlanTaskIds);
  const exam3Applied = applied(exam3PlanHabitIds, exam3PlanTaskIds);
  const tezApplied = applied(tezPlanHabitIds, tezPlanTaskIds);
  const mulakatApplied = applied(mulakatPlanHabitIds, mulakatPlanTaskIds);
  const mulakat2Applied = applied(mulakat2PlanHabitIds, mulakat2PlanTaskIds);
  const mulakat3Applied = applied(mulakat3PlanHabitIds, mulakat3PlanTaskIds);
  const sporApplied = applied(sporPlanHabitIds, sporPlanTaskIds);
  const spor2Applied = applied(spor2PlanHabitIds, spor2PlanTaskIds);
  const spor3Applied = applied(spor3PlanHabitIds, spor3PlanTaskIds);
  const ramazanApplied = applied(ramazanPlanHabitIds, ramazanPlanTaskIds);

  const statusActiveCount = [
    seasonal.examMode && (examApplied || exam2Applied || exam3Applied),
    seasonal.tezMode && tezApplied,
    seasonal.mulakatMode && (mulakatApplied || mulakat2Applied || mulakat3Applied),
    seasonal.sporMode && (sporApplied || spor2Applied || spor3Applied),
    seasonal.ramazan && ramazanApplied,
  ].filter(Boolean).length;

  const hasAnyActiveMode = !!(
    seasonal.examMode ||
    seasonal.tezMode ||
    seasonal.mulakatMode ||
    seasonal.sporMode ||
    seasonal.ramazan ||
    seasonal.tasarrufMode ||
    seasonal.birakmaMode
  );
  // Etiket adlarındaki ham emoji'leri temizle (ör. preset adı "⚖️ Kilo Yönetimi").
  // İkon zaten flat olarak ayrı gösteriliyor; metinde ham emoji tema ile çelişir.
  const stripEmoji = (s: string) => s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const statusCands: Array<{ days: number; label: string; color: string; emoji: string }> = [];
  // Decouple: tarih/ad LOCAL input yerine KALICI `seasonal`'dan okunur (mod çıkarımının
  // önünü açar; past/days dateStr'den içeride hesaplanır). Yalnız uygulanmış modlar sayılır.
  const dPast = (d?: string | null) => !!d && new Date(d).setHours(23, 59, 59, 999) < Date.now();
  const dLeft = (d?: string | null) => (d && !dPast(d)) ? Math.max(0, Math.ceil((new Date(d).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const pushCand = (on: boolean, dateStr: string | null, label: string, color: string, emoji: string) => {
    if (on && dateStr && !dPast(dateStr)) statusCands.push({ days: dLeft(dateStr), label: stripEmoji(label) || label, color, emoji });
  };
  pushCand(seasonal.examMode && examApplied, seasonal.examDate, seasonal.examName || (language === 'tr' ? 'Sınav' : 'Exam'), urgencyColor, '🎯');
  pushCand(seasonal.examMode && exam2Applied, seasonal.exam2Date, seasonal.exam2Name || (language === 'tr' ? 'Sınav' : 'Exam'), urgencyColor, '🎯');
  pushCand(seasonal.examMode && exam3Applied, seasonal.exam3Date, seasonal.exam3Name || (language === 'tr' ? 'Sınav' : 'Exam'), urgencyColor, '🎯');
  pushCand(seasonal.tezMode && tezApplied, seasonal.tezDate, seasonal.tezName || (language === 'tr' ? 'Tez' : 'Thesis'), tezUrgencyColor, '📚');
  pushCand(seasonal.mulakatMode && mulakatApplied, seasonal.mulakatDate, seasonal.mulakatName || (language === 'tr' ? 'Mülakat' : 'Interview'), mulakatUrgencyColor, '💼');
  pushCand(seasonal.mulakatMode && mulakat2Applied, seasonal.mulakat2Date, seasonal.mulakat2Name || (language === 'tr' ? 'Mülakat' : 'Interview'), mulakatUrgencyColor, '💼');
  pushCand(seasonal.mulakatMode && mulakat3Applied, seasonal.mulakat3Date, seasonal.mulakat3Name || (language === 'tr' ? 'Mülakat' : 'Interview'), mulakatUrgencyColor, '💼');
  pushCand(seasonal.sporMode && sporApplied, seasonal.sporDate, localizeSporGoal(seasonal.sporGoal || '', language === 'tr') || (language === 'tr' ? 'Spor' : 'Fitness'), sporColor, '💪');
  pushCand(seasonal.sporMode && spor2Applied, seasonal.spor2Date, localizeSporGoal(seasonal.spor2Goal || '', language === 'tr') || (language === 'tr' ? 'Spor' : 'Fitness'), sporColor, '💪');
  pushCand(seasonal.sporMode && spor3Applied, seasonal.spor3Date, localizeSporGoal(seasonal.spor3Goal || '', language === 'tr') || (language === 'tr' ? 'Spor' : 'Fitness'), sporColor, '💪');
  const statusNearest = statusCands.length ? statusCands.reduce((a, b) => (b.days < a.days ? b : a)) : null;
  const statusNow = new Date();
  const statusIsToday = (d?: string | null) => { if (!d) return false; const x = new Date(d); return x.getFullYear() === statusNow.getFullYear() && x.getMonth() === statusNow.getMonth() && x.getDate() === statusNow.getDate(); };
  const statusTodayTasks = useTaskStore.getState().tasks.filter(t => t.tags?.includes('daily') && statusIsToday(t.dueDate));
  const statusTodayTotal = statusTodayTasks.length;
  const statusTodayDone = statusTodayTasks.filter(t => t.isCompleted).length;
  const statusTodayPct = statusTodayTotal > 0 ? Math.round(statusTodayDone / statusTodayTotal * 100) : 0;
  const statusGreetingObj = statusTodayTotal === 0
    ? { text: language === 'tr' ? 'Planın hazır' : 'Your plan is ready', icon: <CheckCircle2 size={18} color="#10B981" /> }
    : statusTodayPct >= 80 ? { text: language === 'tr' ? 'Harika gidiyorsun!' : 'Crushing it!', icon: <Flame size={18} color="#F97316" /> }
    : statusTodayPct >= 40 ? { text: language === 'tr' ? 'İyi gidiyorsun' : "You're doing great", icon: <Dumbbell size={18} color="#3B82F6" /> }
    : { text: language === 'tr' ? 'Bugün biraz hızlanalım' : "Let's pick up the pace", icon: <Zap size={18} color="#F59E0B" /> };
  const statusMotiv = !statusNearest ? ''
    : statusNearest.days <= 3
      ? (language === 'tr' ? `Son düzlük! "${statusNearest.label}" çok yakın — bugün her şey sayar.` : `Final stretch! "${statusNearest.label}" is close — today counts.`)
    : statusNearest.days <= 14
      ? (language === 'tr' ? `"${statusNearest.label}" için her gün bir adım — sonunda fark olur.` : `One step a day toward "${statusNearest.label}" — it adds up.`)
      : (language === 'tr' ? `Erken başlamak en büyük avantajın — "${statusNearest.label}" yolundasın.` : `Starting early is your edge — you're on track for "${statusNearest.label}".`);

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

  // Sınav "nasıl geçti?" review'ı artık ExamCard bileşeninde (çift tetik olmasın diye no-op).
  useFocusEffect(useCallback(() => {}, []));

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
      <MotiView 
            from={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ type: 'timing', duration: 250 }}
            style={[
                styles.floatingTopBar,
                {
                    position: 'absolute',
                    top: insets.top + S.sm,
                    left: sideInset(screenWidth),
                    right: sideInset(screenWidth),
                    zIndex: 100,
                    backgroundColor: Platform.OS === 'android' ? (isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)') : 'transparent',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    elevation: Platform.OS === 'android' ? 4 : 0,
                },
                Platform.OS !== 'android' && {
                    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDark ? 0.3 : 0.08, shadowRadius: 24,
                }
            ]}
        >
            {Platform.OS === 'ios' && (
              <BlurView 
                  intensity={isDark ? 30 : 60} 
                  tint={colorScheme}
                  style={StyleSheet.absoluteFill}
              />
            )}
            <View style={[styles.topBarContent, { paddingHorizontal: S.sm, minHeight: 48 }]}>
              {/* Left Side (Fixed Width for Perfect Centering) */}
              <View style={{ width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                  {/* Sol: Modların Özeti (içgörü) sayfası. Back butonu YOK — alt navigasyondan gezilir. */}
                  <Touchable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/mod-ozet'); }}
                    style={styles.headerIconBtn}
                    accessibilityRole="button"
                    accessibilityLabel={language === 'tr' ? 'Modların özeti' : 'Modes overview'}
                  >
                    <BarChart3 size={24} color={theme.onSurfaceVariant} />
                  </Touchable>
              </View>

              {/* Center Title (Takes remaining space, perfectly centered) */}
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
                  <Text 
                    numberOfLines={1} 
                    adjustsFontSizeToFit
                    style={{ fontSize: 20, fontWeight: '600', color: theme.onSurface, letterSpacing: TRACKING.title, textAlign: 'center' }}
                  >
                      {language === 'tr' ? 'Dönemsel Modlar' : 'Seasonal Modes'}
                  </Text>
              </View>

              {/* Right Side Buttons (Fixed Width for Perfect Centering) */}
              <View style={{ width: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                 <Touchable 
                   onPress={() => Alert.alert(
                      language === 'tr' ? 'Modlar Hakkında' : 'About Seasonal Modes',
                      language === 'tr'
                        ? 'Dönemsel modlar belirli bir hedef veya dönem için hazırlanmış alışkanlık ve görev paketleridir. Aktif ettiğinde ilgili plan otomatik olarak Haftalık Merkez\'e ve görevlerine eklenir. Mod kapatıldığında eklenen içerikler kaldırılır.'
                        : 'Seasonal modes are curated bundles of tasks and habits for a specific goal or period. When activated, the plan is automatically added to your Weekly Hub. Deactivating the mode removes the added content.'
                   )}
                   style={styles.headerIconBtn}
                   accessibilityRole="button"
                   accessibilityLabel={language === 'tr' ? 'Modlar hakkında bilgi' : 'About modes'}
                 >
                     <Info size={24} color={theme.onSurfaceVariant} />
                 </Touchable>
              </View>
            </View>
        </MotiView>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 240 + insets.bottom, paddingHorizontal: S.lg, paddingTop: 80, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          >
          <View style={{ gap: S.md }}>
            {/* ── DURUM ÖZETİ KARTI ── aktif modlar: geri sayım + bugünkü plan + motivasyon; boşken davet. */}
            {statusActiveCount > 0 ? (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 250 }}
                style={[styles.modeCard, {
                  backgroundColor: statusNearest ? (isDark ? statusNearest.color + '1A' : statusNearest.color + '12') : (isDark ? '#1C1C22' : theme.surfaceContainerLowest),
                  borderColor: statusNearest ? statusNearest.color + (isDark ? '40' : '30') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'),
                  padding: S.md,
                }]}
              >
                {/* üst satır: selam + aktif mod çipi */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {statusGreetingObj.icon}
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{statusGreetingObj.text}</Text>
                  </View>
                  <View style={{ backgroundColor: (statusNearest?.color ?? urgencyColor) + (isDark ? '26' : '1A'), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ color: statusNearest?.color ?? urgencyColor, fontSize: 11, fontWeight: '700' }}>{statusActiveCount} {language === 'tr' ? 'mod' : 'modes'}</Text>
                  </View>
                </View>

                {/* ana satır: emoji + hedef + geri sayım | bugünkü plan noktaları */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.md, gap: S.md }}>
                  <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: (statusNearest?.color ?? urgencyColor) + (isDark ? '26' : '18'), alignItems: 'center', justifyContent: 'center' }}>
                    {renderModeEmojiIcon(statusNearest?.emoji ?? '📅', 24, statusNearest?.color ?? urgencyColor)}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }} numberOfLines={1}>{statusNearest?.label ?? (language === 'tr' ? 'Süresiz hedef' : 'Open-ended goal')}</Text>
                    {statusNearest ? (
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 1 }}>
                        <Text style={{ color: statusNearest.color, fontWeight: '800', fontSize: 22, letterSpacing: -0.5 }}>{statusNearest.days}</Text>
                        <Text style={{ color: statusNearest.color, fontWeight: '600', fontSize: F.caption }}>{language === 'tr' ? (statusNearest.days === 0 ? 'bugün!' : 'gün kaldı') : (statusNearest.days === 0 ? 'today!' : 'days left')}</Text>
                      </View>
                    ) : (
                      <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, marginTop: 2 }}>{language === 'tr' ? 'tarih yok — kendi tempon' : 'no deadline — your pace'}</Text>
                    )}
                  </View>
                  {/* bugünkü plan: noktalar (betimsel) */}
                  <View style={{ alignItems: 'flex-end' }}>
                    {statusTodayTotal > 0 ? (
                      <>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          {Array.from({ length: Math.min(statusTodayTotal, 6) }).map((_, i) => {
                            const shown = Math.min(statusTodayTotal, 6);
                            const filled = Math.round((statusTodayDone / statusTodayTotal) * shown);
                            const on = i < filled;
                            return <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? (statusNearest?.color ?? urgencyColor) : theme.onSurfaceVariant + '30' }} />;
                          })}
                        </View>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600', marginTop: 6 }}>{language === 'tr' ? `bugün ${statusTodayDone}/${statusTodayTotal}` : `today ${statusTodayDone}/${statusTodayTotal}`}</Text>
                      </>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B981' + (isDark ? '22' : '15'), paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 }}>
                        <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '700' }}>✓ {language === 'tr' ? 'bugün boş' : 'clear'}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {statusMotiv ? (
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '500', marginTop: S.md, lineHeight: 17 }}>{statusMotiv}</Text>
                ) : null}
              </MotiView>
            ) : (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 250 }}
                style={[styles.modeCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', padding: S.md }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={18} color={theme.primary} />
                  <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Bir hedef seç, gerisini bize bırak' : 'Pick a goal, leave the rest to us'}</Text>
                </View>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '500', marginTop: 6, lineHeight: 18 }}>{language === 'tr' ? 'Sınav, tez, mülakat ya da spor — birini aç, hazır plan otomatik olarak Haftalık Merkez ve görevlerine düşsün.' : 'Exam, thesis, interview or fitness — turn one on and a ready plan flows into your Weekly Hub and tasks automatically.'}</Text>
              </MotiView>
            )}
            {/* ── KATMAN 1: AKTİF HEDEFLERİM ── */}
            {(statusActiveCount > 0 || hasAnyActiveMode) && (
              <View style={{ gap: S.md, marginTop: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                  <Flame size={16} color="#F97316" />
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {language === 'tr' ? 'Aktif Hedeflerim' : 'Active Goals'}
                  </Text>
                </View>
                {seasonal.tasarrufMode && <View onLayout={(e) => { cardY.current.tasarruf = e.nativeEvent.layout.y; }}><TasarrufCard /></View>}
                {seasonal.birakmaMode && <View onLayout={(e) => { cardY.current.birakma = e.nativeEvent.layout.y; }}><BirakmaCard /></View>}
                <View onLayout={(e) => { cardY.current.ramazan = e.nativeEvent.layout.y; }}><RamazanCard onOpenPreview={() => setModePreview({ type: 'ramazan', key: Date.now() })} /></View>
                {seasonal.examMode && <View onLayout={(e) => { cardY.current.exam = e.nativeEvent.layout.y; }}><ExamCard onOpenPreview={(p) => setModePreview({ type: 'exam', key: Date.now(), ...p })} /></View>}
                {seasonal.tezMode && <View onLayout={(e) => { cardY.current.tez = e.nativeEvent.layout.y; }}><TezCard onOpenPreview={() => setModePreview({ type: 'tez', key: Date.now() })} /></View>}
                {seasonal.mulakatMode && <View onLayout={(e) => { cardY.current.mulakat = e.nativeEvent.layout.y; }}><MulakatCard onOpenPreview={(slot) => setModePreview({ type: 'mulakat', key: Date.now(), mulakatSlot: slot })} /></View>}
                {seasonal.sporMode && <View onLayout={(e) => { cardY.current.spor = e.nativeEvent.layout.y; }}><SporCard onOpenPreview={(slot) => setModePreview({ type: 'spor', key: Date.now(), sporSlot: slot })} /></View>}
              </View>
            )}

            {/* ── KATMAN 2: 2 SÜTUNLU KEŞİF IZGARASI (PASİF HEDEFLER) ── */}
            {(() => {
              const discoveryItems = [
                {
                  key: 'spor',
                  active: seasonal.sporMode,
                  title: language === 'tr' ? 'Spor & Fiziksel' : 'Fitness & Health',
                  desc: language === 'tr' ? 'Kilo, koşu veya antrenman takibi' : 'Weight, running or workouts',
                  icon: '🏋️',
                  color: '#F97316',
                  onActivate: () => { setSeasonalPref('sporMode', true); focusCard('spor'); },
                },
                {
                  key: 'exam',
                  active: seasonal.examMode,
                  title: language === 'tr' ? 'Sınav Takibi' : 'Exam Tracking',
                  desc: language === 'tr' ? 'YKS, KPSS, ALES çalışma planı' : 'Study plan for any exam',
                  icon: '📖',
                  color: '#3B82F6',
                  onActivate: () => { setSeasonalPref('examMode', true); focusCard('exam'); },
                },
                {
                  key: 'tez',
                  active: seasonal.tezMode,
                  title: language === 'tr' ? 'Tez / Proje' : 'Thesis / Project',
                  desc: language === 'tr' ? 'Deadline odaklı bitirme akışı' : 'Deadline-driven project plan',
                  icon: '📝',
                  color: '#8B5CF6',
                  onActivate: () => { setSeasonalPref('tezMode', true); focusCard('tez'); },
                },
                {
                  key: 'mulakat',
                  active: seasonal.mulakatMode,
                  title: language === 'tr' ? 'İş Mülakatı' : 'Job Interview',
                  desc: language === 'tr' ? 'Mülakat gününe hazırlık akışı' : 'Preparation until interview',
                  icon: '💼',
                  color: '#10B981',
                  onActivate: () => { setSeasonalPref('mulakatMode', true); focusCard('mulakat'); },
                },
                {
                  key: 'tasarruf',
                  active: seasonal.tasarrufMode,
                  title: language === 'tr' ? 'Tasarruf / Bütçe' : 'Savings / Budget',
                  desc: language === 'tr' ? 'Para hedefine ulaşma planı' : 'Steps to reach money goal',
                  icon: '💰',
                  color: '#10B981',
                  onActivate: () => { setSeasonalPref('tasarrufMode', true); focusCard('tasarruf'); },
                },
                {
                  key: 'birakma',
                  active: seasonal.birakmaMode,
                  title: language === 'tr' ? 'Bırakma' : 'Quit Habit',
                  desc: language === 'tr' ? 'Kötü alışkanlıklardan adım adım kurtul' : 'Quit bad habits step by step',
                  icon: '🚫',
                  color: '#EF4444',
                  onActivate: () => { setSeasonalPref('birakmaMode', true); focusCard('birakma'); },
                },
              ].filter(item => !item.active);

              if (discoveryItems.length === 0) return null;

              const cardW = (screenWidth - S.lg * 2 - S.md) / 2;

              return (
                <View style={{ gap: S.md, marginTop: statusActiveCount > 0 ? S.lg : S.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={16} color="#8B5CF6" />
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                        {language === 'tr' ? 'Yeni Hedef Keşfet' : 'Discover New Goals'}
                      </Text>
                    </View>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600', opacity: 0.6 }}>
                      {language === 'tr' ? 'Dokun & Başla' : 'Tap to Start'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.md }}>
                    {discoveryItems.map((item) => (
                      <Touchable
                        key={item.key}
                        onPress={() => {
                          Haptics.selectionAsync();
                          item.onActivate();
                        }}
                        style={{
                          width: cardW,
                          backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest,
                          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
                          borderWidth: B.thin,
                          borderRadius: R.lg,
                          padding: S.md,
                          gap: S.sm,
                          justifyContent: 'space-between',
                          minHeight: 124,
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: item.color + (isDark ? '26' : '18'), alignItems: 'center', justifyContent: 'center' }}>
                            {renderModeEmojiIcon(item.icon, 22, item.color)}
                          </View>
                          <View style={{ backgroundColor: item.color + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                            <Text style={{ color: item.color, fontSize: 11, fontWeight: '700' }}>{language === 'tr' ? '+ Ekle' : '+ Add'}</Text>
                          </View>
                        </View>
                        <View style={{ gap: 4, marginTop: 6 }}>
                          <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{item.title}</Text>
                          <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, lineHeight: 15, opacity: 0.8 }} numberOfLines={2}>{item.desc}</Text>
                        </View>
                      </Touchable>
                    ))}
                  </View>
                </View>
              );
            })()}
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
          onDismiss={() => { setModePreview(null); }}
          onSheetClose={() => { setModePreview(null); }}
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
          onClearPlan={(preserveMeta?: boolean) => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') {
              const slot = modePreview.examSlot ?? 'exam';
              const hIds = slot === 'exam2' ? exam2PlanHabitIds : slot === 'exam3' ? exam3PlanHabitIds : examPlanHabitIds;
              const tIds = slot === 'exam2' ? exam2PlanTaskIds  : slot === 'exam3' ? exam3PlanTaskIds  : examPlanTaskIds;
              hIds.forEach(id => removeHabit(id));
              tIds.forEach(id => retirePlanTask(id, slot));
              clearPlanIds(slot);
              if (!preserveMeta) {
                if (slot === 'exam2') { setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null); setExam2NameInput(''); setExam2DateInput(''); }
                else if (slot === 'exam3') { setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null); setExam3NameInput(''); setExam3DateInput(''); }
                else { setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null); setExamNameInput(''); setExamDateInput(''); }
              }
            } else if (t === 'tez') {
              tezPlanHabitIds.forEach(id => removeHabit(id));
              tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez'));
              clearPlanIds('tez');
              if (!preserveMeta) {
                setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); setTezNameInput(''); setTezDateInput('');
              }
            } else if (t === 'mulakat') {
              const slot = modePreview.mulakatSlot ?? 'mulakat';
              const hIds = slot === 'mulakat2' ? mulakat2PlanHabitIds : slot === 'mulakat3' ? mulakat3PlanHabitIds : mulakatPlanHabitIds;
              const tIds = slot === 'mulakat2' ? mulakat2PlanTaskIds  : slot === 'mulakat3' ? mulakat3PlanTaskIds  : mulakatPlanTaskIds;
              hIds.forEach(id => removeHabit(id));
              tIds.forEach(id => retirePlanTask(id, slot));
              clearPlanIds(slot);
              if (!preserveMeta) {
                if (slot === 'mulakat2') { setSeasonalPref('mulakat2Name', ''); setSeasonalPref('mulakat2Date', null); setMulakat2NameInput(''); setMulakat2DateInput(''); }
                else if (slot === 'mulakat3') { setSeasonalPref('mulakat3Name', ''); setSeasonalPref('mulakat3Date', null); setMulakat3NameInput(''); setMulakat3DateInput(''); }
                else { setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); setMulakatNameInput(''); setMulakatDateInput(''); }
              }
            } else if (t === 'spor') {
              const slot = modePreview.sporSlot ?? 'spor';
              const hIds = slot === 'spor2' ? spor2PlanHabitIds : slot === 'spor3' ? spor3PlanHabitIds : sporPlanHabitIds;
              const tIds = slot === 'spor2' ? spor2PlanTaskIds  : slot === 'spor3' ? spor3PlanTaskIds  : sporPlanTaskIds;
              hIds.forEach(id => removeHabit(id));
              tIds.forEach(id => retirePlanTask(id, slot));
              clearPlanIds(slot);
              if (!preserveMeta) {
                if (slot === 'spor2') { setSeasonalPref('spor2Goal', ''); setSeasonalPref('spor2Date', null); setSpor2GoalInput(''); setSpor2DateInput(''); }
                else if (slot === 'spor3') { setSeasonalPref('spor3Goal', ''); setSeasonalPref('spor3Date', null); setSpor3GoalInput(''); setSpor3DateInput(''); }
                else { setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null); setSporGoalInput(''); setSporDateInput(''); resetSporInputs(); }
              }
            } else {
              ramazanPlanHabitIds.forEach(id => removeHabit(id));
              habits.filter(h => RAMAZAN_HABIT_NAMES.some(n => n.toLowerCase() === h.name.toLowerCase())).forEach(h => removeHabit(h.id));
              ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
              clearPlanIds('ramazan');
              if (!preserveMeta) setSeasonalPref('ramazan', false);
            }
            setModePreview(null);
          }}
          onApplied={(habitIds, taskIds, meta) => {
            const t = modePreview.type;
            track('mode_activated', { type: t });
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
              // KILO: plan kurulur kurulmaz görevlere haftalık tartım görevini ekle
              // (bugün dolu kayıt yoksa bugüne, varsa +7 güne). Basılınca kilo girilir.
              if (slot === 'spor' && sporType === 'kilo') {
                const due = canLogWeight(weightLog) ? new Date() : (() => { const d = new Date(); d.setDate(d.getDate() + Math.max(1, daysUntilNextWeight(weightLog))); d.setHours(8, 0, 0, 0); return d; })();
                ensureWeeklyWeightTask(due, language as 'tr' | 'en');
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
  floatingTopBar: { borderRadius: R.full, overflow: 'hidden', borderWidth: B.thin },
  topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.sm },
  headerIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  modeCard: {
    borderWidth: B.thin,
    borderRadius: R.lg,
    overflow: 'hidden',
  },
});

