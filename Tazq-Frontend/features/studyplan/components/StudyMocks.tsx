import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Plus, X } from 'lucide-react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { blueprintFor, ScoreModel } from '../data/blueprints';
import { useStudyPlanStore } from '../store/useStudyPlanStore';
import { topicName } from '../utils/planBridge';
import { PlanRecord, unitsOfPlan } from '../utils/planCore';
import { MissReason, MockRecord, mockTotal, netOf, sectionRatio, validScore } from '../utils/mockScore';
import type { StudyCopy } from './studyCopy';

/*
  DENEME (2026-11-05). Bir dakikadan kısa kayıt. Puan biçimi sınava göre: net (yanlış götürür), ölçekli (SAT), bant (IELTS), yüzde.
  Eğilim çubukları ortak 0-1 ölçeğinde; plan, geride kalan derse sessizce daha çok süre verir.
*/
const PERCENT: ScoreModel = { kind: 'percent' };
const REASONS: MissReason[] = ['bilmiyordum', 'unuttum', 'dikkat', 'sure'];
const parseNum = (v: string) => { const n = Number(v.replace(',', '.')); return v.trim() === '' || Number.isNaN(n) ? null : n; };

export function StudyMocks({ plan, c, lang, today, onChanged }: { plan: PlanRecord; c: StudyCopy; lang: 'tr' | 'en'; today: string; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const store = useStudyPlanStore();
  const bp = blueprintFor(plan.name);
  const score: ScoreModel = bp?.score ?? PERCENT;
  const units = unitsOfPlan(plan);
  const [unitId, setUnitId] = useState(units[0]?.id ?? plan.key);
  const unit = units.find(u => u.id === unitId) ?? units[0];
  const sections = useMemo(() => {
    if (bp) return bp.subjects.filter(s => !plan.excluded.includes(s.id)).map(s => ({ id: s.id, name: s[lang] }));
    return [];
  }, [bp, plan.excluded, lang]);
  const [adding, setAdding] = useState(false);
  const [counts, setCounts] = useState<Record<string, { c: string; w: string; s: string }>>({});
  const [total, setTotal] = useState('');
  const [misses, setMisses] = useState<{ topicId: string; reason: MissReason }[]>([]);
  const [pickTopic, setPickTopic] = useState<string | null>(null);
  const [error, setError] = useState('');

  const field = (id: string) => counts[id] ?? { c: '', w: '', s: '' };
  const setField = (id: string, k: 'c' | 'w' | 's', v: string) => setCounts(p => ({ ...p, [id]: { ...field(id), [k]: v } }));
  const input = [st.input, { backgroundColor: theme.surfaceContainerHigh, color: theme.onSurface }];

  const reset = () => { setCounts({}); setTotal(''); setMisses([]); setPickTopic(null); setError(''); setAdding(false); };
  const liveNet = score.kind === 'net' ? sections.reduce((a, s) => a + netOf(parseNum(field(s.id).c) ?? 0, parseNum(field(s.id).w) ?? 0, score.penalty), 0) : 0;

  const save = () => {
    const rec: MockRecord = { id: `${Date.now()}`, day: today, unitId: unit?.id ?? plan.key, sections: {}, misses: misses.length ? misses : undefined };
    if (score.kind === 'net') {
      for (const s of sections) {
        const cv = parseNum(field(s.id).c), wv = parseNum(field(s.id).w);
        if (cv != null || wv != null) rec.sections[s.id] = { correct: Math.max(0, cv ?? 0), wrong: Math.max(0, wv ?? 0) };
      }
      if (!Object.keys(rec.sections).length) { setError(c.invalidEmpty); return; }
    } else {
      const t = parseNum(total);
      if (t != null && !validScore(t, score)) { setError(score.kind === 'percent' ? c.invalidScore(0, 100) : c.invalidScore(score.min, score.max)); return; }
      if (t != null) rec.total = t;
      for (const s of sections) {
        const v = parseNum(field(s.id).s);
        if (v == null) continue;
        if (!validScore(v, score)) { setError(score.kind === 'percent' ? c.invalidScore(0, 100) : c.invalidScore(score.min, score.max)); return; }
        rec.sections[s.id] = { score: v };
      }
      if (t == null && !Object.keys(rec.sections).length) { setError(c.invalidEmpty); return; }
    }
    store.addMock(plan.key, rec, score, today);
    reset();
    onChanged();
  };

  const history = [...plan.mocks].sort((a, b) => b.day.localeCompare(a.day) || b.id.localeCompare(a.id));
  const ratioOf = (m: MockRecord): number | null => {
    if (score.kind !== 'net' && m.total != null) return sectionRatio({ score: m.total }, score);
    const rs = Object.values(m.sections).map(s => sectionRatio(s, score)).filter((r): r is number => r != null);
    return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
  };
  const trend = history.slice(0, 8).reverse().map(ratioOf);
  const totalLabel = score.kind === 'percent' ? c.scorePercent : score.kind === 'band' ? c.bandTotal : c.scoreTotal;

  return (
    <View style={{ gap: S.md }}>
      {!adding && (
        <Touchable accessibilityRole="button" onPress={() => setAdding(true)} style={[st.add, { backgroundColor: theme.primary }]}>
          <Plus size={ICON.sm} color={theme.onPrimary} />
          <Text style={{ color: theme.onPrimary, fontSize: F.body, fontWeight: W.semibold }}>{c.mockNew}</Text>
        </Touchable>
      )}
      {adding && (
        <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} style={[st.card, { backgroundColor: theme.surfaceCard, gap: S.sm }]}>
          {units.length > 1 && (
            <View style={st.wrap}>
              {units.map(u => {
                const name = plan.courses?.find(k => u.id.endsWith(`__${k.id}`))?.name ?? u.id;
                const on = u.id === unitId;
                return (
                  <Touchable key={u.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setUnitId(u.id)} style={[st.chip, { backgroundColor: on ? theme.primary : theme.surfaceContainerHigh }]}>
                    <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: on ? theme.onPrimary : theme.onSurface }}>{name}</Text>
                  </Touchable>
                );
              })}
            </View>
          )}
          {score.kind === 'net' && sections.map(s => (
            <View key={s.id} style={st.sectionRow}>
              <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{s.name}</Text>
              <TextInput accessibilityLabel={`${s.name} ${c.correct}`} placeholder={c.correct} placeholderTextColor={theme.onSurfaceMuted} keyboardType="number-pad" maxLength={3} value={field(s.id).c} onChangeText={v => setField(s.id, 'c', v)} style={input} />
              <TextInput accessibilityLabel={`${s.name} ${c.wrong}`} placeholder={c.wrong} placeholderTextColor={theme.onSurfaceMuted} keyboardType="number-pad" maxLength={3} value={field(s.id).w} onChangeText={v => setField(s.id, 'w', v)} style={input} />
            </View>
          ))}
          {score.kind === 'net' && <Text style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onSurface }}>{c.net}: {Math.round(liveNet * 100) / 100}</Text>}
          {score.kind !== 'net' && (
            <View style={st.sectionRow}>
              <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{totalLabel}</Text>
              <TextInput accessibilityLabel={totalLabel} keyboardType="decimal-pad" maxLength={5} value={total} onChangeText={setTotal} style={input} />
            </View>
          )}
          {score.kind !== 'net' && sections.length > 1 && (
            <>
              <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.sectionOptional}</Text>
              {sections.map(s => (
                <View key={s.id} style={st.sectionRow}>
                  <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{s.name}</Text>
                  <TextInput accessibilityLabel={s.name} keyboardType="decimal-pad" maxLength={5} value={field(s.id).s} onChangeText={v => setField(s.id, 's', v)} style={input} />
                </View>
              ))}
            </>
          )}
          {unit && (
            <View style={{ gap: S.xs }}>
              <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.missTitle}</Text>
              {misses.map((m, i) => (
                <View key={i} style={st.sectionRow}>
                  <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurface }}>{topicName(plan, m.topicId, lang)} · {c.reasons[m.reason]}</Text>
                  <Touchable accessibilityRole="button" accessibilityLabel={c.remove} onPress={() => setMisses(list => list.filter((_, k) => k !== i))} style={st.iconBtn}>
                    <X size={ICON.xs} color={theme.onSurfaceMuted} />
                  </Touchable>
                </View>
              ))}
              {!pickTopic && (
                <View style={st.wrap}>
                  {unit.topics.filter(t => !misses.some(m => m.topicId === t.id)).map(t => (
                    <Touchable key={t.id} accessibilityRole="button" onPress={() => setPickTopic(t.id)} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                      <Text style={{ fontSize: F.caption2, color: theme.onSurface }}>{topicName(plan, t.id, lang)}</Text>
                    </Touchable>
                  ))}
                </View>
              )}
              {pickTopic && (
                <View style={st.wrap}>
                  <Text style={{ width: '100%', fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{topicName(plan, pickTopic, lang)}</Text>
                  {REASONS.map(r => (
                    <Touchable key={r} accessibilityRole="button" onPress={() => { setMisses(l => [...l, { topicId: pickTopic, reason: r }]); setPickTopic(null); }} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                      <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.reasons[r]}</Text>
                    </Touchable>
                  ))}
                </View>
              )}
            </View>
          )}
          {!!error && <Text accessibilityLiveRegion="polite" style={{ fontSize: F.footnote, color: theme.error }}>{error}</Text>}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Touchable accessibilityRole="button" onPress={reset} style={[st.btn, { flex: 1, backgroundColor: theme.surfaceContainerHigh }]}>
              <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{c.mockCancel}</Text>
            </Touchable>
            <Touchable accessibilityRole="button" onPress={save} style={[st.btn, { flex: 2, backgroundColor: theme.primary }]}>
              <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onPrimary }}>{c.mockSave}</Text>
            </Touchable>
          </View>
        </MotiView>
      )}

      {trend.filter(r => r != null).length > 1 && (
        <View accessible accessibilityLabel={c.trend} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.bold, color: theme.onSurfaceVariant, paddingBottom: S.sm }}>{c.trend}</Text>
          <View style={st.bars}>
            {trend.map((r, i) => (
              <View key={i} style={{ flex: 1, justifyContent: 'flex-end', height: 64 }}>
                <MotiView from={{ height: 2 }} animate={{ height: Math.max(3, Math.round((r ?? 0) * 64)) }} transition={{ type: 'timing', duration: 450, delay: i * 40 }} style={{ borderRadius: R.xs, backgroundColor: i === trend.length - 1 ? theme.primary : theme.primary + '55' }} />
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onSurface, paddingBottom: S.xs }}>{c.historyTitle}</Text>
        {history.length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.historyEmpty}</Text>}
        {history.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />}
            <View style={st.sectionRow}>
              <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurfaceVariant }}>{new Date(`${m.day}T12:00:00`).toLocaleDateString(c.locale, { day: 'numeric', month: 'long' })}</Text>
              <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface, fontVariant: ['tabular-nums'] }}>{mockTotal(m, score) ?? '-'}</Text>
              <Touchable accessibilityRole="button" accessibilityLabel={c.remove} onPress={() => Alert.alert(c.removeConfirm, undefined, [{ text: c.cancel, style: 'cancel' }, { text: c.remove, style: 'destructive', onPress: () => store.removeMock(plan.key, m.id) }])} style={st.iconBtn}>
                <X size={ICON.xs} color={theme.onSurfaceMuted} />
              </Touchable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md },
  add: { flexDirection: 'row', gap: S.xs, minHeight: MIN_TOUCH + S.xs, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  chip: { minHeight: 36, paddingHorizontal: S.smd, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
  input: { width: 72, height: MIN_TOUCH, borderRadius: R.md, textAlign: 'center', fontSize: F.body },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: S.xs, alignItems: 'flex-end' },
});
