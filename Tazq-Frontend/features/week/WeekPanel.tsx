import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { S, R, F, W, RSPRING } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, DisplayDivider, useDisplayColors } from '@/shared/components/DisplayPanel';
import { haptic } from '@/shared/utils/haptics';
import { PillSentence, type PillPart } from '@/shared/components/PillSentence';

/*
  HAFTA PANELİ — Haftalık Merkez'in tek ekranı (2026-10-30). Kullanıcı: "haftalık merkezi de ana
  sayfadaki gibi toparlamak lazım; bir ekranda, animasyonlu, şık, anlamlı ve etkileşimli".
  Eskiden beş ayrı kart: gün şeridi, "Bugün · Takvimde aç", "BU HAFTA" sayıları, plan satırı,
  28 günlük ızgaralı alışkanlık listesi. Hiçbiri ötekine bağlı değildi.
  Şimdi ana sayfanın dijital paneliyle aynı dil, tek panel:
    · HAFTANIN CÜMLESİ — veriden kurulur, vurgu yalnız sayılarda.
    · GÜN ŞERİDİ — her günün halkası o günün dolulumu (görev + alışkanlık) ve açılışta dolar;
      seçili günü KAYAN bir vurgu izler (yay animasyonu). Bir güne dokun: altındaki her şey o güne döner.
    · SEÇİLİ GÜN — o günün alışkanlık halkaları (o güne işaretlenir) + "Takvimde aç".
    · HAFTA SAYILARI ve "Gelecek haftayı planla".
  Yuvalar (`day`, `stats`) çağıranda doldurulur: tur hedefleri ve ekranın iş mantığı orada kalır.
*/

export type WeekSeg = PillPart;

export interface WeekDay {
  key: string;
  abbr: string;
  num: number;
  isToday: boolean;
  isFuture: boolean;
  /** 0..1 o günün dolulumu; beklenen iş yoksa null (halka çizilmez). */
  ratio: number | null;
  a11y: string;
}

const RING = 34;
const STROKE = 2.5;

const Arc = ({ progress, color }: { progress: SharedValue<number>; color: string }) => {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const r = RING / 2 - STROKE / 2;
    p.addArc({ x: RING / 2 - r, y: RING / 2 - r, width: r * 2, height: r * 2 }, -90, 359.9);
    return p;
  }, []);
  const end = useDerivedValue(() => progress.value);
  return <Path path={path} style="stroke" strokeWidth={STROKE} strokeCap="round" color={color} start={0} end={end} />;
};

function DayCell({ day, selected, onPress, delay }: { day: WeekDay; selected: boolean; onPress: () => void; delay: number }) {
  const { theme, isDark } = useAppTheme();
  const reduce = useReduceMotion();
  const dc = useDisplayColors();
  const progress = useSharedValue(0);
  const full = day.ratio != null && day.ratio >= 1;
  useEffect(() => {
    const to = day.ratio ?? 0;
    if (reduce) { progress.value = to; return; }
    const t = setTimeout(() => { progress.value = withTiming(to, { duration: 600, easing: Easing.out(Easing.cubic) }); }, delay);
    return () => clearTimeout(t);
  }, [day.ratio, reduce]);
  return (
    <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={day.a11y} accessibilityState={{ selected }} style={styles.day}>
      <Text style={[styles.abbr, { color: day.isToday ? theme.primary : dc.label }]}>{day.abbr}</Text>
      <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
        {day.ratio != null && (
          <Canvas style={{ position: 'absolute', width: RING, height: RING }}>
            <Circle cx={RING / 2} cy={RING / 2} r={RING / 2 - STROKE / 2} style="stroke" strokeWidth={STROKE} color={theme.onSurface + (isDark ? '26' : '1A')} />
            <Arc progress={progress} color={full ? theme.success : theme.primary} />
          </Canvas>
        )}
        <Text style={[styles.num, { color: day.isToday ? theme.primary : day.isFuture ? dc.muted : dc.ink }]}>{day.num}</Text>
      </View>
    </Touchable>
  );
}

export function WeekPanel({ label, sentence, days, selectedKey, onSelectDay, grid, day, stats }: {
  /** Geri Bakış'a geçiş başlıktaki kalıcı ikonda; panelde ikinci bir bağlantı yok (tekrar). */
  label: string;
  sentence: WeekSeg[];
  days: WeekDay[]; selectedKey: string; onSelectDay: (key: string) => void;
  /**
   * Gün sütunlarıyla HİZALI blok (alışkanlık × hafta ızgarası). Şeridin hemen altında, aynı
   * yedi sütunda çizilir; seçili günün vurgusu ızgaranın içinden de akar.
   */
  grid?: React.ReactNode;
  /** Seçili günün satırı (takvim). */
  day: React.ReactNode;
  /** Hafta sayıları + plan satırı. */
  stats: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const dc = useDisplayColors();
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, days.findIndex(d => d.key === selectedKey));
  const col = w / Math.max(1, days.length);
  const x = useSharedValue(0);
  useEffect(() => { x.value = reduce || w === 0 ? idx * col : withSpring(idx * col, RSPRING.snappy); }, [idx, col, reduce]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <DisplayPanel padding={S.md}>
      <View style={styles.status}>
        <Text style={[styles.label, { color: dc.label }]} numberOfLines={1}>{label}</Text>
      </View>

      {/* Ana sayfanın yaşayan cümlesiyle aynı dil: vurgu yumuşak zeminli hap. */}
      <PillSentence parts={sentence} />

      {/* Şerit + ızgara tek kap: seçili gün vurgusu (kayan sütun) ikisini birden kapsar. */}
      <View style={styles.columns} onLayout={e => setW(e.nativeEvent.layout.width)}>
        {w > 0 && <Animated.View pointerEvents="none" style={[styles.pill, { width: col, backgroundColor: theme.primary + '12', borderColor: theme.primary + '33' }, pill]} />}
        <View style={styles.week}>
          {days.map((d, i) => (
            <DayCell key={d.key} day={d} selected={d.key === selectedKey} delay={i * 45}
              onPress={() => { if (d.key !== selectedKey) { haptic.select(); onSelectDay(d.key); } }} />
          ))}
        </View>
        {grid}
      </View>

      <View style={{ gap: S.sm }}>{day}</View>
      <DisplayDivider />
      {stats}
    </DisplayPanel>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm },
  label: { flexShrink: 1, fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2 },
  columns: { marginTop: S.md, marginBottom: S.sm },
  week: { flexDirection: 'row' },
  pill: { position: 'absolute', top: 0, bottom: 0, borderRadius: R.md, borderWidth: 1 },
  day: { flex: 1, alignItems: 'center', gap: S.xs, paddingVertical: S.sm },
  abbr: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 0.6 },
  num: { fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'] },
});
