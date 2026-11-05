import { taskNature } from '@/features/focus/focusWorthy';
import { waterGoalOfTask } from '@/features/modes/utils/waterGoal';
import { WaterGlass } from './WaterGlass';
import { PostponePicker } from './PostponePicker';
import { PLAN_COPY } from './planCopy';
import { useToastStore } from '@/shared/store/useToastStore';
import { belongsToSlot, foreignTaskIds } from '@/features/modes/utils/goalRows';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { windowOf, windowRank } from '@/features/modes/utils/ramadanBrain';
import { ramadanFrameNow } from '@/features/modes/utils/ramadanPreview';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Angry, CalendarClock, Check, CheckCircle2, Circle, Flame, Frown, Laugh, Meh, MoreHorizontal, Play, Plus, Shuffle, Smile } from 'lucide-react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { modeRoomLeft } from '@/features/habits/utils/habitLimit';
import { ROUTINE_SUGGESTIONS } from '@/features/modes/data/planLibrary';
import { addOwnTask, addRoutine, bringPostponedToday, hidePlanTask, postponePlanTask, removeRoutine, skipPlanTaskToday, swapPlanTask, undoPostpone } from '@/features/modes/utils/planManage';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { swallow } from '@/shared/utils/swallow';
import { fmtDateKey, useHabitStore } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { setTaskDoneSynced } from '@/features/tasks/utils/toggleTaskSynced';
import { dayRatingKey } from '@/features/modes/utils/dayRating';
import { calendarDayOf } from '@/shared/utils/dateKey';
import { isStudyTask } from '@/features/studyplan/utils/planBridge';
import { withoutGoalName } from '@/features/modes/utils/planSlots';
import type { PlanCopy } from './planCopy';

/*
  BUGÜN: İŞLER · RUTİNLER · DEĞERLENDİRME (2026-11-05). Eskiden "İçgörü & Önizle" penceresindeydi: yüzdeler, öncelik etiketleri, uzun
  yorum kutusu. Şimdi tek soru: bugün ne yapacağım? Görev bitince Bugün listesiyle aynı yoldan işaretlenir.
*/
const FACES = [Angry, Frown, Meh, Smile, Laugh];
const COLORLESS_DAYS = 7;

export function usePlanItems(slot: string, habitIds: string[], taskIds: number[]) {
  const habits = useHabitStore(s => s.habits);
  const getStreak = useHabitStore(s => s.getStreak);
  const tasks = useTaskStore(s => s.tasks);
  const today = fmtDateKey();
  const last7 = useMemo(() => Array.from({ length: COLORLESS_DAYS }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (COLORLESS_DAYS - 1 - i)); return fmtDateKey(d); }), [today]); // eslint-disable-line react-hooks/exhaustive-deps
  const planHabits = useMemo(() => habits.filter(h => habitIds.includes(h.id) && !h.pausedAt).map(h => ({ h, doneToday: (h.completedDates ?? []).includes(today), streak: getStreak(h) })), [habits, habitIds, today, getStreak]);
  const prefsAll = usePrefsStore() as unknown as Record<string, unknown>;
  const foreign = useMemo(() => foreignTaskIds(slot, prefsAll), [slot, prefsAll]);
  const planTasks = useMemo(() => tasks.filter(t => belongsToSlot(t, slot, taskIds, foreign) && !t.isArchived), [tasks, taskIds, slot, foreign]);
  // Bugün: bugünün işleri + bitmemiş gecikenler + tarihsizler. Geleceğin işi burada kalabalık yapmaz.
  const todayTasks = useMemo(() => planTasks.filter(t => {
    const due = calendarDayOf(t.dueDate);
    if (t.isCompleted) return due === today;
    return !due || due <= today;
  }), [planTasks, today]);
  const done = todayTasks.filter(t => t.isCompleted).length + planHabits.filter(x => x.doneToday).length;
  const total = todayTasks.length + planHabits.length;
  return { today, last7, planHabits, planTasks, todayTasks, done, total };
}

export function PlanTasks({ slot, name, items, c, hideStudy, onChanged, emptyLine, planType, goalDate }: { emptyLine?: string; planType?: string; goalDate?: string | null;  slot: string; name: string; items: ReturnType<typeof usePlanItems>; c: PlanCopy; hideStudy?: boolean; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState<number | null>(null);
  const [postponingId, setPostponingId] = useState<number | null>(null);
  const lang = c === PLAN_COPY.en ? 'en' : 'tr';
  const [adding, setAdding] = useState(false);
  const movedAway = items.planTasks.filter(t => !t.isCompleted && (t.tags ?? []).includes('postponed') && (calendarDayOf(t.dueDate) ?? '') > items.today).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const dayLabel = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(c === PLAN_COPY.en ? 'en-US' : 'tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  const postpone = (id: number, date: string) => {
    setPostponingId(null);
    setOpen(null);
    const before = postponePlanTask(id, date);
    useToastStore.getState().show(c.postpone.done(dayLabel(date)), 'info', before ? { label: c.postpone.undo, onAction: () => undoPostpone(id, before) } : undefined);
  };
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  // Sıra sabit: depo biteni sona atar, sonraki dokunuş yanlış göreve geliyordu (cihazda görüldü).
  const fasting = ramadanFrameNow().fasting;
  const trOf = (t: { title: string; description?: string | null }) => { try { return JSON.parse(t.description ?? '{}').tr ?? t.title; } catch { return t.title; } };
  const windowFor = (t: { title: string; description?: string | null }) => windowOf(planType ?? 'exam', trOf(t));
  // Ramazan düzeninde liste günün akışına göre; yine sabit: biten yer değiştirmez.
  const list = [...(hideStudy ? items.todayTasks.filter(t => !isStudyTask(t)) : items.todayTasks)].sort((a, b) => (fasting ? windowRank(windowFor(a)) - windowRank(windowFor(b)) : 0) || a.id - b.id);
  const focus = (id: number, title: string) => { useFocusStore.getState().setCurrentTask(title, id); router.push('/focus'); };
  const run = async (fn: () => Promise<boolean>) => { const ok = await fn(); setOpen(null); setNote(ok ? '' : c.noMore); };
  const save = async () => { const v = text; setText(''); setAdding(false); await addOwnTask(slot, v); };
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <View style={st.titleRow}>
        <Text accessibilityRole="header" style={[st.title, { flex: 1, color: theme.onSurface }]}>{hideStudy ? c.extraTasks : c.tasks}</Text>
        {list.length > 0 && <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: theme.onSurfaceMuted }}>{list.filter(t => t.isCompleted).length}/{list.length}</Text>}
      </View>
      {list.length === 0 && !hideStudy && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{emptyLine || c.tasksEmpty}</Text>}
      {list.map((t, i) => {
        const generated = (t.tags ?? []).includes('daily');
        const expanded = open === t.id;
        const nature = isStudyTask(t) ? 'deep' : taskNature(t);
        const water = t.isCompleted ? null : waterGoalOfTask(t);
        return (
          <View key={t.id}>
            {i > 0 && <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />}
            <View style={st.row}>
              <Touchable accessibilityRole="checkbox" accessibilityState={{ checked: !!t.isCompleted }} accessibilityLabel={t.title} onPress={() => { void setTaskDoneSynced(t.id, !t.isCompleted, slot); }} hitSlop={8} style={st.check}>
                {t.isCompleted ? <MotiView from={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 11, stiffness: 240 }}><CheckCircle2 size={ICON.md} color={theme.success} /></MotiView> : <Circle size={ICON.md} color={theme.onSurfaceMuted} />}
              </Touchable>
              <Touchable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : t.id)} style={{ flex: 1, minHeight: MIN_TOUCH, justifyContent: 'center' }}>
                <Text style={{ fontSize: F.body, color: t.isCompleted ? theme.onSurfaceMuted : theme.onSurface, textDecorationLine: t.isCompleted ? 'line-through' : 'none' }}>{withoutGoalName(t.title, name)}</Text>
                {fasting && !t.isCompleted && <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: theme.primary }}>{c.ramadan.windows[windowFor(t)]}</Text>}
                {nature === 'allDay' && !t.isCompleted && !water && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.route.allDay}</Text>}
              </Touchable>
              {!t.isCompleted && (
                <Touchable accessibilityRole="button" accessibilityLabel={`${c.taskMore}: ${t.title}`} accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : t.id)} style={st.iconBtn}>
                  <MoreHorizontal size={ICON.sm} color={theme.onSurfaceMuted} />
                </Touchable>
              )}
            </View>
            {water && (
              <View style={st.picker}>
                <WaterGlass goal={water} lang={lang} onFull={() => { void setTaskDoneSynced(t.id, true, slot); }} />
              </View>
            )}
            {postponingId === t.id && !t.isCompleted && (
              <View style={st.picker}>
                <PostponePicker today={items.today} goalDate={goalDate ?? null} lang={lang} onPick={d => postpone(t.id, d)} onCancel={() => setPostponingId(null)} />
              </View>
            )}
            {expanded && postponingId !== t.id && !t.isCompleted && (
              <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 180 }} style={st.actions}>
                {nature === 'deep' && (
                  <Touchable accessibilityRole="button" onPress={() => focus(t.id, t.title)} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                    <Play size={ICON.xs} color={theme.onSurface} />
                    <Text style={[st.chipText, { color: theme.onSurface }]}>{c.startFocus}</Text>
                  </Touchable>
                )}
                {generated && (
                  <Touchable accessibilityRole="button" onPress={() => { void run(() => swapPlanTask(slot, t.id)); }} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                    <Shuffle size={ICON.xs} color={theme.onSurface} />
                    <Text style={[st.chipText, { color: theme.onSurface }]}>{c.swap}</Text>
                  </Touchable>
                )}
                {nature !== 'allDay' && (
                  <Touchable accessibilityRole="button" onPress={() => setPostponingId(t.id)} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                    <CalendarClock size={ICON.xs} color={theme.onSurface} />
                    <Text style={[st.chipText, { color: theme.onSurface }]}>{c.postpone.action}</Text>
                  </Touchable>
                )}
                <Touchable accessibilityRole="button" onPress={() => { setOpen(null); skipPlanTaskToday(slot, t.id); }} style={st.plain}>
                  <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.notToday}</Text>
                </Touchable>
                {generated && (
                  <Touchable accessibilityRole="button" onPress={() => { void run(() => hidePlanTask(slot, t.id)); }} style={st.plain}>
                    <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.notForMe}</Text>
                  </Touchable>
                )}
              </MotiView>
            )}
          </View>
        );
      })}
      {movedAway.length > 0 && (
        <View style={st.moved}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{c.postpone.listTitle}</Text>
          {movedAway.map(t => (
            <View key={t.id} style={st.movedRow}>
              <View style={{ flex: 1, gap: S.xxs }}>
                <Text numberOfLines={2} style={{ fontSize: F.footnote, color: theme.onSurface }}>{withoutGoalName(t.title, name)}</Text>
                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{dayLabel(calendarDayOf(t.dueDate) ?? items.today)}</Text>
              </View>
              <Touchable accessibilityRole="button" onPress={() => bringPostponedToday(t.id)} style={st.plain}>
                <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.postpone.bringBack}</Text>
              </Touchable>
            </View>
          ))}
        </View>
      )}
      {!!note && <Text accessibilityLiveRegion="polite" style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{note}</Text>}
      {adding ? (
        <View style={st.addRow}>
          <TextInput autoFocus value={text} onChangeText={setText} maxLength={150} placeholder={c.addPlaceholder} placeholderTextColor={theme.onSurfaceMuted} returnKeyType="done" onSubmitEditing={() => { void save(); }} accessibilityLabel={c.addPlaceholder}
            style={{ flex: 1, minHeight: MIN_TOUCH, borderRadius: R.md, paddingHorizontal: S.smd, fontSize: F.body, color: theme.onSurface, backgroundColor: theme.surfaceContainerHigh }} />
          <Touchable accessibilityRole="button" accessibilityLabel={c.addTask} disabled={!text.trim()} onPress={() => { void save(); }} style={[st.iconBtn, { backgroundColor: text.trim() ? theme.primary : theme.surfaceContainerHigh }]}>
            <Check size={ICON.sm} color={text.trim() ? theme.onPrimary : theme.onSurfaceMuted} />
          </Touchable>
        </View>
      ) : (
        <Touchable accessibilityRole="button" onPress={() => setAdding(true)} style={st.addLink}>
          <Plus size={ICON.sm} color={theme.primary} />
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.addTask}</Text>
        </Touchable>
      )}
    </View>
  );
}

export function PlanRoutines({ slot, type, items, c, accent, lang }: { slot: string; type: string; items: ReturnType<typeof usePlanItems>; c: PlanCopy; accent: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const toggleDate = useHabitStore(s => s.toggleDate);
  const pause = useHabitStore(s => s.pauseHabit);
  const allHabits = useHabitStore(s => s.habits);
  const [open, setOpen] = useState<string | null>(null);
  const room = modeRoomLeft(allHabits, slot);
  const names = new Set(items.planHabits.flatMap(x => [x.h.name, x.h.nameTr, x.h.nameEn]));
  const ideas = (ROUTINE_SUGGESTIONS[type] ?? []).filter(s => !names.has(s.tr) && !names.has(s.en));
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.routines}</Text>
      {items.planHabits.length > 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, paddingBottom: S.xs }}>{c.routineHint}</Text>}
      {items.planHabits.map(({ h, doneToday, streak }, i) => {
        const label = lang === 'tr' ? h.nameTr ?? h.name : h.nameEn ?? h.name;
        const expanded = open === h.id;
        return (
          <View key={h.id}>
            {i > 0 && <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />}
            <View style={st.row}>
              <Touchable accessibilityRole="checkbox" accessibilityState={{ checked: doneToday }} accessibilityLabel={`${label}, ${c.streak(streak)}`} onPress={() => toggleDate(h.id, items.today)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: MIN_TOUCH }}>
                <MotiView animate={{ scale: doneToday ? 1 : 0.88, backgroundColor: doneToday ? accent : 'transparent', borderColor: doneToday ? accent : theme.outlineVariant }} transition={{ type: 'timing', duration: 160 }} style={st.tick}>
                  {doneToday && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
                </MotiView>
                <View style={{ flex: 1, gap: S.xxs }}>
                  <Text numberOfLines={2} style={{ fontSize: F.body, color: theme.onSurface }}>{label}</Text>
                  <View style={st.meta}>
                    <View style={st.dots}>
                      {items.last7.map(k => <View key={k} style={[st.dot, { backgroundColor: (h.completedDates ?? []).includes(k) ? accent : theme.surfaceContainerHigh }]} />)}
                    </View>
                    {streak > 0 && <Flame size={ICON.xs} color={theme.warning} />}
                    {streak > 0 && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.streak(streak)}</Text>}
                  </View>
                </View>
              </Touchable>
              <Touchable accessibilityRole="button" accessibilityLabel={`${c.routineMore}: ${label}`} accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : h.id)} style={st.iconBtn}>
                <MoreHorizontal size={ICON.sm} color={theme.onSurfaceVariant} />
              </Touchable>
            </View>
            {expanded && (
              <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 180 }} style={st.actions}>
                <Touchable accessibilityRole="button" onPress={() => { pause(h.id); setOpen(null); }} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                  <Text style={[st.chipText, { color: theme.onSurface }]}>{c.routinePause}</Text>
                </Touchable>
                <Touchable accessibilityRole="button" onPress={() => Alert.alert(c.routineRemove, label, [{ text: c.cancel, style: 'cancel' }, { text: c.routineRemove, style: 'destructive', onPress: () => { removeRoutine(slot, h.id); setOpen(null); } }])} style={st.plain}>
                  <Text style={{ fontSize: F.footnote, color: theme.error }}>{c.routineRemove}</Text>
                </Touchable>
              </MotiView>
            )}
          </View>
        );
      })}
      <Text style={{ fontSize: F.footnote, fontWeight: room > 0 ? W.semibold : W.regular, color: room > 0 ? theme.onSurfaceVariant : theme.onSurfaceMuted, paddingTop: S.sm }}>{room > 0 ? c.routineAdd : c.routineFull}</Text>
      {room > 0 && (
        <View style={st.actionsFlat}>
          {ideas.map(s => (
            <Touchable key={s.tr} accessibilityRole="button" onPress={() => addRoutine(slot, s)} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
              <Plus size={ICON.xs} color={theme.onSurface} />
              <Text style={[st.chipText, { color: theme.onSurface }]}>{s[lang]}</Text>
            </Touchable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Tek dokunuş. Sonuç momentumda kullanılır (bkz. dayRatingKey). */
export function PlanRating({ slot, c, accent }: { slot: string; c: PlanCopy; accent: string }) {
  const { theme } = useAppTheme();
  const key = dayRatingKey(slot, fmtDateKey());
  const [rating, setRating] = useState<number | null>(null);
  useEffect(() => { AsyncStorage.getItem(key).then(v => setRating(v ? parseInt(v, 10) : null)).catch(e => swallow('plan.readRating', e)); }, [key]);
  const save = (score: number) => { setRating(score); AsyncStorage.setItem(key, String(score)).catch(e => swallow('plan.saveRating', e)); };
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.rate}</Text>
      <View style={st.faces}>
        {FACES.map((Face, i) => {
          const on = rating === i + 1;
          return (
            <Touchable key={i} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={c.rates[i]} onPress={() => save(i + 1)} style={st.face}>
              <MotiView animate={{ scale: on ? 1.15 : 1 }} transition={{ type: 'spring', damping: 12, stiffness: 240 }}>
                <Face size={ICON.lg} color={on ? accent : theme.onSurfaceMuted} />
              </MotiView>
              <Text style={{ fontSize: F.caption, color: on ? theme.onSurface : theme.onSurfaceMuted, fontWeight: on ? W.semibold : W.regular }}>{c.rates[i]}</Text>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.xxs },
  title: { fontSize: F.subhead, fontWeight: W.bold, paddingBottom: S.xs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH + S.xs, gap: S.xs },
  check: { width: ICON.md + S.sm, height: MIN_TOUCH, alignItems: 'flex-start', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  dots: { flexDirection: 'row', gap: S.xxs, marginRight: S.xs },
  dot: { width: 7, height: 7, borderRadius: R.full },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: S.xs, paddingLeft: ICON.md + S.sm + S.xs, paddingBottom: S.sm },
  actionsFlat: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, paddingTop: S.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: 36, paddingHorizontal: S.smd, borderRadius: R.full },
  chipText: { fontSize: F.footnote, fontWeight: W.semibold },
  plain: { minHeight: 36, paddingHorizontal: S.xs, justifyContent: 'center' },
  picker: { paddingLeft: ICON.md + S.sm + S.xs, paddingBottom: S.sm },
  moved: { gap: S.xs, paddingTop: S.sm },
  movedRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingTop: S.sm },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 24, height: 24, borderRadius: R.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  faces: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: S.xs },
  face: { flex: 1, alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH },
});
