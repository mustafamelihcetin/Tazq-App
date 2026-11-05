import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { F, W, S, R, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useDisplayColors } from '@/shared/components/DisplayPanel';
import { haptic } from '@/shared/utils/haptics';
import { getLocalizedTaskTitle } from '@/features/tasks';
import { setTaskDoneSynced } from '@/features/tasks/utils/toggleTaskSynced';
import { PLAN_MODE_TAGS } from '@/features/modes/utils/goalRows';
import { openFirst, tasksOnDay, WEEK_COPY } from './weekDay';

/*
  SEÇİLİ GÜN (2026-11-05). Eskiden tek satır ve "Takvimde aç": güne dokunmanın karşılığı yoktu. Şimdi günün işleri yerinde açılır ve buradan işaretlenir; başka sayfaya gitmek gerekmez.
  En çok üç satır: uzun liste Görevler'in işi, alışkanlıklar da kaydırmadan görünsün. Gelecek gün işaretlenmez, henüz yapılmış olamaz.
*/
const MAX_ROWS = 3;

type RowTask = { id: number | string; title: string; description?: string | null; dueDate?: string | null; isCompleted?: boolean; isArchived?: boolean; tags?: string[] };

export function WeekDayList({ tasks, dayKey, todayKey, dayLabel, lang }: { tasks: RowTask[]; dayKey: string; todayKey: string; dayLabel: string; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const dc = useDisplayColors();
  const router = useRouter();
  const c = WEEK_COPY[lang];
  const future = dayKey > todayKey;
  // Sıra güne girerken kurulur: işaretlenen satır parmağın altından kaçmaz.
  const order = useMemo(() => openFirst(tasksOnDay(tasks, dayKey, todayKey)).map(t => t.id), [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = tasksOnDay(tasks, dayKey, todayKey);
  const byId = new Map(today.map(t => [t.id, t]));
  const list = [...order.flatMap(id => (byId.has(id) ? [byId.get(id)!] : [])), ...today.filter(t => !order.includes(t.id))];
  const done = list.filter(t => t.isCompleted).length;
  const rest = list.length - MAX_ROWS;
  const toggle = (t: RowTask) => {
    if (typeof t.id !== 'number') return;
    haptic.select();
    void setTaskDoneSynced(t.id, !t.isCompleted, (t.tags ?? []).find(x => (PLAN_MODE_TAGS as readonly string[]).includes(x)));
  };
  return (
    <Reanimated.View key={dayKey} entering={FadeIn.duration(180)} style={st.wrap}>
      <View style={st.head}>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: F.body, fontWeight: W.bold, color: dc.ink }}>{dayKey === todayKey ? c.today : dayLabel}</Text>
        {list.length > 0 && <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: dc.muted }}>{done}/{list.length}</Text>}
      </View>
      {list.length === 0 && <Text style={{ fontSize: F.footnote, color: dc.muted }}>{dayKey === todayKey ? c.empty.today : future ? c.empty.future : c.empty.past}</Text>}
      {list.slice(0, MAX_ROWS).map(t => (
        <Touchable key={t.id} disabled={future} accessibilityRole={future ? 'text' : 'checkbox'} accessibilityState={future ? undefined : { checked: !!t.isCompleted }} onPress={() => toggle(t)} style={st.row}>
          {!future && (
            <MotiView animate={{ scale: t.isCompleted ? 1 : 0.92, backgroundColor: t.isCompleted ? theme.success : 'transparent', borderColor: t.isCompleted ? theme.success : theme.onSurfaceMuted }} transition={{ type: 'timing', duration: 180 }} style={st.check}>
              {t.isCompleted && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
            </MotiView>
          )}
          <Text numberOfLines={2} style={{ flex: 1, fontSize: F.footnote, color: t.isCompleted ? dc.muted : dc.ink, textDecorationLine: t.isCompleted ? 'line-through' : 'none' }}>{getLocalizedTaskTitle(t, lang === 'tr')}</Text>
        </Touchable>
      ))}
      {rest > 0 && (
        <Touchable accessibilityRole="link" onPress={() => router.push({ pathname: '/takvim', params: { date: dayKey } })} style={st.link}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.more(rest)}</Text>
          <ChevronRight size={ICON.xs} color={theme.primary} />
        </Touchable>
      )}
    </Reanimated.View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: S.xxs },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, minHeight: MIN_TOUCH - S.xs },
  check: { width: 22, height: 22, borderRadius: R.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: S.xxs, alignSelf: 'flex-start', minHeight: MIN_TOUCH - S.xs },
});
