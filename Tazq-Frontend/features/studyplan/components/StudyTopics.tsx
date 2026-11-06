import { StudyAddRow, WeightPicker } from './StudyTopicAdd';
import { subjectName } from '../utils/planBridge';
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Reanimated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Check, ChevronDown, ChevronRight, CheckCircle2, Circle, CircleDot, RefreshCw } from 'lucide-react-native';
import { HabitLiquid } from '@/features/habits/components/HabitLiquid';
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
const HERO_DISC = 56;
const SUBJECT_DISC = 28;

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
      name: subjectName(plan, sub, lang),
      topics: u.topics.filter(t => t.subject === sub),
    }));
  });
  // Eklenmiş ama henüz konusu olmayan ders de görünür: ilk konusu buradan eklenir.
  if (bp) for (const cs of plan.customSubjects ?? []) {
    if (!plan.excluded.includes(cs.id) && !groups.some(g => g.sub === cs.id)) groups.push({ unitId: plan.key, sub: cs.id, name: cs.name, topics: [] });
  }
  const excludedNames = plan.excluded.map(id => ({ id, name: topicName(plan, id, lang) || subjectName(plan, id, lang) }));

  const IconOf = ({ s, color }: { s: Status; color: string }) => {
    const Comp = s === 'done' ? CheckCircle2 : s === 'review' ? RefreshCw : s === 'working' ? CircleDot : Circle;
    return <Comp size={ICON.sm} color={color} />;
  };
  const act = (fn: () => void) => { fn(); setOpenTopic(null); onChanged(); };

  const totalTopics = groups.reduce((a, g) => a + g.topics.length, 0);
  const doneTopics = groups.reduce((a, g) => a + g.topics.filter(t => (states[g.unitId]?.topics[t.id]?.cov ?? 0) >= 0.999).length, 0);
  const allPct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;

  return (
    <View style={{ gap: S.sm }}>
      {totalTopics > 0 && (
        <Reanimated.View entering={FadeInDown.duration(320)} style={[st.card, st.hero, { backgroundColor: theme.surfaceCard }]}>
          <HabitLiquid size={HERO_DISC} stroke={3} ratio={doneTopics / totalTopics} color={theme.primary} track={theme.onSurface + '26'}>
            <Text style={{ fontSize: F.footnote, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: allPct >= 55 ? theme.onPrimary : theme.onSurface }}>%{allPct}</Text>
          </HabitLiquid>
          <View style={{ flex: 1, gap: S.xxs }}>
            <Text accessibilityRole="header" style={{ fontSize: F.title3, fontWeight: W.bold, color: theme.onSurface }}>{c.topicsHero(doneTopics, totalTopics)}</Text>
            <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.topicsHeroSub(groups.length)}</Text>
          </View>
        </Reanimated.View>
      )}
      {groups.map((g, gi) => {
        const done = g.topics.filter(t => (states[g.unitId]?.topics[t.id]?.cov ?? 0) >= 0.999).length;
        const expanded = openSub === `${g.unitId}/${g.sub}`;
        return (
          <Reanimated.View key={`${g.unitId}/${g.sub}`} entering={FadeInDown.delay(Math.min(gi, 10) * 45).duration(280)} layout={LinearTransition.duration(200)} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
            <Touchable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpenSub(expanded ? null : `${g.unitId}/${g.sub}`)} style={st.head}>
              <HabitLiquid size={SUBJECT_DISC} stroke={2} ratio={g.topics.length ? done / g.topics.length : 0} color={done === g.topics.length && done > 0 ? theme.success : theme.primary} track={theme.onSurface + '26'}>
                {done === g.topics.length && done > 0 && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
              </HabitLiquid>
              <Text style={{ flex: 1, fontSize: F.body, fontWeight: W.bold, color: theme.onSurface }}>{g.name}</Text>
              <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, fontVariant: ['tabular-nums'] }}>{done}/{g.topics.length}</Text>
              {expanded ? <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} /> : <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />}
            </Touchable>
            {expanded && g.topics.map((t, ti) => {
              const s = states[g.unitId]?.topics[t.id];
              const status = statusOf(s);
              const isOut = view.outTopics.includes(t.id);
              const open = openTopic === t.id;
              const tone = status === 'done' || status === 'review' ? theme.success : status === 'working' ? theme.primary : theme.onSurfaceMuted;
              return (
                <Reanimated.View key={t.id} entering={FadeIn.delay(Math.min(ti, 12) * 25).duration(180)}>
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
                      <Touchable accessibilityRole="button" onPress={() => act(() => (plan.customTopics?.some(x => x.id === t.id) ? store.removeTopic(plan.key, t.id, today) : store.setExcluded(plan.key, t.id, true, today)))} style={st.plain}>
                        <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{plan.customTopics?.some(x => x.id === t.id) ? c.removeCustom : c.exclude}</Text>
                      </Touchable>
                      <View style={{ width: '100%', gap: S.xs, paddingTop: S.xs }}>
                        <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.weightTitle}</Text>
                        <WeightPicker value={plan.weights?.[t.id] ?? 'mid'} onChange={w => { store.setWeight(plan.key, t.id, w, today); onChanged(); }} c={c} />
                      </View>
                    </View>
                  )}
                </Reanimated.View>
              );
            })}
            {expanded && (
              <StudyAddRow label={c.addTopic} placeholder={c.topicPlaceholder} c={c} withWeight onAdd={(name, weight) => { const ok = store.addTopic(plan.key, g.sub, name, weight, today); if (ok) onChanged(); return ok; }} />
            )}
            {expanded && bp && groups.length > 1 && (
              <Touchable accessibilityRole="button" onPress={() => { store.setExcluded(plan.key, g.sub, true, today); setOpenSub(null); onChanged(); }} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
                <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.excludeSubject}</Text>
              </Touchable>
            )}
          </Reanimated.View>
        );
      })}
      {!!bp && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <StudyAddRow label={c.addSubject} placeholder={c.subjectPlaceholder} c={c} withWeight={false} onAdd={name => { const ok = store.addSubject(plan.key, name, today); if (ok) onChanged(); return ok; }} />
        </View>
      )}
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md },
  card: { borderRadius: R.lg, paddingHorizontal: S.md, paddingVertical: S.xxs },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH + S.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH + S.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, paddingLeft: ICON.sm + S.sm, paddingBottom: S.sm, alignItems: 'center' },
  chip: { minHeight: 36, paddingHorizontal: S.smd, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  plain: { minHeight: 36, paddingHorizontal: S.xs, alignItems: 'center', justifyContent: 'center' },
});
