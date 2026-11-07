import { PLAN_COPY } from '@/features/modes/components/plan/planCopy';
import { studyBlockWindow, windowRank } from '@/features/modes/utils/ramadanBrain';
import { ramadanFrameNow } from '@/features/modes/utils/ramadanPreview';
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, ChevronUp, Circle, CheckCircle2, Play, Plus } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { blueprintFor } from '../data/blueprints';
import { useStudyPlanStore } from '../store/useStudyPlanStore';
import { setStudyBlockDone } from '../sync';
import { blockTitle, topicName } from '../utils/planBridge';
import { capOf, effectiveStates, PlanRecord, PlanView, planHasContent, StudyBlock, unitsOfPlan } from '../utils/planCore';
import { dayNum } from '../utils/scheduler';
import type { StudyCopy } from './studyCopy';

/*
  BUGÜN (2026-11-05). Ekranın tek sorusu: "Bugün ne çalışayım?" Üstte durum tek cümle, altında somut işler. Yüzde ya da puan yok: vaat
  etmeyiz, yalnız sığıp sığmadığını söyleriz.
  SIRA (2026-11-06): önce iş. Uyarı kartları listeyi aşağı itiyordu; artık altta tek satır, ayrıntı dokununca. Kendi işler ve rutinler
  (`children`) aynı yüzeyde devam eder.
*/

export function StudyToday({ plan, c, lang, today, view, onOpenTab, onChanged, children }: {
  plan: PlanRecord;
  c: StudyCopy;
  lang: 'tr' | 'en';
  today: string;
  view: PlanView;
  onOpenTab: (t: 'topics' | 'settings') => void;
  onChanged: () => void;
  children?: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const router = useRouter();
  const store = useStudyPlanStore();
  const [open, setOpen] = useState<string | null>(null);
  const [showFit, setShowFit] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const fasting = ramadanFrameNow().fasting;
  const blocks = (store.committed[today] ?? []).filter(b => b.planKey === plan.key).sort((a, b) => (fasting ? windowRank(studyBlockWindow(a.type)) - windowRank(studyBlockWindow(b.type)) : 0));
  const units = unitsOfPlan(plan);
  const content = planHasContent(plan);
  const daysLeft = plan.examDate ? dayNum(plan.examDate) - dayNum(today) : 0;
  const { states } = effectiveStates(store, today);
  const allTopics = units.flatMap(u => u.topics.map(t => ({ t, unitId: u.id, s: states[u.id]?.topics[t.id] })));
  const doneCount = allTopics.filter(x => (x.s?.cov ?? 0) >= 0.999).length;
  const outHere = view.outTopics.filter(id => allTopics.some(x => x.t.id === id));
  const fit = outHere.length ? 'over' : view.fit === 'over' ? 'tight' : view.fit;
  const closedToday = capOf(store)(dayNum(today)) === 0;
  const toAsk = allTopics.filter(x => (x.s?.cov ?? 0) >= 0.999 && !x.s?.rated && blocks.some(b => b.done && b.topicId === x.t.id));
  const openBlocks = blocks.filter(b => !b.done && !b.skipped);
  const showFitLine = content && daysLeft > 0 && fit !== 'fits';
  const showReview = content && !plan.reviewed && doneCount === 0;

  const toggle = (b: StudyBlock) => { void setStudyBlockDone(b.id, !b.done, today); };
  const startFocus = (b: StudyBlock) => {
    const task = useTaskStore.getState().tasks.find(t => (t.tags ?? []).includes(b.id));
    useFocusStore.getState().setCurrentTask(blockTitle(b, plan, lang), task?.id ?? null);
    router.push('/focus');
  };
  const hintOf = (b: StudyBlock) => {
    const kind = b.topicId ? blueprintFor(plan.name)?.topics.find(t => t.id === b.topicId)?.kind : null;
    return kind === 'dil' && b.type === 'yeni' ? c.dilHint : c.blockHint[b.type];
  };

  return (
    <View style={{ gap: S.md }}>
      {!content && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text style={{ fontSize: F.body, color: theme.onSurface }}>{c.needTopics}</Text>
          <Touchable accessibilityRole="button" onPress={() => onOpenTab('settings')} style={[st.primary, { backgroundColor: theme.primaryFill }]}>
            <Text style={{ color: theme.onPrimaryFill, fontSize: F.body, fontWeight: W.semibold }}>{c.addTopics}</Text>
          </Touchable>
        </View>
      )}

      {content && daysLeft > 0 && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard, gap: 0 }]}>
          <Text accessibilityRole="header" style={{ fontSize: F.subhead, fontWeight: W.bold, color: theme.onSurface, paddingBottom: S.xs }}>{c.todayTitle}</Text>
          {blocks.length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, paddingVertical: S.xs }}>{closedToday ? c.todayClosed : c.todayEmpty}</Text>}
          {blocks.map((b, i) => {
            const expanded = open === b.id;
            return (
              <View key={b.id}>
                {i > 0 && <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />}
                <View style={st.row}>
                  <Touchable accessibilityRole="checkbox" accessibilityState={{ checked: b.done }} accessibilityLabel={blockTitle(b, plan, lang)} onPress={() => toggle(b)} hitSlop={8} style={st.check}>
                    {b.done ? <CheckCircle2 size={ICON.md} color={theme.success} /> : <Circle size={ICON.md} color={theme.onSurfaceMuted} />}
                  </Touchable>
                  <Touchable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : b.id)} style={{ flex: 1, minHeight: MIN_TOUCH, justifyContent: 'center' }}>
                    <Text style={{ fontSize: F.body, fontWeight: W.medium, color: b.done || b.skipped ? theme.onSurfaceMuted : theme.onSurface, textDecorationLine: b.done ? 'line-through' : 'none' }}>
                      {blockTitle(b, plan, lang).split(' · ').slice(1).join(' · ')}
                    </Text>
                    {b.skipped && <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{c.skipped}</Text>}
                    {fasting && !b.done && !b.skipped && <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: theme.primary }}>{PLAN_COPY[lang].ramadan.windows[studyBlockWindow(b.type)]}</Text>}
                  </Touchable>
                </View>
                {expanded && (
                  <View style={{ paddingLeft: MIN_TOUCH, paddingBottom: S.sm, gap: S.xs }}>
                    <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{hintOf(b)}</Text>
                    <View style={st.wrap}>
                      {!b.done && !b.skipped && (
                        <Touchable accessibilityRole="button" onPress={() => startFocus(b)} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh, flexDirection: 'row', gap: S.xs }]}>
                          <Play size={ICON.xs} color={theme.onSurface} />
                          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.startFocus}</Text>
                        </Touchable>
                      )}
                      {!b.done && (
                        <Touchable accessibilityRole="button" onPress={() => { store.skip(today, b.id, !b.skipped); onChanged(); }} style={st.chipPlain}>
                          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{b.skipped ? c.undoSkip : c.notToday}</Text>
                        </Touchable>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          {blocks.length > 0 && openBlocks.length === 0 && (
            <View style={{ paddingTop: S.sm, gap: S.xs }}>
              <Text style={{ fontSize: F.footnote, color: theme.success, fontWeight: W.semibold }}>{c.todayDone}</Text>
              <Touchable accessibilityRole="button" onPress={() => { store.addExtra(today); onChanged(); }} style={{ minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                <Plus size={ICON.sm} color={theme.primary} />
                <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.oneMore}</Text>
              </Touchable>
            </View>
          )}
          {children}
        </View>
      )}
      {!(content && daysLeft > 0) && !!children && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard, gap: 0 }]}>
          <Text accessibilityRole="header" style={{ fontSize: F.subhead, fontWeight: W.bold, color: theme.onSurface, paddingBottom: S.xs }}>{c.todayTitle}</Text>
          {children}
        </View>
      )}

      {toAsk.slice(0, 1).map(({ t, unitId }) => (
        <View key={t.id} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{c.finished(topicName(plan, t.id, lang))}</Text>
          <View style={st.wrap}>
            {([['kolay', c.easy], ['orta', c.medium], ['zor', c.hard]] as const).map(([r, label]) => (
              <Touchable key={r} accessibilityRole="button" onPress={() => { store.topicDone(plan.key, unitId, t.id, r, today); onChanged(); }} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{label}</Text>
              </Touchable>
            ))}
            <Touchable accessibilityRole="button" onPress={() => { store.topicMore(plan.key, unitId, t.id, today); onChanged(); }} style={st.chipPlain}>
              <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.notYet}</Text>
            </Touchable>
          </View>
        </View>
      ))}


      {(showFitLine || showReview) && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard, gap: 0, paddingVertical: S.xs }]}>
          {showFitLine && (
            <>
              <Touchable accessibilityRole="button" accessibilityState={{ expanded: showFit }} onPress={() => setShowFit(v => !v)} style={st.note}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: F.footnote, fontWeight: W.semibold, color: theme.warning }}>{c.fit[fit as 'tight' | 'over']}</Text>
                {showFit ? <ChevronUp size={ICON.sm} color={theme.onSurfaceMuted} /> : <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} />}
              </Touchable>
              {showFit && (
                <View style={{ gap: S.xs, paddingBottom: S.sm }}>
                  <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{fit === 'over' ? c.fitWhyOver(outHere.length, Math.round(((allTopics.length - outHere.length) / Math.max(1, allTopics.length)) * 100)) : c.fitWhyTight}</Text>
                  <View style={st.wrap}>
                    <Touchable accessibilityRole="button" onPress={() => onOpenTab('settings')} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                      <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.addTime}</Text>
                    </Touchable>
                    {outHere.length > 0 && (
                      <Touchable accessibilityRole="button" accessibilityState={{ expanded: showOut }} onPress={() => setShowOut(v => !v)} style={st.chipPlain}>
                        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.seeOut}</Text>
                      </Touchable>
                    )}
                  </View>
                  {showOut && outHere.map(id => <Text key={id} style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{topicName(plan, id, lang)}</Text>)}
                </View>
              )}
            </>
          )}
          {showFitLine && showReview && <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />}
          {showReview && (
            <Touchable accessibilityRole="button" accessibilityLabel={`${c.reviewHint} ${c.reviewAction}`} onPress={() => { store.markReviewed(plan.key); onOpenTab('topics'); }} style={st.note}>
              <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.reviewHint}</Text>
              <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
            </Touchable>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.xs },
  track: { height: 6, borderRadius: R.full, overflow: 'hidden' },
  fill: { height: 6, borderRadius: R.full },
  row: { flexDirection: 'row', alignItems: 'center' },
  check: { width: ICON.md + S.sm, height: MIN_TOUCH, alignItems: 'flex-start', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, alignItems: 'center' },
  chip: { minHeight: 36, paddingHorizontal: S.smd, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  chipPlain: { minHeight: 36, paddingHorizontal: S.xs, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
  primary: { minHeight: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', marginTop: S.xs },
});

