import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Touchable } from '@/shared/components/Touchable';
import { S, F, R, B, W, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { DAY_NAMES, shortDayLabels, type WeekSummary, type ReportHabit } from '../weeklyReport';

/*
  HAFTANIN GRAFİĞİ VE ALIŞKANLIKLARI (2026-11-06, kullanıcı: "çok karmaşık").
  Sütunların üstünde ve altında iki sıra sayı, yanında lejant vardı. Şimdi yalnız sütun: güne dokununca o günün odak, iş ve alışkanlık sayısı tek satırda (Actual ve goodtime'daki seçili gün deseni).
  Alışkanlıklarda en çok dört satır; fazlası bir dokunuşta açılır.
*/

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    habitsTitle: 'Alışkanlıklar',
    noHabits: 'Henüz alışkanlık eklemedin.',
    empty: 'Bu hafta kayıt yok.',
    detail: (day: string, min: number, tasks: number, habits: number) => [day, min > 0 ? `${min} dk odak` : 'odak yok', tasks > 0 ? `${tasks} iş` : '', habits > 0 ? `${habits} alışkanlık` : ''].filter(Boolean).join(' · '),
    dayA11y: (day: string, min: number, tasks: number) => `${day}: ${min} dakika odak, ${tasks} iş`,
    habitA11y: (name: string, done: number, total: number) => `${name}: ${total} günün ${done} günü`,
    more: (n: number) => `${n} alışkanlık daha`,
    less: 'Daha az göster',
  },
  en: {
    habitsTitle: 'Habits',
    noHabits: 'No habits yet.',
    empty: 'Nothing recorded this week.',
    detail: (day: string, min: number, tasks: number, habits: number) => [day, min > 0 ? `${min} min focus` : 'no focus', tasks > 0 ? `${tasks} task${tasks === 1 ? '' : 's'}` : '', habits > 0 ? `${habits} habit${habits === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '),
    dayA11y: (day: string, min: number, tasks: number) => `${day}: ${min} minutes focus, ${tasks} tasks`,
    habitA11y: (name: string, done: number, total: number) => `${name}: ${done} of ${total} days`,
    more: (n: number) => `${n} more habits`,
    less: 'Show less',
  },
};

const CHART_H = 96;
const HABIT_LIMIT = 4;

export interface WeekChartProps {
  summary: WeekSummary;
  language: Lang;
  /** Bugünün gün anahtarı — bu haftaya bakılıyorsa o gün seçili başlar. */
  todayKey: string;
}

/** Başlangıçta seçili gün: bugün, yoksa haftanın en iyi günü, o da yoksa ilk gün. */
export function initialWeekDay(summary: Pick<WeekSummary, 'range' | 'bestDayIndex'>, todayKey: string): number {
  const today = summary.range.days.indexOf(todayKey);
  if (today >= 0) return today;
  return summary.bestDayIndex >= 0 ? summary.bestDayIndex : 0;
}

export const WeekChart: React.FC<WeekChartProps> = ({ summary, language, todayKey }) => {
  const { theme } = useAppTheme();
  const c = COPY[language];
  const labels = shortDayLabels(language);
  const [picked, setPicked] = useState(() => initialWeekDay(summary, todayKey));
  const max = Math.max(1, ...summary.focusPerDay);
  const hasAny = summary.totalFocusMin > 0 || summary.totalTasks > 0 || summary.habitDone > 0;

  if (!hasAny) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.footnote, textAlign: 'center', paddingVertical: S.sm }}>{c.empty}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.onSurfaceVariant, fontSize: F.footnote, fontWeight: W.medium, fontVariant: ['tabular-nums'] }}>
        {c.detail(DAY_NAMES[language][picked], summary.focusPerDay[picked], summary.tasksPerDay[picked], summary.habitDonePerDay[picked])}
      </Text>
      <View style={styles.chart}>
        {summary.focusPerDay.map((min, i) => {
          const on = i === picked;
          const isToday = summary.range.days[i] === todayKey;
          const h = min > 0 ? Math.max(6, (min / max) * CHART_H) : 3;
          return (
            <Touchable
              key={summary.range.days[i]}
              onPress={() => setPicked(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={c.dayA11y(labels[i], min, summary.tasksPerDay[i])}
              style={styles.col}
            >
              <MotiView
                animate={{ height: h }}
                transition={{ type: 'timing', duration: 320 }}
                style={{ width: '62%', borderRadius: R.xs, backgroundColor: min === 0 ? theme.outline : on ? theme.primaryFill : theme.primaryFill + '4D' }}
              />
              <Text style={{ fontSize: F.caption, color: on || isToday ? theme.onSurface : theme.onSurfaceMuted, fontWeight: on ? W.bold : W.medium }}>{labels[i]}</Text>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
};

export interface HabitWeekListProps {
  habits: ReportHabit[];
  summary: WeekSummary;
  language: Lang;
  todayKey: string;
}

/** Alışkanlıklar hafta boyunca gün gün: yapılan gün dolu, geçen gün boş, gelecek gün soluk. Alışkanlık yoksa hiç çizilmez. */
export const HabitWeekList: React.FC<HabitWeekListProps> = ({ habits, summary, language, todayKey }) => {
  const { theme } = useAppTheme();
  const c = COPY[language];
  const days = summary.range.days;
  const [open, setOpen] = useState(false);
  // O hafta henüz var olmayan alışkanlık boş "0/0" satırı olmaz.
  const relevant = habits.filter(h => {
    const created = h.createdAt ? h.createdAt.slice(0, 10) : null;
    return days.some(d => (h.completedDates ?? []).includes(d) || (d <= todayKey && (!created || d >= created)));
  });
  if (relevant.length === 0) return null;
  const shown = open ? relevant : relevant.slice(0, HABIT_LIMIT);
  const rest = relevant.length - HABIT_LIMIT;

  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceCard }]}>
      <Text style={{ color: theme.onSurface, fontWeight: W.semibold, fontSize: F.body }}>{c.habitsTitle}</Text>
      {shown.map((h) => {
        const done = new Set(h.completedDates ?? []);
        const created = h.createdAt ? h.createdAt.slice(0, 10) : null;
        const doneCount = days.filter((d) => done.has(d)).length;
        const expected = days.filter((d) => d <= todayKey && (!created || d >= created)).length;
        return (
          <View key={h.id} accessible accessibilityLabel={c.habitA11y(h.name ?? '', doneCount, expected)} style={styles.habit}>
            <Text numberOfLines={1} style={{ flex: 1, color: theme.onSurface, fontSize: F.footnote, fontWeight: W.medium }}>{h.name}</Text>
            <View style={{ flexDirection: 'row', gap: S.xxs }}>
              {days.map((d) => {
                const isDone = done.has(d);
                const future = d > todayKey || (created != null && d < created);
                return (
                  <View
                    key={d}
                    style={{
                      width: 10, height: 10, borderRadius: R.full,
                      backgroundColor: isDone ? theme.success : 'transparent',
                      borderWidth: isDone ? 0 : B.thin,
                      borderColor: future ? theme.outlineVariant : theme.onSurfaceMuted + '80',
                      opacity: future ? 0.4 : 1,
                    }}
                  />
                );
              })}
            </View>
            <Text style={{ width: 32, textAlign: 'right', color: theme.onSurfaceVariant, fontSize: F.caption, fontVariant: ['tabular-nums'] }}>
              {doneCount}/{Math.max(expected, doneCount)}
            </Text>
          </View>
        );
      })}
      {rest > 0 && (
        <Touchable onPress={() => setOpen(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.more}>
          <Text style={{ color: theme.primary, fontSize: F.footnote, fontWeight: W.semibold }}>{open ? c.less : c.more(rest)}</Text>
        </Touchable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.sm },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 28 },
  col: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: S.xs },
  habit: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 28 },
  more: { minHeight: MIN_TOUCH - S.sm, justifyContent: 'center' },
});
