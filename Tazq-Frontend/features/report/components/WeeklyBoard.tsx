import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { S, F, R, B } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { shortDayLabels, type WeekSummary, type ReportHabit } from '../weeklyReport';

/**
 * HAFTANIN PANOSU — grafik ve alışkanlık şeridi.
 *
 * Eski rapor yalnız odak dakikasını çiziyordu: görevler bir sayı, alışkanlıklar ise
 * HİÇ yoktu. Kullanıcının haftasının yarısı raporda görünmüyordu.
 */

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    chartTitle: 'Günlük odak',
    minutesShort: 'dk',
    tasksLine: 'Tamamlanan iş',
    habitsTitle: 'Alışkanlıklar',
    noHabits: 'Henüz alışkanlık eklemedin.',
    empty: 'Bu hafta kayıt yok.',
    today: 'bugün',
    dayA11y: (day: string, min: number, tasks: number) => `${day}: ${min} dakika odak, ${tasks} iş`,
    habitA11y: (name: string, done: number, total: number) => `${name}: ${total} günün ${done} günü`,
  },
  en: {
    chartTitle: 'Daily focus',
    minutesShort: 'min',
    tasksLine: 'Tasks done',
    habitsTitle: 'Habits',
    noHabits: 'No habits yet.',
    empty: 'Nothing recorded this week.',
    today: 'today',
    dayA11y: (day: string, min: number, tasks: number) => `${day}: ${min} minutes focus, ${tasks} tasks`,
    habitA11y: (name: string, done: number, total: number) => `${name}: ${done} of ${total} days`,
  },
};

export interface WeekChartProps {
  summary: WeekSummary;
  language: Lang;
  /** Bugünün gün anahtarı — bu haftaya bakılıyorsa sütun işaretlenir. */
  todayKey: string;
}

export const WeekChart: React.FC<WeekChartProps> = ({ summary, language, todayKey }) => {
  const { theme, isDark } = useAppTheme();
  const c = COPY[language];
  const labels = shortDayLabels(language);
  const max = Math.max(1, ...summary.focusPerDay);
  const hasAny = summary.totalFocusMin > 0 || summary.totalTasks > 0;

  return (
    <View style={{ borderRadius: R.lg, borderWidth: B.thin, borderColor: theme.outlineVariant, backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, padding: S.md, gap: S.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{c.chartTitle}</Text>
        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600' }}>{c.minutesShort}</Text>
      </View>

      {!hasAny ? (
        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, paddingVertical: S.md }}>{c.empty}</Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, gap: S.xs }}>
          {summary.focusPerDay.map((min, i) => {
            const dayKey = summary.range.days[i];
            const isToday = dayKey === todayKey;
            const isBest = i === summary.bestDayIndex && min > 0;
            const tasks = summary.tasksPerDay[i];
            const pct = Math.max((min / max) * 100, min > 0 ? 6 : 2);
            return (
              <View
                key={dayKey}
                accessible
                accessibilityLabel={c.dayA11y(labels[i], min, tasks)}
                style={{ flex: 1, alignItems: 'center', gap: S.xxs }}
              >
                {/* Dakika yazısı yalnız DOLU günlerde: boş günler sessiz kalsın. */}
                <Text style={{ fontSize: F.caption, color: min > 0 ? theme.onSurfaceVariant : 'transparent', fontWeight: '700' }}>
                  {min > 0 ? min : '0'}
                </Text>
                <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                  <MotiView
                    from={{ height: 2 }}
                    animate={{ height: `${pct}%` as never }}
                    transition={{ type: 'timing', duration: 420, delay: i * 50 }}
                    style={{ width: '70%', alignSelf: 'center', borderRadius: R.xs, backgroundColor: isBest ? theme.primary : theme.primary + (min > 0 ? '66' : '1F') }}
                  />
                </View>
                {/* Tamamlanan iş: grafiğin altında ikinci bir satır — sayı olarak. */}
                <Text style={{ fontSize: F.caption, color: tasks > 0 ? theme.success : 'transparent', fontWeight: '700' }}>
                  {tasks > 0 ? `${tasks}` : '0'}
                </Text>
                <Text style={{ fontSize: F.caption, color: isToday ? theme.primary : theme.onSurfaceMuted, fontWeight: isToday ? '700' : '600' }}>
                  {labels[i]}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {hasAny && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
          <View style={{ width: 8, height: 8, borderRadius: R.full, backgroundColor: theme.success }} />
          <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{c.tasksLine}</Text>
        </View>
      )}
    </View>
  );
};

export interface HabitWeekListProps {
  habits: ReportHabit[];
  summary: WeekSummary;
  language: Lang;
  todayKey: string;
}

/** Alışkanlıklar hafta boyunca gün gün: yapılan gün dolu, geçen gün boş, gelecek gün soluk. */
export const HabitWeekList: React.FC<HabitWeekListProps> = ({ habits, summary, language, todayKey }) => {
  const { theme, isDark } = useAppTheme();
  const c = COPY[language];
  const days = summary.range.days;

  return (
    <View style={{ borderRadius: R.lg, borderWidth: B.thin, borderColor: theme.outlineVariant, backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, padding: S.md, gap: S.sm }}>
      <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{c.habitsTitle}</Text>
      {habits.length === 0 ? (
        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{c.noHabits}</Text>
      ) : (
        habits.map((h) => {
          const done = new Set(h.completedDates ?? []);
          const created = h.createdAt ? h.createdAt.slice(0, 10) : null;
          const doneCount = days.filter((d) => done.has(d)).length;
          const expected = days.filter((d) => d <= todayKey && (!created || d >= created)).length;
          return (
            <View
              key={h.id}
              accessible
              accessibilityLabel={c.habitA11y(h.name ?? '', doneCount, expected)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}
            >
              <Text numberOfLines={1} style={{ flex: 1, color: theme.onSurface, fontSize: F.footnote, fontWeight: '600' }}>{h.name}</Text>
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
              <Text style={{ width: 38, textAlign: 'right', color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>
                {doneCount}/{Math.max(expected, doneCount)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
};
