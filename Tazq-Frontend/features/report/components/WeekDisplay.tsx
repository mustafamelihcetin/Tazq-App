import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { haptic } from '@/shared/utils/haptics';
import { S, R, F, W, ICON, MIN_TOUCH } from '@/shared/constants/tokens';

/*
  HAFTA ÖZETİ (2026-11-06, kullanıcı: "çok karmaşık"). Tomato ve goodtime'ın haftalık ekranlarındaki düzen: önce tek büyük sayı, sonra kıyas.
  Kutu yok: sayfanın başlığı gibi durur. Hikâye cümlesi kalktı, aynı sayıları ikinci kez söylüyordu; yerine tek cümlelik kıyas.
  Paneli sağa kaydırmak önceki haftaya, sola sonraki haftaya götürür. Dikey kaydırma her zaman sayfanındır.
*/

export interface WeekDisplayProps {
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  /** Büyük sayı: haftanın odak süresi. */
  value: string;
  valueLabel: string;
  /** Geçen haftayla kıyas ya da boş hafta cümlesi. */
  note?: { text: string; up: boolean } | null;
  stats: Array<{ label: string; value: string }>;
  /** Yalnız içinde bulunulan hafta: günlük hedef × 7. */
  goal?: { text: string; pct: number } | null;
}

const SWIPE = 56;

export function WeekDisplay({ label, canPrev, canNext, onPrev, onNext, prevLabel, nextLabel, value, valueLabel, note, stats, goal }: WeekDisplayProps) {
  const { theme } = useAppTheme();
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
        <Ic size={ICON.md} color={theme.onSurfaceVariant} />
      </Touchable>
    );
  };

  return (
    <GestureDetector gesture={pan}>
      <View style={{ gap: S.md }}>
        <View style={styles.nav}>
          {arrow('prev')}
          <Text style={[styles.week, { color: theme.onSurface }]} numberOfLines={1}>{label}</Text>
          {arrow('next')}
        </View>

        <View accessible accessibilityLabel={`${valueLabel}: ${value}. ${note?.text ?? ''}`} style={styles.hero}>
          <Text style={[styles.valueLabel, { color: theme.onSurfaceVariant }]}>{valueLabel}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.value, { color: theme.onSurface }]}>{value}</Text>
          {note && <Text style={[styles.note, { color: note.up ? theme.success : theme.onSurfaceVariant }]}>{note.text}</Text>}
        </View>

        {goal && (
          <View style={[styles.hero, { gap: S.xs }]}>
            <View style={[styles.track, { backgroundColor: theme.outline }]}>
              <View style={{ width: `${Math.round(Math.min(1, goal.pct) * 100)}%`, height: '100%', borderRadius: R.full, backgroundColor: theme.primaryFill }} />
            </View>
            <Text style={[styles.goal, { color: theme.onSurfaceVariant }]}>{goal.text}</Text>
          </View>
        )}

        <View style={[styles.stats, { backgroundColor: theme.surfaceCard }]}>
          {stats.map((s, i) => (
            <View key={s.label} accessible accessibilityLabel={`${s.label}: ${s.value}`} style={[styles.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.separator }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: theme.onSurface }]}>{s.value}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statLabel, { color: theme.onSurfaceMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center' },
  week: { flex: 1, textAlign: 'center', fontSize: F.body, fontWeight: W.semibold },
  arrow: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: S.md, gap: S.xxs },
  valueLabel: { fontSize: F.footnote, fontWeight: W.medium },
  value: { fontSize: F.hero, fontWeight: W.bold, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  note: { fontSize: F.footnote, fontWeight: W.medium },
  track: { height: 4, borderRadius: R.full, overflow: 'hidden' },
  goal: { fontSize: F.caption, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', borderRadius: R.lg, paddingVertical: S.md },
  stat: { flex: 1, alignItems: 'center', gap: S.xxs, paddingHorizontal: S.xs },
  statValue: { fontSize: F.title3, fontWeight: W.bold, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: F.caption },
});
