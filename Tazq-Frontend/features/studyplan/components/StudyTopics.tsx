import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronDown, ChevronRight, CheckCircle2, Circle, CircleDot, RefreshCw } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { blueprintFor } from '../data/blueprints';
import { useStudyPlanStore } from '../store/useStudyPlanStore';
import { topicName } from '../utils/planBridge';
import { effectiveStates, PlanRecord, PlanView, unitsOfPlan } from '../utils/planCore';
import type { TopicState } from '../utils/scheduler';
import type { StudyCopy } from './studyCopy';

/*
  KONU HARİTASI (2026-11-05). Müfredata girmeden tek bakış: ne bitti, ne sürüyor. Bir dokunuşla işaretlenir; bu işaret planın en güçlü
  girdisidir (simülasyonda saat tahmini 2 kat yanlışken bile sonucu toparlıyor). Kilit konu yok: kullanıcı sırayı da plan dışını da seçer.
*/
type Status = 'none' | 'working' | 'done' | 'review';
const statusOf = (s?: TopicState): Status => {
  if (!s || s.cov <= 0) return 'none';
  if (s.cov < 0.999) return 'working';
  return s.step > 0 ? 'review' : 'done';
};

export function StudyTopics({ plan, c, lang, today, view, onChanged }: { plan: PlanRecord; c: StudyCopy; lang: 'tr' | 'en'; today: string; view: PlanView; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const store = useStudyPlanStore();
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const bp = blueprintFor(plan.name);
  const { states } = effectiveStates(store, today);

  const groups = unitsOfPlan(plan).flatMap(u => {
    const ids = [...new Set(u.topics.map(t => t.subject))];
    return ids.map(sub => ({
      unitId: u.id,
      sub,
      name: bp?.subjects.find(s => s.id === sub)?.[lang] ?? plan.courses?.find(k => k.id === sub)?.name ?? sub,
      topics: u.topics.filter(t => t.subject === sub),
    }));
  });
  const excludedNames = plan.excluded.map(id => ({ id, name: bp?.subjects.find(s => s.id === id)?.[lang] ?? topicName(plan, id, lang) }));

  const IconOf = ({ s, color }: { s: Status; color: string }) => {
    const Comp = s === 'done' ? CheckCircle2 : s === 'review' ? RefreshCw : s === 'working' ? CircleDot : Circle;
    return <Comp size={ICON.sm} color={color} />;
  };
  const act = (fn: () => void) => { fn(); setOpenTopic(null); onChanged(); };

  return (
    <View style={{ gap: S.sm }}>
      {groups.map(g => {
        const done = g.topics.filter(t => (states[g.unitId]?.topics[t.id]?.cov ?? 0) >= 0.999).length;
        const expanded = openSub === `${g.unitId}/${g.sub}`;
        return (
          <View key={`${g.unitId}/${g.sub}`} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
            <Touchable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpenSub(expanded ? null : `${g.unitId}/${g.sub}`)} style={st.head}>
              <Text style={{ flex: 1, fontSize: F.body, fontWeight: W.bold, color: theme.onSurface }}>{g.name}</Text>
              <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, fontVariant: ['tabular-nums'] }}>{done}/{g.topics.length}</Text>
              {expanded ? <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} /> : <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />}
            </Touchable>
            {expanded && g.topics.map(t => {
              const s = states[g.unitId]?.topics[t.id];
              const status = statusOf(s);
              const isOut = view.outTopics.includes(t.id);
              const open = openTopic === t.id;
              const tone = status === 'done' || status === 'review' ? theme.success : status === 'working' ? theme.primary : theme.onSurfaceMuted;
              return (
                <View key={t.id}>
                  <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />
                  <Touchable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${topicName(plan, t.id, lang)}, ${c.status[status]}`} onPress={() => setOpenTopic(open ? null : t.id)} style={st.row}>
                    <IconOf s={status} color={tone} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: F.body, color: theme.onSurface }}>{topicName(plan, t.id, lang)}</Text>
                      <Text style={{ fontSize: F.caption2, color: isOut ? theme.warning : theme.onSurfaceMuted }}>{isOut ? c.status.out : c.status[status]}</Text>
                    </View>
                  </Touchable>
                  {open && (
                    <View style={st.actions}>
                      {status !== 'done' && status !== 'review' && (
                        <>
                          <Text style={{ width: '100%', fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.markDone}</Text>
                          {([['kolay', c.easy], ['orta', c.medium], ['zor', c.hard]] as const).map(([r, label]) => (
                            <Touchable key={r} accessibilityRole="button" onPress={() => act(() => store.topicDone(plan.key, g.unitId, t.id, r, today))} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                              <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{label}</Text>
                            </Touchable>
                          ))}
                        </>
                      )}
                      {(status === 'done' || status === 'review') && (
                        <Touchable accessibilityRole="button" onPress={() => act(() => store.topicMore(plan.key, g.unitId, t.id, today))} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.more}</Text>
                        </Touchable>
                      )}
                      {status !== 'none' && (
                        <Touchable accessibilityRole="button" onPress={() => act(() => store.topicReset(plan.key, g.unitId, t.id, today))} style={st.plain}>
                          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.resetTopic}</Text>
                        </Touchable>
                      )}
                      <Touchable accessibilityRole="button" onPress={() => act(() => store.setExcluded(plan.key, t.id, true, today))} style={st.plain}>
                        <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.exclude}</Text>
                      </Touchable>
                    </View>
                  )}
                </View>
              );
            })}
            {expanded && bp && groups.length > 1 && (
              <Touchable accessibilityRole="button" onPress={() => { store.setExcluded(plan.key, g.sub, true, today); setOpenSub(null); onChanged(); }} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
                <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.excludeSubject}</Text>
              </Touchable>
            )}
          </View>
        );
      })}
      {excludedNames.length > 0 && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.bold, color: theme.onSurfaceVariant, paddingVertical: S.xs }}>{c.excludedTitle}</Text>
          {excludedNames.map(x => (
            <View key={x.id} style={st.row}>
              <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurfaceMuted }}>{x.name}</Text>
              <Touchable accessibilityRole="button" accessibilityLabel={`${c.restore}: ${x.name}`} onPress={() => { store.setExcluded(plan.key, x.id, false, today); onChanged(); }} style={st.plain}>
                <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.restore}</Text>
              </Touchable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, paddingHorizontal: S.md, paddingVertical: S.xxs },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH + S.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH + S.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, paddingLeft: ICON.sm + S.sm, paddingBottom: S.sm, alignItems: 'center' },
  chip: { minHeight: 36, paddingHorizontal: S.smd, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  plain: { minHeight: 36, paddingHorizontal: S.xs, alignItems: 'center', justifyContent: 'center' },
});
