import { useMoneySymbol } from '@/features/modes/hooks/useMoneySymbol';
import { quitItemName } from '@/features/modes/utils/goalTitle';
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { usePlanAffinityStore } from '@/features/modes/store/usePlanAffinityStore';
import { hasSignal, type AffinityItem } from '@/features/modes/utils/planAffinity';
import { areaLeanings, hasRhythmInsight, isLightDay, topBand } from '@/features/modes/utils/planLearner';
import { getCleanDays, useQuitStore } from '@/shared/store/useQuitStore';
import { useBudgetStore } from '@/shared/store/useBudgetStore';
import { toDateKey } from '@/shared/utils/dateKey';
import { quitView, savingsView } from '@/features/modes/utils/planTrack';
import { TRACK_COPY } from './track/trackCopy';
import { detectSporTypeLocal } from '@/features/modes/utils/planAdaptations';
import { activeDays, kiloProgress } from '@/features/modes/utils/planMeasure';
import type { ActivePlan } from '@/features/modes/utils/planSlots';
import { canLogWeight, daysUntilNextWeight, recordWeeklyWeight } from '@/features/modes/utils/weightCheckin';
import type { usePlanItems } from './PlanToday';
import type { PlanCopy } from './planCopy';

/*
  BUGÜN'ÜN ÜSTÜNDEKİ ÖLÇÜ KARTI (2026-11-05). Her plan kendi sorusunu sorar: kiloda "yolun neresindeyim", antrenmanda "bu hafta kaç gün",
  tezde "kaç gün yazdım". Sınavın konu ve deneme ekranları, tasarruf ve bırakmanın Takip sekmesi zaten bu işi görür.
*/
const MIN_KG = 20;
const MAX_KG = 300;
const TREND_H = 44;
const BAR_W = 10;
const LOCALE = { tr: 'tr-TR', en: 'en-US' };

type Items = ReturnType<typeof usePlanItems>;

export function PlanMeasure({ plan, items, c, lang, accent, onChanged, onOpenTrack }: { plan: ActivePlan; items: Items; c: PlanCopy; lang: 'tr' | 'en'; accent: string; onChanged: () => void; onOpenTrack: () => void }) {
  if (plan.type === 'tasarruf') return <MoneySummary plan={plan} lang={lang} accent={accent} onOpen={onOpenTrack} />;
  if (plan.type === 'birakma') return <QuitSummary lang={lang} accent={accent} onOpen={onOpenTrack} />;
  if (plan.type === 'spor' && detectSporTypeLocal(plan.name) === 'kilo') return <KiloCard c={c} lang={lang} accent={accent} onChanged={onChanged} />;
  return <WeekCard plan={plan} items={items} c={c} lang={lang} accent={accent} />;
}

/** Bugün'de para: tek bakış, eylem Takip'te. */
function MoneySummary({ plan, lang, accent, onOpen }: { plan: ActivePlan; lang: 'tr' | 'en'; accent: string; onOpen: () => void }) {
  const { theme } = useAppTheme();
  const b = useBudgetStore();
  const t = TRACK_COPY[lang];
  const type = b.budgetType === 'borc' || b.budgetType === 'acilfon' ? b.budgetType : 'birikim';
  const v = savingsView({ type, start: parseFloat(b.startAmount) || 0, target: parseFloat(b.targetAmount) || 0, log: b.log, dateKey: plan.date, today: toDateKey(new Date()), monthlyExpense: b.monthlyExpense });
  const { symbol } = useMoneySymbol(lang);
  const money = (n: number) => `${symbol}${Math.round(n).toLocaleString(t.locale)}`;
  return (
    <Touchable accessibilityRole="button" accessibilityHint={t.summary.open} onPress={onOpen} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text style={[st.title, { color: theme.onSurface }]}>{t.money[type].title}</Text>
      <Text style={{ fontSize: F.title3, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: accent }}>{money(v.current)}</Text>
      <View style={[st.track, { backgroundColor: theme.surfaceContainerHigh }]}>
        <MotiView from={{ width: '0%' }} animate={{ width: `${v.isDebt ? 100 - v.pct : v.pct}%` }} transition={{ type: 'timing', duration: 700 }} style={{ height: '100%', borderRadius: R.full, backgroundColor: accent }} />
      </View>
      <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accent }}>{t.money[type].primary} ›</Text>
    </Touchable>
  );
}

/** Bugün'de bırakma: her şeyin temiz günü. */
function QuitSummary({ lang, accent, onOpen }: { lang: 'tr' | 'en'; accent: string; onOpen: () => void }) {
  const { theme } = useAppTheme();
  const items = useQuitStore(s => s.items);
  const q = TRACK_COPY[lang].quit;
  return (
    <Touchable accessibilityRole="button" accessibilityHint={TRACK_COPY[lang].summary.open} onPress={onOpen} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      {items.map(it => {
        const days = getCleanDays(it.start);
        const v = quitView(days, it);
        return (
          <View key={it.id} style={st.quitRow}>
            <View style={{ flex: 1, gap: S.xxs }}>
              <Text numberOfLines={1} style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{quitItemName(it, lang)}</Text>
              <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{v.next ? q.next(v.next, v.toNext) : q.allDone}</Text>
            </View>
            <Text style={{ fontSize: F.title3, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: accent }}>{days}</Text>
          </View>
        );
      })}
    </Touchable>
  );
}

function KiloCard({ c, lang, accent, onChanged }: { c: PlanCopy; lang: 'tr' | 'en'; accent: string; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const currentWeight = useSporStore(s => s.currentWeight);
  const targetWeight = useSporStore(s => s.targetWeight);
  const log = useSporStore(s => s.weightLog);
  const [text, setText] = useState('');
  const [fixing, setFixing] = useState(false);
  const p = useMemo(() => kiloProgress(currentWeight, targetWeight, log), [currentWeight, targetWeight, log]);
  const value = parseFloat(text.replace(',', '.'));
  const valid = value > MIN_KG && value < MAX_KG;
  const canLog = canLogWeight(log);
  const save = async () => { if (!valid) return; await recordWeeklyWeight(value, lang, null); setText(''); setFixing(false); onChanged(); };
  const min = p ? Math.min(...p.points, p.target) : 0;
  const max = p ? Math.max(...p.points, p.target) : 1;
  return (
    <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.kilo.title}</Text>
      {p ? (
        <>
          <View style={st.stats}>
            {[{ k: c.kilo.start, v: p.start }, { k: c.kilo.now, v: p.latest, on: true }, { k: c.kilo.target, v: p.target }].map(x => (
              <View key={x.k} accessible style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: x.on ? F.title3 : F.body, fontWeight: W.bold, color: x.on ? accent : theme.onSurface, fontVariant: ['tabular-nums'] }}>{c.kilo.kg(x.v)}</Text>
                <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{x.k}</Text>
              </View>
            ))}
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ now: p.pct, min: 0, max: 100 }} style={[st.track, { backgroundColor: theme.surfaceContainerHigh }]}>
            <MotiView from={{ width: '0%' }} animate={{ width: `${p.pct}%` }} transition={{ type: 'timing', duration: 600 }} style={{ height: '100%', borderRadius: R.full, backgroundColor: accent }} />
          </View>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{p.leftKg > 0 ? c.kilo.left(p.leftKg) : c.kilo.reached}</Text>
          {p.points.length > 1 && (
            <View accessible accessibilityLabel={c.kilo.trend} style={st.trend}>
              {p.points.map((v, i) => (
                <MotiView key={`${i}-${v}`} from={{ height: 2 }} animate={{ height: 4 + ((v - min) / Math.max(0.1, max - min)) * (TREND_H - 4) }} transition={{ type: 'timing', duration: 400, delay: i * 40 }}
                  style={{ width: BAR_W, borderRadius: R.full, backgroundColor: i === p.points.length - 1 ? accent : theme.surfaceContainerHigh }} />
              ))}
            </View>
          )}
        </>
      ) : <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.kilo.noGoal}</Text>}
      <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{canLog ? c.kilo.logNow : c.kilo.nextIn(daysUntilNextWeight(log))}</Text>
      {canLog || fixing ? (
        <View style={st.entry}>
        <TextInput value={text} onChangeText={setText} keyboardType="decimal-pad" accessibilityLabel={c.kilo.inputLabel} placeholder={c.kilo.placeholder} placeholderTextColor={theme.onSurfaceMuted}
          onSubmitEditing={() => { void save(); }} returnKeyType="done"
          style={[st.input, { color: theme.onSurface, backgroundColor: theme.surfaceContainerHigh, fontSize: F.body }]} />
        <Touchable accessibilityRole="button" accessibilityState={{ disabled: !valid }} disabled={!valid} onPress={() => { void save(); }} style={[st.btn, { backgroundColor: valid ? accent : theme.surfaceContainerHigh }]}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: valid ? theme.onPrimary : theme.onSurfaceMuted }}>{canLog ? c.kilo.save : c.kilo.fix}</Text>
        </Touchable>
      </View>
      ) : (
        <Touchable accessibilityRole="button" onPress={() => setFixing(true)} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accent }}>{c.kilo.fixLink}</Text>
        </Touchable>
      )}
    </MotiView>
  );
}

function WeekCard({ plan, items, c, lang, accent }: { plan: ActivePlan; items: Items; c: PlanCopy; lang: 'tr' | 'en'; accent: string }) {
  const { theme } = useAppTheme();
  const trainingDays = useSporStore(s => s.trainingDays);
  const weeklyKm = useSporStore(s => s.weeklyKm);
  const targetEvent = useSporStore(s => s.targetEvent);
  const flags = useMemo(() => activeDays(
    items.last7,
    items.planHabits.flatMap(x => x.h.completedDates ?? []),
    items.planTasks.filter(t => t.isCompleted).map(t => t.completedAt),
  ), [items.last7, items.planHabits, items.planTasks]);
  const count = flags.filter(Boolean).length;
  const sporKind = plan.type === 'spor' ? detectSporTypeLocal(plan.name) : null;
  const target = plan.type === 'spor' ? trainingDays ?? null : null;
  const line = target ? c.week.ofTarget(count, target) : c.week.days(count);
  const extra = sporKind === 'maraton' && (targetEvent || weeklyKm) ? c.week.run(targetEvent ?? '', weeklyKm) : null;
  return (
    <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.week.titles[plan.type]}</Text>
      <View accessible accessibilityLabel={line} style={st.dots}>
        {flags.map((on, i) => {
          const isToday = i === flags.length - 1;
          return (
            <View key={items.last7[i]} style={st.dayCell}>
              <MotiView animate={{ backgroundColor: on ? accent : theme.surfaceContainerHigh }} transition={{ type: 'timing', duration: 280, delay: i * 40 }} style={st.dot} />
              <Text style={{ fontSize: F.caption2, fontWeight: isToday ? W.bold : W.regular, color: isToday ? theme.onSurface : theme.onSurfaceMuted }}>{new Date(`${items.last7[i]}T12:00:00`).toLocaleDateString(LOCALE[lang], { weekday: 'narrow' })}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{line}</Text>
      {extra && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{extra}</Text>}
    </MotiView>
  );
}

/** Ayarlar: plan seni nasıl tanıyor. Yalnız yeterince gözlenmiş şeyi söyler; yeni kullanıcıya "tanıdım" demez. */
export function PlanLearn({ slot, c, accent, lang, pool, name, areaNames }: { slot: string; c: PlanCopy; accent: string; lang: 'tr' | 'en'; pool: AffinityItem[]; name: string; areaNames: Record<string, string> }) {
  const { theme } = useAppTheme();
  const affinity = usePlanAffinityStore(s => s.bySlot[slot]);
  const rhythm = usePlanAffinityStore(s => s.rhythm[slot]);
  const learned = hasSignal(affinity) || hasRhythmInsight(rhythm);
  const lean = useMemo(() => areaLeanings(pool, affinity, name), [pool, affinity, name]);
  const band = topBand(rhythm);
  const weekdays = [0, 1, 2, 3, 4, 5, 6].filter(d => isLightDay(rhythm, d));
  const insights = [
    ...weekdays.map(d => c.learn.lightDay(new Date(2026, 10, 1 + d).toLocaleDateString(LOCALE[lang], { weekday: 'long' }))),
    ...(band != null ? [c.learn.band(band)] : []),
    ...(lean.favorite && areaNames[lean.favorite] ? [c.learn.favorite(areaNames[lean.favorite])] : []),
    ...(lean.avoided && areaNames[lean.avoided] ? [c.learn.avoided(areaNames[lean.avoided])] : []),
  ];
  const ask = () => Alert.alert(c.learn.resetTitle, c.learn.resetBody, [
    { text: c.learn.cancel, style: 'cancel' },
    { text: c.learn.reset, style: 'destructive', onPress: () => usePlanAffinityStore.getState().resetSlot(slot) },
  ]);
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.learn.title}</Text>
      <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant }}>{c.learn.body}</Text>
      {insights.map((line, i) => (
        <MotiView key={line} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 80 }} style={st.insight}>
          <View style={[st.insightDot, { backgroundColor: accent }]} />
          <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurface }}>{line}</Text>
        </MotiView>
      ))}
      {insights.length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{learned ? c.learn.active : c.learn.waiting}</Text>}
      {learned && (
        <Touchable accessibilityRole="button" onPress={ask} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accent }}>{c.learn.reset}</Text>
        </Touchable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  title: { fontSize: F.subhead, fontWeight: W.bold },
  stats: { flexDirection: 'row', alignItems: 'flex-end' },
  track: { height: 6, borderRadius: R.full, overflow: 'hidden' },
  trend: { flexDirection: 'row', alignItems: 'flex-end', gap: S.xs, height: TREND_H },
  entry: { flexDirection: 'row', gap: S.xs, alignItems: 'center' },
  input: { flex: 1, minHeight: MIN_TOUCH, borderRadius: R.md, paddingHorizontal: S.smd },
  btn: { minHeight: MIN_TOUCH, paddingHorizontal: S.md, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: S.xs },
  insight: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm },
  insightDot: { width: 6, height: 6, borderRadius: R.full, marginTop: S.xs },
  quitRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
  dayCell: { flex: 1, alignItems: 'center', gap: S.xs },
  dot: { alignSelf: 'stretch', height: 8, borderRadius: R.full },
});
