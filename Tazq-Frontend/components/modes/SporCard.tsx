/**
 * SporCard — "Spor / Fiziksel Hedef" modu (3 slot, en kapsamlısı). modlar.tsx'ten çıkarıldı.
 * Kilo (çift çark + BMI + otomatik tarih + 7-gün kadanslı tartım), maraton (km+etkinlik),
 * güç/genel (haftalık gün). Deadline "Hedef Sonucu" efekti burada. Önizleme merkezi → onOpenPreview.
 * Veri: seasonal (hedef/tarih) + useSporStore (kilo/ölçüler). Local-mirror yok.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TextInput, Platform, useWindowDimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ChevronRight, CalendarDays, X, TrendingUp, TrendingDown, Target, AlertTriangle, XCircle } from 'lucide-react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguageStore } from '../../store/useLanguageStore';
import { usePrefsStore } from '../../store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '../../store/useHabitStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useSporStore } from '../../store/useSporStore';
import { usePlanAdaptations } from '../../hooks/usePlanAdaptations';
import { CustomAlert as Alert } from '../CustomAlert';
import { Touchable } from '@/components/Touchable';
import { renderModeEmojiIcon } from '../../utils/modeIcons';
import { retirePlanTask, formatPlanDate, isDatePast, daysLeftOf } from '../../utils/planTaskOps';
import { detectSporType, localizeSporGoal } from '../../utils/turkishModes';
import { recordWeeklyWeight, canLogWeight, daysUntilNextWeight } from '../../utils/weightCheckin';
import { WeightWheelPicker } from './WeightWheelPicker';
import { S, R, F, B } from '../../constants/tokens';

const SPOR = '#F97316';
const BASE_CALENDAR_WIDTH = 340;
type Slot = 'spor' | 'spor2' | 'spor3';
const SPOR_EMOJIS = ['🏃', '💪', '⚖️', '✨', '🏆'];
const stripEmojiPrefix = (str: string) => { let c = str || ''; for (const e of SPOR_EMOJIS) if (c.startsWith(e)) c = c.substring(e.length).trim(); return c; };
const getEmojiFromLabel = (str: string) => { for (const e of SPOR_EMOJIS) if ((str || '').startsWith(e)) return e; return ''; };
const goalEmoji = (type: string | null) => type === 'kilo' ? '⚖️' : type === 'maraton' ? '🏃' : type === 'yaris' ? '🏆' : type === 'genel' ? '✨' : '💪';

const MarsIcon = ({ size = 16, color = '#000', strokeWidth = 2.5 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><Path d="M16 3h5v5" /><Path d="M21 3 14.5 9.5" /><Circle cx="11" cy="17" r="5" /></Svg>
);
const VenusIcon = ({ size = 16, color = '#000', strokeWidth = 2.5 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="9" r="5" /><Line x1="12" x2="12" y1="14" y2="22" /><Line x1="9" x2="15" y1="18" y2="18" /></Svg>
);

function getSporGoals(tr: boolean) {
  return tr
    ? [{ key: 'maraton', label: '🏃 Maraton / Koşu' }, { key: 'guc', label: '💪 Güç & Kas' }, { key: 'kilo', label: '⚖️ Kilo Yönetimi' }, { key: 'genel', label: '✨ Genel Form' }, { key: 'yaris', label: '🏆 Spor Yarışması' }]
    : [{ key: 'maraton', label: '🏃 Marathon / Running' }, { key: 'guc', label: '💪 Strength & Muscle' }, { key: 'kilo', label: '⚖️ Weight Management' }, { key: 'genel', label: '✨ General Fitness' }, { key: 'yaris', label: '🏆 Sport Competition' }];
}
function sporGoalsForSlot(tr: boolean, selfLabel: string, otherLabels: string[]) {
  const otherKeys = new Set(otherLabels.filter(Boolean).map(l => detectSporType(l)));
  const selfKey = selfLabel ? detectSporType(selfLabel) : null;
  return getSporGoals(tr).filter(g => g.key === selfKey || !otherKeys.has(g.key as any));
}

function useCalScale() {
  const { width } = useWindowDimensions();
  const aw = width - S.lg * 2 - S.md * 2;
  return aw < BASE_CALENDAR_WIDTH ? aw / BASE_CALENDAR_WIDTH : 1;
}

function SporDatePicker({ value, onPick, onClose }: { value: Date; onPick: (iso: string) => void; onClose: () => void }) {
  const { isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const calendarScale = useCalScale();
  return (
    <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
      <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : undefined}>
        <DateTimePicker style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined} value={value} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'} minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })()}
          onChange={(event: DateTimePickerEvent, date?: Date) => { if (Platform.OS === 'android') onClose(); if (event.type === 'dismissed') { onClose(); return; } if (date) { onPick(date.toISOString().split('T')[0]); if (Platform.OS === 'ios') onClose(); } }} />
      </View>
    </View>
  );
}

/** İkincil spor hedefi (spor2 / spor3). */
function SporSlot({ slot, goalKey, dateKey, otherGoals, addLabel, onOpenPreview }: { slot: Slot; goalKey: 'spor2Goal' | 'spor3Goal'; dateKey: 'spor2Date' | 'spor3Date'; otherGoals: string[]; addLabel: string; onOpenPreview: (s: Slot) => void }) {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const planHabitIds = usePrefsStore(s => (s as any)[`${slot}PlanHabitIds`]) as string[];
  const planTaskIds = usePrefsStore(s => (s as any)[`${slot}PlanTaskIds`]) as number[];
  const removeHabit = useHabitStore(s => s.removeHabit);

  const goal = localizeSporGoal((seasonal as any)[goalKey] || '', tr);
  const date = (seasonal as any)[dateKey] || '';
  const complete = goal.trim() !== '' && date !== '';
  const past = isDatePast(date);
  const daysLeft = daysLeftOf(date);
  const dateObj = date ? new Date(date) : new Date(Date.now() + 90 * 86400000);
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const del = () => {
    planHabitIds.forEach(id => removeHabit(id)); planTaskIds.forEach(id => retirePlanTask(id, slot)); clearPlanIds(slot);
    setSeasonalPref(goalKey, ''); setSeasonalPref(dateKey, null); setExpanded(false);
  };

  return (
    <View style={{ marginTop: S.xs }}>
      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', marginBottom: S.sm }} />
      {complete && !expanded ? (
        <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (past ? theme.error : SPOR) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
          {renderModeEmojiIcon(getEmojiFromLabel(goal) || '🏋️', 14, SPOR)}
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.caption }}>{stripEmojiPrefix(goal)}</Text>
            <Text style={{ color: past ? theme.error : SPOR, fontSize: 11, fontWeight: '500' }}>{past ? (tr ? 'Tarih geçti' : 'Date passed') : (tr ? `${daysLeft} gün kaldı` : `${daysLeft} days left`)}</Text>
          </View>
          <Text style={{ color: SPOR, fontSize: 11, fontWeight: '600' }}>{tr ? 'Düzenle ›' : 'Edit ›'}</Text>
          <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(tr ? 'Hedefi Sil' : 'Delete Goal', tr ? `"${goal}" silinecek. Emin misin?` : `"${goal}" will be deleted. Are you sure?`, [{ text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: tr ? 'Sil' : 'Delete', style: 'destructive', onPress: del }]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }} accessibilityRole="button" accessibilityLabel={tr ? 'Sil' : 'Delete'}>
            <X size={13} color={theme.onSurfaceVariant} strokeWidth={2.5} />
          </Touchable>
        </Touchable>
      ) : !complete && !expanded ? (
        <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{addLabel}</Text>
        </Touchable>
      ) : null}
      {expanded && (
        <View style={{ gap: S.sm }}>
          <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8 }}>{tr ? 'Hedef türünü seç' : 'Select goal type'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
            {sporGoalsForSlot(tr, goal, otherGoals).map((g) => {
              const active = goal === g.label;
              return (
                <Touchable key={g.key} onPress={() => { Haptics.selectionAsync(); setSeasonalPref(goalKey, active ? '' : g.label); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.sm + 2, paddingVertical: 8, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? SPOR : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? SPOR + '18' : 'transparent' }} activeOpacity={0.7}>
                  {renderModeEmojiIcon(getEmojiFromLabel(g.label), 14, active ? SPOR : theme.onSurfaceVariant)}
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? SPOR : theme.onSurfaceVariant }}>{stripEmojiPrefix(g.label)}</Text>
                </Touchable>
              );
            })}
          </View>
          <Touchable onPress={() => { Haptics.selectionAsync(); setShowPicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
            <Text style={{ color: date ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{date ? formatPlanDate(date, tr) : (tr ? 'Hedef tarihi seç' : 'Select target date')}</Text>
            <CalendarDays size={14} color={theme.onSurfaceVariant} opacity={0.5} />
          </Touchable>
          {showPicker && <SporDatePicker value={dateObj} onPick={(iso) => setSeasonalPref(dateKey, iso)} onClose={() => setShowPicker(false)} />}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Touchable onPress={() => { if (goal || date) del(); setExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.caption }}>{tr ? 'Kapat' : 'Close'}</Text>
            </Touchable>
            {complete && (<Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExpanded(false); onOpenPreview(slot); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: SPOR, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}>{renderModeEmojiIcon('🏋️', 13, '#fff')}<Text style={{ color: '#fff', fontWeight: '600', fontSize: F.caption }}>{tr ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></Touchable>)}
          </View>
        </View>
      )}
    </View>
  );
}

export function SporCard({ onOpenPreview }: { onOpenPreview: (slot: Slot) => void }) {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const sporPlanHabitIds = usePrefsStore(s => s.sporPlanHabitIds);
  const sporPlanTaskIds = usePrefsStore(s => s.sporPlanTaskIds);
  const habits = useHabitStore(s => s.habits);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const tasks = useTaskStore(s => s.tasks);
  const { runAdaptations } = usePlanAdaptations();
  const {
    currentWeight, setCurrentWeight, targetWeight, setTargetWeight,
    heightCm, setHeightCm, ageYears, setAgeYears, gender, setGender,
    weeklyKm, setWeeklyKm, targetEvent, setTargetEvent, trainingDays, setTrainingDays,
    weightLog, resetInputs: resetSporInputs,
  } = useSporStore();

  const [expanded, setExpanded] = useState(() => !(usePrefsStore.getState().sporPlanHabitIds.length > 0 || usePrefsStore.getState().sporPlanTaskIds.length > 0));
  const [showPicker, setShowPicker] = useState(false);
  const [weightEntryInput, setWeightEntryInput] = useState('');
  const [showWeightEntry, setShowWeightEntry] = useState(false);

  const goal = localizeSporGoal(seasonal.sporGoal || '', tr);
  const date = seasonal.sporDate || '';
  const sporType = goal ? detectSporType(goal) : null;
  const cwNum = parseFloat(currentWeight);
  const twNum = parseFloat(targetWeight);
  const hnNum = parseFloat(heightCm);
  const heightM = hnNum >= 100 && hnNum <= 250 ? hnNum / 100 : 0;
  const minHealthyKg = heightM > 0 ? parseFloat((18.5 * heightM * heightM).toFixed(1)) : 0;
  const maxHealthyKg = heightM > 0 ? parseFloat((27.5 * heightM * heightM).toFixed(1)) : 0;
  const kiloGaining = cwNum > 0 && twNum > 0 && twNum > cwNum;
  const kiloWeeklyRate = kiloGaining ? 0.25 : 0.5;
  const kiloAutoWeeks = cwNum > 0 && twNum > 0 && cwNum !== twNum ? Math.ceil(Math.abs(cwNum - twNum) / kiloWeeklyRate) : null;
  const kiloAutoDate = kiloAutoWeeks ? new Date(Date.now() + kiloAutoWeeks * 7 * 86400000).toISOString().split('T')[0] : null;
  const effectiveSporDate = sporType === 'kilo' ? (kiloAutoDate ?? date) : date;
  const sporDateObj = effectiveSporDate ? new Date(effectiveSporDate) : new Date(Date.now() + 90 * 86400000);
  const kiloWeightValid = cwNum >= 30 && cwNum <= 300 && twNum >= 30 && twNum <= 300;
  const kiloWeightRealistic = Math.abs(cwNum - twNum) <= 100;
  const kiloBmiTargetTooLow = minHealthyKg > 0 && twNum > 0 && twNum < minHealthyKg;
  const kiloBmiCurrentUnderweight = minHealthyKg > 0 && cwNum > 0 && cwNum < minHealthyKg;
  const kiloBmiValid = !kiloBmiTargetTooLow;
  const sporInputsComplete = sporType === 'kilo'
    ? currentWeight.trim() !== '' && targetWeight.trim() !== '' && cwNum > 0 && twNum > 0 && cwNum !== twNum && kiloWeightValid && kiloWeightRealistic && kiloBmiValid
    : sporType === 'maraton' ? weeklyKm.trim() !== '' && targetEvent !== ''
    : (sporType === 'guc' || sporType === 'genel' || sporType === 'yaris') ? trainingDays !== null : false;
  const sporIsComplete = goal.trim() !== '' && sporInputsComplete && (sporType === 'kilo' ? kiloAutoDate !== null : date !== '');
  const past = isDatePast(effectiveSporDate);
  const daysLeft = daysLeftOf(effectiveSporDate);
  const latestWeight = weightLog.length > 0 ? weightLog[0].weight : null;
  const hasPlan = sporPlanHabitIds.length > 0 || sporPlanTaskIds.length > 0;

  // İlerleme: kilo → kilodaki yol; maraton/güç → haftalık antrenman günü; diğer → bugün.
  const kiloLatest = weightLog.length ? weightLog.reduce((a, b) => (a.date > b.date ? a : b)).weight : cwNum;
  const kiloGoalKg = Math.abs(cwNum - twNum);
  const kiloDoneKg = Math.max(0, cwNum > twNum ? (cwNum - kiloLatest) : (kiloLatest - cwNum));
  const kiloPct = kiloGoalKg > 0 ? Math.min(100, Math.round((kiloDoneKg / kiloGoalKg) * 100)) : 0;
  const todayKey = fmtDateKey();
  const weekKeys = (() => { const k = new Set<string>(); for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); k.add(fmtDateKey(d)); } return k; })();
  const sporTrainTarget = trainingDays ?? 3;
  const sporWeekDays = (() => { const days = new Set<string>(); tasks.forEach(t => { if (sporPlanTaskIds.includes(t.id) && t.isCompleted && t.completedAt && !t.completedAt.startsWith('0001')) { const k = fmtDateKey(new Date(t.completedAt)); if (weekKeys.has(k)) days.add(k); } }); return days.size; })();
  const sporTrainPct = sporTrainTarget > 0 ? Math.min(100, Math.round((sporWeekDays / sporTrainTarget) * 100)) : 0;
  const isToday = (d?: string | null) => !!d && !d.startsWith('0001') && fmtDateKey(new Date(d)) === todayKey;
  const planHabits = habits.filter(h => sporPlanHabitIds.includes(h.id));
  const wkTasks = tasks.filter(t => sporPlanTaskIds.includes(t.id) && (isToday(t.dueDate) || (t.isCompleted && isToday(t.completedAt))));
  const progTotal = planHabits.length + wkTasks.length;
  const progDone = planHabits.filter(h => (h.completedDates ?? []).includes(todayKey)).length + wkTasks.filter(t => t.isCompleted).length;
  const progPct = progTotal > 0 ? Math.round((progDone / progTotal) * 100) : 0;

  const closePlan = () => {
    sporPlanHabitIds.forEach(id => removeHabit(id)); sporPlanTaskIds.forEach(id => retirePlanTask(id, 'spor')); clearPlanIds('spor');
    setExpanded(false); resetSporInputs();
    setSeasonalPref('sporMode', false); setSeasonalPref('sporGoal', ''); setSeasonalPref('sporDate', null);
  };

  const saveWeightEntry = (kg: number) => {
    recordWeeklyWeight(kg, tr ? 'tr' : 'en').then(ok => {
      if (!ok) {
        setShowWeightEntry(false); setWeightEntryInput('');
        const left = daysUntilNextWeight(useSporStore.getState().weightLog);
        Alert.alert(tr ? 'Tartım zaten alındı' : 'Already logged', tr ? `Kilo 7 günde bir girilir. ${left} gün sonra tekrar gir.` : `Weight is logged every 7 days. Try again in ${left} day(s).`);
        return;
      }
      setWeightEntryInput(''); setShowWeightEntry(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => runAdaptations(true), 300);
    });
  };

  // ── DEADLINE "HEDEF SONUCU" (özet + Uzat/Kapat) ──
  const reviewHandledRef = useRef(false);
  useEffect(() => {
    if (reviewHandledRef.current) return;
    if (!seasonal.sporMode || !hasPlan || !past) return;
    reviewHandledRef.current = true;
    const isKilo = sporType === 'kilo';
    let summary: string;
    if (isKilo && twNum > 0 && cwNum > 0) {
      const reached = cwNum > twNum ? kiloLatest <= twNum : kiloLatest >= twNum;
      summary = reached
        ? (tr ? `🎉 Hedefine ulaştın! ${cwNum} → ${kiloLatest} kg (hedef ${twNum} kg)` : `🎉 Goal reached! ${cwNum} → ${kiloLatest} kg (target ${twNum} kg)`)
        : (tr ? `Süre doldu. ${cwNum} → ${kiloLatest} kg · hedef ${twNum} kg. Az kaldı, devam edelim mi?` : `Time's up. ${cwNum} → ${kiloLatest} kg · target ${twNum} kg. Almost there — keep going?`);
    } else {
      summary = tr ? `"${goal}" hedefinin süresi doldu. Programını tamamladın 💪 Uzatmak ister misin?` : `"${goal}" deadline reached. You completed your program 💪 Want to extend?`;
    }
    Alert.alert(tr ? 'Hedef Sonucu' : 'Goal Result', summary, [
      { text: tr ? 'Süreyi uzat (+4 hafta)' : 'Extend (+4 weeks)', onPress: () => { const d = new Date(); d.setDate(d.getDate() + 28); setSeasonalPref('sporDate', d.toISOString().split('T')[0]); reviewHandledRef.current = false; setTimeout(() => runAdaptations(true), 300); } },
      { text: tr ? 'Hedefi Kapat' : 'Close Goal', style: 'destructive', onPress: closePlan },
    ]);
  }, [seasonal.sporMode, sporPlanHabitIds, sporPlanTaskIds, past, sporType, twNum, cwNum, kiloLatest, tr]);

  const goalsSelf = sporGoalsForSlot(tr, goal, [seasonal.spor2Goal || '', seasonal.spor3Goal || '']);
  const unlocked = canLogWeight(weightLog);
  const nextLeft = daysUntilNextWeight(weightLog);
  const lastKg = weightLog.length ? weightLog.reduce((a, b) => (a.date > b.date ? a : b)).weight : null;
  const spor2Complete = (seasonal.spor2Goal || '').trim() !== '' && !!seasonal.spor2Date;

  return (
    <View style={{ borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden', backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.sporMode && sporIsComplete ? (past ? theme.error + '40' : SPOR + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }}>
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.sporMode ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: SPOR + '18', alignItems: 'center', justifyContent: 'center' }}>
            {renderModeEmojiIcon('🏋️', 18, SPOR)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'Spor / Fiziksel Hedef' : 'Sport / Physical Goal'}</Text>
            {seasonal.sporMode && sporIsComplete ? (
              <Text style={{ color: past ? theme.error : SPOR, fontSize: F.caption, fontWeight: '500', marginTop: 1 }}>{past ? (tr ? 'Hedef tarihi geçti' : 'Goal date passed') : (tr ? `${daysLeft} gün kaldı` : `${daysLeft} days left`)}</Text>
            ) : (
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, marginTop: 1 }}>{tr ? 'Uzman destekli antrenman & beslenme planı' : 'Expert-backed training & nutrition plan'}</Text>
            )}
          </View>
          <Switch value={seasonal.sporMode}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              if (!v && seasonal.sporMode) {
                if (!hasPlan) { closePlan(); return; }
                Alert.alert(tr ? 'Spor Modu Kapatılıyor' : 'Turning off Sport Mode', tr ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?', [{ text: tr ? 'İptal' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: closePlan }]);
              } else if (v) { setSeasonalPref('sporMode', true); setExpanded(true); }
            }}
            trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: SPOR + '80' }} thumbColor={seasonal.sporMode ? SPOR : (isDark ? '#636366' : '#fff')} />
        </View>
      </View>

      {seasonal.sporMode && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />

          {!sporIsComplete && !expanded && (
            <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
              {renderModeEmojiIcon('🏋️', 16, theme.onSurfaceVariant)}
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.body, flex: 1 }}>{tr ? 'Hedef ekle' : 'Add goal'}</Text>
              <ChevronRight size={16} color={theme.onSurfaceVariant} opacity={0.4} />
            </Touchable>
          )}

          {sporIsComplete && !expanded && (
            <View style={{ gap: S.sm }}>
              <View style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: (past ? theme.error : SPOR) + '30', backgroundColor: (past ? theme.error : SPOR) + '08' }}>
                <View style={{ height: 3, backgroundColor: past ? theme.error : SPOR }} />
                <View style={{ padding: S.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
                    {renderModeEmojiIcon(goalEmoji(sporType), 16, SPOR)}
                    <Text style={{ color: theme.onSurface, fontWeight: '600', fontSize: F.body, flex: 1 }} numberOfLines={1}>{stripEmojiPrefix(goal)}</Text>
                    <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpenPreview('spor'); }} activeOpacity={0.7} style={{ backgroundColor: SPOR + (isDark ? '22' : '15'), paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.full }}>
                      <Text style={{ color: SPOR, fontSize: F.caption, fontWeight: '700' }}>{hasPlan ? (tr ? 'İçgörü & Önizle ›' : 'Insight & Preview ›') : (tr ? 'Plan Oluştur ›' : 'Create Plan ›')}</Text>
                    </Touchable>
                    <View style={{ width: 1, height: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', marginHorizontal: S.xs }} />
                    <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} activeOpacity={0.7}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600', opacity: 0.8 }}>{tr ? 'Düzenle' : 'Edit'}</Text>
                    </Touchable>
                  </View>
                  {past ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {renderModeEmojiIcon('📅', 14, theme.error)}
                      <Text style={{ color: theme.error, fontWeight: '500' }}>{tr ? 'Hedef tarihi geçti' : 'Goal date passed'} · {formatPlanDate(effectiveSporDate, tr)}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                      <View style={{ alignItems: 'center', minWidth: 52 }}>
                        <Text style={{ color: SPOR, fontWeight: '600', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{daysLeft}</Text>
                        <Text style={{ color: SPOR, fontSize: 10, fontWeight: '600', opacity: 0.7, letterSpacing: 1 }}>{tr ? 'GÜN' : 'DAYS'}</Text>
                      </View>
                      <View style={{ flex: 1, paddingTop: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {renderModeEmojiIcon('📅', 13, theme.onSurfaceVariant)}
                          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{formatPlanDate(effectiveSporDate, tr)}</Text>
                        </View>
                        {sporType === 'kilo' && kiloGoalKg > 0 ? (
                          <View style={{ marginTop: S.sm, gap: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{tr ? 'Hedefe ilerleme' : 'Goal progress'}</Text><Text style={{ color: SPOR, fontSize: 11, fontWeight: '600' }}>{kiloDoneKg.toFixed(1)}/{kiloGoalKg.toFixed(1)} kg · {kiloPct}%</Text></View>
                            <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: SPOR, width: `${kiloPct}%` as any }} /></View>
                          </View>
                        ) : (sporType === 'maraton' || sporType === 'guc' || sporType === 'genel') ? (
                          <View style={{ marginTop: S.sm, gap: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{tr ? (sporType === 'maraton' ? 'Bu hafta koşu' : 'Bu hafta antrenman') : (sporType === 'maraton' ? 'Runs this week' : 'Workouts this week')}</Text><Text style={{ color: SPOR, fontSize: 11, fontWeight: '600' }}>{sporWeekDays}/{sporTrainTarget} · {sporTrainPct}%</Text></View>
                            <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: SPOR, width: `${sporTrainPct}%` as any }} /></View>
                          </View>
                        ) : progTotal > 0 ? (
                          <View style={{ marginTop: S.sm, gap: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{tr ? 'Bugün' : 'Today'}</Text><Text style={{ color: SPOR, fontSize: 11, fontWeight: '600' }}>{progDone}/{progTotal} · {progPct}%</Text></View>
                            <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: SPOR, width: `${progPct}%` as any }} /></View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Weight log (kilo) */}
              {sporType === 'kilo' && !past && (
                <View style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <View style={{ paddingHorizontal: S.md, paddingTop: S.sm + 2, paddingBottom: S.sm, gap: S.xs }}>
                    {cwNum > 0 && twNum > 0 && (
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.onSurfaceVariant }}>{tr ? 'Başlangıç' : 'Start'}: {cwNum} kg</Text>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: SPOR }}>{latestWeight ? `${latestWeight} kg` : '—'}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '500', color: theme.onSurfaceVariant }}>{tr ? 'Hedef' : 'Goal'}: {twNum} kg</Text>
                        </View>
                        {latestWeight && cwNum !== twNum && (
                          <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: SPOR, width: `${Math.min(100, Math.round(Math.abs(cwNum - latestWeight) / Math.abs(cwNum - twNum) * 100))}%` as any }} /></View>
                        )}
                      </View>
                    )}
                  </View>
                  {weightLog.slice(0, 4).map((entry, idx) => {
                    const prev = weightLog[idx + 1];
                    const diff = prev ? Math.round((entry.weight - prev.weight) * 10) / 10 : null;
                    const diffStr = diff === null ? (tr ? 'başlangıç' : 'start') : diff > 0 ? `+${diff}` : `${diff}`;
                    const diffColor = diff === null ? theme.onSurfaceVariant : (twNum < cwNum ? (diff < 0 ? '#10B981' : '#EF4444') : (diff > 0 ? '#10B981' : '#EF4444'));
                    const dateStr = new Date(entry.date).toLocaleDateString(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' });
                    return (
                      <View key={entry.date} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: 7, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: idx === 0 ? SPOR : theme.onSurfaceVariant, opacity: idx === 0 ? 1 : 0.3, marginRight: S.sm }} />
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: 12, fontWeight: '600', width: 56 }}>{dateStr}</Text>
                        <Text style={{ color: theme.onSurface, fontSize: 13, fontWeight: '600', flex: 1 }}>{entry.weight} kg</Text>
                        <Text style={{ fontSize: 12, fontWeight: '500', color: diffColor }}>{diffStr}</Text>
                      </View>
                    );
                  })}
                  {showWeightEntry ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', gap: S.sm }}>
                      <TextInput value={weightEntryInput} onChangeText={setWeightEntryInput} placeholder={tr ? 'Kg gir (örn: 70.5)' : 'Enter kg (e.g. 70.5)'} placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} keyboardType="decimal-pad" style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '500', height: 36, paddingVertical: 0 }} autoFocus returnKeyType="done" underlineColorAndroid="transparent" onSubmitEditing={() => { const v = parseFloat(weightEntryInput.replace(',', '.')); if (!isNaN(v) && v > 20 && v < 300) saveWeightEntry(v); }} />
                      <Touchable onPress={() => { const v = parseFloat(weightEntryInput.replace(',', '.')); if (!isNaN(v) && v > 20 && v < 300) saveWeightEntry(v); }} style={{ backgroundColor: SPOR, borderRadius: R.full, paddingHorizontal: S.md, height: 32, alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.8}><Text style={{ color: '#fff', fontWeight: '600', fontSize: F.caption }}>{tr ? 'Kaydet' : 'Save'}</Text></Touchable>
                      <Touchable onPress={() => { setShowWeightEntry(false); setWeightEntryInput(''); }} style={{ padding: 4 }} activeOpacity={0.7}><Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{tr ? 'İptal' : 'Cancel'}</Text></Touchable>
                    </View>
                  ) : (
                    <Touchable disabled={!unlocked} onPress={() => { if (!unlocked) return; Haptics.selectionAsync(); setShowWeightEntry(true); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm + 2, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', backgroundColor: unlocked ? SPOR + '08' : 'transparent' }} activeOpacity={0.7}>
                      {renderModeEmojiIcon('⚖️', 14, unlocked ? SPOR : theme.onSurfaceVariant)}
                      <Text style={{ fontSize: F.caption, fontWeight: '600', color: unlocked ? SPOR : theme.onSurfaceVariant }}>{unlocked ? (tr ? 'Bu haftaki tartımı gir' : 'Log this week\'s weight') : (tr ? `Kaydedildi${lastKg ? ` · ${lastKg} kg` : ''} · ${nextLeft} gün sonra tekrar` : `Logged${lastKg ? ` · ${lastKg} kg` : ''} · again in ${nextLeft}d`)}</Text>
                    </Touchable>
                  )}
                </View>
              )}

              <SporSlot slot="spor2" goalKey="spor2Goal" dateKey="spor2Date" otherGoals={[goal, seasonal.spor3Goal || '']} addLabel={tr ? 'İkinci fiziksel hedef ekle' : 'Add second physical goal'} onOpenPreview={onOpenPreview} />
              {spor2Complete && (
                <SporSlot slot="spor3" goalKey="spor3Goal" dateKey="spor3Date" otherGoals={[goal, seasonal.spor2Goal || '']} addLabel={tr ? 'Üçüncü fiziksel hedef ekle' : 'Add third physical goal'} onOpenPreview={onOpenPreview} />
              )}
            </View>
          )}

          {/* ── Expanded setup form (slot 1) ── */}
          {expanded && (
            <View style={{ gap: S.sm }}>
              <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8 }}>{tr ? 'Hedef türünü seç' : 'Select goal type'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
                {goalsSelf.map((g) => {
                  const active = goal === g.label;
                  return (
                    <Touchable key={g.key} onPress={() => {
                      Haptics.selectionAsync();
                      const val = active ? '' : g.label;
                      const newType = val ? detectSporType(val) : null;
                      const typeChanged = newType !== sporType && hasPlan;
                      const apply = () => { setSeasonalPref('sporGoal', val); if (newType === 'kilo') { if (!currentWeight || parseFloat(currentWeight) <= 0) setCurrentWeight('75'); if (!targetWeight || parseFloat(targetWeight) <= 0) setTargetWeight('70'); } };
                      if (typeChanged) {
                        Alert.alert(tr ? 'Hedef Türü Değişiyor' : 'Goal Type Changing', tr ? 'Mevcut plan alışkanlık ve görevleri kaldırılacak. Devam et?' : 'Existing plan habits and tasks will be removed. Continue?', [{ text: tr ? 'İptal' : 'Cancel', style: 'cancel' }, { text: tr ? 'Devam Et' : 'Continue', style: 'destructive', onPress: () => { sporPlanHabitIds.forEach(id => removeHabit(id)); sporPlanTaskIds.forEach(id => retirePlanTask(id, 'spor')); clearPlanIds('spor'); apply(); } }]);
                      } else apply();
                    }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: S.sm + 2, paddingVertical: 8, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? SPOR : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? SPOR + '18' : 'transparent' }} activeOpacity={0.7}>
                      {renderModeEmojiIcon(getEmojiFromLabel(g.label), 14, active ? SPOR : theme.onSurfaceVariant)}
                      <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? SPOR : theme.onSurfaceVariant }}>{stripEmojiPrefix(g.label)}</Text>
                    </Touchable>
                  );
                })}
              </View>

              {sporType === 'kilo' && (
                <View style={{ gap: S.sm }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8 }}>{tr ? 'Beden bilgileri' : 'Body info'}</Text>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: R.md, paddingHorizontal: S.md, height: 44, borderWidth: B.thin, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', gap: S.xs }}>
                      <TextInput value={heightCm} onChangeText={setHeightCm} placeholder={tr ? 'Boy (cm)' : 'Height (cm)'} placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} keyboardType="number-pad" style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '500', paddingVertical: 0 }} returnKeyType="next" underlineColorAndroid="transparent" />
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 12, fontWeight: '600', opacity: 0.6 }}>cm</Text>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: R.md, paddingHorizontal: S.md, height: 44, borderWidth: B.thin, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', gap: S.xs }}>
                      <TextInput value={ageYears} onChangeText={setAgeYears} placeholder={tr ? 'Yaş' : 'Age'} placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} keyboardType="number-pad" style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '500', paddingVertical: 0 }} returnKeyType="done" underlineColorAndroid="transparent" />
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 12, fontWeight: '600', opacity: 0.6 }}>{tr ? 'yaş' : 'yrs'}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    {(['male', 'female'] as const).map((g) => (
                      <Touchable key={g} onPress={() => setGender(gender === g ? '' : g)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, borderRadius: R.md, height: 40, borderWidth: B.medium, backgroundColor: gender === g ? (SPOR + '20') : (isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow), borderColor: gender === g ? SPOR : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') }} activeOpacity={0.75}>
                        {g === 'male' ? <MarsIcon size={16} color={gender === 'male' ? SPOR : theme.onSurfaceVariant} /> : <VenusIcon size={16} color={gender === 'female' ? SPOR : theme.onSurfaceVariant} />}
                        <Text style={{ fontSize: F.caption, fontWeight: '600', color: gender === g ? SPOR : theme.onSurfaceVariant }}>{tr ? (g === 'male' ? 'Erkek' : 'Kadın') : (g === 'male' ? 'Male' : 'Female')}</Text>
                      </Touchable>
                    ))}
                  </View>
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8, marginTop: S.xs }}>{tr ? 'Kilo bilgileri (kaydırarak seçin)' : 'Weight info (scroll to select)'}</Text>
                  <View style={{ flexDirection: 'row', gap: S.sm, justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr ? 'Şu Anki' : 'Current'}</Text>
                      <WeightWheelPicker value={cwNum > 0 ? Math.round(cwNum) : 75} onChange={(val) => setCurrentWeight(val.toString())} theme={theme} isDark={isDark} sporColor={SPOR} />
                    </View>
                    <View style={{ width: 1, height: 80, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', marginTop: 15 }} />
                    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tr ? 'Hedef' : 'Target'}</Text>
                      <WeightWheelPicker value={twNum > 0 ? Math.round(twNum) : 70} onChange={(val) => setTargetWeight(val.toString())} theme={theme} isDark={isDark} sporColor={SPOR} />
                    </View>
                  </View>
                  {cwNum > 0 && !kiloWeightValid && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <XCircle size={14} color="#EF4444" />
                      <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '500', flex: 1 }}>{tr ? 'Kilo değerleri 30–300 kg arasında olmalıdır.' : 'Weight values must be between 30–300 kg.'}</Text>
                    </View>
                  )}
                  {cwNum > 0 && twNum > 0 && kiloWeightValid && !kiloWeightRealistic && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <XCircle size={14} color="#EF4444" />
                      <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '500', flex: 1 }}>{tr ? 'Mevcut ve hedef kilo arasındaki fark 100 kg\'ı geçemez. Lütfen gerçekçi bir hedef girin.' : 'The difference between current and target weight cannot exceed 100 kg. Please set a realistic goal.'}</Text>
                    </View>
                  )}
                  {kiloBmiCurrentUnderweight && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} color="#F59E0B" />
                      <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '500', flex: 1 }}>{tr ? 'Mevcut kilonuz zaten sağlıklı aralığın altında (BMI < 18.5). Bir uzmana danışmanızı öneririz.' : 'Your current weight is already below the healthy range (BMI < 18.5). We recommend consulting a specialist.'}</Text>
                    </View>
                  )}
                  {kiloBmiTargetTooLow && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <XCircle size={14} color="#EF4444" />
                      <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '500', flex: 1 }}>{tr ? `${twNum} kg, ${hnNum} cm boy için sağlıklı minimum kilonun (${minHealthyKg} kg, BMI 18.5) altında. Bu hedefi onaylamıyoruz.` : `${twNum} kg is below the minimum healthy weight (${minHealthyKg} kg, BMI 18.5) for ${hnNum} cm height. We cannot approve this goal.`}</Text>
                    </View>
                  )}
                  {cwNum > 0 && twNum > 0 && cwNum === twNum && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Target size={14} color="#10B981" />
                      <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '500', flex: 1 }}>{tr ? 'Zaten hedef kilondasın! Koruma moduna geç.' : 'Already at your goal weight! Switch to maintenance mode.'}</Text>
                    </View>
                  )}
                  {cwNum > 0 && twNum > 0 && cwNum !== twNum && kiloWeightValid && kiloWeightRealistic && kiloBmiValid && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {twNum > cwNum ? <TrendingUp size={14} color={SPOR} /> : <TrendingDown size={14} color={SPOR} />}
                      <Text style={{ fontSize: 12, color: SPOR, fontWeight: '500', opacity: 0.9 }}>{tr ? `${Math.abs(cwNum - twNum)} kg · haftada ${kiloWeeklyRate} kg ile ~${kiloAutoWeeks} hafta` : `${Math.abs(cwNum - twNum)} kg · at ${kiloWeeklyRate} kg/week ~${kiloAutoWeeks} weeks`}</Text>
                    </View>
                  )}
                  {cwNum > 0 && twNum > 0 && kiloWeightValid && kiloWeightRealistic && kiloBmiValid && Math.abs(cwNum - twNum) > 30 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} color="#EF4444" />
                      <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '500', flex: 1 }}>{tr ? '30 kg üzeri hedefler için bir doktor veya diyetisyen desteği önerilir.' : 'For goals over 30 kg, consulting a doctor or dietitian is recommended.'}</Text>
                    </View>
                  )}
                  {heightM > 0 && !kiloBmiTargetTooLow && twNum > 0 && (<Text style={{ fontSize: 11, color: theme.onSurfaceVariant, opacity: 0.55, lineHeight: 15 }}>{tr ? `${hnNum} cm için sağlıklı aralık: ${minHealthyKg}–${maxHealthyKg} kg` : `Healthy range for ${hnNum} cm: ${minHealthyKg}–${maxHealthyKg} kg`}</Text>)}
                </View>
              )}

              {sporType === 'maraton' && (
                <View style={{ gap: S.xs }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8 }}>{tr ? 'Mevcut haftalık km' : 'Current weekly km'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: R.md, paddingHorizontal: S.md, height: 44, borderWidth: B.thin, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}>
                    <TextInput value={weeklyKm} onChangeText={setWeeklyKm} placeholder={tr ? 'Örn: 15' : 'e.g. 15'} placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.30)'} keyboardType="numeric" style={{ flex: 1, color: theme.onSurface, fontSize: F.body, fontWeight: '500', paddingVertical: 0 }} returnKeyType="done" underlineColorAndroid="transparent" />
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>km/hft</Text>
                  </View>
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8, marginTop: 2 }}>{tr ? 'Hedef mesafe' : 'Target distance'}</Text>
                  <View style={{ flexDirection: 'row', gap: S.xs }}>
                    {(['5K', '10K', 'Yarı', 'Tam'] as const).map(ev => (
                      <Touchable key={ev} onPress={() => { Haptics.selectionAsync(); setTargetEvent(targetEvent === ev ? '' : ev); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: R.md, borderWidth: B.medium, borderColor: targetEvent === ev ? SPOR : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: targetEvent === ev ? SPOR + '18' : 'transparent' }} activeOpacity={0.7}>
                        <Text style={{ fontSize: F.caption, fontWeight: '500', color: targetEvent === ev ? SPOR : theme.onSurfaceVariant }}>{ev}</Text>
                      </Touchable>
                    ))}
                  </View>
                </View>
              )}

              {(sporType === 'guc' || sporType === 'genel' || sporType === 'yaris') && (
                <View style={{ gap: S.xs }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceVariant, opacity: 0.8 }}>{tr ? 'Haftada kaç gün antrenman?' : 'How many days/week?'}</Text>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    {([3, 4, 5] as const).map(d => (
                      <Touchable key={d} onPress={() => { Haptics.selectionAsync(); setTrainingDays(trainingDays === d ? null : d); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.md, borderWidth: B.medium, borderColor: trainingDays === d ? SPOR : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: trainingDays === d ? SPOR + '18' : 'transparent' }} activeOpacity={0.7}>
                        <Text style={{ fontSize: F.body, fontWeight: '600', color: trainingDays === d ? SPOR : theme.onSurface }}>{d}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: trainingDays === d ? SPOR : theme.onSurfaceVariant, opacity: 0.7, marginTop: 1 }}>{tr ? 'gün' : 'days'}</Text>
                      </Touchable>
                    ))}
                  </View>
                </View>
              )}

              {sporType === 'kilo' ? (
                kiloAutoDate && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: R.md, paddingHorizontal: S.md, height: 40, borderWidth: B.thin, backgroundColor: SPOR + '08', borderColor: SPOR + '30' }}>
                    {renderModeEmojiIcon('📅', 14, SPOR)}
                    <Text style={{ color: SPOR, fontSize: F.caption, fontWeight: '500', flex: 1 }}>{tr ? `Tahmini hedef: ${formatPlanDate(kiloAutoDate, tr)}` : `Estimated completion: ${formatPlanDate(kiloAutoDate, tr)}`}</Text>
                  </View>
                )
              ) : (
                <>
                  <Touchable onPress={() => { Haptics.selectionAsync(); setShowPicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                    <Text style={{ color: date ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{date ? formatPlanDate(date, tr) : (tr ? 'Hedef tarihi seç' : 'Select target date')}</Text>
                    <CalendarDays size={16} color={theme.onSurfaceVariant} opacity={0.5} />
                  </Touchable>
                  {showPicker && <SporDatePicker value={sporDateObj} onPick={(iso) => setSeasonalPref('sporDate', iso)} onClose={() => setShowPicker(false)} />}
                </>
              )}

              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <Touchable onPress={() => setExpanded(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.caption }}>{tr ? 'Kapat' : 'Close'}</Text>
                </Touchable>
                {sporIsComplete && (<Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExpanded(false); onOpenPreview('spor'); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: SPOR, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}>{renderModeEmojiIcon(goalEmoji(sporType), 13, '#fff')}<Text style={{ color: '#fff', fontWeight: '600', fontSize: F.caption }}>{tr ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></Touchable>)}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
