import { useMoneySymbol } from '@/features/modes/hooks/useMoneySymbol';
import { PLAN_COPY } from '../planCopy';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { CURRENCIES, currencyLabel } from '@/shared/utils/currency';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { setTaskDoneSynced } from '@/features/tasks/utils/toggleTaskSynced';
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Check, Minus, Plus } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useCountUp } from '@/shared/hooks/useCountUp';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { savingsView } from '@/features/modes/utils/planTrack';
import type { ActivePlan } from '@/features/modes/utils/planSlots';
import { useBudgetStore } from '@/shared/store/useBudgetStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { toDateKey } from '@/shared/utils/dateKey';
import { haptic } from '@/shared/utils/haptics';
import { TRACK_COPY } from './trackCopy';

/*
  PARA TAKİBİ: ÜÇ AYRI HİKÂYE (2026-11-05). Birikimde kumbara dolar; borçta çubuk erir ve ana eylem "ödeme yaptım"dır; acil fonda ölçü para değil güvence ayıdır.
  Eski karttaki her iş burada: ekle, çek, düzelt, hedefi değiştir, geri al, süre uzat.
*/
const JAR_H = 148;
const JAR_W = 92;
const QUICK = [100, 500, 1000, 5000];
const MAX_AMOUNT = 1_000_000_000;
const HISTORY_SHORT = 5;

type Mode = 'in' | 'out' | 'set' | 'target';
const digitsOf = (t: string) => { const n = parseInt(t.replace(/\D/g, '') || '0', 10); return n > MAX_AMOUNT ? MAX_AMOUNT : n; };

export function SavingsTrack({ plan, accent, lang }: { plan: ActivePlan; accent: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const c = TRACK_COPY[lang].money;
  const locale = TRACK_COPY[lang].locale;
  const { budgetType, startAmount, targetAmount, log, moves, adjust, undoMove, addEntry, setTargetAmount, monthlyExpense, coverMonths } = useBudgetStore();
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const type = budgetType === 'borc' || budgetType === 'acilfon' ? budgetType : 'birikim';
  const words = c[type];
  const today = toDateKey(new Date());
  const v = useMemo(() => savingsView({ type, start: parseFloat(startAmount) || 0, target: parseFloat(targetAmount) || 0, log, dateKey: plan.date, today, monthlyExpense: monthlyExpense ?? 0 }), [type, startAmount, targetAmount, log, plan.date, today, monthlyExpense]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState('');
  const [all, setAll] = useState(false);
  const { code, symbol } = useMoneySymbol(lang);
  const setCurrency = usePaymentsStore(s => s.setCurrency);
  const money = (n: number) => `${symbol}${Math.round(n).toLocaleString(locale)}`;
  const shownCurrent = useCountUp(Math.round(v.current));
  const dateText = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const past = !!plan.date && plan.date < today;

  // Borçta ana eylem bakiyeyi düşürür.
  const delta = (m: 'in' | 'out', n: number) => { const up = m === 'in'; return v.isDebt ? (up ? -n : n) : (up ? n : -n); };
  const save = () => {
    const n = digitsOf(text);
    // Boş kutu sıfır demek değildir: düzeltmede bile tutarı silmez. Bilerek 0 yazılırsa geçerli.
    if (!mode || !text.trim() || (n === 0 && mode !== 'set')) return;
    haptic.success();
    setText(''); setMode(null);
    if (mode === 'set') { addEntry(n); return; }
    if (mode === 'target') { setTargetAmount(String(n)); return; }
    const at = adjust(delta(mode, n));
    // Para girildiyse "bu hafta birikimini gir" görevi de yapılmıştır.
    useTaskStore.getState().tasks.filter(t => !t.isCompleted && (t.tags ?? []).includes('budget_entry')).forEach(t => { void setTaskDoneSynced(t.id, true, 'tasarruf'); });
    useToastStore.getState().show(c.saved, 'success', { label: c.undo, onAction: () => undoMove(at) });
  };
  const fieldLabel = mode === 'in' ? words.primaryField : mode === 'out' ? words.secondaryField : mode === 'set' ? c.fixField : c.targetField;
  const list = (moves ?? []).slice(0, all ? undefined : HISTORY_SHORT);
  const extend = () => { const d = new Date(`${plan.date ?? today}T12:00:00`); d.setMonth(d.getMonth() + 3); setSeasonalPref('tasarrufDate', toDateKey(d)); };
  // Veri başka cihazda: boş kumbara gösterip "hiç biriktirmemişsin" dememek.
  const noData = !(parseFloat(targetAmount) > 0) && !(parseFloat(startAmount) > 0) && log.length === 0;
  const celebrate = v.reached ? (v.isDebt ? c.cleared : c.reached) : null;

  return (
    <View style={{ gap: S.md }}>
      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{words.title}</Text>
        {noData && <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant }}>{c.deviceOnly}</Text>}
        {!noData && type === 'birikim' && (
          <View accessible accessibilityLabel={`${words.current} ${money(v.current)}, ${v.fillPct}%`} style={st.jarRow}>
            <View style={[st.jar, { backgroundColor: theme.surfaceContainerHigh }]}>
              <MotiView from={{ height: 0 }} animate={{ height: (JAR_H * v.fillPct) / 100 }} transition={{ type: 'spring', damping: 16, stiffness: 70 }} style={[st.jarFill, { backgroundColor: accent }]} />
              {[25, 50, 75].map(m => <View key={m} style={[st.jarMark, { bottom: (JAR_H * m) / 100, backgroundColor: v.fillPct >= m ? theme.onPrimary : theme.outlineVariant }]} />)}
              <Text style={[st.jarPct, { color: v.fillPct >= 55 ? theme.onPrimary : theme.onSurface }]}>{v.fillPct}%</Text>
            </View>
            <View style={{ flex: 1, gap: S.xs }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[st.big, { color: accent }]}>{money(shownCurrent)}</Text>
              <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{words.goalOf(money(parseFloat(targetAmount) || 0))}</Text>
              <Fact label={words.remaining} value={money(v.remaining)} />
            </View>
          </View>
        )}
        {!noData && type === 'borc' && (
          <View accessible accessibilityLabel={`${words.current} ${money(v.current)}`} style={{ gap: S.sm }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[st.big, { color: v.reached ? theme.success : accent }]}>{money(shownCurrent)}</Text>
            <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{words.goalOf(money(parseFloat(startAmount) || 0))}</Text>
            {/* Çubuk erir: dolu kısım kalan borç. */}
            <View style={[st.melt, { backgroundColor: theme.surfaceContainerHigh }]}>
              <MotiView from={{ width: '100%' }} animate={{ width: `${100 - v.pct}%` }} transition={{ type: 'timing', duration: 900 }} style={{ height: '100%', borderRadius: R.full, backgroundColor: accent }} />
            </View>
            <Fact label={words.remaining} value={`${money(v.done)} · ${v.pct}%`} />
          </View>
        )}
        {!noData && type === 'acilfon' && (
          <View accessible accessibilityLabel={v.coveredMonths != null ? c.covered(v.coveredMonths) : `${v.pct}%`} style={{ gap: S.sm }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[st.big, { color: accent }]}>{v.coveredMonths != null ? c.covered(v.coveredMonths) : money(shownCurrent)}</Text>
            <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{coverMonths ? c.coverOf(coverMonths) : words.goalOf(money(parseFloat(targetAmount) || 0))}</Text>
            <CoverCells total={coverMonths || 6} filled={coverMonths && v.coveredMonths != null ? v.coveredMonths : ((coverMonths || 6) * v.pct) / 100} accent={accent} empty={theme.surfaceContainerHigh} />
            <Fact label={words.current} value={`${money(v.current)} / ${money(parseFloat(targetAmount) || 0)}`} />
          </View>
        )}
        {celebrate && (
          <MotiView from={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10, stiffness: 180 }} style={st.done}>
            <Check size={ICON.sm} color={theme.success} strokeWidth={3} />
            <Text style={{ flex: 1, fontSize: F.body, fontWeight: W.bold, color: theme.success }}>{celebrate}</Text>
          </MotiView>
        )}
        {!noData && !v.reached && (
          <View style={[st.facts, { borderTopColor: theme.separator }]}>
            {v.needPerMonth != null && <Fact label={c.perMonth} value={money(v.needPerMonth)} />}
            {v.projected
              ? <Fact label={c.pace} value={dateText(v.projected)} note={v.onTime == null ? undefined : v.onTime ? c.onTime : c.late} noteColor={v.onTime ? theme.success : theme.warning} />
              : <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.paceWait}</Text>}
          </View>
        )}
        {past && !v.reached && (
          <View style={st.extend}>
            <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.timeUp}</Text>
            <Touchable accessibilityRole="button" onPress={extend} style={st.link}><Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accent }}>{c.extend}</Text></Touchable>
          </View>
        )}
      </View>

      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        {mode ? (
          <MotiView from={{ translateY: 6 }} animate={{ translateY: 0 }} transition={{ type: 'timing', duration: 180 }} style={{ gap: S.sm }}>
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{fieldLabel}</Text>
            <TextInput autoFocus keyboardType="number-pad" accessibilityLabel={fieldLabel} value={text ? digitsOf(text).toLocaleString(locale) : ''} onChangeText={setText} placeholder={`${symbol}0`} placeholderTextColor={theme.onSurfaceMuted} returnKeyType="done" onSubmitEditing={save}
              style={[st.input, { color: theme.onSurface, backgroundColor: theme.surfaceContainerHigh }]} />
            {(mode === 'in' || mode === 'out') && (
              <View style={st.wrap}>
                {QUICK.map(q => (
                  <Touchable key={q} accessibilityRole="button" onPress={() => { setText(String(digitsOf(text) + q)); }} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                    <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>+{q.toLocaleString(locale)}</Text>
                  </Touchable>
                ))}
              </View>
            )}
            <View style={st.row}>
              <Touchable accessibilityRole="button" onPress={() => { setMode(null); setText(''); }} style={[st.btn, { flex: 1, backgroundColor: theme.surfaceContainerHigh }]}><Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{c.cancel}</Text></Touchable>
              <Touchable accessibilityRole="button" onPress={save} style={[st.btn, { flex: 2, backgroundColor: accent }]}><Text style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onPrimary }}>{c.save}</Text></Touchable>
            </View>
          </MotiView>
        ) : (
          <>
            <Touchable accessibilityRole="button" onPress={() => { setMode('in'); }} style={[st.btn, st.primary, { backgroundColor: accent }]}>
              <Plus size={ICON.sm} color={theme.onPrimary} />
              <Text style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onPrimary }}>{words.primary}</Text>
            </Touchable>
            <Touchable accessibilityRole="button" onPress={() => { setMode('out'); }} style={[st.btn, st.primary, { backgroundColor: theme.surfaceContainerHigh }]}>
              <Minus size={ICON.sm} color={theme.onSurface} />
              <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{words.secondary}</Text>
            </Touchable>
            <View style={st.wrap}>
              {CURRENCIES.map(x => (
                <Touchable key={x.code} accessibilityRole="radio" accessibilityState={{ selected: x.code === code }} accessibilityLabel={currencyLabel(x.code, lang === 'tr')} onPress={() => setCurrency(x.code)} style={[st.chip, { backgroundColor: x.code === code ? accent : theme.surfaceContainerHigh }]}>
                  <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: x.code === code ? theme.onPrimary : theme.onSurface }}>{x.symbol}</Text>
                </Touchable>
              ))}
            </View>
            <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{PLAN_COPY[lang].money.hint}</Text>
            <View style={st.linkRow}>
              <Touchable accessibilityRole="button" onPress={() => { setMode('set'); setText(String(Math.round(v.current))); }} style={st.link}><Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{c.fix}</Text></Touchable>
              {!v.isDebt && <Touchable accessibilityRole="button" onPress={() => { setMode('target'); setText(targetAmount); }} style={st.link}><Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{c.newTarget}</Text></Touchable>}
            </View>
          </>
        )}
      </View>

      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.historyTitle}</Text>
        {list.length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.historyEmpty}</Text>}
        {list.map((m, i) => {
          // Borçta düşüş iyi haberdir; renk yönü plana göre.
          const good = v.isDebt ? m.delta < 0 : m.delta > 0;
          const amount = `${m.delta >= 0 ? '+' : '−'}${money(Math.abs(m.delta))}`;
          return (
            <View key={m.at} style={[st.move, i > 0 && { borderTopWidth: HAIRLINE, borderTopColor: theme.separator }]}>
              <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurfaceVariant }}>{new Date(m.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</Text>
              <Text style={{ fontSize: F.body, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: good ? theme.success : theme.onSurface }}>{amount}</Text>
              <Touchable accessibilityRole="button" accessibilityLabel={c.undoMove(amount)} onPress={() => { undoMove(m.at); }} style={st.link}>
                <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accent }}>{c.undo}</Text>
              </Touchable>
            </View>
          );
        })}
        {(moves ?? []).length > HISTORY_SHORT && !all && (
          <Touchable accessibilityRole="button" onPress={() => setAll(true)} style={st.link}><Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accent }}>+{(moves ?? []).length - HISTORY_SHORT}</Text></Touchable>
        )}
      </View>
    </View>
  );
}

function Fact({ label, value, note, noteColor }: { label: string; value: string; note?: string; noteColor?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: S.xxs }}>
      <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{label}</Text>
      <Text style={{ fontSize: F.body, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: theme.onSurface }}>{value}</Text>
      {note && <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: noteColor }}>{note}</Text>}
    </View>
  );
}

/** Her hücre bir aylık gider: güvence ay ay dolar, son hücre kısmen dolabilir. */
function CoverCells({ total, filled, accent, empty }: { total: number; filled: number; accent: string; empty: string }) {
  return (
    <View style={st.cells}>
      {Array.from({ length: total }, (_, i) => {
        const part = Math.max(0, Math.min(1, filled - i));
        return (
          <View key={i} style={[st.cell, { backgroundColor: empty }]}>
            <MotiView from={{ height: '0%' }} animate={{ height: `${Math.round(part * 100)}%` }} transition={{ type: 'timing', duration: 500, delay: i * 70 }} style={{ width: '100%', backgroundColor: accent }} />
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  title: { fontSize: F.subhead, fontWeight: W.bold },
  big: { fontSize: F.title, fontWeight: W.bold, fontVariant: ['tabular-nums'] },
  jarRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  jar: { width: JAR_W, height: JAR_H, borderRadius: R.lg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  jarFill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  jarMark: { position: 'absolute', right: 0, width: S.sm, height: 2 },
  jarPct: { fontSize: F.body, fontWeight: W.bold, fontVariant: ['tabular-nums'] },
  melt: { height: 14, borderRadius: R.full, overflow: 'hidden' },
  cells: { flexDirection: 'row', gap: S.xs, height: 56 },
  cell: { flex: 1, borderRadius: R.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  done: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingTop: S.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: S.lg, paddingTop: S.sm, borderTopWidth: HAIRLINE },
  extend: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  row: { flexDirection: 'row', gap: S.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  chip: { minHeight: 36, paddingHorizontal: S.smd, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 56, borderRadius: R.md, paddingHorizontal: S.md, fontSize: F.title3, fontWeight: W.bold, fontVariant: ['tabular-nums'] },
  btn: { minHeight: MIN_TOUCH, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.md },
  primary: { flexDirection: 'row', gap: S.xs },
  linkRow: { flexDirection: 'row', justifyContent: 'center', gap: S.lg },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: S.xs },
  move: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
});
