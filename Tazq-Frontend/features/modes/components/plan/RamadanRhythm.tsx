import { goalTitle } from '@/features/modes/utils/goalTitle';
import { localizeSporGoal } from '@/features/modes/utils/turkishModes';
import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { detectSporTypeLocal } from '@/features/modes/utils/planAdaptations';
import { activePlans } from '@/features/modes/utils/planSlots';
import { ramadanFrameNow } from '@/features/modes/utils/ramadanPreview';
import { toDateKey } from '@/shared/utils/dateKey';
import { stripEmoji } from '@/shared/utils/emoji';
import { PLAN_COPY } from './planCopy';

/*
  RAMAZAN DÜZENİ KARTI (2026-11-05). Ortak akıl görünür olsun: Ramazan bugün diğer planlarıma ne yaptı. Plan başına tek cümle, sayılar gerçek kuraldan.
  Oruç tutmamak bir istisna değil, bir seçenektir: sebep sorulmaz, yargı cümlesi yok.
*/
export function RamadanRhythm({ lang, onChanged }: { lang: 'tr' | 'en'; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const c = PLAN_COPY[lang].ramadan;
  const prefs = usePrefsStore();
  const spec = prefs.planSpecs.ramazan;
  const frame = ramadanFrameNow();
  const today = toDateKey(new Date());
  if (!frame.inMonth) return null;
  const plans = activePlans(prefs as never).filter(p => p.type !== 'ramazan');
  const setDay = (off: boolean) => { prefs.setPlanSpec('ramazan', { ...spec, notFastingDay: off ? today : null }); onChanged(); };
  const off = spec?.notFastingDay === today;
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.title}</Text>
      <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant }}>{frame.fasting ? c.body : c.paused}</Text>
      {frame.fasting && plans.map((p, i) => {
        const key = p.type === 'spor' ? (detectSporTypeLocal(p.name) === 'kilo' ? 'kilo' : 'spor') : p.type;
        return (
          <View key={p.slot} style={[st.line, i === 0 ? null : { borderTopWidth: HAIRLINE, borderTopColor: theme.separator }]}>
            <Text numberOfLines={1} style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{goalTitle(p, lang, PLAN_COPY[lang].types[p.type], true)}</Text>
            <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.effect[key as keyof typeof c.effect] ?? c.effect.other}</Text>
          </View>
        );
      })}
      {!spec?.notFasting && (
        <Touchable accessibilityRole="button" onPress={() => setDay(!off)} style={st.link}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{off ? c.fastingToday : c.notFastingToday}</Text>
        </Touchable>
      )}
    </View>
  );
}

/** Ayarlar: tüm Ramazan için. */
export function RamadanFastingSwitch({ lang, onChanged }: { lang: 'tr' | 'en'; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const c = PLAN_COPY[lang].ramadan;
  const spec = usePrefsStore(s => s.planSpecs.ramazan);
  const setPlanSpec = usePrefsStore(s => s.setPlanSpec);
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <View style={st.switchRow}>
        <View style={{ flex: 1, gap: S.xxs }}>
          <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{c.switchTitle}</Text>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.switchHint}</Text>
        </View>
        <Switch accessibilityLabel={c.switchTitle} value={!spec?.notFasting} onValueChange={v => { setPlanSpec('ramazan', { ...spec, notFasting: !v }); onChanged(); }} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  title: { fontSize: F.subhead, fontWeight: W.bold },
  line: { gap: S.xxs, paddingVertical: S.sm },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
});
