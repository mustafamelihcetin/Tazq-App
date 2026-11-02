import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, FlatList, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { haptic } from '@/shared/utils/haptics';

/*
  KİLO CETVELİ (2026-11-02, kullanıcı: "kilo modalı açılınca numpad kendiliğinden geldi, alakasız ekranın sol altına
  girdi; klavye gelecekse çözüm lazım ya da çark koy — açıkta bir şey kalmasın").
  Klavye kendiliğinden açılmaz: değer, son kilodan başlayan yatay bir cetvelle (0,1 kg aralık, çizgiye oturur) ya da
  ±0,1 düğmeleriyle seçilir. iPad'de yüzen klavye, Modal içindeki klavye kayması gibi sorunlar yapısal olarak yok.
  Yazmak isteyen sayıya dokunup klavyeyi kendisi açar (bkz. WeightEntryModal).
*/
const MIN = 20;
const MAX = 300;
const STEP = 0.1;
const TICK = 10; // bir 0,1 kg çizgisinin genişliği (pt)
const COUNT = Math.round((MAX - MIN) / STEP) + 1;
const DATA = Array.from({ length: COUNT }, (_, i) => i);

const toIndex = (kg: number) => Math.max(0, Math.min(COUNT - 1, Math.round((kg - MIN) / STEP)));
const toKg = (i: number) => Math.round((MIN + i * STEP) * 10) / 10;

export function WeightRuler({ value, onChange, theme, accent, width }: {
  value: number; onChange: (kg: number) => void; theme: AppTheme; accent: string; width: number;
}) {
  const list = useRef<FlatList<number>>(null);
  const lastIdx = useRef(toIndex(value));
  const dragging = useRef(false);
  const side = Math.max(0, width / 2 - TICK / 2);

  // Dışarıdan değişen değer (± düğmesi, yazma) cetveli de oraya götürür.
  useEffect(() => {
    const i = toIndex(value);
    if (dragging.current || i === lastIdx.current) return;
    lastIdx.current = i;
    list.current?.scrollToOffset({ offset: i * TICK, animated: true });
  }, [value]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    const i = toIndex(MIN + Math.round(e.nativeEvent.contentOffset.x / TICK) * STEP);
    if (i === lastIdx.current) return;
    // Titreşim yalnız tam kiloda — her 0,1'de vızıldamasın.
    if (Math.floor(toKg(i)) !== Math.floor(toKg(lastIdx.current))) haptic.select();
    lastIdx.current = i;
    onChange(toKg(i));
  }, [onChange]);

  const renderItem = useCallback(({ item }: { item: number }) => {
    const whole = item % 10 === 0;
    const half = item % 5 === 0;
    return (
      <View style={styles.cell}>
        <View style={{ width: whole ? 2 : 1, height: whole ? 30 : half ? 20 : 12, borderRadius: R.full, backgroundColor: whole ? theme.onSurfaceVariant : theme.outlineVariant }} />
      </View>
    );
  }, [theme]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: TICK, offset: TICK * index, index }), []);
  const step = (d: number) => { haptic.select(); onChange(toKg(toIndex(value + d))); };
  const contentStyle = useMemo(() => ({ paddingHorizontal: side }), [side]);

  if (width <= 0) return null;
  return (
    <View style={{ gap: S.sm }}>
      <View style={{ height: 44, justifyContent: 'center' }}>
        <FlatList
          ref={list}
          data={DATA}
          horizontal
          keyExtractor={String}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialScrollIndex={toIndex(value)}
          contentContainerStyle={contentStyle}
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK}
          decelerationRate="fast"
          onScrollBeginDrag={() => { dragging.current = true; }}
          onMomentumScrollEnd={() => { dragging.current = false; }}
          onScrollEndDrag={(e) => { if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.x) < 0.05) dragging.current = false; }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          initialNumToRender={Math.ceil(width / TICK) + 10}
          windowSize={5}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
        {/* Okuma çizgisi: ortada sabit, vurgu renginde. */}
        <View pointerEvents="none" style={[styles.needle, { left: width / 2 - 1.5, backgroundColor: accent }]} />
      </View>
      <View style={styles.steps}>
        <Touchable onPress={() => step(-STEP)} accessibilityRole="button" accessibilityLabel="−0,1 kg" style={[styles.stepBtn, { backgroundColor: theme.surfaceField }]}>
          <Minus size={ICON.md} color={theme.onSurface} />
        </Touchable>
        <Touchable onPress={() => step(STEP)} accessibilityRole="button" accessibilityLabel="+0,1 kg" style={[styles.stepBtn, { backgroundColor: theme.surfaceField }]}>
          <Plus size={ICON.md} color={theme.onSurface} />
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { width: TICK, height: 44, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: S.xs },
  needle: { position: 'absolute', top: 0, bottom: 0, width: 3, borderRadius: R.full },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: S.xl },
  stepBtn: { width: MIN_TOUCH + S.sm, height: MIN_TOUCH, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
});
