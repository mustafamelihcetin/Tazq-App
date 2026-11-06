import { goalTitle } from '@/features/modes/utils/goalTitle';
import { localizeSporGoal } from '@/features/modes/utils/turkishModes';
import { PlanTrack } from '@/features/modes/components/plan/track/PlanTrack';
import { isRamadanPreview, ramadanFrameNow, ramadanStatusNow } from '@/features/modes/utils/ramadanPreview';
import { RamadanFastingSwitch, RamadanRhythm } from '@/features/modes/components/plan/RamadanRhythm';
import { lightDayFor } from '@/features/modes/store/usePlanAffinityStore';
import { dailyPool } from '@/features/modes/utils/dailyPlanEngine';
import { goalStateOf } from '@/features/modes/utils/goalRows';
import { isPausedOn } from '@/features/modes/utils/planPause';
import { specForSlot } from '@/features/modes/utils/planManage';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { useGoalCloseStore } from '@/features/modes/store/useGoalCloseStore';
import { PlanLearn, PlanMeasure } from '@/features/modes/components/plan/PlanMeasure';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { stripEmoji } from '@/shared/utils/emoji';
import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Animated, KeyboardAvoidingView, StyleSheet, ScrollView } from 'react-native';
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
import { PlanHero } from '@/features/modes/components/plan/PlanHero';
import { roadProgress } from '@/features/modes/utils/roadProgress';
import { modePhase } from '@/features/modes/utils/modePhase';
import { activeDays, kiloProgress } from '@/features/modes/utils/planMeasure';
import { quitView, savingsView } from '@/features/modes/utils/planTrack';
import { examFieldOf, ramadanDay, valueAtPct } from '@/features/modes/utils/planSignature';
import { TRACK_COPY } from '@/features/modes/components/plan/track/trackCopy';
import { useMoneySymbol } from '@/features/modes/hooks/useMoneySymbol';
import type { PlanHeroSignature } from '@/features/modes/components/plan/PlanHero';
import type { PlanSceneData } from '@/features/modes/components/plan/PlanScenes';
import { activePlans, type ActivePlan } from '@/features/modes/utils/planSlots';
import { planInsight } from '@/features/modes/utils/planInsight';
import { PLAN_COPY, PLAN_PURPOSE } from '@/features/modes/components/plan/planCopy';
import { PlanRating, PlanRoutines, PlanTasks, PlanWorkCard, usePlanItems } from '@/features/modes/components/plan/PlanToday';
import { PlanBasics } from '@/features/modes/components/plan/PlanBasics';
import { PlanRoad } from '@/features/modes/components/plan/PlanRoad';
import { PlanLifecycleRow } from '@/features/modes/components/PlanPauseRow';
import { WeakAreaPicker } from '@/features/modes/components/WeakAreaPicker';
import { PlanRefreshContext, usePlanLifecycle } from '@/features/modes/hooks/usePlanLifecycle';
import { unhidePlanItem } from '@/features/modes/utils/planManage';
import { detectSporTypeLocal } from '@/features/modes/utils/planAdaptations';
import { useBudgetStore } from '@/shared/store/useBudgetStore';
import { getCleanDays, QUIT_MILESTONES, useQuitStore } from '@/shared/store/useQuitStore';
import { INTERVIEW_AREAS, SPOR_AREAS, TEZ_AREAS, type SporAreaKind } from '@/shared/utils/weakAreas';
import { useStudyPlanStore } from '@/features/studyplan/store/useStudyPlanStore';
import { retireOrphanStudyTasks, runStudySync, studyTaskMissing, studyToday } from '@/features/studyplan/sync';
import { effectiveStates, planHasContent, planKeyFor, unitsOfPlan, viewOf } from '@/features/studyplan/utils/planCore';
import { dayNum } from '@/features/studyplan/utils/scheduler';
import { subjectName } from '@/features/studyplan/utils/planBridge';
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
type Tab = 'today' | 'road' | 'calendar' | 'topics' | 'mocks' | 'tools' | 'settings';
const SAVING_MILESTONES = [25, 50, 75, 100];
const AREAS_OF = (plan: ActivePlan) => {
  if (plan.type === 'tez') return TEZ_AREAS;
  if (plan.type === 'mulakat') return INTERVIEW_AREAS;
  if (plan.type === 'spor') { const k = detectSporTypeLocal(plan.name); return SPOR_AREAS[(k === 'yaris' ? 'genel' : k) as SporAreaKind] ?? []; }
  return [];
};

const KILO_MILESTONES = [25, 50, 75, 100];
const RISE_STEP = 90;

/**
 * Sahnenin devamı: yol çizilirken kartlar sırayla yükselir. Reanimated girişi, Moti değil: gecikmeli Moti opaklığı Android'de 0'da takılıp
 * sayfayı boş gösteriyordu (2026-11-05, cihazda Ramazan Planım'ı). Giriş bir kez çalışır, tekrar çizim onu durduramaz.
 */
function Rise({ index, children }: { index: number; children: React.ReactNode }) {
  return <Reanimated.View entering={FadeInDown.delay(index * RISE_STEP).duration(340)}>{children}</Reanimated.View>;
}

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
  // Seçili hedef ekrandan taşmasın: sağda kalan çip görünmüyordu (cihazda görüldü).
  const chipScroll = useRef<ScrollView>(null);
  const chipX = useRef<Record<string, number>>({});
  useEffect(() => { if (plan) chipScroll.current?.scrollTo({ x: Math.max(0, (chipX.current[plan.slot] ?? 0) - S.lg), animated: true }); }, [plan?.slot]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={c.title} scrollY={scrollY} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xxl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}>
          {plans.length > 1 && (
            <ScrollView ref={chipScroll} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" style={{ marginHorizontal: -S.lg, flexGrow: 0 }} contentContainerStyle={{ gap: S.md, paddingHorizontal: S.lg }}>
              {plans.map(p => {
                const on = p.slot === plan?.slot;
                return (
                  <Touchable key={p.slot} onLayout={e => { chipX.current[p.slot] = e.nativeEvent.layout.x; if (on) chipScroll.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - S.lg), animated: false }); }} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setSlot(p.slot)} style={st.goalTab}>
                    {/* Hedef seçimi yazı + çizgi: altındaki sekmeyle iki sıra aynı hap yarışıyordu; hangi katman neyi değiştiriyor belli olmuyordu. */}
                    <Text numberOfLines={1} style={{ maxWidth: 160, fontSize: F.body, fontWeight: on ? W.bold : W.medium, color: on ? theme.onSurface : theme.onSurfaceMuted }}>{goalTitle(p, lang, c.types[p.type], true)}</Text>
                    <View style={[st.goalLine, { backgroundColor: on ? resolveModeAccent(p.type, isDark) : 'transparent' }]} />
                  </Touchable>
                );
              })}
            </ScrollView>
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
  const bodyRouter = useRouter();
  const title = goalTitle(plan, lang, PLAN_COPY[lang].types[plan.type]);
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
  const isKilo = plan.type === 'spor' && detectSporTypeLocal(plan.name) === 'kilo';
  const sporStart = useSporStore(s => s.currentWeight);
  const sporTarget = useSporStore(s => s.targetWeight);
  const weightLog = useSporStore(s => s.weightLog);

  useEffect(() => { if (plan.type === 'exam') runStudySync(today); }, [plan.type, today]);
  // Boş açılmasın: bugünün işi üretilmemişse ekran açılırken üret.
  useEffect(() => { if (items.total === 0) void runAdaptations(true); }, [plan.slot]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const planStart = usePrefsStore(st => st.planSpecs[plan.slot]?.startDate);
  const specNow = usePrefsStore(st => st.planSpecs[plan.slot]);
  const goalNow = goalStateOf({ paused: isPausedOn(specNow?.pausedUntil ?? null, today), restToday: specNow?.restDay === today, daysLeft: days, done: todayDone, total: todayTotal, notStarted: plan.type === 'ramazan' && !ramadanStatusNow().isActive && ramadanFrameNow().phase !== 'eid', eid: plan.type === 'ramazan' && ramadanFrameNow().phase === 'eid' });
  // Sessiz boşluk yok: ara, geçmiş tarih ve dinlenme günü başlıkta söylenir.
  const stateNote = goalNow === 'paused' || goalNow === 'passed' || goalNow === 'rest' || goalNow === 'notStarted' || goalNow === 'eid' ? { text: c.goals.state[goalNow], urgent: goalNow === 'passed' } : null;
  const lightToday = !managed && lightDayFor(plan.slot);
  const leanPool = useMemo(() => (managed ? [] : dailyPool(specForSlot(plan, specNow))), [managed, plan, specNow]);

  // Hedefin kendi ölçüsü: tasarrufta tutar, bırakmada temiz gün.
  const budget = useBudgetStore();
  const quitItems = useQuitStore(s => s.items);
  const hidden = (usePrefsStore(s => s.planSpecs[plan.slot]?.hiddenItems)) ?? [];
  const { symbol } = useMoneySymbol(lang);
  const saving = useMemo(() => {
    if (plan.type !== 'tasarruf') return null;
    // Tek hesap: Takip'teki kumbara ne diyorsa kahraman da onu der ("%11" ve "%20" yan yana duruyordu, 2026-11-06).
    const type: 'birikim' | 'borc' | 'acilfon' = budget.budgetType === 'borc' || budget.budgetType === 'acilfon' ? budget.budgetType : 'birikim';
    const start = parseFloat(budget.startAmount) || 0;
    const target = parseFloat(budget.targetAmount) || 0;
    const v = savingsView({ type, start, target, log: budget.log, dateKey: plan.date, today, monthlyExpense: budget.monthlyExpense ?? 0 });
    const money = (n: number) => `${symbol}${Math.round(n).toLocaleString(sc.locale)}`;
    const shownPct = v.isDebt ? v.pct : v.fillPct;
    return { type, v, amount: money(v.current), shownPct, level: (v.isDebt ? 100 - v.pct : v.fillPct) / 100, isDebt: v.isDebt, start, target, money, line: v.isDebt ? c.debtLeft(Math.round(v.current).toLocaleString(sc.locale)) : c.savedOf(Math.round(v.current).toLocaleString(sc.locale), Math.round(target).toLocaleString(sc.locale)) };
  }, [plan.type, budget.startAmount, budget.targetAmount, budget.log, budget.budgetType, budget.monthlyExpense, plan.date, today, c, sc.locale, symbol]);
  const cleanDays = plan.type === 'birakma' && quitItems[0] ? getCleanDays(quitItems[0].start) : null;
  const kilo = isKilo ? kiloProgress(sporStart, sporTarget, weightLog) : null;
  // Yol'da yüzde değil gerçek değer: "Hedefin %25'i · 74,8 kg". Boş soyut eşik, hedefe özgü olmuyordu.
  const milestones = plan.type === 'birakma'
    ? QUIT_MILESTONES.map(n => ({ label: c.milestones.days(n), done: (cleanDays ?? 0) >= n }))
    : plan.type === 'tasarruf'
      ? SAVING_MILESTONES.map(n => ({ label: saving ? `${c.milestones.pct(n)} · ${saving.money(saving.isDebt ? valueAtPct(saving.start, 0, n) : valueAtPct(0, saving.target, n))}` : c.milestones.pct(n), done: (saving?.shownPct ?? 0) >= n }))
      : isKilo
        ? KILO_MILESTONES.map(n => ({ label: kilo ? `${c.milestones.pct(n)} · ${valueAtPct(kilo.start, kilo.target, n).toLocaleString(sc.locale, { maximumFractionDigits: 1 })} kg` : c.milestones.pct(n), done: (kilo?.pct ?? 0) >= n }))
        : undefined;
  const firstQuit = quitItems[0];
  const quitNext = plan.type === 'birakma' && firstQuit && cleanDays != null ? quitView(cleanDays, firstQuit) : null;
  const moonStatus = plan.type === 'ramazan' ? ramadanStatusNow() : null;
  const todayShare = todayTotal > 0 ? todayDone / todayTotal : 0;
  const sporKind = plan.type === 'spor' ? detectSporTypeLocal(plan.name) : null;
  const week = useMemo(() => activeDays(items.last7, items.planHabits.flatMap(x => x.h.completedDates ?? []), items.planTasks.filter(t => t.isCompleted).map(t => t.completedAt)), [items.last7, items.planHabits, items.planTasks]);
  const weekCount = week.filter(Boolean).length;
  const arc = usePlanLifecycle(plan.slot, plan.date ?? '', habitIds).arc;
  const planDays = planStart && plan.date ? Math.max(1, dayNum(plan.date) - dayNum(planStart.slice(0, 10))) : null;
  const stage = modePhase(plan.slot, days);
  const goalDone = c.journey(Math.round((planStart && days != null ? roadProgress(planStart, days) ?? 0 : 0) * 100));
  // Kitap = ders. Hazır müfredatta tek "ünite" vardır: ona göre çizilince KPSS'in 45 konusu tek gri kutu oluyordu (2026-11-06, cihazda).
  const subjectBooks = units.flatMap(u => [...new Set(u.topics.map(t => t.subject))].map(sub => {
    const list = u.topics.filter(t => t.subject === sub);
    return { name: subjectName(study, sub, lang), total: list.length, done: list.filter(t => (states[u.id]?.topics[t.id]?.cov ?? 0) >= 0.999).length };
  }));
  const examField = plan.type === 'exam' ? examFieldOf(plan.name) : 'general';
  const scene: PlanSceneData | null = examField !== 'general'
    ? { kind: 'exam', field: examField, today: todayShare, progress: hasTopics && topicTotal ? topicDone / topicTotal : planStart && days != null ? roadProgress(planStart, days) ?? 0 : 0, a11y: hasTopics ? c.topicProgress(topicDone, topicTotal) : goalDone }
    : hasTopics
    ? { kind: 'shelf', a11y: c.topicProgress(topicDone, topicTotal), books: subjectBooks }
    : saving?.type === 'borc'
    ? { kind: 'chain', pct: saving.v.pct / 100, a11y: saving.line }
    : saving?.type === 'acilfon'
      ? { kind: 'shield', months: budget.coverMonths && saving.v.coveredMonths != null ? saving.v.coveredMonths : ((budget.coverMonths || 6) * saving.v.pct) / 100, total: budget.coverMonths || 6, amount: saving.amount, goal: budget.coverMonths ? TRACK_COPY[lang].money.coverOf(budget.coverMonths) : TRACK_COPY[lang].money.acilfon.goalOf(saving.money(saving.target)), a11y: saving.line }
      : kilo
        ? { kind: 'dial', pct: kilo.pct / 100, from: `${kilo.start} kg`, now: `${kilo.latest} kg`, to: `${kilo.target} kg`, a11y: `${kilo.latest} kg, %${kilo.pct}` }
        : plan.type === 'mulakat' && stage
          ? { kind: 'stairs', index: stage.index, total: stage.total, today: todayShare, a11y: stage[lang] }
          : sporKind === 'maraton' || sporKind === 'yaris'
            ? { kind: 'run', progress: planStart && days != null ? roadProgress(planStart, days) ?? 0 : 0, today: todayShare, a11y: goalDone }
            : sporKind === 'guc'
              ? { kind: 'barbell', days: weekCount, a11y: c.week.days(weekCount) }
              : sporKind === 'genel'
                ? { kind: 'pulse', flags: week, a11y: c.week.days(weekCount) }
                : plan.type === 'tez' || (plan.type === 'exam' && !hasTopics)
                  ? { kind: 'page', written: arc && planDays ? Math.min(1, arc.effortDays / planDays) : 0, today: todayShare, a11y: goalDone }
                  : null;
  const signature: PlanHeroSignature | null = saving?.type === 'birikim'
    ? { kind: 'moneybox', pct: saving.level, label: `%${saving.shownPct}`, amount: saving.amount, symbol, goal: TRACK_COPY[lang].money.birikim.goalOf(saving.money(saving.target)) }
    : scene
      ? { kind: 'scene', scene }
      : cleanDays != null
        ? { kind: 'quit', days: cleanDays, milestones: QUIT_MILESTONES, a11y: `${cleanDays} ${c.clean}` }
        : moonStatus?.isActive
          ? { kind: 'moon', day: ramadanDay(moonStatus.daysRemaining, moonStatus.duration), duration: moonStatus.duration || 30, caption: c.ramadan.dayOf(ramadanDay(moonStatus.daysRemaining, moonStatus.duration)) }
          : null;
  const phaseName = plan.type === 'exam' || plan.type === 'tez' || plan.type === 'mulakat' || (plan.type === 'spor' && !isKilo) ? modePhase(plan.slot, days)?.[lang] ?? null : null;
  const heroLine = quitNext?.next ? TRACK_COPY[lang].quit.next(quitNext.next, quitNext.toNext) : kilo ? c.kiloLeft(kilo.leftKg.toLocaleString(sc.locale)) : sporKind === 'guc' || sporKind === 'genel' ? c.week.days(weekCount) : hasTopics ? c.topicProgress(topicDone, topicTotal) : phaseName;

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
    const keys: Tab[] = hasTopics ? ['today', 'calendar', 'topics', 'mocks', 'settings']
      : plan.type === 'exam' ? ['today', 'tools', 'settings']
      : ['today', 'tools', 'road', 'settings'];
    return keys.map(k => ({ key: k, label: c.tabs[k] }));
  }, [hasTopics, c, plan.type]);

  const work = (
    <>
      <PlanTasks slot={plan.slot} name={plan.name} items={items} c={c} hideStudy={managed} onChanged={onChanged} planType={plan.type} goalDate={plan.date} emptyLine={goalNow === 'active' ? undefined : c.goals.state[goalNow]} />
      <PlanRoutines slot={plan.slot} type={plan.type} items={items} c={c} accent={accent} lang={lang} />
    </>
  );

  return (
    <>
      <PlanHero
        title={title}
        accent={accent} c={c} lang={lang}
        metric={days != null && days > 0 ? { value: days, unit: c.dayUnit } : cleanDays != null ? { value: cleanDays, unit: cleanDays === 1 ? c.cleanOne : c.clean } : null}
        note={stateNote ?? (days === 0 ? { text: c.todayIs } : null)}
        line={plan.type === 'ramazan' && isRamadanPreview() ? c.goals.previewBadge : (saving?.type === 'birikim' || saving?.type === 'acilfon' ? null : saving?.line) ?? (ramadanFrameNow().fasting ? c.ramadan.todayLine : lightToday ? c.learn.todayLight : heroLine)}
        signature={signature}
        action={saving ? { label: TRACK_COPY[lang].money[saving.type].primary, onPress: () => setTab('tools') } : null}
        done={todayDone} total={todayTotal}
        road={plan.date && days != null && days >= 0 && planStart ? { progress: roadProgress(planStart, days) ?? 0, startIso: planStart, endKey: plan.date } : null}
      />

      {tabs.length > 1 && <Rise index={1}><SegmentedControl options={tabs} value={tab} onChange={setTab} theme={theme} isDark={isDark} accessibilityLabel={c.title} /></Rise>}

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
            {plan.type === 'ramazan' && <Rise index={2}><RamadanRhythm lang={lang} onChanged={onChanged} /></Rise>}
            {/* Önce günün işi; ölçü ve uyarı sonra. Ayrı kartlar tek listeye indi. */}
            <Rise index={3}>
              {managed
                ? <StudyToday plan={study} c={sc} lang={lang} today={today} view={view} onOpenTab={t => setTab(t)} onChanged={onChanged}>{work}</StudyToday>
                : <PlanWorkCard title={c.tabs.today}>{work}</PlanWorkCard>}
            </Rise>
            {!managed && plan.type !== 'ramazan' && <Rise index={4}><PlanMeasure plan={plan} items={items} c={c} lang={lang} accent={accent} onChanged={onChanged} onOpenTrack={() => setTab('tools')} /></Rise>}
            {insight && (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 300 }} style={[st.card, { backgroundColor: theme.surfaceCard, gap: S.xs }]}>
                <Text accessibilityRole="header" style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onSurface }}>{c.how}</Text>
                <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant }}>{insight}</Text>
              </MotiView>
            )}
            <PlanRating slot={plan.slot} c={c} accent={accent} />
          </>
        )}
        {tab === 'road' && <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant, paddingHorizontal: S.xs }}>{PLAN_PURPOSE[plan.type][lang]}</Text>}
        {tab === 'road' && <PlanRoad plan={plan} c={c} lang={lang} accent={accent} milestones={milestones} />}
        {tab === 'tools' && <PlanTrack plan={plan} items={items} accent={accent} lang={lang} />}
        {tab === 'calendar' && managed && <StudyCalendar plan={study} c={sc} lang={lang} today={today} view={view} onChanged={onChanged} />}
        {tab === 'topics' && managed && <StudyTopics plan={study} c={sc} lang={lang} today={today} view={view} onChanged={onChanged} />}
        {tab === 'mocks' && managed && <StudyMocks plan={study} c={sc} lang={lang} today={today} onChanged={onChanged} />}
        {tab === 'settings' && (
          <>
            <PlanBasics plan={plan} c={c} lang={lang} withMinutes={plan.type !== 'exam' && plan.type !== 'birakma'} onChanged={onChanged} />
            {AREAS_OF(plan).length > 0 && (
              <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
                <WeakAreaPicker slot={plan.slot} modeKey={plan.type} options={AREAS_OF(plan).map(a => ({ id: a.id, tr: a.tr, en: a.en }))} label={{ tr: PLAN_COPY.tr.focusTitle, en: PLAN_COPY.en.focusTitle }} />
                <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.focusHint}</Text>
              </View>
            )}
            <PlanLifecycleRowBox plan={plan} accent={accent} lang={lang} habitIds={habitIds} onChanged={onChanged} />
            {hidden.length > 0 && (
              <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
                <Text accessibilityRole="header" style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onSurface }}>{c.hiddenTitle}</Text>
                <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.hiddenHint}</Text>
                {hidden.map(k => (
                  <Touchable key={k} accessibilityRole="button" accessibilityLabel={`${c.restore}: ${k}`} onPress={() => { unhidePlanItem(plan.slot, k); onChanged(); }} style={st.hiddenRow}>
                    <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurface }}>{k}</Text>
                    <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.restore}</Text>
                  </Touchable>
                ))}
              </View>
            )}
            {plan.type === 'ramazan' && <RamadanFastingSwitch lang={lang} onChanged={onChanged} />}
            {!managed && <PlanLearn slot={plan.slot} c={c} accent={accent} lang={lang} pool={leanPool} name={plan.name} areaNames={Object.fromEntries(AREAS_OF(plan).map(a => [a.id, a[lang]]))} />}
            {managed && <StudySettings plan={study} c={sc} lang={lang} today={today} onChanged={onChanged} />}
            <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
              <Touchable accessibilityRole="button" onPress={() => bodyRouter.navigate({ pathname: '/modlar', params: { goal: plan.type, at: String(Date.now()) } })} style={st.cta}>
                <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{c.editGoal}</Text>
              </Touchable>
              <Touchable accessibilityRole="button" onPress={() => Alert.alert(c.closeConfirmTitle(title), c.closeConfirmBody, [
                { text: c.cancel, style: 'cancel' },
                { text: c.closeGoal, style: 'destructive', onPress: () => { useGoalCloseStore.getState().request(plan.slot); bodyRouter.navigate('/modlar'); } },
              ])} style={st.cta}>
                <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.error }}>{c.closeGoal}</Text>
              </Touchable>
            </View>
          </>
        )}
      </MotiView>
    </>
  );
}

/** Ara verme: hedef kartlarındaki aynı satır (bkz. usePlanLifecycle). */
function PlanLifecycleRowBox({ plan, accent, lang, habitIds, onChanged }: { plan: ActivePlan; accent: string; lang: 'tr' | 'en'; habitIds: string[]; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const raw = usePlanLifecycle(plan.slot, plan.date ?? '', habitIds);
  // Bırakma ve tasarrufta "N gününde çalıştın" anlamsız: temiz kalınır, para biriktirilir.
  const lifecycle = raw.arc && (plan.type === 'birakma' || plan.type === 'tasarruf') ? { ...raw, arc: { ...raw.arc, effortDays: 0 } } : raw;
  return (
    <PlanRefreshContext.Provider value={onChanged}>
      <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
        <PlanLifecycleRow tr={lang === 'tr'} accent={accent} accentText={accent} lifecycle={lifecycle} hasPlan />
      </View>
    </PlanRefreshContext.Provider>
  );
}

const st = StyleSheet.create({
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  track: { height: 6, borderRadius: R.full, overflow: 'hidden' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  chip: { minHeight: 36, minWidth: MIN_TOUCH, paddingHorizontal: S.smd, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  cta: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  goalTab: { minHeight: MIN_TOUCH, justifyContent: 'center', gap: S.xxs },
  goalLine: { height: 2, borderRadius: R.full },
});

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback';
