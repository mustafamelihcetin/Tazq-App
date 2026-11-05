import { useDayRoute } from '@/features/modes/hooks/useDayRoute';
import { openRoute } from '@/features/modes/components/RouteBanner';
import { goalTitle } from '@/features/modes/utils/goalTitle';
import { isRamadanPreview, ramadanFrameNow, ramadanStatusNow } from '@/features/modes/utils/ramadanPreview';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import Reanimated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ban, BookOpen, Briefcase, Check, ChevronRight, Dumbbell, GraduationCap, Moon, PiggyBank, Scale } from 'lucide-react-native';
import { fmtDateKey, useHabitStore } from '@/features/habits';
import { openPlan, PlanLinkHidden } from '@/features/modes/components/plan/PlanLink';
import { PLAN_COPY } from '@/features/modes/components/plan/planCopy';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useSporStore } from '@/features/modes/store/useSporStore';
import { foreignTaskIds, goalDay, goalStateOf, groupByType, nextFreeSlot, quitRoomLeft } from '@/features/modes/utils/goalRows';
import { useGoalSetupStore } from '@/features/modes/components/setup/SetupShell';
import type { SeasonalPrefs } from '@/features/modes/store/usePrefsStore';
import { isPausedOn } from '@/features/modes/utils/planPause';
import { daysUntil, detectSporTypeLocal } from '@/features/modes/utils/planAdaptations';
import { kiloProgress } from '@/features/modes/utils/planMeasure';
import { activePlans, withoutGoalName, type ActivePlan, type PlanType } from '@/features/modes/utils/planSlots';
import { localizeSporGoal } from '@/features/modes/utils/turkishModes';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { Touchable } from '@/shared/components/Touchable';
import { modeAccent } from '@/shared/constants/Colors';
import { F, W, S, R, ICON, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { getCleanDays, useQuitStore } from '@/shared/store/useQuitStore';
import { stripEmoji } from '@/shared/utils/emoji';
import { haptic } from '@/shared/utils/haptics';

/*
  HEDEFLER: TEK BAKIŞTA DURUM (2026-11-05, kullanıcı: "hepsinin aktif olduğu senaryolarda karmaşa oluyor, oturup tek tek incelemek gerekiyor").
  Her hedef bir ekran boyu kart yerine tek satır: ad, ölçü, sıradaki iş, bugünün ilerlemesi. Tek eylem: satıra basmak Planım'ı açar (kullanıcı: "düzenle ve planım ayrı ayrı çıkıyor, kargaşa"). Düzenleme ve kapatma Planım → Ayarlar'dan; ayarların ve kapatmanın olduğu kartı oradan
  yerinde açar, aynı anda bir kart açık kalır. Kartlar gizliyken de bağlı kalır: kapanış ritüeli, bildirim ve hatırlatıcı hook'ları onların içinde çalışıyor.
  Satırlara giriş animasyonu yok: Android'de kaydırırken satır başına Moti boş bırakıyordu (bkz. planHub notu). Hareket bilgi taşıyan yerde: ilerleme, biten hedef, açılan kart.
*/
const FLOW = LinearTransition.springify().damping(20).mass(0.9);
const LEAVE = FadeOut.duration(160);
const TILE = 36;
const specOf = (prefs: Record<string, unknown>, slot: string) => (prefs.planSpecs as Record<string, { pausedUntil?: string | null; restDay?: string } | undefined>)[slot];
const SEGMENTS_MAX = 10;
const SWEEP_W = 90;

const ICONS: Record<PlanType, typeof Ban> = { exam: BookOpen, tez: GraduationCap, mulakat: Briefcase, spor: Dumbbell, ramazan: Moon, tasarruf: PiggyBank, birakma: Ban };

type Lang = 'tr' | 'en';
export interface GoalCard { id: string; node: React.ReactNode }
interface Row { key: string; type: PlanType; title: string; plan?: ActivePlan; }

function useMetric(plan: ActivePlan | undefined, lang: Lang): { text: string; urgent?: boolean } | null {
  const c = PLAN_COPY[lang].goals;
  const start = useSporStore(s => s.currentWeight);
  const target = useSporStore(s => s.targetWeight);
  const log = useSporStore(s => s.weightLog);
  const quit = useQuitStore(s => s.items);
  if (!plan) return null;
  if (plan.type === 'spor' && detectSporTypeLocal(plan.name) === 'kilo') {
    const p = kiloProgress(start, target, log);
    if (p) return { text: p.leftKg > 0 ? c.kgLeft(p.leftKg) : c.reached };
  }
  if (plan.type === 'birakma' && quit[0]) return { text: c.clean(getCleanDays(quit[0].start)) };
  if (!plan.date) return null;
  const d = daysUntil(plan.date);
  if (d < 0) return { text: c.passed, urgent: true };
  return d === 0 ? { text: c.today, urgent: true } : { text: c.days(d) };
}

function RowBody({ row, first, last, open, lang, onToggle, routeNext, restingToday }: { row: Row; first: boolean; last: boolean; open: boolean; lang: Lang; onToggle: () => void; routeNext?: string; restingToday: boolean }) {
  const { theme, isDark } = useAppTheme();
  const c = PLAN_COPY[lang].goals;
  const accent = modeAccent(row.type, isDark);
  const tasks = useTaskStore(s => s.tasks);
  const habits = useHabitStore(s => s.habits);
  const prefs = usePrefsStore() as unknown as Record<string, unknown>;
  const plan = row.plan;
  const today = fmtDateKey();
  const day = useMemo(() => (plan ? goalDay(plan.slot, (prefs[`${plan.slot}PlanHabitIds`] as string[]) ?? [], (prefs[`${plan.slot}PlanTaskIds`] as number[]) ?? [], tasks, habits, today, foreignTaskIds(plan.slot, prefs)) : null), [plan, prefs, tasks, habits, today]);
  const metric = useMetric(plan, lang);
  const Icon = plan?.type === 'spor' && detectSporTypeLocal(plan.name) === 'kilo' ? Scale : ICONS[row.type];
  const spec = plan ? specOf(prefs, plan.slot) : undefined;
  const state = plan && day ? goalStateOf({ paused: isPausedOn(spec?.pausedUntil ?? null, today), restToday: spec?.restDay === today, daysLeft: plan.date ? daysUntil(plan.date) : null, done: day.done, total: day.total, notStarted: plan.type === 'ramazan' && !ramadanStatusNow().isActive && ramadanFrameNow().phase !== 'eid', eid: plan.type === 'ramazan' && ramadanFrameNow().phase === 'eid' }) : null;
  const allDone = state === 'allDone';
  const line = !plan || !day || !state ? c.setup : state !== 'active' ? c.state[state] : restingToday ? PLAN_COPY[lang].route.resting : routeNext ? c.next(routeNext) : day.next ? c.next(withoutGoalName(day.next, plan.name)) : c.progress(day.done, day.total);
  const parts = day ? Math.min(day.total, SEGMENTS_MAX) : 0;
  const filled = day && day.total ? Math.round((day.done / day.total) * parts) : 0;
  const press = () => { haptic.surface(); if (plan) openPlan(plan.slot); else onToggle(); };
  return (
    <Reanimated.View layout={FLOW} exiting={LEAVE} style={[st.row, {
      backgroundColor: theme.surfaceCard,
      borderTopLeftRadius: first ? R.lg : 0, borderTopRightRadius: first ? R.lg : 0, borderBottomLeftRadius: last ? R.lg : 0, borderBottomRightRadius: last ? R.lg : 0,
      borderTopWidth: first ? 0 : HAIRLINE, borderTopColor: theme.separator,
    }]}>
      <Touchable accessibilityRole={plan ? 'link' : 'button'} accessibilityLabel={`${row.title}. ${metric ? `${metric.text}. ` : ''}${line}`} onPress={press} style={st.main}>
        <MotiView animate={{ backgroundColor: allDone ? accent : accent + (isDark ? '26' : '1A') }} transition={{ type: 'timing', duration: 320 }} style={st.tile}>
          {allDone
            ? <MotiView from={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 11, stiffness: 220 }}><Check size={ICON.sm} color={theme.onPrimary} strokeWidth={3} /></MotiView>
            : <Icon size={ICON.sm} color={accent} />}
        </MotiView>
        <View style={st.text}>
          <View style={st.head}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{row.title}</Text>
            {metric && <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: metric.urgent ? theme.error : accent }}>{metric.text}</Text>}
          </View>
          <Text numberOfLines={2} style={{ fontSize: F.footnote, color: allDone ? accent : theme.onSurfaceVariant }}>{line}</Text>
          {parts > 0 && (
            <View style={st.segments}>
              {Array.from({ length: parts }, (_, i) => (
                <MotiView key={i} animate={{ backgroundColor: i < filled ? accent : theme.surfaceContainerHigh }} transition={{ type: 'timing', duration: 300, delay: i * 45 }} style={st.segment} />
              ))}
            </View>
          )}
        </View>
      </Touchable>
      {open || !plan
        ? (
          <Touchable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${row.title}: ${open ? c.closeCard : c.openCard}`} onPress={onToggle} style={st.toggle}>
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: open ? theme.onSurfaceVariant : accent }}>{open ? c.hide : c.setupCta}</Text>
          </Touchable>
        )
        : <View style={st.toggle}><ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} /></View>}
    </Reanimated.View>
  );
}

/** Keşfet'te "başka sınav ekle": kart gizliyken de yeni yuvaya gidilir. Yuva doluysa satır yok: sınıra çarpılmaz. */
export function goalAddRows(s: SeasonalPrefs, applied: Record<'exam' | 'mulakat' | 'spor', boolean>, lang: Lang, isDark: boolean, focus: (id: string) => void, quitCount: number) {
  const g = PLAN_COPY[lang].goals;
  const rows = [
    { key: 'exam' as const, on: s.examMode && applied.exam, slot: nextFreeSlot([s.examName, s.exam2Name, s.exam3Name], ['exam', 'exam2', 'exam3']), Icon: BookOpen },
    { key: 'mulakat' as const, on: s.mulakatMode && applied.mulakat, slot: nextFreeSlot([s.mulakatName, s.mulakat2Name, s.mulakat3Name], ['mulakat', 'mulakat2', 'mulakat3']), Icon: Briefcase },
    { key: 'spor' as const, on: s.sporMode && applied.spor, slot: nextFreeSlot([s.sporGoal, s.spor2Goal], ['spor', 'spor2']), Icon: Dumbbell },
    { key: 'birakma' as const, on: s.birakmaMode && quitCount > 0, slot: quitRoomLeft(quitCount) > 0 ? 'birakma' : null, Icon: Ban },
  ];
  return rows.filter(r => r.on && r.slot).map(r => ({
    key: `add-${r.key}`, active: false, title: g.addMore[r.key], desc: g.addLimit[r.key], icon: '', Icon: r.Icon as typeof BookOpen, color: modeAccent(r.key, isDark), textColor: modeAccent(r.key, isDark), load: g.addLimit[r.key], sample: g.addLimit[r.key],
    onActivate: () => { useGoalSetupStore.getState().open(r.key, r.slot as string); },
  }));
}

/**
 * GÜNÜN TEK ÇİZGİSİ: her hedef kendi renginde, işi kadar yer kaplar ve yapıldıkça dolar. Sayfanın tek gösterişli hareketi. Yedi modu tek çubukta gösterir,
 * açıklama gerekmez: renkler hemen alttaki satırların renkleri. Kart üstünde sayı zaten burada: ayrıca geri sayım destesi çizilmez.
 */
export function GoalSummary({ lang }: { lang: Lang }) {
  const { theme, isDark } = useAppTheme();
  const c = PLAN_COPY[lang].route;
  const route = useDayRoute(lang);
  const reduce = useReduceMotion();
  const [stackW, setStackW] = useState(0);
  const headline = route.total === 0 ? c.emptyTitle : route.complete ? c.finishTitle : c.progress(route.done, route.total);
  return (
    <Touchable accessibilityRole="link" accessibilityLabel={headline} onPress={openRoute} style={[st.summary, { backgroundColor: theme.surfaceCard }]}>
      <View style={st.summaryHead}>
        <View style={{ flex: 1, gap: S.xxs }}>
          <Text accessibilityRole="header" style={{ fontSize: F.title3, fontWeight: W.bold, color: theme.onSurface }}>{headline}</Text>
          {route.total > 0 && !route.complete && <Text numberOfLines={1} style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{route.current ? c.nextStep(route.current.title) : c.minutesLeft(route.minutesLeft)}</Text>}
        </View>
      </View>
      {route.total > 0 && (
        <View onLayout={e => setStackW(e.nativeEvent.layout.width)} style={st.stack}>
          {route.stops.map((s, i) => (
            <MotiView key={s.key} animate={{ backgroundColor: s.done ? modeAccent(s.type as PlanType, isDark) : modeAccent(s.type as PlanType, isDark) + (isDark ? '33' : '26') }} transition={{ type: 'timing', duration: 400, delay: i * 60 }} style={st.stackPart} />
          ))}
          {/* Tek geçiş: ışık yoldan akar. Sonra durur. */}
          {stackW > 0 && !reduce && (
            <MotiView from={{ translateX: -SWEEP_W }} animate={{ translateX: stackW }} transition={{ type: 'timing', duration: 1100, delay: 350 }} pointerEvents="none" style={st.sweep}>
              <LinearGradient colors={['#FFFFFF00', '#FFFFFFB3', '#FFFFFF00']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </MotiView>
          )}
        </View>
      )}
      {route.total > 0 && !route.complete && (
        <View style={[st.cta, { backgroundColor: theme.primary }]}>
          <Text style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onPrimary }}>{route.done === 0 ? c.start : c.resume}</Text>
        </View>
      )}
    </Touchable>
  );
}

/** Kart, türünün son satırının altında yerinde açılır. Kart açıkken satır grubu ikiye bölünür: kart içinde kart olmaz. */
export function GoalRows({ cards, section, open, onOpen, onCardLayout, lang }: { cards: GoalCard[]; section: 'applied' | 'pending'; open: string | null; onOpen: (id: string | null) => void; onCardLayout: (id: string, y: number, height: number) => void; lang: Lang }) {
  const prefs = usePrefsStore();
  const plans = useMemo(() => (section === 'applied' ? activePlans(prefs as never) : []), [prefs, section]);
  const c = PLAN_COPY[lang];
  const route = useDayRoute(lang);
  const ids = new Set(cards.map(x => x.id));
  const fromPlans: Row[] = plans.filter(p => ids.has(p.type)).map(p => ({
    key: p.slot, type: p.type, plan: p,
    title: p.type === 'ramazan' && isRamadanPreview() ? `${c.types.ramazan} · ${c.goals.previewSuffix}` : goalTitle(p, lang, c.types[p.type], true),
  }));
  // Planı olmayan kart (kurulum bekliyor ya da yuvası dolmamış) yine de bir satır alır: kaybolmaz.
  const rest: Row[] = cards.filter(x => !fromPlans.some(r => r.type === x.id)).map(x => ({ key: x.id, type: x.id as PlanType, title: c.goals.names[x.id as PlanType] }));
  const rows = groupByType([...fromPlans, ...rest]);
  const lastOfType = (i: number) => rows[i + 1]?.type !== rows[i].type;
  return (
    <Reanimated.View entering={FadeInDown.delay(120).duration(360)}>
      {rows.map((row, i) => {
        const isOpen = open === row.type;
        const after = lastOfType(i) && isOpen;
        const before = i > 0 && lastOfType(i - 1) && open === rows[i - 1].type;
        const card = lastOfType(i) ? cards.find(x => x.id === row.type) : undefined;
        return (
          <React.Fragment key={row.key}>
            <RowBody row={row} first={i === 0 || before} last={i === rows.length - 1 || after} open={isOpen && lastOfType(i)} lang={lang} routeNext={route.stops.find(x => x.slot === row.key && !x.done)?.title} restingToday={route.resting.some(x => x.slot === row.key)} onToggle={() => onOpen(isOpen ? null : row.type)} />
            {card && (
              <View onLayout={e => onCardLayout(row.type, e.nativeEvent.layout.y, e.nativeEvent.layout.height)} style={{ display: isOpen ? 'flex' : 'none', marginVertical: S.sm }}>
                <MotiView animate={{ opacity: isOpen ? 1 : 0, translateY: isOpen ? 0 : -6 }} transition={{ type: 'timing', duration: 240 }}>
                  <PlanLinkHidden.Provider value>{card.node}</PlanLinkHidden.Provider>
                </MotiView>
              </View>
            )}
          </React.Fragment>
        );
      })}
    </Reanimated.View>
  );
}

const st = StyleSheet.create({
  summary: { borderRadius: R.lg, padding: S.md, gap: S.md },
  summaryHead: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  stack: { flexDirection: 'row', gap: S.xxs, height: 10, overflow: 'hidden', borderRadius: R.full },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SWEEP_W },
  stackPart: { flex: 1, borderRadius: R.full },
  cta: { minHeight: MIN_TOUCH, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingVertical: S.smd, paddingLeft: S.md, minHeight: MIN_TOUCH },
  tile: { width: TILE, height: TILE, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: S.xxs },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm },
  segments: { flexDirection: 'row', gap: S.xxs, paddingTop: S.xxs },
  segment: { flex: 1, height: 3, borderRadius: R.full },
  toggle: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, paddingHorizontal: S.smd, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
});
