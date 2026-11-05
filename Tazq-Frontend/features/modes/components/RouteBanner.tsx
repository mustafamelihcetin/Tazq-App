import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useDayRoute } from '@/features/modes/hooks/useDayRoute';
import { PLAN_COPY } from '@/features/modes/components/plan/planCopy';

/** Rota tek kapıdan açılır. Lazy: modül zinciri jest'te expo-router yüklemesin (bkz. openPlan). */
export const openRoute = () => require('expo-router').router.push('/rota');

/*
  ANA EKRANDAKİ KAPI (2026-11-05). Birden çok hedefte kullanıcıyı listeye değil sıradaki adıma götürür: "Sıradaki" tek cümle, yanında yolun neresinde olduğu.
  Tek hedefte çizilmez: orada rota yükten çok tören olur.
*/
export function RouteBanner() {
  const { theme } = useAppTheme();
  const language = useLanguageStore(s => s.language);
  const lang = language === 'en' ? 'en' : 'tr';
  const c = PLAN_COPY[lang].route;
  const route = useDayRoute(lang);
  if (route.goalCount < 2 || route.total === 0) return null;
  const pct = Math.round((route.done / route.total) * 100);
  return (
    <Touchable accessibilityRole="link" accessibilityLabel={`${c.title}. ${c.progress(route.done, route.total)}`} onPress={openRoute} style={[st.card, { backgroundColor: theme.surfaceContainerHigh }]}>
      <View style={st.head}>
        <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: W.bold, color: theme.onSurface }}>{route.complete ? c.finishTitle : c.progress(route.done, route.total)}</Text>
        <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
      </View>
      {route.current && <Text numberOfLines={1} style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.nextStep(route.current.title)}</Text>}
      <View style={[st.track, { backgroundColor: theme.separator }]}>
        <MotiView animate={{ width: `${pct}%` }} transition={{ type: 'timing', duration: 500 }} style={{ height: '100%', borderRadius: R.full, backgroundColor: theme.primary }} />
      </View>
    </Touchable>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.md, padding: S.smd, gap: S.xs, minHeight: MIN_TOUCH, marginBottom: S.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  track: { height: 4, borderRadius: R.full, overflow: 'hidden' },
});
