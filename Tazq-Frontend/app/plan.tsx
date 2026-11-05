import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Animated, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { Touchable } from '@/shared/components/Touchable';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { modeAccent as resolveModeAccent } from '@/shared/constants/Colors';
import { S, R, F, W, MIN_TOUCH, topBarSpace } from '@/shared/constants/tokens';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { usePlanAdaptations } from '@/features/modes/hooks/usePlanAdaptations';
import { RoadRing } from '@/features/modes/components/RoadRing';
import { activePlans, type ActivePlan } from '@/features/modes/utils/planSlots';
import { planInsight } from '@/features/modes/utils/planInsight';
import { PLAN_COPY, PLAN_PURPOSE } from '@/features/modes/components/plan/planCopy';
import { PlanRating, PlanRoutines, PlanTasks, usePlanItems } from '@/features/modes/components/plan/PlanToday';
import { PlanBasics } from '@/features/modes/components/plan/PlanBasics';
import { useStudyPlanStore } from '@/features/studyplan/store/useStudyPlanStore';
import { retireOrphanStudyTasks, runStudySync, studyTaskMissing, studyToday } from '@/features/studyplan/sync';
import { effectiveStates, planHasContent, planKeyFor, unitsOfPlan, viewOf } from '@/features/studyplan/utils/planCore';
import { dayNum } from '@/features/studyplan/utils/scheduler';
import { STUDY_COPY } from '@/features/studyplan/components/studyCopy';
import { StudyToday } from '@/features/studyplan/components/StudyToday';
import { StudyCalendar } from '@/features/studyplan/components/StudyCalendar';
import { StudyTopics } from '@/features/studyplan/components/StudyTopics';
import { StudyMocks } from '@/features/studyplan/components/StudyMocks';
import { StudySettings } from '@/features/studyplan/components/StudySettings';

/*
  PLANIM (2026-11-05, kullanıcı: "içgörü önizleme ile çalışma planı çakışıyor; tek yerde, anlaşılır, soru işareti bırakmadan, animasyonlu,
  tüm modlar için"). Her hedefin tek girişi burası. Üstte hedef seçilir; kahraman bölümü üç şeyi söyler: ne kadar kaldı, plan ne yapıyor,
  bugün neredeyim. Sekmeler o hedefin neye ihtiyacı varsa: sınavda takvim, konu, deneme; diğerlerinde bugün ve ayarlar.
*/
type Tab = 'today' | 'calendar' | 'topics' | 'mocks' | 'settings';
const RING = 96;

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const contentW = useContentMaxWidth();
  const router = useRouter();
  const { scrollY, onScroll } = useCollapsibleHeader();
  const { theme, isDark } = useAppTheme();
  const language = useLanguageStore(s => s.language);
  const lang = language === 'en' ? 'en' : 'tr';
  const c = PLAN_COPY[lang];
  const params = useLocalSearchParams<{ slot?: string }>();
  const prefs = usePrefsStore();
  const plans = useMemo(() => activePlans(prefs as never), [prefs]);
  const [slot, setSlot] = useState(params.slot);
  useEffect(() => { if (params.slot) setSlot(params.slot); }, [params.slot]);
  const plan = plans.find(p => p.slot === slot) ?? plans[0];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={c.title} scrollY={scrollY} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xxl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}>
          {plans.length > 1 && (
            <View accessibilityRole="radiogroup" style={st.wrap}>
              {plans.map(p => {
                const on = p.slot === plan?.slot;
                return (
                  <Touchable key={p.slot} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setSlot(p.slot)} style={[st.chip, { backgroundColor: on ? resolveModeAccent(p.type, isDark) : theme.surfaceContainerHigh }]}>
                    <Text numberOfLines={1} style={{ maxWidth: 160, fontSize: F.footnote, fontWeight: W.semibold, color: on ? theme.onPrimary : theme.onSurface }}>{p.name || c.types[p.type]}</Text>
                  </Touchable>
                );
              })}
            </View>
          )}
          {plan
            ? <PlanBody key={plan.slot} plan={plan} isDark={isDark} lang={lang} />
            : (
              <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
                <Text accessibilityRole="header" style={{ fontSize: F.subhead, fontWeight: W.bold, color: theme.onSurface }}>{c.empty.title}</Text>
                <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant }}>{c.empty.body}</Text>
                <Touchable accessibilityRole="link" onPress={() => router.replace('/modlar')} style={st.cta}>
                  <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.primary }}>{c.empty.cta}</Text>
                </Touchable>
              </View>
            )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PlanBody({ plan, isDark, lang }: { plan: ActivePlan; isDark: boolean; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const c = PLAN_COPY[lang];
  const sc = STUDY_COPY[lang];
  const accent = resolveModeAccent(plan.type, isDark);
  const prefs = usePrefsStore() as unknown as Record<string, unknown>;
  const habitIds = (prefs[`${plan.slot}PlanHabitIds`] as string[]) ?? [];
  const taskIds = (prefs[`${plan.slot}PlanTaskIds`] as number[]) ?? [];
  const items = usePlanItems(plan.slot, habitIds, taskIds);
  const { runAdaptations } = usePlanAdaptations();
  const store = useStudyPlanStore();
  const today = studyToday();
  const [tab, setTab] = useState<Tab>('today');

  useEffect(() => { if (plan.type === 'exam') runStudySync(today); }, [plan.type, today]);

  const study = plan.type === 'exam' ? store.plans[planKeyFor(plan.name)] : undefined;
  const managed = !!study && study.slot === plan.slot;
  const hasTopics = managed && planHasContent(study);
  const view = useMemo(() => viewOf(store, today), [store.plans, store.committed, store.week, store.closed, store.dayStats, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChanged = useCallback(() => {
    if (plan.type === 'exam') retireOrphanStudyTasks();
    void Promise.resolve(runAdaptations(true)).then(() => {
      if (plan.type !== 'exam') return;
      retireOrphanStudyTasks();
      if (studyTaskMissing()) void runAdaptations(true);
    });
  }, [plan.type, runAdaptations]);

  // Halka ve çubuk bugünü gösterir; sınavda konu ilerlemesini.
  const units = managed ? unitsOfPlan(study) : [];
  const states = managed ? effectiveStates(store, today).states : {};
  const topicTotal = units.reduce((a, u) => a + u.topics.length, 0);
  const topicDone = units.reduce((a, u) => a + u.topics.filter(t => (states[u.id]?.topics[t.id]?.cov ?? 0) >= 0.999).length, 0);
  const studyBlocks = managed ? (store.committed[today] ?? []).filter(b => b.planKey === study.key && !b.skipped) : [];
  const todayDone = managed ? studyBlocks.filter(b => b.done).length + items.planHabits.filter(x => x.doneToday).length : items.done;
  const todayTotal = managed ? studyBlocks.length + items.planHabits.length : items.total;
  const days = plan.date ? dayNum(plan.date) - dayNum(today) : null;
  const ring = todayTotal > 0 ? todayDone / todayTotal : 0;

  // Yeni planda yorum yok: daha ölçülecek bir şey yok, plan cümlesi yeter.
  const habitsStarted = items.planHabits.some(x => (x.h.completedDates ?? []).length > 0);
  const insight = !habitsStarted && items.planTasks.every(t => !t.isCompleted) ? null : planInsight({
    type: plan.type,
    tr: lang === 'tr',
    planHabits: items.planHabits.map(x => x.h),
    planHabitStats: items.planHabits.map(x => ({ doneToday: x.doneToday, streak: x.streak })),
    avgHabitWeekPct: items.planHabits.length ? Math.round((items.planHabits.reduce((a, x) => a + items.last7.filter(k => (x.h.completedDates ?? []).includes(k)).length / 7, 0) / items.planHabits.length) * 100) : 0,
    completedPlanTasks: items.planTasks.filter(t => t.isCompleted).length,
    totalPlanTasks: items.planTasks.length,
  });

  const tabs = useMemo(() => {
    const keys: Tab[] = hasTopics ? ['today', 'calendar', 'topics', 'mocks', 'settings'] : ['today', 'settings'];
    return keys.map(k => ({ key: k, label: c.tabs[k] }));
  }, [hasTopics, c]);

  return (
    <>
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }} style={[st.hero, { backgroundColor: theme.surfaceCard }]}>
        <View style={st.heroTop}>
          <RoadRing size={RING} progress={ring} color={accent} id={`plan-${plan.slot}`}>
            {days != null && days > 0
              ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: F.title, fontWeight: W.bold, color: accent, fontVariant: ['tabular-nums'] }}>{days}</Text>
                  <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: accent }}>{c.dayUnit}</Text>
                </View>
              )
              : <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: accent }}>{Math.round(ring * 100)}%</Text>}
          </RoadRing>
          <View style={{ flex: 1, gap: S.xxs }}>
            <Text numberOfLines={2} accessibilityRole="header" style={{ fontSize: F.title3, fontWeight: W.bold, color: theme.onSurface }}>{plan.name || c.types[plan.type]}</Text>
            {days != null && days <= 0 && <Text style={{ fontSize: F.footnote, color: days < 0 ? theme.error : theme.onSurfaceMuted }}>{days === 0 ? c.todayIs : c.passed}</Text>}
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{c.todayProgress(todayDone, todayTotal)}</Text>
          </View>
        </View>
        <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant }}>{PLAN_PURPOSE[plan.type][lang]}</Text>
        {hasTopics && (
          <View style={{ gap: S.xs }}>
            <View accessibilityRole="progressbar" accessibilityValue={{ now: topicDone, min: 0, max: topicTotal }} style={[st.track, { backgroundColor: theme.surfaceContainerHigh }]}>
              <MotiView from={{ width: '0%' }} animate={{ width: `${topicTotal ? Math.round((topicDone / topicTotal) * 100) : 0}%` }} transition={{ type: 'timing', duration: 600 }} style={{ height: '100%', borderRadius: R.full, backgroundColor: accent }} />
            </View>
            <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{c.topicProgress(topicDone, topicTotal)}</Text>
          </View>
        )}
      </MotiView>

      {tabs.length > 1 && <SegmentedControl options={tabs} value={tab} onChange={setTab} theme={theme} isDark={isDark} accessibilityLabel={c.title} />}

      {managed && store.notice && (
        <View accessibilityLiveRegion="polite" style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text style={{ fontSize: F.body, color: theme.onSurface }}>
            {store.notice.type === 'return' ? sc.notice.return(store.notice.days) : store.notice.type === 'unmarked' ? sc.notice.unmarked(store.notice.days) : sc.notice.date}
          </Text>
          <View style={st.wrap}>
            {store.notice.type === 'unmarked' && (
              <Touchable accessibilityRole="button" onPress={() => { store.confirmMissedWork(today); onChanged(); }} style={[st.chip, { backgroundColor: accent }]}>
                <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onPrimary }}>{sc.notice.worked}</Text>
              </Touchable>
            )}
            <Touchable accessibilityRole="button" onPress={store.clearNotice} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
              <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{store.notice.type === 'unmarked' ? sc.notice.notWorked : sc.notice.ok}</Text>
            </Touchable>
          </View>
        </View>
      )}

      <MotiView key={tab} from={{ opacity: 0, translateX: 8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220 }} style={{ gap: S.md }}>
        {tab === 'today' && (
          <>
            {managed && <StudyToday plan={study} c={sc} lang={lang} today={today} view={view} onOpenTab={t => setTab(t)} onChanged={onChanged} />}
            <PlanTasks slot={plan.slot} name={plan.name} items={items} c={c} hideStudy={managed} />
            <PlanRoutines items={items} c={c} accent={accent} lang={lang} />
            {insight && (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 300 }} style={[st.card, { backgroundColor: theme.surfaceCard, gap: S.xs }]}>
                <Text accessibilityRole="header" style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onSurface }}>{c.how}</Text>
                <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant }}>{insight}</Text>
              </MotiView>
            )}
            <PlanRating slot={plan.slot} c={c} accent={accent} />
          </>
        )}
        {tab === 'calendar' && managed && <StudyCalendar plan={study} c={sc} lang={lang} today={today} view={view} onChanged={onChanged} />}
        {tab === 'topics' && managed && <StudyTopics plan={study} c={sc} lang={lang} today={today} view={view} onChanged={onChanged} />}
        {tab === 'mocks' && managed && <StudyMocks plan={study} c={sc} lang={lang} today={today} onChanged={onChanged} />}
        {tab === 'settings' && (
          <>
            <PlanBasics plan={plan} c={c} lang={lang} withMinutes={plan.type !== 'exam' && plan.type !== 'birakma'} onChanged={onChanged} />
            {managed && <StudySettings plan={study} c={sc} lang={lang} today={today} onChanged={onChanged} />}
            <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, textAlign: 'center' }}>{c.closeHint}</Text>
          </>
        )}
      </MotiView>
    </>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  hero: { borderRadius: R.lg, padding: S.md, gap: S.smd },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  track: { height: 6, borderRadius: R.full, overflow: 'hidden' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  chip: { minHeight: 36, minWidth: MIN_TOUCH, paddingHorizontal: S.smd, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  cta: { minHeight: MIN_TOUCH, justifyContent: 'center' },
});

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback';
