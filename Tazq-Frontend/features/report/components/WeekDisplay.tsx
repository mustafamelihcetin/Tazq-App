import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, DisplayReadout, DisplayDivider, useDisplayColors } from '@/shared/components/DisplayPanel';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { haptic } from '@/shared/utils/haptics';
import { S, R, F, W, ICON, MIN_TOUCH } from '@/shared/constants/tokens';

/*
  HAFTA EKRANI — Haftalık Geri Bakış'ın üstü (2026-10-30, dijital panel dili; bkz. DisplayPanel).

  Eskiden beş ayrı parça: hafta okları, hikâye kutusu, dört küçük sayı kartı, iki çubuk. Göz
  hangisinin özet olduğunu bilmiyordu. Şimdi tek ekran:
   · ÜST ŞERİT: hafta okları + hafta etiketi. Paneli SAĞA kaydırmak önceki haftaya, SOLA sonraki
     haftaya götürür (ana sayfadaki "günleri kaydır"la aynı yön ve aynı tik).
   · HİKÂYE: haftanın cümlesi ve geçen haftayla farkı.
   · OKUMALAR: odak · tamamlanan · alışkanlık · aktif gün — hafta değişince rakamlar SAYARAK akar.
   · HEDEF/PLAN: çubuklar panelin içinde.
  Dikey kaydırma her zaman sayfanındır (failOffsetY).
*/

export interface WeekDisplayProps {
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  story: string;
  delta?: { text: string; up: boolean } | null;
  readouts: Array<{ label: string; value: string; tone: 'primary' | 'success' | 'streak' | 'tertiary' }>;
  bars: Array<{ text: string; pct: number; tone: 'primary' | 'tertiary'; highlight?: boolean }>;
}

const SWIPE = 56;

export function WeekDisplay({ label, canPrev, canNext, onPrev, onNext, prevLabel, nextLabel, story, delta, readouts, bars }: WeekDisplayProps) {
  return (
    <DisplayPanel padding={S.md}>
      <Body label={label} canPrev={canPrev} canNext={canNext} onPrev={onPrev} onNext={onNext} prevLabel={prevLabel} nextLabel={nextLabel} story={story} delta={delta} readouts={readouts} bars={bars} />
    </DisplayPanel>
  );
}

function Body({ label, canPrev, canNext, onPrev, onNext, prevLabel, nextLabel, story, delta, readouts, bars }: WeekDisplayProps) {
  const { theme } = useAppTheme();
  const dc = useDisplayColors();
  const prev = () => { if (canPrev) { haptic.select(); onPrev(); } };
  const next = () => { if (canNext) { haptic.select(); onNext(); } };
  /*
    Eşik SÜRÜKLERKEN aşıldığı an bir kez tetiklenir: `onEnd`'e bırakınca, parmak kalkarken
    sayfanın dikey kaydırması jesti iptal ediyor ve hafta hiç değişmiyordu (cihazda görüldü).
  */
  const fired = useSharedValue(false);
  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .onBegin(() => { fired.value = false; })
    .onUpdate((e) => {
      if (fired.value) return;
      if (e.translationX > SWIPE) { fired.value = true; runOnJS(prev)(); }
      else if (e.translationX < -SWIPE) { fired.value = true; runOnJS(next)(); }
    });

  const arrow = (dir: 'prev' | 'next') => {
    const enabled = dir === 'prev' ? canPrev : canNext;
    const Ic = dir === 'prev' ? ChevronLeft : ChevronRight;
    return (
      <Touchable onPress={dir === 'prev' ? prev : next} disabled={!enabled} accessibilityRole="button"
        accessibilityLabel={dir === 'prev' ? prevLabel : nextLabel} accessibilityState={{ disabled: !enabled }}
        style={[styles.arrow, { opacity: enabled ? 1 : 0.3 }]}>
        <Ic size={ICON.sm} color={dc.ink} />
      </Touchable>
    );
  };

  return (
    <GestureDetector gesture={pan}>
      <View>
        <View style={styles.status}>
          {arrow('prev')}
          <Text style={[styles.week, { color: dc.label }]} numberOfLines={1}>{label}</Text>
          {arrow('next')}
        </View>

        <Text style={[styles.story, { color: dc.ink }]}>{story}</Text>
        {delta && <Text style={[styles.delta, { color: delta.up ? theme.success : dc.muted }]}>{delta.text}</Text>}

        <DisplayDivider />
        <View style={styles.grid}>
          {readouts.map(r => (
            <View key={r.label} style={styles.cell}>
              <View style={[styles.dot, { backgroundColor: theme[r.tone] }]} />
              <View style={{ flex: 1 }}><DisplayReadout label={r.label} value={r.value} /></View>
            </View>
          ))}
        </View>

        {bars.length > 0 && <DisplayDivider />}
        {bars.map(b => (
          <View key={b.text} style={{ gap: S.xs, marginBottom: S.sm }}>
            <Text style={[styles.barText, { color: b.highlight ? theme[b.tone] : dc.muted }]}>{b.text}</Text>
            <View style={[styles.track, { backgroundColor: dc.divider }]}>
              <View style={{ width: `${Math.round(Math.min(1, b.pct) * 100)}%`, height: '100%', borderRadius: R.xs, backgroundColor: theme[b.tone] }} />
            </View>
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm },
  week: { flex: 1, textAlign: 'center', fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 1.2 },
  arrow: { width: MIN_TOUCH, height: MIN_TOUCH - 8, alignItems: 'center', justifyContent: 'center' },
  story: { fontSize: F.subhead, fontWeight: W.semibold, lineHeight: 23 },
  delta: { fontSize: F.caption, fontWeight: W.semibold, marginTop: S.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: S.md },
  cell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingRight: S.sm },
  dot: { width: 8, height: 8, borderRadius: R.full },
  barText: { fontSize: F.caption, fontWeight: W.semibold },
  track: { height: 6, borderRadius: R.xs, overflow: 'hidden' },
});
