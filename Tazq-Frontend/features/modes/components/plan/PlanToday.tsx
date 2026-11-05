import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Angry, Check, CheckCircle2, Circle, Flame, Frown, Laugh, Meh, Play, Smile } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { swallow } from '@/shared/utils/swallow';
import { fmtDateKey, useHabitStore } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { setTaskDoneSynced } from '@/features/tasks/utils/toggleTaskSynced';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';
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
  const planTasks = useMemo(() => tasks.filter(t => (taskIds.includes(t.id) || (t.tags ?? []).includes(slot)) && !t.isArchived), [tasks, taskIds, slot]);
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

export function PlanTasks({ slot, name, items, c, hideStudy }: { slot: string; name: string; items: ReturnType<typeof usePlanItems>; c: PlanCopy; hideStudy?: boolean }) {
  const { theme } = useAppTheme();
  const list = hideStudy ? items.todayTasks.filter(t => !isStudyTask(t)) : items.todayTasks;
  if (hideStudy && list.length === 0) return null;
  const focus = (id: number, title: string) => { useFocusStore.getState().setCurrentTask(title, id); router.push('/focus'); };
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.tasks}</Text>
      {list.length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.tasksEmpty}</Text>}
      {list.map((t, i) => (
        <View key={t.id}>
          {i > 0 && <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />}
          <View style={st.row}>
            <Touchable accessibilityRole="checkbox" accessibilityState={{ checked: !!t.isCompleted }} accessibilityLabel={t.title} onPress={() => { void setTaskDoneSynced(t.id, !t.isCompleted, slot); }} hitSlop={8} style={st.check}>
              {t.isCompleted ? <CheckCircle2 size={ICON.md} color={theme.success} /> : <Circle size={ICON.md} color={theme.onSurfaceMuted} />}
            </Touchable>
            <Text style={{ flex: 1, fontSize: F.body, color: t.isCompleted ? theme.onSurfaceMuted : theme.onSurface, textDecorationLine: t.isCompleted ? 'line-through' : 'none' }}>{withoutGoalName(t.title, name)}</Text>
            {!t.isCompleted && (
              <Touchable accessibilityRole="button" accessibilityLabel={`${c.startFocus}: ${t.title}`} onPress={() => focus(t.id, t.title)} style={st.check}>
                <Play size={ICON.sm} color={theme.onSurfaceVariant} />
              </Touchable>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

export function PlanRoutines({ items, c, accent, lang }: { items: ReturnType<typeof usePlanItems>; c: PlanCopy; accent: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const toggleDate = useHabitStore(s => s.toggleDate);
  if (items.planHabits.length === 0) return null;
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.routines}</Text>
      <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, paddingBottom: S.xs }}>{c.routineHint}</Text>
      {items.planHabits.map(({ h, doneToday, streak }, i) => (
        <View key={h.id}>
          {i > 0 && <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />}
          <Touchable accessibilityRole="checkbox" accessibilityState={{ checked: doneToday }} accessibilityLabel={`${lang === 'tr' ? h.nameTr ?? h.name : h.nameEn ?? h.name}, ${c.streak(streak)}`} onPress={() => toggleDate(h.id, items.today)} style={st.row}>
            <View style={st.check}>{renderModeEmojiIcon(h.emoji ?? '📌', 22, accent)}</View>
            <View style={{ flex: 1, gap: S.xxs }}>
              <Text numberOfLines={1} style={{ fontSize: F.body, color: theme.onSurface }}>{lang === 'tr' ? h.nameTr ?? h.name : h.nameEn ?? h.name}</Text>
              <View style={st.meta}>
                <View style={st.dots}>
                  {items.last7.map(k => <View key={k} style={[st.dot, { backgroundColor: (h.completedDates ?? []).includes(k) ? accent : theme.surfaceContainerHigh }]} />)}
                </View>
                {streak > 0 && <Flame size={ICON.xs} color={theme.warning} />}
                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.streak(streak)}</Text>
              </View>
            </View>
            <MotiView animate={{ scale: doneToday ? 1 : 0.88, backgroundColor: doneToday ? accent : 'transparent', borderColor: doneToday ? accent : theme.outlineVariant }} transition={{ type: 'timing', duration: 160 }} style={st.tick}>
              {doneToday && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
            </MotiView>
          </Touchable>
        </View>
      ))}
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
  check: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'flex-start', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  dots: { flexDirection: 'row', gap: S.xxs, marginRight: S.xs },
  dot: { width: 7, height: 7, borderRadius: R.full },
  tick: { width: 24, height: 24, borderRadius: R.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  faces: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: S.xs },
  face: { flex: 1, alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH },
});
