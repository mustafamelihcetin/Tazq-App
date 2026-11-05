import React, { useEffect, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import Reanimated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Check, CalendarClock, Play } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, MIN_TOUCH, topBarSpace } from '@/shared/constants/tokens';
import { modeAccent } from '@/shared/constants/Colors';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { haptic } from '@/shared/utils/haptics';
import { toDateKey } from '@/shared/utils/dateKey';
import { fmtDateKey, useHabitStore } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { celebrate } from '@/features/user/utils/celebrate';
import { WaterGlass } from '@/features/modes/components/plan/WaterGlass';
import { PLAN_COPY } from '@/features/modes/components/plan/planCopy';
import { PostponePicker } from '@/features/modes/components/plan/PostponePicker';
import { useDayRoute, useDayRouteStore } from '@/features/modes/hooks/useDayRoute';
import type { RouteItem } from '@/features/modes/utils/dayRoute';
import { postponePlanTask, skipPlanTaskToday, undoPostpone } from '@/features/modes/utils/planManage';
import { activePlans } from '@/features/modes/utils/planSlots';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { setTaskDoneSynced } from '@/features/tasks/utils/toggleTaskSynced';
import { useStudyPlanStore } from '@/features/studyplan/store/useStudyPlanStore';
import { studyToday } from '@/features/studyplan/sync';

/*
  GÜNÜN ROTASI (2026-11-05). Liste değil yol: önünde tek adım, arkanda biten adımlar, ilerisi soluk. Kullanıcı 20 işe değil bir sonrakine bakar.
  Yol her adımda ilerler, bitince gerçek sayılarla kapanır; "bir adım daha" isteğe bağlıdır, baskı yok. Geride kalan iş suç değil: rota yarın yeniden kurulur.
*/
const NODE = 28;
const LOCALE = { tr: 'tr-TR', en: 'en-US' };
const FLOW = LinearTransition.springify().damping(20).mass(0.9);

export default function RouteScreen() {
  const insets = useSafeAreaInsets();
  const contentW = useContentMaxWidth();
  const router = useRouter();
  const { scrollY, onScroll } = useCollapsibleHeader();
  const { theme, isDark } = useAppTheme();
  const language = useLanguageStore(s => s.language);
  const lang = language === 'en' ? 'en' : 'tr';
  const c = PLAN_COPY[lang].route;
  const route = useDayRoute(lang);
  const prefs = usePrefsStore();
  const toggleDate = useHabitStore(s => s.toggleDate);
  const [postponing, setPostponing] = useState(false);
  const today = fmtDateKey();
  const celebrated = useDayRouteStore(s => s.celebratedDay);

  // Tek kutlama: gün başına bir kez, o da rota gerçekten bittiğinde.
  useEffect(() => {
    if (!route.complete || celebrated === today) return;
    useDayRouteStore.getState().markCelebrated(today);
    haptic.success();
    celebrate({ kind: 'route-done', isLite: usePrefsStore.getState().uiMode === 'lite', tr: lang === 'tr' });
  }, [route.complete, celebrated, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = (s: RouteItem) => {
    setPostponing(false);
    if (s.kind === 'habit') { toggleDate(String(s.refId), today); return; }
    void setTaskDoneSynced(s.refId as number, true, s.slot);
  };
  const undo = (s: RouteItem) => {
    if (s.kind === 'habit') { toggleDate(String(s.refId), today); return; }
    void setTaskDoneSynced(s.refId as number, false, s.slot);
  };
  const focus = (s: RouteItem) => {
    useFocusStore.getState().setCurrentTask(s.title, s.kind === 'task' ? (s.refId as number) : null);
    router.push('/focus');
  };
  const postpone = (s: RouteItem, date: string) => {
    setPostponing(false);
    const before = postponePlanTask(s.refId as number, date);
    useToastStore.getState().show(c.postponed(new Date(`${date}T12:00:00`).toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' })), 'info', before ? { label: c.undo, onAction: () => undoPostpone(s.refId as number, before) } : undefined);
  };
  const skipStudy = (s: RouteItem) => {
    setPostponing(false);
    if (s.blockId) useStudyPlanStore.getState().skip(studyToday(), s.blockId, true);
    useToastStore.getState().show(c.studyMoved, 'info');
  };
  const goalDateOf = (slot: string) => activePlans(prefs as never).find(p => p.slot === slot)?.date ?? null;
  const pct = route.total ? Math.round((route.done / route.total) * 100) : 0;
  const accentOf = (t: string) => modeAccent(t as never, isDark);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={c.title} scrollY={scrollY} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: topBarSpace(insets.top) + S.md, paddingHorizontal: S.lg, paddingBottom: insets.bottom + S.xxl, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}>
        <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
          <Text accessibilityRole="header" style={{ fontSize: F.title3, fontWeight: W.bold, color: theme.onSurface }}>
            {route.total === 0 ? c.emptyTitle : route.complete ? c.finishTitle : c.progress(route.done, route.total)}
          </Text>
          {route.total > 0 && !route.complete && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.minutesLeft(route.minutesLeft)}</Text>}
          {route.total === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.emptyBody}</Text>}
          {route.total > 0 && (
            <View accessibilityRole="progressbar" accessibilityValue={{ now: route.done, min: 0, max: route.total }} style={[st.track, { backgroundColor: theme.surfaceContainerHigh }]}>
              <MotiView animate={{ width: `${pct}%` }} transition={{ type: 'timing', duration: 500 }} style={{ height: '100%', borderRadius: R.full, backgroundColor: theme.primary }} />
            </View>
          )}
          {route.yesterday && route.yesterday.planned > 0 && route.done === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.yesterday(route.yesterday.done, route.yesterday.planned)}</Text>}
        </View>

        {route.complete && (
          <Reanimated.View entering={FadeInDown.duration(360)} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
            <View style={st.facts}>
              <Fact value={String(route.done)} label={c.factSteps} />
              <Fact value={String(route.goalsTouched)} label={c.factGoals} />
              <Fact value={String(route.minutesDone)} label={c.factMinutes} />
            </View>
            {route.weekDone > 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.week(route.weekDone)}</Text>}
            <Text style={{ fontSize: F.body, color: theme.onSurface }}>{c.enough}</Text>
            {route.spare && (
              <Touchable accessibilityRole="button" onPress={() => useDayRouteStore.getState().addKey(route.spare!.key, route.spare!.reason)} style={st.link}>
                <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.primary }}>{c.oneMore}</Text>
              </Touchable>
            )}
          </Reanimated.View>
        )}

        {route.stops.length > 0 && (
          <View>
            {route.stops.map((s, i) => {
              const isCurrent = route.current?.key === s.key;
              const accent = accentOf(s.type);
              const last = i === route.stops.length - 1;
              const reason = route.reasons[s.key];
              return (
                <Reanimated.View key={s.key} layout={FLOW} style={st.stop}>
                  <View style={st.rail}>
                    <MotiView animate={{ backgroundColor: s.done ? accent : isCurrent ? theme.surfaceCard : theme.surfaceContainerHigh, borderColor: s.done || isCurrent ? accent : 'transparent', scale: isCurrent ? 1.08 : 1 }} transition={{ type: 'timing', duration: 260 }} style={st.node}>
                      {s.done && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
                    </MotiView>
                    {!last && <MotiView animate={{ backgroundColor: s.done ? accent : theme.surfaceContainerHigh }} transition={{ type: 'timing', duration: 300 }} style={st.line} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: S.md }}>
                    {isCurrent ? (
                      <Reanimated.View entering={FadeInDown.duration(280)} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
                        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accent }}>{s.goal} · {s.nature === 'allDay' ? c.allDay : c.approx(s.minutes)}</Text>
                        <Text style={{ fontSize: F.title3, fontWeight: W.bold, color: theme.onSurface }}>{s.title}</Text>
                        {s.nature === 'allDay' ? <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.allDayHint}</Text> : reason && reason !== 'next' && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.reasons[reason]}</Text>}
                        {s.water && <WaterGlass goal={s.water} lang={lang} onFull={() => complete(s)} />}
                        {postponing && s.kind === 'task' && !s.blockId
                          ? <PostponePicker today={toDateKey(new Date())} goalDate={goalDateOf(s.slot)} lang={lang} onPick={d => postpone(s, d)} onCancel={() => setPostponing(false)} />
                          : (
                            <>
                              <Touchable accessibilityRole="button" onPress={() => complete(s)} style={[st.primary, { backgroundColor: accent }]}>
                                <Check size={ICON.sm} color={theme.onPrimary} strokeWidth={3} />
                                <Text style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onPrimary }}>{s.nature === 'allDay' ? c.didAllDay : c.did}</Text>
                              </Touchable>
                              <View style={st.actions}>
                                {s.kind === 'task' && s.nature === 'deep' && (
                                  <Touchable accessibilityRole="button" onPress={() => focus(s)} style={[st.secondary, { backgroundColor: theme.surfaceContainerHigh }]}>
                                    <Play size={ICON.xs} color={theme.onSurface} />
                                    <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.focus}</Text>
                                  </Touchable>
                                )}
                                {s.kind === 'task' && s.nature === 'allDay' && (
                                  <Touchable accessibilityRole="button" onPress={() => skipPlanTaskToday(s.slot, s.refId as number)} style={[st.secondary, { backgroundColor: theme.surfaceContainerHigh }]}>
                                    <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.notToday}</Text>
                                  </Touchable>
                                )}
                                {s.kind === 'task' && s.nature !== 'allDay' && (
                                  <Touchable accessibilityRole="button" onPress={() => (s.blockId ? skipStudy(s) : setPostponing(true))} style={[st.secondary, { backgroundColor: theme.surfaceContainerHigh }]}>
                                    <CalendarClock size={ICON.xs} color={theme.onSurface} />
                                    <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.postpone}</Text>
                                  </Touchable>
                                )}
                              </View>
                            </>
                          )}
                      </Reanimated.View>
                    ) : (
                      <Touchable accessibilityRole={s.done ? 'checkbox' : 'text'} accessibilityState={s.done ? { checked: true } : undefined} accessibilityHint={s.done ? c.undoHint : undefined} disabled={!s.done} onPress={() => undo(s)} style={st.row}>
                        <Text numberOfLines={2} style={{ fontSize: F.body, color: s.done ? theme.onSurfaceMuted : theme.onSurfaceVariant, textDecorationLine: s.done ? 'line-through' : 'none' }}>{s.title}</Text>
                        <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{s.goal}</Text>
                      </Touchable>
                    )}
                  </View>
                </Reanimated.View>
              );
            })}
          </View>
        )}

        {route.resting.length > 0 && (
          <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
            <Text accessibilityRole="header" style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{c.restingTitle}</Text>
            <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant }}>{c.restingBody(route.resting.map(r => r.goal).join(', '))}</Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: S.xxs }}>
      <Text style={{ fontSize: F.title, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: theme.primary }}>{value}</Text>
      <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  track: { height: 8, borderRadius: R.full, overflow: 'hidden' },
  facts: { flexDirection: 'row' },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  stop: { flexDirection: 'row', gap: S.smd },
  rail: { width: NODE, alignItems: 'center' },
  node: { width: NODE, height: NODE, borderRadius: R.full, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 3, minHeight: S.md },
  row: { minHeight: NODE, justifyContent: 'center', gap: S.xxs },
  primary: { flexDirection: 'row', gap: S.xs, minHeight: MIN_TOUCH + S.xs, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: S.xs },
  secondary: { flex: 1, flexDirection: 'row', gap: S.xs, minHeight: MIN_TOUCH, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
});

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback';
