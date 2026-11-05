import React, { useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { postponeOptions } from '@/features/modes/utils/dayRoute';
import { toDateKey } from '@/shared/utils/dateKey';
import { PLAN_COPY } from './planCopy';

/*
  GERÇEK ERTELE (2026-11-05). "Bugün olmaz" görevi kaldırır; bu ise "o gün yap" der. Hazır seçenekler gün adıyla yazılır: "Hafta sonu" değil "Cumartesi, 7 Kas", kullanıcı neye bastığını bilir.
  Hedef tarihini aşan seçenek sunulmaz: sınavdan sonraya iş ertelenmez.
*/
const LOCALE = { tr: 'tr-TR', en: 'en-US' };
const DAY_MS = 86400000;

export function PostponePicker({ today, goalDate, lang, onPick, onCancel }: { today: string; goalDate: string | null; lang: 'tr' | 'en'; onPick: (dateKey: string) => void; onCancel: () => void }) {
  const { theme } = useAppTheme();
  const c = PLAN_COPY[lang].postpone;
  const [calendar, setCalendar] = useState(false);
  const options = postponeOptions(today, goalDate);
  const fmt = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' });
  const tomorrow = new Date(new Date(`${today}T12:00:00`).getTime() + DAY_MS);
  const pick = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setCalendar(false);
    if (e.type === 'set' && d) onPick(toDateKey(d));
  };
  return (
    <View style={st.wrap}>
      <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{c.title}</Text>
      <View style={st.row}>
        {options.map(o => (
          <Touchable key={o.key} accessibilityRole="button" accessibilityLabel={`${c.labels[o.key]}, ${fmt(o.date)}`} onPress={() => onPick(o.date)} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{c.labels[o.key]}</Text>
            <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{fmt(o.date)}</Text>
          </Touchable>
        ))}
        <Touchable accessibilityRole="button" onPress={() => setCalendar(true)} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
          <CalendarDays size={ICON.sm} color={theme.onSurface} />
          <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{c.pickDay}</Text>
        </Touchable>
      </View>
      {calendar && (
        <DateTimePicker value={tomorrow} minimumDate={tomorrow} maximumDate={goalDate ? new Date(`${goalDate}T12:00:00`) : undefined} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={pick} />
      )}
      <Touchable accessibilityRole="button" onPress={onCancel} style={st.cancel}>
        <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{c.cancel}</Text>
      </Touchable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: S.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  chip: { minHeight: 52, minWidth: 84, paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.md, alignItems: 'flex-start', justifyContent: 'center', gap: S.xxs },
  cancel: { minHeight: 36, justifyContent: 'center' },
});
