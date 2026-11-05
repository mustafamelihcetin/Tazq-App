import React, { createContext, useContext } from 'react';
import { Text } from 'react-native';
import { ChevronRight, CalendarDays } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { modeAccent } from '@/shared/constants/Colors';
import { F, W, S, R, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { PLAN_SLOTS, planHasItems } from '@/features/modes/utils/planSlots';
import { PLAN_COPY } from './planCopy';

/*
  HER HEDEFİN TEK GİRİŞİ, TEK GÖRÜNÜMÜ (2026-11-05, kullanıcı: "Planım kötü yerlerde kötü görünüyor, UI'ı bozuyor"). Ana hedefte özetin altında
  tam genişlik yumuşak düğme; diğer hedeflere Planım'ın üst seçicisinden geçilir. Plan başlamadıysa çizilmez.
*/
/** Kart satırın altında açıldıysa kullanıcı zaten Planım'dan gelmiştir: ikinci giriş çizilmez. */
export const PlanLinkHidden = createContext(false);

export const openPlan = (slot: string) => require('expo-router').router.push({ pathname: '/plan', params: { slot } });

export function PlanLink({ slot }: { slot: string }) {
  const hidden = useContext(PlanLinkHidden);
  const { theme, isDark } = useAppTheme();
  const language = useLanguageStore(s => s.language);
  const has = usePrefsStore(s => planHasItems(s as unknown as Parameters<typeof planHasItems>[0], slot));
  if (!has || hidden) return null;
  const label = PLAN_COPY[language === 'en' ? 'en' : 'tr'].title;
  const type = PLAN_SLOTS.find(r => r.slot === slot)?.type ?? 'exam';
  const accent = modeAccent(type, isDark);
  return (
    <Touchable accessibilityRole="link" onPress={() => openPlan(slot)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH, marginTop: S.sm, paddingHorizontal: S.md, borderRadius: R.md, backgroundColor: accent + (isDark ? '26' : '1A') }}>
      <CalendarDays size={ICON.sm} color={accent} />
      <Text style={{ flex: 1, color: accent, fontSize: F.footnote, fontWeight: W.bold }}>{label}</Text>
      <ChevronRight size={ICON.sm} color={accent} />
    </Touchable>
  );
}
