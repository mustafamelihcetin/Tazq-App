import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { S, R, F, W, ICON, RSPRING } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, useDisplayColors } from '@/shared/components/DisplayPanel';
import { haptic } from '@/shared/utils/haptics';
import { PillSentence, type PillPart } from '@/shared/components/PillSentence';

/*
  HAFTANIN RESMİ (2026-11-05, kullanıcı: "minimalist değil, görsel içerik az, anlaması zor"). Halkalar ve kayan vurgu kalktı; vurgu cihazda yanlış güne kayıyordu, etiket başka günü söylüyordu.
  Yedi sütun doldukça yükselir: yazı okumadan haftanın resmi görülür. Tam dolan gün tik alır. Açılışta sırayla dolar ve durur; dokunulan sütun bir kez hafifçe zıplar. Boşta hiçbir şey dönmez.
  Sütunun anlamı: dolu kısım yapılan, kesik çerçeve o gün iş yoktu, boş gelecek gün henüz bir şey söylemez.
*/
export type WeekSeg = PillPart;

export interface WeekDay {
  key: string;
  abbr: string;
  num: number;
  isToday: boolean;
  isFuture: boolean;
  /** 0..1 o günün dolulumu; beklenen iş yoksa null. */
  ratio: number | null;
  a11y: string;
}

const COLUMN_H = 68;

function DayColumn({ day, selected, onPress, delay }: { day: WeekDay; selected: boolean; onPress: () => void; delay: number }) {
  const { theme, isDark } = useAppTheme();
  const reduce = useReduceMotion();
  const dc = useDisplayColors();
  const fill = useSharedValue(0);
  const pop = useSharedValue(1);
  const ratio = day.ratio ?? 0;
  const full = ratio >= 1;

  useEffect(() => {
    const to = ratio * COLUMN_H;
    fill.value = reduce ? to : withDelay(delay, withTiming(to, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [ratio, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected && !reduce) pop.value = withSequence(withTiming(1.06, { duration: 110 }), withSpring(1, RSPRING.snappy));
  }, [selected, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const fillStyle = useAnimatedStyle(() => ({ height: fill.value }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const noWork = day.ratio == null && !day.isFuture;

  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={day.a11y} accessibilityState={{ selected }} style={styles.day}>
      <Text style={[styles.abbr, { color: day.isToday ? theme.primary : dc.label }]}>{day.abbr}</Text>
      <Animated.View style={[styles.column, {
        backgroundColor: noWork ? 'transparent' : theme.onSurface + (isDark ? '1F' : '12'),
        borderColor: selected ? theme.primary : noWork ? theme.onSurface + (isDark ? '33' : '26') : 'transparent',
        borderWidth: selected ? 2 : noWork ? 1 : 0,
        borderStyle: noWork && !selected ? 'dashed' : 'solid',
      }, popStyle]}>
        <Animated.View style={[styles.fill, { backgroundColor: full ? theme.success : theme.primaryFill }, fillStyle]} />
        {full && <View style={styles.tick}><Check size={ICON.xs} color={theme.onPrimaryFill} strokeWidth={3} /></View>}
      </Animated.View>
      <Text style={[styles.num, { color: day.isToday || selected ? theme.primary : day.isFuture ? dc.muted : dc.ink }]}>{day.num}</Text>
    </Touchable>
  );
}

export function WeekPanel({ sentence, days, selectedKey, onSelectDay, day }: {
  sentence: WeekSeg[];
  days: WeekDay[]; selectedKey: string; onSelectDay: (key: string) => void;
  /** Seçili günün işleri. */
  day: React.ReactNode;
}) {
  return (
    <DisplayPanel padding={S.md}>
      <PillSentence parts={sentence} />
      <View style={styles.week}>
        {days.map((d, i) => (
          <DayColumn key={d.key} day={d} selected={d.key === selectedKey} delay={i * 45}
            onPress={() => { if (d.key !== selectedKey) { haptic.select(); onSelectDay(d.key); } }} />
        ))}
      </View>
      {day}
    </DisplayPanel>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', marginTop: S.md, marginBottom: S.sm },
  day: { flex: 1, alignItems: 'center', gap: S.xs, paddingVertical: S.xs },
  abbr: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 0.6 },
  column: { width: '72%', height: COLUMN_H, borderRadius: R.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  fill: { width: '100%' },
  tick: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'] },
});
