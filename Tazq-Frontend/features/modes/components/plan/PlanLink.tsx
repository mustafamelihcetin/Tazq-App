import React from 'react';
import { Text } from 'react-native';
import { ChevronRight, CalendarDays } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { planHasItems } from '@/features/modes/utils/planSlots';
import { PLAN_COPY } from './planCopy';

/** Her hedefin tek girişi. Plan başlamadıysa çizilmez. */
export const openPlan = (slot: string) => require('expo-router').router.push({ pathname: '/plan', params: { slot } });

export function PlanLink({ slot }: { slot: string }) {
  const { theme } = useAppTheme();
  const language = useLanguageStore(s => s.language);
  const has = usePrefsStore(s => planHasItems(s as unknown as Parameters<typeof planHasItems>[0], slot));
  if (!has) return null;
  return (
    <Touchable accessibilityRole="link" onPress={() => openPlan(slot)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH }}>
      <CalendarDays size={ICON.sm} color={theme.primary} />
      <Text style={{ flex: 1, color: theme.primary, fontSize: F.footnote, fontWeight: W.bold }}>{PLAN_COPY[language === 'en' ? 'en' : 'tr'].title}</Text>
      <ChevronRight size={ICON.sm} color={theme.primary} />
    </Touchable>
  );
}
