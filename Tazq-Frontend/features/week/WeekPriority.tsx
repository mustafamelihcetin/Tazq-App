import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import { F, W, S, R, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { modeAccent } from '@/shared/constants/Colors';
import { Touchable } from '@/shared/components/Touchable';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { DisplayPanel, useDisplayColors } from '@/shared/components/DisplayPanel';
import { haptic } from '@/shared/utils/haptics';
import { useDayRouteStore } from '@/features/modes/hooks/useDayRoute';
import { goalTitle } from '@/features/modes/utils/goalTitle';
import { activePlans } from '@/features/modes/utils/planSlots';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { WEEK_COPY } from './weekDay';

/*
  BU HAFTANIN ÖNCELİĞİ (2026-11-05, kullanıcı: "gelecek haftayı planla bir yere bağlanmıyor"). Eski sayfa "gelecek hafta" başlığıyla "bu haftanın hedefi" soruyor, yazılan metin hiçbir şeyi değiştirmiyordu.
  Şimdi seçim gerçek bir etki yapar: seçilen hedef Günün Rotası'nda öne geçer, hafta bitince kendiliğinden düşer. Tek hedefte seçilecek bir şey yok, satır çizilmez.
  Eski serbest metin silinmez: yazmış olan kullanıcı görür ve isterse kaldırır.
*/
export function WeekPriority({ weekEnd, today, lang, note, onClearNote }: { weekEnd: string; today: string; lang: 'tr' | 'en'; note: string; onClearNote: () => void }) {
  const { theme, isDark } = useAppTheme();
  const dc = useDisplayColors();
  const c = WEEK_COPY[lang];
  const prefs = usePrefsStore();
  const priority = useDayRouteStore(s => s.priority);
  const setPriority = useDayRouteStore(s => s.setPriority);
  const [open, setOpen] = useState(false);
  const plans = activePlans(prefs as never);
  const current = priority && priority.until >= today ? plans.find(p => p.slot === priority.slot) ?? null : null;
  const name = (p: (typeof plans)[number]) => goalTitle(p, lang, p.type, true);
  if (plans.length < 2 && !note) return null;
  return (
    <DisplayPanel padding={S.md}>
      {plans.length >= 2 && (
        <Touchable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(v => !v)} style={st.row}>
          <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: W.semibold, color: dc.ink }}>{c.priorityTitle}</Text>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: F.footnote, fontWeight: W.bold, color: current ? modeAccent(current.type as never, isDark) : theme.primary }}>{current ? name(current) : c.choose}</Text>
          <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><ChevronDown size={ICON.xs} color={dc.muted} /></View>
        </Touchable>
      )}
      {open && (
        <Reanimated.View entering={FadeIn.duration(160)} style={{ gap: S.sm, paddingTop: S.xs }}>
          <Text style={{ fontSize: F.caption, color: dc.muted }}>{c.priorityHint}</Text>
          <View style={st.chips}>
            {plans.map(p => {
              const on = current?.slot === p.slot;
              const accent = modeAccent(p.type as never, isDark);
              return (
                <Touchable key={p.slot} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { haptic.select(); setPriority(on ? null : { slot: p.slot, until: weekEnd }); setOpen(false); }} style={[st.chip, { backgroundColor: on ? accent : theme.surfaceContainerHigh }]}>
                  <Text numberOfLines={1} style={{ fontSize: F.footnote, fontWeight: W.semibold, color: on ? theme.onPrimary : theme.onSurface }}>{name(p)}</Text>
                </Touchable>
              );
            })}
          </View>
        </Reanimated.View>
      )}
      {!!note && (
        <View style={st.row}>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: F.caption, color: dc.muted }}>{c.note}: {note}</Text>
          <Touchable accessibilityRole="button" onPress={onClearNote} hitSlop={8}>
            <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: theme.primary }}>{c.removeNote}</Text>
          </Touchable>
        </View>
      )}
    </DisplayPanel>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { paddingHorizontal: S.md, minHeight: 40, borderRadius: R.full, justifyContent: 'center', maxWidth: '100%' },
});
