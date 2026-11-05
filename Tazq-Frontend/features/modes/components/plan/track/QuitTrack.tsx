import { quitItemName } from '@/features/modes/utils/goalTitle';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { Ban, Candy, CircleDollarSign, Plus, Smartphone, Wine, Cigarette, Trophy } from 'lucide-react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useCountUp } from '@/shared/hooks/useCountUp';
import { useGoalAddStore } from '@/features/modes/store/useGoalCloseStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { quitRoomLeft } from '@/features/modes/utils/goalRows';
import { quitView } from '@/features/modes/utils/planTrack';
import { PLAN_COPY } from '../planCopy';
import { getCleanDays, QUIT_MILESTONES, useQuitStore, type QuitItem, type QuitType } from '@/shared/store/useQuitStore';
import { haptic } from '@/shared/utils/haptics';
import { TRACK_COPY } from './trackCopy';

/*
  BIRAKMA TAKİBİ (2026-11-05). Soru tek: kaç gündür temizim, sıradaki eşik ne. Her şeyin kendi sayacı var. Kayma suçlanmaz: sayaç bugünden başlar, en uzun seri silinmez, sözcükler nazik.
  Son takip buradan kaldırılmaz: o, hedefin tamamını kapatmak demektir ve Ayarlar'da onay ister.
*/
const ICONS: Record<QuitType, typeof Ban> = { sigara: Cigarette, sosyal: Smartphone, seker: Candy, alkol: Wine, kumar: CircleDollarSign, ozel: Ban, '': Ban };
const MILESTONE_SHOW = 6;

export function QuitTrack({ accent, lang }: { accent: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const c = TRACK_COPY[lang].quit;
  const router = useRouter();
  const items = useQuitStore(s => s.items);
  return (
    <View style={{ gap: S.md }}>
      {items.map(it => <QuitCard key={it.id} item={it} accent={accent} lang={lang} removable={items.length > 1} />)}
      {items.length === 0 && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant, padding: S.md }}>{c.deviceOnly}</Text>}
      {quitRoomLeft(items.length) > 0
        ? (
      <Touchable accessibilityRole="button" onPress={() => { useGoalAddStore.getState().request('birakma'); router.navigate({ pathname: '/modlar', params: { goal: 'birakma', at: String(Date.now()) } }); }} style={[st.add, { backgroundColor: theme.surfaceCard }]}>
        <Plus size={ICON.sm} color={accent} />
        <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: accent }}>{c.add}</Text>
      </Touchable>
        )
        : <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted, textAlign: 'center' }}>{PLAN_COPY[lang].goals.quitFull}</Text>}
    </View>
  );
}

function QuitCard({ item, accent, lang, removable }: { item: QuitItem; accent: string; lang: 'tr' | 'en'; removable: boolean }) {
  const { theme, isDark } = useAppTheme();
  const c = TRACK_COPY[lang].quit;
  const locale = TRACK_COPY[lang].locale;
  const recordRelapse = useQuitStore(s => s.recordRelapse);
  const removeItem = useQuitStore(s => s.removeItem);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const days = getCleanDays(item.start);
  const shown = useCountUp(days);
  const v = quitView(days, item);
  const Icon = ICONS[item.type] ?? Ban;
  const near = QUIT_MILESTONES.filter(m => m <= days).slice(-2).concat(QUIT_MILESTONES.filter(m => m > days)).slice(0, MILESTONE_SHOW);
  const slip = () => Alert.alert(c.slipTitle(quitItemName(item, lang)), c.slipBody, [
    { text: c.cancel, style: 'cancel' },
    { text: c.slipGo, style: 'destructive', onPress: () => { recordRelapse(item.id); haptic.destructive(); } },
  ]);
  const remove = () => Alert.alert(c.removeTitle(quitItemName(item, lang)), c.removeBody, [
    { text: c.cancel, style: 'cancel' },
    { text: c.removeGo, style: 'destructive', onPress: () => {
      removeItem(item.id);
      const list = useQuitStore.getState().items;
      setSeasonalPref('birakmaName', list.length ? list[0].name + (list.length > 1 ? ` +${list.length - 1}` : '') : '');
    } },
  ]);
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <View style={st.head}>
        <View style={[st.tile, { backgroundColor: accent + (isDark ? '26' : '1A') }]}><Icon size={ICON.md} color={accent} /></View>
        <View style={{ flex: 1, gap: S.xxs }}>
          <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: F.subhead, fontWeight: W.bold, color: theme.onSurface }}>{quitItemName(item, lang)}</Text>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.best(v.best)}</Text>
        </View>
        <View accessible accessibilityLabel={`${days} ${c.cleanUnit}`} style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: F.title, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: accent }}>{shown}</Text>
          <Text style={{ fontSize: F.caption2, fontWeight: W.semibold, color: accent }}>{days === 1 ? c.cleanOne : c.cleanUnit}</Text>
        </View>
      </View>

      <View style={{ gap: S.xs }}>
        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{v.next ? c.next(v.next, v.toNext) : c.allDone}</Text>
        <View accessibilityRole="progressbar" accessibilityValue={{ now: v.stagePct, min: 0, max: 100 }} style={[st.track, { backgroundColor: theme.surfaceContainerHigh }]}>
          <MotiView from={{ width: '0%' }} animate={{ width: `${v.stagePct}%` }} transition={{ type: 'timing', duration: 800 }} style={{ height: '100%', borderRadius: R.full, backgroundColor: accent }} />
        </View>
      </View>

      <View style={st.chain}>
        {near.map((m, i) => {
          const passed = days >= m;
          return (
            <React.Fragment key={m}>
              {i > 0 && <View style={[st.link, { backgroundColor: passed ? accent : theme.surfaceContainerHigh }]} />}
              <MotiView from={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 180, delay: i * 70 }} style={[st.node, { backgroundColor: passed ? accent : theme.surfaceContainerHigh }]}>
                <Text style={{ fontSize: F.caption2, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: passed ? theme.onPrimary : theme.onSurfaceMuted }}>{m}</Text>
              </MotiView>
            </React.Fragment>
          );
        })}
      </View>

      {v.beatBest && (
        <View style={st.best}>
          <Trophy size={ICON.xs} color={theme.warning} />
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.newBest}</Text>
        </View>
      )}
      <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>
        {c.lapses(v.lapses)}{v.lastLapse ? ` · ${c.lastLapse(new Date(`${v.lastLapse}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }))}` : ''}
      </Text>

      <View style={st.actions}>
        <Touchable accessibilityRole="button" onPress={slip} style={st.action}><Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{c.slip}</Text></Touchable>
        {removable
          ? <Touchable accessibilityRole="button" onPress={remove} style={st.action}><Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.remove}</Text></Touchable>
          : <Text style={{ flex: 1, textAlign: 'right', fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.lastItemHint}</Text>}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.smd },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.smd },
  tile: { width: 44, height: 44, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: R.full, overflow: 'hidden' },
  chain: { flexDirection: 'row', alignItems: 'center' },
  node: { minWidth: 30, height: 30, paddingHorizontal: S.xxs, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  link: { flex: 1, height: 2 },
  best: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingRight: S.sm },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, minHeight: MIN_TOUCH + S.sm, borderRadius: R.lg },
});
