import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { getCalendars } from 'expo-localization';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/*
  ORTAK AYLIK TAKVİM (2026-11-05). Görevler ve ödemeler aynı ızgarayı kullanır. Dış kütüphane yok: tek ihtiyaç noktalı
  bir ay ızgarası, tema ve erişilebilirlik bizde; yeni bir yerel bağımlılık derleme gerektirmez.
  Hafta başlangıcı cihazdan gelir. Nokta rengi anlamı çağıran belirler; en çok 3 nokta, fazlası "+" sayılmaz, liste altta gösterir.
*/
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Haftanın ilk günü cihaz ayarından (JS sırası: 0 Pazar, 1 Pazartesi). ABD'de Pazar, Türkiye'de Pazartesi. */
export function deviceWeekStart(): number {
  try {
    const first = getCalendars()[0]?.firstWeekday; // expo-localization: 1 Pazar … 7 Cumartesi
    return first ? first - 1 : 1;
  } catch {
    return 1;
  }
}

export function monthGrid(year: number, month0: number, weekStart = 1): (string | null)[][] {
  const first = (new Date(year, month0, 1).getDay() - weekStart + 7) % 7;
  const count = new Date(year, month0 + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= count; d++) cells.push(dayKey(new Date(year, month0, d)));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

export function MonthCalendar({ year, month0, onShift, selected, onSelect, marks, locale, prevLabel, nextLabel, dayTint, renderBelow, dayA11y }: {
  year: number;
  month0: number;
  onShift: (delta: number) => void;
  selected: string;
  onSelect: (key: string) => void;
  marks: Record<string, string[]>;
  locale: string;
  prevLabel: string;
  nextLabel: string;
  /** Günün zemin rengi (ör. o günkü ödemenin rengi). */
  dayTint?: (key: string) => string | null;
  /** Verilirse noktaların yerine günün altına çizilir (ikon + tutar gibi). */
  renderBelow?: (key: string) => React.ReactNode;
  dayA11y?: (key: string) => string | null;
}) {
  const { theme } = useAppTheme();
  const weekStart = useMemo(deviceWeekStart, []);
  const grid = useMemo(() => monthGrid(year, month0, weekStart), [year, month0, weekStart]);
  const today = dayKey(new Date());
  const title = new Date(year, month0, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(2023, 11, 31 + weekStart + i).toLocaleDateString(locale, { weekday: 'short' })), [locale, weekStart]);
  return (
    <View style={{ gap: S.xs }}>
      <View style={styles.head}>
        <Touchable onPress={() => onShift(-1)} accessibilityRole="button" accessibilityLabel={prevLabel} style={styles.nav}>
          <ChevronLeft size={ICON.md} color={theme.onSurface} />
        </Touchable>
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontSize: F.callout, fontWeight: W.bold, color: theme.onSurface, textTransform: 'capitalize' }}>{title}</Text>
        <Touchable onPress={() => onShift(1)} accessibilityRole="button" accessibilityLabel={nextLabel} style={styles.nav}>
          <ChevronRight size={ICON.md} color={theme.onSurface} />
        </Touchable>
      </View>
      <View style={styles.row}>
        {weekdays.map(w => <Text key={w} style={[styles.wd, { color: theme.onSurfaceMuted }]}>{w}</Text>)}
      </View>
      {grid.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key, ci) => {
            if (!key) return <View key={ci} style={styles.slot} />;
            const sel = key === selected;
            const isToday = key === today;
            const dots = (marks[key] ?? []).slice(0, 3);
            const n = Number(key.slice(8));
            return (
              <Touchable key={key} onPress={() => onSelect(key)} accessibilityRole="button" accessibilityState={{ selected: sel }}
                accessibilityLabel={`${new Date(`${key}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', weekday: 'long' })}${dayA11y?.(key) ? `, ${dayA11y(key)}` : dots.length ? `, ${marks[key].length}` : ''}`}
                style={styles.slot}>
                <MotiView animate={{ scale: sel ? 1 : 0.92 }} transition={{ type: 'spring', damping: 16, stiffness: 240 }}
                  style={[styles.day, sel ? { backgroundColor: theme.primaryFill } : isToday ? { borderWidth: 1.5, borderColor: theme.primary, backgroundColor: dayTint?.(key) ?? 'transparent' } : dayTint?.(key) ? { backgroundColor: dayTint(key) as string } : null]}>
                  <Text style={{ fontSize: F.body, fontWeight: sel || isToday ? W.bold : W.medium, fontVariant: ['tabular-nums'], color: sel ? theme.onPrimary : theme.onSurface }}>{n}</Text>
                </MotiView>
                {renderBelow ? renderBelow(key) : (
                  <View style={styles.dots}>
                    {dots.map((c, i) => <View key={i} style={[styles.dot, { backgroundColor: c }]} />)}
                  </View>
                )}
              </Touchable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  nav: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontSize: F.caption, fontWeight: W.semibold, textTransform: 'capitalize' },
  slot: { flex: 1, alignItems: 'center', minHeight: MIN_TOUCH + S.sm, gap: S.xxs },
  day: { width: 38, height: 38, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: S.xxs, height: 5 },
  dot: { width: 5, height: 5, borderRadius: R.full },
});
