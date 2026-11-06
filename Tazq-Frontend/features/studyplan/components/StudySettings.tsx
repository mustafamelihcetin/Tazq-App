import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronDown, ChevronRight, Minus, Plus, X } from 'lucide-react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { deviceWeekStart } from '@/shared/components/MonthCalendar';
import { toDateKey } from '@/shared/utils/dateKey';
import { currentTrack, trackChanges, tracksFor, blueprintFor } from '../data/blueprints';
import { useStudyPlanStore } from '../store/useStudyPlanStore';
import { Course, makeId, PlanRecord } from '../utils/planCore';
import type { StartLevel } from '../utils/scheduler';
import type { StudyCopy } from './studyCopy';

/*
  AYARLAR (2026-11-05). Varsayılan sade: hafta içi ve hafta sonu. Vardiyalı çalışan "gün gün ayarla"yı açar. Bilinmeyen sınav ve vize/final
  için dersler burada girilir; her dersin kendi tarihi olur, süre yakın sınava göre bölünür.
*/
const STEP = 15;
const MAX_DAY = 600;
const LEVELS: StartLevel[] = ['yok', 'biraz', 'tekrar'];
const DATE_KEY: Record<string, 'examDate' | 'exam2Date' | 'exam3Date'> = { exam: 'examDate', exam2: 'exam2Date', exam3: 'exam3Date' };
const clampMin = (m: number) => Math.max(0, Math.min(MAX_DAY, m));

export function Stepper({ label, value, c, onChange }: { label: string; value: number; c: StudyCopy; onChange: (m: number) => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={st.row}>
      <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{label}</Text>
      <Touchable accessibilityRole="button" accessibilityLabel={`${label}: ${c.decrease}`} disabled={value <= 0} onPress={() => onChange(clampMin(value - STEP))} style={[st.step, { backgroundColor: theme.surfaceContainerHigh, opacity: value <= 0 ? 0.4 : 1 }]}>
        <Minus size={ICON.xs} color={theme.onSurface} />
      </Touchable>
      <Text accessibilityLiveRegion="polite" style={{ width: 84, textAlign: 'center', fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface, fontVariant: ['tabular-nums'] }}>{c.minutes(value)}</Text>
      <Touchable accessibilityRole="button" accessibilityLabel={`${label}: ${c.increase}`} disabled={value >= MAX_DAY} onPress={() => onChange(clampMin(value + STEP))} style={[st.step, { backgroundColor: theme.surfaceContainerHigh }]}>
        <Plus size={ICON.xs} color={theme.onSurface} />
      </Touchable>
    </View>
  );
}

function CourseEditor({ c, today, initial, onSave, onCancel }: { c: StudyCopy; today: string; initial?: Course; onSave: (x: Course) => void; onCancel: () => void }) {
  const { theme } = useAppTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [topics, setTopics] = useState((initial?.topics ?? []).map(t => t.name).join('\n'));
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState(false);
  const inputStyle = { backgroundColor: theme.surfaceContainerHigh, color: theme.onSurface, borderRadius: R.md, paddingHorizontal: S.smd, fontSize: F.body };
  const pick = (e: DateTimePickerEvent, d?: Date) => { if (Platform.OS === 'android') setPicker(false); if (e.type === 'set' && d) setDate(toDateKey(d)); };
  const save = () => {
    const lines = [...new Set(topics.split('\n').map(l => l.trim()).filter(Boolean))].slice(0, 60);
    if (!name.trim() || !date || date <= today || !lines.length) { setError(true); return; }
    const old = new Map((initial?.topics ?? []).map(t => [t.name, t.id]));
    onSave({ id: initial?.id ?? makeId(`${name}${Date.now()}`), name: name.trim(), date, topics: lines.map((l, i) => ({ id: old.get(l) ?? `t_${makeId(`${name}/${l}/${i}`)}`, name: l })) });
  };
  return (
    <View style={{ gap: S.sm, paddingVertical: S.sm }}>
      <TextInput accessibilityLabel={c.courseName} placeholder={c.courseName} placeholderTextColor={theme.onSurfaceMuted} value={name} maxLength={60} onChangeText={setName} style={[inputStyle, { height: MIN_TOUCH }]} />
      <Touchable accessibilityRole="button" onPress={() => setPicker(true)} style={[st.dateBtn, { backgroundColor: theme.surfaceContainerHigh }]}>
        <Text style={{ fontSize: F.body, color: date ? theme.onSurface : theme.onSurfaceMuted }}>{date ? new Date(`${date}T12:00:00`).toLocaleDateString(c.locale, { day: 'numeric', month: 'long', year: 'numeric' }) : c.pickDate}</Text>
      </Touchable>
      {picker && <DateTimePicker value={date ? new Date(`${date}T12:00:00`) : new Date(`${today}T12:00:00`)} minimumDate={new Date(`${today}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={pick} />}
      <TextInput accessibilityLabel={c.courseTopics} placeholder={c.courseTopics} placeholderTextColor={theme.onSurfaceMuted} value={topics} multiline onChangeText={setTopics} style={[inputStyle, { minHeight: 120, paddingVertical: S.sm, textAlignVertical: 'top' }]} />
      {error && <Text accessibilityLiveRegion="polite" style={{ fontSize: F.footnote, color: theme.error }}>{c.courseInvalid}</Text>}
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Touchable accessibilityRole="button" onPress={onCancel} style={[st.btn, { flex: 1, backgroundColor: theme.surfaceContainerHigh }]}>
          <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{c.cancel}</Text>
        </Touchable>
        <Touchable accessibilityRole="button" onPress={save} style={[st.btn, { flex: 2, backgroundColor: theme.primaryFill }]}>
          <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onPrimaryFill }}>{c.saveCourse}</Text>
        </Touchable>
      </View>
    </View>
  );
}

export function StudySettings({ plan, c, lang, today, onChanged }: { plan: PlanRecord; c: StudyCopy; lang: 'tr' | 'en'; today: string; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const store = useStudyPlanStore();
  const [eachDay, setEachDay] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const week = store.week ?? [90, 90, 90, 90, 90, 90, 90];
  const bp = blueprintFor(plan.name);
  const courses = plan.courses ?? [];
  const weekStart = useMemo(deviceWeekStart, []);
  const dayOrder = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
  const dayName = (js: number) => new Date(2024, 0, 7 + js).toLocaleDateString(c.locale, { weekday: 'long' });
  const isUniform = [1, 2, 3, 4, 5].every(d => week[d] === week[1]) && week[0] === week[6];
  const showEach = eachDay || !isUniform;

  const setWeek = (next: number[]) => { store.setWeek(next, today); onChanged(); };
  const saveCourses = (next: Course[]) => {
    store.setCourses(plan.key, next, today);
    // Sınav slotu son dersten önce kapanmasın: uygulamanın kapanış tarihi son ders olur.
    const last = next.map(k => k.date).sort().pop();
    const key = plan.slot ? DATE_KEY[plan.slot] : null;
    if (last && key && last > plan.examDate) usePrefsStore.getState().setSeasonalPref(key, last);
    setEditing(null);
    onChanged();
  };
  const weekHours = Math.round(week.reduce((a, b) => a + b, 0) / 60);

  return (
    <View style={{ gap: S.md }}>
      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={st2(theme).title}>{c.weekTitle}</Text>
        <Text style={st2(theme).hint}>{c.weekHint}</Text>
        {!showEach && (
          <>
            <Stepper label={c.weekdays} value={week[1]} c={c} onChange={m => setWeek([week[0], m, m, m, m, m, week[6]])} />
            <Stepper label={c.weekend} value={week[0]} c={c} onChange={m => setWeek([m, week[1], week[2], week[3], week[4], week[5], m])} />
          </>
        )}
        {showEach && dayOrder.map(js => (
          <Stepper key={js} label={dayName(js)} value={week[js]} c={c} onChange={m => setWeek(week.map((v, i) => (i === js ? m : v)))} />
        ))}
        {isUniform && (
          <Touchable accessibilityRole="button" accessibilityState={{ expanded: eachDay }} onPress={() => setEachDay(v => !v)} style={st.link}>
            {eachDay ? <ChevronDown size={ICON.sm} color={theme.primary} /> : <ChevronRight size={ICON.sm} color={theme.primary} />}
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.eachDay}</Text>
          </Touchable>
        )}
        <Text style={st2(theme).hint}>{c.weekTotal(weekHours)}</Text>
      </View>

      {!bp && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text accessibilityRole="header" style={st2(theme).title}>{c.coursesTitle}</Text>
          <Text style={st2(theme).hint}>{c.coursesHint}</Text>
          {courses.map((k, i) => (
            <View key={k.id}>
              {i > 0 && <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />}
              {editing === k.id ? (
                <CourseEditor c={c} today={today} initial={k} onCancel={() => setEditing(null)} onSave={x => saveCourses(courses.map(o => (o.id === k.id ? x : o)))} />
              ) : (
                <View style={st.row}>
                  <Touchable accessibilityRole="button" onPress={() => setEditing(k.id)} style={{ flex: 1, minHeight: MIN_TOUCH, justifyContent: 'center' }}>
                    <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{k.name}</Text>
                    <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{new Date(`${k.date}T12:00:00`).toLocaleDateString(c.locale, { day: 'numeric', month: 'long' })} · {c.topicCount(k.topics.length)}</Text>
                  </Touchable>
                  <Touchable accessibilityRole="button" accessibilityLabel={`${c.removeCourse}: ${k.name}`} onPress={() => Alert.alert(c.removeCourse, k.name, [{ text: c.cancel, style: 'cancel' }, { text: c.remove, style: 'destructive', onPress: () => saveCourses(courses.filter(o => o.id !== k.id)) }])} style={st.step}>
                    <X size={ICON.xs} color={theme.onSurfaceMuted} />
                  </Touchable>
                </View>
              )}
            </View>
          ))}
          {editing === 'new'
            ? <CourseEditor c={c} today={today} initial={courses.length === 0 ? { id: makeId(`${plan.name}${Date.now()}`), name: plan.name, date: plan.examDate, topics: [] } : undefined} onCancel={() => setEditing(null)} onSave={x => saveCourses([...courses, x])} />
            : (
              <Touchable accessibilityRole="button" onPress={() => setEditing('new')} style={st.link}>
                <Plus size={ICON.sm} color={theme.primary} />
                <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.addCourse}</Text>
              </Touchable>
            )}
        </View>
      )}

      {bp && tracksFor(bp.examId).length > 0 && (() => {
        const ids = bp.subjects.map(x => x.id);
        const on = currentTrack(tracksFor(bp.examId), ids, plan.excluded);
        return (
          <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
            <Text accessibilityRole="header" style={st2(theme).title}>{c.trackTitle}</Text>
            <Text style={st2(theme).hint}>{c.trackHint}</Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
              {tracksFor(bp.examId).map(t => (
                <Touchable key={t.id} accessibilityRole="radio" accessibilityState={{ selected: on === t.id }} onPress={() => { trackChanges(t, ids, plan.excluded).forEach(x => store.setExcluded(plan.key, x.id, x.excluded, today)); onChanged(); }}
                  style={{ minHeight: MIN_TOUCH, paddingHorizontal: S.md, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: on === t.id ? theme.primaryFill : theme.surfaceContainerHigh }}>
                  <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: on === t.id ? theme.onPrimaryFill : theme.onSurface }}>{t[lang]}</Text>
                </Touchable>
              ))}
            </View>
          </View>
        );
      })()}

      {bp && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text accessibilityRole="header" style={st2(theme).title}>{c.levelTitle}</Text>
          <Text style={st2(theme).hint}>{c.levelHint}</Text>
          {bp.subjects.filter(s => !plan.excluded.includes(s.id)).map(s => (
            <View key={s.id} style={{ gap: S.xs, paddingVertical: S.xs }}>
              <Text style={{ fontSize: F.body, color: theme.onSurface }}>{s[lang]}</Text>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {LEVELS.map(l => {
                  const on = (plan.levels[s.id] ?? 'yok') === l;
                  return (
                    <Touchable key={l} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${s[lang]}: ${c.levels[l]}`} onPress={() => { store.setLevel(plan.key, s.id, l, today); onChanged(); }} style={[st.chip, { backgroundColor: on ? theme.primaryFill : theme.surfaceContainerHigh }]}>
                      <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: on ? theme.onPrimaryFill : theme.onSurface }}>{c.levels[l]}</Text>
                    </Touchable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={st2(theme).title}>{c.closedTitle}</Text>
        <Text style={st2(theme).hint}>{c.closedHint}</Text>
        {store.closed.filter(k => k >= today).length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.closedEmpty}</Text>}
        {store.closed.filter(k => k >= today).sort().map(k => (
          <View key={k} style={st.row}>
            <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{new Date(`${k}T12:00:00`).toLocaleDateString(c.locale, { day: 'numeric', month: 'long', weekday: 'long' })}</Text>
            <Touchable accessibilityRole="button" accessibilityLabel={c.openDay} onPress={() => { store.setClosed(store.closed.filter(x => x !== k), today); onChanged(); }} style={st.step}>
              <X size={ICON.xs} color={theme.onSurfaceMuted} />
            </Touchable>
          </View>
        ))}
      </View>

      <Touchable accessibilityRole="button" onPress={() => Alert.alert(c.resetTitle, c.resetBody, [{ text: c.cancel, style: 'cancel' }, { text: c.resetConfirm, style: 'destructive', onPress: () => { store.resetPlan(plan.key, today); onChanged(); } }])} style={{ minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.error }}>{c.resetTitle}</Text>
      </Touchable>
    </View>
  );
}

const st2 = (theme: { onSurface: string; onSurfaceVariant: string }) => ({
  title: { fontSize: F.body, fontWeight: W.bold, color: theme.onSurface },
  hint: { fontSize: F.footnote, color: theme.onSurfaceVariant },
});
const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH },
  step: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH },
  chip: { flex: 1, minHeight: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  dateBtn: { minHeight: MIN_TOUCH, borderRadius: R.md, paddingHorizontal: S.smd, justifyContent: 'center' },
  btn: { minHeight: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
});
