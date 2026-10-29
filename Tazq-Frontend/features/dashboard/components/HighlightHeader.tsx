import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Star } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { upperFor } from '@/shared/utils/localeCase';
import { S, F, ICON } from '@/shared/constants/tokens';
import { fmtDateKey } from '@/features/habits/store/useHabitStore';
import { getLocalizedTaskTitle } from '@/features/tasks/store/useTaskStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { getModeInfoForTask } from '@/features/modes/utils/modeHelpers';
import { pickHighlight, useHighlightStore, HIGHLIGHT_COPY } from '@/features/dashboard/utils/highlight';

type Item = { id: string | number; priority?: string; original: { title: string; description?: string | null } };

/**
 * Günün Yıldız Görevi (madde 11) — bekleyen listeyi YILDIZ ÖNDE sıralar. Liste ilk
 * satırda zaten "Odaklan"ı taşıdığı için vitrin ayrı kart olmadan doğar (kullanıcı kararı).
 */
export function useHighlight<T extends Item>(pending: T[], disabled: boolean) {
  const choice = useHighlightStore(s => s.choice);
  const today = fmtDateKey();
  return useMemo(() => {
    const real = pending.filter((i): i is T & { id: number } => typeof i.id === 'number');
    const star = disabled ? null : pickHighlight(real, choice, today, i => !!getModeInfoForTask(i.original as never, usePrefsStore.getState(), null));
    return { star, ordered: star ? [star, ...pending.filter(i => i !== star)] : pending, others: real.filter(i => i !== star) };
  }, [pending, disabled, choice, today]);
}

export function HighlightHeader<T extends Item>({ others }: { others: T[] }) {
  const { theme } = useAppTheme();
  const { language } = useLanguageStore();
  const choose = useHighlightStore(s => s.choose);
  const hc = HIGHLIGHT_COPY[language === 'en' ? 'en' : 'tr'];
  const pick = () => Alert.alert(hc.pickTitle, hc.pickBody, [
    ...others.slice(0, 5).map(i => ({ text: getLocalizedTaskTitle(i.original, language !== 'en'), onPress: () => choose(i.id as number, fmtDateKey()) })),
    { text: hc.cancel, style: 'cancel' as const },
  ]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.md, paddingTop: S.xs }}>
      <Star size={ICON.xs} color={theme.warning} fill={theme.warning} />
      <Text style={{ flex: 1, fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, letterSpacing: 0.3 }}>{upperFor(hc.label, language)}</Text>
      {others.length > 0 && (
        <Touchable onPress={pick} accessibilityRole="button" accessibilityLabel={`${hc.label} — ${hc.change}`} style={{ paddingHorizontal: S.sm, paddingVertical: S.xs }}>
          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.primary }}>{hc.change}</Text>
        </Touchable>
      )}
    </View>
  );
}
