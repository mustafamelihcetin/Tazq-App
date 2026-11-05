import React, { useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { fmtDateKey } from '@/features/habits';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { usePrefsStore, type SeasonalPrefs } from '@/features/modes/store/usePrefsStore';
import type { ActivePlan } from '@/features/modes/utils/planSlots';
import { toDateKey } from '@/shared/utils/dateKey';
import { Stepper } from '@/features/studyplan/components/StudySettings';
import { STUDY_COPY } from '@/features/studyplan/components/studyCopy';
import type { PlanCopy } from './planCopy';

/*
  HEDEF TARİHİ VE SÜRE (2026-11-05). Eski "Zaman Çizelgesini Ayarla" formu tarihi YYYY-AA-GG diye yazdırıyordu; artık tarih seçici.
  Sınavda süre Çalışma planının haftalık ayarında (StudySettings) olduğu için burada yalnız tarih var.
*/
const STEP_MAX = 480;

export function PlanBasics({ plan, c, lang, withMinutes, onChanged }: { plan: ActivePlan; c: PlanCopy; lang: 'tr' | 'en'; withMinutes: boolean; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const specs = usePrefsStore(s => s.planSpecs);
  const setPlanSpec = usePrefsStore(s => s.setPlanSpec);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const [picker, setPicker] = useState(false);
  const minutes = specs[plan.slot]?.dailyMinutes ?? 30;
  const sc = STUDY_COPY[lang];
  const today = fmtDateKey();
  const pick = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setPicker(false);
    if (e.type === 'set' && d && plan.dateKey) { setSeasonalPref(plan.dateKey as keyof SeasonalPrefs, toDateKey(d)); onChanged(); }
  };
  const setMinutes = (m: number) => {
    setPlanSpec(plan.slot, { ...specs[plan.slot], dailyMinutes: Math.min(STEP_MAX, Math.max(15, m)) });
    useFocusStore.getState().setDailyGoal(Math.min(STEP_MAX, Math.max(15, m)));
    onChanged();
  };
  if (!plan.dateKey && !withMinutes) return null;
  return (
    <View style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      {plan.dateKey && (
        <>
          <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface }]}>{c.dateTitle}</Text>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.dateHint}</Text>
          <Touchable accessibilityRole="button" onPress={() => setPicker(true)} style={[st.date, { backgroundColor: theme.surfaceContainerHigh }]}>
            <CalendarDays size={ICON.sm} color={theme.onSurfaceVariant} />
            <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface }}>{plan.date ? new Date(`${plan.date}T12:00:00`).toLocaleDateString(sc.locale, { day: 'numeric', month: 'long', year: 'numeric' }) : c.pickDate}</Text>
          </Touchable>
          {picker && <DateTimePicker value={plan.date ? new Date(`${plan.date}T12:00:00`) : new Date()} minimumDate={new Date(`${today}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={pick} />}
        </>
      )}
      {withMinutes && (
        <>
          <Text accessibilityRole="header" style={[st.title, { color: theme.onSurface, paddingTop: plan.dateKey ? S.sm : 0 }]}>{c.minutesTitle}</Text>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.minutesHint}</Text>
          <Stepper label={c.minutesTitle} value={minutes} c={sc} onChange={setMinutes} />
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.xs },
  title: { fontSize: F.body, fontWeight: W.bold },
  date: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: MIN_TOUCH, borderRadius: R.md, paddingHorizontal: S.smd, marginTop: S.xs },
});
