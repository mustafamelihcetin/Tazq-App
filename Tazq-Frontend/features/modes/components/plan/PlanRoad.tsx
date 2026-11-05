import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Check } from 'lucide-react-native';
import { F, W, S, R, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { modePhase } from '@/features/modes/utils/modePhase';
import { specForSlot, upcomingTasks } from '@/features/modes/utils/planManage';
import { withoutGoalName, type ActivePlan } from '@/features/modes/utils/planSlots';
import type { PlanCopy } from './planCopy';

/*
  YOL (2026-11-05). "Bu plan beni nereye götürüyor, yarın ne var?" sorusunun cevabı. Tarihli hedefte aşamalar, tarihsizde kilometre taşları;
  altında önümüzdeki günler. Uzak günler tahmindir ve öyle yazar.
*/
const AHEAD_DAYS = 5;

export function PlanRoad({ plan, c, lang, accent, milestones }: { plan: ActivePlan; c: PlanCopy; lang: 'tr' | 'en'; accent: string; milestones?: { label: string; done: boolean }[] }) {
  const { theme } = useAppTheme();
  const spec = usePrefsStore(s => s.planSpecs[plan.slot]);
  const dailySpec = useMemo(() => specForSlot(plan, spec), [plan, spec]);
  const phase = modePhase(plan.slot, plan.date ? dailySpec.daysLeft : null);
  const steps = milestones ?? (phase ? phase.names.map((n, i) => ({ label: n[lang], done: i < phase.index })) : []);
  const currentIndex = milestones ? milestones.findIndex(m => !m.done) : phase?.index ?? -1;
  const ahead = useMemo(() => upcomingTasks(dailySpec, lang, AHEAD_DAYS), [dailySpec, lang]);
  return (
    <View style={{ gap: S.md }}>
      {steps.length > 0 && (
        <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.roadTitle}</Text>
          {steps.map((s, i) => {
            const now = i === currentIndex;
            return (
              <View key={s.label} accessible accessibilityLabel={`${s.label}${now ? `, ${c.roadNow}` : ''}`} style={st.step}>
                <View style={st.rail}>
                  <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 13, stiffness: 200, delay: i * 70 }}
                    style={[st.node, { backgroundColor: s.done ? accent : now ? theme.surfaceCard : theme.surfaceContainerHigh, borderColor: s.done || now ? accent : 'transparent' }]}>
                    {s.done && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
                  </MotiView>
                  {i < steps.length - 1 && <View style={[st.line, { backgroundColor: s.done ? accent : theme.surfaceContainerHigh }]} />}
                </View>
                <View style={{ flex: 1, paddingBottom: S.smd }}>
                  <Text style={{ fontSize: F.body, fontWeight: now ? W.bold : W.regular, color: s.done || now ? theme.onSurface : theme.onSurfaceMuted }}>{s.label}</Text>
                  {now && <Text style={{ fontSize: F.caption2, color: accent, fontWeight: W.semibold }}>{c.roadNow}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}
      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.aheadTitle}</Text>
        <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, paddingBottom: S.xs }}>{c.aheadHint}</Text>
        {ahead.map(day => (
          <View key={day.date.toISOString()} style={st.day}>
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{day.date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
            {day.titles.length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.aheadRest}</Text>}
            {day.titles.map(t => <Text key={t} style={{ fontSize: F.body, color: theme.onSurface }}>{withoutGoalName(t, plan.name)}</Text>)}
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.xs },
  title: { fontSize: F.subhead, fontWeight: W.bold, paddingBottom: S.xs },
  step: { flexDirection: 'row', gap: S.smd },
  rail: { alignItems: 'center', width: 24 },
  node: { width: 22, height: 22, borderRadius: R.full, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, minHeight: 14 },
  day: { gap: S.xxs, paddingVertical: S.xs },
});
