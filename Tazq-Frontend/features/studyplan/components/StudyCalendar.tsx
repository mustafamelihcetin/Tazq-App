import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MonthCalendar, dayKey } from '@/shared/components/MonthCalendar';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, MIN_TOUCH } from '@/shared/constants/tokens';
import { PaymentPalette } from '@/shared/constants/Colors';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useStudyPlanStore } from '../store/useStudyPlanStore';
import { blockTitle } from '../utils/planBridge';
import { planOfUnit, PlanRecord, PlanView } from '../utils/planCore';
import { Block, dayKeyOf, dayNum } from '../utils/scheduler';
import { blueprintFor } from '../data/blueprints';
import type { StudyCopy } from './studyCopy';

/*
  TAKVİM (2026-11-05). Yolun tamamı tek bakışta: her gün o gün çalışılan derslerin rengi. Geçmiş gerçeği, bu hafta sabit planı, sonrası
  tahmini gösterir; üçü bilerek ayrı söylenir ki kullanıcı uzak bir günü söz sanmasın. Deneme ve sınav günü zemin rengiyle öne çıkar.
*/
/** Yan yana renkler karışmasın: paletten aralıklı seçim. */
const SPACED = [0, 4, 8, 2, 6, 9, 1, 5, 3, 7];

export function StudyCalendar({ plan, c, lang, today, view, onChanged }: { plan: PlanRecord; c: StudyCopy; lang: 'tr' | 'en'; today: string; view: PlanView; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const store = useStudyPlanStore();
  const start = new Date(`${today}T12:00:00`);
  const [ym, setYm] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [selected, setSelected] = useState(today);
  const n0 = dayNum(today);

  const subjects = useMemo(() => {
    const bp = blueprintFor(plan.name);
    if (bp) return bp.subjects.map(s => ({ id: s.id, name: s[lang] }));
    return (plan.courses ?? []).map(k => ({ id: k.id, name: k.name }));
  }, [plan.name, plan.courses, lang]);
  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    subjects.forEach((s, i) => { map[s.id] = PaymentPalette[SPACED[i % SPACED.length]]; });
    return map;
  }, [subjects]);

  const prefix = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`;
  const examDays = useMemo(() => {
    const set = new Set<string>();
    if (plan.examDate) set.add(plan.examDate);
    for (const k of plan.courses ?? []) if (k.date) set.add(k.date);
    return set;
  }, [plan.examDate, plan.courses]);

  const blocksOn = (key: string): Block[] => {
    if (key === today) return store.committed[today] ?? [];
    return view.projection.days[dayNum(key)] ?? [];
  };
  const mine = (b: Block) => planOfUnit(store, b.unitId)?.key === plan.key;

  const { marks, mockDays } = useMemo(() => {
    const m: Record<string, string[]> = {};
    const mocks = new Set<string>();
    const count = new Date(ym.y, ym.m + 1, 0).getDate();
    for (let d = 1; d <= count; d++) {
      const key = `${prefix}-${String(d).padStart(2, '0')}`;
      if (key < today) { const s = store.dayStats[key]; if (s) m[key] = [s[1] > 0 ? theme.success : theme.onSurfaceMuted]; continue; }
      const list = blocksOn(key).filter(mine);
      if (list.some(b => b.type === 'deneme')) mocks.add(key);
      const colors: string[] = [];
      for (const b of list) { const col = b.subject ? colorOf[b.subject] : null; if (col && !colors.includes(col)) colors.push(col); }
      if (colors.length) m[key] = colors;
    }
    return { marks: m, mockDays: mocks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix, today, view, store.dayStats, store.committed, colorOf, ym]);

  const shift = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(dayKey(d));
  };

  const sel = selected < today ? [] : blocksOn(selected).filter(mine);
  const stat = selected < today ? store.dayStats[selected] : null;
  const isClosed = store.closed.includes(selected);
  const n = dayNum(selected);
  const isFixed = n > n0 && n < n0 + 7;
  const isEstimate = n >= n0 + 7;
  const roundStart = Object.entries(view.projection.lastRoundStart).find(([u]) => planOfUnit(store, u)?.key === plan.key)?.[1];
  const fmt = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(c.locale, { day: 'numeric', month: 'long', weekday: 'long' });

  return (
    <View style={{ gap: S.md }}>
      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <MonthCalendar
          year={ym.y} month0={ym.m} onShift={shift} selected={selected} onSelect={setSelected} marks={marks} locale={c.locale} prevLabel={c.prevMonth} nextLabel={c.nextMonth}
          dayTint={k => (examDays.has(k) ? theme.error + '33' : mockDays.has(k) ? theme.primary + '26' : store.closed.includes(k) ? theme.surfaceContainerHigh : null)}
          dayA11y={k => (examDays.has(k) ? c.examDay : mockDays.has(k) ? c.mockDay : store.closed.includes(k) ? c.closedDay : null)}
        />
        <View style={st.legend}>
          {subjects.map(s => (
            <View key={s.id} style={st.legendItem}>
              <View style={[st.dot, { backgroundColor: colorOf[s.id] }]} />
              <Text style={{ fontSize: F.caption2, color: theme.onSurfaceVariant }}>{s.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onSurface }}>{fmt(selected)}</Text>
        {examDays.has(selected) && <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.error }}>{c.examDay}</Text>}
        {isClosed && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.closedDay}</Text>}
        {stat && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.plannedDone(stat[0], stat[1])}</Text>}
        {!stat && selected >= today && sel.length === 0 && !isClosed && !examDays.has(selected) && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.calendarSelectedEmpty}</Text>}
        {sel.map((b, i) => (
          <View key={i} style={st.row}>
            <View style={[st.dot, { backgroundColor: b.subject ? colorOf[b.subject] ?? theme.primary : theme.primary }]} />
            <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{blockTitle(b, plan, lang).split(' · ').slice(1).join(' · ')}</Text>
          </View>
        ))}
        {sel.length > 0 && isFixed && <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{c.fixedWeek}</Text>}
        {sel.length > 0 && isEstimate && <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{c.estimate}</Text>}
        {selected >= today && !examDays.has(selected) && (
          <Touchable accessibilityRole="button" onPress={() => { store.setClosed(isClosed ? store.closed.filter(k => k !== selected) : [...store.closed, selected], today); onChanged(); }} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{isClosed ? c.openDay : c.closeDay}</Text>
          </Touchable>
        )}
      </View>

      {roundStart != null && roundStart > n0 && (
        <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant, paddingHorizontal: S.xs }}>
          {c.lastRound(new Date(`${dayKeyOf(roundStart)}T12:00:00`).toLocaleDateString(c.locale, { day: 'numeric', month: 'long' }))}
        </Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.smd, gap: S.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, paddingTop: S.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  dot: { width: 8, height: 8, borderRadius: R.full },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 32 },
});
