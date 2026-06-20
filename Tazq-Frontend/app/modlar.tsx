import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform, TextInput, Keyboard, Switch, Dimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, ChevronRight, CalendarDays } from 'lucide-react-native';
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
import { S, R, F } from '../constants/tokens';
import { useToastStore } from '../store/useToastStore';
import { getModePreview, ModeType, RAMAZAN_HABIT_NAMES } from '../utils/turkishModes';
import { getCurrentRamadanStatus, formatRamadanDate } from '../utils/ramadanDates';
import { matchExamName, detectExamFromInput, recommendTemplateId, HOURS_OPTIONS, type ExamPreset } from '../utils/examPresets';
import { TurkishModeBanner } from '../components/TurkishModeBanner';
import { TaskService } from '../services/api';

export default function ModlarScreen() {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();
  const ramadanStatus = useMemo(() => getCurrentRamadanStatus(), []);
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
    setPlanIds, clearPlanIds,
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

  const [modePreview, setModePreview] = useState<{ type: ModeType; key: number; templateId?: string; examTipTr?: string; examTipEn?: string; examName?: string; examDate?: string } | null>(null);
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
  const urgencyColor = examDaysLeft <= 7 ? '#EF4444' : examDaysLeft <= 30 ? '#F59E0B' : '#3B82F6';

  const exam2IsComplete = exam2NameInput.trim() !== '' && exam2DateInput !== '';
  const exam2DatePast = exam2DateInput ? new Date(exam2DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const exam2DaysLeft = exam2DateInput && !exam2DatePast ? Math.max(0, Math.ceil((new Date(exam2DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const exam2UrgencyColor = exam2DaysLeft <= 7 ? '#EF4444' : exam2DaysLeft <= 30 ? '#F59E0B' : '#3B82F6';

  const exam3IsComplete = exam3NameInput.trim() !== '' && exam3DateInput !== '';
  const exam3DatePast = exam3DateInput ? new Date(exam3DateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const exam3DaysLeft = exam3DateInput && !exam3DatePast ? Math.max(0, Math.ceil((new Date(exam3DateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const exam3UrgencyColor = exam3DaysLeft <= 7 ? '#EF4444' : exam3DaysLeft <= 30 ? '#F59E0B' : '#3B82F6';

  const tezIsComplete = tezNameInput.trim() !== '' && tezDateInput !== '';
  const tezDatePast = tezDateInput ? new Date(tezDateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const tezDaysLeft = tezDateInput && !tezDatePast ? Math.max(0, Math.ceil((new Date(tezDateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const tezUrgencyColor = tezDaysLeft <= 7 ? '#EF4444' : tezDaysLeft <= 30 ? '#F59E0B' : '#8B5CF6';

  const mulakatIsComplete = mulakatNameInput.trim() !== '' && mulakatDateInput !== '';
  const mulakatDatePast = mulakatDateInput ? new Date(mulakatDateInput).setHours(23, 59, 59, 999) < Date.now() : false;
  const mulakatDaysLeft = mulakatDateInput && !mulakatDatePast ? Math.max(0, Math.ceil((new Date(mulakatDateInput).setHours(23, 59, 59, 999) - Date.now()) / 86400000)) : 0;
  const mulakatUrgencyColor = mulakatDaysLeft <= 7 ? '#EF4444' : mulakatDaysLeft <= 30 ? '#F59E0B' : '#10B981';

  const tezPlanHabits = useMemo(() => habits.filter(h => tezPlanHabitIds.includes(h.id)), [habits, tezPlanHabitIds]);
  const tezHabitsActiveThisWeek = tezPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const tezWeekPct = tezPlanHabits.length > 0 ? Math.round(tezHabitsActiveThisWeek / tezPlanHabits.length * 100) : 0;

  const mulakatPlanHabits = useMemo(() => habits.filter(h => mulakatPlanHabitIds.includes(h.id)), [habits, mulakatPlanHabitIds]);
  const mulakatHabitsActiveThisWeek = mulakatPlanHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => thisWeekKeys.has(d))).length;
  const mulakatWeekPct = mulakatPlanHabits.length > 0 ? Math.round(mulakatHabitsActiveThisWeek / mulakatPlanHabits.length * 100) : 0;

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
      };
    }, [examReviewShown, language, closeExamModeWithReview])
  );

  useEffect(() => {
    if (seasonal.examMode && seasonal.examDate && seasonal.examName) {
      scheduleExamCountdownNotifs(seasonal.examName, seasonal.examDate, language);
    }
  }, [seasonal.examDate, seasonal.examName, seasonal.examMode]);

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
            <Text style={{ fontSize: F.hero, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}>
              {language === 'tr' ? 'Dönemsel Modlar' : 'Seasonal Modes'}
            </Text>
            <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant, marginTop: S.xs, opacity: 0.6 }}>
              {language === 'tr' ? 'Hedefine özel plan & alışkanlık paketleri' : 'Curated plan & habit bundles for your goals'}
            </Text>
          </View>

          {/* Info row */}
          <TouchableOpacity
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
          </TouchableOpacity>

          <View style={{ gap: S.md }}>
            {/* ── Ramazan Modu ── */}
            <View style={[styles.modeCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.ramazan ? (isDark ? 'rgba(99,102,241,0.30)' : 'rgba(99,102,241,0.20)') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }]}>
              <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.ramazan ? S.sm : S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: seasonal.ramazan ? '#6366F122' : '#6366F115', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>🌙</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>
                      {language === 'tr' ? 'Ramazan Modu' : 'Ramadan Mode'}
                    </Text>
                    <Text style={{ fontSize: F.caption, fontWeight: '500', marginTop: 1,
                      color: ramadanStatus.isActive ? '#6366F1' : seasonal.ramazan && ramadanStatus.period ? '#6366F1' : theme.onSurfaceVariant,
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
                        Alert.alert(
                          language === 'tr' ? 'Ramazan Modu Kapatılıyor' : 'Turning off Ramadan Mode',
                          hasItems
                            ? (language === 'tr' ? 'Eklenen tüm alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'All added habits and tasks will be removed. Are you sure?')
                            : (language === 'tr' ? 'Ramazan modunu kapatmak istiyor musun?' : 'Turn off Ramadan Mode?'),
                          [
                            { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                            {
                              text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove',
                              style: 'destructive',
                              onPress: () => {
                                ramazanPlanHabitIds.forEach(id => removeHabit(id));
                                habits.filter(h => RAMAZAN_HABIT_NAMES.some(n => n.toLowerCase() === h.name.toLowerCase())).forEach(h => removeHabit(h.id));
                                ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
                                clearPlanIds('ramazan');
                                setSeasonalPref('ramazan', false);
                                cancelRamadanStartNotification();
                              }
                            },
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
                    <TouchableOpacity onPress={() => setModePreview({ type: 'ramazan', key: Date.now() })} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }} activeOpacity={0.7}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' }} />
                      <Text style={{ color: '#6366F1', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{language === 'tr' ? 'Planı şimdiden hazırla' : 'Set up your plan in advance'}</Text>
                      <ChevronRight size={12} color="#6366F1" />
                    </TouchableOpacity>
                  ) : ramazanPlanHabits.length > 0 ? (
                    <View style={{ gap: S.sm }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text>
                        <Text style={{ color: '#6366F1', fontSize: F.caption, fontWeight: '800' }}>{ramazanHabitsActiveThisWeek}/{ramazanPlanHabits.length} · {ramazanWeekPct}%</Text>
                      </View>
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)', overflow: 'hidden' }}>
                        <View style={{ height: 5, borderRadius: 3, backgroundColor: '#6366F1', width: `${ramazanWeekPct}%` as any }} />
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setModePreview({ type: 'ramazan', key: Date.now() })} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }} activeOpacity={0.7}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' }} />
                      <Text style={{ color: '#6366F1', fontSize: F.caption, fontWeight: '700', flex: 1 }}>{language === 'tr' ? 'Plan henüz oluşturulmadı — Oluştur' : 'No plan yet — Create one'}</Text>
                      <ChevronRight size={12} color="#6366F1" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

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
                        Alert.alert(
                          language === 'tr' ? 'Sınav Takibi Kapatılıyor' : 'Turning off Exam Mode',
                          hasItems
                            ? (language === 'tr' ? 'Eklenen tüm alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'All added habits and tasks will be removed. Are you sure?')
                            : (language === 'tr' ? 'Sınav takibini kapatmak istiyor musun?' : 'Turn off Exam Mode?'),
                          [
                            { text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' },
                            {
                              text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove',
                              style: 'destructive',
                              onPress: () => {
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
                              }
                            },
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
                    <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setExamExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
                      <Text style={{ fontSize: 16 }}>🎯</Text>
                      <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Sınav ekle' : 'Add exam'}</Text>
                      <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
                    </TouchableOpacity>
                  )}

                  {examIsComplete && !examExpanded && (
                    <View style={{ gap: S.sm }}>
                      <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setExamExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: 1, borderColor: (examDatePast ? theme.error : urgencyColor) + '30', backgroundColor: (examDatePast ? theme.error : urgencyColor) + '08' }} activeOpacity={0.85}>
                        <View style={{ height: 3, backgroundColor: examDatePast ? theme.error : urgencyColor }} />
                        <View style={{ padding: S.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
                            <Text style={{ fontSize: 16, marginRight: S.xs }}>🎯</Text>
                            <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{examNameInput}</Text>
                            <Text style={{ color: examDatePast ? theme.error : urgencyColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                          </View>
                          {examDatePast ? (
                            <View style={{ gap: S.sm }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                                <Text style={{ color: theme.error, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? '📅 Tarih geçti' : '📅 Date has passed'}</Text>
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>· {formatExamDate(examDateInput)}</Text>
                              </View>
                              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); closeExamModeWithReview(); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: theme.error + '12', borderRadius: R.md, paddingVertical: S.sm, borderWidth: 1, borderColor: theme.error + '25' }} activeOpacity={0.75}>
                                <Text style={{ color: theme.error, fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Sınavı Tamamla & Kapat' : 'Complete & Close Exam'}</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                              <View style={{ alignItems: 'center', minWidth: 52 }}>
                                <Text style={{ color: urgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{examDaysLeft}</Text>
                                <Text style={{ color: urgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text>
                              </View>
                              <View style={{ flex: 1, paddingTop: 2 }}>
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>📅 {formatExamDate(examDateInput)}</Text>
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
                      </TouchableOpacity>

                      {!examDatePast && (
                        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'exam', key: Date.now() }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: urgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: urgencyColor + '22' }} activeOpacity={0.75}>
                          <BookOpen size={14} color={urgencyColor} />
                          <Text style={{ color: urgencyColor, fontWeight: '800', fontSize: F.caption }}>{examPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Çalışma Planı Oluştur' : 'Create Study Plan')}</Text>
                        </TouchableOpacity>
                      )}

                      {/* İkinci Sınav */}
                      <View style={{ marginTop: S.xs }}>
                        <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
                        {exam2IsComplete && !exam2Expanded ? (
                          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setExam2Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (exam2DatePast ? theme.error : exam2UrgencyColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
                            <Text style={{ fontSize: 14 }}>🎯</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{exam2NameInput}</Text>
                              <Text style={{ color: exam2DatePast ? theme.error : exam2UrgencyColor, fontSize: 11, fontWeight: '700' }}>{exam2DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${exam2DaysLeft} gün kaldı` : `${exam2DaysLeft} days left`)}</Text>
                            </View>
                            <Text style={{ color: exam2UrgencyColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                          </TouchableOpacity>
                        ) : !exam2IsComplete && !exam2Expanded ? (
                          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setExam2Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                            <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{language === 'tr' ? 'İkinci sınav ekle (YKS + TYT gibi)' : 'Add second exam (e.g. SAT + ACT)'}</Text>
                          </TouchableOpacity>
                        ) : null}
                        {exam2Expanded && (
                          <View style={{ gap: S.sm }}>
                            <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                              <TextInput value={exam2NameInput} onChangeText={(v) => { setExam2NameInput(v); setSeasonalPref('exam2Name', v); if (!v.trim()) { setExam2Suggestions([]); setSelectedExam2Preset(null); setExam2DailyMinutes(null); return; } const detected = detectExamFromInput(v); if (detected) { setSelectedExam2Preset(detected); setExam2Suggestions([]); } else { setSelectedExam2Preset(null); setExam2Suggestions(matchExamName(v)); } }} placeholder={language === 'tr' ? 'İkinci sınav adı (örn: YDS, ALES...)' : 'Second exam name (e.g. IELTS, GRE...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }} returnKeyType="done" onSubmitEditing={() => { if (exam2Suggestions.length > 0) { const top = exam2Suggestions[0]; setExam2NameInput(top.shortName); setSeasonalPref('exam2Name', top.shortName); setSelectedExam2Preset(top); setExam2Suggestions([]); } }} />
                            </View>
                            {exam2Suggestions.length > 0 && (
                              <View style={{ borderRadius: R.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                                {exam2Suggestions.map((preset, idx) => (
                                  <TouchableOpacity key={preset.id} onPress={() => { Haptics.selectionAsync(); setExam2NameInput(preset.shortName); setSeasonalPref('exam2Name', preset.shortName); setSelectedExam2Preset(preset); setExam2Suggestions([]); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} activeOpacity={0.7}>
                                    <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text>
                                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowExam2DatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                              <Text style={{ color: exam2DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{exam2DateInput ? formatExamDate(exam2DateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select date')}</Text>
                              <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                            </TouchableOpacity>
                            {showExam2DatePicker && (
                              <DateTimePicker value={exam2DateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowExam2DatePicker(false); if (event.type === 'dismissed') { setShowExam2DatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setExam2DateInput(iso); setSeasonalPref('exam2Date', iso); if (Platform.OS === 'ios') setShowExam2DatePicker(false); } }} />
                            )}
                            {selectedExam2Preset && (
                              <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}</Text>
                                <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                                  {HOURS_OPTIONS.map((opt) => { const active = exam2DailyMinutes === opt.minutes; return (<TouchableOpacity key={opt.minutes} onPress={() => { Haptics.selectionAsync(); setExam2DailyMinutes(active ? null : opt.minutes); }} style={{ paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.full, borderWidth: 1.5, borderColor: active ? exam2UrgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? exam2UrgencyColor + '18' : 'transparent' }} activeOpacity={0.7}><Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? exam2UrgencyColor : theme.onSurfaceVariant }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text></TouchableOpacity>); })}
                                </View>
                                {selectedExam2Preset.tipTr && (<Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>{language === 'tr' ? selectedExam2Preset.tipTr : selectedExam2Preset.tipEn}</Text>)}
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', gap: S.sm }}>
                              <TouchableOpacity onPress={() => { if (exam2NameInput || exam2DateInput) { exam2PlanHabitIds.forEach(id => removeHabit(id)); exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2')); clearPlanIds('exam2'); setExam2NameInput(''); setExam2DateInput(''); setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null); setSelectedExam2Preset(null); setExam2DailyMinutes(null); } setExam2Expanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                              </TouchableOpacity>
                              {exam2IsComplete && (
                                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExam2Expanded(false); const templateId = selectedExam2Preset ? recommendTemplateId(exam2DaysLeft, selectedExam2Preset.category, selectedExam2Preset.preferredTemplates, exam2DailyMinutes ?? selectedExam2Preset.defaultDailyMinutes) : undefined; setModePreview({ type: 'exam', key: Date.now(), templateId, examTipTr: selectedExam2Preset?.tipTr, examTipEn: selectedExam2Preset?.tipEn, examName: exam2NameInput, examDate: exam2DateInput }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: exam2UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}>
                                  <BookOpen size={13} color="#fff" />
                                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                                </TouchableOpacity>
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
                            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setExam3Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (exam3DatePast ? theme.error : exam3UrgencyColor) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
                              <Text style={{ fontSize: 14 }}>🎯</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{exam3NameInput}</Text>
                                <Text style={{ color: exam3DatePast ? theme.error : exam3UrgencyColor, fontSize: 11, fontWeight: '700' }}>{exam3DatePast ? (language === 'tr' ? 'Tarih geçti' : 'Date passed') : (language === 'tr' ? `${exam3DaysLeft} gün kaldı` : `${exam3DaysLeft} days left`)}</Text>
                              </View>
                              <Text style={{ color: exam3UrgencyColor, fontSize: 11, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text>
                            </TouchableOpacity>
                          ) : !exam3IsComplete && !exam3Expanded ? (
                            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setExam3Expanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
                              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
                              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{language === 'tr' ? 'Üçüncü sınav ekle' : 'Add third exam'}</Text>
                            </TouchableOpacity>
                          ) : null}
                          {exam3Expanded && (
                            <View style={{ gap: S.sm }}>
                              <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                                <TextInput value={exam3NameInput} onChangeText={(v) => { setExam3NameInput(v); setSeasonalPref('exam3Name', v); if (!v.trim()) { setExam3Suggestions([]); setSelectedExam3Preset(null); setExam3DailyMinutes(null); return; } const detected = detectExamFromInput(v); if (detected) { setSelectedExam3Preset(detected); setExam3Suggestions([]); } else { setSelectedExam3Preset(null); setExam3Suggestions(matchExamName(v)); } }} placeholder={language === 'tr' ? 'Üçüncü sınav adı (örn: YDS, DGS...)' : 'Third exam name (e.g. TOEFL, GMAT...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }} returnKeyType="done" onSubmitEditing={() => { if (exam3Suggestions.length > 0) { const top = exam3Suggestions[0]; setExam3NameInput(top.shortName); setSeasonalPref('exam3Name', top.shortName); setSelectedExam3Preset(top); setExam3Suggestions([]); } }} />
                              </View>
                              {exam3Suggestions.length > 0 && (
                                <View style={{ borderRadius: R.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                                  {exam3Suggestions.map((preset, idx) => (<TouchableOpacity key={preset.id} onPress={() => { Haptics.selectionAsync(); setExam3NameInput(preset.shortName); setSeasonalPref('exam3Name', preset.shortName); setSelectedExam3Preset(preset); setExam3Suggestions([]); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} activeOpacity={0.7}><Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text><Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text></TouchableOpacity>))}
                                </View>
                              )}
                              <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowExam3DatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                                <Text style={{ color: exam3DateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{exam3DateInput ? formatExamDate(exam3DateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select date')}</Text>
                                <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
                              </TouchableOpacity>
                              {showExam3DatePicker && (<DateTimePicker value={exam3DateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowExam3DatePicker(false); if (event.type === 'dismissed') { setShowExam3DatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setExam3DateInput(iso); setSeasonalPref('exam3Date', iso); if (Platform.OS === 'ios') setShowExam3DatePicker(false); } }} />)}
                              {selectedExam3Preset && (
                                <View style={{ gap: 6 }}>
                                  <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}</Text>
                                  <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                                    {HOURS_OPTIONS.map((opt) => { const active = exam3DailyMinutes === opt.minutes; return (<TouchableOpacity key={opt.minutes} onPress={() => { Haptics.selectionAsync(); setExam3DailyMinutes(active ? null : opt.minutes); }} style={{ paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.full, borderWidth: 1.5, borderColor: active ? exam3UrgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? exam3UrgencyColor + '18' : 'transparent' }} activeOpacity={0.7}><Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? exam3UrgencyColor : theme.onSurfaceVariant }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text></TouchableOpacity>); })}
                                  </View>
                                  {selectedExam3Preset.tipTr && (<Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>{language === 'tr' ? selectedExam3Preset.tipTr : selectedExam3Preset.tipEn}</Text>)}
                                </View>
                              )}
                              <View style={{ flexDirection: 'row', gap: S.sm }}>
                                <TouchableOpacity onPress={() => { if (exam3NameInput || exam3DateInput) { exam3PlanHabitIds.forEach(id => removeHabit(id)); exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3')); clearPlanIds('exam3'); setExam3NameInput(''); setExam3DateInput(''); setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null); setSelectedExam3Preset(null); setExam3DailyMinutes(null); } setExam3Expanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                                </TouchableOpacity>
                                {exam3IsComplete && (
                                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExam3Expanded(false); const templateId = selectedExam3Preset ? recommendTemplateId(exam3DaysLeft, selectedExam3Preset.category, selectedExam3Preset.preferredTemplates, exam3DailyMinutes ?? selectedExam3Preset.defaultDailyMinutes) : undefined; setModePreview({ type: 'exam', key: Date.now(), templateId, examTipTr: selectedExam3Preset?.tipTr, examTipEn: selectedExam3Preset?.tipEn, examName: exam3NameInput, examDate: exam3DateInput }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: exam3UrgencyColor, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}>
                                    <BookOpen size={13} color="#fff" />
                                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                                  </TouchableOpacity>
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
                      <View ref={examInputViewRef} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                        <TextInput value={examNameInput} onChangeText={(v) => { setExamNameInput(v); setSeasonalPref('examName', v); if (!v.trim()) { setExamSuggestions([]); setSelectedExamPreset(null); setExamDailyMinutes(null); return; } const detected = detectExamFromInput(v); if (detected) { setSelectedExamPreset(detected); setExamSuggestions([]); } else { setSelectedExamPreset(null); setExamSuggestions(matchExamName(v)); } }} placeholder={language === 'tr' ? 'Sınav adı (örn: ALES, DGS, KPSS...)' : 'Exam name (e.g. SAT, GRE, IELTS...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" onSubmitEditing={() => { if (examSuggestions.length > 0) { const top = examSuggestions[0]; setExamNameInput(top.shortName); setSeasonalPref('examName', top.shortName); setSelectedExamPreset(top); setExamSuggestions([]); } }} />
                      </View>
                      {examSuggestions.length > 0 && (
                        <View style={{ borderRadius: R.md, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
                          {examSuggestions.map((preset, idx) => (<TouchableOpacity key={preset.id} onPress={() => { Haptics.selectionAsync(); setExamNameInput(preset.shortName); setSeasonalPref('examName', preset.shortName); setSelectedExamPreset(preset); setExamSuggestions([]); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }} activeOpacity={0.7}><Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface, minWidth: 44 }}>{preset.shortName}</Text><Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{preset.displayName}</Text></TouchableOpacity>))}
                        </View>
                      )}
                      <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                        <Text style={{ color: examDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{examDateInput ? formatExamDate(examDateInput) : (language === 'tr' ? 'Sınav tarihi seç' : 'Select exam date')}</Text>
                        <CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} />
                      </TouchableOpacity>
                      {showDatePicker && (<DateTimePicker value={examDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowDatePicker(false); if (event.type === 'dismissed') { setShowDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setExamDateInput(iso); setSeasonalPref('examDate', iso); if (Platform.OS === 'ios') setShowDatePicker(false); } }} />)}
                      {selectedExamPreset && (
                        <View style={{ gap: 6 }}>
                          <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.8 }}>{language === 'tr' ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}</Text>
                          <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                            {HOURS_OPTIONS.map((opt) => { const active = examDailyMinutes === opt.minutes; return (<TouchableOpacity key={opt.minutes} onPress={() => { Haptics.selectionAsync(); setExamDailyMinutes(active ? null : opt.minutes); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.sm + 2, paddingVertical: 7, borderRadius: R.full, borderWidth: 1.5, borderColor: active ? urgencyColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? urgencyColor + '18' : 'transparent' }} activeOpacity={0.7}><Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? urgencyColor : theme.onSurfaceVariant }}>{language === 'tr' ? opt.labelTr : opt.labelEn}</Text></TouchableOpacity>); })}
                          </View>
                          {selectedExamPreset.tipTr && (<Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.65, lineHeight: 15 }}>{language === 'tr' ? selectedExamPreset.tipTr : selectedExamPreset.tipEn}</Text>)}
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: S.sm }}>
                        <TouchableOpacity onPress={() => { setExamExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text>
                        </TouchableOpacity>
                        {examIsComplete && (
                          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExamExpanded(false); const templateId = selectedExamPreset ? recommendTemplateId(examDaysLeft, selectedExamPreset.category, selectedExamPreset.preferredTemplates, examDailyMinutes ?? selectedExamPreset.defaultDailyMinutes) : undefined; setModePreview({ type: 'exam', key: Date.now(), templateId, examTipTr: selectedExamPreset?.tipTr, examTipEn: selectedExamPreset?.tipEn, examName: examNameInput, examDate: examDateInput }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: urgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}>
                            <BookOpen size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text>
                          </TouchableOpacity>
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
                    <Text style={{ fontSize: 18 }}>📝</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'Tez / Proje' : 'Thesis / Project'}</Text>
                    {seasonal.tezMode && tezIsComplete ? (
                      <Text style={{ color: tezDatePast ? theme.error : tezUrgencyColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>{tezDatePast ? (language === 'tr' ? 'Teslim tarihi geçti' : 'Deadline passed') : (language === 'tr' ? `${tezDaysLeft} gün kaldı` : `${tezDaysLeft} days left`)}</Text>
                    ) : (
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{language === 'tr' ? 'Deadline odaklı akademik / proje planı' : 'Deadline-driven thesis or project plan'}</Text>
                    )}
                  </View>
                  <Switch value={seasonal.tezMode} onValueChange={(v) => { Haptics.selectionAsync(); if (!v && seasonal.tezMode) { const hasItems = tezPlanHabitIds.length > 0 || tezPlanTaskIds.length > 0; Alert.alert(language === 'tr' ? 'Tez Modu Kapatılıyor' : 'Turning off Thesis Mode', hasItems ? (language === 'tr' ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?') : (language === 'tr' ? 'Tez / Proje modunu kapatmak istiyor musun?' : 'Turn off Thesis mode?'), [{ text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: () => { tezPlanHabitIds.forEach(id => removeHabit(id)); tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez')); clearPlanIds('tez'); setTezNameInput(''); setTezDateInput(''); setTezExpanded(false); setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); } }]); } else if (v) { setSeasonalPref('tezMode', true); } }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (tezIsComplete ? tezUrgencyColor : '#8B5CF6') + '80' }} thumbColor={seasonal.tezMode ? (tezIsComplete ? tezUrgencyColor : '#8B5CF6') : (isDark ? '#636366' : '#fff')} />
                </View>
              </View>
              {seasonal.tezMode && (
                <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                  <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
                  {!tezIsComplete && !tezExpanded && (<TouchableOpacity onPress={() => { Haptics.selectionAsync(); setTezExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}><Text style={{ fontSize: 16 }}>📝</Text><Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Proje ekle' : 'Add project'}</Text><ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} /></TouchableOpacity>)}
                  {tezIsComplete && !tezExpanded && (
                    <View style={{ gap: S.sm }}>
                      <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setTezExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: 1, borderColor: (tezDatePast ? theme.error : tezUrgencyColor) + '30', backgroundColor: (tezDatePast ? theme.error : tezUrgencyColor) + '08' }} activeOpacity={0.85}>
                        <View style={{ height: 3, backgroundColor: tezDatePast ? theme.error : tezUrgencyColor }} />
                        <View style={{ padding: S.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}><Text style={{ fontSize: 16, marginRight: S.xs }}>📝</Text><Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{tezNameInput}</Text><Text style={{ color: tezDatePast ? theme.error : tezUrgencyColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text></View>
                          {tezDatePast ? (<Text style={{ color: theme.error, fontWeight: '700' }}>{language === 'tr' ? '📅 Teslim tarihi geçti' : '📅 Deadline passed'} · {formatExamDate(tezDateInput)}</Text>) : (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                              <View style={{ alignItems: 'center', minWidth: 52 }}><Text style={{ color: tezUrgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{tezDaysLeft}</Text><Text style={{ color: tezUrgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text></View>
                              <View style={{ flex: 1, paddingTop: 2 }}>
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>📅 {formatExamDate(tezDateInput)}</Text>
                                {tezPlanHabits.length > 0 && (<View style={{ marginTop: S.sm, gap: 4 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text><Text style={{ color: tezUrgencyColor, fontSize: 11, fontWeight: '800' }}>{tezHabitsActiveThisWeek}/{tezPlanHabits.length} · {tezWeekPct}%</Text></View><View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: tezUrgencyColor, width: `${tezWeekPct}%` as any }} /></View></View>)}
                              </View>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'tez', key: Date.now() }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: tezUrgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: tezUrgencyColor + '22' }} activeOpacity={0.75}>
                        <BookOpen size={14} color={tezUrgencyColor} />
                        <Text style={{ color: tezUrgencyColor, fontWeight: '800', fontSize: F.caption }}>{tezPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Çalışma Planı Oluştur' : 'Create Work Plan')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {tezExpanded && (
                    <View style={{ gap: S.sm }}>
                      <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}><TextInput value={tezNameInput} onChangeText={(v) => { setTezNameInput(v); setSeasonalPref('tezName', v); }} placeholder={language === 'tr' ? 'Proje adı (Yüksek Lisans Tezi...)' : "Project name (Master's Thesis...)"} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" /></View>
                      <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowTezDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}><Text style={{ color: tezDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{tezDateInput ? formatExamDate(tezDateInput) : (language === 'tr' ? 'Teslim tarihi seç' : 'Select deadline')}</Text><CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} /></TouchableOpacity>
                      {showTezDatePicker && (<DateTimePicker value={tezDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowTezDatePicker(false); if (event.type === 'dismissed') { setShowTezDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setTezDateInput(iso); setSeasonalPref('tezDate', iso); if (Platform.OS === 'ios') setShowTezDatePicker(false); } }} />)}
                      <View style={{ flexDirection: 'row', gap: S.sm }}>
                        <TouchableOpacity onPress={() => { setTezExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}><Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text></TouchableOpacity>
                        {tezIsComplete && (<TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTezExpanded(false); setModePreview({ type: 'tez', key: Date.now() }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: tezUrgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}><BookOpen size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></TouchableOpacity>)}
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
                    <Text style={{ fontSize: 18 }}>💼</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{language === 'tr' ? 'İş Mülakatı' : 'Job Interview'}</Text>
                    {seasonal.mulakatMode && mulakatIsComplete ? (
                      <Text style={{ color: mulakatDatePast ? theme.error : mulakatUrgencyColor, fontSize: F.caption, fontWeight: '700', marginTop: 1 }}>{mulakatDatePast ? (language === 'tr' ? 'Mülakat tarihi geçti' : 'Interview passed') : (language === 'tr' ? `${mulakatDaysLeft} gün kaldı` : `${mulakatDaysLeft} days left`)}</Text>
                    ) : (
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{language === 'tr' ? 'Mülakat tarihine kadar hazırlık planı' : 'Prep plan until your interview date'}</Text>
                    )}
                  </View>
                  <Switch value={seasonal.mulakatMode} onValueChange={(v) => { Haptics.selectionAsync(); if (!v && seasonal.mulakatMode) { const hasItems = mulakatPlanHabitIds.length > 0 || mulakatPlanTaskIds.length > 0; Alert.alert(language === 'tr' ? 'Mülakat Modu Kapatılıyor' : 'Turning off Interview Mode', hasItems ? (language === 'tr' ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?') : (language === 'tr' ? 'Mülakat modunu kapatmak istiyor musun?' : 'Turn off Interview mode?'), [{ text: language === 'tr' ? 'İptal' : 'Cancel', style: 'cancel' }, { text: language === 'tr' ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: () => { mulakatPlanHabitIds.forEach(id => removeHabit(id)); mulakatPlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat')); clearPlanIds('mulakat'); setMulakatNameInput(''); setMulakatDateInput(''); setMulakatExpanded(false); setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); } }]); } else if (v) { setSeasonalPref('mulakatMode', true); } }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (mulakatIsComplete ? mulakatUrgencyColor : '#10B981') + '80' }} thumbColor={seasonal.mulakatMode ? (mulakatIsComplete ? mulakatUrgencyColor : '#10B981') : (isDark ? '#636366' : '#fff')} />
                </View>
              </View>
              {seasonal.mulakatMode && (
                <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
                  <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
                  {!mulakatIsComplete && !mulakatExpanded && (<TouchableOpacity onPress={() => { Haptics.selectionAsync(); setMulakatExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}><Text style={{ fontSize: 16 }}>💼</Text><Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body, flex: 1 }}>{language === 'tr' ? 'Mülakat ekle' : 'Add interview'}</Text><ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} /></TouchableOpacity>)}
                  {mulakatIsComplete && !mulakatExpanded && (
                    <View style={{ gap: S.sm }}>
                      <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setMulakatExpanded(true); }} style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: 1, borderColor: (mulakatDatePast ? theme.error : mulakatUrgencyColor) + '30', backgroundColor: (mulakatDatePast ? theme.error : mulakatUrgencyColor) + '08' }} activeOpacity={0.85}>
                        <View style={{ height: 3, backgroundColor: mulakatDatePast ? theme.error : mulakatUrgencyColor }} />
                        <View style={{ padding: S.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}><Text style={{ fontSize: 16, marginRight: S.xs }}>💼</Text><Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body, flex: 1 }}>{mulakatNameInput}</Text><Text style={{ color: mulakatDatePast ? theme.error : mulakatUrgencyColor, fontSize: F.caption, fontWeight: '800' }}>{language === 'tr' ? 'Düzenle ›' : 'Edit ›'}</Text></View>
                          {mulakatDatePast ? (<Text style={{ color: theme.error, fontWeight: '700' }}>{language === 'tr' ? '📅 Mülakat tarihi geçti' : '📅 Interview date passed'} · {formatExamDate(mulakatDateInput)}</Text>) : (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                              <View style={{ alignItems: 'center', minWidth: 52 }}><Text style={{ color: mulakatUrgencyColor, fontWeight: '900', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{mulakatDaysLeft}</Text><Text style={{ color: mulakatUrgencyColor, fontSize: 10, fontWeight: '800', opacity: 0.7, letterSpacing: 1 }}>{language === 'tr' ? 'GÜN' : 'DAYS'}</Text></View>
                              <View style={{ flex: 1, paddingTop: 2 }}>
                                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>📅 {formatExamDate(mulakatDateInput)}</Text>
                                {mulakatPlanHabits.length > 0 && (<View style={{ marginTop: S.sm, gap: 4 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{language === 'tr' ? 'Bu haftaki ilerleme' : "This week's progress"}</Text><Text style={{ color: mulakatUrgencyColor, fontSize: 11, fontWeight: '800' }}>{mulakatHabitsActiveThisWeek}/{mulakatPlanHabits.length} · {mulakatWeekPct}%</Text></View><View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: mulakatUrgencyColor, width: `${mulakatWeekPct}%` as any }} /></View></View>)}
                              </View>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setModePreview({ type: 'mulakat', key: Date.now() }); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: mulakatUrgencyColor + '12', borderRadius: R.md, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: mulakatUrgencyColor + '22' }} activeOpacity={0.75}>
                        <BookOpen size={14} color={mulakatUrgencyColor} />
                        <Text style={{ color: mulakatUrgencyColor, fontWeight: '800', fontSize: F.caption }}>{mulakatPlanHabits.length > 0 ? (language === 'tr' ? 'Planı Görüntüle & Güncelle' : 'View & Update Plan') : (language === 'tr' ? 'Hazırlık Planı Oluştur' : 'Create Prep Plan')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {mulakatExpanded && (
                    <View style={{ gap: S.sm }}>
                      <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1 }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}><TextInput value={mulakatNameInput} onChangeText={(v) => { setMulakatNameInput(v); setSeasonalPref('mulakatName', v); }} placeholder={language === 'tr' ? 'Şirket / Pozisyon (Google - SWE...)' : 'Company / Role (Google - SWE...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" /></View>
                      <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowMulakatDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}><Text style={{ color: mulakatDateInput ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{mulakatDateInput ? formatExamDate(mulakatDateInput) : (language === 'tr' ? 'Mülakat tarihi seç' : 'Select interview date')}</Text><CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} /></TouchableOpacity>
                      {showMulakatDatePicker && (<DateTimePicker value={mulakatDateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') setShowMulakatDatePicker(false); if (event.type === 'dismissed') { setShowMulakatDatePicker(false); return; } if (date) { const iso = date.toISOString().split('T')[0]; setMulakatDateInput(iso); setSeasonalPref('mulakatDate', iso); if (Platform.OS === 'ios') setShowMulakatDatePicker(false); } }} />)}
                      <View style={{ flexDirection: 'row', gap: S.sm }}>
                        <TouchableOpacity onPress={() => { setMulakatExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}><Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{language === 'tr' ? 'Kapat' : 'Close'}</Text></TouchableOpacity>
                        {mulakatIsComplete && (<TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setMulakatExpanded(false); setModePreview({ type: 'mulakat', key: Date.now() }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: mulakatUrgencyColor, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}><BookOpen size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: F.caption }}>{language === 'tr' ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></TouchableOpacity>)}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
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
            mulakatName: mulakatNameInput,
            mulakatDate: mulakatDateInput,
          })}
          onDismiss={() => {
            const t = modePreview.type;
            if (t === 'ramazan' && ramazanPlanHabitIds.length === 0) { setSeasonalPref('ramazan', false); }
            else if (t === 'tez' && tezPlanHabitIds.length === 0) { setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); setTezNameInput(''); setTezDateInput(''); }
            else if (t === 'mulakat' && mulakatPlanHabitIds.length === 0) { setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); setMulakatNameInput(''); setMulakatDateInput(''); }
            setModePreview(null);
          }}
          onSheetClose={() => {
            const t = modePreview?.type;
            if (!t) return;
            if (t === 'ramazan' && ramazanPlanHabitIds.length === 0) { setSeasonalPref('ramazan', false); }
            else if (t === 'tez' && tezPlanHabitIds.length === 0) { setSeasonalPref('tezMode', false); setSeasonalPref('tezName', ''); setSeasonalPref('tezDate', null); setTezNameInput(''); setTezDateInput(''); }
            else if (t === 'mulakat' && mulakatPlanHabitIds.length === 0) { setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null); setMulakatNameInput(''); setMulakatDateInput(''); }
            setModePreview(null);
          }}
          showSheetImmediately
          planApplied={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') return examPlanHabitIds.length > 0 || examPlanTaskIds.length > 0;
            if (t === 'tez') return tezPlanHabitIds.length > 0 || tezPlanTaskIds.length > 0;
            if (t === 'mulakat') return mulakatPlanHabitIds.length > 0 || mulakatPlanTaskIds.length > 0;
            return ramazanPlanHabitIds.length > 0 || ramazanPlanTaskIds.length > 0;
          })()}
          planHabitIds={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') return examPlanHabitIds;
            if (t === 'tez') return tezPlanHabitIds;
            if (t === 'mulakat') return mulakatPlanHabitIds;
            return ramazanPlanHabitIds;
          })()}
          planTaskIds={(() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') return examPlanTaskIds;
            if (t === 'tez') return tezPlanTaskIds;
            if (t === 'mulakat') return mulakatPlanTaskIds;
            return ramazanPlanTaskIds;
          })()}
          onClearPlan={() => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') {
              examPlanHabitIds.forEach(id => removeHabit(id));
              examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
              clearPlanIds('exam');
            } else if (t === 'tez') {
              tezPlanHabitIds.forEach(id => removeHabit(id));
              tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez'));
              clearPlanIds('tez');
            } else if (t === 'mulakat') {
              mulakatPlanHabitIds.forEach(id => removeHabit(id));
              mulakatPlanTaskIds.forEach(id => retirePlanTask(id, 'mulakat'));
              clearPlanIds('mulakat');
            } else {
              ramazanPlanHabitIds.forEach(id => removeHabit(id));
              habits.filter(h => RAMAZAN_HABIT_NAMES.some(n => n.toLowerCase() === h.name.toLowerCase())).forEach(h => removeHabit(h.id));
              ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
              clearPlanIds('ramazan');
            }
            setModePreview(null);
          }}
          onApplied={(habitIds, taskIds) => {
            const t = modePreview.type;
            if (t === 'exam' || t === 'yks' || t === 'kpss') setPlanIds('exam', habitIds, taskIds);
            else if (t === 'tez') setPlanIds('tez', habitIds, taskIds);
            else if (t === 'mulakat') setPlanIds('mulakat', habitIds, taskIds);
            else setPlanIds('ramazan', habitIds, taskIds);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modeCard: {
    borderWidth: 1,
    borderRadius: R.lg,
    overflow: 'hidden',
  },
});
