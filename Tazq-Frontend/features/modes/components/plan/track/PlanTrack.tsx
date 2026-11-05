import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { BlurMask, Canvas, Circle, DashPathEffect, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Moon } from 'lucide-react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { DailyStepsRow } from '@/features/modes/components/DailyStepsRow';
import { detectSporTypeLocal, daysUntil } from '@/features/modes/utils/planAdaptations';
import { activeKeys, dayStreak, kiloPace, ramadanCells, weekGrid, weeksOnTarget } from '@/features/modes/utils/planTrack';
import { ramadanStatusNow } from '@/features/modes/utils/ramadanPreview';
import type { ActivePlan } from '@/features/modes/utils/planSlots';
import { toDateKey } from '@/shared/utils/dateKey';
import { haptic } from '@/shared/utils/haptics';
import type { usePlanItems } from '../PlanToday';
import { QuitTrack } from './QuitTrack';
import { SavingsTrack } from './SavingsTrack';
import { TRACK_COPY } from './trackCopy';

/*
  TAKİP SEKMESİ (2026-11-05, kullanıcı: "aynı eski UI'ı koymuşsun, kolaya kaçma; hepsini kendi mantığına göre"). Hedef kartını gömmek yok: her plan ne ölçüyorsa onu çizer.
  Hareket bilgi taşır ve durur: çizgi çizilir, sütun yükselir, hücre dolar; döngü yok.
*/
type Items = ReturnType<typeof usePlanItems>;
const WEEKS = 8;
const CHART_H = 150;
const PAD = 16;
const BAR_H = 96;

export function PlanTrack({ plan, items, accent, lang }: { plan: ActivePlan; items: Items; accent: string; lang: 'tr' | 'en' }) {
  const active = useMemo(() => activeKeys(
    items.planHabits.flatMap(x => x.h.completedDates ?? []),
    items.planTasks.filter(t => t.isCompleted).map(t => t.completedAt),
  ), [items.planHabits, items.planTasks]);
  if (plan.type === 'tasarruf') return <SavingsTrack plan={plan} accent={accent} lang={lang} />;
  if (plan.type === 'birakma') return <QuitTrack accent={accent} lang={lang} />;
  if (plan.type === 'ramazan') return <RamadanTrack active={active} accent={accent} lang={lang} />;
  if (plan.type === 'spor') {
    const kind = detectSporTypeLocal(plan.name);
    return kind === 'kilo' ? <KiloTrack accent={accent} lang={lang} /> : <TrainTrack run={kind === 'maraton'} active={active} accent={accent} lang={lang} />;
  }
  return <WorkTrack plan={plan} active={active} accent={accent} lang={lang} />;
}

// ── Kilo: gerçek çizgi ───────────────────────────────────────────
function KiloTrack({ accent, lang }: { accent: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const c = TRACK_COPY[lang].kilo;
  const locale = TRACK_COPY[lang].locale;
  const log = useSporStore(s => s.weightLog);
  const target = parseFloat(useSporStore(s => s.targetWeight).replace(',', '.')) || 0;
  const removeWeightEntry = useSporStore(s => s.removeWeightEntry);
  const today = toDateKey(new Date());
  const pace = useMemo(() => kiloPace(log, target, today), [log, target, today]);
  const date = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const desc = [...pace.points].reverse();
  const ask = (k: string) => Alert.alert(c.removeTitle, date(k), [
    { text: c.cancel, style: 'cancel' },
    { text: c.removeGo, style: 'destructive', onPress: () => { removeWeightEntry(k); haptic.destructive(); } },
  ]);
  return (
    <View style={{ gap: S.md }}>
      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.chartTitle}</Text>
        {pace.points.length >= 2
          ? <WeightChart points={pace.points.map(p => p.weight)} target={target} accent={accent} track={theme.outlineVariant} surface={theme.surfaceCard} label={c.target(target)} labelColor={theme.onSurfaceMuted} />
          : <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.chartWait}</Text>}
        {pace.perWeek != null
          ? (
            <View style={{ gap: S.xxs }}>
              <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: pace.towardTarget ? theme.onSurface : theme.warning }}>{c.perWeek(pace.perWeek)}</Text>
              <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{pace.projected ? c.projected(new Date(`${pace.projected}T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })) : c.wrongWay}</Text>
            </View>
          )
          : <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.paceWait}</Text>}
      </View>
      <DailyStepsRow accent={accent} tr={lang === 'tr'} />
      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.historyTitle}</Text>
        {desc.map((e, i) => {
          const prev = desc[i + 1];
          const diff = prev ? Math.round((e.weight - prev.weight) * 10) / 10 : null;
          const good = diff != null && Math.sign(diff) === Math.sign(target - prev!.weight);
          return (
            <View key={e.date} style={[st.rowLine, i > 0 && { borderTopWidth: HAIRLINE, borderTopColor: theme.separator }]}>
              <Text style={{ width: 64, fontSize: F.footnote, color: theme.onSurfaceVariant }}>{date(e.date)}</Text>
              <Text style={{ flex: 1, fontSize: F.body, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: theme.onSurface }}>{c.kg(e.weight)}</Text>
              <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: diff == null ? theme.onSurfaceMuted : good ? theme.success : theme.onSurfaceVariant }}>{diff == null ? c.start : `${diff > 0 ? '+' : ''}${diff}`}</Text>
              <Touchable accessibilityRole="button" accessibilityLabel={`${c.remove}: ${date(e.date)}`} onPress={() => ask(e.date)} style={st.smallLink}><Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>×</Text></Touchable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function WeightChart({ points, target, accent, track, surface, label, labelColor }: { points: number[]; target: number; accent: string; track: string; surface: string; label: string; labelColor: string }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const end = useSharedValue(reduce ? 1 : 0);
  const all = target > 0 ? [...points, target] : points;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(0.5, max - min);
  const x = (i: number) => PAD + (i * (w - PAD * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => PAD + ((max - v) / span) * (CHART_H - PAD * 2);
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    if (w <= 0) return p;
    points.forEach((v, i) => {
      if (i === 0) { p.moveTo(x(i), y(v)); return; }
      const mid = (x(i - 1) + x(i)) / 2;
      p.cubicTo(mid, y(points[i - 1]), mid, y(v), x(i), y(v));
    });
    return p;
  }, [w, points]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (w > 0) end.value = reduce ? 1 : withDelay(150, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
  }, [w, reduce, end]);
  const last = points.length - 1;
  return (
    <View accessibilityRole="image" accessibilityLabel={label} onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: CHART_H }}>
      {w > 0 && (
        <Canvas style={{ width: w, height: CHART_H }}>
          {target > 0 && <Line p1={vec(PAD, y(target))} p2={vec(w - PAD, y(target))} color={track} strokeWidth={1.5}><DashPathEffect intervals={[6, 6]} /></Line>}
          <Path path={path} style="stroke" strokeWidth={7} strokeCap="round" color={accent} opacity={0.25} start={0} end={end}><BlurMask blur={5} style="normal" /></Path>
          <Path path={path} style="stroke" strokeWidth={3} strokeCap="round" color={accent} start={0} end={end} />
          <Circle cx={x(last)} cy={y(points[last])} r={6} color={accent} />
          <Circle cx={x(last)} cy={y(points[last])} r={2.5} color={surface} />
        </Canvas>
      )}
      {target > 0 && w > 0 && <Text style={{ position: 'absolute', right: PAD, top: Math.max(0, y(target) - 18), fontSize: F.caption2, color: labelColor }}>{label}</Text>}
    </View>
  );
}

// ── Antrenman: haftalar ve hedef çizgisi ─────────────────────────
function TrainTrack({ run, active, accent, lang }: { run: boolean; active: Set<string>; accent: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const c = TRACK_COPY[lang].train;
  const trainingDays = useSporStore(s => s.trainingDays);
  const weeklyKm = useSporStore(s => s.weeklyKm);
  const targetEvent = useSporStore(s => s.targetEvent);
  const today = toDateKey(new Date());
  const rows = useMemo(() => weekGrid(active, WEEKS, today), [active, today]);
  const week = rows[rows.length - 1];
  const target = trainingDays ?? 0;
  const scale = 7;
  return (
    <View style={{ gap: S.md }}>
      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{run ? c.titleRun : c.title}</Text>
        <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: accent }}>{target ? c.thisWeek(week.count, target) : c.thisWeekFree(week.count)}</Text>
        <View accessible accessibilityLabel={target ? c.streak(weeksOnTarget(rows, target)) : c.thisWeekFree(week.count)} style={st.bars}>
          {target > 0 && <View style={[st.targetLine, { bottom: (BAR_H * target) / scale, borderColor: theme.outlineVariant }]} />}
          {rows.map((r, i) => {
            const met = target > 0 && r.count >= target;
            return (
              <View key={r.start} style={st.barCell}>
                <MotiView from={{ height: 0 }} animate={{ height: Math.max(r.count ? 8 : 3, (BAR_H * r.count) / scale) }} transition={{ type: 'spring', damping: 16, stiffness: 110, delay: i * 55 }}
                  style={{ width: '100%', borderRadius: R.sm, backgroundColor: r.count === 0 ? theme.surfaceContainerHigh : met || r.current ? accent : accent + '66' }} />
              </View>
            );
          })}
        </View>
        {target > 0 && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.targetLine(target)}</Text>}
        {target > 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.streak(weeksOnTarget(rows, target))}</Text>}
        {run && !!targetEvent && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.event(targetEvent)}</Text>}
        {run && !!weeklyKm && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.km(weeklyKm)}</Text>}
      </View>
      <DailyStepsRow accent={accent} tr={lang === 'tr'} />
    </View>
  );
}

// ── Tez, mülakat, sınav: çalışma ısı haritası ────────────────────
function WorkTrack({ plan, active, accent, lang }: { plan: ActivePlan; active: Set<string>; accent: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const c = TRACK_COPY[lang].work;
  const today = toDateKey(new Date());
  const rows = useMemo(() => weekGrid(active, WEEKS, today), [active, today]);
  const total = rows.reduce((a, r) => a + r.count, 0);
  const streak = dayStreak(active, today);
  const left = plan.date ? daysUntil(plan.date) : null;
  const leftText = left != null && left >= 0 ? c.left[plan.type]?.(plan.type === 'tez' ? Math.ceil(left / 7) : left) : null;
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.titles[plan.type] ?? c.titles.exam}</Text>
      <View style={st.stats}>
        <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: accent }}>{c.streak(streak)}</Text>
        {leftText && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{leftText}</Text>}
      </View>
      <View accessible accessibilityLabel={c.days(total)} style={st.heat}>
        {rows.map((r, w) => (
          <View key={r.start} style={st.heatCol}>
            {r.days.map((d, i) => (
              <MotiView key={d.key} animate={{ backgroundColor: d.active ? accent : theme.surfaceContainerHigh, opacity: d.future ? 0.35 : 1 }} transition={{ type: 'timing', duration: 260, delay: (w * 7 + i) * 8 }} style={[st.heatCell, d.key === today && { borderWidth: 1.5, borderColor: accent }]} />
            ))}
          </View>
        ))}
      </View>
      <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.days(total)}</Text>
    </View>
  );
}

// ── Ramazan: 30 günlük takvim ────────────────────────────────────
function RamadanTrack({ active, accent, lang }: { active: Set<string>; accent: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const c = TRACK_COPY[lang].ramadan;
  const status = ramadanStatusNow();
  const today = toDateKey(new Date());
  const cells = useMemo(() => (status.period ? ramadanCells(status.period.start, status.period.end, active, today) : []), [status.period, active, today]);
  const kept = cells.filter(x => x.state === 'done' || x.state === 'todayDone').length;
  const dayNo = cells.findIndex(x => x.key === today) + 1;
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.title}</Text>
      <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: accent }}>{status.isActive ? c.day(dayNo, cells.length) : c.notStarted(status.daysUntilStart)}</Text>
      <View style={st.ramadanGrid}>
        {cells.map((x, i) => {
          const filled = x.state === 'done' || x.state === 'todayDone';
          const isToday = x.state === 'today' || x.state === 'todayDone';
          return (
            <View key={x.key} accessible accessibilityLabel={`${x.day}${x.kadir ? `, ${c.kadir}` : ''}, ${filled ? c.done : x.state === 'missed' ? c.missed : ''}`} style={st.ramadanSlot}>
              <MotiView animate={{ backgroundColor: filled ? accent : theme.surfaceContainerHigh, opacity: x.state === 'future' ? 0.45 : 1 }} transition={{ type: 'timing', duration: 240, delay: i * 18 }} style={[st.ramadanCell, isToday && { borderWidth: 2, borderColor: accent }]}>
                {x.kadir
                  ? <Moon size={ICON.xs} color={filled ? theme.onPrimary : accent} />
                  : <Text style={{ fontSize: F.caption2, fontWeight: isToday ? W.bold : W.regular, fontVariant: ['tabular-nums'], color: filled ? theme.onPrimary : theme.onSurfaceVariant }}>{x.day}</Text>}
              </MotiView>
            </View>
          );
        })}
      </View>
      <View style={st.legend}>
        <Moon size={ICON.xs} color={accent} />
        <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.kadir}</Text>
        {status.isActive && <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.bayram(status.daysRemaining)}</Text>}
      </View>
      {status.isActive && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.kept(kept)}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  title: { fontSize: F.subhead, fontWeight: W.bold },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
  smallLink: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: S.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: S.xs, height: BAR_H },
  barCell: { flex: 1, justifyContent: 'flex-end', height: BAR_H },
  targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  heat: { flexDirection: 'row', gap: S.xxs, justifyContent: 'space-between' },
  heatCol: { flex: 1, gap: S.xxs },
  heatCell: { aspectRatio: 1, borderRadius: R.xs },
  ramadanGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingTop: S.xs },
  ramadanSlot: { width: `${100 / 6}%`, padding: S.xxs },
  ramadanCell: { aspectRatio: 1, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
});
