import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayValue, useDisplayColors } from '@/shared/components/DisplayPanel';
import { F, W, S, R, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import type { useDayRoute } from '@/features/modes/hooks/useDayRoute';
import { PLAN_COPY } from '@/features/modes/components/plan/planCopy';

/** Rota tek kapıdan açılır. Lazy: modül zinciri jest'te expo-router yüklemesin (bkz. openPlan). */
export const openRoute = () => require('expo-router').router.push('/rota');

type Route = ReturnType<typeof useDayRoute>;

/** Tek hedefte rota yükten çok tören olur: orada mod satırı kalır. */
export const hasRouteLine = (route: Pick<Route, 'goalCount' | 'total'>) => route.goalCount >= 2 && route.total > 0;

/*
  PANELİN SATIRI (2026-11-06, kullanıcı: "çok çirkin alakasız karanlık"). Panelde kart içinde kartken zemini ve çerçevesi kalktı;
  mod satırıyla aynı yükseklikte, aynı destenin ilk sayfası. Birden çok hedefte kullanıcıyı listeye değil sıradaki adıma götürür.
*/
export function RouteBanner({ route }: { route: Route }) {
  const { theme } = useAppTheme();
  const display = useDisplayColors();
  const language = useLanguageStore(s => s.language);
  const c = PLAN_COPY[language === 'en' ? 'en' : 'tr'].route;
  return (
    <Touchable
      accessibilityRole="link"
      accessibilityLabel={`${c.title}. ${route.current ? `${c.nextStep(route.current.title)}. ` : ''}${c.progress(route.done, route.total)}`}
      onPress={openRoute}
      hitSlop={{ top: S.xs, bottom: S.xs }}
      style={st.line}
    >
      {route.complete && <CheckCircle2 size={ICON.sm} color={theme.success} />}
      <Text numberOfLines={1} style={[st.text, { color: display.ink }]}>
        {route.current
          ? <><Text style={[st.label, { color: display.label }]}>{`${c.nextLabel}  `}</Text>{route.current.title}</>
          : c.finishTitle}
      </Text>
      <DisplayValue value={`${route.done}/${route.total}`} color={display.muted} style={st.count} seenKey="routeLine" />
      <ChevronRight size={ICON.sm} color={display.label} />
    </Touchable>
  );
}

const MAX_SEGMENTS = 10;

/**
 * Panelin ayracı ilerlemeyi de söyler: iki ayrı çizgi yerine tek çizgi, her adım bir parça. İş bitince parça dolar, sonra durur.
 * Çok adımda parçalar okunmaz, tek çizgi olur.
 */
export function RouteProgress({ route }: { route: Pick<Route, 'done' | 'total' | 'complete'> }) {
  const { theme } = useAppTheme();
  const display = useDisplayColors();
  const reduce = useReduceMotion();
  const color = route.complete ? theme.success : theme.primary;
  const segmented = route.total <= MAX_SEGMENTS;
  const widths = segmented
    ? Array.from({ length: route.total }, (_, i) => (i < route.done ? 100 : 0))
    : [Math.round((route.done / route.total) * 100)];
  return (
    <View testID="route-progress" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={st.progress}>
      {widths.map((w, i) => (
        <View key={i} style={[st.segment, { backgroundColor: display.divider }]}>
          <MotiView
            animate={{ width: `${w}%`, backgroundColor: color }}
            transition={{ type: 'timing', duration: reduce ? 0 : 400, easing: Easing.out(Easing.cubic) }}
            style={st.fill}
          />
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 32 },
  text: { flex: 1, fontSize: F.body, fontWeight: W.semibold },
  label: { fontSize: F.caption, fontWeight: W.semibold },
  count: { fontSize: F.footnote, letterSpacing: 0 },
  progress: { flexDirection: 'row', gap: S.xxs, marginVertical: S.md },
  segment: { flex: 1, height: 2, borderRadius: R.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.full },
});
